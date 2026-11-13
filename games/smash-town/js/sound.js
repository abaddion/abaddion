/*
 * Sounds, synthesised with Web Audio so no audio files are needed.
 */
(function () {
  'use strict';

  var ac = null, master = null, noise = null, engine = null, sirenOsc = null, sirenGain = null;
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

    engine: function (speed) {
      if (!engine) return;
      var base = engine._pitch || 1;
      engine.osc.frequency.setTargetAtTime((45 + speed * 75) * base, ac.currentTime, 0.1);
      engine.gain.gain.setTargetAtTime(0.02 + speed * 0.05, ac.currentTime, 0.1);
    },

    enginePitch: function (mult) {
      if (engine) engine._pitch = mult || 1;
    },

    swapPuff: function () {
      if (!ready()) return;
      burst('lowpass', 400, 120, 0.14, 0.22);
    },

    siren: function (on) {
      if (!ready()) return;
      if (on) {
        if (!sirenOsc) {
          sirenOsc = ac.createOscillator();
          sirenGain = ac.createGain();
          sirenOsc.type = 'triangle';
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenGain.gain.value = 0;
          sirenOsc.start();
        }
        sirenGain.gain.setTargetAtTime(0.14, ac.currentTime, 0.05);
        var t = ac.currentTime;
        sirenOsc.frequency.setValueAtTime(520, t);
        sirenOsc.frequency.linearRampToValueAtTime(760, t + 0.35);
        sirenOsc.frequency.linearRampToValueAtTime(520, t + 0.7);
      } else if (sirenGain) {
        sirenGain.gain.setTargetAtTime(0, ac.currentTime, 0.08);
      }
    },

    hornFor: function (typeId) {
      if (!ready()) return;
      if (typeId === 'monster') tone('square', 120, 80, 0.25, 0.28);
      else if (typeId === 'race') tone('triangle', 520, 620, 0.12, 0.22);
      else if (typeId === 'bulldozer') tone('sawtooth', 95, 70, 0.3, 0.2);
      else if (typeId === 'fire') tone('triangle', 440, 520, 0.2, 0.22);
      else if (typeId === 'dump') tone('sine', 180, 120, 0.28, 0.22);
      else this.beep();
    },

    splash: function () {
      if (!ready()) return;
      burst('bandpass', 420, 180, 0.18, 0.28);
      tone('sine', 220, 90, 0.2, 0.22);
    },

    treeCrack: function () {
      if (!ready()) return;
      burst('highpass', 800, 220, 0.15, 0.32);
      tone('triangle', 160, 55, 0.2, 0.2);
    },

    rockTumble: function () {
      if (!ready()) return;
      burst('lowpass', 600, 140, 0.22, 0.25);
    },

    setZoneAmbience: function (zone) {
      if (!engine) return;
      var base = zone === 'forest' ? 38 : zone === 'mountains' ? 42 : zone === 'river' ? 40 : 45;
      engine.osc.frequency.setTargetAtTime(base, ac.currentTime, 0.35);
    }
  };
})();
