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
//  6. PRECIOS: lee precios.json (única fuente) y lo inyecta de forma estática:
//       {{precio:fotos.10x15}}            →  $800        (formateado)
//       {{num:fotos.10x15}}               →  800         (número crudo: JSON-LD, atributos)
//       {{precio:impresion.byn*50+acabado.anillado}}  →  cuentas permitidas (+ - * / paréntesis)
//       {{precio:envio.min}} / .max       →  mínimo / máximo de cada grupo (automático)
//       const PRECIOS = /*@PRECIOS*/null; →  el objeto completo, para los cotizadores JS
//     Falla el build si una clave no existe, y avisa de claves sin uso y de "$123" escritos a mano.
//  7. SEO: genera dist/sitemap.xml (NO hay sitemap.xml a mano en el repo) y valida cada página generada:
//       - sitemap: solo <loc> y <lastmod>; excluye las páginas con noindex (se detecta en el HTML final);
//         lastmod = fecha del último commit de git del archivo (y, si la página usa precios, también de precios.json).
//         Sin git, o con un clon superficial, el sitemap sale sin lastmod (mejor omitirlo que inventarlo) y avisa.
//       - avisos: falta/duplicado de H1, canonical ausente o distinto de la URL de la página, JSON-LD inválido,
//         title/description ausentes, repetidos o largos, y robots.txt sin la línea Sitemap.
import { readFile, writeFile, mkdir, readdir, copyFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, extname, relative, dirname, sep } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const PARTIALS = join(ROOT, 'partials');
const SKIP = new Set(['node_modules', 'dist', '.git', 'partials', 'build.mjs', 'package.json', 'package-lock.json', '.gitignore', 'precios.json', 'README.md', 'LEEME-PRIMERO.txt', 'INTEGRACION-APP.md', '.DS_Store', 'sitemap.xml']); // sitemap.xml: lo genera el build
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

const warnings = [];

// ---------- precios (precios.json → tokens en HTML/JS)
const precios = (function limpiar(o, ruta = '') {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('_')) continue; // _leeme y otras notas
    if (v && typeof v === 'object') out[k] = limpiar(v, ruta + k + '.');
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else throw new Error(`precios.json: "${ruta + k}" debe ser un número`);
  }
  return out;
})(JSON.parse(await readFile(join(ROOT, 'precios.json'), 'utf8')));
const flat = {};
(function aplanar(o, p = '') {
  const nums = [];
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'object') aplanar(v, p + k + '.'); else { flat[p + k] = v; nums.push(v); }
  }
  if (p && nums.length) { flat[p + 'min'] ??= Math.min(...nums); flat[p + 'max'] ??= Math.max(...nums); }
})(precios);
const usados = new Set();
const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function calcular(expr, donde) {
  const e = expr.replace(/[A-Za-z_][\w.]*/g, k => {
    if (!(k in flat)) throw new Error(`${donde}: no existe el precio "${k}" en precios.json`);
    usados.add(k);
    if (/\.(min|max)$/.test(k)) usados.add(k.replace(/\.(min|max)$/, ''));
    return `(${flat[k]})`;
  });
  if (!/^[\d\s+\-*/().]+$/.test(e)) throw new Error(`${donde}: expresión de precio inválida "${expr}"`);
  const v = Function(`"use strict";return (${e})`)();
  if (!Number.isFinite(v)) throw new Error(`${donde}: la expresión "${expr}" no da un número`);
  return v;
}
const inyectarPrecios = (text, donde) => text
  .replace(/\/\*@PRECIOS\*\/\s*null/g, () => JSON.stringify(precios))
  .replace(/\{\{(precio|num):([^{}]+?)\}\}/g, (_, tipo, expr) => {
    const v = calcular(expr.trim(), donde);
    return tipo === 'num' ? String(v) : '$' + miles(v);
  });

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
// precios en los JS: ANTES de calcular la huella, así al cambiar un precio cambia el nombre del archivo (caché nueva)
for (const n of assetNames) {
  if (n.endsWith('.js')) for (const m of texts[n].matchAll(/['"`>]\$\s?\d[\d.]*/g)) warnings.push(`${n}: precio escrito a mano → ${m[0].slice(1)} (usá PRECIOS)`);
  for (const m of texts[n].matchAll(/\bPRECIOS((?:\.\w+)+)/g)) usados.add(m[1].slice(1));
  texts[n] = inyectarPrecios(texts[n], n);
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
    const usaPrecios = /\{\{(?:precio|num):/.test(html); // para el lastmod del sitemap
    for (const m of html.matchAll(/\$\s?\d[\d.]*/g)) warnings.push(`${r}: precio escrito a mano → ${m[0]} (usá {{precio:clave}})`);
    html = inyectarPrecios(html, r); // después de los parciales: también valen dentro de partials/
    if (!html.includes('id="contenido"')) html = html.replace(/<a class="skip-link"[^>]*>.*?<\/a>\s*/s, ''); // sin <main id="contenido">, no hay destino
    const path = r === 'index.html' ? '/' : '/' + r.replace(/\.html$/, '');
    html = html.replace(/(<nav class="nav-links"[^>]*>)(.*?)(<\/nav>)/s, (_, a, links, c) =>
      a + links.replace(/<a href="([^"#]*)"(?![^>]*aria-current)/g, (m, h) => (h === path ? `<a href="${h}" aria-current="page"` : m)) + c);
    html = rewrite(html, hashed);
    pages.push({ r, path, html, usaPrecios });
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

// precios: avisos de mantenimiento
const hoja = (o, p = '') => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? hoja(v, p + k + '.') : [p + k]);
for (const k of hoja(precios)) if (![...usados].some(u => k === u || k.startsWith(u + '.'))) warnings.push(`precios.json: "${k}" no se usa en ninguna página`);

// ---------- SEO: validación + sitemap.xml
const ORIGIN = 'https://99copias.com.ar';
const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')) || []).slice(1).find(v => v !== undefined);
const tagsDe = (html, nombre) => [...html.matchAll(new RegExp(`<${nombre}\\b[^>]*>`, 'gi'))].map(m => m[0]);
const metaContent = (html, nombre) => attr(tagsDe(html, 'meta').find(t => (attr(t, 'name') || '').toLowerCase() === nombre) || '', 'content');
const esNoindex = html => tagsDe(html, 'meta').some(t => ['robots', 'googlebot'].includes((attr(t, 'name') || '').toLowerCase()) && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(attr(t, 'content') || ''));
const xmlEsc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const vistos = { title: new Map(), description: new Map() };

for (const { r, path, html } of pages) {
  const indexable = !esNoindex(html);
  const visible = html.replace(/<!--.*?-->/gs, '').replace(/<script\b.*?<\/script>/gis, '');
  const h1 = (visible.match(/<h1\b/gi) || []).length;
  if (h1 !== 1) warnings.push(`SEO ${r}: ${h1 === 0 ? 'falta el <h1>' : `hay ${h1} <h1> (debe haber uno)`}`);
  const canon = attr(tagsDe(html, 'link').find(t => (attr(t, 'rel') || '').toLowerCase() === 'canonical') || '', 'href');
  if (!canon) warnings.push(`SEO ${r}: falta <link rel="canonical">`);
  else if (canon !== ORIGIN + path) warnings.push(`SEO ${r}: canonical ${canon} no coincide con la URL de la página (${ORIGIN + path})`);
  const title = (html.match(/<title>(.*?)<\/title>/is) || [])[1]?.trim();
  const desc = metaContent(html, 'description')?.trim();
  if (!title) warnings.push(`SEO ${r}: falta <title>`);
  else if (title.length > 60) warnings.push(`SEO ${r}: title de ${title.length} caracteres (más de ~60 puede cortarse en resultados)`);
  if (!desc) warnings.push(`SEO ${r}: falta meta description`);
  else if (desc.length > 160) warnings.push(`SEO ${r}: meta description de ${desc.length} caracteres (más de ~160 puede cortarse en resultados)`);
  if (indexable) for (const [k, v] of [['title', title], ['description', desc]]) if (v) {
    if (vistos[k].has(v)) warnings.push(`SEO ${r}: ${k} repetido con ${vistos[k].get(v)}`); else vistos[k].set(v, r);
  }
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis)) {
    try {
      const j = JSON.parse(m[1]);
      if (!j || typeof j !== 'object' || !(Array.isArray(j) || j['@type'] || j['@graph'])) warnings.push(`SEO ${r}: JSON-LD sin @type ni @graph`);
    } catch (e) { warnings.push(`SEO ${r}: JSON-LD inválido (${e.message})`); }
  }
}

// fechas desde git: sin historial confiable no se inventa lastmod
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let gitOk = false, shallow = false;
try { gitOk = git('rev-parse', '--is-inside-work-tree') === 'true'; shallow = gitOk && git('rev-parse', '--is-shallow-repository') === 'true'; } catch { /* sin git */ }
if (!gitOk) warnings.push('SEO sitemap: no hay repositorio git → el sitemap sale sin <lastmod>');
else if (shallow) warnings.push('SEO sitemap: el clon de git es superficial (shallow) → el sitemap sale sin <lastmod>. Una opción: correr "git fetch --unshallow || true" antes de "npm run build"');
const fechaGit = f => {
  if (!gitOk || shallow) return null;
  try { const d = git('log', '-1', '--format=%cs', '--', f); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; } catch { return null; }
};
const fechaPrecios = fechaGit('precios.json');
if (gitOk && !shallow && !fechaPrecios) warnings.push('SEO sitemap: precios.json no tiene commits → las páginas con precios usan solo la fecha de su propio archivo');

const excluidas = [];
const entradas = [];
for (const { r, path, html, usaPrecios } of pages) {
  if (esNoindex(html)) { excluidas.push(r); continue; }
  const fechas = [fechaGit(r), usaPrecios ? fechaPrecios : null].filter(Boolean).sort();
  if (gitOk && !shallow && !fechaGit(r)) warnings.push(`SEO sitemap: ${r} no tiene commits en git → sin <lastmod>`);
  entradas.push({ loc: ORIGIN + path, lastmod: fechas.at(-1) || null });
}
entradas.sort((a, b) => (a.loc === ORIGIN + '/' ? -1 : b.loc === ORIGIN + '/' ? 1 : a.loc.localeCompare(b.loc)));
if (!entradas.length) warnings.push('SEO sitemap: no quedó ninguna página indexable');
await writeFile(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entradas.map(e => `  <url>\n    <loc>${xmlEsc(e.loc)}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''}  </url>\n`).join('') + `</urlset>\n`);
if (existsSync(join(ROOT, 'sitemap.xml'))) warnings.push('SEO sitemap: hay un sitemap.xml en el repo; se ignora porque lo genera el build (borralo)');
const robots = existsSync(join(ROOT, 'robots.txt')) ? await readFile(join(ROOT, 'robots.txt'), 'utf8') : '';
if (!new RegExp(`^Sitemap:\\s*${esc(ORIGIN)}/sitemap\\.xml\\s*$`, 'im').test(robots)) warnings.push(`SEO robots.txt: falta la línea "Sitemap: ${ORIGIN}/sitemap.xml"`);

// ---------- resumen
console.log('\nBuild listo → dist/\n');
console.log('Páginas:', pages.map(p => p.r).join(', '));
console.log(`Sitemap: ${entradas.length} URLs` + (excluidas.length ? ` (excluidas por noindex: ${excluidas.join(', ')})` : ''));
console.log('\nArchivos con huella:');
for (const [n, h] of Object.entries(hashed)) console.log(`  ${n.padEnd(16)} → ${h.padEnd(26)} ${kb((await stat(join(OUT, h))).size)}`);
if (warnings.length) { console.log('\nAvisos:'); [...new Set(warnings)].forEach(w => console.log('  ⚠', w)); } else console.log('\nSin avisos.');
