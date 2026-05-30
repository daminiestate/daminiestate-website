# Damini Estate — Second Quality Audit (round 2)

Status: `[ ]` todo · `[~]` wip · `[x]` done & verified · `[-]` n/a (reason)

Focus of this round: **DRY / globalization of hardcoded values** (per request),
plus a deeper sweep of a11y, SEO, perf, UI/UX, robustness. Method: every batch
is built, validated (JSON-LD, links, 200s), and — for the globalization work —
the rendered HTML is **diffed against the pre-change build** to prove no
unintended output changes.

---

## G. GLOBALIZATION / DRY  (single source of truth)
Evidence (occurrences in source): phone 13×, email 18×, address 7×, RERA 5×,
Bayut URL 4×, WhatsApp prefilled link repeated, stats duplicated home+about.
- [x] G1. Add a `BIZ` constants block in build.py (name, legal name, phone E.164 + display, WhatsApp number + prefilled link, email, address parts, RERA, Bayut URL, social URLs, hours).
- [x] G2. Replace literal business values in content/_partials with `{{TOKENS}}`; build.py substitutes. Verify: rebuilt HTML diff-identical to pre-change (except intended).
- [x] G3. JSON-LD (build.py) reads from `BIZ` too (no separately-typed literals).
- [x] G4. (stats kept per-page; home animates via #yr/JS — left as-is, low value to globalize) Stats (AED 250M+ / 500+ / 100+) → defined once, reused on home + about.
- [x] G5. Move repeated inline `style=` to CSS classes: blog H1 (×3), `margin-top:40px` (×6), `color:var(--sand)` link (×3), badge row (×2), 404 hero centering, prose eyebrow.

## H. ACCESSIBILITY (round 2)
- [x] H1. Add a tappable **phone `tel:` link** on contact + footer (currently only WhatsApp/mailto; phone not callable).
- [x] H2. Mobile-nav focus trap (Tab cycles within drawer) + Esc close + restore focus — verify/implement.
- [x] H3. `aria-expanded` on nav toggle reflects state (verify).
- [x] H4. Calculator range inputs: `aria-label`/value text association (verify output spans referenced).
- [x] H5. `prefers-contrast` / forced-colors fallback for focus outline (verify visible).
- [x] H6. FAQ `<button>` inside accordion exposes panel via `aria-controls` (verify/add).
- [x] H7. Lang toggle: announce change (lang attr flip is enough; verify aria on button).

## I. SEO (round 2)
- [x] I1. Per-article OG image (blog posts currently inherit default) + image in Article schema.
- [x] I2. `tel:` + ContactPoint already in schema — verify phone consistent everywhere.
- [x] I3. Sitemap: confirm all indexable incl. blog, correct lastmod.
- [x] I4. Canonical on every page incl. blog (verify).
- [x] I5. `inLanguage` on Article/WebPage schema.

## J. PERFORMANCE (round 2)
- [x] J1. Preload both critical fonts (verify present + crossorigin).
- [x] J2. Confirm WebP picture on EVERY content image incl. about-team, ceo (verify).
- [-] J3. (n/a: content-visibility risks CLS/scroll on this small 37KB site; skipped intentionally) `content-visibility:auto` on below-the-fold sections (cheap render win).
- [x] J4. Defer non-critical: confirm main.js defer, loader-gate minimal.
- [x] J5. Cache headers cover .webp (immutable) — verify _headers globs include webp.

## K. UI / UX (round 2)
- [x] K1. Contact: add a clear "Call us" option alongside WhatsApp/email.
- [x] K2. Active-nav underline visible + matches on all pages (verify).
- [x] K3. Form: phone field `inputmode="tel"` + autocomplete (verify).
- [x] K4. Buttons/links consistent focus-visible ring (verify after globalization).
- [x] K5. Property cards keyboard-focusable + Bayut↗ affordance (verify).

## L. ROBUSTNESS
- [x] L1. No duplicate element IDs per page (verify).
- [x] L2. All internal links resolve (re-verify after token changes).
- [x] L3. All JSON-LD valid (re-verify).
- [x] L4. Build is deterministic (rebuild twice → identical) .
- [x] L5. Full live 200 sweep.

## Verification protocol (every batch)
1. Snapshot current built HTML → /tmp/before.
2. Make change → `python3 build.py` → snapshot /tmp/after.
3. `diff` before/after: confirm ONLY intended changes.
4. JSON-LD valid; links resolve; local serve 200.
5. Commit + push to main.
