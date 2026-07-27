module.exports = function (eleventyConfig) {
  // BRIEF_ONLY=1 (set in netlify.toml) ships gated case studies as Brief-only:
  // Full-view markup is removed from the built HTML entirely.
  if (process.env.BRIEF_ONLY === "1") {
    const { parse } = require("node-html-parser");
    eleventyConfig.addTransform("briefOnly", function (content) {
      if (!this.page.outputPath || !/gm-energy\.html$/.test(this.page.outputPath)) return content;
      const root = parse(content);
      const article = root.querySelector("article.case");
      if (!article) return content;
      for (const child of [...article.childNodes]) {
        const cls = child.classList ? [...child.classList.values()] : [];
        const keep = cls.includes("brief-keep") || cls.includes("brief-only");
        const isGateOrToggle = cls.includes("case-gate") || (child.querySelector && child.querySelector(".view-toggle"));
        if (child.nodeType === 1 && (!keep || isGateOrToggle)) child.remove();
      }
      article.classList.remove("case--brief");
      // strip page scripts tied to the Full view (incl. the password gate)
      for (const sc of root.querySelectorAll("script")) {
        const t = sc.text || "";
        if (/PASSWORD|vt-full|evo-tab|pmlegend/.test(t)) sc.remove();
      }
      return root.toString();
    });
  }

  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addGlobalData("permalink", () => "{{ page.filePathStem }}.html");
  eleventyConfig.addFilter("isDraft", function (collection, slug) {
    const item = (collection || []).find((p) => p.fileSlug === slug);
    return item ? !!item.data.draft : false;
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    },
    htmlTemplateEngine: "njk"
  };
};
