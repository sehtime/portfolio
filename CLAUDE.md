# Sehyoung Hamjong — Portfolio Site

Personal portfolio for Sehyoung Hamjong (UX & Product Designer, Experience Lead at Merkle).
Built with Eleventy (11ty) as a static site generator — templates + partials, output is still plain static HTML/CSS/JS with no client-side framework.

## Live site
- Currently deployed via GitHub Pages, custom domain: sehyoung.com (see `CNAME`)
- Migrating to Netlify (see Deployment section below) — GitHub Pages/CNAME stay in place until the Netlify cutover is verified
- Git remote: https://github.com/sehtime/portfolio.git, branch `main`
- Pushing to `main` updates the live site — treat commits accordingly

## Structure (post-Eleventy-migration)
- `src/` — source of truth; all pages are `.njk` templates here (flat `.html` files no longer exist, removed from repo, still in git history)
- `src/_includes/layouts/base.njk` — shared page shell every template extends
- `src/_includes/partials/` — shared head, nav, footer, pager, back-link partials. Edit nav/footer/gate wiring here once, not per-page.
- `src/index.njk` — homepage, UX case studies grid
- `src/industrial.njk` — Industrial Design work
- `src/about.njk` — About page
- `src/resume.njk` — Resume page (PDF also served from `assets/`)
- `src/projects/` — individual case study templates (e.g. `gm-energy.njk`, `shell-pricing.njk`, `beat-box.njk`)
- `_site/` — Eleventy's build output (generated, not source — don't hand-edit)
- `css/style.css` — single shared stylesheet for the whole site (unchanged, not templated)
- `assets/img/` — project and site images
- `assets/Sehyoung-Hamjong-Resume.pdf` — downloadable resume
- `gate.js` — client-side password gate (uses `sessionStorage` key `sehgate`); wired into `base.njk`/nav partial
- `.eleventy.js` — Eleventy config
- `package.json` — `npm start` runs local dev server (`eleventy --serve`), `npm run build` builds to `_site/`
- `netlify.toml` — build command + publish dir for Netlify (not yet connected, see below)

## URLs are unchanged
Output paths still resolve exactly as before migration (e.g. `/projects/gm-energy.html`) — existing links, bookmarks, and any inbound links don't break.

## Conventions
- Edit templates in `src/`, never the generated `_site/` output
- Shared chrome (nav, footer, head, gate) lives in `src/_includes/partials/` — change once, applies everywhere
- Fonts: Space Grotesk + Newsreader, loaded from Google Fonts via the shared head partial
- Nav highlights the active top-level section (UX vs Industrial) — this logic lives in the nav partial, preserve it when editing
- New case study pages go in `src/projects/` and get linked from the relevant grid on `index.njk` or `industrial.njk`
- No client-side JS framework — Eleventy only touches build-time templating, the shipped output is still plain HTML/CSS/JS

## Deployment migration (in progress)
Moving hosting from GitHub Pages to Netlify to support the Eleventy build step:
1. Connect the `sehtime/portfolio` GitHub repo in Netlify (auto-detects `netlify.toml`)
2. Deploy previews become automatic on every branch/PR
3. Add `sehyoung.com` as a custom domain in Netlify, update DNS at the registrar per Netlify's instructions
4. Verify on the `*.netlify.app` subdomain first, then cut over DNS
5. Only after DNS cutover is confirmed working: remove `CNAME`, disable GitHub Pages

## Workflow notes
- This is a real git repo already connected to GitHub — commit with clear messages, and confirm before pushing to `main` since it's live
- Preview locally with `npm start` (Eleventy dev server), not the old `python3 -m http.server` — that no longer reflects templating/partials
- Run `npm run build` before verifying anything that depends on the production build output
