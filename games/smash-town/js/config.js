/*
 * SMASH TOWN — settings. Change the numbers here to change how the game feels.
 * Every other file reads from Smash.CONFIG.
 */
// Treat the colour codes below as normal screen colours (otherwise they render washed out).
THREE.ColorManagement.legacyMode = false;

window.Smash = {
  CONFIG: {
    // World (~4× former play area)
    WORLD_HALF: 148,
    TOWN_FLAT: 52,
    TERRAIN_SEGS: 96,
    CHUNK_SIZE: 48,
    CHUNK_ACTIVE_RADIUS: 2,
    RIVER_CENTER_Z: 72,
    RIVER_WIDTH: 22,
    RIVER_DEPTH: 1.35,

    // Town
    LOTS: 7,
    LOT: 14,
    ROAD: 6,
    REBUILD_AFTER: 22,
    REBUILD_DISTANCE: 48,
    DEBRIS_TIME: 7,

    // Car
    CAR_SPEED: 16,
    CAR_TURN: 3.4,
    CAR_COLOURS: ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#ec5fa7', '#fb8c00'],
    WATER_SLOW: 0.7,
    UNSTICK_TIME: 2,
    UNSTICK_PUSH: 14,

    // Monster
    MONSTER_ON: true,
    MONSTER_SPEED: 6.5,
    MONSTER_SIZE: 1.6,
    MONSTER_COLOUR: '#8e4de0',
    EATEN_TIME: 1.8,

    // Paint
    PAINT_EVERY: [6, 11],
    PAINT_COLOURS: ['#ff3fa4', '#3fd0ff', '#ffe03f', '#7dff5a', '#b56bff', '#ff8a2a'],
    DRIFT_TIME: 2.6,
    TRACK_TIME: 6,

    // View
    CAMERA_HEIGHT: 50,
    CAMERA_TILT: 15,
    CAMERA_SPEED_ZOOM: 0.22,
    SHADOWS: true,

    // Props budgets
    FOREST_TREES: 140,
    FOREST_BUSHES: 80,
    MOUNTAIN_ROCKS: 64
  }
};
