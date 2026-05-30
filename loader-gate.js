/* Intro loader controller — first-party, CSP-safe, self-contained.
   Loaded synchronously in <head> so it can gate the loader before first paint.
   It is fully responsible for the loader (gate + removal) and does NOT depend on
   styles.css or main.js, so a stale cached copy of those can never trap the page.
   A pure-CSS safety animation (in the inline <head> styles) also auto-hides the
   loader after 4s even if this script fails entirely. */
(function () {
  var d = document.documentElement;

  // ── Gate: skip the intro on repeat pages (same visit) or reduced motion ──
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = !!sessionStorage.getItem('dmn_loaded'); } catch (e) {}
    if (reduce || seen) { d.classList.add('loaded'); return; }
  } catch (e) {
    d.classList.add('loaded');
    return;
  }

  // ── First arrival: reveal the site when it's actually ready ──
  var done = false;
  function reveal() {
    if (done) return;
    done = true;
    try { sessionStorage.setItem('dmn_loaded', '1'); } catch (e) {}
    var l = document.getElementById('loader');
    if (!l) return;
    l.classList.add('loader-hide');
    setTimeout(function () { if (l && l.parentNode) l.parentNode.removeChild(l); }, 700);
  }

  var MIN = 500;            // let the wordmark register briefly
  var start = Date.now();
  function ready() {
    var waited = Date.now() - start;
    if (waited >= MIN) reveal();
    else setTimeout(reveal, MIN - waited);
  }

  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });

  setTimeout(reveal, 3500); // JS safety cap (CSS also auto-hides at 4s)
})();
