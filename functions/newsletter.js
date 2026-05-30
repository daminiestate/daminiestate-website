/**
 * Cloudflare Pages Function: POST /newsletter
 *
 * Handles newsletter sign-ups from the footer / insights forms.
 *   1. Upsert the contact in GoHighLevel (dedupe by email)
 *   2. Add tags additively: ['newsletter', 'website-newsletter']
 *   3. Attach a Note with the page URL
 *   4. Send a branded welcome email (if Resend configured)
 *
 * Degrades gracefully when env vars are absent. See functions/_shared.js.
 */
import {
  isAllowedOrigin, json, fetchWithTimeout, safeBodyText, safeBodyJson,
  oneline, isEmail, ghlPost, makeRateLimiter, attribution,
} from './_shared.js';

const rateCheck = makeRateLimiter(3); // stricter: 3 sign-ups / min / IP

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  if (!isAllowedOrigin(origin) && !isAllowedOrigin(referer)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!rateCheck(clientIp)) return json({ ok: false, error: 'rate_limited' }, 429);

  let data;
  try { data = await request.formData(); }
  catch { return json({ ok: false, error: 'invalid_body' }, 400); }
  const get = (k) => (data.get(k) || '').toString().trim().slice(0, 500);

  if (get('website') !== '') return json({ ok: true }); // honeypot

  const email = get('email').slice(0, 254);
  if (!isEmail(email)) return json({ ok: false, error: 'invalid_email' }, 400);

  const attr = attribution(get);
  const visitorCountry = (request.headers.get('cf-ipcountry') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || null;
  const pageUrl = referer || 'unknown';

  const ghlKey = env.GHL_API_KEY;
  const ghlLocationId = env.GHL_LOCATION_ID;
  let contactId = null;

  if (ghlKey && ghlLocationId) {
    try {
      const upsert = await ghlPost('/contacts/upsert', ghlKey, {
        locationId: ghlLocationId,
        email,
        ...(visitorCountry ? { country: visitorCountry } : {}),
        source: 'Website Newsletter',
      });
      if (upsert.ok) {
        const d = await safeBodyJson(upsert);
        contactId = d?.contact?.id ?? null;
      } else {
        console.error('GHL newsletter upsert error:', await safeBodyText(upsert));
      }
    } catch (err) { console.error('GHL newsletter fetch error:', err); }

    if (contactId) {
      const note = [
        'Newsletter sign-up via daminiestate.ae',
        `Email: ${oneline(email)}`,
        `Page : ${oneline(pageUrl)}`,
        attr.utm_source ? `UTM src : ${oneline(attr.utm_source)}` : null,
      ].filter((l) => l !== null).join('\n');
      await Promise.all([
        ghlPost(`/contacts/${contactId}/tags`, ghlKey, { tags: ['newsletter', 'website-newsletter'] })
          .catch((e) => { console.error('GHL tag error:', e); return null; }),
        ghlPost(`/contacts/${contactId}/notes`, ghlKey, { body: note })
          .catch((e) => { console.error('GHL note error:', e); return null; }),
      ]);
    }
  } else {
    console.warn('GHL env vars not set — skipping CRM sync for newsletter');
  }

  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    try {
      const r = await fetchWithTimeout('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: [email],
          reply_to: 'info@daminiestate.ae',
          subject: 'Welcome to Damini Estate',
          text: `Welcome to Damini Estate.\n\nThank you for subscribing. You'll be among the first to hear about new launches, market insight, and curated Dubai listings.\n\nBrowse our properties: https://daminiestate.ae/properties/\nQuestions? WhatsApp us: https://wa.me/971585720882\n\nWarm regards,\nThe Damini Estate Team\nCrystal Tower, Office 1102, Business Bay, Dubai, UAE`,
          html: welcomeHtml(),
          headers: {
            'List-Unsubscribe': `<mailto:info@daminiestate.ae?subject=Unsubscribe ${encodeURIComponent(email)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      }, 10000);
      if (!r.ok) console.error('Resend newsletter error:', await safeBodyText(r));
    } catch (err) { console.error('Resend newsletter fetch error:', err); }
  }

  return json({ ok: true });
}

function welcomeHtml() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0E0C0A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0E0C0A"><tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#161412;border:1px solid rgba(245,240,232,0.12)">
    <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(245,240,232,0.12)">
      <span style="font-family:Georgia,serif;font-size:24px;letter-spacing:6px;color:#F5F0E8;text-transform:uppercase">DAMINI</span>
      <span style="display:block;font-size:9px;letter-spacing:8px;color:#C9B99A;text-transform:uppercase;margin-top:2px">Estate</span>
    </td></tr>
    <tr><td style="padding:36px 40px;font-family:Arial,Helvetica,sans-serif;color:#DDD5C8">
      <p style="margin:0 0 16px;font-size:20px;color:#F5F0E8;font-family:Georgia,serif">Welcome to Damini Estate</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.8">Thank you for subscribing. You'll be among the first to hear about new launches, honest market insight, and curated Dubai listings — before they go public.</p>
      <a href="https://daminiestate.ae/properties/" style="display:inline-block;background:#C9B99A;color:#0E0C0A;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;margin-top:8px">Browse Properties</a>
    </td></tr>
    <tr><td style="padding:24px 40px;border-top:1px solid rgba(245,240,232,0.12);font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#8a857b">
      Damini Real Estate L.L.C · RERA 57358 · Business Bay, Dubai, UAE<br>
      You're receiving this because you subscribed at daminiestate.ae. Reply to unsubscribe.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
