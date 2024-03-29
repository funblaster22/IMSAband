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

/** Operates synchronously */
function convertImg(src, sizes=[]) {//
  src = src  || "/public/no-img.png";
  const imgDir = path.parse(src).dir;
  // 11ty image does not support absolute file paths because it thinks they are URLs
  // Currently, any images have to go into the src/public directory
  try {
    const params = [path.join('src', src), {
      //widths,
      formats: ["jpeg", "avif"],
      outputDir: path.join(config.dir.output, imgDir),
      urlPath: path.join(config.pathPrefix, imgDir),
    }];
    // Still need to call Image to generate & save images. See https://www.11ty.dev/docs/plugins/image/#synchronous-shortcode
    Image(...params);
    return Image.statsSync(...params);
  }  catch {
    console.error("Image", src, "not found");
    return {jpeg: [ {} ]};
  }
}

/* Adapted from https://stackoverflow.com/a/67746326 */
function getPageData(input) {
  // TODO: this works in markdown, but not in config file :(
  // {{ (collections.all | getCollectionItem({ inputPath: './src/pages/ensembles/band.md', outputPath: 'build/pages/ensembles/band/index.html' } )).url | log }}
  console.warn("Please try to avoid introspection");
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
    // Construct a new Date b/c dates extracted from 'dates' front matter are strings. Nothing happens if dateObj is already a date
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toFormat("LL-dd-yyyy");
  }
  eleventyConfig.addFilter("htmlDateString", htmlDateString);
  eleventyConfig.addFilter("icalDateString", dateObj =>
      DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toFormat("yyyyLLdd'T'HHmmss'Z'")
  );
  // for some reason, async filters cause 11ty to quit without errors TODO: stay tuned to future updates
  eleventyConfig.addNunjucksFilter("img", src => {
    const metadata = convertImg(src);
    const picture = Image.generateObject(metadata, {alt: ""}).picture;
    const test = picture.map(img => `url('${img?.source?.srcset || img.img.src}') type('${img?.source?.type || 'image/jpeg'}')`);

    return "-webkit-image-set(" + test.join(',') + ")";
  });
  eleventyConfig.addNunjucksFilter("imgJpg", src => {
    const metadata = convertImg(src);
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
    const coll = collection.getFilteredByTag("posts").sort(sortDate);

    for (let i = 0; i < coll.length; i++) {
      const prevPost = coll[i - 1];
      const nextPost = coll[i + 1];

      coll[i].data["prevPost"] = prevPost;
      coll[i].data["nextPost"] = nextPost;
    }

    return coll;
  });
  function sortDate(a, b) {
    //console.log(a.url, b.url, htmlDateString(a.data.date), htmlDateString(b.data.date), new Date(a.data.date) - new Date(b.data.date), "is a bigger?", new Date(a.data.date) > new Date(b.data.date))
    const diff = new Date(b.data.date) - new Date(a.data.date);
    return isNaN(diff) ? -1 : diff;
    // lol computed properties are at data.date, not page.date (https://github.com/11ty/eleventy/issues/2514)
    // These aren't always guaranteed to be date objects b/c of conversion from dates[] to date (computed property)
    // check a.date & b.date b/c Javascript has bad, unpredictable behavior for undefined/NaN object values (specifically)
    // Specifically, '/concerts' page is causing issues, even though it isn't even shown >:(
  }
  eleventyConfig.addCollection("concerts", function(collection) {
    //console.log(collection.getFilteredByTag("concerts").filter(i => !!i.data.date).map(i => ({url: i.url, data: {date: i.data.date}})));
    return collection.getFilteredByTag("concerts").sort(sortDate);
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
  function preprocessImg(src, alt="", {style="", className="", sizes=[]}={}) {
    // This significantly speeds up development, especially since I can't use async shortcodes in macros
    if (process.env.NODE_ENV !== "production")
      return `<img src="${config.pathPrefix + src}" alt="${alt}" style="${style}" class="${className}">`;
    const metadata = convertImg(src, sizes);

    return `<!-- Image source: ./src${src} --> ` + Image.generateHTML(metadata, {
      alt: alt,
      loading: "lazy",
      decoding: "async",
      style,
      class: className
    })
  }

  eleventyConfig.addNunjucksShortcode("img", preprocessImg);

  eleventyConfig.addNunjucksShortcode("allimg", function(locations) {
    if (!(locations instanceof Array))
      locations = [locations];
    // Can't use page.url b/c paginated pages permalink don't match file location
    // TODO: make path operations more robust (.replace "./" "/" feels like a hack)
    const entries = glob.sync(locations.map(location =>
      config.dir.input + (path.extname(location) === "" ? location : path.dirname(location)).replaceAll(config.dir.input + "/", "").replaceAll("./", "/") + "/**/*.{jpg,jpeg,png}",
      { caseSensitiveMatch: false }
    ));
    return entries.reduce((acc, outputPath) =>
      acc + preprocessImg(outputPath.replace(config.dir.input + "/", "/")), "");
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
