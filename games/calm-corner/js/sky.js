/*
 * NIGHT SKY — a deep 3D starfield with a moon and sleeping hills.
 *   tap the sky            -> a star lights up with a soft chime
 *   drag from star to star -> a glowing line joins them
 *   stars twinkle and slowly fade away
 * The view shifts a little with the finger, so near and far stars move
 * differently and the sky feels deep.
 */
Games.sky = function (ctx) {
  'use strict';

  var STAR_LIFE = 45;      // seconds a lit star stays
  var MAX_STARS = 40;
  var DEPTH = -12;         // how far away lit stars sit

  var scene = new THREE.Scene();
  scene.background = Util.gradient(['#050818', '#0b1238', '#1c2560', '#3a3a7a']);
  var camera = new THREE.PerspectiveCamera(60, ctx.aspect, 0.1, 200);

  // ---- thousands of distant stars at different depths ----
  var COUNT = 1800;
  var pos = new Float32Array(COUNT * 3), phase = new Float32Array(COUNT), size = new Float32Array(COUNT);
  for (var i = 0; i < COUNT; i++) {
    var z = Util.rand(-90, -18);
    pos[i * 3] = Util.rand(-1, 1) * -z * 1.6;
    pos[i * 3 + 1] = Util.rand(-0.35, 1) * -z * 0.9;
    pos[i * 3 + 2] = z;
    phase[i] = Math.random() * 6.28;
    size[i] = Util.rand(0.6, 2.4);
  }
  var farGeo = new THREE.BufferGeometry();
  farGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  farGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  farGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  var farMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: [
      'attribute float aPhase; attribute float aSize; uniform float uTime; uniform float uScale; varying float vA;',
      'void main() {',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vA = 0.55 + 0.45 * sin(uTime * (0.6 + aPhase * 0.2) + aPhase);',
      '  gl_PointSize = aSize * uScale * (40.0 / -mv.z + 0.8);',
      '  gl_Position = projectionMatrix * mv;',
      '}'].join('\n'),
    fragmentShader: [
      'varying float vA;',
      'void main() {',
      '  float d = length(gl_PointCoord - 0.5);',
      '  gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), smoothstep(0.5, 0.0, d) * vA);',
      '}'].join('\n')
  });
  scene.add(new THREE.Points(farGeo, farMat));

  // ---- the moon: a real lit sphere, with a soft halo ----
  scene.add(new THREE.AmbientLight(0x334466, 0.5));
  var sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
  sun.position.set(-6, 3, 6);
  scene.add(sun);
  var moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0xf4ecd2, roughness: 1, emissive: 0x1c1a14 }));
  moon.position.set(15, 13, -42);
  scene.add(moon);
  var halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: Util.glow('rgba(255,244,214,0.5)', 'rgba(255,240,200,0.16)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  halo.position.copy(moon.position);
  halo.scale.setScalar(22);
  scene.add(halo);

  // ---- two rows of dark hills in front ----
  function hills(zPos, base, colour, seed) {
    var shape = new THREE.Shape();
    shape.moveTo(-60, -30);
    for (var x = -60; x <= 60; x += 2) {
      shape.lineTo(x, base + Math.sin(x * 0.13 + seed) * 1.6 + Math.sin(x * 0.31 + seed * 2.0) * 0.7);
    }
    shape.lineTo(60, -30);
    var mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: colour }));
    mesh.position.z = zPos;
    scene.add(mesh);
  }
  hills(-20, -7.5, 0x0d1438, 1.0);
  hills(-11, -6.2, 0x060a1f, 4.2);

  // ---- stars the child lights, and the lines between them ----
  var glowTex = Util.glow();
  var lineTex = Util.gradient(['rgba(255,255,255,0)', 'rgba(255,240,200,1)', 'rgba(255,255,255,0)']);
  var lit = [], lines = [];
  var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -DEPTH);
  var from = null;                     // the star a drag started from
  var look = { x: 0, y: 0, tx: 0, ty: 0 };

  function noteFor(y) { return 4.5 + y * 0.45; }

  function light(at) {
    if (lit.length >= MAX_STARS) fade(lit[0], 0);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      color: new THREE.Color().setHSL(Util.rand(0.08, 0.16), 0.7, 0.8)
    }));
    sprite.position.copy(at);
    scene.add(sprite);
    var star = { sprite: sprite, born: -1, phase: Math.random() * 6.28, size: Util.rand(1.5, 2.3) };
    lit.push(star);
    Sound.chime(noteFor(at.y));
    return star;
  }

  function fade(star, seconds) { star.born = Math.min(star.born, clock - STAR_LIFE + seconds); }

  function near(at, except) {
    var best = null, bestD = 1.3;
    lit.forEach(function (s) {
      var d = s.sprite.position.distanceTo(at);
      if (s !== except && d < bestD) { best = s; bestD = d; }
    });
    return best;
  }

  function join(a, b) {
    var already = lines.some(function (l) { return (l.a === a && l.b === b) || (l.a === b && l.b === a); });
    if (already) return;
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: lineTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    var pa = a.sprite.position, pb = b.sprite.position;
    mesh.position.copy(pa).add(pb).multiplyScalar(0.5);
    mesh.position.z -= 0.05;
    mesh.rotation.z = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    mesh.scale.set(pa.distanceTo(pb), 0.32, 1);
    scene.add(mesh);
    lines.push({ mesh: mesh, a: a, b: b });
    Sound.chime(noteFor(pb.y));
  }

  function brightness(star) {
    var age = clock - star.born;
    return Math.min(1, age * 2.5) * Math.max(0, Math.min(1, (STAR_LIFE - age) / 8));
  }

  var clock = 0;

  return {
    scene: scene, camera: camera,

    down: function (p) {
      var at = Util.onPlane(p, camera, plane);
      if (!at) return;
      from = near(at, null);
      if (from) Sound.chime(noteFor(from.sprite.position.y));
      else from = light(at);
    },

    move: function (p, pressed) {
      look.tx = p.nx; look.ty = p.ny;
      if (!pressed || !from) return;
      var at = Util.onPlane(p, camera, plane);
      var other = at && near(at, from);
      if (other) { join(from, other); from = other; }
    },

    up: function () { from = null; },

    resize: function (w, h) { farMat.uniforms.uScale.value = Math.min(window.devicePixelRatio || 1, 2); },

    update: function (dt, t) {
      clock = t;
      farMat.uniforms.uTime.value = t;

      // Ease the camera toward the finger for a gentle parallax.
      look.x += (look.tx - look.x) * Math.min(1, dt * 1.5);
      look.y += (look.ty - look.y) * Math.min(1, dt * 1.5);
      camera.position.set(look.x * 0.9, look.y * 0.5, 0);
      camera.lookAt(look.x * 0.3, 2 + look.y * 0.2, -30);

      for (var i = lit.length - 1; i >= 0; i--) {
        var s = lit[i];
        if (s.born < 0) s.born = t;
        var b = brightness(s);
        s.sprite.material.opacity = b;
        s.sprite.scale.setScalar(s.size * (0.85 + 0.15 * Math.sin(t * 2.2 + s.phase)) * (0.4 + 0.6 * b));
        if (t - s.born > STAR_LIFE) {
          scene.remove(s.sprite);
          s.sprite.material.dispose();
          s.gone = true;
          lit.splice(i, 1);
        }
      }
      for (var j = lines.length - 1; j >= 0; j--) {
        var l = lines[j];
        if (l.a.gone || l.b.gone) {
          scene.remove(l.mesh);
          l.mesh.geometry.dispose(); l.mesh.material.dispose();
          lines.splice(j, 1);
        } else {
          l.mesh.material.opacity = 0.75 * Math.min(brightness(l.a), brightness(l.b));
        }
      }
    }
  };
};
