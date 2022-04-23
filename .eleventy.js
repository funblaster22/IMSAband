const { DateTime } = require("luxon");
const pluginSEO = require("eleventy-plugin-seo");
const purgeCssPlugin = require("eleventy-plugin-purgecss");
const htmlmin = require("html-minifier");
const glob = require("fast-glob");
const Image = require("@11ty/eleventy-img");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');
const urlLib = require("url");

const config = {
  markdownTemplateEngine: "njk",
  pathPrefix: "/IMSAband",
  dir: {
    input: "src",
    includes: "_includes",
    output: "build"
  }
};

/** Returns a promise if async=true or an object if async=false */
function convertImg(src, {sizes=[], async=true}={}) {
  src = src  || "/public/no-img.png";
  const imgDir = path.parse(src).dir;
  // 11ty image does not support absolute file paths because it thinks they are URLs
  // Currently, any images have to go into the src/public directory
  try {
    return (async ? Image : Image.statsSync)(path.join('src', src), {
      //widths,
      formats: ["jpeg", "avif"],
      outputDir: path.join(config.dir.output, imgDir),
      urlPath: path.join(config.pathPrefix, imgDir),
    });
  }  catch {
    console.error("Image", src, "not found");
    return {jpeg: [ {} ]};
  }
}

/* Adapted from https://stackoverflow.com/a/67746326 */
function getPageData(input) {
  // TODO: this works in markdown, but not in config file :(
  // {{ (collections.all | getCollectionItem({ inputPath: './src/pages/ensembles/band.md', outputPath: 'build/pages/ensembles/band/index.html' } )).url | log }}
  const str = fs.readFileSync(input, 'utf8');
  return matter(str).data;
}

module.exports = function(eleventyConfig) {
  eleventyConfig.setTemplateFormats([
    // Templates:
    "html",
    "njk",
    "md",
    // Static Assets:
    "css",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "woff",
    "woff2"
  ]);
  eleventyConfig.addPassthroughCopy("public");
  
  /*
  From: https://github.com/artstorm/eleventy-plugin-seo
  
  Adds SEO settings to the top of all pages
  The "glitch-default" bit allows someone to set the url in seo.json while
  still letting it have a proper glitch.me address via PROJECT_DOMAIN
  */
  const seo = require("./src/seo.json");
  if (seo.url === "glitch-default") {
    seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
  }
  eleventyConfig.addPlugin(pluginSEO, seo);
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  if (process.env.NODE_ENV === "production") {
    eleventyConfig.addPlugin(purgeCssPlugin, {
      config: {
        // Content files referencing CSS classes
        content: [`./${config.dir.output}/**/*.html`],

        // CSS files to be purged in-place
        // TODO: filter inline <style> tags
        css: [`./${config.dir.output}/**/*.css`],
      }
    });
    eleventyConfig.on('eleventy.after', async () => {
      // Runs after the build ends
      // TODO: UglifyJS (used by html-minifier) doesn't support ES6, add back when that is fixed
      for await (const outputPath of glob.stream(config.dir.output + "/**/*.{css,html}")) {
        console.log("Minifying", outputPath);
        const content = await fs.promises.readFile(outputPath, 'utf-8');
        const min = htmlmin.minify(content, {
          useShortDoctype: true,
          removeComments: true,
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: true,
        }).replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//g, '');
        // Replace CSS comments because for some reason html-minify doesn't handle that TODO: check back later
        await fs.promises.writeFile(outputPath, min);
      }
    });
  }

  function htmlDateString(dateObj) {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  }
  eleventyConfig.addFilter("htmlDateString", htmlDateString);
  eleventyConfig.addFilter("icalDateString", dateObj =>
      DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyyLLdd'T'HHmmss'Z'")
  );
  // for some reason, async filters cause 11ty to quit without errors TODO: stay tuned to future updates
  eleventyConfig.addNunjucksFilter("img", src => {
    const metadata = convertImg(src, {async: false});
    const picture = Image.generateObject(metadata, {alt: ""}).picture;
    const test = picture.map(img => `url('${img?.source?.srcset || img.img.src}') type('${img?.source?.type || 'image/jpeg'}')`);

    return "-webkit-image-set(" + test.join(',') + ")";
  });
  eleventyConfig.addNunjucksFilter("imgJpg", src => {
    const metadata = convertImg(src, {async: false});
    return metadata.jpeg[0].url;
  });

  eleventyConfig.addNunjucksFilter("pageData", url => {
    return getPageData('./src' + url);
  });
  eleventyConfig.addNunjucksFilter("includesAllTags", (arr, ...tags) => {
    //console.log(arr.length, arr.map(page => page.data.tags || []));
    return arr.filter(page => {
      // Make sure that `tags` is an array, as that is not guaranteed
      //console.log(page.data.title, page.data.tags || []);
      return tags.every(tag => (page.data.tags || []).includes(tag));
    });
  });
  
  eleventyConfig.setBrowserSyncConfig({ ghostMode: false });
  
  /*
  From: https://github.com/11ty/eleventy/issues/529#issuecomment-568257426 
  
  Adds {{ prevPost.url }} {{ prevPost.data.title }}, etc, to our njks templates
  */
  eleventyConfig.addCollection("posts", function(collection) {
    const coll = collection.getFilteredByTag("posts");

    for (let i = 0; i < coll.length; i++) {
      const prevPost = coll[i - 1];
      const nextPost = coll[i + 1];

      coll[i].data["prevPost"] = prevPost;
      coll[i].data["nextPost"] = nextPost;
    }

    return coll;
  });
  eleventyConfig.addCollection("concerts", function(collection) {
    return collection.getFilteredByTag("concerts").reverse();
  });
  eleventyConfig.addCollection("navigation", function(collection) {
    // This is the stupidest, most verbose code I've ever written >:(
    // TODO: include pages w/o permalink, like sightread.md
    const navPages = collection.getAll()
        .filter(item => item.data.eleventyNavigation && item.url && !item.data.eleventyNavigation.parent).sort((a, b) => (a.data.eleventyNavigation.order || 0) - (b.data.eleventyNavigation.order || 0));
    //console.log(navPages.map(item => item.data.title));
    return navPages;
  });

  // Automatically generates index pages for broad topics like /band by flattening navigation
  /*eleventyConfig.addCollection("doublePagination", function(collection) {

  });*/

  // region Nunjucks Shortcodes
  eleventyConfig.addNunjucksAsyncShortcode("card", async function({inputPath, url}) {
    const data = getPageData(inputPath);
    // I know resolve is depreciated, but it is the only way that allows incomplete URLS (eg. using /pages/about as base)
    const imgSrc = urlLib.resolve(url, data.hero || "/public/no-img.png");
    const imgMetadata = await convertImg(imgSrc);
    //console.log(imgMetadata)
    const img = Image.generateHTML(imgMetadata, {
      alt: "",
      decoding: "async",
    });
    return `
<a href="${path.join(config.pathPrefix, url)}"><div class="card">
    ${img}
    <em>${data.date ? htmlDateString(data.date) : ""}</em>
    <strong>${data.title}</strong>
    ${data.description || ""}
</div></a>
`;
  });

  eleventyConfig.addNunjucksAsyncShortcode("img", async function(src, alt="", {style="", className="", sizes=[]}={}) {
    const metadata = await convertImg(src, {sizes});

    return `<!-- Image source: ./src${src} --> ` + Image.generateHTML(metadata, {
      alt: alt,
      loading: "lazy",
      decoding: "async",
      style,
      class: className
    })
  });

  eleventyConfig.addPairedNunjucksShortcode("instrument", function(content, instrument) {
    const items = content.replace(/^\*\*/gm, '<abbr title="Concert Master">**</abbr> ')
        .replace(/^\*(?!\*)/gm, '<abbr title="Section Leader">*</abbr> ')
        .replace(/\n/g, "</li><li>");
    return `
<details>
  <summary>${instrument}</summary>
  <ul class="reset" style="margin-block-end: 1em;">${items}</ul>
</details>`;
  });
  // endregion

  // TODO: not needed in 11ty 2.0
  const NOT_FOUND_PATH = "build/404.html";
  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: function(err, bs) {

        bs.addMiddleware("*", (req, res) => {
          if (!fs.existsSync(NOT_FOUND_PATH)) {
            throw new Error(`Expected a \`${NOT_FOUND_PATH}\` file but could not find one. Did you create a 404.html template?`);
          }

          const content_404 = fs.readFileSync(NOT_FOUND_PATH);
          // Add 404 http status code in request header.
          res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
          // Provides the 404 content without redirect.
          res.write(content_404);
          res.end();
        });
      }
    }
  });

  // Considering something like https://github.com/11ty/eleventy/issues/332, but it was easier to make individual index files
  // TODO: iterate through every page in the concerts folder, and add tags (each `ensembles` & `title` becomes its own collection)

  return config;
};
