# Email + GoHighLevel setup — Damini Estate

How website form submissions become CRM contacts, auto-replies, and team
alerts — and how to send all of it through Microsoft 365 (Outlook) at **zero
GoHighLevel email cost**.

---

## The big picture

```
Website form (/contact, /newsletter)
   → Cloudflare Pages Function (functions/contact.js, newsletter.js)
       → GoHighLevel: upsert contact + add TAG + attach note
            → GHL Workflow (triggered by the tag)
                 → Send auto-reply to the lead  (FROM Outlook via SMTP)
                 → Send internal alert to the team
```

Tags the website already applies (your workflow triggers off these):
- Contact form → **`website-enquiry`** (+ `interest:<choice>`)
- Newsletter  → **`newsletter`**, **`website-newsletter`**

---

## Decision: Outlook SMTP vs LC Email (and the rebilling angle)

Your constraint: the agency shouldn't pay for Damini's email; either run it all
through Outlook, or have Damini pay for it itself. And GHL won't let you set
SMTP on a sub-account while **email reselling** is enabled — it's one or the
other.

| Option | Who pays | GHL cost | Setup |
|---|---|---|---|
| **A. Outlook SMTP** (recommended) | Damini (already pays Microsoft) | **$0** | Turn email reselling **OFF** for the sub-account, then add SMTP |
| B. LC Email + sending subdomain | Damini (via rebilling) | rebilled | Keep reselling **ON**, connect a sending subdomain |

**Recommended: Option A — Outlook SMTP.** Outbound email goes through Damini's
own Microsoft 365, so GHL charges nothing and there's nothing to rebill. "All
through Outlook," exactly as wanted. Only caveat: M365 has sending limits
(~10,000 recipients/day, ~30 msgs/min) — perfect for auto-replies, alerts, and
small lists; not for mass-marketing blasts. If Damini later needs big
newsletter sends, switch that piece to Option B (rebilled).

> To use SMTP you must **disable email reselling** for the Damini sub-account
> (Agency view → sub-account → Settings → … → SaaS/Rebilling → turn Email off).
> Sending then costs $0 because Outlook does the sending.

---

## Step 1 — Fix the 535 error (enable SMTP AUTH in Microsoft 365)

You hit:
```
535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant.
```
This is **Microsoft's default** — SMTP client auth is off tenant-wide. It is NOT
an aeserver-specific block; aeserver just resells the M365 tenant. Fix it in the
**Microsoft 365 admin center** (if you have Global Admin) or ask **aeserver
support** to do these two things for the mailbox `info@daminiestate.ae`:

**1a. Enable Authenticated SMTP on the mailbox**
- Admin center → **admin.microsoft.com** → Users → Active users → click
  `info@daminiestate.ae` → **Mail** tab → **Manage email apps** →
  tick **Authenticated SMTP** → Save.
- (PowerShell equivalent, for whoever has Exchange admin:
  `Set-CASMailbox -Identity info@daminiestate.ae -SmtpClientAuthenticationDisabled $false`)
- A per-mailbox enable overrides the tenant default, so you do **not** have to
  open SMTP for the whole tenant.

**1b. Handle MFA / Security Defaults**
- If the mailbox has MFA on (very likely), the normal password won't work for
  SMTP. Create an **App Password** and use that as the SMTP password:
  Microsoft 365 → security info → **App passwords** (requires per-user MFA +
  app passwords allowed by the admin). If "App passwords" isn't available, the
  admin must enable it (Entra → per-user MFA), or use a Conditional Access
  exclusion for SMTP instead of Security Defaults.
- If you only see **Security Defaults** (Entra → Properties → Manage security
  defaults), legacy SMTP can be blocked entirely; the admin may need to move to
  Conditional Access to allow authenticated SMTP for this mailbox.

**What to tell aeserver if you don't have admin access** (copy-paste):
> "Please enable Authenticated SMTP (SMTP AUTH / SmtpClientAuthentication) for
> the mailbox info@daminiestate.ae on our Microsoft 365 tenant, and provide an
> app password (or confirm MFA/app-password settings) so we can send via
> smtp.office365.com:587. Currently we get 535 5.7.139
> SmtpClientAuthentication is disabled for the Tenant."

## Step 2 — Enter the SMTP settings in GHL

Damini sub-account → **Settings → Email Services → SMTP** (visible once email
reselling is OFF). Enter:

| Field | Value |
|---|---|
| Host | `smtp.office365.com` |
| Port | `587` |
| Secure / encryption | **STARTTLS / TLS** |
| Username | `info@daminiestate.ae` |
| Password | mailbox password **or app password** from Step 1b |
| From name | `Damini Estate` |
| From email | `info@daminiestate.ae` |

Send the GHL test email. If it succeeds, sending now flows through Outlook.

> Receiving / two-way inbox is separate from SMTP. SMTP only *sends*. For the
> shared `info@` and personal inboxes (lola@, etc.) to appear in GHL
> Conversations, connect each mailbox under that user's profile (Outlook
> connection). If two-way doesn't work on your plan, the team simply reads
> replies in Outlook as normal — auto-send still works via SMTP.

---

## Step 3 — Build the GHL Workflows

### Workflow 1 — "Website Lead — auto-reply + alert"
1. **Trigger:** Contact Tag → *tag added* → `website-enquiry`.
2. **Action — Send Email (to the contact):**
   - From: `info@daminiestate.ae`
   - Subject: `Thank you for contacting Damini Estate`
   - Body: paste **docs/email-templates/lead-autoreply.html** (Code/HTML editor)
3. **Action — Send Internal Notification → Email:**
   - To: `info@daminiestate.ae`, `lola@daminiestate.ae`, (+ the third inbox)
   - Subject: `New website enquiry: {{contact.first_name}} {{contact.last_name}}`
   - Body: paste **docs/email-templates/internal-alert.html**
4. *(Optional)* Action → **Create Task** / assign to an agent for follow-up.

### Workflow 2 — "Newsletter — welcome"
1. **Trigger:** Contact Tag → *tag added* → `newsletter`.
2. **Action — Send Email (to the contact):**
   - From: `info@daminiestate.ae`
   - Subject: `Welcome to Damini Estate`
   - Body: paste **docs/email-templates/newsletter-welcome.html**

Enable / publish both workflows. Submit a test from the live site to confirm the
lead lands in GHL, gets tagged, and the emails fire.

---

## Notes

- The website Functions **do not need Resend** when GHL sends the emails. They
  already degrade gracefully — they upsert + tag the contact and skip their own
  email if `RESEND_*` env vars aren't set. So with Outlook-SMTP-in-GHL you only
  ever set the two required Cloudflare secrets: `GHL_API_KEY`, `GHL_LOCATION_ID`.
- Email DNS for the domain (MX / SPF / autodiscover on Microsoft 365) stays
  **exactly as-is** — do not change it. Outlook SMTP uses the existing setup.
- If you later add a sending subdomain for bulk marketing (Option B), generate
  SPF/DKIM/DMARC for `send.daminiestate.ae` only — never touch the root MX/SPF
  that M365 relies on.
