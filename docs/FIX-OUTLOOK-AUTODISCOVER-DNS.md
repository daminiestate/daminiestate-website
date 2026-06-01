# Fix: Outlook email autodiscover (Cloudflare DNS)

**Status: NEEDS DOING. This is a real, currently-broken thing. ~5 minutes.**
**A note from Phil:** when we moved DNS to Cloudflare, Outlook auto-setup broke.
Mail still sends and receives fine, but Outlook/phone "automatic" account setup
fails because one DNS record (`autodiscover`) is pointed at the website instead
of at Microsoft. This is the fix. It is safe and only touches that one record.

This document is self-contained: read it cold and you can complete it with just
access to the Cloudflare account that holds the DNS for daminiestate.ae.

---

## 1. What is wrong, in plain English

Email for daminiestate.ae runs on **Microsoft 365 / Outlook** (through the
provider aeserver). When email setup was on the old DNS, everything worked.
After DNS moved to Cloudflare, the records that route mail (MX, SPF) came across
correctly, BUT the `autodiscover` record got left pointing at Cloudflare's web
servers instead of at Microsoft.

`autodiscover` is the record Outlook (and the iPhone/Android mail apps) use to
**configure an account automatically**. When you type your email and password,
the app looks up `autodiscover.daminiestate.ae` to find the mail server settings.
Right now that lookup lands on the website (it returns a web error, "521"),
so automatic setup fails or hangs.

**Important:** sending and receiving email is NOT broken. Existing, already
configured accounts keep working. What is broken is **setting up a new account
the easy/automatic way**. The fix below restores that.

---

## 2. The one change to make

Point `autodiscover` at Microsoft, as a CNAME, set to "DNS only" (grey cloud, not
proxied). That is the whole fix.

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `autodiscover` |
| Target / Content | `autodiscover.outlook.com` |
| Proxy status | **DNS only** (grey cloud, NOT orange) |
| TTL | Auto |

The "DNS only / grey cloud" part is critical. If it is left orange (proxied),
Cloudflare routes it through its web servers again and the problem comes back.

---

## 3. Step by step (Cloudflare dashboard)

### Step 1: Open the DNS records
1. Go to https://dash.cloudflare.com and log in.
2. Choose the account, then click the **daminiestate.ae** domain.
3. In the left sidebar click **DNS** -> **Records**.

### Step 2: Remove the wrong autodiscover record
1. In the records list, find the row where **Name** is `autodiscover`
   (it will currently be an **A** or **CNAME** record, and likely shows an
   **orange cloud** / "Proxied").
2. Click **Edit** on that row, then **Delete** (or just Delete it).
   - This is safe: it is the broken record. We replace it in the next step.

### Step 3: Add the correct record
1. Click **Add record**.
2. Set:
   - **Type:** `CNAME`
   - **Name:** `autodiscover`
   - **Target:** `autodiscover.outlook.com`
   - **Proxy status:** click the cloud so it is **grey** ("DNS only"), not orange.
   - **TTL:** Auto
3. Click **Save**.

### Step 4: Leave the mail records alone
Do NOT change these, they are already correct:
- **MX** -> `daminiestate-ae.mail.protection.outlook.com`
- **TXT (SPF)** -> `v=spf1 include:spf.protection.outlook.com -all`
- The `MS=...` verification TXT record, if present.

Only the `autodiscover` record needed fixing.

---

## 4. How to confirm it worked

Give DNS a few minutes (usually fast, can take up to an hour), then:

- **Quick check (any computer):** open a terminal and run
  `nslookup -type=cname autodiscover.daminiestate.ae`
  It should now show `autodiscover.outlook.com` (not a Cloudflare IP like
  104.21.x or 172.67.x).
- **Real check:** add the mailbox to Outlook or the phone Mail app using just the
  email address and password. Automatic setup should now find the settings and
  complete without manual server entry.

If it still fails after an hour, double-check the new record is **grey cloud
(DNS only)**, not orange/proxied, that is the usual cause.

---

## 5. Optional, while you are in there: DKIM

DKIM (which signs outgoing mail so it is less likely to be marked spam) was not
migrated. It is optional and does not block anything, but if outgoing mail ever
lands in spam, this is worth adding. In the Microsoft 365 admin you can enable
DKIM for daminiestate.ae; it will give you two `selector1._domainkey` and
`selector2._domainkey` CNAME records to add in Cloudflare (also DNS only). Only
do this if you have the M365 admin access and want the deliverability boost.

---

## Why this is not in the website code

This is a DNS/email change, completely separate from the website. The website
(Cloudflare Pages) and the email (Microsoft 365) just happen to share the same
domain. Changing this record does not affect the site at all, and the standing
rule in CLAUDE.md is: do not touch the mail DNS records except this specific,
known fix.
