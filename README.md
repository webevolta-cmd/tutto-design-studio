# Tutto Design Studio — website

Single-page website for **Tutto Design Studio**, an architecture and interior design studio at Heratsi St 18, Yerevan. Static site built with [Vite](https://vite.dev) and plain JavaScript: no framework, no server code and no environment variables required.

- Cinematic scroll-scrubbed hero (Higgsfield-generated film of the studio's own Vahagni living-room design)
- Interactive before/after comparison (mouse, touch and keyboard)
- Services, selected work with project galleries, approach, showroom details and contact
- All facts verified against public sources; see [`docs/RESEARCH.md`](docs/RESEARCH.md)

## Run it locally

Requires Node.js 22 (see `.nvmrc`).

```bash
npm ci            # install exactly what package-lock.json pins
npm run dev       # development server at http://localhost:5173
npm run build     # production build into dist/
npm run preview   # serve dist/ at http://localhost:4173
```

## Deploying on Netlify

`netlify.toml` already holds the build settings, so Netlify picks them up when you connect the repository.

| Setting | Value |
| --- | --- |
| Repository | `webevolta-cmd/tutto-design-studio` |
| Branch to deploy | the branch that holds this site (currently `claude/magical-dijkstra-ef06td`; use `main` once it is merged) |
| Base directory | *(leave empty)* |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | 22 (set in `netlify.toml`) |
| Environment variables | none required |

Optional: once a custom domain is attached, set `SITE_URL` (for example `https://tutto.am`) so canonical and social-sharing URLs use it. Without it the build uses Netlify's own `URL` variable automatically.

The site is one page, so no redirects are needed. `public/404.html` is served for unknown paths. Cache headers for hashed assets, fonts and media are in `netlify.toml`.

## Project structure

```
index.html              page markup (all content lives here)
src/main.js             entry: wires up the modules below
src/hero.js             scroll-linked film (progressive frame loading, decoded-frame window, cross-fade)
src/compare.js          before/after slider
src/gallery.js          project gallery dialog
src/ui.js               header, mobile menu, section highlighting, reveal, hours status, copy button
src/styles.css          design tokens and all styles
src/data/*.json         image and hero metadata written by scripts/build_media.py
src/assets/             SVG wordmark (traced from the studio's logo)
public/                 files served as-is: fonts, icons, robots.txt, 404 page, optimized media
media-src/              high-quality masters (not served): 4K hero film, source renders, before/after originals
scripts/build_media.py  regenerates public/media and src/data from media-src
scripts/make-preview.mjs  makes the claude.ai Artifact copy of dist/ used for the review preview
docs/RESEARCH.md        research and source record
```

## Media

The optimized media in `public/media` is committed, so the Netlify build only runs Vite. To regenerate it after changing a master (Python 3.10+, Pillow and ffmpeg required):

```bash
pip install -r scripts/requirements.txt
python3 scripts/build_media.py            # or: hero | compare | projects | brand
```

- **Hero**: `media-src/hero/hero-master-4k.mp4` (3840×2160, 24 fps, 145 frames) becomes 145 WebP frames at 1920×1080 for landscape screens and 145 portrait frames at 720×1280 for phones, plus posters. Frames load progressively, so the hero is usable after a few frames and sharpens as the rest arrive. Phones load every second frame unless the connection is fast, and slow or data-saver connections load every fourth.
- **Before/after**: the studio's 2020 site photo and the aligned design visualization, both at 1600×1067.
- **Projects**: the studio's own visualizations from tutto.am, as 640/1080/1600 px WebP. Sources are listed in `media-src/sources.json`.

Hero provenance: generated with Higgsfield (Kling 4.0 image-to-video, 1080p) from the studio's render of the Vahagni living room, then upscaled to 4K with Higgsfield's ByteDance upscaler. The original 1080p generation is kept at `media-src/hero/hero-kling4-1080p-original.mp4`.

## Content notes for the studio

Things the public sources could not confirm, worth checking before launch:

- **Email**: the only email found (tuttostudios@gmail.com) is on a 2021 contacts page, so it is not published.
- **Weekend hours**: 2GIS lists Monday–Friday 09:00–18:00 and nothing for the weekend; the site shows Saturday and Sunday as closed.
- **Reviews**: no Google, 2GIS or Facebook reviews were found, so the site shows none. If a Google Business Profile is created, real reviews can be added to the Approach section.
- **Brand list**: taken from the logos on the tutto.am home page (2025); confirm it is current.
- **Leadership wording**: the tutto.am About text and its team list name the founder differently, so the site describes Anahit Israyeli Baghdasaryan as studio lead.

## Fonts

Self-hosted from Google Fonts under the SIL Open Font License (licences in `public/fonts`): Bodoni Moda (display), Manrope (text), IBM Plex Mono (labels).
