/** POST /api/csp-report: sink for CSP violation reports the browser sends (report-uri).
 *  Returns 204 so reports never 404. Keep it cheap; upgrade to log/forward if needed. */
export async function onRequestPost() {
  return new Response(null, { status: 204 });
}
export const onRequest = () => new Response(null, { status: 204 });
