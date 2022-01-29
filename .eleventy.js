const { DateTime } = require("luxon");
const pluginSEO = require("eleventy-plugin-seo");

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

  // Nunjucks Shortcode
  eleventyConfig.addPairedNunjucksShortcode("parallax", function(content, imgSrc) {

  });
  eleventyConfig.addPairedNunjucksShortcode("instrument", function(content, instrument) {
    instrument = instrument.charAt(0).toUpperCase() + instrument.substring(1).toLowerCase();
    const items = content.replace(/^\*\*/gm, '<abbr title="Concert Master">**</abbr> ')
        .replace(/^\*(?!\*)/gm, '<abbr title="Section Leader">*</abbr> ')
        .split('\n').slice(1, -1).join('<br />');
    return `
<details>
  <summary>${instrument}</summary>
  ${items}
</details>`;
  });

  return {
    markdownTemplateEngine: "njk",
    pathPrefix: "/IMSAband/",
    dir: {
      input: "src",
      includes: "_includes",
      output: "build"
    }
  };
};
