/*
 * Sand Chat — replies are written in sand that rises from the seabed.
 * No dependencies. Works from file:// by opening index.html. Needs WebGL2.
 *
 * Everything runs on the GPU:
 *   1. WATER   a fluid simulation (the same kind as the ink demo). The mouse
 *              or a finger pushes the water; nothing touches the sand directly.
 *   2. SAND    about a million grains. Each grain's position and velocity live
 *              in a texture and are updated by a shader every frame. Grains
 *              sink, are dragged along by the water, get lifted off the seabed
 *              by fast currents, and settle again.
 *   3. TEXT    grains chosen for a reply are pulled by a spring to their place
 *              in the letters. A strong enough current tears them loose.
 *   4. LIGHT   the water, light shafts, caustics and seabed are one shader.
 */
(function () {
  'use strict';

  // ---------- Tunable settings ----------
  var CONFIG = {
    GRAIN_TEX: 1024,          // grains = GRAIN_TEX x GRAIN_TEX (1024 -> ~1 million; 1448 -> ~2 million)
    TEXT_GRAINS: 220000,      // most grains one reply may use
    POINT_SIZE: 1.3,          // grain size in CSS pixels

    SIM_RESOLUTION: 160,      // water grid (short side, in cells)
    PRESSURE_ITERATIONS: 18,
    CURL: 14,                 // how much the water swirls
    WATER_FADE: 0.7,          // how quickly the water comes to rest
    POINTER_FORCE: 5000,      // how hard the pointer pushes the water
    POINTER_RADIUS: 0.3,      // size of the push

    SINK: 0.9,                // how fast grains sink
    DRAG: 5.0,                // how strongly water carries grains along
    LIFT: 12.0,               // how easily a current lifts grains off the seabed
    SPRING: 18.0,             // pull of the letters on their grains
    DAMPING: 7.5,
    KNOCK: 0.05,              // water speed that tears a grain out of the text
    HEAL: 0,                  // seconds until torn text rebuilds itself (0 = never)

    FLOOR: 0.24,              // seabed height, as a share of the screen
    SAND_DEPTH: 0.075,        // thickness of the loose sand layer
    CRUMBLE_TIME: 1.0,        // seconds for the old reply to fall apart
    MAX_CHARS: 240            // longer replies are cut so the letters stay readable
  };

  var canvas = document.getElementById('canvas');
  var form = document.getElementById('chat');
  var input = document.getElementById('message');
  var youLine = document.getElementById('you');
  var replyText = document.getElementById('reply-text');
  var errorBox = document.getElementById('error');

  var mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile) { CONFIG.GRAIN_TEX = 512; CONFIG.TEXT_GRAINS = 90000; CONFIG.SIM_RESOLUTION = 110; }
  var override = /[?&]grains=(\d+)/.exec(location.search);   // e.g. index.html?grains=512
  if (override) CONFIG.GRAIN_TEX = Math.max(64, Math.min(2048, parseInt(override[1], 10)));

  var G = CONFIG.GRAIN_TEX;
  var N = G * G;

  // ====================================================================
  // Replies
  // ====================================================================
  // Replies come from Gemini through /api/sand-chat (see api/sand-chat.js), which keeps
  // the API key on the server. The scripted lines below are only a fallback:
  // they are used when the page is opened as a plain file, or if the request fails.
  var RULES = [
    { match: /\b(hi|hello|hey|ahoj|good (morning|evening))\b/i,
      replies: ['Hello. I rose from the seabed to meet you.', 'Hi there. Mind the current.'] },
    { match: /\b(who|what) are you\b|your name/i,
      replies: ['I am a voice written in sand. I never look the same twice.'] },
    { match: /how are you|how do you feel/i,
      replies: ['Settled, mostly. A little scattered around the edges.'] },
    { match: /\b(sand|grain|beach|dune)/i,
      replies: ['Every grain here was once a mountain. Be patient with small things.'] },
    { match: /\b(sea|ocean|water|wave|tide|fish)/i,
      replies: ['The water carries every word away in the end. I do not mind.'] },
    { match: /\b(love|heart|miss)\b/i,
      replies: ['Even the tide comes back. Give it time.'] },
    { match: /\b(sad|tired|lonely|afraid|worried)\b/i,
      replies: ['Rest here a moment. Nothing on the seabed is in a hurry.'] },
    { match: /\b(thanks|thank you|dakujem|diky)\b/i,
      replies: ['You are welcome. Come back before the tide changes.'] },
    { match: /\b(bye|goodbye|see you|good night)\b/i,
      replies: ['Goodbye. I will be sand again until you return.'] },
    { match: /\b(help|what can you do)\b/i,
      replies: ['Write to me and I will answer. Stir the water and I fall apart.'] },
    { match: /\?\s*$/,
      replies: ['A fair question. Ask the tide; it has been here longer than I have.',
                'I only know what the current tells me, and it says: maybe.'] }
  ];

  var FALLBACK = [
    'Tell me more. I have nothing but time and sand.',
    'I heard that, even down here.',
    'Interesting. Let me turn that over like a shell.',
    'Say it again tomorrow and I will answer differently.'
  ];
  var fallbackIndex = 0;

  function scriptedReply(message) {
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].match.test(message)) {
        var list = RULES[i].replies;
        return list[Math.floor(Math.random() * list.length)];
      }
    }
    return FALLBACK[fallbackIndex++ % FALLBACK.length];
  }

  // pastMessages already ends with the message being sent.
  function getReply(message, pastMessages) {
    if (location.protocol === 'file:') return Promise.resolve(scriptedReply(message));

    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);

    return fetch('/api/sand-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, history: pastMessages.slice(0, -1).slice(-10) }),
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) throw new Error('chat request failed: ' + response.status);
      return response.json();
    }).then(function (data) {
      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('empty reply');
      }
      return data.reply;
    }).catch(function (err) {
      console.warn('Sand chat API failed:', err.message);
      if (location.protocol === 'file:') return scriptedReply(message);
      return 'The tide is quiet. I could not reach the surface — try again in a moment.';
    }).finally(function () {
      clearTimeout(timeout);
    });
  }

  // ====================================================================
  // WebGL setup
  // ====================================================================
  var gl = canvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
    errorBox.hidden = false;
    form.hidden = true;
    return;
  }

  // ---------- Shared shader code ----------
  // The seabed shape, the caustic light pattern and the water colour are used
  // by both the background and the grains, so they always agree.
  var COMMON = [
    'uniform float uAspect;',
    'uniform float uFloor;',
    'float floorH(float x) {',
    '  float a = x * uAspect;',
    '  return uFloor + 0.014 * sin(a * 4.1 + 0.6) + 0.007 * sin(a * 9.7 + 2.1) + 0.003 * sin(a * 23.0);',
    '}',
    'float caustic(vec2 p, float t) {',
    '  float c = 0.0;',
    '  vec2 q = p;',
    '  for (int i = 0; i < 3; i++) {',
    '    q = mat2(1.2, 0.9, -0.9, 1.2) * q + vec2(t * 0.13, -t * 0.09);',
    '    q += 0.45 * sin(q.yx * 1.3 + t * 0.4);',
    '    float w = sin(q.x) + sin(q.y);',
    '    c += pow(1.0 - 0.5 * abs(w), 5.0);',
    '  }',
    '  return c / 3.0;',
    '}',
    'vec3 waterColor(float y) {',
    '  vec3 deep = vec3(0.012, 0.10, 0.19);',
    '  vec3 mid = vec3(0.03, 0.33, 0.47);',
    '  vec3 top = vec3(0.22, 0.68, 0.78);',
    '  return y < 0.55 ? mix(deep, mid, smoothstep(0.0, 0.55, y)) : mix(mid, top, smoothstep(0.55, 1.0, y));',
    '}'
  ].join('\n');

  // ---------- Water simulation shaders (same method as the ink demo) ----------
  var FLUID_VERT = [
    'precision highp float;',
    'attribute vec2 aPosition;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform vec2 texelSize;',
    'void main () {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);',
    '  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FH = 'precision highp float; precision highp sampler2D;\n' +
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n';

  var FLUID = {
    scale: FH + [
      'uniform sampler2D uTexture; uniform float value;',
      'void main () { gl_FragColor = value * texture2D(uTexture, vUv); }'
    ].join('\n'),
    splat: FH + [
      'uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color;',
      'uniform vec2 point; uniform float radius;',
      'void main () {',
      '  vec2 p = vUv - point; p.x *= aspectRatio;',
      '  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.0);',
      '}'
    ].join('\n'),
    advection: FH + [
      'uniform sampler2D uVelocity; uniform sampler2D uSource;',
      'uniform vec2 texelSize; uniform float dt; uniform float dissipation;',
      'void main () {',
      '  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
      '  gl_FragColor = vec4(texture2D(uSource, coord).xyz / (1.0 + dissipation * dt), 1.0);',
      '}'
    ].join('\n'),
    divergence: FH + [
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
    curl: FH + [
      'uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;',
      '  float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;',
      '  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'),
    vorticity: FH + [
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
    pressure: FH + [
      'uniform sampler2D uPressure; uniform sampler2D uDivergence;',
      'void main () {',
      '  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;',
      '  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;',
      '  gl_FragColor = vec4((L + R + B + T - texture2D(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'),
    gradientSubtract: FH + [
      'uniform sampler2D uPressure; uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;',
      '  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;',
      '  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);',
      '}'
    ].join('\n')
  };

  // ---------- Full-screen quad (GLSL ES 3) ----------
  var QUAD_VERT = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 aPosition;',
    'out vec2 vUv;',
    'void main () { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }'
  ].join('\n');

  // ---------- Grain physics: one pixel of the state texture = one grain ----------
  var GRAIN_UPDATE = [
    '#version 300 es',
    'precision highp float; precision highp sampler2D;',
    'in vec2 vUv;',
    'layout(location = 0) out vec4 oPos;     // xy = position, zw = velocity',
    'layout(location = 1) out vec4 oState;   // x = message it was torn from, y = when',
    'uniform sampler2D uPos; uniform sampler2D uState; uniform sampler2D uSeed;',
    'uniform sampler2D uTarget; uniform sampler2D uVelocity;',
    'uniform vec2 uSimTexel;',
    'uniform float uTime; uniform float uDt; uniform float uMsg; uniform float uReleaseAt;',
    'uniform float uSink; uniform float uDrag; uniform float uLift; uniform float uSpring;',
    'uniform float uDamp; uniform float uKnock; uniform float uHeal; uniform float uSandDepth;',
    COMMON,
    'void main () {',
    '  ivec2 tc = ivec2(gl_FragCoord.xy);',
    '  vec4 P = texelFetch(uPos, tc, 0);',
    '  vec4 S = texelFetch(uState, tc, 0);',
    '  vec4 seed = texelFetch(uSeed, tc, 0);',
    '  vec4 T = texelFetch(uTarget, tc, 0);      // xy = place in text, z = in text?, w = start time',
    '  vec2 pos = P.xy; vec2 vel = P.zw;',
    '',
    '  // Water velocity at this grain, plus a slow ambient current.',
    '  vec2 water = texture(uVelocity, pos).xy * uSimTexel;',
    '  water.x += 0.012 * sin(uTime * 0.31 + pos.y * 7.0);',
    '',
    '  float torn = S.x; float tornAt = S.y;',
    '  if (uHeal > 0.0 && torn == uMsg && uTime - tornAt > uHeal) torn = -1.0;',
    '',
    '  bool held = T.z > 0.5 && uTime >= T.w && torn != uMsg',
    '           && uTime < uReleaseAt + T.x * 0.6 + seed.z * 0.35;',
    '',
    '  // A strong current tears a grain out of the letters.',
    '  if (held && length(water) > uKnock && distance(pos, T.xy) < 0.03) {',
    '    held = false; torn = uMsg; tornAt = uTime;',
    '    vel += water * 0.8;',
    '  }',
    '',
    '  if (held) {',
    '    vec2 d = T.xy - pos;',
    '    float far = min(length(d) * 5.0, 1.0);',
    '    vec2 wobble = vec2(sin(pos.y * 38.0 + uTime * 2.3 + seed.x * 6.283),',
    '                       cos(pos.x * 31.0 - uTime * 1.9 + seed.y * 6.283));',
    '    vec2 acc = d * uSpring - vel * uDamp + wobble * 0.25 * far + water * 2.0;',
    '    vel += acc * uDt;',
    '    pos += vel * uDt;',
    '  } else {',
    '    float depth = seed.w * seed.w * uSandDepth;        // how deep in the bed this grain rests',
    '    float surface = floorH(pos.x);',
    '    float rest = surface - depth;',
    '    float exposed = exp(-max(surface - pos.y, 0.0) * 300.0);   // buried grains feel no current',
    '    vec2 flow = water * exposed;',
    '    vel += (flow - vel) * min(uDrag * uDt, 1.0);',
    '    vel.y -= uSink * (0.55 + 0.9 * seed.y) * uDt;      // heavier grains sink faster',
    '    float nearBed = 1.0 - smoothstep(0.0, 0.03, pos.y - rest);',
    '    vel.y += length(flow) * uLift * nearBed * uDt;     // fast water lifts sand off the bed',
    '    pos += vel * uDt;',
    '    pos.x = fract(pos.x + 1.0);',
    '    rest = floorH(pos.x) - depth;',
    '    if (pos.y < rest) { pos.y = rest; vel.x *= 0.5; vel.y = max(vel.y, 0.0); }',
    '    if (pos.y > 1.0) { pos.y = 1.0; vel.y = -abs(vel.y); }',
    '  }',
    '  oPos = vec4(pos, vel);',
    '  oState = vec4(torn, tornAt, 0.0, 0.0);',
    '}'
  ].join('\n');

  // ---------- Drawing the grains as points ----------
  var GRAIN_VERT = [
    '#version 300 es',
    'precision highp float; precision highp sampler2D;',
    'uniform sampler2D uPos; uniform sampler2D uSeed;',
    'uniform int uSize; uniform float uPointSize; uniform float uTime; uniform float uSandDepth;',
    'out vec4 vColor;',
    COMMON,
    'void main () {',
    '  ivec2 tc = ivec2(gl_VertexID % uSize, gl_VertexID / uSize);',
    '  vec4 P = texelFetch(uPos, tc, 0);',
    '  vec4 seed = texelFetch(uSeed, tc, 0);',
    '  gl_Position = vec4(P.xy * 2.0 - 1.0, 0.0, 1.0);',
    '  gl_PointSize = uPointSize * (0.7 + 0.8 * seed.z);',
    '',
    '  vec3 sand = mix(vec3(0.60, 0.45, 0.26), vec3(0.98, 0.88, 0.66), seed.x);',
    '  if (seed.y > 0.94) sand *= 0.45;                       // a few dark mineral grains',
    '  else if (seed.y < 0.04) sand = vec3(1.0, 0.97, 0.90);  // a few bright quartz grains',
    '',
    '  float above = P.y - floorH(P.x);',
    '  float suspended = smoothstep(0.0, 0.02, above);',
    '  float light = 0.5 + 0.8 * caustic(vec2(P.x * uAspect, P.y) * 7.0, uTime);',
    '  light *= mix(0.75, 1.15, P.y);',
    '  light *= mix(1.0, 0.5, smoothstep(0.0, uSandDepth, -above));   // darker deeper in the bed',
    '  vec3 c = mix(sand * light, waterColor(P.y), 0.22 - 0.10 * suspended);',
    '  vColor = vec4(c, mix(0.85, 0.95, suspended));',
    '}'
  ].join('\n');

  var GRAIN_FRAG = [
    '#version 300 es',
    'precision highp float;',
    'in vec4 vColor;',
    'out vec4 o;',
    'void main () { o = vColor; }'
  ].join('\n');

  // ---------- Water, light and seabed ----------
  var SCENE_FRAG = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'out vec4 o;',
    'uniform float uTime;',
    COMMON,
    'void main () {',
    '  vec2 uv = vUv;',
    '  vec2 p = vec2(uv.x * uAspect, uv.y);',
    '  vec3 col = waterColor(uv.y);',
    '',
    '  // Shafts of sunlight slanting down from the surface',
    '  float a = p.x - (1.0 - uv.y) * 0.45;',
    '  float rays = pow(0.5 + 0.5 * sin(a * 7.0 + uTime * 0.25), 6.0)',
    '             + 0.7 * pow(0.5 + 0.5 * sin(a * 13.0 - uTime * 0.18 + 1.3), 8.0)',
    '             + 0.5 * pow(0.5 + 0.5 * sin(a * 23.0 + uTime * 0.33 + 4.0), 10.0);',
    '  rays *= 0.12 + 0.88 * smoothstep(0.1, 1.0, uv.y);',
    '  col += vec3(0.35, 0.62, 0.60) * rays * 0.22;',
    '',
    '  // Shimmer just under the surface',
    '  float shimmer = smoothstep(0.84, 1.0, uv.y);',
    '  col += vec3(0.6, 0.85, 0.85) * shimmer * (0.2 + 0.6 * caustic(p * 9.0, uTime));',
    '',
    '  // Two distant ridges fading into the blue give the scene depth',
    '  float r1 = uFloor + 0.13 + 0.035 * sin(p.x * 2.3 + 1.0) + 0.015 * sin(p.x * 6.1);',
    '  col = mix(col, mix(vec3(0.45, 0.38, 0.26), waterColor(uv.y), 0.82), smoothstep(r1 + 0.004, r1 - 0.004, uv.y));',
    '  float r2 = uFloor + 0.065 + 0.03 * sin(p.x * 3.1 + 3.0) + 0.012 * sin(p.x * 8.3 + 1.0);',
    '  col = mix(col, mix(vec3(0.50, 0.41, 0.27), waterColor(uv.y), 0.60), smoothstep(r2 + 0.003, r2 - 0.003, uv.y));',
    '',
    '  // The seabed itself (the loose grains are drawn on top of this)',
    '  float below = floorH(uv.x) - uv.y;',
    '  if (below > -0.004) {',
    '    vec3 sand = vec3(0.63, 0.50, 0.31);',
    '    sand *= 0.92 + 0.08 * sin(below * 260.0 + sin(p.x * 14.0) * 1.4 + p.x * 3.0);',
    '    sand *= 0.55 + 0.75 * caustic(p * 7.0, uTime) * exp(-below * 10.0);',
    '    sand *= mix(1.0, 0.35, smoothstep(0.0, uFloor, below));',
    '    sand = mix(sand, vec3(0.02, 0.16, 0.26), 0.25);',
    '    col = mix(col, sand, smoothstep(-0.004, 0.002, below));',
    '  }',
    '',
    '  vec2 v = uv - 0.5;',
    '  col *= 1.0 - 0.45 * dot(v, v);',
    '  o = vec4(col, 1.0);',
    '}'
  ].join('\n');

  // ---------- Program helpers ----------
  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function createProgram(vertSource, fragSource) {
    var program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSource));
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(program));
    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program: program, uniforms: uniforms };
  }

  function use(p) { gl.useProgram(p.program); return p.uniforms; }

  var fluid = {};
  Object.keys(FLUID).forEach(function (k) { fluid[k] = createProgram(FLUID_VERT, FLUID[k]); });
  var grainUpdate = createProgram(QUAD_VERT, GRAIN_UPDATE);
  var grainDraw = createProgram(GRAIN_VERT, GRAIN_FRAG);
  var scene = createProgram(QUAD_VERT, SCENE_FRAG);

  // Quad geometry, and an empty vertex array for drawing the grains
  // (the grain shader looks positions up by vertex number, so it needs no buffers).
  var quadVAO = gl.createVertexArray();
  gl.bindVertexArray(quadVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  var emptyVAO = gl.createVertexArray();

  function createTexture(w, h, internal, type, filter, data) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, data || null);
    return tex;
  }

  function attach(tex, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    return unit;
  }

  // ---------- Water buffers ----------
  function createFBO(w, h, filter) {
    gl.activeTexture(gl.TEXTURE0);
    var texture = createTexture(w, h, gl.RGBA16F, gl.HALF_FLOAT, filter);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture: texture, fbo: fbo, width: w, height: h };
  }

  function createDoubleFBO(w, h, filter) {
    return {
      width: w, height: h, texelX: 1 / w, texelY: 1 / h,
      read: createFBO(w, h, filter), write: createFBO(w, h, filter),
      swap: function () { var t = this.read; this.read = this.write; this.write = t; }
    };
  }

  var velocity, pressure, divergence, curl;

  function initWater() {
    var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    var landscape = aspect >= 1;
    var long = Math.round(CONFIG.SIM_RESOLUTION * (landscape ? aspect : 1 / aspect));
    var w = landscape ? long : CONFIG.SIM_RESOLUTION;
    var h = landscape ? CONFIG.SIM_RESOLUTION : long;
    velocity = createDoubleFBO(w, h, gl.LINEAR);
    pressure = createDoubleFBO(w, h, gl.NEAREST);
    divergence = createFBO(w, h, gl.NEAREST);
    curl = createFBO(w, h, gl.NEAREST);
  }

  function blit(target) {
    gl.viewport(0, 0, target.width, target.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function stepWater(dt) {
    var u;
    var tx = velocity.texelX, ty = velocity.texelY;

    u = use(fluid.curl);
    gl.uniform2f(u.texelSize, tx, ty);
    gl.uniform1i(u.uVelocity, attach(velocity.read.texture, 0));
    blit(curl);

    u = use(fluid.vorticity);
    gl.uniform2f(u.texelSize, tx, ty);
    gl.uniform1i(u.uVelocity, attach(velocity.read.texture, 0));
    gl.uniform1i(u.uCurl, attach(curl.texture, 1));
    gl.uniform1f(u.curl, CONFIG.CURL);
    gl.uniform1f(u.dt, dt);
    blit(velocity.write);
    velocity.swap();

    u = use(fluid.divergence);
    gl.uniform2f(u.texelSize, tx, ty);
    gl.uniform1i(u.uVelocity, attach(velocity.read.texture, 0));
    blit(divergence);

    u = use(fluid.scale);
    gl.uniform1i(u.uTexture, attach(pressure.read.texture, 0));
    gl.uniform1f(u.value, 0.8);
    blit(pressure.write);
    pressure.swap();

    u = use(fluid.pressure);
    gl.uniform2f(u.texelSize, tx, ty);
    gl.uniform1i(u.uDivergence, attach(divergence.texture, 0));
    for (var i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(u.uPressure, attach(pressure.read.texture, 1));
      blit(pressure.write);
      pressure.swap();
    }

    u = use(fluid.gradientSubtract);
    gl.uniform2f(u.texelSize, tx, ty);
    gl.uniform1i(u.uPressure, attach(pressure.read.texture, 0));
    gl.uniform1i(u.uVelocity, attach(velocity.read.texture, 1));
    blit(velocity.write);
    velocity.swap();

    u = use(fluid.advection);
    gl.uniform2f(u.texelSize, tx, ty);
    gl.uniform1i(u.uVelocity, attach(velocity.read.texture, 0));
    gl.uniform1i(u.uSource, attach(velocity.read.texture, 0));
    gl.uniform1f(u.dt, dt);
    gl.uniform1f(u.dissipation, CONFIG.WATER_FADE);
    blit(velocity.write);
    velocity.swap();
  }

  function pushWater(x, y, dx, dy) {
    var aspect = canvas.width / canvas.height;
    var radius = CONFIG.POINTER_RADIUS / 100;
    if (aspect > 1) radius *= aspect;
    var u = use(fluid.splat);
    gl.uniform2f(u.texelSize, velocity.texelX, velocity.texelY);
    gl.uniform1i(u.uTarget, attach(velocity.read.texture, 0));
    gl.uniform1f(u.aspectRatio, aspect);
    gl.uniform2f(u.point, x, y);
    gl.uniform3f(u.color, dx, dy, 0);
    gl.uniform1f(u.radius, radius);
    blit(velocity.write);
    velocity.swap();
  }

  // ---------- Grain buffers ----------
  var aspectNow = 1;

  function floorHeight(x) {      // must match floorH() in the shaders
    var a = x * aspectNow;
    return CONFIG.FLOOR + 0.014 * Math.sin(a * 4.1 + 0.6) + 0.007 * Math.sin(a * 9.7 + 2.1) + 0.003 * Math.sin(a * 23.0);
  }

  var seedTex, targetTex, grainsA, grainsB;
  var targetData = new Float32Array(N * 4);
  var used = new Uint8Array(N);

  function createGrainFBO(posData) {
    var pos = createTexture(G, G, gl.RGBA32F, gl.FLOAT, gl.NEAREST, posData);
    var state = createTexture(G, G, gl.RGBA32F, gl.FLOAT, gl.NEAREST, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pos, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, state, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    return { fbo: fbo, pos: pos, state: state };
  }

  function initGrains() {
    var seeds = new Float32Array(N * 4);
    var pos = new Float32Array(N * 4);
    for (var i = 0; i < N; i++) {
      var col = i % G;
      var s0 = Math.random(), s1 = Math.random(), s2 = Math.random(), s3 = Math.random();
      seeds[i * 4] = s0; seeds[i * 4 + 1] = s1; seeds[i * 4 + 2] = s2; seeds[i * 4 + 3] = s3;
      // Column in the texture ~ position along the seabed, so the grains for a
      // letter can be picked from the sand roughly beneath it.
      var x = (col + Math.random()) / G;
      pos[i * 4] = x;
      pos[i * 4 + 1] = floorHeight(x) - s3 * s3 * CONFIG.SAND_DEPTH;
    }
    gl.activeTexture(gl.TEXTURE0);
    seedTex = createTexture(G, G, gl.RGBA32F, gl.FLOAT, gl.NEAREST, seeds);
    targetTex = createTexture(G, G, gl.RGBA32F, gl.FLOAT, gl.NEAREST, targetData);
    grainsA = createGrainFBO(pos);
    grainsB = createGrainFBO(pos);
    // "Torn from message -1" = not torn from anything yet.
    [grainsA, grainsB].forEach(function (g) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo);
      gl.clearBufferfv(gl.COLOR, 1, [-1, 0, 0, 0]);
    });
  }

  var time = 0;
  var msgId = 0;
  var releaseAt = 1e9;      // when the current reply starts to crumble (far future = holding)

  function stepGrains(dt) {
    var u = use(grainUpdate);
    gl.uniform1i(u.uPos, attach(grainsA.pos, 0));
    gl.uniform1i(u.uState, attach(grainsA.state, 1));
    gl.uniform1i(u.uSeed, attach(seedTex, 2));
    gl.uniform1i(u.uTarget, attach(targetTex, 3));
    gl.uniform1i(u.uVelocity, attach(velocity.read.texture, 4));
    gl.uniform2f(u.uSimTexel, velocity.texelX, velocity.texelY);
    gl.uniform1f(u.uAspect, aspectNow);
    gl.uniform1f(u.uFloor, CONFIG.FLOOR);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uMsg, msgId);
    gl.uniform1f(u.uReleaseAt, releaseAt);
    gl.uniform1f(u.uSink, CONFIG.SINK);
    gl.uniform1f(u.uDrag, CONFIG.DRAG);
    gl.uniform1f(u.uLift, CONFIG.LIFT);
    gl.uniform1f(u.uSpring, CONFIG.SPRING);
    gl.uniform1f(u.uDamp, CONFIG.DAMPING);
    gl.uniform1f(u.uKnock, CONFIG.KNOCK);
    gl.uniform1f(u.uHeal, CONFIG.HEAL);
    gl.uniform1f(u.uSandDepth, CONFIG.SAND_DEPTH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, grainsB.fbo);
    gl.viewport(0, 0, G, G);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    var t = grainsA; grainsA = grainsB; grainsB = t;
  }

  function render() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    var u = use(scene);
    gl.uniform1f(u.uAspect, aspectNow);
    gl.uniform1f(u.uFloor, CONFIG.FLOOR);
    gl.uniform1f(u.uTime, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    u = use(grainDraw);
    gl.uniform1i(u.uPos, attach(grainsA.pos, 0));
    gl.uniform1i(u.uSeed, attach(seedTex, 1));
    gl.uniform1i(u.uSize, G);
    gl.uniform1f(u.uPointSize, CONFIG.POINT_SIZE * dpr);
    gl.uniform1f(u.uAspect, aspectNow);
    gl.uniform1f(u.uFloor, CONFIG.FLOOR);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uSandDepth, CONFIG.SAND_DEPTH);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(emptyVAO);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.bindVertexArray(quadVAO);
    gl.disable(gl.BLEND);
  }

  // ====================================================================
  // Turning text into grain targets
  // ====================================================================
  var scratch = document.createElement('canvas');
  var sctx = scratch.getContext('2d', { willReadFrequently: true });

  function fontFor(size) {
    return '700 ' + size + 'px "Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif';
  }

  function writeText(text) {
    var W = canvas.clientWidth, H = canvas.clientHeight;
    var maxWidth = Math.min(W * 0.86, 940);
    var top = H * 0.1;
    var bottom = H * (1 - CONFIG.FLOOR) - 70;
    var availH = Math.max(80, bottom - top);
    var words = text.split(/\s+/);
    var size = Math.max(26, Math.min(88, W / 13));
    var lines, lineH;

    // Shrink the font until the wrapped text fits the open water.
    for (;;) {
      sctx.font = fontFor(size);
      lineH = size * 1.25;
      lines = [];
      var line = '';
      var tooWide = false;
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (sctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          line = words[i];
          if (sctx.measureText(line).width > maxWidth) tooWide = true;
        }
      }
      if (line) lines.push(line);
      if ((!tooWide && lines.length * lineH <= availH) || size <= 14) break;
      size *= 0.92;
    }

    scratch.width = Math.ceil(W);
    scratch.height = Math.ceil(H);
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.font = fontFor(size);
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillStyle = '#fff';
    var startY = top + (availH - lines.length * lineH) / 2 + lineH / 2;
    for (var l = 0; l < lines.length; l++) sctx.fillText(lines[l], W / 2, startY + l * lineH);

    var sw = scratch.width;
    var y0 = Math.max(0, Math.floor(startY - lineH));
    var y1 = Math.min(scratch.height, Math.ceil(startY + lines.length * lineH));
    var data = sctx.getImageData(0, y0, sw, y1 - y0).data;

    var inked = 0;
    for (var a = 3; a < data.length; a += 4) if (data[a] > 128) inked++;
    if (!inked) return;

    // Several grains per pixel of lettering, so the letters look solid.
    var budget = Math.min(CONFIG.TEXT_GRAINS, Math.floor(N * 0.4));
    var perPixel = Math.min(4, budget / inked);

    targetData.fill(0);
    used.fill(0);

    for (var y = y0; y < y1; y++) {
      var lineIndex = Math.max(0, Math.floor((y - (startY - lineH / 2)) / lineH));
      for (var x = 0; x < sw; x++) {
        if (data[((y - y0) * sw + x) * 4 + 3] <= 128) continue;
        var count = Math.floor(perPixel) + (Math.random() < perPixel % 1 ? 1 : 0);
        for (var k = 0; k < count; k++) {
          var u = (x + Math.random()) / W;
          var v = 1 - (y + Math.random()) / H;
          // Choose a free grain from the sand roughly below this spot.
          var col = Math.floor(u * G + (Math.random() - 0.5) * G * 0.08);
          col = Math.max(0, Math.min(G - 1, col));
          var idx = -1;
          for (var tries = 0; tries < 8; tries++) {
            var candidate = Math.floor(Math.random() * G) * G + col;
            if (!used[candidate]) { idx = candidate; break; }
          }
          if (idx < 0) continue;
          used[idx] = 1;
          targetData[idx * 4] = u;
          targetData[idx * 4 + 1] = v;
          targetData[idx * 4 + 2] = 1;
          // Written like handwriting: line by line, left to right.
          targetData[idx * 4 + 3] = time + lineIndex * 0.45 + u * 0.9 + Math.random() * 0.3;
        }
      }
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targetTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, G, G, gl.RGBA, gl.FLOAT, targetData);
    msgId++;
    releaseAt = 1e9;
    replyText.textContent = text;
  }

  function crumble() {
    if (releaseAt > time) releaseAt = time;
  }

  // ====================================================================
  // Pointer (mouse, touch, pen) — it only ever pushes the water
  // ====================================================================
  var pointers = {};
  var pushes = [];

  function position(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: 1 - (e.clientY - rect.top) / rect.height };
  }

  canvas.addEventListener('pointerdown', function (e) { pointers[e.pointerId] = position(e); });

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
    if (dx * dx + dy * dy < 1e-7) return;
    pushes.push({ x: p.x, y: p.y, dx: dx * CONFIG.POINTER_FORCE, dy: dy * CONFIG.POINTER_FORCE });
  });

  function release(e) { delete pointers[e.pointerId]; }
  canvas.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') release(e); });
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);

  // ====================================================================
  // Chat flow
  // ====================================================================
  var currentText = '';
  var seq = 0;                 // increases with every message, so stale timers can be ignored
  var history = [];
  var youTimer = 0;

  function showYou(text) {
    youLine.textContent = text;
    youLine.classList.add('visible');
    clearTimeout(youTimer);
    youTimer = setTimeout(function () { youLine.classList.remove('visible'); }, 6000);
  }

  function clip(text) {
    text = String(text).replace(/\s+/g, ' ').trim();
    return text.length > CONFIG.MAX_CHARS ? text.slice(0, CONFIG.MAX_CHARS - 1).trim() + '…' : text;
  }

  function say(text, delayMs) {
    var mine = ++seq;
    crumble();
    setTimeout(function () {
      if (mine !== seq) return;
      currentText = clip(text);
      writeText(currentText);
    }, delayMs);
  }

  var claritySent = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var message = input.value.trim();
    if (!message) return;
    if (!claritySent && typeof window.clarity === 'function') {
      claritySent = true;
      window.clarity('event', 'interactive-sand-chat');
    }
    input.value = '';
    showYou(message);
    history.push({ role: 'user', text: message });

    // The old reply starts falling apart the moment you answer.
    var mine = ++seq;
    crumble();
    var asked = performance.now();

    getReply(message, history).then(function (reply) {
      if (mine !== seq) return;
      history.push({ role: 'sand', text: reply });
      var wait = Math.max(0, CONFIG.CRUMBLE_TIME * 1000 - (performance.now() - asked));
      setTimeout(function () {
        if (mine !== seq) return;
        currentText = clip(reply);
        writeText(currentText);
      }, wait);
    }).catch(function () {
      if (mine !== seq) return;
      currentText = 'The current took my words. Try again.';
      writeText(currentText);
    });
  });

  // ====================================================================
  // Start
  // ====================================================================
  var dpr = 1;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.floor(canvas.clientWidth * dpr);
    var h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w;
    canvas.height = h;
    aspectNow = w / h;
    return true;
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!resizeCanvas()) return;
      initWater();
      if (currentText) writeText(currentText);
    }, 200);
  });

  var lastFrame = performance.now();
  function frame(t) {
    var dt = Math.min((t - lastFrame) / 1000, 1 / 30);
    lastFrame = t;
    time += dt;

    gl.bindVertexArray(quadVAO);
    gl.disable(gl.BLEND);
    while (pushes.length) {
      var p = pushes.shift();
      pushWater(p.x, p.y, p.dx, p.dy);
    }
    stepWater(dt);
    stepGrains(dt);
    render();
    requestAnimationFrame(frame);
  }

  resizeCanvas();
  initWater();
  initGrains();
  say('Hello. I am written in sand. Say something, and watch me change.', 600);
  requestAnimationFrame(frame);
})();
