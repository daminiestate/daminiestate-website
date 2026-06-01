/**
 * Cloudflare Pages Function: /t and /t/* (catch-all)
 *
 * First-party proxy for Orevida pixel events on daminiestate.ae.
 * The browser sends events to daminiestate.ae/t/net (same origin → no ad
 * blocker, no CORS), and this Function forwards them server-side to
 * t.orevida.com/net (or /net/batch for batched events).
 *
 * The shim prepended to /pixel.js (see functions/pixel.js.js) rewrites the
 * pixel's hard-coded:
 *   https://t.orevida.com/net       → /t/net
 *   https://t.orevida.com/net/batch → /t/net/batch
 * This catch-all handles every sub-path under /t/.
 *
 * Runs at the Cloudflare edge, negligible latency, always on.
 */

// Only forward the known Orevida pixel endpoints, reject arbitrary sub-paths.
const ALLOWED_PATHS = new Set(['net', 'net/batch']);

const CORS_ORIGIN = 'https://daminiestate.ae';

async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function onRequest(context) {
  const { request, params } = context;

  const tail = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const upstreamPath = tail || 'net';

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Origin/Referer guard: reject only a present-but-foreign source. Header-less
  // requests are allowed so legit first-party beacons are never dropped. Stops a
  // third party relaying tracking events through our Worker quota.
  const _tOrigin = request.headers.get('origin') || '';
  const _tReferer = request.headers.get('referer') || '';
  const _tOk = (v) => {
    try {
      const h = new URL(v).hostname;
      return h === 'daminiestate.ae' || h === 'www.daminiestate.ae';
    } catch {
      return false;
    }
  };
  if ((_tOrigin && !_tOk(_tOrigin)) || (!_tOrigin && _tReferer && !_tOk(_tReferer))) {
    return new Response(null, { status: 403 });
  }

  // Allowlist: only proxy known Orevida endpoints. Use 200 (not 204), RFC 7230
  // forbids a body on 204, and the pixel client may JSON.parse the body.
  if (!ALLOWED_PATHS.has(upstreamPath)) {
    return new Response('{}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': CORS_ORIGIN,
        'cache-control': 'no-store',
      },
    });
  }

  const qs = new URL(request.url).search;
  const upstreamUrl = `https://t.orevida.com/${upstreamPath}${qs}`;

  try {
    // Reject oversized proxy bodies (tracking beacons are tiny; cap blocks relay abuse).
    if (request.method !== 'GET' && request.method !== 'HEAD' &&
        parseInt(request.headers.get('content-length') || '0', 10) > 32768) {
      return new Response(null, { status: 413 });
    }
    const body = (request.method !== 'GET' && request.method !== 'HEAD')
      ? await request.arrayBuffer()
      : undefined;

    const upstream = await fetchWithTimeout(upstreamUrl, {
      method: request.method,
      headers: {
        'content-type': request.headers.get('content-type') || 'application/json',
        'user-agent': request.headers.get('user-agent') || '',
        // Real visitor IP (Cloudflare injects cf-connecting-ip)
        'x-real-ip': request.headers.get('cf-connecting-ip') || '',
        'x-forwarded-for': request.headers.get('cf-connecting-ip') || '',
        // Which brand domain originated the event. Pinned to the canonical host
        // (not request.url) so a *.pages.dev preview can't pollute attribution.
        'x-brand-domain': 'daminiestate.ae',
        'referer': request.headers.get('referer') || '',
        'accept-encoding': request.headers.get('accept-encoding') || '',
      },
      body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': CORS_ORIGIN,
        'cache-control': 'no-store',
      },
    });
  } catch (_err) {
    // Silent 200, never block the page over a tracking failure.
    return new Response('{}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': CORS_ORIGIN,
      },
    });
  }
}
