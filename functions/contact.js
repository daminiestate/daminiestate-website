/**
 * Cloudflare Pages Function: POST /contact
 *
 * Handles the enquiry form on /contact/ (and any other form posting to /contact).
 * On every valid submission:
 *   1. Upsert the contact in GoHighLevel (dedupe by email)
 *   2. Add tags additively (never overwrites existing tags)
 *   3. Attach a Note with all fields + page URL + visitor geo
 *   4. Create an Opportunity in the sales pipeline (if GHL_PIPELINE_ID + GHL_STAGE_ID set)
 *   5. Send a branded confirmation email to the client (if Resend configured)
 *
 * Degrades gracefully: if GHL/Resend env vars are absent, it validates, logs,
 * and still returns { ok: true } so the UX never breaks while you finish setup.
 *
 * See functions/_shared.js for the env vars this expects.
 */
import {
  isAllowedOrigin, json, fetchWithTimeout, safeBodyText, safeBodyJson,
  oneline, esc, isEmail, ghlPost, makeRateLimiter, attribution,
} from './_shared.js';

const rateCheck = makeRateLimiter(5); // 5 enquiries / min / IP

export async function onRequestPost({ request, env, ctx }) {
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
  const get = (k) => (data.get(k) || '').toString().trim().slice(0, 3000);

  if (get('website') !== '') return json({ ok: true }); // honeypot

  const name = get('name').slice(0, 100);
  const email = get('email').slice(0, 254);
  const phone = get('phone').slice(0, 32);
  const interest = get('interest').slice(0, 80);
  const message = get('message').slice(0, 3000);
  if (!name) return json({ ok: false, error: 'name_required' }, 400);
  if (!isEmail(email)) return json({ ok: false, error: 'invalid_email' }, 400);

  const attr = attribution(get);
  const visitorCountry = (request.headers.get('cf-ipcountry') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || null;
  const visitorCity = String(request.cf?.city || '').trim().slice(0, 64) || null;
  const pageUrl = referer || 'unknown';

  const ghlKey = env.GHL_API_KEY;
  const ghlLocationId = env.GHL_LOCATION_ID;
  let contactId = null;

  if (ghlKey && ghlLocationId) {
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ');
    try {
      const upsert = await ghlPost('/contacts/upsert', ghlKey, {
        locationId: ghlLocationId,
        firstName,
        lastName: lastName || undefined,
        email,
        phone: phone || undefined,
        ...(visitorCountry ? { country: visitorCountry } : {}),
        source: 'Website Enquiry',
      });
      if (upsert.ok) {
        const d = await safeBodyJson(upsert);
        contactId = d?.contact?.id ?? null;
      } else {
        console.error('GHL contact upsert error:', await safeBodyText(upsert));
      }
    } catch (err) { console.error('GHL contact fetch error:', err); }

    if (contactId) {
      const note = [
        'Website enquiry via daminiestate.ae',
        `Name    : ${oneline(name)}`,
        `Email   : ${oneline(email)}`,
        phone ? `Phone   : ${oneline(phone)}` : null,
        interest ? `Interest: ${oneline(interest)}` : null,
        message ? `\nMessage:\n${oneline(message)}` : null,
        `\nPage    : ${oneline(pageUrl)}`,
        visitorCity ? `Location: ${oneline(visitorCity)}${visitorCountry ? ', ' + visitorCountry : ''}` : (visitorCountry ? `Country : ${visitorCountry}` : null),
        attr.utm_source ? `UTM src : ${oneline(attr.utm_source)}` : null,
        attr.utm_medium ? `UTM med : ${oneline(attr.utm_medium)}` : null,
        attr.utm_campaign ? `Campaign: ${oneline(attr.utm_campaign)}` : null,
        attr.utm_content ? `Content : ${oneline(attr.utm_content)}` : null,
        (attr.fbclid || attr.gclid || attr.ttclid || attr.msclkid || attr.li_fat_id)
          ? `ClickIDs: ${['fbclid', 'gclid', 'ttclid', 'msclkid', 'li_fat_id'].map((k) => attr[k] ? k + '=' + oneline(attr[k]) : null).filter(Boolean).join(' ')}`
          : null,
      ].filter((l) => l !== null).join('\n');

      const tags = ['website-enquiry'];
      if (interest) tags.push('interest:' + interest.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40));

      const tasks = [
        ghlPost(`/contacts/${contactId}/tags`, ghlKey, { tags }).catch((e) => { console.error('GHL tag error:', e); return null; }),
        ghlPost(`/contacts/${contactId}/notes`, ghlKey, { body: note }).catch((e) => { console.error('GHL note error:', e); return null; }),
      ];

      if (env.GHL_PIPELINE_ID && env.GHL_STAGE_ID) {
        tasks.push(
          ghlPost('/opportunities/', ghlKey, {
            pipelineId: env.GHL_PIPELINE_ID,
            pipelineStageId: env.GHL_STAGE_ID,
            locationId: ghlLocationId,
            contactId,
            name: `${name}, ${interest || 'Enquiry'}`,
            status: 'open',
          }).catch((e) => { console.error('GHL opportunity error:', e); return null; })
        );
      }
      await Promise.all(tasks);
    }
  } else {
    console.warn('GHL env vars not set, skipping CRM sync for contact form');
  }

  // Internal fallback notification if CRM sync failed
  if (!contactId && env.RESEND_API_KEY && env.RESEND_FROM) {
    const p = fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [env.NOTIFY_EMAIL || 'info@daminiestate.ae'],
        subject: `New website enquiry (CRM sync failed): ${oneline(name)}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nInterest: ${interest}\n\nMessage:\n${message}\n\nPage: ${pageUrl}\n\nPlease add to GHL manually.`,
      }),
    }, 10000).catch((e) => console.error('Internal notify error:', e));
    if (ctx?.waitUntil) ctx.waitUntil(p);
  }

  // Client confirmation email
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    try {
      const r = await fetchWithTimeout('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: [email],
          reply_to: 'info@daminiestate.ae',
          subject: 'Thank you for contacting Damini Estate',
          text: `Dear ${name},\n\nThank you for getting in touch with Damini Estate. We have received your enquiry and a member of our team will respond shortly.\n\nIf it's urgent, message us on WhatsApp: https://wa.me/971585720882\n\nWarm regards,\nThe Damini Estate Team\nCrystal Tower, Office 1102, Business Bay, Dubai, UAE\ninfo@daminiestate.ae`,
          html: confirmationHtml(name),
        }),
      }, 10000);
      if (!r.ok) console.error('Resend contact error:', await safeBodyText(r));
    } catch (err) { console.error('Resend contact fetch error:', err); }
  }

  return json({ ok: true });
}

function confirmationHtml(name) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0E0C0A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0E0C0A"><tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#161412;border:1px solid rgba(245,240,232,0.12)">
    <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(245,240,232,0.12)">
      <span style="font-family:Georgia,serif;font-size:24px;letter-spacing:6px;color:#F5F0E8;text-transform:uppercase">DAMINI</span>
      <span style="display:block;font-size:9px;letter-spacing:8px;color:#C9B99A;text-transform:uppercase;margin-top:2px">Estate</span>
    </td></tr>
    <tr><td style="padding:36px 40px;font-family:Arial,Helvetica,sans-serif;color:#DDD5C8">
      <p style="margin:0 0 16px;font-size:18px;color:#F5F0E8">Dear ${esc(name)},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.8">Thank you for contacting <strong style="color:#F5F0E8">Damini Estate</strong>. We have received your enquiry and a member of our team will be in touch with you very shortly.</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.8">If your enquiry is urgent, you can reach us instantly on WhatsApp.</p>
      <a href="https://wa.me/971585720882" style="display:inline-block;background:#C9B99A;color:#0E0C0A;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px">Message us on WhatsApp</a>
    </td></tr>
    <tr><td style="padding:24px 40px;border-top:1px solid rgba(245,240,232,0.12);font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#8a857b">
      Damini Real Estate L.L.C · RERA 57358<br>Crystal Tower, Office 1102, Business Bay, Dubai, UAE<br>
      <a href="mailto:info@daminiestate.ae" style="color:#C9B99A;text-decoration:none">info@daminiestate.ae</a> · <a href="https://daminiestate.ae" style="color:#C9B99A;text-decoration:none">daminiestate.ae</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
