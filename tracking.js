/* ==========================================================================
   Damini Estate tracking + consent. The ONE place every analytics and
   marketing script is loaded from. Same-origin (CSP-safe), loaded
   synchronously in <head> so Yandex starts as early as possible.

   Who is tracked (Phil, 2026-09-16: track as much as the law allows)
     - Outside the EU/EEA/UK: everything loads immediately, no banner. Visitors
       can switch it off under "Cookie settings" in the footer. Do Not Track and
       Global Privacy Control are deliberately NOT honoured.
     - EU/EEA/UK and similar (GDPR, ePrivacy/PECR): nothing loads until the
       visitor accepts. Opt-in if EITHER /api/geo says so (IP country) OR the
       device timezone is European. If /api/geo fails, the timezone decides.
     - OPT_IN_EVERYWHERE = true asks every visitor first (for example once the
       UAE PDPL executive regulations take effect).

   Categories
     analytics  Yandex Metrica (counter 111868041, Session Replay + field recording)
     marketing  GHL page tracking, GHL chat widget (+ its attribution session and
                Cloudflare Turnstile), Orevida first-party pixel (/pixel.js)

   Storage: localStorage "dmn_consent" = {v, pv, analytics, marketing, ts}.
   The region is cached per tab in sessionStorage "dmn_optin".
   Forms call window.dmnTrack.goal(name, {email, lead}) after a successful submit.
   Every host a tracker needs must also be in the CSP in _headers.
   ========================================================================== */
(function () {
  'use strict';

  var OPT_IN_EVERYWHERE = false;
  var POLICY_VERSION = '2026-09-16';   // bump after a material privacy policy change to re-ask opt-in regions
  var STORE = 'dmn_consent';
  var REGION = 'dmn_optin';

  var YM_ID = 111868041;
  var ORE_KEY = 'ORE-P4PQEYRF2T9D';
  var GHL_TRACKING_ID = 'tk_68deebfd17d04ed685918c04c98c3e17';
  var GHL_WIDGET_ID = '6a1c59831ce15bb9e9f15747';

  /* ── Region ─────────────────────────────────────────────────────────── */
  // Europe/* counts as opt-in unless listed here as outside the EU/EEA/UK.
  var TZ_OUTSIDE = ['Europe/Moscow', 'Europe/Minsk', 'Europe/Kiev', 'Europe/Kyiv', 'Europe/Uzhgorod',
    'Europe/Zaporozhye', 'Europe/Simferopol', 'Europe/Chisinau', 'Europe/Tiraspol', 'Europe/Istanbul',
    'Europe/Belgrade', 'Europe/Sarajevo', 'Europe/Skopje', 'Europe/Podgorica', 'Europe/Tirane',
    'Europe/Kaliningrad', 'Europe/Samara', 'Europe/Volgograd', 'Europe/Saratov', 'Europe/Ulyanovsk',
    'Europe/Astrakhan', 'Europe/Kirov', 'Europe/Zurich'];
  // EU/EEA territories whose timezone is not under Europe/*.
  var TZ_OPT_IN = ['Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Reykjavik',
    'Atlantic/Faroe', 'Arctic/Longyearbyen', 'Africa/Ceuta', 'Asia/Nicosia', 'Asia/Famagusta',
    'America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'America/Marigot',
    'Indian/Reunion', 'Indian/Mayotte'];

  function europeanTimezone() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (tz.indexOf('Europe/') === 0) return TZ_OUTSIDE.indexOf(tz) === -1;
    return TZ_OPT_IN.indexOf(tz) !== -1;
  }

  function region(cb) {
    if (OPT_IN_EVERYWHERE || europeanTimezone()) return cb(true);
    var cached = null;
    try { cached = sessionStorage.getItem(REGION); } catch (e) {}
    if (cached === '1' || cached === '0') return cb(cached === '1');
    var settled = false;
    function done(optIn, cache) {
      if (settled) return;
      settled = true;
      if (cache) { try { sessionStorage.setItem(REGION, optIn ? '1' : '0'); } catch (e) {} }
      cb(optIn);
    }
    var timer = setTimeout(function () { done(false, false); }, 2500);
    try {
      fetch('/api/geo', { credentials: 'omit', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { clearTimeout(timer); if (d && typeof d.optIn === 'boolean') done(d.optIn, true); else done(false, false); })
        .catch(function () { clearTimeout(timer); done(false, false); });
    } catch (e) { clearTimeout(timer); done(false, false); }
  }

  /* ── Choice ─────────────────────────────────────────────────────────── */
  var state = { optIn: null, choice: readChoice(), loaded: { analytics: false, marketing: false } };

  function readChoice() {
    try {
      var c = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (c && c.v === 1) return c;
    } catch (e) {}
    return null;
  }

  function saveChoice(analytics, marketing) {
    var c = { v: 1, pv: POLICY_VERSION, analytics: !!analytics, marketing: !!marketing, ts: new Date().toISOString() };
    try { localStorage.setItem(STORE, JSON.stringify(c)); } catch (e) {}
    return c;
  }

  // null = undecided (opt-in region without a current choice): show the banner.
  function effective() {
    var c = state.choice;
    if (state.optIn) return (c && c.pv === POLICY_VERSION) ? c : null;
    return c || { analytics: true, marketing: true };
  }

  /* ── Loaders ────────────────────────────────────────────────────────── */
  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function addScript(src, attrs) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.body.appendChild(s);
  }

  function loadAnalytics() {
    // Yandex's official counter snippet, unchanged.
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=' + YM_ID, 'ym');
    window.ym(YM_ID, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
  }

  function loadMarketing() {
    // Orevida pixel, first-party via functions/pixel.js.js (brand key read from this src).
    addScript('/pixel.js?b=' + ORE_KEY);
    // GHL page + form tracking.
    addScript('https://link.msgsndr.com/js/external-tracking.js', { 'data-tracking-id': GHL_TRACKING_ID });
    // GHL chat widget. Loads its own attribution session and Cloudflare Turnstile.
    addScript('https://beta.leadconnectorhq.com/loader.js', {
      'data-resources-url': 'https://beta.leadconnectorhq.com/chat-widget/loader.js',
      'data-widget-id': GHL_WIDGET_ID
    });
  }

  function load(e) {
    if (!e) return;
    try {
      if (e.analytics && !state.loaded.analytics) { state.loaded.analytics = true; loadAnalytics(); }
    } catch (err) { /* never break the page over analytics */ }
    if (e.marketing && !state.loaded.marketing) {
      state.loaded.marketing = true;
      whenReady(function () { try { loadMarketing(); } catch (err) {} });
    }
  }

  // Best effort after an opt-out: drop the first-party cookies and storage of the
  // categories being switched off (names measured 2026-09-16), then reload so the
  // running scripts stop. Third-party cookies on yandex.* cannot be removed from here.
  var TRACES = {
    analytics: { cookie: /^_ym/, storage: /^_ym/ },
    marketing: {
      cookie: /^(lc_session_|_ore_)/,
      storage: /^(_ore|v\d+_(contact_session|history|session_history|first_session_event)_)|lead-connecter-text-widget/
    }
  };
  function clearTraces(category) {
    var t = TRACES[category];
    var host = location.hostname.replace(/^www\./, '');
    document.cookie.split(';').forEach(function (part) {
      var name = part.split('=')[0].trim();
      if (!name || !t.cookie.test(name)) return;
      ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
    try {
      Object.keys(localStorage).forEach(function (k) { if (t.storage.test(k)) localStorage.removeItem(k); });
    } catch (e) {}
  }

  /* ── UI: banner, settings dialog, footer link ───────────────────────── */
  var banner, dialog, lastFocus;

  function showBanner() {
    whenReady(function () {
      banner = banner || document.getElementById('consentBanner');
      if (banner) banner.hidden = false;
    });
  }

  function hideBanner() {
    banner = banner || document.getElementById('consentBanner');
    if (banner) banner.hidden = true;
  }

  function openSettings() {
    dialog = dialog || document.getElementById('consentDialog');
    if (!dialog) return;
    var e = effective() || { analytics: false, marketing: false };
    var a = dialog.querySelector('input[name="analytics"]');
    var m = dialog.querySelector('input[name="marketing"]');
    if (a) a.checked = !!e.analytics;
    if (m) m.checked = !!e.marketing;
    lastFocus = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeSettings() {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function setChoice(analytics, marketing) {
    var stopAnalytics = state.loaded.analytics && !analytics;
    var stopMarketing = state.loaded.marketing && !marketing;
    state.choice = saveChoice(analytics, marketing);
    hideBanner();
    closeSettings();
    if (stopAnalytics || stopMarketing) {
      if (stopAnalytics) clearTraces('analytics');
      if (stopMarketing) clearTraces('marketing');
      location.reload();
      return;
    }
    load(effective());
  }

  whenReady(function () {
    banner = document.getElementById('consentBanner');
    dialog = document.getElementById('consentDialog');
    if (dialog) {
      dialog.addEventListener('close', function () {
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      });
    }
    document.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-consent], [data-consent-open]') : null;
      if (!t) return;
      if (t.hasAttribute('data-consent-open')) { ev.preventDefault(); openSettings(); return; }
      var action = t.getAttribute('data-consent');
      if (action === 'accept') setChoice(true, true);
      else if (action === 'reject') setChoice(false, false);
      else if (action === 'close') closeSettings();
      else if (action === 'save' && dialog) {
        var a = dialog.querySelector('input[name="analytics"]');
        var m = dialog.querySelector('input[name="marketing"]');
        setChoice(!!(a && a.checked), !!(m && m.checked));
      }
    });
  });

  /* ── Conversions ────────────────────────────────────────────────────── */
  window.dmnTrack = {
    // name: Yandex goal id (create it in Metrica as a "JavaScript event" goal).
    goal: function (name, opts) {
      if (!name) return;
      opts = opts || {};
      try { if (typeof window.ym === 'function') window.ym(YM_ID, 'reachGoal', name); } catch (e) {}
      try {
        if (typeof window.ore === 'function') {
          if (opts.lead) window.ore('lead', { type: name, email: opts.email || undefined });
          else window.ore('track', name, {});
        }
      } catch (e) {}
    }
  };

  /* ── Start ──────────────────────────────────────────────────────────── */
  region(function (optIn) {
    state.optIn = optIn;
    var e = effective();
    if (e) load(e);
    else showBanner();
  });
})();
