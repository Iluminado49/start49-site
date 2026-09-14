#!/usr/bin/env node
// Compiles Claude Design .dc.html artboards into a static site.
//
//   node build/convert.mjs
//
// Reads  src/*.dc.html  + build/pages.json
// Writes dist/  (clean-URL directories, one index.html each)
//
// What it strips / rewrites:
//   <x-dc>, <helmet>, support.js, hint-size   -> removed (Claude Design runtime)
//   style-hover="css"                         -> generated .hv-N:hover rule
//   ref="{{ x }}", onSubmit="{{ submit }}"    -> removed (prototype bindings)
//   *.dc.html links                           -> clean URLs from pages.json
//   cdn.prod.website-files.com/<id>/<file>    -> /assets/<file>  (self-hosted)

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');
const cfg = JSON.parse(readFileSync(join(ROOT, 'build/pages.json'), 'utf8'));

const outFor = new Map(cfg.pages.map(p => [p.src, p.out]));
const url = out => (out === '' ? '/' : `/${out}/`);

/* ---------- asset registry -------------------------------------------- */

// Stops at the ')' that closes an unquoted CSS url(...), while still
// allowing balanced parens inside a filename (e.g. "logo%20(1).svg").
const ASSET_RE = /https:\/\/cdn\.prod\.website-files\.com\/[0-9a-f]+\/((?:[^"'\s()]|\([^)]*\))+)/g;
const assets = new Map(); // remote URL -> /assets/<local name>

function localName(remoteFile) {
  // 66d6b5fafa9b2bbcf85c0a63_logo%20(1).svg -> logo-1.svg
  let n = remoteFile;
  try { n = decodeURIComponent(n); } catch { /* leave percent-escapes as-is */ }
  n = n.replace(/^[0-9a-f]{20,}_/, '');
  n = n.replace(/%2520|%20/g, ' ');
  const dot = n.lastIndexOf('.');
  const ext = dot > -1 ? n.slice(dot).toLowerCase() : '';
  let base = (dot > -1 ? n.slice(0, dot) : n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}${ext}`;
}

function registerAssets(html) {
  return html.replace(ASSET_RE, (full, file) => {
    if (!assets.has(full)) {
      let name = localName(file);
      // de-duplicate distinct remote files that normalise to the same name
      const taken = new Set(assets.values());
      if (taken.has(`/assets/${name}`)) {
        const dot = name.lastIndexOf('.');
        let i = 2;
        let candidate;
        do {
          candidate = dot > -1 ? `${name.slice(0, dot)}-${i}${name.slice(dot)}` : `${name}-${i}`;
          i++;
        } while (taken.has(`/assets/${candidate}`));
        name = candidate;
      }
      assets.set(full, `/assets/${name}`);
    }
    return assets.get(full);
  });
}

/* ---------- .dc.html -> fragment -------------------------------------- */

let hoverRules = [];
let hoverSeen = new Map();

function hoverClass(css) {
  if (!hoverSeen.has(css)) {
    const cls = `hv-${hoverSeen.size + 1}`;
    hoverSeen.set(css, cls);
    hoverRules.push(`.${cls}:hover{${css.replace(/;?$/, '')}}`);
  }
  return hoverSeen.get(css);
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parse(file) {
  const raw = readFileSync(join(SRC, file), 'utf8');
  const helmet = (raw.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  let body = (raw.match(/<x-dc[^>]*>([\s\S]*?)<\/x-dc>/) || [, ''])[1];
  body = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '');

  const title = (helmet.match(/<title>([\s\S]*?)<\/title>/) || raw.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1].trim();
  const desc = (raw.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ''])[1];

  // helmet minus the bits we hoist ourselves
  const styles = [...helmet.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');

  return { body, styles, title, desc };
}

function clean(html) {
  return registerAssets(
    html
      // Claude Design runtime leftovers
      .replace(/<script\s+type="text\/x-dc"[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/\s+hint-size="[^"]*"/g, '')
      .replace(/\s+ref="\{\{[^"]*\}\}"/g, '')
      .replace(/\s+onSubmit="\{\{[^"]*\}\}"/g, '')
      .replace(/<script\s+src="\.\/support\.js"><\/script>/g, '')
      // hover states -> real CSS
      .replace(/\s+style-hover="([^"]*)"/g, (_, css) => ` class="${hoverClass(decodeEntities(css))}"`)
  );
}

function relink(html) {
  return html.replace(/href="([A-Za-z0-9-]+\.dc\.html)"/g, (m, f) =>
    outFor.has(f) ? `href="${url(outFor.get(f))}"` : m
  );
}

/* ---------- root-absolute -> page-relative ----------------------------
   The site must work both at a domain root (www.start49.com) and inside a
   subfolder (iluminado49.github.io/start49-site/). Absolute "/x" paths only
   work in the first case, so every internal URL is rewritten relative to the
   page's own depth. */

function depthOf(out) {
  return out === '' ? 0 : out.split('/').length;
}

function relativise(html, depth) {
  const prefix = depth === 0 ? '' : '../'.repeat(depth);
  return html
    // href="/..." and src="/..."  (but not "//host" protocol-relative)
    .replace(/(href|src)="\/(?!\/)([^"]*)"/g, (_, a, path) => `${a}="${prefix}${path || './'}"`)
    // url(/...), url('/...'), url("/...") inside style attributes and <style>
    .replace(/url\((['"]?)\/(?!\/)([^'")]*)\1\)/g, (_, q, path) => `url(${q}${prefix}${path}${q})`);
}

/* ---------- page shell ------------------------------------------------ */

const { origin, ga4, email, formEndpoint } = cfg.site;

function document_({ title, desc, canonical, head, header, body, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${desc ? `<meta name="description" content="${desc}">\n` : ''}<link rel="canonical" href="${origin}${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
${desc ? `<meta property="og:description" content="${desc}">\n` : ''}<meta property="og:url" content="${origin}${canonical}">
<meta property="og:image" content="${origin}/assets/og-default.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600;700&family=Playfair+Display&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css?v=__ASSETV__">
${head}
<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga4}');</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${header}
<main id="main">
${body}
</main>
${footer}
<script src="/site.js?v=__ASSETV__" defer></script>
</body>
</html>
`;
}

/* ---------- build ----------------------------------------------------- */

// Start from an empty dist, so a file that is no longer generated (a removed
// page, a CNAME) can't survive from an earlier local build.
rmSync(OUT, { recursive: true, force: true });

function write(rel, content) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const shellHeader = parse(cfg.shell.header);
const shellFooter = parse(cfg.shell.footer);

const built = [];
const pending = [];   // pages held back until the asset hash is known

for (const page of cfg.pages) {
  if (!existsSync(join(SRC, page.src))) {
    console.warn(`skip (missing): ${page.src}`);
    continue;
  }
  const p = parse(page.src);
  const canonical = url(page.out);

  // Pages place the shared chrome themselves via <dc-import name="SiteHeader">
  // / "SiteFooter". Split the artboard on those markers so the header lands
  // outside <main> and the footer after it.
  const HEADER = /<dc-import\s+name="SiteHeader"[^>]*>\s*<\/dc-import>/;
  const FOOTER = /<dc-import\s+name="SiteFooter"[^>]*>\s*<\/dc-import>/;
  let inner = p.body;
  if (!HEADER.test(inner)) console.warn(`no SiteHeader import in ${page.src}`);
  if (!FOOTER.test(inner)) console.warn(`no SiteFooter import in ${page.src}`);
  inner = inner.split(HEADER).pop();
  inner = inner.split(FOOTER)[0];

  let body = relink(clean(inner));
  if (formEndpoint) {
    body = body.replace(/<form([^>]*)>/, `<form$1 action="${formEndpoint}" method="POST">`);
  } else {
    body = body.replace(/<form([^>]*)>/, `<form$1 data-mailto="${email}">`);
  }

  const html = document_({
    title: page.title || p.title || 'Start49',
    desc: page.description || p.desc || '',
    canonical,
    head: [shellHeader.styles, shellFooter.styles, p.styles]
      .filter(Boolean)
      .map(s => `<style>${registerAssets(s)}</style>`)
      .join('\n'),
    header: relink(clean(shellHeader.body)),
    body,
    footer: relink(clean(shellFooter.body)),
  });
  pending.push({ rel: join(page.out, 'index.html'), html: relativise(html, depthOf(page.out)) });

  built.push({ loc: `${origin}${canonical}`, out: page.out });
}

/* redirect stubs (GitHub Pages has no server-side redirects) */
for (const r of cfg.redirects) {
  write(join(r.from, 'index.html'), relativise(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved</title>
<link rel="canonical" href="${origin}${r.to}">
<meta http-equiv="refresh" content="0; url=${r.to}">
<meta name="robots" content="noindex">
</head>
<body><p>This page moved to <a href="${r.to}">${origin}${r.to}</a>.</p>
<script>location.replace(new URL('${r.to}'.replace(/^\//, '../'), location.href).pathname);</script>
</body>
</html>
`, depthOf(r.from)));
}

/* sitemap + robots */
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${built.map(b => `  <url><loc>${b.loc}</loc></url>`).join('\n')}
</urlset>
`);

write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`);

/* static passthrough */
for (const f of readdirSync(join(ROOT, 'static'))) {
  if (f === 'assets') continue;
  copyFileSync(join(ROOT, 'static', f), join(OUT, f));
}
mkdirSync(join(OUT, 'assets'), { recursive: true });
for (const f of readdirSync(join(ROOT, 'static/assets'))) {
  copyFileSync(join(ROOT, 'static/assets', f), join(OUT, 'assets', f));
}

/* hover rules collected during the run, appended to the shipped stylesheet */
writeFileSync(
  join(OUT, 'site.css'),
  readFileSync(join(ROOT, 'static/site.css'), 'utf8') +
    `\n/* ---- hover states lifted from style-hover attributes ---- */\n` +
    hoverRules.join('\n') + '\n'
);

/* Fingerprint the shared assets and flush the buffered pages.

   GitHub Pages serves site.css and site.js with a ten-minute cache, so
   without this a deploy leaves returning visitors on the old stylesheet
   with no way to tell. The query string changes whenever the bytes do. */
const assetHash = createHash('sha256')
  .update(readFileSync(join(OUT, 'site.css')))
  .update(readFileSync(join(OUT, 'site.js')))
  .digest('hex')
  .slice(0, 8);

for (const { rel, html } of pending) {
  write(rel, html.split('__ASSETV__').join(assetHash));
}
console.log(`assetv:    ${assetHash}`);

/* asset manifest for the downloader */
writeFileSync(
  join(ROOT, 'build/assets.tsv'),
  [...assets].map(([remote, local]) => `${remote}\t${local.replace('/assets/', '')}`).join('\n') + '\n'
);

console.log(`pages:     ${built.length}`);
console.log(`redirects: ${cfg.redirects.length}`);
console.log(`hover:     ${hoverRules.length} rules -> appended to site.css`);
console.log(`assets:    ${assets.size} -> build/assets.tsv`);
