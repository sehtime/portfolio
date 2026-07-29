module.exports = function (eleventyConfig) {
  // BRIEF_ONLY=1 (set in netlify.toml) ships gated case studies as Brief-only:
  // Full-view markup is removed from the built HTML entirely.
  // Every password-gated case study must be listed here. The gate is
  // client-side only, so anything left in the HTML is readable via view-source
  // (password included) — this transform is what actually protects it.
  const GATED_PAGES = /(gm-energy|shell-pricing)\.html$/;

  if (process.env.BRIEF_ONLY === "1") {
    const { parse } = require("node-html-parser");
    eleventyConfig.addTransform("briefOnly", function (content) {
      if (!this.page.outputPath || !GATED_PAGES.test(this.page.outputPath)) return content;
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
  // ships every file in assets/, so Full-only images stay live and fetchable by
  // direct URL even with no link to them. After a BRIEF_ONLY build, delete any
  // asset that a gated case study references but the shipped site does not.
  //
  // Deliberately a set difference rather than "delete everything unreferenced":
  // assets reached only from outside the build (og: images, the resume PDF,
  // favicons) must survive, so only Full-view assets are ever candidates.
  if (process.env.BRIEF_ONLY === "1") {
    eleventyConfig.on("eleventy.after", async () => {
      const fs = require("fs");
      const path = require("path");
      const ASSET_RE = /\/assets\/([^"'`)\s\\?#]+)/g;
      const collect = (text, into) => {
        for (const m of text.matchAll(ASSET_RE)) into.add(decodeURIComponent(m[1]));
      };

      // 1. everything the gated case studies reference (Brief + Full)
      const gatedRefs = new Set();
      for (const f of fs.readdirSync("src/projects")) {
        if (!GATED_PAGES.test(f.replace(/\.njk$/, ".html"))) continue;
        collect(fs.readFileSync(path.join("src/projects", f), "utf8"), gatedRefs);
      }

      // 2. everything the shipped output actually needs
      const shippedRefs = new Set();
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (/\.(html|css|js|xml|json|txt)$/i.test(entry.name)) {
            collect(fs.readFileSync(p, "utf8"), shippedRefs);
          }
        }
      };
      walk("_site");

      // 3. Full-view-only assets = referenced by a gated page, needed by nobody
      const pruned = [];
      for (const rel of gatedRefs) {
        if (shippedRefs.has(rel)) continue;
        const abs = path.join("_site", "assets", rel);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          fs.unlinkSync(abs);
          pruned.push(rel);
        }
      }
      console.log(
        `[briefOnly] pruned ${pruned.length} Full-view-only asset(s) from _site`
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
