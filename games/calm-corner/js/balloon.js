/*
 * BREATHING BALLOON — a sleepy balloon swells and shrinks slowly.
 * The child breathes in as it grows and out as it shrinks.
 *   touch the balloon -> it sways gently
 * Nothing else happens, on purpose: this one is for winding down.
 */
Games.balloon = function (ctx) {
  'use strict';

  var BREATHE_IN = 4;      // seconds
  var BREATHE_OUT = 5;     // seconds (a longer out-breath is the calming part)

  var scene = new THREE.Scene();
  scene.background = Util.gradient(['#141a44', '#2e2b66', '#6a4c8c', '#c98a9a']);
  var camera = new THREE.PerspectiveCamera(45, ctx.aspect, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x4a3560, 0.85));
  var key = new THREE.DirectionalLight(0xfff0e0, 1.0);
  key.position.set(-4, 6, 8);
  scene.add(key);

  // ---- the sleepy face, painted onto the balloon's skin ----
  var face = document.createElement('canvas');
  face.width = 1024; face.height = 512;
  var g = face.getContext('2d');
  g.fillStyle = '#ff9db0';
  g.fillRect(0, 0, 1024, 512);
  var cx = 256, cy = 250;                       // this spot on the texture faces the camera
  g.fillStyle = 'rgba(255, 90, 120, 0.35)';     // rosy cheeks
  [-78, 78].forEach(function (dx) { g.beginPath(); g.ellipse(cx + dx, cy + 34, 24, 15, 0, 0, 6.2832); g.fill(); });
  g.strokeStyle = '#5a2a45';
  g.lineWidth = 7;
  g.lineCap = 'round';
  [-48, 48].forEach(function (dx) {             // closed, sleepy eyes
    g.beginPath(); g.arc(cx + dx, cy - 6, 20, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  });
  g.beginPath(); g.arc(cx, cy + 30, 16, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();   // small smile
  var faceTex = new THREE.CanvasTexture(face);
  faceTex.encoding = THREE.sRGBEncoding;

  // ---- balloon ----
  var balloon = new THREE.Group();
  var body = new THREE.Mesh(new THREE.SphereGeometry(1.7, 64, 48),
    new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }));
  body.scale.y = 1.14;
  var knot = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0xf07f97, roughness: 0.4 }));
  knot.position.y = -2.02;
  var curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -2.15, 0), new THREE.Vector3(0.18, -3.0, 0), new THREE.Vector3(-0.15, -3.9, 0),
    new THREE.Vector3(0.12, -4.8, 0), new THREE.Vector3(0, -5.8, 0)]);
  var string = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.02, 6), new THREE.MeshBasicMaterial({ color: 0xf4e9ff }));
  balloon.add(body, knot, string);
  scene.add(balloon);

  // ---- a soft ring that shows the breath ----
  var ring = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.0, 96),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
  ring.position.z = -1.5;
  scene.add(ring);

  // ---- slow drifting lights at different depths ----
  var N = 90, pos = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) {
    pos[i * 3] = Util.rand(-12, 12); pos[i * 3 + 1] = Util.rand(-8, 8); pos[i * 3 + 2] = Util.rand(-14, 4);
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: Util.glow(), size: 0.5, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  scene.add(dust);

  var sound = Sound.breath();
  var sway = 0, swaySpeed = 0;
  var cycle = BREATHE_IN + BREATHE_OUT;

  function ease(x) { return x * x * (3 - 2 * x); }

  return {
    scene: scene, camera: camera,

    down: function (p) {
      if (Util.ray(p, camera).intersectObject(body).length) swaySpeed += p.nx < 0 ? 1.4 : -1.4;
    },

    dispose: function () { sound.stop(); },

    update: function (dt, t) {
      var phase = t % cycle;
      var breathingIn = phase < BREATHE_IN;
      var amount = breathingIn ? ease(phase / BREATHE_IN) : 1 - ease((phase - BREATHE_IN) / BREATHE_OUT);
      // loudest in the middle of each breath, silent at the turn
      var flow = breathingIn ? Math.sin(phase / BREATHE_IN * Math.PI) : Math.sin((phase - BREATHE_IN) / BREATHE_OUT * Math.PI);
      sound.set(flow, breathingIn ? 1 : 0.25);

      // gentle spring so a touch makes it sway and settle
      swaySpeed += (-sway * 6 - swaySpeed * 1.2) * dt;
      sway += swaySpeed * dt;

      balloon.scale.setScalar(0.72 + 0.5 * amount);
      balloon.position.y = 0.9 + Math.sin(t * 0.5) * 0.15;
      balloon.rotation.z = sway * 0.35 + Math.sin(t * 0.4) * 0.03;
      balloon.rotation.y = sway * 0.25 + Math.sin(t * 0.3) * 0.08;

      ring.position.y = balloon.position.y;
      ring.scale.setScalar(0.72 + 0.5 * amount);
      ring.material.opacity = 0.12 + 0.3 * amount;

      dust.material.opacity = 0.25 + 0.4 * amount;
      var a = dustGeo.attributes.position;
      for (var i = 0; i < N; i++) {
        a.array[i * 3 + 1] += dt * 0.12;
        if (a.array[i * 3 + 1] > 8) a.array[i * 3 + 1] = -8;
      }
      a.needsUpdate = true;
    }
  };
};
