/*
 * The things that move: the car, the monster, and the paint.
 * Each create function returns an object with an update(dt, ...) method.
 */
(function () {
  'use strict';

  function rand(a, b) { return a + Math.random() * (b - a); }
  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  // A rounded rectangle lying flat on the ground, `height` tall.
  function slab(width, length, radius, height) {
    var w = width / 2, l = length / 2, r = radius, shape = new THREE.Shape();
    shape.moveTo(-w + r, -l);
    shape.lineTo(w - r, -l); shape.quadraticCurveTo(w, -l, w, -l + r);
    shape.lineTo(w, l - r); shape.quadraticCurveTo(w, l, w - r, l);
    shape.lineTo(-w + r, l); shape.quadraticCurveTo(-w, l, -w, l - r);
    shape.lineTo(-w, -l + r); shape.quadraticCurveTo(-w, -l, -w + r, -l);
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: height, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 10
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  // ================================================================== CAR
  // A small toy city car. Its front points along +z of the group.
  Smash.createCar = function (scene, town) {
    var C = Smash.CONFIG;
    var group = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({ color: C.CAR_COLOURS[0], roughness: 0.3, metalness: 0.15 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.15, metalness: 0.4 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.8 });
    var white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

    function part(geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      group.add(m);
      return m;
    }

    part(slab(2.0, 3.9, 0.6, 0.55), paint, 0, 0.35, 0);                // body
    part(slab(1.72, 2.1, 0.5, 0.5), glass, 0, 0.98, -0.25);            // windows
    part(slab(1.66, 1.9, 0.5, 0.1), paint, 0, 1.56, -0.25);            // roof
    part(new THREE.BoxGeometry(0.5, 0.03, 3.5), white, 0, 1.0, 0);      // racing stripe: bonnet and boot
    part(new THREE.BoxGeometry(0.5, 0.03, 1.7), white, 0, 1.76, -0.25); // racing stripe: roof
    part(new THREE.BoxGeometry(1.9, 0.25, 0.2), dark, 0, 0.42, 1.98);   // bumpers
    part(new THREE.BoxGeometry(1.9, 0.25, 0.2), dark, 0, 0.42, -1.98);
    var lamp = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
    var tail = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xaa0000, emissiveIntensity: 0.8 });
    [-0.62, 0.62].forEach(function (x) {
      part(new THREE.BoxGeometry(0.42, 0.2, 0.12), lamp, x, 0.78, 1.93);
      part(new THREE.BoxGeometry(0.42, 0.18, 0.12), tail, x, 0.78, -1.93);
    });
    var wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.34, 18);
    wheelGeo.rotateZ(Math.PI / 2);
    [[-1.0, 1.25], [1.0, 1.25], [-1.0, -1.25], [1.0, -1.25]].forEach(function (w) {
      part(wheelGeo, dark, w[0], 0.44, w[1]);
    });
    scene.add(group);

    var car = {
      group: group,
      x: 10, z: 10,                 // starts on a crossroads
      heading: 0,                   // 0 = facing +z
      speed: 0,                     // how fast the engine is pushing
      vx: 0, vz: 0,                 // how it is actually moving (differs while drifting)
      dirX: 0, dirZ: 1,
      spin: 0,                      // extra turning from a drift or being caught
      drift: 0,                     // seconds of sliding left
      paintTime: 0, paintColour: '#fff',
      swallowedAt: new THREE.Vector3(),
      hop: 0,
      target: null,                 // where the finger wants it to go: { x, z }
      eaten: false                  // true while it is inside the monster
    };
    car.x = town.roads[Math.floor(town.roads.length / 2)];
    car.z = car.x;

    car.setColour = function (hex) { paint.color.set(hex); car.hop = 1; };

    car.spinOut = function () { car.spin = (Math.random() < 0.5 ? -1 : 1) * 15; car.speed = 0; car.drift = 0.8; };

    car.slide = function (colour) {
      car.drift = C.DRIFT_TIME;
      car.spin += (Math.random() < 0.5 ? -1 : 1) * rand(4, 7);
      car.paintTime = C.TRACK_TIME;
      car.paintColour = colour;
    };

    // Called by the monster when it spits the car back out.
    car.release = function (x, z) {
      car.eaten = false;
      car.x = Math.max(-town.edge, Math.min(town.edge, x));
      car.z = Math.max(-town.edge, Math.min(town.edge, z));
      group.scale.setScalar(1);
      car.hop = 1;
      car.spin = (Math.random() < 0.5 ? -1 : 1) * 9;
      car.drift = 0.6;
    };

    car.update = function (dt) {
      if (car.eaten) {                                   // shrinking into the monster's tummy
        car.target = null;
        car.speed = car.vx = car.vz = car.moving = 0;
        group.scale.setScalar(Math.max(0.001, group.scale.x - dt * 3.5));
        group.position.lerp(car.swallowedAt, Math.min(1, dt * 8));
        group.rotation.y += dt * 9;
        return;
      }
      var want = 0;
      if (car.target) {
        var dx = car.target.x - car.x, dz = car.target.z - car.z, dist = Math.hypot(dx, dz);
        if (dist < 1.6) {
          car.target = null;                             // arrived
        } else {
          var diff = wrap(Math.atan2(dx, dz) - car.heading);
          var maxTurn = C.CAR_TURN * (0.45 + Math.min(1, Math.abs(car.speed) / 6)) * dt;
          car.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
          want = C.CAR_SPEED * Math.max(0.35, Math.min(1, dist / 8));
          if (Math.abs(diff) > 1.6) want *= 0.45;        // slow down for a U-turn
        }
      }
      car.speed += (want - car.speed) * Math.min(1, dt * 2.6);

      car.heading += car.spin * dt;
      car.spin *= Math.exp(-2.4 * dt);
      car.drift = Math.max(0, car.drift - dt);
      car.paintTime = Math.max(0, car.paintTime - dt);

      // Normally the tyres grip and the car goes where it points.
      // On paint the grip nearly disappears, so it keeps sliding the old way.
      var grip = car.drift > 0 ? 0.9 : 9;
      var fx = Math.sin(car.heading) * car.speed, fz = Math.cos(car.heading) * car.speed;
      car.vx += (fx - car.vx) * Math.min(1, grip * dt);
      car.vz += (fz - car.vz) * Math.min(1, grip * dt);
      car.x = Math.max(-town.edge, Math.min(town.edge, car.x + car.vx * dt));
      car.z = Math.max(-town.edge, Math.min(town.edge, car.z + car.vz * dt));

      var moving = Math.hypot(car.vx, car.vz);
      if (moving > 0.5) { car.dirX = car.vx / moving; car.dirZ = car.vz / moving; }
      car.moving = moving;

      car.hop = Math.max(0, car.hop - dt * 2.5);
      group.position.set(car.x, Math.sin(car.hop * Math.PI) * 0.9, car.z);
      group.rotation.y = car.heading;
    };

    car.update(0);
    return car;
  };

  // ============================================================== MONSTER
  // A round hopping monster with googly eyes. He is slow, and when he catches
  // the car he gulps it down, chews, and spits it back out unharmed.
  Smash.createMonster = function (scene, town, car) {
    var C = Smash.CONFIG;
    var group = new THREE.Group();
    var skin = new THREE.MeshStandardMaterial({ color: C.MONSTER_COLOUR, roughness: 0.55 });
    var SIZE = C.MONSTER_SIZE;
    var spot = new THREE.MeshStandardMaterial({ color: 0x35d0c0, roughness: 0.6 });
    var whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    var black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });

    var body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 24), skin);
    body.scale.y = 0.85;
    body.position.y = 1.4;
    body.castShadow = true;
    group.add(body);

    for (var n = 0; n < 7; n++) {                    // teal spots on his back
      var a = n * 2.4, rr = 0.5 + (n % 3) * 0.35;
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), spot);
      s.scale.y = 0.3;
      s.position.set(Math.cos(a) * rr, 1.4 + 1.33 * Math.sqrt(Math.max(0, 1 - rr * rr / 2.56)), Math.sin(a) * rr - 0.2);
      group.add(s);
    }

    var pupils = [];
    [-0.6, 0.6].forEach(function (x) {               // googly eyes on stalks
      var stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.9, 10), skin);
      stalk.position.set(x, 2.9, 0.75);
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 14), whiteMat);
      eye.position.set(x, 3.5, 0.75);
      eye.castShadow = true;
      var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), black);
      pupil.position.set(x, 3.78, 0.95);
      group.add(stalk, eye, pupil);
      pupils.push({ mesh: pupil, x: x });
    });

    var horn = new THREE.MeshStandardMaterial({ color: 0xffd54a, roughness: 0.5 });
    [-1.05, 1.05].forEach(function (x) {
      var h = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 10), horn);
      h.position.set(x, 2.35, -0.2);
      h.rotation.z = -x * 0.5;
      group.add(h);
    });
    var mouth = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), new THREE.MeshStandardMaterial({ color: 0x2a0f3a, roughness: 0.9 }));
    mouth.position.set(0, 1.25, 1.2);
    mouth.scale.set(1, 0.15, 0.6);
    group.add(mouth);
    var tongue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.9), new THREE.MeshStandardMaterial({ color: 0xff7aa8 }));
    tongue.position.set(0, 1.1, 1.75);
    group.add(tongue);

    scene.add(group);

    var m = { group: group, x: 0, z: 0, on: false, flee: 0, heading: 0, full: 0 };

    m.setOn = function (on) {
      m.on = on;
      group.visible = on;
      if (!on && car.eaten) car.release(m.x, m.z);    // switched off mid-meal: give the car back
      m.full = 0;
      if (on) {                                       // arrive a fair distance away
        var a = Math.random() * Math.PI * 2;
        m.x = Math.max(-town.edge, Math.min(town.edge, car.x + Math.cos(a) * 32));
        m.z = Math.max(-town.edge, Math.min(town.edge, car.z + Math.sin(a) * 32));
        m.flee = 0;
      }
    };

    m.update = function (dt, t) {
      if (!m.on) return;
      var dx = car.x - m.x, dz = car.z - m.z, dist = Math.hypot(dx, dz) || 1;
      var away = m.flee > 0 ? -1.4 : 1;
      m.flee = Math.max(0, m.flee - dt);

      // Tummy full: he stands still and chews, then spits the car out unharmed.
      if (m.full > 0) {
        m.full -= dt;
        var chew = Math.abs(Math.sin(t * 14));
        group.position.set(m.x, 0, m.z);
        group.scale.set(SIZE * (1.22 + chew * 0.06), SIZE * (1.0 - chew * 0.1), SIZE * (1.22 + chew * 0.06));
        mouth.scale.y = 0.15 + chew * 0.35;
        if (m.full <= 0) {
          var reach = 2.6 * SIZE + 2;
          car.release(m.x + Math.sin(m.heading) * reach, m.z + Math.cos(m.heading) * reach);
          Smash.Sound.spit();
          m.flee = 4.5;
        }
        return;
      }

      if (dist > 70) { m.setOn(true); return; }       // left far behind: catch up
      var close = Math.max(0, 1 - (dist - 1.7 * SIZE) / 9);
      mouth.scale.y = 0.15 + (m.flee > 0 ? 0 : close) * 0.75;   // mouth opens as he gets near
      if (m.flee === 0 && !car.eaten && dist < 1.7 * SIZE + 1) {   // caught the car: gulp!
        car.eaten = true;
        car.swallowedAt.set(m.x, 1.3 * SIZE, m.z);
        m.full = C.EATEN_TIME;
        Smash.Sound.gulp();
        return;
      }

      var ux = dx / dist * away, uz = dz / dist * away;
      m.x = Math.max(-town.edge, Math.min(town.edge, m.x + ux * C.MONSTER_SPEED * dt));
      m.z = Math.max(-town.edge, Math.min(town.edge, m.z + uz * C.MONSTER_SPEED * dt));
      town.smash(m.x, m.z, 1.5 * SIZE, ux, uz, 6);    // he knocks things over too

      m.heading += wrap(Math.atan2(ux, uz) - m.heading) * Math.min(1, dt * 5);
      var hop = Math.abs(Math.sin(t * 5.5));
      group.position.set(m.x, hop * 0.9 * SIZE, m.z);
      group.rotation.y = m.heading;
      group.scale.set(SIZE * (1 + (1 - hop) * 0.12), SIZE * (0.88 + hop * 0.2), SIZE * (1 + (1 - hop) * 0.12));   // squash and stretch
      pupils.forEach(function (p, i) { p.mesh.position.x = p.x + Math.sin(t * 3 + i) * 0.12; });
    };

    m.setOn(C.MONSTER_ON);
    return m;
  };

  // ================================================================ PAINT
  // Now and then a ball of paint drops out of the sky onto a road near the
  // car. Driving through the splat makes the car slide and leave coloured
  // tyre tracks.
  Smash.createPaint = function (scene, town, car) {
    var C = Smash.CONFIG;
    var splats = [];
    var next = rand(3, 5);
    var ballGeo = new THREE.SphereGeometry(0.9, 16, 12);

    // tyre tracks: a ring of small flat marks that get reused
    var TRACKS = 700, trackIndex = 0, lastX = 0, lastZ = 0;
    var trackGeo = new THREE.PlaneGeometry(0.36, 0.95);
    trackGeo.rotateX(-Math.PI / 2);
    var tracks = new THREE.InstancedMesh(trackGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), TRACKS);
    tracks.frustumCulled = false;
    tracks.count = 0;
    scene.add(tracks);
    var dummy = new THREE.Object3D(), colour = new THREE.Color();

    function layTrack(x, z) {
      dummy.position.set(x, 0.03, z);
      dummy.rotation.set(0, car.heading, 0);
      dummy.updateMatrix();
      tracks.setMatrixAt(trackIndex, dummy.matrix);
      tracks.setColorAt(trackIndex, colour.set(car.paintColour));
      trackIndex = (trackIndex + 1) % TRACKS;
      tracks.count = Math.min(TRACKS, tracks.count + 1);
      tracks.instanceMatrix.needsUpdate = true;
      tracks.instanceColor.needsUpdate = true;
    }

    function blobGeometry(r) {                        // a wobbly splat shape
      var shape = new THREE.Shape(), points = 14;
      for (var i = 0; i <= points; i++) {
        var a = i / points * Math.PI * 2, rr = r * (i % 2 ? rand(0.62, 0.8) : rand(0.95, 1.2));
        if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else shape.quadraticCurveTo(Math.cos(a - Math.PI / points) * r * 0.95, Math.sin(a - Math.PI / points) * r * 0.95, Math.cos(a) * rr, Math.sin(a) * rr);
      }
      var geo = new THREE.ShapeGeometry(shape, 6);
      geo.rotateX(-Math.PI / 2);
      return geo;
    }

    function nearestRoad(v) {
      return town.roads.reduce(function (best, r) { return Math.abs(r - v) < Math.abs(best - v) ? r : best; }, town.roads[0]);
    }

    function drop() {
      // Aim for a road a little way ahead of the car.
      var ahead = rand(10, 22), side = rand(-6, 6);
      var x = car.x + car.dirX * ahead - car.dirZ * side, z = car.z + car.dirZ * ahead + car.dirX * side;
      if (Math.random() < 0.5) x = nearestRoad(x); else z = nearestRoad(z);
      x = Math.max(-town.half, Math.min(town.half, x));
      z = Math.max(-town.half, Math.min(town.half, z));
      var hex = C.PAINT_COLOURS[Math.floor(Math.random() * C.PAINT_COLOURS.length)];
      var ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.25 }));
      ball.position.set(x, 34, z);
      ball.castShadow = true;
      scene.add(ball);
      splats.push({ x: x, z: z, r: rand(2.6, 3.4), hex: hex, ball: ball, blob: null, age: 0, inside: false });
    }

    function remove(s, index) {
      if (s.ball) { scene.remove(s.ball); s.ball.material.dispose(); }
      if (s.blob) { scene.remove(s.blob); s.blob.geometry.dispose(); s.blob.material.dispose(); }
      splats.splice(index, 1);
    }

    return {
      count: function () { return splats.length; },

      update: function (dt) {
        next -= dt;
        if (next <= 0 && splats.length < 5) {
          drop();
          next = rand(C.PAINT_EVERY[0], C.PAINT_EVERY[1]);
        }

        for (var i = splats.length - 1; i >= 0; i--) {
          var s = splats[i];
          if (s.ball) {                               // still falling
            s.ball.position.y -= 34 * dt;
            if (s.ball.position.y <= 0.5) {
              scene.remove(s.ball); s.ball.material.dispose(); s.ball = null;
              s.blob = new THREE.Mesh(blobGeometry(s.r), new THREE.MeshBasicMaterial({ color: s.hex, transparent: true, opacity: 0.92, depthWrite: false }));
              s.blob.position.set(s.x, 0.02, s.z);
              s.blob.rotation.y = Math.random() * 6.28;
              scene.add(s.blob);
              Smash.Sound.splat();
            }
            continue;
          }
          s.age += dt;
          var grow = Math.min(1, s.age * 5), fade = Math.max(0, Math.min(1, 30 - s.age));
          s.blob.scale.setScalar((0.3 + 0.7 * grow) * fade);
          if (s.age > 30) { remove(s, i); continue; }

          var inside = Math.hypot(car.x - s.x, car.z - s.z) < s.r;
          if (inside && !s.inside && car.moving > 2) { car.slide(s.hex); Smash.Sound.skid(); }
          s.inside = inside;
        }

        // Coloured tyre tracks behind the rear wheels.
        if (car.paintTime > 0 && Math.hypot(car.x - lastX, car.z - lastZ) > 0.5) {
          lastX = car.x; lastZ = car.z;
          var sx = Math.sin(car.heading), cz = Math.cos(car.heading);
          [-0.95, 0.95].forEach(function (side) {
            layTrack(car.x + cz * side - sx * 1.25, car.z - sx * side - cz * 1.25);
          });
        }
      }
    };
  };
})();
