/*
 * Forest, river, mountains props — instanced where possible, smash + respawn out of view.
 */
(function () {
  'use strict';

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  Smash.createProps = function (scene, town, world, car) {
    var C = Smash.CONFIG;
    var clock = 0;
    var particles = [];
    var maxPart = 96;
    var partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    var partMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
    var partMesh = new THREE.InstancedMesh(partGeo, partMat, maxPart);
    partMesh.count = 0;
    partMesh.frustumCulled = false;
    scene.add(partMesh);
    var pDummy = new THREE.Object3D();
    var pColour = new THREE.Color();
    var treeDummy = new THREE.Object3D();

    function spawnParticle(x, y, z, vx, vy, vz, colour, life) {
      if (particles.length >= maxPart) particles.shift();
      particles.push({ x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, t: life, life: life, colour: colour });
      partMesh.count = Math.min(maxPart, particles.length);
    }

    function syncParticles(dt) {
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.t -= dt;
        p.vy -= 22 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.t <= 0) particles.splice(i, 1);
      }
      for (var j = 0; j < particles.length; j++) {
        var q = particles[j];
        pDummy.position.set(q.x, q.y, q.z);
        pDummy.scale.setScalar(0.8 + (q.t / q.life) * 0.5);
        pDummy.updateMatrix();
        partMesh.setMatrixAt(j, pDummy.matrix);
        pColour.set(q.colour);
        partMesh.setColorAt(j, pColour);
      }
      partMesh.count = particles.length;
      if (particles.length) {
        partMesh.instanceMatrix.needsUpdate = true;
        partMesh.instanceColor.needsUpdate = true;
      }
    }

    var trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 1.6, 6);
    trunkGeo.translate(0, 0.8, 0);
    var topGeo = new THREE.ConeGeometry(1.4, 2.4, 6);
    topGeo.translate(0, 2.4, 0);
    var trunkMat = new THREE.MeshStandardMaterial({ color: '#8d5a3b', roughness: 0.85 });
    var topMat = new THREE.MeshStandardMaterial({ color: '#3fa34d', roughness: 0.75 });
    var bushGeo = new THREE.SphereGeometry(0.85, 6, 5);
    var bushMat = new THREE.MeshStandardMaterial({ color: '#52b65f', roughness: 0.8 });
    var rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
    var rockMat = new THREE.MeshStandardMaterial({ color: '#7a828e', roughness: 0.9 });
    var mushGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.35, 6);
    var mushMat = new THREE.MeshStandardMaterial({ color: '#e8c4a0', roughness: 0.7 });

    var maxTrees = C.FOREST_TREES;
    var trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, maxTrees);
    var topInst = new THREE.InstancedMesh(topGeo, topMat, maxTrees);
    trunkInst.castShadow = topInst.castShadow = true;
    scene.add(trunkInst, topInst);

    var trees = [];
    var ti = 0;
    while (ti < maxTrees) {
      var tx = rand(C.TOWN_FLAT + 12, C.WORLD_HALF - 10);
      var tz = rand(-C.WORLD_HALF + 15, C.WORLD_HALF - 15);
      if (world.zoneAt(tx, tz) !== 'forest') continue;
      var ty = world.heightAt(tx, tz);
      var ry = rand(0, 6.28);
      treeDummy.position.set(tx, ty, tz);
      treeDummy.rotation.set(0, ry, 0);
      treeDummy.updateMatrix();
      trunkInst.setMatrixAt(ti, treeDummy.matrix);
      topInst.setMatrixAt(ti, treeDummy.matrix);
      trees.push({
        idx: ti,
        x: tx,
        z: tz,
        ry: ry,
        fallen: false,
        fallT: 0,
        fallDir: 0,
        smashedAt: 0,
        hidden: false
      });
      ti += 1;
    }
    trunkInst.count = topInst.count = ti;

    var maxBushes = C.FOREST_BUSHES;
    var bushInst = new THREE.InstancedMesh(bushGeo, bushMat, maxBushes);
    bushInst.castShadow = true;
    scene.add(bushInst);
    var bushes = [];
    var bi = 0;
    while (bi < maxBushes) {
      var bx = rand(C.TOWN_FLAT + 8, C.WORLD_HALF - 8);
      var bz = rand(-C.WORLD_HALF + 10, C.WORLD_HALF - 10);
      if (world.zoneAt(bx, bz) !== 'forest' && world.zoneAt(bx, bz) !== 'town') continue;
      var by = world.heightAt(bx, bz);
      treeDummy.position.set(bx, by + 0.45, bz);
      treeDummy.rotation.set(0, rand(0, 6.28), 0);
      treeDummy.scale.setScalar(1);
      treeDummy.updateMatrix();
      bushInst.setMatrixAt(bi, treeDummy.matrix);
      bushes.push({ idx: bi, x: bx, z: bz, smashedAt: 0, hidden: false });
      bi += 1;
    }
    bushInst.count = bi;

    var maxRocks = C.MOUNTAIN_ROCKS;
    var rockInst = new THREE.InstancedMesh(rockGeo, rockMat, maxRocks);
    rockInst.castShadow = true;
    scene.add(rockInst);
    var rocks = [];
    var ri = 0;
    while (ri < maxRocks) {
      var rx = rand(-C.WORLD_HALF + 8, -C.TOWN_FLAT - 6);
      var rz = rand(-C.WORLD_HALF + 20, C.WORLD_HALF - 20);
      if (world.zoneAt(rx, rz) !== 'mountains') continue;
      var rhy = world.heightAt(rx, rz);
      treeDummy.position.set(rx, rhy + 0.35, rz);
      treeDummy.rotation.set(rand(0, 0.4), rand(0, 6.28), rand(0, 0.4));
      treeDummy.scale.setScalar(rand(0.7, 1.3));
      treeDummy.updateMatrix();
      rockInst.setMatrixAt(ri, treeDummy.matrix);
      rocks.push({ idx: ri, x: rx, z: rz, smashedAt: 0, hidden: false, tumble: 0 });
      ri += 1;
    }
    rockInst.count = ri;

    var mushInst = new THREE.InstancedMesh(mushGeo, mushMat, 40);
    scene.add(mushInst);
    var mushrooms = [];
    var mi = 0;
    while (mushrooms.length < 36 && mi < 200) {
      mi += 1;
      var mx = rand(C.TOWN_FLAT + 6, C.WORLD_HALF - 6);
      var mz = rand(-30, 55);
      if (world.zoneAt(mx, mz) !== 'forest') continue;
      treeDummy.position.set(mx, world.heightAt(mx, mz) + 0.2, mz);
      treeDummy.rotation.set(0, rand(0, 6.28), 0);
      treeDummy.scale.setScalar(rand(0.8, 1.2));
      treeDummy.updateMatrix();
      var midx = mushrooms.length;
      mushInst.setMatrixAt(midx, treeDummy.matrix);
      mushrooms.push({ idx: midx, x: mx, z: mz, smashedAt: 0, hidden: false });
    }
    mushInst.count = mushrooms.length;

    var logs = [];
    var logGeo = new THREE.CylinderGeometry(0.35, 0.4, 2.8, 8);
    logGeo.rotateZ(Math.PI / 2);
    var logMat = new THREE.MeshStandardMaterial({ color: '#9a6b42', roughness: 0.88 });
    for (var lg = 0; lg < 16; lg++) {
      var lx = rand(C.TOWN_FLAT + 10, C.WORLD_HALF - 12);
      var lz = rand(-50, 50);
      if (world.zoneAt(lx, lz) !== 'forest') continue;
      var log = new THREE.Mesh(logGeo, logMat);
      log.position.set(lx, world.heightAt(lx, lz) + 0.35, lz);
      log.rotation.y = rand(0, 6.28);
      log.castShadow = true;
      world.ensureChunk(Math.floor(lx / C.CHUNK_SIZE), Math.floor(lz / C.CHUNK_SIZE)).add(log);
      logs.push({ mesh: log, x: lx, z: lz, vx: 0, vz: 0, smashedAt: 0 });
    }

    var ramps = [];
    for (var rp = 0; rp < 3; rp++) {
      var ax = rand(-C.WORLD_HALF + 25, -C.TOWN_FLAT - 18);
      var az = rand(-35 + rp * 28, -20 + rp * 28);
      var ramp = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1.2, 5),
        new THREE.MeshStandardMaterial({ color: '#6a7380', roughness: 0.9 })
      );
      ramp.position.set(ax, world.heightAt(ax, az) + 0.4, az);
      ramp.rotation.y = rand(-0.5, 0.5);
      ramp.rotation.x = -0.28;
      world.ensureChunk(Math.floor(ax / C.CHUNK_SIZE), Math.floor(az / C.CHUNK_SIZE)).add(ramp);
      ramps.push({ mesh: ramp, x: ax, z: az });
    }

    town.buildBridge(C.RIVER_CENTER_Z);

    for (var s = 0; s < 8; s++) {
      var sx = rand(-C.WORLD_HALF + 10, -C.TOWN_FLAT - 8);
      var sz = rand(-40, 40);
      if (world.zoneAt(sx, sz) !== 'mountains') continue;
      town.snowman(sx, sz, world.heightAt(sx, sz));
    }

    function signpost(x, z, icon) {
      var ch = world.ensureChunk(Math.floor(x / C.CHUNK_SIZE), Math.floor(z / C.CHUNK_SIZE));
      var pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 2.4, 6),
        new THREE.MeshStandardMaterial({ color: '#d9d4c7' })
      );
      pole.position.set(x, world.heightAt(x, z) + 1.2, z);
      var sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.12), new THREE.MeshStandardMaterial({ color: '#f4f1e6' }));
      sign.position.set(0, 1.8, 0);
      pole.add(sign);
      var emoji = document.createElement('canvas');
      emoji.width = emoji.height = 64;
      var eg = emoji.getContext('2d');
      eg.font = '48px system-ui';
      eg.textAlign = 'center';
      eg.fillText(icon, 32, 48);
      sign.material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(emoji) });
      ch.add(pole);
    }
    signpost(C.TOWN_FLAT + 2, -8, '🌲');
    signpost(-6, C.RIVER_CENTER_Z - 8, '🌊');
    signpost(-C.TOWN_FLAT - 2, 6, '⛰️');

    var bridgeZ = C.RIVER_CENTER_Z;
    var ducks = [];
    var duckGeo = new THREE.SphereGeometry(0.45, 10, 8);
    var duckMat = new THREE.MeshStandardMaterial({ color: '#f2d34a' });
    for (var d = 0; d < 5; d++) {
      var dx = rand(-18, 18);
      var dz = bridgeZ + rand(-6, 6);
      var duck = new THREE.Mesh(duckGeo, duckMat);
      duck.position.set(dx, -0.1, dz);
      duck.castShadow = true;
      scene.add(duck);
      ducks.push({ mesh: duck, x: dx, z: dz, vx: 0, vz: 0 });
    }

  var fordMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 10),
      new THREE.MeshStandardMaterial({ color: '#9ad0e8', transparent: true, opacity: 0.35, roughness: 0.2 })
    );
    fordMesh.rotation.x = -Math.PI / 2;
    fordMesh.position.set(0, -0.05, bridgeZ + 14);
    scene.add(fordMesh);

    function hideTreeMatrix(idx) {
      treeDummy.position.set(0, -900, 0);
      treeDummy.scale.setScalar(0.001);
      treeDummy.rotation.set(0, 0, 0);
      treeDummy.updateMatrix();
      trunkInst.setMatrixAt(idx, treeDummy.matrix);
      topInst.setMatrixAt(idx, treeDummy.matrix);
    }

    function showTreeMatrix(tr) {
      treeDummy.position.set(tr.x, world.heightAt(tr.x, tr.z), tr.z);
      treeDummy.rotation.set(0, tr.ry, 0);
      treeDummy.scale.setScalar(1);
      treeDummy.updateMatrix();
      trunkInst.setMatrixAt(tr.idx, treeDummy.matrix);
      topInst.setMatrixAt(tr.idx, treeDummy.matrix);
    }

    function hitTree(tree, dirX, dirZ) {
      if (tree.fallen || tree.hidden) return;
      tree.fallen = true;
      tree.fallT = 0;
      tree.fallDir = Math.atan2(dirX, dirZ);
      tree.smashedAt = clock;
      Smash.Sound.treeCrack();
      for (var n = 0; n < 12; n++) {
        spawnParticle(
          tree.x,
          world.heightAt(tree.x, tree.z) + 2,
          tree.z,
          dirX * rand(2, 6) + rand(-3, 3),
          rand(2, 7),
          dirZ * rand(2, 6) + rand(-3, 3),
          '#7ad67f',
          rand(0.4, 0.9)
        );
      }
    }

    function hitBush(bush, dirX, dirZ) {
      if (bush.hidden) return;
      bush.hidden = true;
      bush.smashedAt = clock;
      treeDummy.position.set(0, -900, 0);
      treeDummy.scale.setScalar(0.001);
      treeDummy.updateMatrix();
      bushInst.setMatrixAt(bush.idx, treeDummy.matrix);
      bushInst.instanceMatrix.needsUpdate = true;
      Smash.Sound.treeCrack();
      for (var n = 0; n < 18; n++) {
        spawnParticle(
          bush.x,
          world.heightAt(bush.x, bush.z) + 0.6,
          bush.z,
          dirX * rand(1, 4) + rand(-2, 2),
          rand(1, 5),
          dirZ * rand(1, 4) + rand(-2, 2),
          '#52b65f',
          rand(0.3, 0.7)
        );
      }
    }

    function respawnProp(p, waitMin, rebuildFn) {
      if (!p.smashedAt || clock - p.smashedAt < waitMin) return;
      var dist = Math.hypot(p.x - car.x, p.z - car.z);
      if (dist < C.REBUILD_DISTANCE) return;
      rebuildFn(p);
      p.smashedAt = 0;
    }

    var wakeT = 0;
    function wake(x, z, dirX, dirZ) {
      wakeT += 0.1;
      if (wakeT < 0.12) return;
      wakeT = 0;
      spawnParticle(
        x - dirX * 1.6,
        world.heightAt(x, z) + 0.15,
        z - dirZ * 1.6,
        -dirX * rand(1, 3),
        rand(0.2, 1.2),
        -dirZ * rand(1, 3),
        '#d4f4ff',
        0.35
      );
    }

    var puddles = [];
    function sprayPuddle(x, z) {
      if (puddles.length > 8) {
        scene.remove(puddles.shift());
      }
      var p = new THREE.Mesh(
        new THREE.CircleGeometry(rand(1.8, 2.6), 12),
        new THREE.MeshBasicMaterial({ color: '#5ab0ff', transparent: true, opacity: 0.55, depthWrite: false })
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, world.heightAt(x, z) + 0.04, z);
      scene.add(p);
      puddles.push(p);
    }

    function update(dt, viewX, viewZ) {
      clock += dt;
      garageCooldown = Math.max(0, garageCooldown - dt);
      syncParticles(dt);

      if (car.inWater && car.moving > 2) wake(car.x, car.z, car.dirX, car.dirZ);

      if (car.sprayT > 0 && Math.random() < 0.35) {
        var sx = car.x + car.dirX * 2.5 + car.dirZ * rand(-0.6, 0.6);
        var sz = car.z + car.dirZ * 2.5 - car.dirX * rand(-0.6, 0.6);
        sprayPuddle(sx, sz);
        town.smash(sx, sz, 1.5, car.dirX, car.dirZ, 5);
      }

      if (car.moving > 1.2) {
        var hx = car.x + car.dirX;
        var hz = car.z + car.dirZ;
        var i;
        for (i = 0; i < trees.length; i++) {
          var tr = trees[i];
          if (tr.fallen || tr.hidden) continue;
          if ((hx - tr.x) * (hx - tr.x) + (hz - tr.z) * (hz - tr.z) < 2.2) hitTree(tr, car.dirX, car.dirZ);
        }
        for (i = 0; i < bushes.length; i++) {
          var bu = bushes[i];
          if (bu.hidden) continue;
          if ((hx - bu.x) * (hx - bu.x) + (hz - bu.z) * (hz - bu.z) < 1.6) hitBush(bu, car.dirX, car.dirZ);
        }
        for (i = 0; i < rocks.length; i++) {
          var rk = rocks[i];
          if (rk.hidden || rk.tumble > 0) continue;
          if ((hx - rk.x) * (hx - rk.x) + (hz - rk.z) * (hz - rk.z) < 1.8) {
            rk.tumble = 3;
            rk.smashedAt = clock;
            Smash.Sound.rockTumble();
            town.smash(rk.x, rk.z, 1.2, car.dirX, car.dirZ, 4);
          }
        }
        for (i = 0; i < mushrooms.length; i++) {
          var mu = mushrooms[i];
          if (mu.hidden) continue;
          if ((hx - mu.x) * (hx - mu.x) + (hz - mu.z) * (hz - mu.z) < 1.1) {
            mu.hidden = true;
            mu.smashedAt = clock;
            treeDummy.position.set(0, -900, 0);
            treeDummy.scale.setScalar(0.001);
            treeDummy.updateMatrix();
            mushInst.setMatrixAt(mu.idx, treeDummy.matrix);
            mushInst.instanceMatrix.needsUpdate = true;
          }
        }
        logs.forEach(function (log) {
          if ((hx - log.x) * (hx - log.x) + (hz - log.z) * (hz - log.z) < 2.4) {
            log.vx += car.dirX * 8;
            log.vz += car.dirZ * 8;
            log.smashedAt = clock;
          }
        });
      }

      var needsTree = false;
      trees.forEach(function (tr) {
        if (tr.fallen && !tr.hidden) {
          tr.fallT += dt;
          var a = Math.min(1.4, tr.fallT * 1.8);
          treeDummy.position.set(tr.x, world.heightAt(tr.x, tr.z), tr.z);
          treeDummy.rotation.set(a, tr.ry, Math.sin(tr.fallDir) * a * 0.3);
          treeDummy.scale.setScalar(1);
          treeDummy.updateMatrix();
          trunkInst.setMatrixAt(tr.idx, treeDummy.matrix);
          topInst.setMatrixAt(tr.idx, treeDummy.matrix);
          needsTree = true;
          if (tr.fallT > 2.5) {
            tr.hidden = true;
            hideTreeMatrix(tr.idx);
            tr.smashedAt = clock;
          }
        }
        respawnProp(tr, rand(20, 30), function (p) {
          p.fallen = false;
          p.hidden = false;
          p.fallT = 0;
          p.ry = rand(0, 6.28);
          showTreeMatrix(p);
        });
      });
      if (needsTree) {
        trunkInst.instanceMatrix.needsUpdate = true;
        topInst.instanceMatrix.needsUpdate = true;
      }

      bushes.forEach(function (bu) {
        respawnProp(bu, rand(20, 30), function (p) {
          p.hidden = false;
          p.ry = rand(0, 6.28);
          treeDummy.position.set(p.x, world.heightAt(p.x, p.z) + 0.45, p.z);
          treeDummy.rotation.set(0, p.ry, 0);
          treeDummy.scale.setScalar(1);
          treeDummy.updateMatrix();
          bushInst.setMatrixAt(p.idx, treeDummy.matrix);
        });
      });
      rocks.forEach(function (rk) {
        if (rk.tumble > 0) {
          rk.tumble -= dt;
          rk.x += car.dirX * 2 * dt;
          rk.z += car.dirZ * 2 * dt;
        }
        respawnProp(rk, rand(22, 28), function (p) {
          p.hidden = false;
          p.tumble = 0;
          treeDummy.position.set(p.x, world.heightAt(p.x, p.z) + 0.35, p.z);
          treeDummy.rotation.set(rand(0, 0.4), rand(0, 6.28), rand(0, 0.4));
          treeDummy.scale.setScalar(rand(0.7, 1.3));
          treeDummy.updateMatrix();
          rockInst.setMatrixAt(p.idx, treeDummy.matrix);
          rockInst.instanceMatrix.needsUpdate = true;
        });
      });
      mushrooms.forEach(function (mu) {
        respawnProp(mu, rand(20, 26), function (p) {
          p.hidden = false;
          treeDummy.position.set(p.x, world.heightAt(p.x, p.z) + 0.2, p.z);
          treeDummy.rotation.set(0, rand(0, 6.28), 0);
          treeDummy.scale.setScalar(rand(0.8, 1.2));
          treeDummy.updateMatrix();
          mushInst.setMatrixAt(p.idx, treeDummy.matrix);
          mushInst.instanceMatrix.needsUpdate = true;
        });
      });

      logs.forEach(function (log) {
        log.mesh.position.x = log.x += log.vx * dt;
        log.mesh.position.z = log.z += log.vz * dt;
        log.vx *= 0.94;
        log.vz *= 0.94;
        if (log.smashedAt && clock - log.smashedAt > rand(24, 30)) {
          var dist = Math.hypot(log.x - car.x, log.z - car.z);
          if (dist > C.REBUILD_DISTANCE) {
            log.x = rand(C.TOWN_FLAT + 10, C.WORLD_HALF - 12);
            log.z = rand(-50, 50);
            log.mesh.position.set(log.x, world.heightAt(log.x, log.z) + 0.35, log.z);
            log.smashedAt = 0;
          }
        }
      });

      ducks.forEach(function (du) {
        var ddx = du.x - car.x;
        var ddz = du.z - car.z;
        var dist = Math.hypot(ddx, ddz) || 1;
        if (dist < 8) {
          du.vx += (ddx / dist) * 12 * dt;
          du.vz += (ddz / dist) * 12 * dt;
        }
        du.vx *= 0.92;
        du.vz *= 0.92;
        du.x += du.vx * dt;
        du.z += du.vz * dt;
        du.mesh.position.set(du.x, -0.08 + Math.sin(clock * 3 + du.x) * 0.05, du.z);
      });

      ramps.forEach(function (r) {
        if (Math.hypot(car.x - r.x, car.z - r.z) < 5 && car.moving > 6) car.hop = Math.max(car.hop, 0.85);
      });

      world.updateChunks(viewX, viewZ);
    }

    var garageCooldown = 0;
    var garages = [
      { x: 54, z: -14, vehicle: 'monster' },
      { x: 88, z: 36, vehicle: 'bulldozer' },
      { x: -62, z: -22, vehicle: 'dump' }
    ];
    garages.forEach(function (g) {
      var ch = world.ensureChunk(Math.floor(g.x / C.CHUNK_SIZE), Math.floor(g.z / C.CHUNK_SIZE));
      var shed = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.4, 4.5),
        new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.85 })
      );
      shed.position.set(g.x, world.heightAt(g.x, g.z) + 1.2, g.z);
      ch.add(shed);
      var parked = Smash.Vehicles.buildGroup(g.vehicle, '#cccccc').group;
      parked.position.set(g.x + 3.2, world.heightAt(g.x + 3.2, g.z) + 0.4, g.z);
      parked.rotation.y = -0.6;
      ch.add(parked);
    });

    function checkGarages(carInst) {
      if (garageCooldown > 0) return;
      garages.forEach(function (g) {
        if (Math.hypot(carInst.x - g.x, carInst.z - g.z) < 3.4 && carInst.typeId !== g.vehicle) {
          carInst.swapTo(g.vehicle, puff);
          garageCooldown = 2.5;
          if (carInst._onSwap) carInst._onSwap(g.vehicle);
        }
      });
    }

    function puff(x, z) {
      for (var n = 0; n < 10; n++) {
        spawnParticle(x, world.heightAt(x, z) + 0.5, z, rand(-2, 2), rand(1, 4), rand(-2, 2), '#e8e8e8', 0.4);
      }
    }

    function tipDump(x, z) {
      town.smash(x, z, 2.2, 0, 1, 9);
      Smash.Sound.rockTumble();
    }

    function splash(x, z, big) {
      var n0 = big ? 22 : 14;
      for (var n = 0; n < n0; n++) {
        spawnParticle(
          x,
          world.heightAt(x, z) + 0.2,
          z,
          rand(-4, 4),
          rand(3, 9),
          rand(-4, 4),
          '#b8e6ff',
          rand(0.25, 0.55)
        );
      }
      Smash.Sound.splash();
    }

    return {
      update: update,
      splash: splash,
      puff: puff,
      tipDump: tipDump,
      checkGarages: checkGarages,
      trees: trees
    };
  };
})();
