# Damini Estate — Full Quality Audit & Improvement Plan

Status: `[ ]` todo · `[~]` in progress · `[x]` done & verified · `[-]` n/a (reason)

Evidence-based, worked in verified batches. Note: WebP/AVIF encoders are not
available on the build machine, so image perf is done via JPEG re-compress +
resize (real savings, no format change). Revisit WebP if an encoder is added.

---

## A. PERFORMANCE
- [x] A1. Re-compress hero + oversized JPEGs (quality tune) — hero 320KB target <160KB.
- [x] A2. Resize listing images to display size (≤800w) — many are 1066–1200w shown ~400–520.
- [x] A3. Resize insight images (goldenvisa 284KB → recompress/resize).
- [-] A4. (n/a: Cloudflare brotli/gzip handles text minification) — Minify styles.css in build.
- [-] A5. (n/a: same — gzip on JS) — Minify main.js + loader-gate.js in build.
- [x] A6. Add width/height to 16 developer logos (CLS).
- [x] A7. Preload hero (LCP) image; keep fetchpriority high, no lazy.
- [x] A8. Verify lazy-load on all below-fold imgs; eager only hero.

## B. ACCESSIBILITY (WCAG 2.2 AA)
- [x] B1. Raise sub-readable fonts (0.42/0.45/0.48rem ≈ 5.5–6px) to a floor.
- [x] B2. Fix low-contrast text (rgba …0.30 / 0.50 on dark fail AA).
- [x] B3. Nav `aria-current="page"` + visible active styling.
- [-] B4. (n/a: covered by aria-invalid + aria-live (single status, no per-field spans needed)) — Contact form: `aria-describedby` + `aria-invalid` wired in JS; inline field errors.
- [x] B5. Buttons get explicit `type` (8 missing → accidental submit risk).
- [x] B6. `prefers-reduced-motion` disables ALL motion incl. loader bg zoom.
- [x] B7. `<html lang>` flips to ru on toggle (verify) + lang on RU content.
- [x] B8. Calculator tabs roles + results aria-live (verify/repair).
- [x] B9. Tap targets ≥44px (nav toggle, lang btn, socials).
- [x] B10. Focus-visible on every interactive element (verify).
- [x] B11. Marquee + dev-strip duplicates aria-hidden (verify).

## C. SEO
- [x] C1. `og:image:alt`.
- [x] C2. Explicit `<meta name="robots" content="index,follow,max-image-preview:large">` on indexable pages.
- [x] C3. Per-page JSON-LD: ContactPage+ContactPoint, AboutPage, CollectionPage (properties), Service list (services).
- [x] C4. Trim meta descriptions >160 chars.
- [x] C5. Sitemap real lastmod (already date-based — verify) + image sitemap optional.
- [x] C6. Verify breadcrumb JSON-LD on all subpages.
- [x] C7. Verify Article schema (author/publisher/dateModified) on blog.

## D. SECURITY
- [x] D1. Re-verify all headers live (CSP, HSTS, COOP, CORP, Permissions-Policy, nosniff, frame-ancestors).
- [x] D2. Re-verify zero secrets in repo + history.
- [x] D3. Re-verify form hardening (origin, honeypot, rate-limit, validation).
- [x] D4. Keep `rel="noopener"` enforced (0 missing now).
- [x] D5. security.txt valid + reachable.

## E. UI/UX
- [x] E1. Newsletter inline success/error (match contact pattern).
- [x] E2. Print stylesheet (legal/contact readable on paper).
- [x] E3. 404 has nav/footer + helpful links (verify).
- [x] E4. Consistent hover/focus on buttons & links.
- [x] E5. No horizontal scroll mobile (verify).
- [x] E6. Property cards external affordance consistent (Bayut ↗).

## F. ROBUSTNESS
- [x] F1. build.py auto width/height where known; auto-noopener (verify).
- [x] F2. All internal links resolve.
- [x] F3. All JSON-LD valid.
- [x] F4. Full rebuild + 200 checks.

## Verification protocol (every batch)
1. `python3 build.py && python3 generate-sitemap.py` → 13/13.
2. JSON-LD parse all valid.
3. Internal links resolve.
4. Local serve + curl 200 on changed routes.
5. Commit + push to main.
