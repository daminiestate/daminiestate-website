/**
 * Cloudflare Pages Function: GET /pixel.js
 *
 * First-party delivery of the Orevida Network Pixel for daminiestate.ae.
 *
 * Why first-party: ad blockers (uBlock, Brave, Pi-hole) block third-party
 * requests to orevida.com / t.orevida.com. Serving the pixel from the site's
 * own domain (/pixel.js) and routing events through /t/* (same origin) bypasses
 * these blocks — the customer's own domain is never on a blocklist.
 *
 * How it works:
 *   1. We fetch the canonical pixel from orevida.com/pixel.js (edge-cached 1h).
 *   2. We PREPEND a tiny rewrite shim that patches fetch / XMLHttpRequest /
 *      navigator.sendBeacon so the pixel's hard-coded "https://t.orevida.com/net"
 *      and "/net/batch" calls are rewritten to the same-origin "/t/net" and
 *      "/t/net/batch". The /t/[[path]].js function then proxies them server-side
 *      to t.orevida.com (see that file).
 *   3. The brand key is supplied by the page's <script src="/pixel.js?b=ORE-...">
 *      tag — the canonical pixel reads it from its own currentScript.src.
 *
 * CSP: because the shim is delivered INSIDE this same-origin .js file (not an
 * inline <script>), the strict CSP (script-src 'self') needs no exception, and
 * events go to '/t' (connect-src 'self'). No t.orevida.com in the CSP at all.
 *
 * GDPR: daminiestate.ae is a UAE business and the site has no consent banner, so
 * the pixel is loaded WITHOUT ?gdpr=1 and tracks immediately (same as Orevida's
 * own UAE properties). To consent-gate later, add gdpr=1 to the upstream URL and
 * the page tag, and the pixel self-gates on the orevida_consent cookie.
 */

const BRAND_KEY = 'ORE-9F44XXTH7N4K'; // Damini Estate — brands.api_key (db: ogla)
const UPSTREAM = `https://orevida.com/pixel.js?b=${BRAND_KEY}`;

// Rewrite shim — patches the three transports the pixel uses so every
// t.orevida.com call becomes same-origin /t/*. Hostname-guarded to the live
// domains so it never rewrites on *.pages.dev previews or localhost.
const SHIM = `(function(){try{var H=location.hostname;if(H!=="daminiestate.ae"&&H!=="www.daminiestate.ae")return;function R(u){return typeof u==="string"&&u.indexOf("t.orevida.com")>-1?"/t"+(u.split("t.orevida.com")[1]||""):u;}var f=window.fetch;if(f)window.fetch=function(u,o){try{u=R(u);}catch(e){}return f.call(this,u,o);};var xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=R(u);}catch(e){}return xo.apply(this,arguments);};if(navigator.sendBeacon){var sb=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){try{u=R(u);}catch(e){}return sb(u,d);};}}catch(e){}})();\n`;

const NOOP = '/* orevida pixel unavailable */';

function jsResponse(body, cacheable) {
  return new Response(body, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': cacheable
        ? 'public, max-age=1800, stale-while-revalidate=60'
        : 'no-store',
    },
  });
}

export async function onRequestGet() {
  try {
    const res = await fetch(UPSTREAM, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!res.ok) {
      console.error('[pixel.js] upstream error:', res.status);
      return jsResponse(NOOP, false);
    }
    const body = await res.text();
    return jsResponse(SHIM + body, true);
  } catch (err) {
    console.error('[pixel.js] fetch error:', err);
    return jsResponse(NOOP, false);
  }
}

/** Only handle GET — reject everything else. */
export function onRequest({ request }) {
  if (request.method === 'GET') return onRequestGet();
  return new Response('Method Not Allowed', { status: 405 });
}
