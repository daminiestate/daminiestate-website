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

def read(p): return (PARTIALS / p).read_text(encoding="utf-8")
def read_content(name): return (CONTENT / f"{name}.html").read_text(encoding="utf-8")

HEAD = read("head.html")
HEADER = read("header.html")
FOOTER = read("footer.html")
CHAT = read("chat-widget.html")

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
            "description": "Damini Estate is a full-service real estate firm based in Dubai, UAE. We help clients buy, sell, rent, and manage residential, off-plan, and commercial property across Dubai.",
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
        name = title.split(" · ")[0].split("—")[0].strip() if i == len(parts) - 1 else p.replace("-", " ").title()
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


def build_page(page):
    head_extra = page.get("head_extra", "") or JSONLD_ORG
    if page.get("noindex"):
        head_extra = NOINDEX_META + "\n" + head_extra
    crumb = breadcrumb_jsonld(page["canonical"], page["title"])
    if crumb:
        head_extra += "\n" + crumb
    body = read_content(page["content"])
    faq = faqpage_jsonld(body)
    if faq:
        head_extra += "\n" + faq

    head = (HEAD
            .replace("{{TITLE}}", page["title"])
            .replace("{{DESCRIPTION}}", page["description"])
            .replace("{{CANONICAL}}", page["canonical"])
            .replace("{{OG_IMAGE}}", page.get("og_image", DEFAULT_OG))
            .replace("{{HEAD_EXTRA}}", head_extra))

    html = "\n".join([head, HEADER, '<main id="main">', body, '</main>', FOOTER, CHAT,
                      "</body>\n</html>\n"])

    # Performance: async-decode + lazy-load images (skip those marked data-eager)
    html = re.sub(r'(<img\b(?![^>]*\bdecoding=)[^>]*)>', r'\1 decoding="async">', html)
    html = re.sub(r'(<img\b(?![^>]*\b(loading|fetchpriority)=)(?![^>]*\bdata-eager)[^>]*)>', r'\1 loading="lazy">', html)
    html = minify_html(html)

    out = slug_to_output_path(page["slug"])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out.relative_to(ROOT)


PAGES = [
    {"slug": "index.html", "content": "home", "canonical": "/",
     "title": "Damini Estate — Dubai Real Estate, Done Right",
     "description": "Damini Estate is a full-service real estate firm in Dubai. Buy, sell, rent, or invest in Dubai property with honest advice, deep market expertise, and results you can trust.",
     "og_image": "/assets/img/og-home.jpg"},

    {"slug": "about.html", "content": "about", "canonical": "/about",
     "title": "About Damini Estate — Your Partner in Dubai Property",
     "description": "Meet Damini Estate: a Dubai real estate firm built on integrity, expertise, and genuine care. Learn our story, our values, and why clients trust us with their property goals."},

    {"slug": "services.html", "content": "services", "canonical": "/services",
     "title": "Services & Investor Tools — Damini Estate Dubai",
     "description": "Residential sales, off-plan investment, commercial real estate, investment advisory, property management, and Golden Visa relocation — plus free Dubai mortgage, yield, ROI, and service-charge calculators."},

    {"slug": "properties.html", "content": "properties", "canonical": "/properties",
     "title": "Featured Dubai Properties — Damini Estate",
     "description": "A curated selection of Dubai properties for sale and rent across Business Bay, Downtown, Dubai Hills, MBR City, Palm Jumeirah and more. View live listings via our verified Bayut portfolio.",
     "og_image": "/assets/img/og-properties.jpg"},

    {"slug": "contact.html", "content": "contact", "canonical": "/contact",
     "title": "Contact Damini Estate — Dubai Real Estate Enquiries",
     "description": "Speak with Damini Estate about buying, selling, renting, or investing in Dubai property. Call, WhatsApp, email, or send an enquiry — our Business Bay team responds quickly."},

    {"slug": "insights.html", "content": "insights", "canonical": "/insights",
     "title": "Dubai Property Insights — Damini Estate",
     "description": "Guides and market insight for buying and investing in Dubai real estate: off-plan strategy, rental yields, the Golden Visa, service charges, and how the market really works."},

    {"slug": "privacy.html", "content": "privacy", "canonical": "/privacy", "noindex": True,
     "title": "Privacy Policy — Damini Estate",
     "description": "How Damini Estate collects, uses, and protects your personal data."},

    {"slug": "terms.html", "content": "terms", "canonical": "/terms", "noindex": True,
     "title": "Terms of Use — Damini Estate",
     "description": "The terms governing the use of the Damini Estate website."},

    {"slug": "disclaimer.html", "content": "disclaimer", "canonical": "/disclaimer", "noindex": True,
     "title": "Disclaimer — Damini Estate",
     "description": "Important disclaimers regarding property information, investment, and calculators on the Damini Estate website."},

    {"slug": "404.html", "content": "404", "canonical": "/404", "noindex": True,
     "title": "Page Not Found — Damini Estate",
     "description": "The page you are looking for could not be found."},
]

# ── Blog/insight articles (content/blog/<slug>.html) ─────────────────────────
ARTICLES = [
    {"slug": "blog/off-plan-vs-ready-property-dubai.html", "content": "blog/off-plan-vs-ready-property-dubai",
     "canonical": "/blog/off-plan-vs-ready-property-dubai",
     "title": "Off-Plan vs Ready Property in Dubai: Which Is Right for You?",
     "description": "A clear, honest comparison of buying off-plan versus ready property in Dubai — payment plans, risk, yields, handover, and how to choose based on your goals.",
     "article": {"date": "2026-05-12", "section": "Investing"}},

    {"slug": "blog/dubai-rental-yields-explained.html", "content": "blog/dubai-rental-yields-explained",
     "canonical": "/blog/dubai-rental-yields-explained",
     "title": "Dubai Rental Yields Explained: Gross, Net, and What to Expect",
     "description": "How rental yields work in Dubai, the difference between gross and net yield, typical figures by area, and the costs that quietly eat into your returns.",
     "article": {"date": "2026-05-20", "section": "Investing"}},

    {"slug": "blog/dubai-golden-visa-property.html", "content": "blog/dubai-golden-visa-property",
     "canonical": "/blog/dubai-golden-visa-property",
     "title": "The Dubai Golden Visa Through Property: A Practical Guide",
     "description": "How to qualify for the UAE Golden Visa through real estate investment — thresholds, eligible property, the process, and common mistakes to avoid.",
     "article": {"date": "2026-05-26", "section": "Guides"}},
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
