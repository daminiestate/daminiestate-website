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
 * Cloudflare sets cf-ipcountry at the edge (no lookup, no latency). Unknown (XX)
 * and Tor (T1) count as opt-in: better to ask one extra visitor than to track
 * someone in the EU without consent.
 *
 * Returns ONLY the flag. Never the country, city or IP.
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
  const country = (request.headers.get('cf-ipcountry') || 'XX').toUpperCase();
  return new Response(JSON.stringify({ optIn: OPT_IN.has(country) }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
