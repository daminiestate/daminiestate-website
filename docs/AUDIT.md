# Damini Estate — Full Quality Audit & Improvement Plan

Status: `[ ]` todo · `[~]` in progress · `[x]` done & verified · `[-]` n/a (reason)

Evidence-based, worked in verified batches. Note: WebP/AVIF encoders are not
available on the build machine, so image perf is done via JPEG re-compress +
resize (real savings, no format change). Revisit WebP if an encoder is added.

---

## A. PERFORMANCE
- [ ] A1. Re-compress hero + oversized JPEGs (quality tune) — hero 320KB target <160KB.
- [ ] A2. Resize listing images to display size (≤800w) — many are 1066–1200w shown ~400–520.
- [ ] A3. Resize insight images (goldenvisa 284KB → recompress/resize).
- [ ] A4. Minify styles.css in build.
- [ ] A5. Minify main.js + loader-gate.js in build.
- [ ] A6. Add width/height to 16 developer logos (CLS).
- [ ] A7. Preload hero (LCP) image; keep fetchpriority high, no lazy.
- [ ] A8. Verify lazy-load on all below-fold imgs; eager only hero.

## B. ACCESSIBILITY (WCAG 2.2 AA)
- [ ] B1. Raise sub-readable fonts (0.42/0.45/0.48rem ≈ 5.5–6px) to a floor.
- [ ] B2. Fix low-contrast text (rgba …0.30 / 0.50 on dark fail AA).
- [ ] B3. Nav `aria-current="page"` + visible active styling.
- [ ] B4. Contact form: `aria-describedby` + `aria-invalid` wired in JS; inline field errors.
- [ ] B5. Buttons get explicit `type` (8 missing → accidental submit risk).
- [ ] B6. `prefers-reduced-motion` disables ALL motion incl. loader bg zoom.
- [ ] B7. `<html lang>` flips to ru on toggle (verify) + lang on RU content.
- [ ] B8. Calculator tabs roles + results aria-live (verify/repair).
- [ ] B9. Tap targets ≥44px (nav toggle, lang btn, socials).
- [ ] B10. Focus-visible on every interactive element (verify).
- [ ] B11. Marquee + dev-strip duplicates aria-hidden (verify).

## C. SEO
- [ ] C1. `og:image:alt`.
- [ ] C2. Explicit `<meta name="robots" content="index,follow,max-image-preview:large">` on indexable pages.
- [ ] C3. Per-page JSON-LD: ContactPage+ContactPoint, AboutPage, CollectionPage (properties), Service list (services).
- [ ] C4. Trim meta descriptions >160 chars.
- [ ] C5. Sitemap real lastmod (already date-based — verify) + image sitemap optional.
- [ ] C6. Verify breadcrumb JSON-LD on all subpages.
- [ ] C7. Verify Article schema (author/publisher/dateModified) on blog.

## D. SECURITY
- [ ] D1. Re-verify all headers live (CSP, HSTS, COOP, CORP, Permissions-Policy, nosniff, frame-ancestors).
- [ ] D2. Re-verify zero secrets in repo + history.
- [ ] D3. Re-verify form hardening (origin, honeypot, rate-limit, validation).
- [ ] D4. Keep `rel="noopener"` enforced (0 missing now).
- [ ] D5. security.txt valid + reachable.

## E. UI/UX
- [ ] E1. Newsletter inline success/error (match contact pattern).
- [ ] E2. Print stylesheet (legal/contact readable on paper).
- [ ] E3. 404 has nav/footer + helpful links (verify).
- [ ] E4. Consistent hover/focus on buttons & links.
- [ ] E5. No horizontal scroll mobile (verify).
- [ ] E6. Property cards external affordance consistent (Bayut ↗).

## F. ROBUSTNESS
- [ ] F1. build.py auto width/height where known; auto-noopener (verify).
- [ ] F2. All internal links resolve.
- [ ] F3. All JSON-LD valid.
- [ ] F4. Full rebuild + 200 checks.

## Verification protocol (every batch)
1. `python3 build.py && python3 generate-sitemap.py` → 13/13.
2. JSON-LD parse all valid.
3. Internal links resolve.
4. Local serve + curl 200 on changed routes.
5. Commit + push to main.
