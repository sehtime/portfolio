# Sehyoung Hamjong — Portfolio Site

Personal portfolio for Sehyoung Hamjong (UX & Product Designer, Experience Lead at Merkle).
Built with Eleventy (11ty) as a static site generator — templates + partials, output is still plain static HTML/CSS/JS with no client-side framework.

## Live site
- Deployed via Netlify, custom domain: sehyoung.com (DNS managed in Cloudflare, custom domain configured in Netlify's dashboard — no `CNAME` file needed anymore)
- Netlify builds from `main` with `npm run build` (via `netlify.toml`), publishes `_site/`
- Every branch/PR gets an automatic Netlify deploy preview URL — use that to check changes before merging to `main`
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
- `netlify.toml` — build command + publish dir for Netlify

## URLs are unchanged
Output paths still resolve exactly as before migration (e.g. `/projects/gm-energy.html`) — existing links, bookmarks, and any inbound links don't break.

## Conventions
- Edit templates in `src/`, never the generated `_site/` output
- Shared chrome (nav, footer, head, gate) lives in `src/_includes/partials/` — change once, applies everywhere
- Fonts: Space Grotesk + Newsreader, loaded from Google Fonts via the shared head partial
- Nav highlights the active top-level section (UX vs Industrial) — this logic lives in the nav partial, preserve it when editing
- New case study pages go in `src/projects/` and get linked from the relevant grid on `index.njk` or `industrial.njk`
- No client-side JS framework — Eleventy only touches build-time templating, the shipped output is still plain HTML/CSS/JS

## Workflow notes
- This is a real git repo already connected to GitHub — commit with clear messages, and confirm before pushing to `main` since it's live
- Preview locally with `npm start` (Eleventy dev server), not the old `python3 -m http.server` — that no longer reflects templating/partials
- Run `npm run build` before verifying anything that depends on the production build output
