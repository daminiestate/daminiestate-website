/* ==========================================================================
   Damini Estate site interactivity
   Vanilla JS, no dependencies. Defer-loaded. CSP-safe (no inline handlers).
   ========================================================================== */
(function () {
  'use strict';

  /* Intro loader is handled entirely by /loader-gate.js (gate + removal) and
     the inline <head> styles, so it never depends on this cached file. */

  /* ── Nav: solid on scroll ─────────────────────────────────────────────── */
  var nav = document.getElementById('siteNav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('solid', window.scrollY > 60); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Mobile nav drawer (accessible) ───────────────────────────────────── */
  var toggle = document.getElementById('navToggle');
  var drawer = document.getElementById('mobileNav');
  var closeBtn = document.getElementById('mobileClose');
  function openDrawer() {
    if (!drawer) return;
    drawer.hidden = false;
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    var first = drawer.querySelector('a, button');
    if (first) first.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.hidden = true;
    if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
    document.body.style.overflow = '';
  }
  if (toggle) toggle.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (drawer) {
    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeDrawer();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
    });
  }

  /* ── Footer year ──────────────────────────────────────────────────────── */
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ── Reveal on scroll ─────────────────────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); ro.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ── Animated stat counters ───────────────────────────────────────────── */
  function animateStats() {
    var stats = [
      { id: 'stat1', target: 250, prefix: 'AED ', suffix: 'M+', duration: 2000 },
      { id: 'stat2', target: 500, prefix: '', suffix: '+', duration: 2200 },
      { id: 'stat3', target: 100, prefix: '', suffix: '+', duration: 1800 }
    ];
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    stats.forEach(function (s) {
      var el = document.getElementById(s.id);
      if (!el) return;
      if (reduce) { el.textContent = s.prefix + s.target + s.suffix; return; }
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / s.duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = s.prefix + Math.floor(eased * s.target) + s.suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = s.prefix + s.target + s.suffix;
      }
      requestAnimationFrame(step);
    });
  }
  var statsBar = document.querySelector('.stats-bar');
  if (statsBar && 'IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { animateStats(); so.disconnect(); } });
    }, { threshold: 0.3 });
    so.observe(statsBar);
  }

  /* ── EN / RU language toggle ──────────────────────────────────────────── */
  var SUPPORTED = ['en', 'ru'];
  function applyLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'en';
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-en], [data-ru]').forEach(function (el) {
      var v = el.getAttribute('data-' + lang);
      if (v != null) el.innerHTML = v;
    });
    document.querySelectorAll('[data-en-ph], [data-ru-ph]').forEach(function (el) {
      var v = el.getAttribute('data-' + lang + '-ph');
      if (v != null) el.placeholder = v;
    });
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.textContent = lang === 'en' ? 'RU' : 'EN';
      b.setAttribute('aria-label', lang === 'en' ? 'Switch to Russian' : 'Переключить на английский');
    });
    try { localStorage.setItem('damini-lang', lang); } catch (e) {}
  }
  var saved;
  try { saved = localStorage.getItem('damini-lang'); } catch (e) {}
  if (saved && saved !== 'en') applyLang(saved);
  document.querySelectorAll('.lang-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      applyLang(document.documentElement.lang === 'en' ? 'ru' : 'en');
    });
  });

  /* ── Investor calculators ─────────────────────────────────────────────── */
  function val(id) { var el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; }
  function fmt(n) { if (!isFinite(n)) n = 0; return 'AED ' + Math.round(n).toLocaleString('en-US'); }
  function fmtPct(n) { if (!isFinite(n)) n = 0; return n.toFixed(2) + '%'; }
  function setOut(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  function setResults(main, rows) {
    setOut('res-main', main);
    for (var i = 0; i < 3; i++) {
      var row = document.getElementById('res-row-' + (i + 2));
      if (!row) continue;
      var lbl = row.querySelector('.calc-result-label');
      var vEl = row.querySelector('.calc-result-value');
      if (rows[i]) { if (lbl) lbl.textContent = rows[i].label; if (vEl) vEl.textContent = rows[i].val; row.style.display = ''; }
      else { row.style.display = 'none'; }
    }
  }

  function calcMortgage() {
    var price = val('m-price') || 0;
    var dp = (val('m-dp') || 0) / 100;
    var rate = (val('m-rate') || 0) / 100 / 12;
    var term = (val('m-term') || 0) * 12;
    var loan = price * (1 - dp);
    var monthly = term === 0 ? 0 : (rate === 0 ? loan / term : loan * rate * Math.pow(1 + rate, term) / (Math.pow(1 + rate, term) - 1));
    var totalPaid = monthly * term;
    setResults(fmt(monthly), [
      { label: 'Loan Amount', val: fmt(loan) },
      { label: 'Total Interest', val: fmt(totalPaid - loan) },
      { label: 'Total Cost', val: fmt(totalPaid + price * dp) }
    ]);
  }
  function calcYield() {
    var value = val('y-value') || 1;
    var rent = val('y-rent') || 0;
    var vac = (val('y-vac') || 0) / 100;
    var costs = val('y-costs') || 0;
    var grossAnnual = rent * 12;
    var eff = grossAnnual * (1 - vac);
    var net = eff - costs;
    setResults(fmtPct((net / value) * 100), [
      { label: 'Gross Rental Yield', val: fmtPct((grossAnnual / value) * 100) },
      { label: 'Net Annual Income', val: fmt(net) },
      { label: 'Monthly Income (eff.)', val: fmt(eff / 12) }
    ]);
  }
  function calcROI() {
    var price = val('r-price') || 1;
    var income = val('r-income') || 0;
    var expenses = val('r-expenses') || 0;
    var growth = (val('r-growth') || 0) / 100;
    var net = income - expenses;
    var cashROI = (net / price) * 100;
    setResults(fmtPct(cashROI + growth * 100), [
      { label: 'Cash-on-Cash ROI', val: fmtPct(cashROI) },
      { label: 'Net Annual Income', val: fmt(net) },
      { label: '5-Year Est. Value', val: fmt(price * Math.pow(1 + growth, 5)) }
    ]);
  }
  function calcService() {
    var sqft = val('s-sqft') || 0;
    var rate = val('s-rate') || 0;
    var mult = val('s-type') || 1;
    var annual = sqft * rate * mult;
    setResults(fmt(annual / 12), [
      { label: 'Annual Service Charge', val: fmt(annual) },
      { label: 'Rate per sqft', val: 'AED ' + (rate * mult).toFixed(2) },
      { label: 'Property Size', val: sqft.toLocaleString('en-US') + ' sqft' }
    ]);
  }
  var CALCS = { mortgage: calcMortgage, rental: calcYield, roi: calcROI, service: calcService };

  // Live slider value displays
  function bindRange(id, outId, fn) {
    var el = document.getElementById(id), out = document.getElementById(outId);
    if (!el) return;
    el.addEventListener('input', function () { if (out) out.textContent = el.value + fn(); });
  }
  bindRange('m-dp', 'm-dp-val', function () { return '%'; });
  bindRange('m-rate', 'm-rate-val', function () { return '%'; });
  bindRange('m-term', 'm-term-val', function () { return ' yrs'; });
  bindRange('r-growth', 'r-growth-val', function () { return '%'; });
  bindRange('y-vac', 'y-vac-val', function () { return '%'; });

  // Recompute active calculator on any input change
  var calcWrap = document.querySelector('.calc-wrap');
  function activeTab() {
    var t = document.querySelector('.calc-tab.active');
    return t ? t.getAttribute('data-calc') : 'mortgage';
  }
  if (calcWrap) {
    calcWrap.addEventListener('input', function () { var fn = CALCS[activeTab()]; if (fn) fn(); });
    document.querySelectorAll('.calc-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-calc');
        document.querySelectorAll('.calc-panel').forEach(function (p) { p.classList.remove('active'); p.hidden = true; });
        document.querySelectorAll('.calc-tab').forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        var panel = document.getElementById('panel-' + tab);
        if (panel) { panel.classList.add('active'); panel.hidden = false; }
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        if (CALCS[tab]) CALCS[tab]();
      });
    });
    if (CALCS[activeTab()]) CALCS[activeTab()]();
  }

  /* ── AJAX forms → Cloudflare Functions (GHL) ──────────────────────────── */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  document.querySelectorAll('form[data-ajax]').forEach(function (form) {
    var msg = form.querySelector('.form-msg');
    var btn = form.querySelector('button[type="submit"]');
    var btnText = btn ? btn.textContent : '';
    function show(type, text) {
      if (!msg) return;
      msg.className = 'form-msg show ' + type;
      msg.textContent = text;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // Honeypot
      var hp = form.querySelector('input[name="website"]');
      if (hp && hp.value) { show('ok', form.getAttribute('data-ok') || 'Thank you.'); form.reset(); return; }
      var email = form.querySelector('input[type="email"]');
      if (email && !EMAIL_RE.test(email.value)) {
        email.setAttribute('aria-invalid', 'true');
        if (msg) email.setAttribute('aria-describedby', msg.id || (msg.id = 'form-msg-' + Math.random().toString(36).slice(2, 8)));
        show('err', 'Please enter a valid email address.');
        email.focus();
        return;
      }
      if (email) email.removeAttribute('aria-invalid');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (d) {
          if (d && d.ok) { show('ok', form.getAttribute('data-ok') || 'Thank you. We will be in touch shortly.'); form.reset(); }
          else { show('err', form.getAttribute('data-err') || 'Something went wrong. Please try again or WhatsApp us.'); }
        })
        .catch(function () { show('err', form.getAttribute('data-err') || 'Network error. Please try again or WhatsApp us.'); })
        .finally(function () { if (btn) { btn.disabled = false; btn.textContent = btnText; } });
    });
  });

  /* ── FAQ accordion ────────────────────────────────────────────────────── */
  document.querySelectorAll('.faq-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var expanded = q.getAttribute('aria-expanded') === 'true';
      q.setAttribute('aria-expanded', String(!expanded));
      var a = q.nextElementSibling;
      if (a) a.style.maxHeight = expanded ? '0' : a.scrollHeight + 'px';
    });
  });

  /* ── Attribution capture (UTM/click IDs) ─────────────────────────────────
     Capture on first landing, PERSIST in sessionStorage so the values survive
     internal navigation (a visitor rarely lands and converts on the same page),
     then inject into every lead form. Matches the Orevida capture-and-forward
     standard so attribution is never dropped on internal nav. */
  try {
    var STORE = 'dmn_attr';
    var map = {
      h_utm_source: 'utm_source', h_utm_medium: 'utm_medium', h_utm_campaign: 'utm_campaign',
      h_utm_content: 'utm_content', h_utm_term: 'utm_term',
      h_fbclid: 'fbclid', h_gclid: 'gclid', h_ttclid: 'ttclid', h_msclkid: 'msclkid', h_li_fat_id: 'li_fat_id'
    };

    // Load any previously-stored attribution for this session.
    var attr = {};
    try { attr = JSON.parse(sessionStorage.getItem(STORE) || '{}') || {}; } catch (e) { attr = {}; }

    // Merge in anything present in the current URL (first-touch wins: don't
    // overwrite a value already captured earlier this session).
    var qs = new URLSearchParams(location.search);
    var changed = false;
    Object.keys(map).forEach(function (field) {
      var v = qs.get(map[field]);
      if (v && !attr[field]) { attr[field] = v.slice(0, 256); changed = true; }
    });
    if (changed) { try { sessionStorage.setItem(STORE, JSON.stringify(attr)); } catch (e) {} }

    // Inject whatever we have (URL + persisted) into every lead form.
    function applyAttr() {
      document.querySelectorAll('form[data-ajax]').forEach(function (form) {
        Object.keys(attr).forEach(function (field) {
          if (!attr[field] || form.querySelector('[name="' + field + '"]')) return;
          var inp = document.createElement('input');
          inp.type = 'hidden'; inp.name = field; inp.value = attr[field];
          form.appendChild(inp);
        });
      });
    }
    applyAttr();
  } catch (e) {}
})();
