/**
 * Kid-friendly play mode for static games under /games/*.
 *
 * Limits (honest): in normal mobile Safari you cannot fully disable the OS edge
 * back-swipe or the home gesture. Fullscreen + “Add to Home Screen” (manifest)
 * removes most browser chrome; this script adds wake lock, overscroll guards,
 * and an optional back-swipe buffer.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var guardBack = !script || script.getAttribute('data-guard-back') !== '0';
  var showFullscreen = !script || script.getAttribute('data-fullscreen-button') !== '0';

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function requestFs() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return Promise.reject(new Error('fullscreen unsupported'));
    return Promise.resolve(req.call(el));
  }

  function exitFs() {
    var ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (!ex || !isFullscreen()) return Promise.resolve();
    return Promise.resolve(ex.call(document));
  }

  function toggleFs() {
    return isFullscreen() ? exitFs() : requestFs();
  }

  var wakeLock = null;
  async function enableWakeLock() {
    try {
      if (!('wakeLock' in navigator) || wakeLock) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', function () {
        wakeLock = null;
      });
    } catch (_) {
      /* ignore — low battery, unsupported, etc. */
    }
  }

  async function rewake() {
    if (document.visibilityState === 'visible') await enableWakeLock();
  }

  function guardHistory() {
    if (!guardBack || !window.history || !history.pushState) return;
    history.pushState({ kiosk: 1 }, '');
    window.addEventListener('popstate', function () {
      history.pushState({ kiosk: 1 }, '');
    });
  }

  function guardOverscroll() {
    document.addEventListener(
      'touchmove',
      function (e) {
        if (e.touches.length > 1) {
          if (e.cancelable) e.preventDefault();
          return;
        }
        var t = e.target;
        if (t && t.closest && t.closest('input, textarea, select, button, [contenteditable="true"]')) return;
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );
  }

  function addFullscreenButton() {
    if (!showFullscreen) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'kiosk-fs';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Full screen (for parents)');
    btn.textContent = 'Full screen';

    function sync() {
      var on = isFullscreen();
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Exit full' : 'Full screen';
    }

    btn.addEventListener('click', function () {
      toggleFs()
        .then(function () {
          sync();
          return enableWakeLock();
        })
        .catch(function () {
          /* iOS often needs a play gesture first; still try wake lock */
          enableWakeLock();
        });
    });

    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    document.body.appendChild(btn);
    sync();
  }

  function onFirstPlay() {
    enableWakeLock();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('kiosk-locked');
    guardHistory();
    guardOverscroll();
    addFullscreenButton();
    document.addEventListener('visibilitychange', rewake);
    document.addEventListener('pointerdown', onFirstPlay, { once: true, capture: true });
  });
})();
