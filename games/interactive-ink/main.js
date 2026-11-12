/*
 * Ink in Water — a small GPU fluid simulation (stable fluids).
 * No dependencies. Works from file:// by opening index.html.
 *
 * Pipeline per frame:
 *   curl -> vorticity confinement -> divergence -> pressure solve
 *   -> subtract pressure gradient -> advect velocity -> advect ink
 *
 * The ink texture stores colour x amount in RGB and amount in A, so the
 * colour you see is the weighted average of the inks present: whichever
 * ink there is MORE of dominates the mix.
 */
(function () {
  'use strict';

  // ---------- Tunable settings ----------
  var CONFIG = {
    SIM_RESOLUTION: 128,        // velocity grid (short side, in cells)
    DYE_RESOLUTION: 1024,       // ink grid (short side, in cells)
    INK_FADE: 0.12,             // how quickly ink dilutes (0 = never)
    VELOCITY_FADE: 0.35,        // how quickly water comes to rest
    PRESSURE_ITERATIONS: 20,
    CURL: 12,                   // swirl strength
    SPLAT_RADIUS: 0.22,         // brush size
    SPLAT_FORCE: 4000,          // how hard the pointer pushes the water
    INK_STRENGTH: 1.6,          // how much ink a stroke lays down at x1
    MAX_LEVEL: 10,              // most times a colour can be "loaded" by clicking it
    SPEED: 0.45                 // time scale (set by the Flow slider)
  };

  var canvas = document.getElementById('canvas');
  var hint = document.getElementById('hint');
  var errorBox = document.getElementById('error');

  // ---------- WebGL setup ----------
  var params = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
  var gl = canvas.getContext('webgl2', params);
  var isWebGL2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);

  if (!gl) return fail();

  var halfFloatType, internalFormat, filtering;
  if (isWebGL2) {
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_color_buffer_half_float');
    halfFloatType = gl.HALF_FLOAT;
    internalFormat = gl.RGBA16F;
    filtering = gl.LINEAR;
  } else {
    var hf = gl.getExtension('OES_texture_half_float');
    if (!hf) return fail();
    halfFloatType = hf.HALF_FLOAT_OES;
    internalFormat = gl.RGBA;
    filtering = gl.getExtension('OES_texture_half_float_linear') ? gl.LINEAR : gl.NEAREST;
  }

  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) CONFIG.DYE_RESOLUTION = 512;

  function fail() {
    errorBox.hidden = false;
    hint.hidden = true;
  }

  // ---------- Shaders ----------
  var VERT = [
    'precision highp float;',
    'attribute vec2 aPosition;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform vec2 texelSize;',
    'void main () {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  vL = vUv - vec2(texelSize.x, 0.0);',
    '  vR = vUv + vec2(texelSize.x, 0.0);',
    '  vT = vUv + vec2(0.0, texelSize.y);',
    '  vB = vUv - vec2(0.0, texelSize.y);',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n');

  var HEAD = 'precision highp float; precision highp sampler2D;\n' +
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n';

  var FRAG = {
    // Multiply a texture by a constant (used to damp pressure between frames).
    scale: HEAD + [
      'uniform sampler2D uTexture; uniform float value;',
      'void main () { gl_FragColor = value * texture2D(uTexture, vUv); }'
    ].join('\n'),

    // Add a soft round blob of colour (or force) at a point.
    splat: HEAD + [
      'uniform sampler2D uTarget; uniform float aspectRatio; uniform vec4 color;',
      'uniform vec2 point; uniform float radius;',
      'void main () {',
      '  vec2 p = vUv - point; p.x *= aspectRatio;',
      '  gl_FragColor = texture2D(uTarget, vUv) + exp(-dot(p, p) / radius) * color;',
      '}'
    ].join('\n'),

    // Carry a quantity along the velocity field.
    advection: HEAD + [
      'uniform sampler2D uVelocity; uniform sampler2D uSource;',
      'uniform vec2 texelSize; uniform float dt; uniform float dissipation;',
      'void main () {',
      '  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
      '  gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);',
      '}'
    ].join('\n'),

    divergence: HEAD + [
      'uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;',
      '  float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;',
      '  vec2 C = texture2D(uVelocity, vUv).xy;',
      '  if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; }',
      '  if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; }',
      '  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'),

    curl: HEAD + [
      'uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;',
      '  float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;',
      '  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'),

    // Re-inject the small swirls that the grid would otherwise smooth away.
    vorticity: HEAD + [
      'uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;',
      'void main () {',
      '  float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;',
      '  float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;',
      '  float C = texture2D(uCurl, vUv).x;',
      '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
      '  force /= length(force) + 0.0001;',
      '  force *= curl * C; force.y *= -1.0;',
      '  vec2 v = texture2D(uVelocity, vUv).xy + force * dt;',
      '  gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);',
      '}'
    ].join('\n'),

    pressure: HEAD + [
      'uniform sampler2D uPressure; uniform sampler2D uDivergence;',
      'void main () {',
      '  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;',
      '  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;',
      '  float d = texture2D(uDivergence, vUv).x;',
      '  gl_FragColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'),

    gradientSubtract: HEAD + [
      'uniform sampler2D uPressure; uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;',
      '  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;',
      '  vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);',
      '  gl_FragColor = vec4(v, 0.0, 1.0);',
      '}'
    ].join('\n'),

    // Water tinted by the average ink colour, more opaque where there is more ink.
    display: HEAD + [
      'uniform sampler2D uTexture;',
      'void main () {',
      '  vec4 ink = max(texture2D(uTexture, vUv), 0.0);',
      '  vec3 pigment = ink.rgb / max(ink.a, 0.0001);',
      '  float opacity = 1.0 - exp(-ink.a);',
      '  vec3 water = mix(vec3(0.90, 0.94, 0.95), vec3(0.97, 0.97, 0.94), vUv.y);',
      '  float d = distance(vUv, vec2(0.5));',
      '  water *= 1.0 - 0.10 * d * d;',
      '  gl_FragColor = vec4(water * mix(vec3(1.0), pigment, opacity), 1.0);',
      '}'
    ].join('\n')
  };

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  var vertexShader = compile(gl.VERTEX_SHADER, VERT);

  function createProgram(fragmentSource) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
    }
    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program: program, uniforms: uniforms };
  }

  var programs = {};
  Object.keys(FRAG).forEach(function (key) { programs[key] = createProgram(FRAG[key]); });

  // Full-screen quad
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function use(p) { gl.useProgram(p.program); return p.uniforms; }

  function blit(target) {
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ---------- Framebuffers ----------
  function createFBO(w, h, filter) {
    gl.activeTexture(gl.TEXTURE0);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, gl.RGBA, halfFloatType, null);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      texture: texture, fbo: fbo, width: w, height: h,
      texelX: 1 / w, texelY: 1 / h,
      attach: function (unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return unit;
      }
    };
  }

  function createDoubleFBO(w, h, filter) {
    var a = createFBO(w, h, filter);
    var b = createFBO(w, h, filter);
    return {
      width: w, height: h, texelX: 1 / w, texelY: 1 / h,
      read: a, write: b,
      swap: function () { var t = this.read; this.read = this.write; this.write = t; }
    };
  }

  function getResolution(base) {
    var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    var min = Math.round(base);
    var max = Math.round(base * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min }
      : { width: min, height: max };
  }

  var velocity, dye, pressure, divergence, curl;

  function initFramebuffers() {
    var sim = getResolution(CONFIG.SIM_RESOLUTION);
    var ink = getResolution(CONFIG.DYE_RESOLUTION);
    velocity = createDoubleFBO(sim.width, sim.height, filtering);
    dye = createDoubleFBO(ink.width, ink.height, filtering);
    pressure = createDoubleFBO(sim.width, sim.height, gl.NEAREST);
    divergence = createFBO(sim.width, sim.height, gl.NEAREST);
    curl = createFBO(sim.width, sim.height, gl.NEAREST);
  }

  function resizeCanvas() {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.floor(canvas.clientWidth * ratio);
    var h = Math.floor(canvas.clientHeight * ratio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  resizeCanvas();
  initFramebuffers();

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return fail();

  // ---------- Simulation ----------
  function step(dt) {
    var u;
    gl.disable(gl.BLEND);

    u = use(programs.curl);
    gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(curl);

    u = use(programs.vorticity);
    gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uCurl, curl.attach(1));
    gl.uniform1f(u.curl, CONFIG.CURL);
    gl.uniform1f(u.dt, dt);
    blit(velocity.write);
    velocity.swap();

    u = use(programs.divergence);
    gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    u = use(programs.scale);
    gl.uniform1i(u.uTexture, pressure.read.attach(0));
    gl.uniform1f(u.value, 0.8);
    blit(pressure.write);
    pressure.swap();

    u = use(programs.pressure);
    gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
    gl.uniform1i(u.uDivergence, divergence.attach(0));
    for (var i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(u.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    u = use(programs.gradientSubtract);
    gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
    gl.uniform1i(u.uPressure, pressure.read.attach(0));
    gl.uniform1i(u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    u = use(programs.advection);
    gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, velocity.read.attach(0));
    gl.uniform1f(u.dt, dt);
    gl.uniform1f(u.dissipation, CONFIG.VELOCITY_FADE);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, dye.read.attach(1));
    gl.uniform1f(u.dissipation, CONFIG.INK_FADE);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    var u = use(programs.display);
    gl.uniform2f(u.texelSize, dye.texelX, dye.texelY);
    gl.uniform1i(u.uTexture, dye.read.attach(0));
    blit(null);
  }

  // x, y in 0..1 (y up); dx, dy are the push; ink is [r*a, g*a, b*a, a] to add.
  function splat(x, y, dx, dy, ink) {
    var aspect = canvas.width / canvas.height;
    var radius = CONFIG.SPLAT_RADIUS / 100;
    if (aspect > 1) radius *= aspect;

    var u = use(programs.splat);
    gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
    gl.uniform1i(u.uTarget, velocity.read.attach(0));
    gl.uniform1f(u.aspectRatio, aspect);
    gl.uniform2f(u.point, x, y);
    gl.uniform4f(u.color, dx, dy, 0, 0);
    gl.uniform1f(u.radius, radius);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(u.uTarget, dye.read.attach(0));
    gl.uniform4f(u.color, ink[0], ink[1], ink[2], ink[3]);
    blit(dye.write);
    dye.swap();
  }

  function clearAll() {
    [velocity.read, velocity.write, dye.read, dye.write, pressure.read, pressure.write].forEach(function (t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.width, t.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
  }

  // ---------- Ink colour ----------
  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  // An amount of ink of a given colour, stored as colour x amount plus amount.
  function pigment(rgb, strength) {
    var a = CONFIG.INK_STRENGTH * strength;
    return [rgb[0] * a, rgb[1] * a, rgb[2] * a, a];
  }

  var inkColor = hexToRgb('#14161f');
  var inkLevel = 1;   // x1..x10: how much ink each stroke injects
  var swatches = Array.prototype.slice.call(document.querySelectorAll('.swatch'));
  var customInput = document.getElementById('custom');
  var customLabel = customInput.parentElement;

  function selectSwatch(el) {
    swatches.forEach(function (s) { s.classList.toggle('active', s === el); });
    customLabel.classList.toggle('active', el === customLabel);
  }

  function setLevel(el, level) {
    el.level = level;
    if (level > 1) el.dataset.level = '\u00d7' + level;
    else delete el.dataset.level;
    el.title = 'Amount \u00d7' + level + ' \u2014 click again to load more';
  }

  // Clicking a colour selects it; clicking it again loads more ink (x2, x3 ... x10)
  // so a light colour can overpower a dark one.
  swatches.forEach(function (el) {
    setLevel(el, 1);
    el.addEventListener('click', function () {
      if (el.classList.contains('active')) setLevel(el, Math.min(el.level + 1, CONFIG.MAX_LEVEL));
      inkColor = hexToRgb(el.dataset.color);
      inkLevel = el.level;
      selectSwatch(el);
    });
  });

  customInput.addEventListener('input', function () {
    inkColor = hexToRgb(customInput.value);
    inkLevel = 1;
    selectSwatch(customLabel);
  });

  document.getElementById('clear').addEventListener('click', function () {
    clearAll();
    swatches.forEach(function (el) { setLevel(el, 1); });
    inkLevel = 1;
  });

  var flow = document.getElementById('flow');
  flow.value = CONFIG.SPEED;
  flow.addEventListener('input', function () { CONFIG.SPEED = parseFloat(flow.value); });

  // ---------- Pointer input (mouse, touch, pen) ----------
  var clarityEngaged = false;
  function trackInkEngagement() {
    if (clarityEngaged) return;
    clarityEngaged = true;
    if (typeof window.clarity === 'function') {
      window.clarity('event', 'interactive-ink-engaged');
    }
  }

  var pointers = {};
  var queue = [];

  function position(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: 1 - (e.clientY - rect.top) / rect.height
    };
  }

  function hideHint() { hint.classList.add('hidden'); }

  canvas.addEventListener('pointerdown', function (e) {
    trackInkEngagement();
    var p = position(e);
    pointers[e.pointerId] = p;
    // A tap or click releases a drop of ink that blooms outward a little.
    var angle = Math.random() * Math.PI * 2;
    queue.push({ x: p.x, y: p.y, dx: Math.cos(angle) * 120, dy: Math.sin(angle) * 120, strength: 0.55 });
    hideHint();
  });

  canvas.addEventListener('pointermove', function (e) {
    var p = position(e);
    var prev = pointers[e.pointerId];
    pointers[e.pointerId] = p;
    if (!prev) return;

    var dx = p.x - prev.x;
    var dy = p.y - prev.y;
    var aspect = canvas.width / canvas.height;
    if (aspect < 1) dx *= aspect;
    if (aspect > 1) dy /= aspect;

    var speed = Math.sqrt(dx * dx + dy * dy);
    if (speed < 0.0004) return;

    queue.push({
      x: p.x, y: p.y,
      dx: dx * CONFIG.SPLAT_FORCE,
      dy: dy * CONFIG.SPLAT_FORCE,
      strength: Math.min(speed * 28, 0.5)
    });
    hideHint();
  });

  function release(e) { delete pointers[e.pointerId]; }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);

  // ---------- Opening flourish ----------
  function openingSplats() {
    var palette = ['#14161f', '#2b3a8f', '#c2283a', '#0f8f85', '#7a3fb0'];
    for (var i = 0; i < 5; i++) {
      var angle = Math.random() * Math.PI * 2;
      var force = 300 + Math.random() * 500;
      splat(
        0.2 + Math.random() * 0.6,
        0.3 + Math.random() * 0.5,
        Math.cos(angle) * force,
        Math.sin(angle) * force,
        pigment(hexToRgb(palette[i]), 0.6)
      );
    }
  }

  // ---------- Main loop ----------
  var last = performance.now();

  function frame(now) {
    var dt = Math.min((now - last) / 1000, 1 / 60);
    last = now;

    if (resizeCanvas()) initFramebuffers();

    while (queue.length) {
      var s = queue.shift();
      splat(s.x, s.y, s.dx, s.dy, pigment(inkColor, s.strength * inkLevel));
    }

    step(dt * CONFIG.SPEED);
    render();
    requestAnimationFrame(frame);
  }

  openingSplats();
  requestAnimationFrame(frame);
})();
