// Compilación del sitio de 99copias (sin dependencias: solo Node >= 18).
//   npm run build   →   genera la carpeta dist/ lista para Cloudflare Pages.
//
// Qué hace:
//  1. Incluye los parciales:  <!--@include header-->  →  partials/header.html (idem footer, fonts, ...)
//  2. Marca la página actual en el menú (aria-current="page").
//  3. Les pone huella a los .css/.js de la raíz (styles.a1b2c3d4.css) y actualiza todas las referencias,
//     incluidas las que están dentro de index.js (así el simulador diferido tampoco queda en caché vieja).
//  4. Copia el resto de los archivos tal cual y genera _headers (caché larga + cabeceras de seguridad).
//  5. Avisa de enlaces internos que no existen.
import { readFile, writeFile, mkdir, readdir, copyFile, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, extname, relative, dirname, sep } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const PARTIALS = join(ROOT, 'partials');
const SKIP = new Set(['node_modules', 'dist', '.git', 'partials', 'build.mjs', 'package.json', 'package-lock.json', '.gitignore', 'README.md', 'LEEME-PRIMERO.txt', 'INTEGRACION-APP.md', '.DS_Store']);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hash = buf => createHash('sha256').update(buf).digest('hex').slice(0, 8);
const kb = n => (n / 1024).toFixed(1) + ' KB';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

// ---------- parciales
const partials = {};
for (const f of await readdir(PARTIALS)) if (f.endsWith('.html')) partials[f.slice(0, -5)] = await readFile(join(PARTIALS, f), 'utf8');

function includes(html, depth = 0) {
  if (depth > 5) throw new Error('Parciales anidados demasiado profundo');
  return html.replace(/<!--@include ([\w-]+)-->/g, (_, name) => {
    if (!(name in partials)) throw new Error(`No existe el parcial "${name}" (partials/${name}.html)`);
    return includes(partials[name], depth + 1);
  });
}

// ---------- archivos
const files = await walk(ROOT);
const rel = p => relative(ROOT, p).split(sep).join('/');
await rm(OUT, { recursive: true, force: true });

// css/js de la raíz → con huella (en orden de dependencia)
const assetNames = files.filter(p => dirname(p) === ROOT && /\.(css|js)$/.test(p)).map(rel);
const texts = Object.fromEntries(await Promise.all(assetNames.map(async n => [n, await readFile(join(ROOT, n), 'utf8')])));
const hashed = {}; // nombre → nombre con huella
const refRe = n => new RegExp(`(["'(])\\.?/${esc(n)}(\\?[^"')]*)?(?=["')])`, 'g');
function rewrite(text, map) {
  for (const [n, h] of Object.entries(map)) text = text.replace(refRe(n), (_, q) => `${q}/${h}`);
  return text;
}
let pending = [...assetNames];
for (let guard = 0; pending.length && guard < 10; guard++) {
  const next = [];
  for (const n of pending) {
    const deps = assetNames.filter(o => o !== n && refRe(o).test(texts[n]));
    if (deps.some(d => !hashed[d])) { next.push(n); continue; }
    texts[n] = rewrite(texts[n], hashed);
    const ext = extname(n);
    hashed[n] = `${n.slice(0, -ext.length)}.${hash(texts[n])}${ext}`;
  }
  pending = next;
}
if (pending.length) throw new Error('Dependencia circular entre: ' + pending.join(', '));

// ---------- escribir
const pages = [];
const warnings = [];
const written = new Set();
for (const p of files) {
  const r = rel(p);
  const dest = join(OUT, ...(r in hashed ? [hashed[r]] : [r]));
  await mkdir(dirname(dest), { recursive: true });
  written.add('/' + (r in hashed ? hashed[r] : r));
  if (r in hashed) { await writeFile(dest, texts[r]); continue; }
  if (r.endsWith('.html')) {
    let html = await readFile(p, 'utf8');
    // páginas antiguas que aún usan <script src="/menu.js"> para inyectar el menú
    if (!html.includes('<!--@include header-->') && html.includes('<script src="/menu.js"></script>') && !html.includes('class="nav"'))
      html = html.replace('<script src="/menu.js"></script>', '<!--@include header-->');
    html = includes(html);
    if (!html.includes('id="contenido"')) html = html.replace(/<a class="skip-link"[^>]*>.*?<\/a>\s*/s, ''); // sin <main id="contenido">, no hay destino
    const path = r === 'index.html' ? '/' : '/' + r.replace(/\.html$/, '');
    html = html.replace(/(<nav class="nav-links"[^>]*>)(.*?)(<\/nav>)/s, (_, a, links, c) =>
      a + links.replace(/<a href="([^"#]*)"(?![^>]*aria-current)/g, (m, h) => (h === path ? `<a href="${h}" aria-current="page"` : m)) + c);
    html = rewrite(html, hashed);
    pages.push({ r, path, html });
    await writeFile(dest, html);
  } else await copyFile(p, dest);
}

// ---------- _headers
const extraHeaders = files.find(p => rel(p) === '_headers');
const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/*.css
  Cache-Control: public, max-age=31536000, immutable
/*.js
  Cache-Control: public, max-age=31536000, immutable
/vendor/*
  Cache-Control: public, max-age=31536000, immutable
/img/*
  Cache-Control: public, max-age=2592000
`;
await writeFile(join(OUT, '_headers'), (extraHeaders ? (await readFile(extraHeaders, 'utf8')).trimEnd() + '\n\n' : '') + headers);

// ---------- validaciones (solo avisos)
const known = new Set([...written, ...pages.flatMap(p => [p.path, p.path + '/'])]);
for (const { r, html } of pages) {
  if (/fonts\.(googleapis|gstatic)\.com/.test(html)) warnings.push(`${r}: todavía referencia Google Fonts`);
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const u = m[1];
    if (u === '/' || known.has(u) || known.has(u + '.html')) continue;
    warnings.push(`${r}: enlace interno sin destino → ${u}`);
  }
}

// ---------- resumen
console.log('\nBuild listo → dist/\n');
console.log('Páginas:', pages.map(p => p.r).join(', '));
console.log('\nArchivos con huella:');
for (const [n, h] of Object.entries(hashed)) console.log(`  ${n.padEnd(16)} → ${h.padEnd(26)} ${kb((await stat(join(OUT, h))).size)}`);
if (warnings.length) { console.log('\nAvisos:'); [...new Set(warnings)].forEach(w => console.log('  ⚠', w)); } else console.log('\nSin avisos.');
