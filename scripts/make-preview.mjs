// Turns the production build in dist/ into a copy for the claude.ai Artifact preview host.
//
//   node scripts/make-preview.mjs [dist] [out]
//
// Only two things change, both required by that host: the page is written without its
// <html>/<head>/<body> wrapper (the host adds its own), and the web fonts are inlined
// as data: URIs in the stylesheet (the host does not load font files from the page's
// own files). Scripts, styles, markup and media are otherwise byte-for-byte the build.
// Netlify deploys dist/ directly and never uses this script.
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(process.argv[2] || 'dist');
const out = path.resolve(process.argv[3] || '.preview');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

const assets = path.join(out, 'assets');
for (const file of fs.readdirSync(assets).filter((f) => f.endsWith('.css'))) {
  const cssPath = path.join(assets, file);
  const css = fs.readFileSync(cssPath, 'utf8').replace(/url\(\.\.\/fonts\/([\w.-]+\.woff2)\)/g, (_, name) => {
    const data = fs.readFileSync(path.join(out, 'fonts', name)).toString('base64');
    return `url(data:font/woff2;base64,${data})`;
  });
  fs.writeFileSync(cssPath, css);
}

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const headKept = head
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<title>[\s\S]*?<\/title>\s*/, '')
  .replace(/<link rel="preload" href="[^"]*fonts\/[^"]*"[^>]*>\s*/g, '');
const page = [
  '<title>Tutto Design Studio</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  headKept.trim(),
  body.trim(),
  '',
].join('\n');
fs.writeFileSync(path.join(out, 'index.html'), page);

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (full !== path.join(out, 'index.html')) files.push(path.relative(out, full));
  }
};
walk(out);
fs.writeFileSync(`${out}-files.json`, JSON.stringify(files, null, 1));
console.log(`preview: ${files.length} supporting files in ${out}`);
