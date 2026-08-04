module.exports = function (eleventyConfig) {
  // BRIEF_ONLY=1 (set in netlify.toml) ships gated case studies as Brief-only:
  // Full-view markup is removed from the built HTML entirely.
  // Every password-gated case study must be listed here. The gate is
  // client-side only, so anything left in the HTML is readable via view-source
  // (password included) — this transform is what actually protects it.
  const GATED_PAGES = /(gm-energy|shell-pricing)\.html$/;

  // The un-transformed HTML of each gated page, kept so the protected /full/
  // build can be written from it after the public build is done.
  const fullSource = new Map();

  if (process.env.BRIEF_ONLY === "1") {
    const { parse } = require("node-html-parser");
    eleventyConfig.addTransform("briefOnly", function (content) {
      if (!this.page.outputPath || !GATED_PAGES.test(this.page.outputPath)) return content;
      fullSource.set(this.page.outputPath, content);
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
      // `.case:not(.case--brief) > .brief-only{display:none}` would now hide the
      // Brief-only sections we just kept, since case--brief is gone. There is no
      // toggle left in this build, so drop the class and let them render
      // unconditionally. (brief-keep is left alone -- page CSS selects on it.)
      for (const el of article.querySelectorAll(".brief-only")) {
        el.classList.remove("brief-only");
      }
      // strip page scripts tied to the Full view (incl. the password gate)
      for (const sc of root.querySelectorAll("script")) {
        const t = sc.text || "";
        if (/PASSWORD|vt-full|evo-tab|pmlegend/.test(t)) sc.remove();
      }
      // The in-page gate is gone; point at the password-protected build instead.
      // Safe to link publicly — /full/* is behind Basic Auth at the edge.
      const notice =
        process.env.FULL_BUILD === "1" ? article.querySelector(".notice") : null;
      if (notice) {
        const href =
          "/full/" + this.page.outputPath.replace(/^\.?\/?_site\//, "");
        notice.insertAdjacentHTML(
          "afterend",
          `<p class="full-link brief-keep"><a href="${href}">Read the full case study</a><span>Password required — available on request</span></p>`
        );
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
      //    on the public site. These MOVE to _site/full/assets/, which the
      //    full-auth edge function protects — off the public site, still
      //    reachable by the password-protected build.
      //    FULL_BUILD=1 must be set to ship the protected build at all. With it
      //    unset these files are deleted outright, exactly as before — so the
      //    edge guard can be proved live in production (it answers /full/* even
      //    when nothing is there) before any sensitive content sits behind it.
      const shipFull = process.env.FULL_BUILD === "1";
      const pruned = [];
      for (const rel of gatedRefs) {
        if (shippedRefs.has(rel)) continue;
        const abs = path.join("_site", "assets", rel);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          if (shipFull) {
            const dest = path.join("_site", "full", "assets", rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.renameSync(abs, dest);
          } else {
            fs.unlinkSync(abs);
          }
          pruned.push(rel);
        }
      }
      console.log(
        `[briefOnly] ${shipFull ? "moved" : "pruned"} ${pruned.length} Full-view-only asset(s)`
      );
      if (!shipFull) {
        console.log("[briefOnly] FULL_BUILD unset — no protected build written");
        return;
      }

      // 4. Write the protected Full build. Same HTML the local Full view shows,
      //    with two changes: it opens unlocked (the edge function already did
      //    the authenticating, so the in-page password is dead weight), and
      //    Full-only asset refs point at /full/assets/ where they now live.
      const { parse } = require("node-html-parser");
      const fullOnly = new Set(pruned);
      let written = 0;
      for (const [outputPath, html] of fullSource) {
        const root = parse(html);
        const article = root.querySelector("article.case");
        // render Full immediately, before any script runs
        if (article) article.classList.remove("case--brief");
        // Neutralise the in-page gate. The unlock flag has to be set BEFORE the
        // gate IIFE runs (it reads sessionStorage on load), and the gate element
        // stays in the DOM — it is display:none until .open, and setView() would
        // throw without it, breaking the Brief/Full toggle.
        for (const sc of root.querySelectorAll("script")) {
          if (sc.text && /var PASSWORD/.test(sc.text)) {
            sc.set_content(
              "try{sessionStorage.setItem('hems-gate','1');}catch(e){}\n" +
                sc.text.replace(/var PASSWORD = "[^"]*"/, "var PASSWORD = null")
            );
          }
        }
        // rewrite only the Full-only refs; shared assets stay on the public path
        let out = root
          .toString()
          .replace(/\/assets\/([^"'`)\s\\?#]+)/g, (m, rel) =>
            fullOnly.has(decodeURIComponent(rel)) ? `/full/assets/${rel}` : m
          );
        const dest = path.join(
          "_site",
          "full",
          path.relative("_site", outputPath)
        );
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, out);
        written++;
      }
      console.log(
        `[briefOnly] wrote ${written} password-protected page(s) to _site/full/`
      );
    });
  }

  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("robots.txt");
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
