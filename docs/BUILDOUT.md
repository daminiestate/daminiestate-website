# Damini Estate — Content & Feature Build-out Plan

Goal: turn a solid 13-page site into a deep, authoritative Dubai real-estate
presence. Each batch built from _partials + content via build.py, verified
(13→N pages build, JSON-LD valid, links resolve, 200s), committed to main.

Status: `[ ]` todo · `[~]` wip · `[x]` done & verified

---

## BATCH A — Service detail pages (6)  [highest SEO + UX value]
Each service card on /services links to its own page with depth, process, FAQ,
Service JSON-LD, CTA. New section nav.
- [ ] A1. /services/residential-sales/
- [ ] A2. /services/off-plan-investments/
- [ ] A3. /services/commercial-real-estate/
- [ ] A4. /services/property-management/
- [ ] A5. /services/investment-advisory/
- [ ] A6. /services/golden-visa-relocation/
- [ ] A7. Link cards on /services → detail pages; breadcrumb; Service schema; sub-nav.

## BATCH B — Community / area guides  [local SEO]
- [ ] B1. /areas/ index (grid of communities).
- [ ] B2. /areas/business-bay/
- [ ] B3. /areas/downtown-dubai/
- [ ] B4. /areas/dubai-hills-estate/
- [ ] B5. /areas/palm-jumeirah/
- [ ] B6. /areas/mbr-city/
- [ ] B7. /areas/jvc/
- [ ] B8. Place schema + breadcrumb + cross-links to properties/contact.

## BATCH C — More insight articles (depth + freshness)
- [ ] C1. Dubai property buying process for foreigners (step by step).
- [ ] C2. Costs of buying property in Dubai (DLD, fees, full breakdown).
- [ ] C3. Best areas for rental yield in Dubai 2026.
- [ ] C4. Off-plan payment plans explained.
- [ ] C5. Selling your Dubai property: a seller's guide.

## BATCH D — Homepage / trust enhancements
- [ ] D1. "How we work" process section (4 steps) — reusable component.
- [ ] D2. "Why Dubai" value section (tax-free, yields, Golden Visa, safety).
- [ ] D3. Testimonials component (placeholder, ready for real quotes).
- [ ] D4. About: add credentials/process; team-ready section.

## BATCH E — Components / UI-UX / styles polish
- [ ] E1. New reusable components: .process-steps, .quote/.testimonial, .area-card, .feature-grid, .breadcrumb.
- [ ] E2. Service/area sub-hero variants; consistent CTA blocks.
- [ ] E3. Typographic scale review; spacing tokens; button sizes.
- [ ] E4. Breadcrumb UI (visible) + matching BreadcrumbList JSON-LD already auto.

## BATCH F — Final verification
- [ ] F1. Sitemap includes all new pages; robots ok.
- [ ] F2. All internal links resolve; nav/footer updated.
- [ ] F3. JSON-LD valid across all pages; per-page schema types.
- [ ] F4. Build deterministic; local 200 sweep; live check.
