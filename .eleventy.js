const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy({ "node_modules/@atgeo/client/dist/*.js": "js/atgeo-client" });
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/CNAME");

  eleventyConfig.addShortcode("mapSearch", function () {
    return '<div id="map-search" class="widget"></div>';
  });

  eleventyConfig.addShortcode("mapDemo", function () {
    return '<div id="map-demo" class="widget"></div>';
  });

  eleventyConfig.addShortcode("placeDisplay", function () {
    return '<div id="place-display" class="widget"></div>';
  });

  eleventyConfig.addShortcode("queryDemo", function () {
    return '<div id="query-demo" class="widget"></div>';
  });

  eleventyConfig.amendLibrary("md", (mdLib) => {
    mdLib.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
    mdLib.renderer.rules.table_close = () => '</table></div>';

    // Give h2-h4 an id from their text, so pages can link to sections.
    mdLib.core.ruler.push("heading_ids", (state) => {
      const seen = new Map();
      state.tokens.forEach((token, i) => {
        if (token.type !== "heading_open" || !["h2", "h3", "h4"].includes(token.tag)) return;
        if (token.attrGet("id")) return;
        const text = state.tokens[i + 1].children
          .filter((t) => t.type === "text" || t.type === "code_inline")
          .map((t) => t.content)
          .join("");
        const base = slugify(text);
        const n = seen.get(base) || 0;
        seen.set(base, n + 1);
        token.attrSet("id", n ? `${base}-${n}` : base);
      });
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
