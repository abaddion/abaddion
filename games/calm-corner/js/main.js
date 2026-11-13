/*
 * App shell: menu, one shared 3D renderer, pointer input, hold-to-go-back.
 *
 * Every game is a function that receives ctx and returns:
 *   { scene, camera, update(dt, t), down(p), move(p), up(p), resize(w, h), dispose() }
 * (only scene, camera and update are required).
 * A pointer p is { x, y } in pixels and { nx, ny } from -1..1 (y up).
 */
(function () {
  'use strict';

  var HOLD_TO_EXIT = 0.8;   // seconds the home button must be held

  var canvas = document.getElementById('stage');
  var home = document.getElementById('home');
  var back = document.getElementById('back');

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  var ctx = { renderer: renderer, canvas: canvas, width: 1, height: 1, aspect: 1 };
  var current = null;
  var clarityPlayed = false;

  function resize() {
    ctx.width = window.innerWidth;
    ctx.height = window.innerHeight;
    ctx.aspect = ctx.width / ctx.height;
    renderer.setSize(ctx.width, ctx.height, false);
    if (!current) return;
    if (current.camera.isPerspectiveCamera) {
      current.camera.aspect = ctx.aspect;
      current.camera.updateProjectionMatrix();
    }
    if (current.resize) current.resize(ctx.width, ctx.height);
  }

  function stop() {
    if (!current) return;
    if (current.dispose) current.dispose();
    current.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      var m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach(function (x) { if (x.map) x.map.dispose(); x.dispose(); });
    });
    current = null;
  }

  function start(name) {
    if (!Games[name]) return;
    if (!clarityPlayed && typeof window.clarity === 'function') {
      clarityPlayed = true;
      window.clarity('event', 'calm-corner-play');
    }
    stop();
    Sound.unlock();
    current = Games[name](ctx);
    home.hidden = true;
    back.hidden = false;
    resize();
    history.replaceState(null, '', '#' + name);
  }

  function goHome() {
    stop();
    home.hidden = false;
    back.hidden = true;
    history.replaceState(null, '', location.pathname + location.search);
  }

  home.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) start(b.dataset.game);
  });

  // ---------- Hold to go back ----------
  var holdStart = 0;
  function holdBegin(e) { e.preventDefault(); holdStart = performance.now(); }
  function holdEnd() { holdStart = 0; back.style.setProperty('--hold', 0); }
  back.addEventListener('pointerdown', holdBegin);
  back.addEventListener('pointerup', holdEnd);
  back.addEventListener('pointerleave', holdEnd);
  back.addEventListener('pointercancel', holdEnd);
  back.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') goHome(); });
  back.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- Pointer input ----------
  function point(e) {
    return {
      id: e.pointerId, x: e.clientX, y: e.clientY,
      nx: (e.clientX / ctx.width) * 2 - 1,
      ny: -(e.clientY / ctx.height) * 2 + 1
    };
  }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.unlock();
    if (current && current.down) current.down(point(e));
  });
  canvas.addEventListener('pointermove', function (e) {
    if (current && current.move) current.move(point(e), e.buttons > 0 || e.pointerType !== 'mouse');
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
    canvas.addEventListener(type, function (e) { if (current && current.up) current.up(point(e)); });
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('resize', resize);

  // ---------- Main loop ----------
  var last = performance.now(), time = 0;
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    time += dt;

    if (holdStart) {
      var held = (now - holdStart) / 1000 / HOLD_TO_EXIT;
      back.style.setProperty('--hold', Math.min(held, 1));
      if (held >= 1) { holdEnd(); goHome(); }
    }

    if (current) {
      current.update(dt, time);
      renderer.render(current.scene, current.camera);
    }
    requestAnimationFrame(frame);
  }

  resize();
  if (location.hash) start(location.hash.slice(1));   // e.g. index.html#pond opens a game directly
  requestAnimationFrame(frame);
})();
