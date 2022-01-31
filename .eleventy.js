const { DateTime } = require("luxon");
const pluginSEO = require("eleventy-plugin-seo");
const Image = require("@11ty/eleventy-img");
const path = require('path');
const fs = require('fs')
const matter = require('gray-matter');

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
  return (async ? Image : Image.statsSync)(path.join('src', src), {
    //widths,
    formats: ["jpeg", "avif"],
    outputDir: path.join('build', imgDir),
    urlPath: path.join(config.pathPrefix, imgDir),
  });
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

  eleventyConfig.addFilter("htmlDateString", dateObj => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });
  // for some reason, async filters cause 11ty to quit without errors TODO: stay tuned to future updates
  eleventyConfig.addNunjucksFilter("img", src => {
    const metadata = convertImg(src, {async: false});
    const picture = Image.generateObject(metadata, {alt: ""}).picture;
    const test = picture.map(img => `url('${img?.source?.srcset || img.img.src}') type('${img?.source?.type || 'image/jpeg'}')`);

    return "-webkit-image-set(" + test.join(',') + ")";
  });

  eleventyConfig.addNunjucksFilter("pageData", url => {
    return getPageData('./src' + url);
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

  // region Nunjucks Shortcodes
  eleventyConfig.addNunjucksShortcode("card", function({inputPath, url}) {
    const data = getPageData(inputPath);
    const imgMetadata = convertImg(data.hero || "/public/no-img.png", {async: false});
    const img = Image.generateHTML(imgMetadata, {
      alt: "",
      decoding: "async",
      style: "width: 100%; height: auto;"
    });
    return `
<a href="${path.join(config.pathPrefix, url)}"><div class="card">
    ${img}
    <strong>${data.title}</strong>
    ${data.description}
</div></a>
`;
  });

  eleventyConfig.addNunjucksAsyncShortcode("img", async function(src, alt="", {style="", className="", sizes=[]}={}) {
    const metadata = await convertImg(src, {sizes});

    return Image.generateHTML(metadata, {
      alt: alt,
      loading: "lazy",
      decoding: "async",
      style,
      class: className
    })
  });

  eleventyConfig.addPairedNunjucksShortcode("instrument", function(content, instrument) {
    instrument = instrument.charAt(0).toUpperCase() + instrument.substring(1).toLowerCase();
    const items = content.replace(/^\*\*/gm, '<abbr title="Concert Master">**</abbr> ')
        .replace(/^\*(?!\*)/gm, '<abbr title="Section Leader">*</abbr> ')
        .replace(/\n/g, "</li><li>");
    return `
<details>
  <summary>${instrument}</summary>
  <ul class="reset">${items}</ul>
</details>`;
  });
  // endregion

  return config;
};
