/*
 * RAIN ON A WINDOW — a misted window at night with city lights behind it.
 *   raindrops land, grow, merge and run down the glass
 *   a finger wipes a clear streak through the mist, which slowly fogs over again
 *
 * The drops are simulated in JavaScript and painted into a small "height map".
 * A shader then treats each drop as a real 3D lens: it bends the view behind
 * it and catches a highlight.
 */
Games.rain = function (ctx) {
  'use strict';

  var MAX_DROPS = 260;
  var RUN_SIZE = 7;        // drops bigger than this start to slide
  var REFOG = 0.006;       // how fast the wiped glass mists over again (per frame)

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- canvases the simulation paints into ----
  var H = 384, W = 384;
  var dropCanvas = document.createElement('canvas');
  var trailCanvas = document.createElement('canvas');
  var mistCanvas = document.createElement('canvas');
  var dg = dropCanvas.getContext('2d');
  var tg = trailCanvas.getContext('2d');
  var mg = mistCanvas.getContext('2d');
  var dropTex = new THREE.CanvasTexture(dropCanvas);
  var mistTex = new THREE.CanvasTexture(mistCanvas);
  dropTex.minFilter = mistTex.minFilter = THREE.LinearFilter;

  var uniforms = {
    uDrops: { value: dropTex }, uMist: { value: mistTex },
    uTime: { value: 0 }, uAspect: { value: 1 }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }
  };

  var FRAG = [
    'uniform sampler2D uDrops; uniform sampler2D uMist;',
    'uniform float uTime; uniform float uAspect; uniform vec2 uTexel;',
    'varying vec2 vUv;',
    // The world outside: a night sky with soft coloured lights.
    // blur = 0 gives sharp lights, blur = 1 gives the smeared view through mist.
    'vec3 outside(vec2 uv, float blur) {',
    '  vec3 c = mix(vec3(0.03, 0.05, 0.11), vec3(0.10, 0.13, 0.26), uv.y);',
    '  for (int i = 0; i < 14; i++) {',
    '    float fi = float(i);',
    '    vec2 p = vec2(fract(sin(fi * 12.9898) * 43758.5453), fract(sin(fi * 78.233) * 12543.123) * 0.75 + 0.08);',
    '    vec3 lc = mix(0.55 + 0.45 * cos(6.2831 * (fi * 0.13 + vec3(0.0, 0.33, 0.67))), vec3(1.0, 0.8, 0.5), 0.5);',
    '    float rad = mix(0.014, 0.10, blur) * (0.6 + fract(fi * 0.37));',
    '    float m = smoothstep(rad, rad * mix(0.2, 0.7, blur), length((uv - p) * vec2(uAspect, 1.0)));',
    '    c += lc * m * mix(1.5, 0.30, blur) * (0.8 + 0.2 * sin(uTime * 0.7 + fi));',
    '  }',
    '  return c;',
    '}',
    'void main() {',
    '  float h = texture2D(uDrops, vUv).r;',
    '  vec2 n = vec2(',
    '    texture2D(uDrops, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDrops, vUv - vec2(uTexel.x, 0.0)).r,',
    '    texture2D(uDrops, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDrops, vUv - vec2(0.0, uTexel.y)).r);',
    '  float drop = smoothstep(0.10, 0.32, h);',
    '  float mist = texture2D(uMist, vUv).r;',
    '  vec3 misted = outside(vUv, 1.0) * 0.85 + vec3(0.07, 0.08, 0.10);',
    '  vec3 col = mix(outside(vUv, 0.25), misted, mist);',
    '  // Inside a drop the view is bent like a lens, and always sharp.',
    '  col = mix(col, outside(vUv - n * 1.3, 0.6) * 1.7 + vec3(0.05, 0.06, 0.09), drop);',
    '  // Rounded 3D look: a highlight on the upper left, a shadow under the edge.',
    '  vec3 normal = normalize(vec3(-n * 3.0, 0.35));',
    '  col += drop * 0.9 * pow(max(dot(normal, normalize(vec3(-0.4, 0.5, 0.75))), 0.0), 28.0);',
    '  col *= 1.0 - 0.45 * drop * smoothstep(0.75, 0.32, h);',
    '  col *= 1.0 - 0.35 * smoothstep(0.02, 0.10, h) * (1.0 - drop);',
    '  vec2 v = vUv - 0.5;',
    '  col *= 1.0 - 0.5 * dot(v, v);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: uniforms, fragmentShader: FRAG,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
  })));

  var drops = [];
  var lastWipe = null;
  var rainSound = Sound.rain();

  function resize(w, h) {
    W = Math.round(H * w / h);
    dropCanvas.width = trailCanvas.width = W;
    dropCanvas.height = trailCanvas.height = H;
    mistCanvas.width = Math.round(W / 2);
    mistCanvas.height = H / 2;
    mg.fillStyle = '#fff';
    mg.fillRect(0, 0, mistCanvas.width, mistCanvas.height);
    uniforms.uAspect.value = w / h;
    uniforms.uTexel.value.set(1 / W, 1 / H);
    drops.length = 0;
  }

  function blob(g, x, y, r, strength) {
    var grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,' + strength + ')');
    grad.addColorStop(0.6, 'rgba(255,255,255,' + strength * 0.75 + ')');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, 6.2832);
    g.fill();
  }

  function wipe(p) {
    var x = p.x / ctx.width * mistCanvas.width;
    var y = p.y / ctx.height * mistCanvas.height;
    var width = mistCanvas.height * 0.085;
    mg.strokeStyle = '#000';
    mg.lineCap = 'round';
    mg.lineWidth = width;
    mg.shadowColor = '#000';
    mg.shadowBlur = width * 0.4;
    mg.beginPath();
    mg.moveTo(lastWipe ? lastWipe.x : x, lastWipe ? lastWipe.y : y);
    mg.lineTo(x, y + 0.01);
    mg.stroke();
    mg.shadowBlur = 0;
    lastWipe = { x: x, y: y };
    // The finger also wipes away the small drops it passes over.
    var dx = p.x / ctx.width * W, dy = p.y / ctx.height * H, reach = H * 0.045;
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      if (d.r < RUN_SIZE && Math.abs(d.x - dx) < reach && Math.abs(d.y - dy) < reach) drops.splice(i, 1);
    }
  }

  return {
    scene: scene, camera: camera, resize: resize,

    down: function (p) { lastWipe = null; wipe(p); },
    move: function (p, pressed) { if (pressed) wipe(p); else lastWipe = null; },
    up: function () { lastWipe = null; },
    dispose: function () { rainSound.stop(); dropTex.dispose(); mistTex.dispose(); },

    update: function (dt, t) {
      // New rain lands on the glass.
      var landing = drops.length < MAX_DROPS ? 3 : 0;
      for (var n = 0; n < landing; n++) {
        if (Math.random() < 0.55) drops.push({ x: Math.random() * W, y: Math.random() * H, r: Util.rand(1.6, 4.2), vy: 0, sway: Math.random() * 6 });
      }

      // Drops that touch merge into one bigger drop.
      for (var i = 0; i < drops.length; i++) {
        var a = drops[i];
        if (a.dead) continue;
        for (var j = i + 1; j < drops.length; j++) {
          var b = drops[j];
          if (b.dead) continue;
          var dx = a.x - b.x, dy = a.y - b.y, reach = (a.r + b.r) * 0.8;
          if (dx * dx + dy * dy < reach * reach) {
            var big = a.r >= b.r ? a : b, small = big === a ? b : a;
            big.r = Math.min(16, Math.sqrt(big.r * big.r + small.r * small.r));
            small.dead = true;
            if (small === a) break;
          }
        }
      }

      // Heavy drops run down the glass and leave a wet trail.
      tg.globalCompositeOperation = 'destination-out';
      tg.fillStyle = 'rgba(0,0,0,0.035)';
      tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = 'source-over';

      for (var k = drops.length - 1; k >= 0; k--) {
        var d = drops[k];
        if (!d.dead && d.r > RUN_SIZE) {
          d.vy = Math.min(d.vy + 60 * dt, (d.r - RUN_SIZE + 1) * 26);
          d.y += d.vy * dt;
          d.x += Math.sin(d.y * 0.06 + d.sway) * 9 * dt;
          blob(tg, d.x, d.y - d.r * 0.6, d.r * 0.55, 0.5);
          d.r -= dt * 0.25;
        }
        if (d.dead || d.y - d.r > H) drops.splice(k, 1);
      }

      // Paint the height map: wet trails first, then every drop.
      dg.globalCompositeOperation = 'source-over';
      dg.fillStyle = '#000';
      dg.fillRect(0, 0, W, H);
      dg.globalCompositeOperation = 'lighter';
      dg.drawImage(trailCanvas, 0, 0);
      for (var m = 0; m < drops.length; m++) blob(dg, drops[m].x, drops[m].y, drops[m].r * 1.25, 1);
      dropTex.needsUpdate = true;

      // The glass slowly mists over again.
      mg.fillStyle = 'rgba(255,255,255,' + REFOG + ')';
      mg.fillRect(0, 0, mistCanvas.width, mistCanvas.height);
      mistTex.needsUpdate = true;

      uniforms.uTime.value = t;
    }
  };
};
