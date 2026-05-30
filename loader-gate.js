/* Loader gate — runs synchronously in <head> before first paint.
   Adds `loaded` to <html> (which hides #loader via CSS) when the intro should
   be skipped: repeat navigation within the same visit, or reduced-motion. */
(function () {
  try {
    var d = document.documentElement;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = !!sessionStorage.getItem('dmn_loaded'); } catch (e) {}
    if (reduce || seen) d.classList.add('loaded');
  } catch (e) {
    document.documentElement.classList.add('loaded');
  }
})();
