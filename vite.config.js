import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const images = JSON.parse(readFileSync(new URL('./src/data/images.json', import.meta.url), 'utf8'));
const wordmark = readFileSync(new URL('./src/assets/tutto-wordmark.svg', import.meta.url), 'utf8');
const wordmarkPath = wordmark.match(/<path[^>]*\sd="([^"]+)"/)[1];

// Netlify sets URL at build time; SITE_URL can override it. Used for absolute social/SEO URLs.
const siteUrl = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');

// Expands <img data-img="ID" ...> into a responsive <img> with src, srcset, width and height
// from src/data/images.json (written by scripts/build_media.py), and inlines the logo path.
function studioHtml() {
  return {
    name: 'tutto-studio-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        html = html.replace('%WORDMARK_PATH%', wordmarkPath);
        return html.replace(/<img\b([^>]*?)\sdata-img="(\d+)"([^>]*)>/g, (_, before, id, after) => {
          const info = images[id];
          if (!info) throw new Error(`index.html references unknown image ${id}`);
          const variants = info.variants;
          const largest = variants[variants.length - 1];
          const fallback = variants.find((v) => v.w >= 1080) || largest;
          const srcset = variants.map((v) => `/${v.src} ${v.w}w`).join(', ');
          return `<img${before}${after} src="/${fallback.src}" srcset="${srcset}" width="${largest.w}" height="${largest.h}">`;
        });
      },
    },
  };
}

function absoluteUrls() {
  return {
    name: 'tutto-absolute-urls',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!siteUrl) return html;
        const og = `${siteUrl}/media/og-image.jpg`;
        return html
          .replace(/content="\.?\/?media\/og-image\.jpg"/g, `content="${og}"`)
          .replace(/"image": "[^"]*og-image\.jpg"/, `"image": "${og}"`)
          .replace(/"logo": "[^"]*icon-512\.png"/, `"logo": "${siteUrl}/icon-512.png"`)
          .replace('<meta property="og:type"', `<link rel="canonical" href="${siteUrl}/">\n<meta property="og:url" content="${siteUrl}/">\n<meta property="og:type"`);
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [studioHtml(), absoluteUrls()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    cssMinify: true,
  },
});
