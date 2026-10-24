// Copies only the files the website needs into ./dist and stamps the offline-cache version.
// Run by the GitHub Pages workflow. You can also run it yourself: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons']) {
  const from = path.join(root, item);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(out, item), { recursive: true });
}
const listFiles = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? listFiles(path.join(dir, d.name), base + d.name + '/') : [base + d.name]));
const precache = ['./', ...listFiles(out).filter((f) => f !== 'sw.js' && f !== '.nojekyll' && !f.endsWith('.map'))];
const stamp = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 8) : String(Date.now());
const swp = path.join(out, 'sw.js');
fs.writeFileSync(swp, fs.readFileSync(swp, 'utf8').replace("'baithak-dev'", `'baithak-${stamp}'`).replace('/*PRECACHE*/[]', JSON.stringify(precache)));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Built to dist/ (cache version ' + stamp + ')');
