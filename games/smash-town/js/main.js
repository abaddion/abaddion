/*
 * Game shell: 3D renderer, camera, touch and keyboard steering, buttons, main loop.
 *
 * Steering: touch (or click) anywhere and the car drives to that spot.
 * Keep the finger down and drag to keep steering. Arrow keys work on a keyboard.
 */
(function () {
  'use strict';

  var C = Smash.CONFIG, Sound = Smash.Sound;
  var canvas = document.getElementById('stage');
  var hint = document.getElementById('hint');
  var clarityPlayed = false;

  function markPlayed() {
    if (clarityPlayed || typeof window.clarity !== 'function') return;
    clarityPlayed = true;
    window.clarity('event', 'smash-town-play');
  }

  // ---------- renderer, scene, light ----------
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = C.SHADOWS;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#7cc47f');
  var camera = new THREE.PerspectiveCamera(40, 1, 1, 400);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 0.9));
  var sun = new THREE.DirectionalLight(0xfff4dd, 1.25);
  sun.castShadow = C.SHADOWS;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -55;
  sun.shadow.camera.right = sun.shadow.camera.top = 55;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);

  // ---------- the world ----------
  var town = Smash.createTown(scene);
  var car = Smash.createCar(scene, town);
  var monster = Smash.createMonster(scene, town, car);
  var paint = Smash.createPaint(scene, town, car);

  // ---------- camera: from above, following the car ----------
  var view = { x: car.x, z: car.z, shake: 0, height: C.CAMERA_HEIGHT };

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.height = C.CAMERA_HEIGHT * (w < h ? 1.25 : 1);   // a little higher when the screen is tall
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- steering ----------
  var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  var keys = {};

  function steerTo(e) {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(groundPlane, hit)) car.target = { x: hit.x, z: hit.z };
  }

  canvas.addEventListener('pointerdown', function (e) {
    Sound.unlock();
    markPlayed();
    hint.classList.add('gone');
    steerTo(e);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.buttons > 0 || e.pointerType === 'touch') steerTo(e);
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    Sound.unlock();
    markPlayed();
    hint.classList.add('gone');
  });
  window.addEventListener('keyup', function (e) { keys[e.key] = false; });

  function keyboardSteering() {
    var x = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
    var z = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (x || z) car.target = { x: car.x + x * 12, z: car.z + z * 12 };
  }

  // ---------- buttons ----------
  var colourBar = document.getElementById('colours');
  C.CAR_COLOURS.forEach(function (hex, index) {
    var b = document.createElement('button');
    b.style.setProperty('--c', hex);
    b.setAttribute('aria-label', 'Car colour ' + (index + 1));
    if (index === 0) b.className = 'active';
    b.addEventListener('click', function () {
      Sound.unlock();
      car.setColour(hex);
      Sound.beep();
      Array.prototype.forEach.call(colourBar.children, function (c) { c.classList.toggle('active', c === b); });
    });
    colourBar.appendChild(b);
  });

  var monsterButton = document.getElementById('monster');
  function showMonster(on) {
    monster.setOn(on);
    monsterButton.classList.toggle('on', on);
    monsterButton.setAttribute('aria-pressed', on);
  }
  showMonster(C.MONSTER_ON);
  monsterButton.addEventListener('click', function () { Sound.unlock(); showMonster(!monster.on); });

  var soundButton = document.getElementById('sound'), soundOn = true;
  soundButton.addEventListener('click', function () {
    soundOn = !soundOn;
    Sound.unlock();
    Sound.setMuted(!soundOn);
    soundButton.textContent = soundOn ? '🔊' : '🔇';
    soundButton.setAttribute('aria-pressed', soundOn);
  });

  // ---------- main loop ----------
  var last = performance.now(), time = 0;

  function frame(now) {
    var dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    time += dt;

    keyboardSteering();
    car.update(dt);

    // Smash whatever the car drives into.
    if (car.moving > 1.5) {
      var hits = town.smash(car.x + car.dirX * 0.9, car.z + car.dirZ * 0.9, 1.35, car.dirX, car.dirZ, car.moving);
      if (hits) {
        car.speed *= 0.86;
        car.vx *= 0.86; car.vz *= 0.86;
        view.shake = Math.min(1, view.shake + 0.25 + hits * 0.08);
        Sound.crash(hits);
      }
    }

    town.update(dt, { x: car.x, z: car.z, speed: car.moving, dirX: car.dirX, dirZ: car.dirZ });
    monster.update(dt, time);
    paint.update(dt);
    Sound.engine(Math.min(1, car.moving / C.CAR_SPEED));

    // Camera eases after the car, looking a little ahead of it.
    var ease = Math.min(1, dt * 3);
    view.x += (car.x + car.vx * 0.35 - view.x) * ease;
    view.z += (car.z + car.vz * 0.35 - view.z) * ease;
    view.shake = Math.max(0, view.shake - dt * 3);
    var sx = (Math.random() - 0.5) * view.shake * 0.9, sz = (Math.random() - 0.5) * view.shake * 0.9;
    camera.position.set(view.x + sx, view.height, view.z + C.CAMERA_TILT + sz);
    camera.lookAt(view.x + sx, 0, view.z + sz);

    sun.position.set(view.x - 30, 70, view.z + 25);
    sun.target.position.set(view.x, 0, view.z);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  Smash.debug = { car: car, town: town, monster: monster, paint: paint };   // handy in the browser console
  requestAnimationFrame(frame);
})();
