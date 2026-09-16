/**
 * Cloudflare Pages Function: GET /api/geo
 *
 * Tells /tracking.js whether this visitor must opt in before any analytics or
 * marketing script loads. Opt-in applies where the law requires consent for
 * non-essential cookies and tracking: the EU and EEA (GDPR + ePrivacy), the UK,
 * its Crown Dependencies and Gibraltar (UK GDPR + PECR), the EU's outermost
 * regions that carry their own country codes, and the European microstates with
 * GDPR-style laws. Everyone else is tracked by default and can opt out under
 * "Cookie settings" in the footer.
 *
 * Cloudflare resolves the country at the edge (request.cf.country, with the
 * cf-ipcountry header as fallback; no lookup, no latency). Unknown (XX)
 * and Tor (T1) count as opt-in: better to ask one extra visitor than to track
 * someone in the EU without consent.
 *
 * Returns only the flags. Never the country, city or IP.
 */

const OPT_IN = new Set([
  // EU 27
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  // EEA
  'IS', 'LI', 'NO',
  // UK, Crown Dependencies, Gibraltar
  'GB', 'GG', 'JE', 'IM', 'GI',
  // Åland and EU outermost regions with their own ISO codes
  'AX', 'GF', 'GP', 'MQ', 'MF', 'RE', 'YT',
  // European microstates with GDPR-style laws
  'AD', 'MC', 'SM', 'VA',
  // Unknown, Tor
  'XX', 'T1',
]);

export function onRequestGet({ request }) {
  const country = String((request.cf && request.cf.country) || request.headers.get('cf-ipcountry') || 'XX').toUpperCase();
  // `known` only says whether Cloudflare resolved a country, so a zone without
  // IP geolocation (everyone XX, everyone asked first) is visible from outside.
  return new Response(JSON.stringify({ optIn: OPT_IN.has(country), known: country !== 'XX' }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
