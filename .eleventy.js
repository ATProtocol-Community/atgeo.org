module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/CNAME");

  eleventyConfig.addShortcode("mapDemo", function () {
    return '<div id="map-demo" class="widget"></div>';
  });

  eleventyConfig.addShortcode("placeDisplay", function () {
    return '<div id="place-display" class="widget"></div>';
  });

  eleventyConfig.addShortcode("queryDemo", function () {
    return '<div id="query-demo" class="widget"></div>';
  });

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
