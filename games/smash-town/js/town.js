/*
 * The town: ground, roads, and everything that can be smashed.
 *
 * Every building, tree, wall and crate is made of blocks. All blocks are drawn
 * in one batch (an InstancedMesh), so hundreds of them stay fast on a tablet.
 *
 * A block is always in one of these states:
 *   STATIC  standing in its building
 *   WAIT    the block under it was knocked out; it is about to fall
 *   FLY     tumbling through the air
 *   DEBRIS  lying on the ground (the car can kick it again)
 *   HIDDEN  gone, until the building rebuilds
 *   RISE    growing back into place
 *
 * Physics is deliberately simple: blocks bounce on the ground but do not
 * collide with each other.
 */
(function () {
  'use strict';

  var STATIC = 0, WAIT = 1, FLY = 2, DEBRIS = 3, HIDDEN = 4, RISE = 5;
  var GRAVITY = 32;
  var PALETTE = ['#ff6b6b', '#ffd166', '#4ecdc4', '#5b8def', '#c77dff', '#ff9f43', '#f78fb3', '#7bed9f'];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  Smash.createTown = function (scene) {
    var C = Smash.CONFIG;
    var PITCH = C.LOT + C.ROAD;
    var HALF = C.LOTS * PITCH / 2;          // distance from the centre to the outer road
    var EDGE = HALF + C.ROAD / 2 + 4;       // how far the car may go

    // ------------------------------------------------------------ ground
    var SIZE = 2 * (HALF + 24);
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2048;
    var g = canvas.getContext('2d');
    var k = 2048 / SIZE;                    // pixels per world unit
    function px(v) { return (v + SIZE / 2) * k; }

    g.fillStyle = '#7cc47f';
    g.fillRect(0, 0, 2048, 2048);
    var roads = [];
    for (var r = 0; r <= C.LOTS; r++) roads.push(-HALF + r * PITCH);
    g.fillStyle = '#4b505c';
    roads.forEach(function (c) {
      g.fillRect(px(c - C.ROAD / 2), px(-HALF - C.ROAD / 2), C.ROAD * k, (2 * HALF + C.ROAD) * k);
      g.fillRect(px(-HALF - C.ROAD / 2), px(c - C.ROAD / 2), (2 * HALF + C.ROAD) * k, C.ROAD * k);
    });
    g.strokeStyle = '#f4f1e6';
    g.lineWidth = 0.28 * k;
    g.setLineDash([1.6 * k, 1.6 * k]);
    roads.forEach(function (c) {
      g.beginPath(); g.moveTo(px(c), px(-HALF)); g.lineTo(px(c), px(HALF)); g.stroke();
      g.beginPath(); g.moveTo(px(-HALF), px(c)); g.lineTo(px(HALF), px(c)); g.stroke();
    });
    g.setLineDash([]);

    var groundTex = new THREE.CanvasTexture(canvas);
    groundTex.encoding = THREE.sRGBEncoding;
    groundTex.anisotropy = 8;
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    function paveLot(cx, cz, colour) {
      var m = 0.7, s = C.LOT - 2 * m, rad = 1.4 * k;
      var x = px(cx - s / 2), y = px(cz - s / 2), w = s * k;
      g.fillStyle = colour;
      g.beginPath();
      g.moveTo(x + rad, y);
      g.arcTo(x + w, y, x + w, y + w, rad); g.arcTo(x + w, y + w, x, y + w, rad);
      g.arcTo(x, y + w, x, y, rad); g.arcTo(x, y, x + w, y, rad);
      g.fill();
    }

    // ------------------------------------------------------------ blocks
    var MAX = 3200;
    var mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.7 }), MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);

    var blocks = [], structures = [], active = [];
    var dummy = new THREE.Object3D(), colour = new THREE.Color();
    var dirty = false;

    function write(b) {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(b.rx, b.ry, b.rz);
      dummy.scale.set(b.sx * b.k, b.sy * b.k, b.sz * b.k);
      dummy.updateMatrix();
      mesh.setMatrixAt(b.i, dummy.matrix);
      dirty = true;
    }

    function wake(b) { if (!b.awake) { b.awake = true; active.push(b); } }

    function addBlock(s, x, y, z, sx, sy, sz, hex, column, floor) {
      if (blocks.length >= MAX) return;
      var b = {
        i: blocks.length, s: s, column: column, floor: floor,
        hx: x, hy: y, hz: z, sx: sx, sy: sy, sz: sz,
        x: x, y: y, z: z, rx: 0, ry: 0, rz: 0, k: 1,
        vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0,
        state: STATIC, t: 0, awake: false
      };
      blocks.push(b);
      s.blocks.push(b);
      mesh.setColorAt(b.i, colour.set(hex));
      write(b);
    }

    function structure() {
      var s = { blocks: [], broken: false, hitAt: 0, minX: 0, maxX: 0, minZ: 0, maxZ: 0, cx: 0, cz: 0 };
      structures.push(s);
      return s;
    }

    function shade(hex, amount) {
      return '#' + colour.set(hex).offsetHSL(0, 0, amount).getHexString();
    }

    // ---- things to smash ----
    function building(cx, cz, nx, nz, floors, w, h) {
      var s = structure(), base = pick(PALETTE), roof = shade(base, 0.13), column = 0;
      for (var ix = 0; ix < nx; ix++) {
        for (var iz = 0; iz < nz; iz++, column++) {
          var x = cx + (ix - (nx - 1) / 2) * w, z = cz + (iz - (nz - 1) / 2) * w;
          for (var f = 0; f < floors; f++) {
            addBlock(s, x, h / 2 + f * h, z, w * 0.97, h * 0.97, w * 0.97, shade(base, f % 2 ? -0.07 : 0), column, f);
          }
          addBlock(s, x, floors * h + 0.2, z, w * 0.99, 0.4, w * 0.99, roof, column, floors);
        }
      }
    }

    function tree(x, z) {
      var s = structure();
      addBlock(s, x, 0.8, z, 0.7, 1.6, 0.7, '#8d5a3b', 0, 0);
      addBlock(s, x, 2.5, z, 2.3, 1.8, 2.3, pick(['#3fa34d', '#52b65f', '#2f8f46']), 0, 1);
      addBlock(s, x, 3.9, z, 1.4, 1.1, 1.4, '#7ad67f', 0, 2);
    }

    function wall(x, z, count, alongX) {
      var s = structure(), c = pick(['#f4a261', '#e9c46a', '#e76f51']);
      for (var n = 0; n < count; n++) {
        var bx = x + (alongX ? (n - (count - 1) / 2) * 1.3 : 0), bz = z + (alongX ? 0 : (n - (count - 1) / 2) * 1.3);
        addBlock(s, bx, 0.6, bz, 1.25, 1.2, 1.25, c, n, 0);
        addBlock(s, bx, 1.8, bz, 1.25, 1.2, 1.25, shade(c, 0.1), n, 1);
      }
    }

    function crates(x, z) {
      var s = structure(), c = pick(['#ffd54a', '#ffb74d', '#fff176']), column = 0;
      for (var ix = 0; ix < 2; ix++) {
        for (var iz = 0; iz < 2; iz++, column++) {
          addBlock(s, x + (ix - 0.5) * 1.35, 0.65, z + (iz - 0.5) * 1.35, 1.3, 1.3, 1.3, c, column, 0);
        }
      }
      addBlock(s, x, 1.95, z, 1.3, 1.3, 1.3, shade(c, -0.12), 0, 1);
    }

    // ---- lay out the town ----
    for (var li = 0; li < C.LOTS; li++) {
      for (var lj = 0; lj < C.LOTS; lj++) {
        var cx = -HALF + PITCH / 2 + li * PITCH, cz = -HALF + PITCH / 2 + lj * PITCH;
        var kind = Math.random();
        if (kind < 0.3) {                     // one big building
          paveLot(cx, cz, '#d9d4c7');
          building(cx, cz, 3, 3, Math.floor(rand(2, 5)), 3.2, 2.3);
        } else if (kind < 0.55) {             // a tall tower with walls
          paveLot(cx, cz, '#d9d4c7');
          building(cx - 2, cz - 2, 2, 2, Math.floor(rand(4, 7)), 2.8, 2.2);
          wall(cx + 3.5, cz + 1, 5, false);
          crates(cx - 2.5, cz + 4);
        } else if (kind < 0.8) {              // small houses and a tree
          paveLot(cx, cz, '#cfe3b4');
          building(cx - 3, cz - 3, 2, 2, Math.floor(rand(1, 3)), 2.6, 2.2);
          building(cx + 3, cz + 2.5, 2, 1, Math.floor(rand(1, 4)), 2.6, 2.2);
          tree(cx + 3.6, cz - 3.6);
          tree(cx - 3.8, cz + 3.6);
        } else {                              // a park
          paveLot(cx, cz, '#9bd68a');
          for (var tn = 0; tn < 5; tn++) tree(cx + rand(-4.6, 4.6), cz + rand(-4.6, 4.6));
          crates(cx + rand(-2, 2), cz + rand(-2, 2));
          wall(cx, cz + 5, 6, true);
        }
      }
    }
    groundTex.needsUpdate = true;
    mesh.count = blocks.length;
    mesh.instanceColor.needsUpdate = true;

    structures.forEach(function (s) {
      s.minX = s.minZ = Infinity; s.maxX = s.maxZ = -Infinity;
      s.blocks.forEach(function (b) {
        s.minX = Math.min(s.minX, b.hx - b.sx / 2); s.maxX = Math.max(s.maxX, b.hx + b.sx / 2);
        s.minZ = Math.min(s.minZ, b.hz - b.sz / 2); s.maxZ = Math.max(s.maxZ, b.hz + b.sz / 2);
      });
      s.cx = (s.minX + s.maxX) / 2; s.cz = (s.minZ + s.maxZ) / 2;
    });

    // ------------------------------------------------------------ smashing
    var clock = 0;

    function launch(b, vx, vy, vz) {
      b.state = FLY;
      b.vx = vx; b.vy = vy; b.vz = vz;
      b.wx = rand(-7, 7); b.wy = rand(-7, 7); b.wz = rand(-7, 7);
      wake(b);
    }

    function knock(b, dx, dz, power, fromX, fromZ) {
      var ax = b.hx - fromX, az = b.hz - fromZ, len = Math.hypot(ax, az) || 1;
      launch(b,
        dx * power * rand(0.5, 1) + ax / len * rand(2, 6),
        rand(5, 11),
        dz * power * rand(0.5, 1) + az / len * rand(2, 6));
      var s = b.s;
      s.broken = true;
      s.hitAt = clock;
      // Everything resting on this block falls a moment later.
      for (var n = 0; n < s.blocks.length; n++) {
        var above = s.blocks[n];
        if (above.column === b.column && above.floor > b.floor && above.state === STATIC) {
          above.state = WAIT;
          above.t = 0.07 * (above.floor - b.floor);
          wake(above);
        }
      }
    }

    // Something of radius r at (x, z), moving in direction (dx, dz), hits the town.
    // Returns how many blocks it knocked out.
    function smash(x, z, r, dx, dz, power) {
      var hits = 0;
      for (var n = 0; n < structures.length; n++) {
        var s = structures[n];
        if (x < s.minX - r || x > s.maxX + r || z < s.minZ - r || z > s.maxZ + r) continue;
        for (var m = 0; m < s.blocks.length; m++) {
          var b = s.blocks[m];
          if (b.state !== STATIC || b.hy - b.sy / 2 > 1.5) continue;      // only blocks at car height
          var nx = Math.max(b.hx - b.sx / 2, Math.min(x, b.hx + b.sx / 2));
          var nz = Math.max(b.hz - b.sz / 2, Math.min(z, b.hz + b.sz / 2));
          if ((x - nx) * (x - nx) + (z - nz) * (z - nz) < r * r) { knock(b, dx, dz, power, x, z); hits++; }
        }
      }
      return hits;
    }

    // ------------------------------------------------------------ every frame
    function update(dt, car) {
      clock += dt;

      for (var n = active.length - 1; n >= 0; n--) {
        var b = active[n], sleep = false;

        if (b.state === WAIT) {
          b.t -= dt;
          if (b.t <= 0) launch(b, rand(-1.5, 1.5), rand(0, 1), rand(-1.5, 1.5));
        } else if (b.state === FLY) {
          b.vy -= GRAVITY * dt;
          b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
          b.rx += b.wx * dt; b.ry += b.wy * dt; b.rz += b.wz * dt;
          var rest = Math.min(b.sx, b.sy, b.sz) / 2;
          if (b.y < rest) {
            b.y = rest;
            if (Math.abs(b.vy) > 3) {                 // bounce
              b.vy *= -0.35; b.vx *= 0.7; b.vz *= 0.7;
              b.wx *= 0.6; b.wy *= 0.6; b.wz *= 0.6;
            } else {                                  // come to rest
              b.state = DEBRIS;
              b.t = C.DEBRIS_TIME + rand(0, 3);
            }
          }
        } else if (b.state === DEBRIS) {
          b.t -= dt;
          var dx = b.x - car.x, dz = b.z - car.z;
          if (car.speed > 3 && dx * dx + dz * dz < 3.4) {   // the car kicks loose blocks around
            launch(b, car.dirX * car.speed * 0.8 + rand(-3, 3), rand(4, 8), car.dirZ * car.speed * 0.8 + rand(-3, 3));
            b.t = C.DEBRIS_TIME;
          } else if (b.t < 1) {
            b.k = Math.max(0, b.t);
            if (b.t <= 0) { b.state = HIDDEN; sleep = true; }
          } else {
            continue;                                 // lying still: nothing to redraw
          }
        } else if (b.state === RISE) {
          b.t += dt;
          var e = Math.max(0, Math.min(1, b.t / 0.45));
          b.k = e * e * (3 - 2 * e);
          if (b.t >= 0.45) { b.state = STATIC; b.k = 1; sleep = true; }
        } else {
          sleep = true;
        }

        write(b);
        if (sleep) { b.awake = false; active.splice(n, 1); }
      }

      // Smashed buildings grow back once the car has driven away.
      for (var m = 0; m < structures.length; m++) {
        var s = structures[m];
        if (!s.broken || clock - s.hitAt < C.REBUILD_AFTER) continue;
        if (Math.hypot(s.cx - car.x, s.cz - car.z) < C.REBUILD_DISTANCE) continue;
        s.broken = false;
        for (var q = 0; q < s.blocks.length; q++) {
          var c = s.blocks[q];
          if (c.state === STATIC) continue;
          c.state = RISE;
          c.t = -0.09 * c.floor;                      // lower floors first
          c.x = c.hx; c.y = c.hy; c.z = c.hz;
          c.rx = c.ry = c.rz = 0;
          c.k = 0;
          wake(c);
          write(c);
        }
      }

      if (dirty) { mesh.instanceMatrix.needsUpdate = true; dirty = false; }
    }

    return {
      smash: smash, update: update,
      edge: EDGE, half: HALF, pitch: PITCH, roads: roads,
      count: function () { return blocks.length; },
      loose: function () { return active.length; }
    };
  };
})();
