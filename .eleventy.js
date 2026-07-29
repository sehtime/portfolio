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

  // Stripping the Full-view markup is not enough on its own: passthrough copy
  // ships every file in assets/, so Full-only images would still be live and
  // fetchable by direct URL. After a BRIEF_ONLY build, delete any hems image
  // that nothing in the output actually references.
  if (process.env.BRIEF_ONLY === "1") {
    eleventyConfig.on("eleventy.after", async () => {
      const fs = require("fs");
      const path = require("path");
      const hemsDir = path.join("_site", "assets", "img", "hems");
      if (!fs.existsSync(hemsDir)) return;

      const referenced = new Set();
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (/\.(html|css|js|xml|json)$/i.test(entry.name)) {
            const text = fs.readFileSync(p, "utf8");
            for (const m of text.matchAll(/assets\/img\/hems\/([^"'`)\s\\]+)/g)) {
              referenced.add(decodeURIComponent(m[1]));
            }
          }
        }
      };
      walk("_site");

      const pruned = [];
      for (const name of fs.readdirSync(hemsDir)) {
        if (!referenced.has(name)) {
          fs.unlinkSync(path.join(hemsDir, name));
          pruned.push(name);
        }
      }
      console.log(
        `[briefOnly] pruned ${pruned.length} unreferenced hems asset(s); kept ${referenced.size}`
      );
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
