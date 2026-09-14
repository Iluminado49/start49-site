# start49.com

Static site for Start49, compiled from the Claude Design canvas
("Website migration to Claude") and deployed to GitHub Pages.

Replaces the Webflow site.

## Layout

```
src/          the .dc.html artboards exported from Claude Design  (source of truth)
build/        convert.mjs (compiler), pages.json (routing), fetch-assets.sh
static/       site.css, site.js, 404.html, CNAME, assets/ (self-hosted images & fonts)
dist/         build output — generated, not committed
```

## Build

```bash
node build/convert.mjs      # src/*.dc.html + static/ -> dist/
```

The compiler removes the Claude Design runtime (`<x-dc>`, `<helmet>`,
`support.js`, `hint-size`), turns `style-hover="…"` attributes into real CSS
hover rules, strips the prototype form bindings, rewrites `*.dc.html` links to
clean URLs, and rewrites Webflow CDN URLs to `/assets/…`. It also emits
`sitemap.xml`, `robots.txt` and the redirect stubs.

Deployment is automatic: pushing to `main` runs `.github/workflows/pages.yml`,
which builds, runs the guard checks, and publishes `dist/` to GitHub Pages.

## Assets

The design hotlinks ~51 images and one font from Webflow's CDN
(`cdn.prod.website-files.com`). **These must be self-hosted before the Webflow
subscription is cancelled**, or the site loses its logo, illustrations and
headline font.

```bash
node build/convert.mjs      # writes build/assets.tsv
bash build/fetch-assets.sh  # downloads them into static/assets/
```

Commit `static/assets/`. The CI guard fails the build if any
`cdn.prod.website-files.com` URL survives into `dist/`.

Still to add by hand: `static/assets/favicon.svg` and
`static/assets/og-default.png` (referenced by every page's `<head>`).

## Routing

Existing URLs are preserved where the design allowed it, so rankings carry over:

| Live URL (Webflow) | New URL | |
|---|---|---|
| `/` | `/` | kept |
| `/services` | `/services/` | kept |
| `/careers` | `/careers/` | kept (design file `WhoWeAre.dc.html`) |
| `/blog/navigating-the-hiring-landscape-…-2023` | same | kept |
| `/blog/unlocking-the-power-of-operational-analytics-…` | same | kept |
| `/blog/recap-of-2022-of-high-tech-industry-…` | same | kept |
| `/workflow` | `/how-we-do/` | 301 stub |
| `/why-trust-universe49-with-your-project` | `/why-start49/` | 301 stub |
| `/the-universe49-blog-…-insights` | `/blog/` | 301 stub |
| `/contact-us-starting-a-project-with-universe49` | — | gone (404) |
| `/careers/{ios,backend-javascript,python,frontend-javascript,project-manager}-developer` | — | gone (404) |

GitHub Pages cannot issue real 301s, so the redirects are meta-refresh +
canonical stubs. Search engines honour them; they are marked `noindex`.

## Contact form

The design's form had no backend. `build/pages.json` → `site.formEndpoint`
decides what happens:

- **empty** (current): falls back to composing a `mailto:` to hey@start49.com.
  Shippable, but loses anyone without a mail client configured.
- **set** to a Formspree/Basin/function URL: the form POSTs there and reports
  success inline.

Set it before launch.

## Cutover checklist

1. `bash build/fetch-assets.sh`, commit `static/assets/`.
2. Set `site.formEndpoint`; test a submission.
3. Push to `main`; check the Pages preview URL end to end, desktop and phone.
4. Compare against the Webflow site page by page.
5. Add `www.start49.com` as the custom domain in the repo's Pages settings
   (the `CNAME` file is already in `static/`).
6. DNS: point `www` at the GitHub Pages target. **Also add the apex** —
   `start49.com` currently has no A record at all, so the bare domain does not
   resolve today. GitHub Pages apex A records:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
7. Wait for the certificate, enable *Enforce HTTPS*.
8. Leave Webflow running for a couple of weeks, then cancel.
9. Resubmit `sitemap.xml` in Search Console and watch for 404s.

## Analytics

GA4 `G-TEWTMG75BJ` — the same property the Webflow site used, so history is
continuous.
