module.exports = function (eleventyConfig) {
  // BRIEF_ONLY=1 (set in netlify.toml) ships gated case studies as Brief-only:
  // Full-view markup is removed from the built HTML entirely.
  // Every password-gated case study must be listed here. The gate is
  // client-side only, so anything left in the HTML is readable via view-source
  // (password included) — this transform is what actually protects it.
  const GATED_PAGES = /(gm-energy|shell-pricing|content-curation)\.html$/;

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
        if (child.nodeType === 1 && !keep) child.remove();
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
      // The toggle and gate box stay, but the password is checked server-side:
      // POST it to /api/unlock, which sets the cookie full-auth.js accepts, then
      // land on the protected build. Nothing secret is in this page.
      if (process.env.FULL_BUILD === "1") {
        const href = "/full/" + this.page.outputPath.replace(/^\.?\/?_site\//, "");
        root.querySelector("body").insertAdjacentHTML(
          "beforeend",
          `<script>
(function(){
  var FULL = ${JSON.stringify(href)};
  var bF = document.getElementById('vt-full'), bB = document.getElementById('vt-brief');
  var gate = document.querySelector('.case-gate');
  if(!bF || !gate) return;
  var pw = gate.querySelector('input[type=password]'), err = gate.querySelector('.gate-err'), go = gate.querySelector('button');
  var params = new URLSearchParams(location.search);
  var next = params.get('next');
  if(next && next.indexOf('/full/') !== 0) next = null;
  function open(){ gate.classList.add('open'); pw.focus(); }
  bF.addEventListener('click', open);
  if(params.get('unlock') === '1') open();
  function unlock(){
    err.textContent = '';
    go.disabled = true;
    fetch('/api/unlock', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({password: pw.value})
    }).then(function(r){
      go.disabled = false;
      if(r.ok){ location.href = next || FULL; return; }
      err.textContent = r.status === 503 ? 'Full view is not available yet' : 'Incorrect password';
      pw.value = ''; pw.focus();
    }).catch(function(){
      go.disabled = false;
      err.textContent = 'Something went wrong — try again';
    });
  }
  go.addEventListener('click', unlock);
  pw.addEventListener('keydown', function(e){ if(e.key === 'Enter') unlock(); });
  bB.addEventListener('click', function(){ gate.classList.remove('open'); err.textContent = ''; });
})();
</script>`
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
      // assets/img/emit/ is sensitive material for gated Full views. Anything
      // left there that no shipped page references must not go out publicly —
      // move it behind /full (or delete it when no protected build ships).
      const emitDir = path.join("_site", "assets", "img", "emit");
      if (fs.existsSync(emitDir)) {
        for (const f of fs.readdirSync(emitDir)) {
          const rel = "img/emit/" + f;
          if (shippedRefs.has(rel)) continue;
          const abs = path.join(emitDir, f);
          if (shipFull) {
            const dest = path.join("_site", "full", "assets", rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.renameSync(abs, dest);
          } else {
            fs.unlinkSync(abs);
          }
          console.log(`[briefOnly] emit safety: ${shipFull ? "moved" : "removed"} ${rel}`);
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
            const keyMatch = sc.text.match(/KEY = "([^"]+)"/);
            const gateKey = keyMatch ? keyMatch[1] : "hems-gate";
            sc.set_content(
              `try{sessionStorage.setItem('${gateKey}','1');}catch(e){}\n` +
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
  eleventyConfig.addPassthroughCopy("_redirects");
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
