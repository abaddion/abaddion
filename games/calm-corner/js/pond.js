/*
 * POND — still water seen from the bank, with lily pads and lazy fish.
 *   touch the water -> ripples spread out from the finger
 *   lily pads bob as the ripples pass under them
 *   the fish swim slowly toward the last place that was touched
 *
 * The ripple formula exists twice on purpose: once in the water shader (to
 * move and light the surface) and once in JavaScript (so the lily pads can
 * ride the same waves). Keep the two in step if you change one.
 */
Games.pond = function (ctx) {
  'use strict';

  var RIPPLES = 10;            // ripples alive at once
  var WAVE = { height: 0.2, length: 5.0, speed: 2.2, fade: 0.8 };

  var scene = new THREE.Scene();
  scene.background = Util.gradient(['#cfeee0', '#9fd6c4', '#5fae9c']);
  var camera = new THREE.PerspectiveCamera(42, ctx.aspect, 0.1, 100);
  camera.position.set(0, 9.5, 9.5);
  camera.lookAt(0, 0, 0.8);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2f5f55, 0.95));
  var sun = new THREE.DirectionalLight(0xfff6e0, 0.9);
  sun.position.set(4, 9, 3);
  scene.add(sun);

  // ---- pond bed: pebbles painted once onto a texture ----
  var bedCanvas = document.createElement('canvas');
  bedCanvas.width = bedCanvas.height = 512;
  var bg = bedCanvas.getContext('2d');
  bg.fillStyle = '#2f6b66';
  bg.fillRect(0, 0, 512, 512);
  for (var i = 0; i < 520; i++) {
    var shade = Math.floor(Util.rand(70, 150));
    bg.fillStyle = 'rgb(' + Math.floor(shade * 0.75) + ',' + shade + ',' + Math.floor(shade * 0.95) + ')';
    bg.beginPath();
    bg.ellipse(Math.random() * 512, Math.random() * 512, Util.rand(5, 20), Util.rand(4, 13), Math.random() * 3.14, 0, 6.2832);
    bg.fill();
  }
  var bedTex = new THREE.CanvasTexture(bedCanvas);
  bedTex.wrapS = bedTex.wrapT = THREE.RepeatWrapping;
  bedTex.repeat.set(4, 4);
  bedTex.encoding = THREE.sRGBEncoding;
  var bed = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: bedTex, color: 0x7fa8a2 }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = -1.8;
  scene.add(bed);

  // ---- water surface ----
  var ripples = [];
  for (var r = 0; r < RIPPLES; r++) ripples.push(new THREE.Vector3(0, 0, -100));   // x, z, start time
  var nextRipple = 0;

  var HEIGHT_GLSL = [
    'uniform vec3 uRipples[' + RIPPLES + '];',
    'uniform float uTime;',
    'float waterHeight(vec2 p) {',
    '  float h = 0.02 * sin(p.x * 1.3 + uTime * 0.8) + 0.015 * sin(p.y * 1.7 - uTime * 0.6);',
    '  for (int i = 0; i < ' + RIPPLES + '; i++) {',
    '    float age = uTime - uRipples[i].z;',
    '    float d = distance(p, uRipples[i].xy);',
    '    float front = age * ' + WAVE.speed.toFixed(2) + ';',
    '    float ring = smoothstep(front, front - 0.7, d) * exp(-d * 0.22) * exp(-age * ' + WAVE.fade.toFixed(2) + ');',
    '    h += ' + WAVE.height.toFixed(3) + ' * sin(' + WAVE.length.toFixed(2) + ' * (d - front)) * ring;',
    '  }',
    '  return h;',
    '}'
  ].join('\n');

  function waterHeight(x, z, t) {
    var h = 0.02 * Math.sin(x * 1.3 + t * 0.8) + 0.015 * Math.sin(z * 1.7 - t * 0.6);
    for (var i = 0; i < RIPPLES; i++) {
      var age = t - ripples[i].z;
      if (age > 8) continue;
      var d = Math.hypot(x - ripples[i].x, z - ripples[i].y);
      var front = age * WAVE.speed;
      var e = Math.max(0, Math.min(1, (front - d) / 0.7));
      var ring = e * e * (3 - 2 * e) * Math.exp(-d * 0.22) * Math.exp(-age * WAVE.fade);
      h += WAVE.height * Math.sin(WAVE.length * (d - front)) * ring;
    }
    return h;
  }

  var waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uRipples: { value: ripples }, uTime: { value: 0 } },
    vertexShader: [
      HEIGHT_GLSL,
      'varying vec3 vWorld;',
      'void main() {',
      '  vec4 w = modelMatrix * vec4(position, 1.0);',
      '  w.y += waterHeight(w.xz);',
      '  vWorld = w.xyz;',
      '  gl_Position = projectionMatrix * viewMatrix * w;',
      '}'].join('\n'),
    fragmentShader: [
      HEIGHT_GLSL,
      'varying vec3 vWorld;',
      'void main() {',
      '  vec2 p = vWorld.xz; float e = 0.06;',
      '  vec3 n = normalize(vec3(waterHeight(p - vec2(e, 0.0)) - waterHeight(p + vec2(e, 0.0)), 2.0 * e,',
      '                          waterHeight(p - vec2(0.0, e)) - waterHeight(p + vec2(0.0, e))));',
      '  vec3 v = normalize(cameraPosition - vWorld);',
      '  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);',
      '  vec3 sky = mix(vec3(0.62, 0.86, 0.80), vec3(0.93, 0.98, 0.95), clamp(n.z * 7.0 + 0.5, 0.0, 1.0));',
      '  vec3 col = mix(vec3(0.05, 0.36, 0.36), sky, clamp(fresnel * 1.4 + 0.12, 0.0, 1.0));',
      '  vec3 sunDir = normalize(vec3(0.35, 0.8, 0.25));',
      '  col += vec3(1.0, 0.97, 0.88) * pow(max(dot(reflect(-sunDir, n), v), 0.0), 90.0) * 1.2;',
      '  gl_FragColor = vec4(col, mix(0.38, 0.95, clamp(fresnel * 1.6, 0.0, 1.0)));',
      '}'].join('\n')
  });
  var water = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 200, 200), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 1;
  scene.add(water);

  // ---- lily pads ----
  var pads = [];
  var padSpots = [[-4.2, -1.5, 1.25], [-2.6, 2.6, 0.95], [3.4, -2.2, 1.35], [4.6, 1.8, 1.0], [0.6, -3.6, 0.85], [-5.8, 1.2, 0.8]];
  padSpots.forEach(function (s, index) {
    var group = new THREE.Group();
    var leaf = new THREE.Mesh(
      new THREE.CircleGeometry(s[2], 40, 0.25, Math.PI * 2 - 0.5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Util.rand(0.28, 0.36), 0.55, Util.rand(0.3, 0.4)), roughness: 0.6, side: THREE.DoubleSide }));
    leaf.rotation.x = -Math.PI / 2;
    group.add(leaf);
    if (index % 3 === 0) {       // a water lily on some pads
      var petalMat = new THREE.MeshStandardMaterial({ color: index ? 0xffd1e3 : 0xffffff, roughness: 0.5 });
      for (var k = 0; k < 9; k++) {
        var petal = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), petalMat);
        var a = k / 9 * Math.PI * 2;
        petal.scale.set(1.5, 0.35, 0.6);
        petal.position.set(Math.cos(a) * 0.24, 0.12, Math.sin(a) * 0.24);
        petal.rotation.set(0, -a, 0.55);
        group.add(petal);
      }
      var heart = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffd54a }));
      heart.position.y = 0.16;
      group.add(heart);
    }
    group.position.set(s[0], 0, s[1]);
    group.rotation.y = Math.random() * 6.28;
    scene.add(group);
    pads.push({ group: group, r: s[2], spin: group.rotation.y });
  });

  // ---- fish ----
  var fish = [];
  [0xff8a3c, 0xfff1e0, 0xff5a3c].forEach(function (colour, index) {
    var group = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.45, emissive: colour, emissiveIntensity: 0.35 });
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), mat);
    body.scale.set(1.7, 0.55, 0.62);
    var tail = new THREE.Group();
    var fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 4), mat);
    fin.rotation.z = -Math.PI / 2;
    fin.scale.set(1, 1, 0.25);
    fin.position.x = -0.3;
    tail.add(fin);
    tail.position.x = -0.5;
    group.add(body, tail);
    group.position.set(Util.rand(-4, 4), -0.38 - index * 0.1, Util.rand(-2.5, 2.5));
    scene.add(group);
    fish.push({ group: group, tail: tail, heading: Math.random() * 6.28, speed: Util.rand(0.5, 0.8),
                target: new THREE.Vector3(Util.rand(-4, 4), 0, Util.rand(-2.5, 2.5)), think: Util.rand(2, 6), phase: Math.random() * 6 });
  });

  var surface = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var clock = 0, lastDrip = -1, called = -100;

  function touch(p, quiet) {
    var at = Util.onPlane(p, camera, surface);
    if (!at) return;
    ripples[nextRipple].set(at.x, at.z, clock);
    nextRipple = (nextRipple + 1) % RIPPLES;
    if (!quiet) Sound.plop();
    lastDrip = clock;
    called = clock;
    fish.forEach(function (f, i) { f.target.set(at.x + (i - 1) * 0.9, 0, at.z + (i - 1) * 0.5); });
  }

  return {
    scene: scene, camera: camera,

    down: function (p) { touch(p, false); },
    move: function (p, pressed) { if (pressed && clock - lastDrip > 0.28) touch(p, true); },

    update: function (dt, t) {
      clock = t;
      waterMat.uniforms.uTime.value = t;

      pads.forEach(function (pad) {
        var x = pad.group.position.x, z = pad.group.position.z;
        var h = waterHeight(x, z, t);
        pad.group.position.y = 0.035 + h;
        // tilt with the slope of the water under the pad
        pad.group.rotation.z = (waterHeight(x - pad.r, z, t) - waterHeight(x + pad.r, z, t)) * 0.8;
        pad.group.rotation.x = (waterHeight(x, z + pad.r, t) - waterHeight(x, z - pad.r, t)) * 0.8;
        pad.group.rotation.y = pad.spin + Math.sin(t * 0.2 + pad.spin) * 0.15;
      });

      fish.forEach(function (f) {
        // After a while with no touch, each fish wanders off on its own.
        f.think -= dt;
        if (f.think < 0 && t - called > 7) {
          f.target.set(Util.rand(-5.5, 5.5), 0, Util.rand(-3.5, 3.5));
          f.think = Util.rand(4, 9);
        }
        var g = f.group;
        var dx = f.target.x - g.position.x, dz = f.target.z - g.position.z;
        var dist = Math.hypot(dx, dz);
        var want = Math.atan2(-dz, dx);
        var turn = Math.atan2(Math.sin(want - f.heading), Math.cos(want - f.heading));
        f.heading += turn * Math.min(1, dt * 1.2);
        var pace = f.speed * Math.min(1, dist / 1.5 + 0.15);
        g.position.x += Math.cos(f.heading) * pace * dt;
        g.position.z -= Math.sin(f.heading) * pace * dt;
        var wag = Math.sin(t * (3 + pace * 4) + f.phase);
        g.rotation.y = f.heading + wag * 0.08;
        f.tail.rotation.y = wag * 0.55;
      });
    }
  };
};
