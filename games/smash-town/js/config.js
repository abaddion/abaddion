/*
 * SMASH TOWN — settings. Change the numbers here to change how the game feels.
 * Every other file reads from Smash.CONFIG.
 */
// Treat the colour codes below as normal screen colours (otherwise they render washed out).
THREE.ColorManagement.legacyMode = false;

window.Smash = {
  CONFIG: {
    // Town
    LOTS: 7,                 // town is LOTS x LOTS city blocks
    LOT: 14,                 // size of one city block
    ROAD: 6,                 // width of a road
    REBUILD_AFTER: 14,       // seconds before a smashed building rebuilds itself...
    REBUILD_DISTANCE: 38,    // ...but only while the car is at least this far away
    DEBRIS_TIME: 7,          // seconds loose blocks lie around before vanishing

    // Car
    CAR_SPEED: 16,
    CAR_TURN: 3.4,           // how sharply it steers
    CAR_COLOURS: ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#ec5fa7', '#fb8c00'],   // first one is the default

    // Monster
    MONSTER_ON: true,        // whether the monster is out when the game starts
    MONSTER_SPEED: 6.5,      // keep this well below CAR_SPEED so he can always get away
    MONSTER_SIZE: 1.6,       // 1 = original size
    MONSTER_COLOUR: '#8e4de0',
    EATEN_TIME: 1.8,         // seconds the car stays in his tummy before he spits it out

    // Paint
    PAINT_EVERY: [6, 11],    // a new paint splat lands every 6 to 11 seconds
    PAINT_COLOURS: ['#ff3fa4', '#3fd0ff', '#ffe03f', '#7dff5a', '#b56bff', '#ff8a2a'],
    DRIFT_TIME: 2.6,         // seconds the car slides after hitting paint
    TRACK_TIME: 6,           // seconds it keeps leaving coloured tyre tracks

    // View
    CAMERA_HEIGHT: 50,       // higher = see more of the town
    CAMERA_TILT: 15,         // 0 = straight down; bigger = more of the building sides
    SHADOWS: true            // turn off if an older tablet struggles
  }
};
