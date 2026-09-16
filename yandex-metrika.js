/**
 * Yandex Metrica loader (counter 111868041), gated on Do-Not-Track / Global-Privacy-Control.
 *
 * Same pattern as ghl-tracking.js: served same-origin so the strict CSP needs no
 * inline-script exception, and skipped entirely when the visitor signals DNT or
 * GPC (Orevida build standard, and what /privacy promises). Inside the gate is
 * Yandex's official counter snippet, unchanged.
 *
 * Session Replay on this counter records form field contents (field recording is
 * on in the counter settings), and Yandex's own detection masks only fields it
 * recognises as private. So every input and textarea holding personal data MUST
 * carry class="ym-disable-keys": that class is what masks it. It also keeps those
 * fields out of Yandex's hashed contact collection.
 *
 * CSP hosts it needs are listed in _headers. Loaded synchronously in <head>.
 */
(function () {
  'use strict';
  try {
    var nav = navigator || {};
    var dnt = nav.doNotTrack || window.doNotTrack || nav.msDoNotTrack;
    if (dnt === '1' || dnt === 'yes' || nav.globalPrivacyControl === true) return;

    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=111868041', 'ym');

    window.ym(111868041, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
  } catch (e) { /* never break the page over analytics */ }
})();
