/**
 * GHL external-tracking loader, gated on Do-Not-Track / Global-Privacy-Control.
 *
 * The LeadConnector page-view tracker (link.msgsndr.com/js/external-tracking.js)
 * is analytics, so per the Orevida build standard it must NOT load when the
 * visitor signals DNT or GPC. We inject the vendor script only when no such
 * signal is present. Served same-origin so the strict CSP (script-src 'self')
 * needs no exception; the injected vendor origin is already allowlisted.
 *
 * Loaded with `defer`, so the DOM is ready and document.body exists.
 */
(function () {
  'use strict';
  try {
    var nav = navigator || {};
    var dnt = nav.doNotTrack || window.doNotTrack || nav.msDoNotTrack;
    var optedOut = dnt === '1' || dnt === 'yes' || nav.globalPrivacyControl === true;
    if (optedOut) return; // respect the visitor's privacy signal

    if (document.querySelector('script[data-tracking-id="tk_68deebfd17d04ed685918c04c98c3e17"]')) return;
    var s = document.createElement('script');
    s.src = 'https://link.msgsndr.com/js/external-tracking.js';
    s.setAttribute('data-tracking-id', 'tk_68deebfd17d04ed685918c04c98c3e17');
    s.async = true;
    document.body.appendChild(s);
  } catch (e) { /* never break the page over tracking */ }
})();
