#!/usr/bin/env python3
"""Generate sitemap.xml for daminiestate.ae from build.py's PAGES + ARTICLES.

Indexable pages only (legal + 404 are noindex and excluded).
Run after build.py:  python3 generate-sitemap.py
"""
import datetime
from pathlib import Path
from build import PAGES, ARTICLES, SITE

ROOT = Path(__file__).resolve().parent
TODAY = datetime.date.today().isoformat()

META = {
    "/":            ("weekly",  "1.0"),
    "/properties":  ("daily",   "0.9"),
    "/services":    ("monthly", "0.8"),
    "/about":       ("monthly", "0.7"),
    "/contact":     ("monthly", "0.7"),
    "/insights":    ("weekly",  "0.7"),
}

def url_entry(loc, changefreq, priority, lastmod=TODAY):
    path = loc if loc == "/" else loc.rstrip("/") + "/"
    return (
        "  <url>\n"
        f"    <loc>{SITE}{path}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>"
    )

def main():
    entries = []
    for p in PAGES:
        if p.get("noindex"):
            continue
        cf, pr = META.get(p["canonical"], ("monthly", "0.6"))
        entries.append(url_entry(p["canonical"], cf, pr))
    for a in ARTICLES:
        lm = a.get("article", {}).get("date", TODAY)
        entries.append(url_entry(a["canonical"], "monthly", "0.6", lm))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    print(f"Wrote sitemap.xml with {len(entries)} URLs.")

if __name__ == "__main__":
    main()
