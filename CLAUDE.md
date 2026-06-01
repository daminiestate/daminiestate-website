# Damini Estate — Project Guide (for humans and AI agents)

Live site: **https://daminiestate.ae** (and `www.` → redirects to apex)
Repo: `daminiestate/daminiestate-website` · Single branch: **`main`**
Owner: Damini Real Estate L.L.C (Dubai). Built/maintained by Orevida Media.

This file is the source of truth for how this site works. Read it fully before
changing anything. It is written so a fresh AI agent (or developer) can be
productive immediately and not break the live site.

---

## 1. What this is

A fast, secure, accessible, bilingual (EN/RU) **static multi-page marketing
site** for a Dubai real estate brokerage. It is **not** a SPA/React app — it is
hand-written HTML assembled by a small Python build script and served as static
files on **Cloudflare Pages**, with a few **Pages Functions** for form handling.

This mirrors the exact stack of our sibling brand sites (baustoffe-steinbach,
philmeyfarth, hatcher) so anyone who knows one knows them all.

Pages: Home `/`, About `/about/`, Services + investor calculators `/services/`,
Properties `/properties/` (cards link out to the firm's verified Bayut
listings), Contact `/contact/`, Insights `/insights/` + 3 articles under
`/blog/`, and legal pages (`/privacy/`, `/terms/`, `/disclaimer/`, all noindex)
plus a styled `/404.html`.

---

## 2. Architecture & build

```
_partials/        reusable HTML fragments (head, header, footer, chat-widget)
content/          per-page unique body HTML (home.html, about.html, …)
content/blog/     article bodies
build.py          assembles _partials + content → final HTML at the repo root
generate-sitemap.py   writes sitemap.xml from build.py's PAGES + ARTICLES
styles.css        the entire design system (one file)
main.js           all site JS (nav, calculators, i18n, forms, FAQ, reveal)
loader-gate.js    the intro-loader controller (see §6)
functions/        Cloudflare Pages Functions (form backends, see §5)
assets/fonts/     self-hosted woff2 (Cormorant Garamond + Tenor Sans, latin+cyrillic)
assets/img/       site images, OG images, developer logos (assets/img/developers/)
images/           property listing thumbnails (self-hosted from Bayut)
_headers          Cloudflare headers: strict CSP, HSTS, caching
_redirects        Cloudflare redirects (www→apex is done in the CF dashboard)
```

**The build model:** the *output* HTML (`index.html`, `about/index.html`, …) is
committed to the repo. Cloudflare does **no build** — it just serves the files.
So after editing any `_partials/*` or `content/*`, you MUST run the build and
commit the regenerated HTML:

```bash
python3 build.py            # regenerate all pages
python3 generate-sitemap.py # regenerate sitemap.xml
```

Clean URLs: `about.html` is emitted as `about/index.html`. `index.html` and
`404.html` stay at the root. To add a page: add an entry to `PAGES` in
`build.py`, create `content/<name>.html`, run the build.

**Images / WebP:** photos are served as WebP via `<picture>` with a JPEG
fallback. `build.py` only adds the WebP `<source>` when a sibling `.webp` exists
on disk. So when you **add or replace a photo** (a `.jpg`/`.png` in `assets/img/`
or `images/`), regenerate the WebP first, then build:

```bash
./build-images.sh           # (re)create .webp siblings (needs: brew install webp)
python3 build.py            # wraps <img> in <picture>
```

`build-images.sh` skips `og-*.jpg` (social cards stay JPEG) and the developer
logos. Use `--force` to rebuild all, `--clean` to remove generated WebP. Mark a
hero/LCP image `data-eager fetchpriority="high"` and add its path to a page's
`"preload": [...]` in `build.py`; everything else lazy-loads automatically.

Requirements: Python 3 only. No node_modules, no framework, no bundler.

---

## 3. Deploy

- **Cloudflare Pages project** is connected to this repo, production branch
  `main`. Framework preset: **None**. Build command: **(empty)**. Build output
  directory: **`/`**.
- **Any push to `main` auto-deploys to production within ~1 minute.** There is
  only one branch. Do not create long-lived branches; commit to `main`.
- Preview: pushing a branch/PR gives a `*.pages.dev` preview URL, but the
  standing convention here is to work on `main`.

### After editing, before pushing
1. `python3 build.py && python3 generate-sitemap.py`
2. Sanity-check locally: `python3 -m http.server 8799` then open localhost:8799
3. Commit the source **and** the regenerated HTML together.

---

## 4. Cloudflare secrets (forms need these)

Set in **Cloudflare Pages → Settings → Variables and secrets**, for both
**Production** and **Preview**, marked **Secret/Encrypted**. They are read only
by the Functions at runtime; they are never in the repo or sent to the browser.

| Variable | Required? | Purpose |
|---|---|---|
| `GHL_API_KEY` | **Required** | GoHighLevel private-integration token (`pit-…`) |
| `GHL_LOCATION_ID` | **Required** | GHL sub-account / location ID |
| `GHL_PIPELINE_ID` | Optional | If set (with stage), contact form also creates an Opportunity |
| `GHL_STAGE_ID` | Optional | First pipeline stage ID for the Opportunity |
| `RESEND_API_KEY` | Optional | Resend key, only if sending confirmation emails from the site |
| `RESEND_FROM` | Optional | Verified sender, e.g. `Damini Estate <hello@send.daminiestate.ae>` |
| `NOTIFY_EMAIL` | Optional | Internal inbox for fallback alerts (defaults to info@daminiestate.ae) |

**You only need the two `GHL_*` required vars for full lead capture.** With just
those, the contact and newsletter forms upsert the contact, add tags, and attach
a note in GHL. Confirmation emails can be handled entirely inside GHL via a
workflow triggered on the tags (`website-enquiry`, `newsletter`,
`website-newsletter`) — so Resend is optional. The forms **degrade gracefully**:
if no secrets are set they still validate and return success, they just skip the
CRM sync (logged server-side).

`.env.example` documents these names. Never commit real values.

**Email runbook:** how leads turn into auto-replies/alerts, how to send through
the client's Microsoft 365 (Outlook SMTP) at zero GHL cost, the SMTP-AUTH fix
for the `535 SmtpClientAuthentication disabled` error, and the GHL workflow +
ready-to-paste email designs — see **`docs/EMAIL-GHL-SETUP.md`** and
**`docs/email-templates/`**.

**Lead durability (OPTIONAL upgrade, not yet done):** the forms currently
degrade gracefully (validate, attempt GHL, email the team on failure). To meet
the full Orevida "never lose a lead" standard (persist-first to Cloudflare KV +
retry + durable outbox + replay), the Cloudflare account owner must create a KV
namespace and bind it as `LEADS_KV`. Step-by-step dashboard instructions (written
for a non-developer) + the code contract are in
**`docs/LEAD-DURABILITY-KV-SETUP.md`**. Optional, recommended, purely additive.

---

## 5. Form backends (Cloudflare Pages Functions)

- `functions/contact.js`  → `POST /contact`  (the enquiry form)
- `functions/newsletter.js` → `POST /newsletter` (footer + insights signup)
- `functions/_shared.js`  → shared helpers (GHL client, validation, rate limit)

Security model (identical pattern to the sibling sites):
- **Origin/Referer allowlist** (`daminiestate.ae`, `www.daminiestate.ae`) — by
  parsed hostname, no substring bypass.
- **Honeypot** field (`website`) silently accepts+drops bots.
- **In-isolate rate limiting** (5/min contact, 3/min newsletter per IP).
- **Strict input validation**, length caps, CR/LF stripping (no header/note
  injection), HTML-escaping in emails.
- **GHL** via `https://services.leadconnectorhq.com`, API version `2021-07-28`:
  `/contacts/upsert` (dedupe by email) → additive `/tags` → `/notes` → optional
  `/opportunities`.
- Timeouts on every upstream call so a slow API can't hang the Worker.

The front-end posts via `fetch` (see the `form[data-ajax]` handler in
`main.js`): client-side email validation, honeypot, UTM/click-id capture into
hidden fields, friendly success/error messaging.

---

## 6. The intro loader (read before touching it)

On first arrival in a visit the site shows a brand intro ("Damini / Dubai ·
Luxury Real Estate"). It is engineered to be **impossible to get stuck on**:

- All loader **CSS is inlined in `_partials/head.html`** (not in styles.css).
- A **pure-CSS `@keyframes dmnLoaderSafety` auto-hides it at 4s even with zero
  JavaScript**. This is the critical fail-safe — do not remove it.
- `loader-gate.js` (loaded synchronously in `<head>`) owns the rest: it adds
  `html.loaded` to **skip** the loader on repeat pages (sessionStorage
  `dmn_loaded`) and under `prefers-reduced-motion`, and on first load it removes
  the loader on `window.load` (500ms min, 3.5s JS cap).
- `<noscript>` hides it immediately when JS is off.

Lesson baked in: the loader must never depend on `styles.css` or `main.js`
loading correctly. Keep it self-contained.

---

## 7. Conventions

- **Bilingual EN/RU**: elements carry `data-en` / `data-ru` (and `data-en-ph` /
  `data-ru-ph` for placeholders). The toggle in `main.js` swaps them and
  persists choice in localStorage. When adding copy, provide both languages.
- **Developer logos**: real official SVG/PNG in `assets/img/developers/`, kept
  as original files; they're recolored to the cream tone purely via a CSS
  `filter` on `.dev-logo img`. Each links to the developer's official site.
- **Property listings**: cards link to the firm's Bayut listings
  (`bayut.com/property/…`). When the firm gets its own listing license, these
  can become internal `/properties/<slug>` pages.
- **Images**: everything is self-hosted (no hotlinking). `build.py` auto-adds
  `loading="lazy"` + `decoding="async"` to imgs except those marked
  `data-eager` (the hero uses `fetchpriority="high"`).
- **No inline event handlers / inline scripts** anywhere — the CSP forbids them
  (`script-src 'self'` + the GHL widget origin). All JS lives in `.js` files.
- **CSP**: defined in `_headers`. If you add a third-party script/style/iframe
  (e.g. analytics, the GHL chat widget), you must add its origin to the CSP or
  it will be blocked.

---

## 8. Do NOT

- **Do not touch the domain's email DNS.** Email runs on Microsoft 365 (MX →
  `*.mail.protection.outlook.com`, plus SPF/autodiscover). It is independent of
  the website. Changing site A/CNAME records does not affect email; do not
  remove the MX/TXT/autodiscover records. ONE known exception/fix: the
  `autodiscover` record is currently mis-pointed at Cloudflare's proxy (breaks
  Outlook auto-setup); the correct fix (CNAME → `autodiscover.outlook.com`, DNS
  only) is documented in **`docs/FIX-OUTLOOK-AUTODISCOVER-DNS.md`**. Dashboard-only.
- **Do not add a `wrangler.jsonc` / Workers config.** This is a Cloudflare
  **Pages** project. The old auto-generated Workers config + its PR were removed
  intentionally.
- **Do not commit secrets.** All keys live in Cloudflare env vars.
- **Do not hotlink images or add render-blocking third-party CSS/JS.**
- **Do not reintroduce a fixed-time loading gate** that blocks content; the
  loader must reveal on readiness with a CSS fail-safe (see §6).

---

## 9. Quick reference

```bash
# Build + sitemap, then preview locally
python3 build.py && python3 generate-sitemap.py
python3 -m http.server 8799   # → http://localhost:8799

# Ship a change (auto-deploys on push to main)
git add -A && git commit -m "…" && git push origin main
```

Contact / brand facts used across the site: Damini Real Estate L.L.C ·
RERA 57358 · Crystal Tower, Office 1102, Business Bay, Dubai, UAE ·
info@daminiestate.ae · WhatsApp +971 58 572 0882 · Founder/CEO Lola Damini ·
Bayut: https://www.bayut.com/companies/damini-real-estate-108837/
