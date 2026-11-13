/*
 * Six drivable vehicles — simple meshes, per-type stats, picker icons.
 */
(function () {
  'use strict';

  function slab(w, l, r, h) {
    var shape = new THREE.Shape();
    var hw = w / 2;
    var hl = l / 2;
    shape.moveTo(-hw + r, -hl);
    shape.lineTo(hw - r, -hl);
    shape.quadraticCurveTo(hw, -hl, hw, -hl + r);
    shape.lineTo(hw, hl - r);
    shape.quadraticCurveTo(hw, hl, hw - r, hl);
    shape.lineTo(-hw + r, hl);
    shape.quadraticCurveTo(-hw, hl, -hw, hl - r);
    shape.lineTo(-hw, -hl + r);
    shape.quadraticCurveTo(-hw, -hl, -hw + r, -hl);
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: true,
      bevelSize: 0.08,
      bevelThickness: 0.08,
      bevelSegments: 3,
      curveSegments: 10
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  function part(group, geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  }

  var LIST = [
    { id: 'city', icon: '🚗', speed: 1, smash: 1.35, scale: 1, engine: 1, action: null, garage: null },
    { id: 'monster', icon: '🛞', speed: 0.9, smash: 1.95, scale: 1.32, engine: 0.72, action: null, garage: 'town' },
    { id: 'bulldozer', icon: '🚜', speed: 0.62, smash: 1.5, scale: 1.18, engine: 0.52, action: null, push: true, garage: null },
    { id: 'fire', icon: '🚒', speed: 0.88, smash: 1.4, scale: 1.12, engine: 0.88, action: 'spray', garage: 'forest' },
    { id: 'dump', icon: '🚚', speed: 0.78, smash: 1.48, scale: 1.22, engine: 0.62, action: 'tip', garage: null },
    { id: 'race', icon: '🏎️', speed: 1.4, smash: 1.2, scale: 0.92, engine: 1.35, action: null, garage: 'mountain' }
  ];

  function byId(id) {
    return LIST.find(function (v) {
      return v.id === id;
    }) || LIST[0];
  }

  function buildGroup(typeId, paintHex) {
    var def = byId(typeId);
    var group = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({ color: paintHex, roughness: 0.32, metalness: 0.12 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.15, metalness: 0.4 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.8 });
    var white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    var wheelR = typeId === 'monster' ? 0.62 : typeId === 'race' ? 0.38 : 0.44;
    var wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.36, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    if (typeId === 'city' || typeId === 'race') {
      var bodyW = typeId === 'race' ? 1.85 : 2;
      var bodyL = typeId === 'race' ? 4.2 : 3.9;
      part(group, slab(bodyW, bodyL, 0.55, 0.52), paint, 0, 0.34, 0);
      part(group, slab(bodyW * 0.86, bodyL * 0.5, 0.45, 0.45), glass, 0, 0.95, -0.2);
    } else if (typeId === 'monster') {
      part(group, slab(2.4, 4.4, 0.65, 0.7), paint, 0, 0.55, 0);
      part(group, slab(2.1, 2.2, 0.5, 0.5), glass, 0, 1.1, -0.15);
    } else if (typeId === 'bulldozer') {
      part(group, slab(2.3, 3.2, 0.5, 0.75), paint, 0, 0.5, 0.2);
      part(group, new THREE.BoxGeometry(2.4, 1.1, 0.35), dark, 0, 0.55, 1.75);
    } else if (typeId === 'fire') {
      part(group, slab(2.1, 4.6, 0.55, 0.62), new THREE.MeshStandardMaterial({ color: '#cc2a2a', roughness: 0.4 }), 0, 0.42, 0);
      part(group, new THREE.BoxGeometry(0.35, 2.2, 0.35), dark, 0.7, 1.4, 0.4);
    } else if (typeId === 'dump') {
      part(group, slab(2.15, 3.6, 0.5, 0.58), paint, 0, 0.45, -0.35);
      part(group, new THREE.BoxGeometry(2.1, 1.2, 2.4), dark, 0, 1.2, -0.9);
    }

    var wpos =
      typeId === 'monster'
        ? [
            [-1.25, 1.4],
            [1.25, 1.4],
            [-1.25, -1.4],
            [1.25, -1.4]
          ]
        : [
            [-1, 1.25],
            [1, 1.25],
            [-1, -1.25],
            [1, -1.25]
          ];
    wpos.forEach(function (w) {
      part(group, wheelGeo, dark, w[0], wheelR, w[1]);
    });
    if (typeId === 'city' || typeId === 'race') {
      part(group, new THREE.BoxGeometry(0.5, 0.03, 3.4), white, 0, 1.02, 0);
    }

    group.scale.setScalar(def.scale);
    return { group: group, paint: paint, def: def };
  }

  Smash.Vehicles = {
    list: LIST,
    byId: byId,
    buildGroup: buildGroup,
    loadSaved: function () {
      try {
        return localStorage.getItem('smash-town-vehicle') || 'city';
      } catch (e) {
        return 'city';
      }
    },
    save: function (id) {
      try {
        localStorage.setItem('smash-town-vehicle', id);
      } catch (e) {}
    }
  };
})();
