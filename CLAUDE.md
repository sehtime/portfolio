# Sehyoung Hamjong — Portfolio Site

Personal portfolio for Sehyoung Hamjong (UX & Product Designer, Experience Lead at Merkle).
Plain static HTML/CSS/JS — no build tools, no framework, no npm.

## Live site
- Deployed via GitHub Pages, custom domain: sehyoung.com (see `CNAME`)
- Git remote: https://github.com/sehtime/portfolio.git, branch `main`
- Pushing to `main` updates the live site — treat commits accordingly

## Structure
- `index.html` — homepage, UX case studies grid
- `industrial.html` — Industrial Design work
- `about.html` — About page
- `resume.html` — Resume page (PDF also served from `assets/`)
- `projects/` — individual case study pages (one HTML file per project, e.g. `gm-energy.html`, `shell-pricing.html`, `beat-box.html`)
- `css/style.css` — single shared stylesheet for the whole site
- `assets/img/` — project and site images
- `assets/Sehyoung-Hamjong-Resume.pdf` — downloadable resume
- `gate.js` — client-side password gate (uses `sessionStorage` key `sehgate`); site content is hidden via a `.gated` class on `<html>` until unlocked

## Conventions
- No build step — every HTML file is hand-written and self-contained (each page includes its own `<head>`, repeats the nav, etc.)
- Fonts: Space Grotesk + Newsreader, loaded from Google Fonts via `<link>` in each page's `<head>`
- Nav links are duplicated across every page (`index.html`, `industrial.html`, `about.html`, `resume.html`) — when changing nav, update it everywhere or ask about extracting it
- New case study pages go in `projects/` and get linked from the relevant grid on `index.html` or `industrial.html`
- Keep everything static — no bundlers, no JS frameworks, no build config

## Workflow notes
- This is a real git repo already connected to GitHub — commit with clear messages, and confirm before pushing to `main` since it's live
- Preview locally with `python3 -m http.server` from this folder, then open `http://localhost:8000`
