/*
 * World scale ~4× town area: heightfield terrain, zones, soft bounds, chunk culling hooks.
 */
(function () {
  'use strict';

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function n2(x, z) {
    return Math.sin(x * 0.07) * Math.cos(z * 0.06) + Math.sin(x * 0.13 + z * 0.11) * 0.45;
  }

  Smash.createWorld = function (scene) {
    var C = Smash.CONFIG;
    var HALF = C.WORLD_HALF;
    var CHUNK = C.CHUNK_SIZE;
    var terrainSize = HALF * 2 + 40;

    function heightAt(x, z) {
      var ax = Math.abs(x);
      var az = Math.abs(z);
      if (ax < C.TOWN_FLAT && az < C.TOWN_FLAT) return 0;

      var h = 0;
      if (x > C.TOWN_FLAT) {
        var t = Math.min(1, (x - C.TOWN_FLAT) / 55);
        h += n2(x, z) * (2 + t * 2.5) * t;
      }
      if (x < -C.TOWN_FLAT) {
        var tm = Math.min(1, (-x - C.TOWN_FLAT) / 50);
        h += (4 + tm * 14) * tm + n2(x * 0.5, z) * 1.2 * tm;
      }
      var riverZ = C.RIVER_CENTER_Z;
      var riverW = C.RIVER_WIDTH;
      if (Math.abs(z - riverZ) < riverW) {
        var edge = 1 - Math.abs(z - riverZ) / riverW;
        var ford = Math.abs(x) < 14 && z > riverZ + 4 && z < riverZ + riverW - 2;
        var depth = ford ? C.RIVER_DEPTH * 0.35 : C.RIVER_DEPTH;
        h -= edge * edge * depth;
      }
      if (z > riverZ + riverW + 8 && x > -C.TOWN_FLAT && x < C.TOWN_FLAT + 30) {
        h += Math.min(3, (z - riverZ - riverW) * 0.08);
      }
      return h;
    }

    function zoneAt(x, z) {
      if (Math.abs(x) < C.TOWN_FLAT + 4 && Math.abs(z) < C.TOWN_FLAT + 4) return 'town';
      var riverZ = C.RIVER_CENTER_Z;
      if (Math.abs(z - riverZ) < C.RIVER_WIDTH + 2 && Math.abs(x) < HALF - 8) return 'river';
      if (x > C.TOWN_FLAT + 6) return 'forest';
      if (x < -(C.TOWN_FLAT + 6)) return 'mountains';
      if (z > riverZ + C.RIVER_WIDTH + 5) return 'forest';
      return 'town';
    }

    function groundColour(zone) {
      if (zone === 'forest') return new THREE.Color('#5fa858');
      if (zone === 'river') return new THREE.Color('#6a9e6c');
      if (zone === 'mountains') return new THREE.Color('#8b9aab');
      return new THREE.Color('#7cc47f');
    }

    var segs = C.TERRAIN_SEGS;
    var geo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var cols = [];
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var y = heightAt(x, z);
      pos.setY(i, y);
      var c = groundColour(zoneAt(x, z));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    var terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })
    );
    terrain.receiveShadow = true;
    scene.add(terrain);

    var waterGeo = new THREE.PlaneGeometry(terrainSize * 0.55, C.RIVER_WIDTH * 2.2, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    var water = new THREE.Mesh(
      waterGeo,
      new THREE.MeshStandardMaterial({
        color: 0x3d8fd4,
        transparent: true,
        opacity: 0.55,
        roughness: 0.15,
        metalness: 0.05
      })
    );
    water.position.set(0, -0.35, C.RIVER_CENTER_Z);
    scene.add(water);

    function softEdgeSteer(x, z, vx, vz) {
      var edge = HALF - 6;
      var fx = 0;
      var fz = 0;
      if (x > edge) fx -= (x - edge) * 0.35;
      if (x < -edge) fx += (-edge - x) * 0.35;
      if (z > edge) fz -= (z - edge) * 0.35;
      if (z < -edge) fz += (-edge - z) * 0.35;
      return { fx: fx, fz: fz, hard: Math.abs(x) > HALF || Math.abs(z) > HALF };
    }

    function inWater(x, z) {
      return heightAt(x, z) < -0.25 && zoneAt(x, z) === 'river';
    }

    var chunkRoot = new THREE.Group();
    scene.add(chunkRoot);

    function chunkKey(cx, cz) {
      return cx + ',' + cz;
    }

    function worldToChunk(x, z) {
      return {
        cx: Math.floor(x / CHUNK),
        cz: Math.floor(z / CHUNK)
      };
    }

    var chunkGroups = {};

    function ensureChunk(cx, cz) {
      var k = chunkKey(cx, cz);
      if (!chunkGroups[k]) {
        var g = new THREE.Group();
        g.userData.chunk = { cx: cx, cz: cz };
        chunkRoot.add(g);
        chunkGroups[k] = g;
      }
      return chunkGroups[k];
    }

    function updateChunks(carX, carZ) {
      var cc = worldToChunk(carX, carZ);
      var R = C.CHUNK_ACTIVE_RADIUS;
      Object.keys(chunkGroups).forEach(function (k) {
        var g = chunkGroups[k];
        var cx = g.userData.chunk.cx;
        var cz = g.userData.chunk.cz;
        var on = Math.abs(cx - cc.cx) <= R && Math.abs(cz - cc.cz) <= R;
        g.visible = on;
      });
    }

    return {
      half: HALF,
      edge: HALF,
      terrain: terrain,
      water: water,
      chunkRoot: chunkRoot,
      heightAt: heightAt,
      zoneAt: zoneAt,
      inWater: inWater,
      softEdgeSteer: softEdgeSteer,
      ensureChunk: ensureChunk,
      updateChunks: updateChunks,
      worldToChunk: worldToChunk,
      terrainSize: terrainSize
    };
  };
})();
