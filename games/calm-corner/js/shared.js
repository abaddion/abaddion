/*
 * Shared helpers used by every game:
 *   Games  registry — each game file adds  Games.name = function (ctx) { ... }
 *   Util   small 3D helpers
 *   Sound  soft sounds synthesised with Web Audio (no audio files needed)
 */
(function () {
  'use strict';

  window.Games = {};

  // ---------------------------------------------------------------- Util
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  window.Util = {
    rand: function (a, b) { return a + Math.random() * (b - a); },

    // Vertical gradient as a texture. Colours are listed top to bottom.
    gradient: function (colours) {
      var c = document.createElement('canvas');
      c.width = 4; c.height = 256;
      var g = c.getContext('2d');
      var grad = g.createLinearGradient(0, 0, 0, 256);
      colours.forEach(function (col, i) { grad.addColorStop(i / (colours.length - 1), col); });
      g.fillStyle = grad;
      g.fillRect(0, 0, 4, 256);
      var tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    },

    // Soft round glow, for stars and sparkles.
    glow: function (inner, outer) {
      var c = document.createElement('canvas');
      c.width = c.height = 128;
      var g = c.getContext('2d');
      var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, inner || 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, outer || 'rgba(255,240,200,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    },

    // A ray from the camera through the pointer.
    ray: function (p, camera) {
      ndc.set(p.nx, p.ny);
      raycaster.setFromCamera(ndc, camera);
      return raycaster;
    },

    // Where the pointer's ray meets a plane (returns null if it misses).
    onPlane: function (p, camera, plane) {
      var hit = new THREE.Vector3();
      return Util.ray(p, camera).ray.intersectPlane(plane, hit) ? hit : null;
    }
  };

  // --------------------------------------------------------------- Sound
  var ac = null, master = null, noise = null;
  var VOLUME = 0.5;
  // A pentatonic scale: any notes played together sound pleasant.
  var NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

  function ready() {
    if (ac) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = VOLUME;
    master.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(type, f0, f1, dur, vol) {
    var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noiseLoop(filterType, freq, q, vol) {
    var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; src.loop = true;
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + 1.5);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
    return {
      filter: f, gain: g,
      stop: function () {
        g.gain.cancelScheduledValues(ac.currentTime);
        g.gain.setTargetAtTime(0, ac.currentTime, 0.2);
        setTimeout(function () { try { src.stop(); } catch (e) {} }, 1200);
      }
    };
  }

  window.Sound = {
    // Browsers only allow sound after a touch, so call this from a tap.
    unlock: function () { if (ready() && ac.state === 'suspended') ac.resume(); },

    pop: function (size) {           // bigger bubble = lower pop
      if (!ready()) return;
      var f = 520 / Math.max(0.5, size || 1);
      tone('sine', f, f * 0.35, 0.13, 0.22);
    },

    chime: function (step) {
      if (!ready()) return;
      var f = NOTES[Math.max(0, Math.min(NOTES.length - 1, Math.round(step)))];
      tone('sine', f, f, 2.4, 0.2);
      tone('sine', f * 2, f * 2, 1.2, 0.05);
    },

    plop: function () {
      if (!ready()) return;
      tone('sine', Util.rand(300, 380), 95, 0.2, 0.26);
    },

    rain: function () {
      if (!ready()) return { stop: function () {} };
      var a = noiseLoop('bandpass', 2200, 0.4, 0.1);
      var b = noiseLoop('lowpass', 320, 0.2, 0.16);
      return { stop: function () { a.stop(); b.stop(); } };
    },

    // A soft "whoosh" whose loudness and brightness follow the breath.
    breath: function () {
      if (!ready()) return { set: function () {}, stop: function () {} };
      var n = noiseLoop('bandpass', 500, 0.9, 0.0001);
      return {
        set: function (level, bright) {
          n.gain.gain.setTargetAtTime(level * 0.12, ac.currentTime, 0.15);
          n.filter.frequency.setTargetAtTime(350 + bright * 500, ac.currentTime, 0.2);
        },
        stop: n.stop
      };
    }
  };
})();
