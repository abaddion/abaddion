/*
 * BUBBLES — big slow soap bubbles drift up through 3D space.
 *   tap a bubble        -> it pops softly
 *   slide over a bubble -> it wobbles
 *   hold on empty space -> blow a new bubble that grows until you let go
 */
Games.bubbles = function (ctx) {
  'use strict';

  var COUNT = 12;          // bubbles kept floating
  var MAX_BLOWN = 2.4;     // largest bubble a child can blow

  var scene = new THREE.Scene();
  scene.background = Util.gradient(['#9ad8ff', '#cfe6ff', '#f1dcff', '#ffe3ee']);
  var camera = new THREE.PerspectiveCamera(50, ctx.aspect, 0.1, 100);
  camera.position.set(0, 0, 11);

  var geometry = new THREE.SphereGeometry(1, 48, 32);

  // Soap film: see-through in the middle, shiny rainbow at the edges.
  var VERT = [
    'uniform float uTime; uniform float uWobble; uniform float uSeed;',
    'varying vec3 vN; varying vec3 vV; varying vec3 vP;',
    'void main() {',
    '  vec3 p = position;',
    '  float w = sin(p.y * 4.0 + uTime * 9.0 + uSeed) * sin(p.x * 3.0 + uTime * 7.0) + sin(p.z * 5.0 - uTime * 8.0);',
    '  p += normal * (w * 0.07 * uWobble + 0.015 * sin(uTime * 1.3 + p.y * 2.0 + uSeed));',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FRAG = [
    'uniform float uTime; uniform float uSeed; uniform float uFade;',
    'varying vec3 vN; varying vec3 vV; varying vec3 vP;',
    'void main() {',
    '  vec3 n = normalize(vN);',
    '  float f = 1.0 - abs(dot(n, normalize(vV)));',
    '  float film = f * 3.2 + vP.y * 0.7 + sin(vP.x * 3.0 + uTime * 0.6 + uSeed) * 0.35 + uTime * 0.12 + uSeed;',
    '  vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (film + vec3(0.0, 0.33, 0.67)));',
    '  float rim = pow(f, 2.2);',
    '  float shine = pow(max(dot(n, normalize(vec3(-0.5, 0.6, 0.62))), 0.0), 70.0)',
    '              + 0.35 * pow(max(dot(n, normalize(vec3(0.45, -0.5, 0.74))), 0.0), 30.0);',
    '  vec3 col = mix(vec3(1.0), rainbow, 0.75) * (0.3 + 0.9 * rim) + vec3(shine);',
    '  gl_FragColor = vec4(col, clamp(0.08 + 0.8 * rim + shine, 0.0, 1.0) * uFade);',
    '}'
  ].join('\n');

  var bubbles = [];
  var sparks = [];
  var blowing = null;      // the bubble currently being blown
  var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  function spreadX(z) { return (11 - z) * Math.tan(25 * Math.PI / 180) * ctx.aspect; }
  function spreadY(z) { return (11 - z) * Math.tan(25 * Math.PI / 180); }

  function addBubble(x, y, z, r) {
    var material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uWobble: { value: 0 }, uSeed: { value: Math.random() * 10 }, uFade: { value: 1 } }
    });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(r);
    scene.add(mesh);
    var b = { mesh: mesh, r: r, rise: Util.rand(0.3, 0.65), phase: Math.random() * 6.28, wobble: 0, growing: false };
    mesh.userData.bubble = b;
    bubbles.push(b);
    return b;
  }

  function spawn(anywhere) {
    var z = Util.rand(-7, 3);
    var r = Util.rand(0.55, 1.5);
    var y = anywhere ? Util.rand(-spreadY(z), spreadY(z)) : -spreadY(z) - r - Util.rand(0, 3);
    addBubble(Util.rand(-1, 1) * spreadX(z), y, z, r);
  }

  function remove(b) {
    scene.remove(b.mesh);
    b.mesh.material.dispose();
    bubbles.splice(bubbles.indexOf(b), 1);
  }

  function pop(b) {
    Sound.pop(b.r);
    // A little ring of droplets flies outward and fades.
    var n = 26, pos = new Float32Array(n * 3), dir = [];
    for (var i = 0; i < n; i++) {
      var v = new THREE.Vector3(Util.rand(-1, 1), Util.rand(-1, 1), Util.rand(-1, 1)).normalize();
      dir.push(v);
      pos[i * 3] = b.mesh.position.x + v.x * b.r;
      pos[i * 3 + 1] = b.mesh.position.y + v.y * b.r;
      pos[i * 3 + 2] = b.mesh.position.z + v.z * b.r;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false
    }));
    scene.add(pts);
    sparks.push({ pts: pts, dir: dir, age: 0, speed: 1.5 + b.r });
    if (b === blowing) blowing = null;
    remove(b);
  }

  function hit(p) {
    var hits = Util.ray(p, camera).intersectObjects(bubbles.map(function (b) { return b.mesh; }));
    return hits.length ? hits[0].object.userData.bubble : null;
  }

  for (var i = 0; i < COUNT; i++) spawn(true);

  return {
    scene: scene, camera: camera,

    down: function (p) {
      var b = hit(p);
      if (b) { pop(b); return; }
      var at = Util.onPlane(p, camera, plane);
      if (!at) return;
      blowing = addBubble(at.x, at.y, 0, 0.2);
      blowing.growing = true;
      blowing.wobble = 0.4;
    },

    move: function (p, pressed) {
      if (blowing) {
        var at = Util.onPlane(p, camera, plane);
        if (at) blowing.mesh.position.lerp(at, 0.5);
        return;
      }
      var b = hit(p);
      if (b) b.wobble = 1;
    },

    up: function () {
      if (blowing) { blowing.growing = false; blowing.wobble = 1; blowing = null; }
    },

    update: function (dt, t) {
      var floating = 0;
      for (var i = bubbles.length - 1; i >= 0; i--) {
        var b = bubbles[i];
        var m = b.mesh;
        if (b.growing) {
          b.r = Math.min(MAX_BLOWN, b.r + dt * 0.7);
          b.wobble = Math.max(b.wobble, 0.35);
        } else {
          floating++;
          m.position.y += b.rise * dt;
          m.position.x += Math.sin(t * 0.5 + b.phase) * 0.25 * dt;
          if (m.position.y > spreadY(m.position.z) + b.r + 0.5) { remove(b); continue; }
        }
        b.wobble = Math.max(0, b.wobble - dt * 0.9);
        m.scale.setScalar(b.r);
        m.material.uniforms.uTime.value = t;
        m.material.uniforms.uWobble.value = b.wobble;
      }
      if (floating < COUNT) spawn(false);

      for (var s = sparks.length - 1; s >= 0; s--) {
        var k = sparks[s];
        k.age += dt;
        var a = k.pts.geometry.attributes.position;
        for (var j = 0; j < k.dir.length; j++) {
          a.array[j * 3] += k.dir[j].x * k.speed * dt;
          a.array[j * 3 + 1] += (k.dir[j].y * k.speed - k.age * 2.5) * dt;
          a.array[j * 3 + 2] += k.dir[j].z * k.speed * dt;
        }
        a.needsUpdate = true;
        k.pts.material.opacity = Math.max(0, 0.9 - k.age * 1.6);
        if (k.age > 0.6) {
          scene.remove(k.pts);
          k.pts.geometry.dispose(); k.pts.material.dispose();
          sparks.splice(s, 1);
        }
      }
    }
  };
};
