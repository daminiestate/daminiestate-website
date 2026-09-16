/* ==========================================================================
   Damini Estate tracking + consent. The ONE place every analytics and
   marketing script is loaded from. Same-origin (CSP-safe), loaded
   synchronously in <head> so Yandex starts as early as possible.

   Who is tracked (Phil, 2026-09-16: track as much as the law allows)
     - Outside the EU/EEA/UK: everything loads immediately, no banner. Visitors
       can switch it off under "Cookie settings" in the footer. Do Not Track and
       Global Privacy Control are deliberately NOT honoured.
     - EU/EEA/UK, a few neighbouring European territories, unknown locations
       (GDPR, ePrivacy/PECR): nothing loads until the visitor accepts. Opt-in if
       EITHER /api/geo says so (IP country) OR the device timezone is European.
     - If /api/geo errors, nothing loads and no banner shows on that page; the
       next page asks again. A slow answer is still waited for.
     - OPT_IN_EVERYWHERE = true asks every visitor first (for example once the
       UAE PDPL executive regulations take effect).

   Categories
     analytics  Yandex Metrica (counter 111868041, Session Replay + field recording)
     marketing  GHL page tracking, GHL chat widget (+ its attribution session and
                Cloudflare Turnstile), Orevida first-party pixel (/pixel.js), and
                the UTM/click-id capture in main.js (via dmnTrack.whenAllowed)

   Storage: localStorage "dmn_consent" = {v, pv, r, analytics, marketing, ts}.
     r = 1 when the choice was made with the switches unticked (opt-in rules).
     Opt-in regions only honour r = 1 choices, or a full reject, so a pre-ticked
     save made outside the EU never counts as EU consent.
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

  /* ── Opt-out guard ──────────────────────────────────────────────────────
     Registered before any tracker, so these capture listeners run first. Once
     an opt-out is being applied, the trackers' own unload/hide handlers (which
     would send one more event and recreate their ids) are stopped. */
  var halted = false;
  function guard(ev) { if (halted) ev.stopImmediatePropagation(); }
  ['beforeunload', 'pagehide', 'unload', 'visibilitychange'].forEach(function (t) { window.addEventListener(t, guard, true); });

  /* ── Region ─────────────────────────────────────────────────────────── */
  // Europe/* counts as opt-in unless listed here as outside the EU/EEA/UK.
  var TZ_OUTSIDE = ['Europe/Moscow', 'Europe/Minsk', 'Europe/Kiev', 'Europe/Kyiv', 'Europe/Uzhgorod',
    'Europe/Zaporozhye', 'Europe/Simferopol', 'Europe/Chisinau', 'Europe/Tiraspol', 'Europe/Istanbul',
    'Europe/Belgrade', 'Europe/Sarajevo', 'Europe/Skopje', 'Europe/Podgorica', 'Europe/Tirane',
    'Europe/Kaliningrad', 'Europe/Samara', 'Europe/Volgograd', 'Europe/Saratov', 'Europe/Ulyanovsk',
    'Europe/Astrakhan', 'Europe/Kirov', 'Europe/Zurich'];
  // European territories (EU/EEA and a few neighbours) whose timezone is not under Europe/*.
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

  // Calls cb(optIn) once the region is known. Never calls it if /api/geo errors.
  function region(cb) {
    if (OPT_IN_EVERYWHERE || europeanTimezone()) return cb(true);
    var cached = null;
    try { cached = sessionStorage.getItem(REGION); } catch (e) {}
    if (cached === '1' || cached === '0') return cb(cached === '1');
    try {
      fetch('/api/geo', { credentials: 'omit', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || typeof d.optIn !== 'boolean') return;
          try { sessionStorage.setItem(REGION, d.optIn ? '1' : '0'); } catch (e) {}
          cb(d.optIn);
        })
        .catch(function () {});
    } catch (e) {}
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
    var c = { v: 1, pv: POLICY_VERSION, r: state.optIn === false ? 0 : 1,
      analytics: !!analytics, marketing: !!marketing, ts: new Date().toISOString() };
    try { localStorage.setItem(STORE, JSON.stringify(c)); } catch (e) {}
    return c;
  }

  // A choice that is valid under opt-in rules, or null.
  function optInChoice() {
    var c = state.choice;
    if (!c || c.pv !== POLICY_VERSION) return null;
    return (c.r === 1 || (!c.analytics && !c.marketing)) ? c : null;
  }

  // What may run now. null = undecided (banner) or region unknown (nothing).
  function effective() {
    if (state.optIn === null) return null;
    if (state.optIn) return optInChoice();
    return state.choice || { analytics: true, marketing: true };
  }

  function allowed(category) {
    var e = effective();
    return !!(e && e[category]);
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

  var waiters = { analytics: [], marketing: [] };

  function run(e) {
    if (!e) return;
    try {
      if (e.analytics && !state.loaded.analytics) { state.loaded.analytics = true; loadAnalytics(); }
    } catch (err) { /* never break the page over analytics */ }
    if (e.marketing && !state.loaded.marketing) {
      state.loaded.marketing = true;
      whenReady(function () { try { loadMarketing(); } catch (err) {} });
    }
    ['analytics', 'marketing'].forEach(function (cat) {
      if (!e[cat] || !waiters[cat].length) return;
      var queue = waiters[cat];
      waiters[cat] = [];
      queue.forEach(function (fn) { whenReady(function () { try { fn(); } catch (err) {} }); });
    });
  }

  // First-party cookies and storage per category (names measured 2026-09-16).
  // Third-party cookies on yandex.* etc. cannot be removed from here.
  var TRACES = {
    analytics: { cookie: /^_ym/, storage: /^_ym/ },
    marketing: {
      cookie: /^(lc_session_|_ore_)/,
      storage: /^(_ore|ore_sid|_ud$|lc_session_|dmn_attr$|v\d+_(contact_session|history|session_history|first_session_event)_)|lead-connecter-text-widget/
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
    [window.localStorage, window.sessionStorage].forEach(function (store) {
      try { Object.keys(store).forEach(function (k) { if (t.storage.test(k)) store.removeItem(k); }); } catch (e) {}
    });
  }

  // Apply the current choice: clean up what is off, stop the page if something
  // that is running got switched off, otherwise start what is allowed.
  function apply() {
    if (state.optIn === null) return;
    var e = effective();
    if (!e) { showBanner(); return; }
    hideBanner();
    if (!e.analytics) clearTraces('analytics');
    if (!e.marketing) clearTraces('marketing');
    if ((state.loaded.analytics && !e.analytics) || (state.loaded.marketing && !e.marketing)) {
      halted = true;
      location.reload();
      return;
    }
    run(e);
  }

  /* ── UI: banner, settings dialog, footer link ───────────────────────── */
  var banner, dialog, lastFocus;
  function el(id) { return document.getElementById(id); }

  function showBanner() {
    whenReady(function () {
      banner = banner || el('consentBanner');
      if (!banner || !banner.hidden) return;
      banner.hidden = false;
      // Keep keyboard focus from sliding under the fixed banner (WCAG 2.4.11).
      document.documentElement.style.scrollPaddingBottom = (banner.offsetHeight + 24) + 'px';
    });
  }

  function hideBanner() {
    banner = banner || el('consentBanner');
    if (!banner || banner.hidden) return;
    banner.hidden = true;
    document.documentElement.style.scrollPaddingBottom = '';
  }

  function openSettings() {
    dialog = dialog || el('consentDialog');
    if (!dialog) return;
    // Opt-in rules (or region not known yet): switches start from a valid
    // opt-in choice or unticked, never pre-ticked.
    var e = state.optIn === false ? effective() : (optInChoice() || { analytics: false, marketing: false });
    var a = dialog.querySelector('input[name="analytics"]');
    var m = dialog.querySelector('input[name="marketing"]');
    if (a) a.checked = !!e.analytics;
    if (m) m.checked = !!e.marketing;
    lastFocus = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeSettings() {
    dialog = dialog || el('consentDialog');
    if (!dialog || !dialog.open) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  // Send focus back where it came from, or to <main> if that is now hidden.
  function restoreFocus() {
    var t = lastFocus;
    var gone = !t || !document.contains(t) || (banner && banner.hidden && banner.contains(t)) || (dialog && dialog.contains(t));
    if (gone) {
      t = el('main');
      if (t && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    }
    lastFocus = null;
    if (t && typeof t.focus === 'function') { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }

  function setChoice(analytics, marketing) {
    var active = document.activeElement;
    var fromUi = !!active && ((banner && banner.contains(active)) || (dialog && dialog.contains(active)));
    if (!lastFocus && fromUi) lastFocus = active;
    state.choice = saveChoice(analytics, marketing);
    closeSettings();
    apply();
    if (!halted && fromUi) restoreFocus();
  }

  // Another tab changed the choice, or the page came back from the bfcache.
  function recheck() {
    var fresh = readChoice();
    if (JSON.stringify(fresh) === JSON.stringify(state.choice)) return;
    state.choice = fresh;
    apply();
  }
  window.addEventListener('storage', function (ev) { if (ev.key === STORE) recheck(); });
  window.addEventListener('pageshow', function (ev) { if (ev.persisted) recheck(); });

  whenReady(function () {
    banner = el('consentBanner');
    dialog = el('consentDialog');
    if (dialog) dialog.addEventListener('close', function () { if (lastFocus) restoreFocus(); });
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

  /* ── API for main.js ────────────────────────────────────────────────── */
  window.dmnTrack = {
    // Run fn now if the category is allowed, or as soon as it becomes allowed.
    whenAllowed: function (category, fn) {
      if (allowed(category)) whenReady(function () { try { fn(); } catch (e) {} });
      else if (waiters[category]) waiters[category].push(fn);
    },
    // name: Yandex goal id (create it in Metrica as a "JavaScript event" goal).
    goal: function (name, opts) {
      if (!name) return;
      opts = opts || {};
      try { if (allowed('analytics') && typeof window.ym === 'function') window.ym(YM_ID, 'reachGoal', name); } catch (e) {}
      try {
        if (allowed('marketing') && typeof window.ore === 'function') {
          if (opts.lead) window.ore('lead', { type: name, email: opts.email || undefined });
          else window.ore('track', name, {});
        }
      } catch (e) {}
    }
  };

  /* ── Start ──────────────────────────────────────────────────────────── */
  region(function (optIn) {
    state.optIn = optIn;
    apply();
  });
})();
