/**
 * Shared helpers for Damini Estate Cloudflare Pages Functions.
 *
 * All third-party credentials live ONLY in Cloudflare Pages encrypted env vars
 * (Settings → Environment variables). They are never written to the codebase
 * and never sent to the browser.
 *
 * Env vars used by the form handlers:
 *   GHL_API_KEY      — GoHighLevel private integration key (pit-...)
 *   GHL_LOCATION_ID  — GHL sub-account location ID
 *   RESEND_API_KEY   — Resend API key (re_...) for confirmation emails (optional)
 *   RESEND_FROM      — verified sender, e.g. "Damini Estate <hello@send.daminiestate.ae>" (optional)
 *   NOTIFY_EMAIL     — internal inbox for fallback notifications (optional, defaults to info@daminiestate.ae)
 */

export const ALLOWED_HOSTS = ['daminiestate.ae', 'www.daminiestate.ae'];

/** Allow localhost during `wrangler pages dev` previews only. */
const DEV_HOSTS = ['localhost', '127.0.0.1'];

/** Validate origin/referer by parsed hostname (no substring bypass). */
export function isAllowedOrigin(value) {
  if (!value) return false;
  try {
    const h = new URL(value).hostname;
    return ALLOWED_HOSTS.includes(h) || DEV_HOSTS.includes(h);
  } catch { return false; }
}

/** JSON response with no-store caching. */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** fetch() with an AbortController timeout so upstreams can't hang the Worker. */
export async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export const safeBodyText = (r, ms = 3000) =>
  Promise.race([
    r.text().catch(() => String(r.status)),
    new Promise((res) => setTimeout(() => res('[body read timeout]'), ms)),
  ]);

export const safeBodyJson = (r, ms = 3000) =>
  Promise.race([
    r.json().catch(() => null),
    new Promise((res) => setTimeout(() => res(null), ms)),
  ]);

/** Strip CR/LF so user values can't fake note fields or inject email headers. */
export const oneline = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();

/** Minimal HTML escape for confirmation emails. */
export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (e) => !!e && e.length <= 254 && EMAIL_RE.test(e);

/** GoHighLevel REST POST. */
export function ghlPost(path, key, body) {
  return fetchWithTimeout('https://services.leadconnectorhq.com' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'Version': '2021-07-28',
    },
    body: JSON.stringify(body),
  });
}

// ── In-isolate rate limiting ────────────────────────────────────────────────
// Not globally exact (Workers run in many isolates) but stops rapid-fire bots.
// For hard limits add a Cloudflare WAF Rate Limiting rule in the dashboard.
const RL_WINDOW = 60_000;
const RL_MAX_MAP = 1_000;

export function makeRateLimiter(max) {
  const store = new Map();
  return function rateCheck(ip) {
    const now = Date.now();
    if (store.size > RL_MAX_MAP) {
      for (const [k, v] of store) if (now - v.windowStart > RL_WINDOW) store.delete(k);
    }
    const e = store.get(ip);
    if (!e || now - e.windowStart > RL_WINDOW) {
      store.set(ip, { count: 1, windowStart: now });
      return true;
    }
    if (e.count >= max) return false;
    e.count++;
    return true;
  };
}

/** Extract validated attribution fields from a parsed FormData getter. */
export function attribution(get) {
  const clip = (v) => (v || '').slice(0, 256);
  return {
    utm_source: clip(get('h_utm_source')),
    utm_medium: clip(get('h_utm_medium')),
    utm_campaign: clip(get('h_utm_campaign')),
    fbclid: clip(get('h_fbclid')),
    gclid: clip(get('h_gclid')),
    ttclid: clip(get('h_ttclid')),
  };
}
