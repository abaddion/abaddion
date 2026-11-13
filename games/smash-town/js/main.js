/*
 * Game shell: 3D renderer, camera, touch and keyboard steering, buttons, main loop.
 */
(function () {
  'use strict';

  var C = Smash.CONFIG;
  var Sound = Smash.Sound;
  var canvas = document.getElementById('stage');
  var hint = document.getElementById('hint');
  var clarityPlayed = false;

  function markPlayed() {
    if (clarityPlayed || typeof window.clarity !== 'function') return;
    clarityPlayed = true;
    window.clarity('event', 'smash-town-play');
  }

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = C.SHADOWS;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#8ebe90');
  var camera = new THREE.PerspectiveCamera(40, 1, 1, 520);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 0.9));
  var sun = new THREE.DirectionalLight(0xfff4dd, 1.25);
  sun.castShadow = C.SHADOWS;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -120;
  sun.shadow.camera.right = sun.shadow.camera.top = 120;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 280;
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);

  var world = Smash.createWorld(scene);
  var town = Smash.createTown(scene);
  var car = Smash.createCar(scene, town, world);
  var monster = Smash.createMonster(scene, town, car);
  var paint = Smash.createPaint(scene, town, car);
  var props = Smash.createProps(scene, town, world, car);
  car._splash = function () {
    props.splash(car.x, car.z, car.typeId === 'monster' || car.typeId === 'bulldozer');
  };
  car._tipDump = function () {
    props.tipDump(car.x + car.dirX * 2, car.z + car.dirZ * 2);
  };

  var picker = document.getElementById('car-picker');
  var pickToggle = document.getElementById('car-pick-toggle');
  var actionBtn = document.getElementById('car-action');
  Smash.Vehicles.list.forEach(function (v) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = v.icon;
    b.setAttribute('aria-label', 'Car ' + v.id);
    b.dataset.id = v.id;
    if (v.id === car.typeId) b.className = 'active';
    b.addEventListener('click', function () {
      Sound.unlock();
      car.swapTo(v.id, function (x, z) {
        props.puff(x, z);
      });
      Array.prototype.forEach.call(picker.children, function (c) {
        c.classList.toggle('active', c === b);
      });
      syncActionBtn();
      pickToggle.setAttribute('aria-expanded', 'false');
      picker.hidden = true;
    });
    picker.appendChild(b);
  });
  pickToggle.addEventListener('click', function () {
    Sound.unlock();
    var open = picker.hidden;
    picker.hidden = !open;
    pickToggle.setAttribute('aria-expanded', String(open));
  });
  function syncActionBtn() {
    var a = car.stats.action;
    actionBtn.hidden = !a;
    actionBtn.textContent = a === 'spray' ? '🚨' : a === 'tip' ? '📤' : '⭐';
  }
  function setPickerActive(id) {
    Array.prototype.forEach.call(picker.children, function (c) {
      c.classList.toggle('active', c.dataset.id === id);
    });
  }
  car._onSwap = function (id) {
    setPickerActive(id);
    syncActionBtn();
  };
  syncActionBtn();
  actionBtn.addEventListener('click', function () {
    Sound.unlock();
    car.triggerAction();
  });

  var view = { x: car.x, z: car.z, shake: 0, height: C.CAMERA_HEIGHT };
  var stats = { fps: 0, frames: 0, acc: 0, draws: 0, zones: {} };

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.height = C.CAMERA_HEIGHT * (w < h ? 1.25 : 1);
  }
  window.addEventListener('resize', resize);
  resize();

  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var hit = new THREE.Vector3();
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
    car._pointerDown = true;
    steerTo(e);
  });
  canvas.addEventListener('pointerup', function () {
    car._pointerDown = false;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.buttons > 0 || e.pointerType === 'touch') steerTo(e);
  });
  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    Sound.unlock();
    markPlayed();
    hint.classList.add('gone');
    car._pointerDown = true;
  });
  window.addEventListener('keyup', function (e) {
    keys[e.key] = false;
    if (!keys.ArrowUp && !keys.ArrowDown && !keys.ArrowLeft && !keys.ArrowRight && !keys.a && !keys.w) {
      car._pointerDown = false;
    }
  });

  function keyboardSteering() {
    var x = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
    var z = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (x || z) car.target = { x: car.x + x * 12, z: car.z + z * 12 };
  }

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
      Array.prototype.forEach.call(colourBar.children, function (c) {
        c.classList.toggle('active', c === b);
      });
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
  monsterButton.addEventListener('click', function () {
    Sound.unlock();
    showMonster(!monster.on);
  });

  var soundButton = document.getElementById('sound');
  var soundOn = true;
  soundButton.addEventListener('click', function () {
    soundOn = !soundOn;
    Sound.unlock();
    Sound.setMuted(!soundOn);
    soundButton.textContent = soundOn ? '🔊' : '🔇';
    soundButton.setAttribute('aria-pressed', soundOn);
  });

  var last = performance.now();
  var time = 0;
  var zone = 'town';
  var zoneT = 0;

  function frame(now) {
    var dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    time += dt;

    stats.acc += dt;
    stats.frames += 1;
    if (stats.acc >= 0.5) {
      stats.fps = Math.round(stats.frames / stats.acc);
      stats.frames = 0;
      stats.acc = 0;
    }

    keyboardSteering();
    car.update(dt);

    if (car.moving > 1.2 || car.sprayT > 0) {
      var rad = car.smashRadius();
      var hx = car.x + car.dirX * (0.9 + (car.stats.push ? 1.2 : 0));
      var hz = car.z + car.dirZ * (0.9 + (car.stats.push ? 1.2 : 0));
      var power = car.moving + (car.sprayT > 0 ? 8 : 0);
      var hits = town.smash(hx, hz, rad, car.dirX, car.dirZ, power);
      if (car.stats.push && car.moving > 0.8) {
        hits += town.smash(hx + car.dirX * 1.8, hz + car.dirZ * 1.8, rad * 0.9, car.dirX, car.dirZ, power * 0.8);
      }
      if (hits) {
        car.speed *= 0.86;
        car.vx *= 0.86;
        car.vz *= 0.86;
        view.shake = Math.min(1, view.shake + 0.25 + hits * 0.08);
        Sound.crash(hits);
        if (car.typeId === 'dump') car.dumpCargo = Math.min(1, car.dumpCargo + hits * 0.08);
      }
    }
    props.checkGarages(car);

    town.update(dt, { x: car.x, z: car.z, speed: car.moving, dirX: car.dirX, dirZ: car.dirZ });
    monster.update(dt, time);
    paint.update(dt);
    props.update(dt, car.x, car.z);

    var nz = world.zoneAt(car.x, car.z);
    if (nz !== zone) {
      zone = nz;
      Sound.setZoneAmbience(zone);
    }
    zoneT += dt;

    Sound.engine(Math.min(1, car.moving / C.CAR_SPEED));

    var ease = Math.min(1, dt * 3);
    view.x += (car.x + car.vx * 0.35 - view.x) * ease;
    view.z += (car.z + car.vz * 0.35 - view.z) * ease;
    view.shake = Math.max(0, view.shake - dt * 3);
    var speedZoom = Math.min(1, car.moving / C.CAR_SPEED) * C.CAMERA_SPEED_ZOOM;
    var sx = (Math.random() - 0.5) * view.shake * 0.9;
    var sz = (Math.random() - 0.5) * view.shake * 0.9;
    var camH = view.height * (1 + speedZoom);
    camera.position.set(view.x + sx, camH, view.z + C.CAMERA_TILT + sz);
    camera.lookAt(view.x + sx, world.heightAt(view.x, view.z) + 1, view.z + sz);

    sun.position.set(view.x - 30, 70, view.z + 25);
    sun.target.position.set(view.x, world.heightAt(view.x, view.z), view.z);

    renderer.info.reset();
    renderer.render(scene, camera);
    stats.draws = renderer.info.render.calls;
    if (!stats.zones[zone]) stats.zones[zone] = { maxFps: stats.fps, draws: stats.draws };
    stats.zones[zone].lastFps = stats.fps;
    stats.zones[zone].draws = stats.draws;

    requestAnimationFrame(frame);
  }

  Smash.debug = { car: car, town: town, world: world, monster: monster, paint: paint, props: props, stats: stats };
  requestAnimationFrame(frame);
})();
