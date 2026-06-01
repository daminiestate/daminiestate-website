#!/usr/bin/env python3
"""
Build all Damini Estate pages from _partials/ + content/.

Each page is one entry in PAGES:
  - slug:        output path (e.g. "index.html", "about.html")
  - content:     filename in content/ (without .html): the unique body markup
  - canonical:   path appended to https://daminiestate.ae (e.g. "/", "/about")
  - title:       <title> + og:title
  - description: meta + og + twitter description
  - og_image:    optional OG image path (defaults to /assets/img/og-default.jpg)
  - head_extra:  optional extra <head> markup (overrides default Org JSON-LD)
  - noindex:     optional bool → adds robots noindex (legal pages)

Run: python3 build.py
"""
import re, sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PARTIALS = ROOT / "_partials"
CONTENT = ROOT / "content"
SITE = "https://daminiestate.ae"
DEFAULT_OG = "/assets/img/og-default.jpg"

# ── Single source of truth for business / contact details ────────────────────
# Changed in one place here, substituted into every page via {{TOKENS}} at build
# time (see apply_tokens, called in build_page).
BIZ = {
    "name": "Damini Estate",
    "legal": "Damini Real Estate L.L.C",
    "phone_e164": "+971585720882",
    "phone_display": "+971 58 572 0882",
    "wa_number": "971585720882",
    "wa_text": "Hello%2C%20I%20am%20interested%20in%20a%20property%20at%20Damini%20Estate.",
    "email": "info@daminiestate.ae",
    "rera": "57358",
    "bayut": "https://www.bayut.com/companies/damini-real-estate-108837/",
    "instagram": "https://www.instagram.com/daminiestate",
    "address": "Crystal Tower, Office 1102, Business Bay, Dubai, UAE",
}
BIZ["wa_link"] = f"https://wa.me/{BIZ['wa_number']}?text={BIZ['wa_text']}"
BIZ["wa_bare"] = f"https://wa.me/{BIZ['wa_number']}"
BIZ["tel_link"] = f"tel:{BIZ['phone_e164']}"

TOKENS = {
    "{{BIZ_NAME}}": BIZ["name"],
    "{{BIZ_LEGAL}}": BIZ["legal"],
    "{{PHONE}}": BIZ["phone_e164"],
    "{{PHONE_DISPLAY}}": BIZ["phone_display"],
    "{{TEL_LINK}}": BIZ["tel_link"],
    "{{WA_NUMBER}}": BIZ["wa_number"],
    "{{WA_LINK}}": BIZ["wa_link"],
    "{{WA_BARE}}": BIZ["wa_bare"],
    "{{EMAIL}}": BIZ["email"],
    "{{RERA}}": BIZ["rera"],
    "{{BAYUT_URL}}": BIZ["bayut"],
    "{{INSTAGRAM_URL}}": BIZ["instagram"],
    "{{ADDRESS_FULL}}": BIZ["address"],
}

def apply_tokens(html: str) -> str:
    for k, v in TOKENS.items():
        html = html.replace(k, v)
    return html

def read(p): return (PARTIALS / p).read_text(encoding="utf-8")
def read_content(name): return (CONTENT / f"{name}.html").read_text(encoding="utf-8")

HEAD = read("head.html")
HEADER = read("header.html")
FOOTER = read("footer.html")
CHAT = read("chat-widget.html")

# ── Cache-busting for non-hashed static assets ───────────────────────────────
# styles.css / main.js / loader-gate.js / ghl-tracking.js are served with a
# short max-age (see _headers); stamp each <link>/<script> ref with ?v=<mtime>
# so a deploy is never hidden by a stale browser cache. Stamp = file mtime int.
def _vstamp(name):
    try:
        return str(int((ROOT / name).stat().st_mtime))
    except OSError:
        return "0"

def apply_asset_versions(html: str) -> str:
    # Reference form in the partials is always a quoted root path, e.g. "/styles.css".
    for asset in ("styles.css", "main.js", "loader-gate.js", "ghl-tracking.js"):
        v = _vstamp(asset)
        html = html.replace(f'"/{asset}"', f'"/{asset}?v={v}"')
    return html

HEAD = apply_asset_versions(HEAD)

# GoHighLevel external page-view / form tracking. Loaded via a same-origin
# loader (/ghl-tracking.js) that gates on DNT/GPC before injecting the vendor
# script from link.msgsndr.com (allowlisted in _headers script-src); the tracker
# then beacons to backend.leadconnectorhq.com (covered by *.leadconnectorhq.com
# connect-src). Injected once, just before </body>, on every page.
GHL_TRACKING = apply_asset_versions('<script src="/ghl-tracking.js" defer></script>')

# Orevida Network Pixel (brand "Damini Estate", api_key ORE-P4PQEYRF2T9D in the
# ogla brands table). Served same-origin from /pixel.js (functions/pixel.js.js),
# which prepends a shim that rewrites t.orevida.com -> same-origin /t/* (handled
# by functions/t/[[path]].js). The ?b= key is read client-side by the canonical
# pixel. All first-party, so the strict CSP needs no change. Injected once,
# before </body>, on every page.
ORV_PIXEL = '<script src="/pixel.js?b=ORE-P4PQEYRF2T9D" async></script>'

# ── RealEstateAgent + WebSite JSON-LD (default for every page) ───────────────
ORG_JSONLD = json.dumps({
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "RealEstateAgent",
            "@id": f"{SITE}#org",
            "name": "Damini Estate",
            "legalName": "Damini Real Estate L.L.C",
            "url": SITE,
            "image": f"{SITE}{DEFAULT_OG}",
            "logo": f"{SITE}/apple-touch-icon.png",
            "description": "Damini Estate is a full-service real estate firm in Dubai, UAE, helping clients buy, sell, rent, and manage residential, off-plan, and commercial property.",
            "email": "info@daminiestate.ae",
            "telephone": "+971585720882",
            "founder": {"@type": "Person", "name": "Lola Damini"},
            "areaServed": {"@type": "City", "name": "Dubai"},
            "identifier": {"@type": "PropertyValue", "name": "RERA License", "value": "57358"},
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "Crystal Tower, Office 1102, Business Bay",
                "addressLocality": "Dubai",
                "addressCountry": "AE"
            },
            "knowsAbout": [
                "Dubai real estate", "off-plan investment", "residential sales",
                "commercial real estate", "property management", "Golden Visa",
                "rental yield", "real estate investment advisory"
            ],
            "sameAs": [
                "https://www.bayut.com/companies/damini-real-estate-108837/",
                "https://www.instagram.com/daminiestate"
            ]
        },
        {
            "@type": "WebSite",
            "@id": f"{SITE}#website",
            "url": SITE,
            "name": "Damini Estate",
            "inLanguage": ["en", "ru"],
            "publisher": {"@id": f"{SITE}#org"}
        }
    ]
}, indent=2)
JSONLD_ORG = f'<script type="application/ld+json">\n{ORG_JSONLD}\n</script>'

NOINDEX_META = '<meta name="robots" content="noindex, nofollow">'


def slug_to_output_path(slug: str) -> Path:
    """index.html → index.html ; about.html → about/index.html (clean URLs).
    404.html stays at the root so Cloudflare Pages serves it as the error page."""
    if slug in ("index.html", "404.html"):
        return ROOT / slug
    if slug.endswith(".html"):
        return ROOT / slug[:-5] / "index.html"
    return ROOT / slug


def breadcrumb_jsonld(canonical: str, title: str) -> str:
    if canonical in ("/", ""):
        return ""
    parts = [p for p in canonical.strip("/").split("/") if p]
    items = [{"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"}]
    path = ""
    for i, p in enumerate(parts):
        path += "/" + p
        name = title.split(" · ")[0].split(" | ")[0].strip() if i == len(parts) - 1 else p.replace("-", " ").title()
        items.append({"@type": "ListItem", "position": i + 2, "name": name, "item": f"{SITE}{path}/"})
    payload = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}
    return f'<script type="application/ld+json">\n{json.dumps(payload, indent=2)}\n</script>'


FAQ_Q_RE = re.compile(r'<button class="faq-q"[^>]*>(.*?)</button>', re.DOTALL)
FAQ_A_RE = re.compile(r'<div class="faq-a-inner">(.*?)</div>', re.DOTALL)
TAG_RE = re.compile(r'<[^>]+>')

def faqpage_jsonld(body: str) -> str:
    qs = FAQ_Q_RE.findall(body)
    as_ = FAQ_A_RE.findall(body)
    if not qs or len(qs) != len(as_):
        return ""
    clean = lambda t: TAG_RE.sub('', t).replace('&amp;', '&').replace('&nbsp;', ' ').strip()
    items = [{"@type": "Question", "name": clean(q),
              "acceptedAnswer": {"@type": "Answer", "text": clean(a)}} for q, a in zip(qs, as_)]
    payload = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": items}
    return f'<script type="application/ld+json">\n{json.dumps(payload, indent=2)}\n</script>'


_PRESERVE_RE = re.compile(r'(?is)(<(pre|textarea|script|style)\b[^>]*>.*?</\2>)')
_COMMENT_RE = re.compile(r'<!--(?!\[if).*?-->', re.DOTALL)
_WS_RE = re.compile(r'\s{2,}')
_GAP_RE = re.compile(r'>\s+<')

def minify_html(html: str) -> str:
    blocks = []
    def stash(m):
        blocks.append(m.group(1)); return f'\x00P{len(blocks)-1}\x00'
    html = _PRESERVE_RE.sub(stash, html)
    html = _COMMENT_RE.sub('', html)
    html = _WS_RE.sub(' ', html)
    html = _GAP_RE.sub('><', html)
    html = html.strip()
    for i, b in enumerate(blocks):
        html = html.replace(f'\x00P{i}\x00', b, 1)
    return html


def page_type_jsonld(canonical: str, title: str, description: str) -> str:
    """Per-page schema.org type to enrich search results."""
    name = title.split(" | ")[0].split(" · ")[0].strip()
    url = SITE + canonical
    payload = None
    if canonical == "/contact":
        payload = {
            "@context": "https://schema.org", "@type": "ContactPage",
            "name": name, "url": url, "description": description,
            "mainEntity": {
                "@type": "RealEstateAgent", "@id": f"{SITE}#org", "name": "Damini Estate",
                "contactPoint": {
                    "@type": "ContactPoint", "telephone": "+971585720882",
                    "email": "info@daminiestate.ae", "contactType": "sales",
                    "areaServed": "AE", "availableLanguage": ["English", "Russian"],
                },
            },
        }
    elif canonical == "/about":
        payload = {"@context": "https://schema.org", "@type": "AboutPage",
                   "name": name, "url": url, "description": description,
                   "about": {"@id": f"{SITE}#org"}}
    elif canonical == "/properties":
        payload = {"@context": "https://schema.org", "@type": "CollectionPage",
                   "name": name, "url": url, "description": description,
                   "about": {"@id": f"{SITE}#org"},
                   "isPartOf": {"@id": f"{SITE}#website"}}
    elif canonical == "/services":
        payload = {"@context": "https://schema.org", "@type": "WebPage",
                   "name": name, "url": url, "description": description,
                   "about": {"@id": f"{SITE}#org"},
                   "mainEntity": {"@type": "ItemList", "itemListElement": [
                       {"@type": "ListItem", "position": i + 1, "name": s}
                       for i, s in enumerate([
                           "Residential Sales", "Off-Plan Investments", "Commercial Real Estate",
                           "Investment Advisory", "Property Management", "Relocation & Golden Visa"])]}}
    elif canonical == "/insights":
        payload = {"@context": "https://schema.org", "@type": "CollectionPage",
                   "name": name, "url": url, "description": description,
                   "isPartOf": {"@id": f"{SITE}#website"}}
    if not payload:
        return ""
    return f'<script type="application/ld+json">\n{json.dumps(payload, indent=2)}\n</script>'


SECTION_LABELS = {"services": "Services", "areas": "Areas", "blog": "Insights", "insights": "Insights"}
SECTION_HREFS = {"services": "/services/", "areas": "/areas/", "blog": "/insights/", "insights": "/insights/"}

def breadcrumb_ui(canonical: str, title: str) -> str:
    """Visible breadcrumb for nested pages (e.g. /services/<slug>). Returns ''
    for top-level pages. Mirrors the auto BreadcrumbList JSON-LD."""
    parts = [p for p in canonical.strip("/").split("/") if p]
    if len(parts) < 2:
        return ""
    name = title.split(" | ")[0].split(" · ")[0].split(":")[0].strip()
    items = ['<li><a href="/">Home</a></li>']
    sec = parts[0]
    items.append(f'<li><a href="{SECTION_HREFS.get(sec, "/" + sec + "/")}">{SECTION_LABELS.get(sec, sec.title())}</a></li>')
    items.append(f'<li><span aria-current="page">{name}</span></li>')
    return ('<nav class="breadcrumb" aria-label="Breadcrumb"><ol>'
            + "".join(items) + '</ol></nav>')


def mark_active_nav(header_html: str, canonical: str) -> str:
    """Add aria-current="page" to the nav link whose href matches this page.
    Matches the section root so e.g. /blog/... highlights Insights."""
    if canonical in ("/", ""):
        target = "/"
    else:
        seg = canonical.strip("/").split("/")[0]
        target = f"/{seg}/"
    # /blog articles live under the Insights nav item
    if canonical.startswith("/blog"):
        target = "/insights/"
    def repl(m):
        return m.group(0) + ' aria-current="page"'
    # add the attribute right after href="<target>"
    return re.sub(r'href="' + re.escape(target) + r'"(?![^>]*aria-current)',
                  lambda m: m.group(0) + ' aria-current="page"', header_html)


_IMG_TAG_RE = re.compile(r'<img\b[^>]*\bsrc="(/[^"]+\.(?:jpg|jpeg|png))"[^>]*>', re.IGNORECASE)

def upgrade_images_to_webp(html: str) -> str:
    """Wrap each <img src=".jpg|.png"> in a <picture> with a WebP <source> when a
    sibling .webp exists on disk. Modern browsers fetch the smaller WebP; older
    ones fall back to the original <img>, which keeps all its attributes (alt,
    width/height, loading, fetchpriority) so layout + LCP behaviour is unchanged.
    Skips imgs already inside a <picture>."""
    def repl(m):
        tag = m.group(0)
        src = m.group(1)
        webp = re.sub(r'\.(jpg|jpeg|png)$', '.webp', src, flags=re.IGNORECASE)
        if not (ROOT / webp.lstrip('/')).exists():
            return tag
        return f'<picture><source srcset="{webp}" type="image/webp">{tag}</picture>'
    return _IMG_TAG_RE.sub(repl, html)


def build_page(page):
    head_extra = page.get("head_extra", "") or JSONLD_ORG
    robots = ("noindex, nofollow" if page.get("noindex")
              else "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1")
    crumb = breadcrumb_jsonld(page["canonical"], page["title"])
    if crumb:
        head_extra += "\n" + crumb
    body = read_content(page["content"])
    faq = faqpage_jsonld(body)
    if faq:
        head_extra += "\n" + faq
    page_schema = page_type_jsonld(page["canonical"], page["title"], page["description"])
    if page_schema:
        head_extra += "\n" + page_schema

    # Per-page resource preload (e.g. the LCP hero image) for faster first paint.
    # Prefer the WebP variant when it exists so the preload matches what the
    # <picture> actually loads in modern browsers.
    for pl in page.get("preload", []):
        webp = re.sub(r'\.(jpg|jpeg|png)$', '.webp', pl)
        if webp != pl and (ROOT / webp.lstrip('/')).exists():
            head_extra += (f'\n<link rel="preload" as="image" type="image/webp" '
                           f'href="{webp}" fetchpriority="high">')
        else:
            head_extra += f'\n<link rel="preload" as="image" href="{pl}" fetchpriority="high">'

    head = (HEAD
            .replace("{{TITLE}}", page["title"])
            .replace("{{DESCRIPTION}}", page["description"])
            .replace("{{CANONICAL}}", page["canonical"])
            .replace("{{OG_IMAGE}}", page.get("og_image", DEFAULT_OG))
            .replace("{{ROBOTS}}", robots)
            .replace("{{HEAD_EXTRA}}", head_extra))

    # Mark the current page in the nav for a11y + UX (aria-current + active style).
    header = mark_active_nav(HEADER, page["canonical"])

    crumb_ui = breadcrumb_ui(page["canonical"], page["title"])

    html = "\n".join([head, header, crumb_ui, '<main id="main">', body, '</main>', FOOTER, CHAT,
                      GHL_TRACKING, ORV_PIXEL, "</body>\n</html>\n"])

    # Substitute global business tokens ({{EMAIL}}, {{WA_LINK}}, …) site-wide.
    html = apply_tokens(html)

    # Performance: async-decode + lazy-load images (skip those marked data-eager)
    html = re.sub(r'(<img\b(?![^>]*\bdecoding=)[^>]*)>', r'\1 decoding="async">', html)
    html = re.sub(r'(<img\b(?![^>]*\b(loading|fetchpriority)=)(?![^>]*\bdata-eager)[^>]*)>', r'\1 loading="lazy">', html)
    html = upgrade_images_to_webp(html)
    html = minify_html(html)

    out = slug_to_output_path(page["slug"])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out.relative_to(ROOT)


PAGES = [
    {"slug": "index.html", "content": "home", "canonical": "/",
     "title": "Damini Estate | Dubai Real Estate, Done Right",
     "description": "Damini Estate is a full-service real estate firm in Dubai. Buy, sell, rent, or invest with honest advice, deep market expertise, and results you can trust.",
     "og_image": "/assets/img/og-home.jpg",
     "preload": ["/assets/img/hero-dubai.jpg"]},

    {"slug": "about.html", "content": "about", "canonical": "/about",
     "title": "About Damini Estate | Your Partner in Dubai Property",
     "description": "Meet Damini Estate, a Dubai real estate firm built on integrity, expertise, and genuine care. Our story, our values, and why clients trust us."},

    {"slug": "services.html", "content": "services", "canonical": "/services",
     "title": "Services & Investor Tools | Damini Estate Dubai",
     "description": "Dubai residential sales, off-plan, commercial, investment advisory, property management and Golden Visa relocation, plus free yield and ROI calculators."},

    {"slug": "services/residential-sales.html", "content": "services/residential-sales", "canonical": "/services/residential-sales",
     "title": "Residential Sales in Dubai | Damini Estate",
     "description": "Buy or sell a home in Dubai with Damini Estate: apartments, townhouses and villas across every major community, with honest advice and hard negotiation."},

    {"slug": "services/off-plan-investments.html", "content": "services/off-plan-investments", "canonical": "/services/off-plan-investments",
     "title": "Off-Plan Investments in Dubai | Damini Estate",
     "description": "Priority access to off-plan launches from Dubai's leading developers, with flexible payment plans, honest risk assessment and a clear exit strategy."},

    {"slug": "services/commercial-real-estate.html", "content": "services/commercial-real-estate", "canonical": "/services/commercial-real-estate",
     "title": "Commercial Real Estate in Dubai | Damini Estate",
     "description": "Offices, retail and commercial assets in Dubai for owner-occupiers and investors: leasing, acquisition, and yield-led location analysis."},

    {"slug": "services/investment-advisory.html", "content": "services/investment-advisory", "canonical": "/services/investment-advisory",
     "title": "Property Investment Advisory in Dubai | Damini Estate",
     "description": "Honest, data-led Dubai property investment advice: yield and ROI modelling, total cost of ownership, area comparison and exit strategy."},

    {"slug": "services/property-management.html", "content": "services/property-management", "canonical": "/services/property-management",
     "title": "Property Management in Dubai | Damini Estate",
     "description": "Hands-off Dubai property management for landlords and overseas investors: tenant sourcing, Ejari, rent collection, maintenance and clear reporting."},

    {"slug": "services/golden-visa-relocation.html", "content": "services/golden-visa-relocation", "canonical": "/services/golden-visa-relocation",
     "title": "Golden Visa & Relocation in Dubai | Damini Estate",
     "description": "Qualify for the UAE Golden Visa through property and relocate with ease: eligibility checks, qualifying property selection and full application support."},

    {"slug": "properties.html", "content": "properties", "canonical": "/properties",
     "title": "Featured Dubai Properties | Damini Estate",
     "description": "A curated selection of Dubai property for sale and rent across Business Bay, Downtown, Dubai Hills, MBR City and Palm Jumeirah. View live listings on Bayut.",
     "og_image": "/assets/img/og-properties.jpg"},

    {"slug": "contact.html", "content": "contact", "canonical": "/contact",
     "title": "Contact Damini Estate | Dubai Real Estate Enquiries",
     "description": "Speak with Damini Estate about buying, selling, renting, or investing in Dubai property. Call, WhatsApp, email, or send an enquiry for a quick reply."},

    {"slug": "insights.html", "content": "insights", "canonical": "/insights",
     "title": "Dubai Property Insights | Damini Estate",
     "description": "Clear guides to buying and investing in Dubai real estate: off-plan strategy, rental yields, the Golden Visa, service charges, and how the market really works."},

    {"slug": "areas.html", "content": "areas", "canonical": "/areas",
     "title": "Dubai Communities & Areas | Damini Estate",
     "description": "Explore Dubai's best communities to buy and invest in: Business Bay, Downtown, Dubai Hills, Palm Jumeirah, MBR City and JVC, with lifestyle and yields."},

    {"slug": "areas/business-bay.html", "content": "areas/business-bay", "canonical": "/areas/business-bay",
     "title": "Business Bay Area Guide | Damini Estate",
     "description": "Buy or invest in Business Bay, Dubai: central canal-side living with strong rental demand. Lifestyle, property types and investment angle."},

    {"slug": "areas/downtown-dubai.html", "content": "areas/downtown-dubai", "canonical": "/areas/downtown-dubai",
     "title": "Downtown Dubai Area Guide | Damini Estate",
     "description": "Buy or invest in Downtown Dubai: Burj Khalifa, Dubai Mall and trophy addresses that hold value. Lifestyle, property types and investment outlook."},

    {"slug": "areas/dubai-hills-estate.html", "content": "areas/dubai-hills-estate", "canonical": "/areas/dubai-hills-estate",
     "title": "Dubai Hills Estate Area Guide | Damini Estate",
     "description": "Buy or invest in Dubai Hills Estate: green, family-first living around a championship golf course. Lifestyle, villas, apartments and growth outlook."},

    {"slug": "areas/palm-jumeirah.html", "content": "areas/palm-jumeirah", "canonical": "/areas/palm-jumeirah",
     "title": "Palm Jumeirah Area Guide | Damini Estate",
     "description": "Buy or invest on Palm Jumeirah: beachfront apartments and signature villas on Dubai's iconic island. Lifestyle, property types and investment angle."},

    {"slug": "areas/mbr-city.html", "content": "areas/mbr-city", "canonical": "/areas/mbr-city",
     "title": "MBR City Area Guide | Damini Estate",
     "description": "Buy or invest in MBR City (Mohammed Bin Rashid City): lagoons, villas and new-build value minutes from Downtown Dubai. Lifestyle and investment outlook."},

    {"slug": "areas/jvc.html", "content": "areas/jvc", "canonical": "/areas/jvc",
     "title": "JVC (Jumeirah Village Circle) Area Guide | Damini Estate",
     "description": "Buy or invest in JVC, Dubai: affordable entry and some of the city's strongest rental yields. Lifestyle, property types and investment angle."},

    {"slug": "privacy.html", "content": "privacy", "canonical": "/privacy", "noindex": True,
     "title": "Privacy Policy | Damini Estate",
     "description": "How Damini Estate collects, uses, and protects your personal data."},

    {"slug": "terms.html", "content": "terms", "canonical": "/terms", "noindex": True,
     "title": "Terms of Use | Damini Estate",
     "description": "The terms governing the use of the Damini Estate website."},

    {"slug": "disclaimer.html", "content": "disclaimer", "canonical": "/disclaimer", "noindex": True,
     "title": "Disclaimer | Damini Estate",
     "description": "Important disclaimers regarding property information, investment, and calculators on the Damini Estate website."},

    {"slug": "404.html", "content": "404", "canonical": "/404", "noindex": True,
     "title": "Page Not Found | Damini Estate",
     "description": "The page you are looking for could not be found."},
]

# ── Blog/insight articles (content/blog/<slug>.html) ─────────────────────────
ARTICLES = [
    {"slug": "blog/off-plan-vs-ready-property-dubai.html", "content": "blog/off-plan-vs-ready-property-dubai",
     "canonical": "/blog/off-plan-vs-ready-property-dubai",
     "og_image": "/assets/img/insight-offplan.jpg",
     "title": "Off-Plan vs Ready Property in Dubai: Which Is Right for You?",
     "description": "A clear, honest comparison of buying off-plan versus ready property in Dubai: payment plans, risk, yields, handover, and how to choose for your goals.",
     "article": {"date": "2026-05-12", "section": "Investing"}},

    {"slug": "blog/dubai-rental-yields-explained.html", "content": "blog/dubai-rental-yields-explained",
     "canonical": "/blog/dubai-rental-yields-explained",
     "og_image": "/assets/img/insight-yields.jpg",
     "title": "Dubai Rental Yields Explained: Gross vs Net Returns",
     "description": "How rental yields work in Dubai, the difference between gross and net yield, typical figures by area, and the costs that quietly eat into your returns.",
     "article": {"date": "2026-05-20", "section": "Investing"}},

    {"slug": "blog/dubai-golden-visa-property.html", "content": "blog/dubai-golden-visa-property",
     "canonical": "/blog/dubai-golden-visa-property",
     "og_image": "/assets/img/insight-goldenvisa.jpg",
     "title": "The Dubai Golden Visa Through Property: A Practical Guide",
     "description": "How to qualify for the UAE Golden Visa through real estate investment: thresholds, eligible property, the process, and common mistakes to avoid.",
     "article": {"date": "2026-05-26", "section": "Guides"}},

    {"slug": "blog/buying-property-in-dubai-foreigners.html", "content": "blog/buying-property-in-dubai-foreigners",
     "canonical": "/blog/buying-property-in-dubai-foreigners",
     "og_image": "/assets/img/insight-buying-process.jpg",
     "title": "Buying Property in Dubai as a Foreigner: Step-by-Step",
     "description": "The full step-by-step process for foreigners buying property in Dubai: freehold areas, budget and fees, financing, MOU, NOC, and the DLD transfer.",
     "article": {"date": "2026-05-28", "section": "Guides"}},

    {"slug": "blog/cost-of-buying-property-in-dubai.html", "content": "blog/cost-of-buying-property-in-dubai",
     "canonical": "/blog/cost-of-buying-property-in-dubai",
     "og_image": "/assets/img/insight-costs.jpg",
     "title": "The Real Cost of Buying Property in Dubai",
     "description": "A full breakdown of the cost of buying property in Dubai: the 4% DLD fee, agency and trustee fees, mortgage costs, NOC, and ongoing service charges.",
     "article": {"date": "2026-05-29", "section": "Guides"}},

    {"slug": "blog/best-areas-rental-yield-dubai.html", "content": "blog/best-areas-rental-yield-dubai",
     "canonical": "/blog/best-areas-rental-yield-dubai",
     "og_image": "/assets/img/insight-best-areas.jpg",
     "title": "Best Areas for Rental Yield in Dubai (2026)",
     "description": "Where to find the strongest rental yields in Dubai in 2026, how gross vs net yield works, and the communities that tend to deliver the best returns.",
     "article": {"date": "2026-05-30", "section": "Investing"}},
]


def article_jsonld(page):
    a = page["article"]
    payload = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": page["title"],
        "description": page["description"],
        "datePublished": a["date"],
        "dateModified": a.get("modified", a["date"]),
        "articleSection": a.get("section", "Insights"),
        "image": f"{SITE}{page.get('og_image', DEFAULT_OG)}",
        "author": {"@type": "Organization", "name": "Damini Estate", "url": SITE},
        "publisher": {"@id": f"{SITE}#org"},
        "mainEntityOfPage": {"@type": "WebPage", "@id": f"{SITE}{page['canonical']}"}
    }
    return f'<script type="application/ld+json">\n{json.dumps(payload, indent=2)}\n</script>'


def main():
    built, missing = 0, []
    all_pages = list(PAGES)
    for a in ARTICLES:
        a = dict(a)
        a["head_extra"] = JSONLD_ORG + "\n" + article_jsonld(a)
        all_pages.append(a)

    for p in all_pages:
        c = CONTENT / f"{p['content']}.html"
        if not c.exists():
            missing.append(p["content"]); continue
        out = build_page(p)
        print(f"  OK  {out}")
        built += 1
    if missing:
        print(f"\n  Missing content files: {', '.join(missing)}", file=sys.stderr)
    print(f"\nBuilt {built}/{len(all_pages)} page(s).")
    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())
