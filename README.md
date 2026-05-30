# Damini Estate website

Static, bilingual (EN/RU) marketing site for **Damini Real Estate L.L.C**
(Dubai). Live at **https://daminiestate.ae**.

Hand-written HTML assembled by `build.py`, served on **Cloudflare Pages**, with
**Pages Functions** for the contact/newsletter forms (GoHighLevel CRM). No
framework, no bundler — Python 3 only.

## Develop

```bash
python3 build.py            # build all pages from _partials/ + content/
python3 generate-sitemap.py # regenerate sitemap.xml
python3 -m http.server 8799 # preview at http://localhost:8799
```

Edit `_partials/*` or `content/*`, then **rebuild and commit the regenerated
HTML** (the output HTML is committed; Cloudflare does no build step).

## Deploy

Push to **`main`** → Cloudflare Pages auto-deploys to production. One branch only.

## Full documentation

See **[CLAUDE.md](./CLAUDE.md)** for architecture, the deploy model, required
Cloudflare secrets, the form backends, the intro loader, conventions, and the
important "do not" list (e.g. don't touch the email DNS). Read it before making
changes.

---
Built and maintained by [Orevida Media](https://media.orevida.com).
