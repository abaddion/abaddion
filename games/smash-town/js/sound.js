/*
 * Sounds, synthesised with Web Audio so no audio files are needed.
 */
(function () {
  'use strict';

  var ac = null, master = null, noise = null, engine = null;
  var muted = false, lastCrash = 0;

  function ready() {
    if (ac) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Engine: a low hum that rises with speed.
    var osc = ac.createOscillator(), filter = ac.createBiquadFilter(), gain = ac.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = 45;
    filter.type = 'lowpass'; filter.frequency.value = 260;
    gain.gain.value = 0;
    osc.connect(filter); filter.connect(gain); gain.connect(master);
    osc.start();
    engine = { osc: osc, gain: gain };
    return true;
  }

  function tone(type, f0, f1, dur, vol, delay) {
    var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (delay || 0);
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function burst(filterType, f0, f1, dur, vol) {
    var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
    src.buffer = noise;
    f.type = filterType;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  Smash.Sound = {
    unlock: function () { if (ready() && ac.state === 'suspended') ac.resume(); },

    setMuted: function (m) {
      muted = m;
      if (ac) master.gain.setTargetAtTime(m ? 0 : 0.6, ac.currentTime, 0.05);
    },

    crash: function (blocks) {           // more blocks = bigger crunch
      if (!ready() || ac.currentTime - lastCrash < 0.09) return;
      lastCrash = ac.currentTime;
      var size = Math.min(1, 0.4 + blocks * 0.12);
      burst('lowpass', 1400, 180, 0.28, 0.5 * size);
      tone('sine', 130, 45, 0.22, 0.4 * size);
    },

    splat: function () {
      if (!ready()) return;
      burst('bandpass', 1300, 260, 0.22, 0.4);
      tone('sine', 420, 110, 0.2, 0.25);
    },

    skid: function () { if (ready()) burst('highpass', 2600, 1800, 0.55, 0.12); },

    caught: function () {                // a silly "wah wah waah"
      if (!ready()) return;
      tone('triangle', 440, 415, 0.22, 0.25, 0);
      tone('triangle', 370, 349, 0.22, 0.25, 0.22);
      tone('triangle', 311, 233, 0.5, 0.25, 0.44);
    },

    gulp: function () {                  // the monster swallows the car
      if (!ready()) return;
      tone('sine', 320, 90, 0.18, 0.35, 0);
      tone('sine', 260, 70, 0.22, 0.35, 0.2);
    },

    spit: function () {                  // ...and spits it back out
      if (!ready()) return;
      tone('sine', 180, 720, 0.16, 0.3, 0);
      burst('highpass', 1800, 3200, 0.12, 0.15);
    },

    beep: function () {                  // little horn when the colour changes
      if (!ready()) return;
      tone('triangle', 392, 392, 0.16, 0.2, 0);
      tone('triangle', 494, 494, 0.22, 0.2, 0.14);
    },

    engine: function (speed) {           // speed from 0 to 1
      if (!engine) return;
      engine.osc.frequency.setTargetAtTime(45 + speed * 75, ac.currentTime, 0.1);
      engine.gain.gain.setTargetAtTime(0.02 + speed * 0.05, ac.currentTime, 0.1);
    }
  };
})();
