(function () {
  'use strict';

  var VW = 384;
  var VH = 216;
  var TILE = 16;
  var COLS = 118;
  var ROWS = 80;
  var CITY_W = 62;
  var CITY_H = 46;
  var MCOLS = 48;
  var MROWS = 32;
  var TCOLS = 360;
  var TROWS = 88;
  var CHAR_W = 10;
  var CHAR_H = 12;
  var SAVE = 'callpole-v3';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var ui = {
    hud: document.getElementById('hud'),
    stamps: document.getElementById('stamps'),
    mute: document.getElementById('mute'),
    prompt: document.getElementById('prompt'),
    title: document.getElementById('title'),
    start: document.getElementById('start'),
    dialog: document.getElementById('dialog'),
    who: document.getElementById('who'),
    line: document.getElementById('line'),
    card: document.getElementById('card'),
    cardK: document.getElementById('card-k'),
    cardH: document.getElementById('card-h'),
    cardP: document.getElementById('card-p'),
    cardOk: document.getElementById('card-ok'),
    cardBack: document.getElementById('card-back'),
    dests: document.getElementById('ride-dests'),
    end: document.getElementById('end'),
    again: document.getElementById('again'),
    pad: document.getElementById('pad'),
    energy: document.getElementById('energy-fill'),
    energyWrap: document.getElementById('energy-wrap'),
    gas: document.getElementById('gas-fill'),
    gasWrap: document.getElementById('gas-wrap'),
    clock: document.getElementById('clock'),
    clockWrap: document.getElementById('clock-wrap'),
    slots: document.getElementById('slots'),
    slot1: document.getElementById('slot-1'),
    endK: document.getElementById('end-k'),
    endH: document.getElementById('end-h'),
    endP: document.getElementById('end-p')
  };

  var C = {
    walk: '#c5c0b8',
    walk2: '#b3aea6',
    road: '#2f3544',
    road2: '#3a4154',
    line: '#f5c542',
    white: '#ece6d8',
    plaza: '#8fa37a',
    plaza2: '#7a9168',
    paper: '#fff4d6',
    ink: '#3a2418',
    accent: '#f5c542',
    verm: '#d94a32',
    skin: '#f0c9a0',
    shadow: 'rgba(10, 12, 20, 0.35)',
    bus: '#3d8ad4',
    taxi: '#f0c12a',
    night: '#1a2238',
    grass: '#4a7a38',
    grass2: '#3a642c',
    field: '#c4b45a',
    dirt: '#8a6a48',
    hwy: '#232834',
    tree: '#2a4e24',
    tarmac: '#5a624c'
  };

  var keys = {};
  var hold = { up: false, down: false, left: false, right: false, act: false };
  var actEdge = false;
  var interactLock = false;
  var scene = 'title';
  var time = 0;
  var cam = { x: 0, y: 0, tx: 0, ty: 0 };
  var map = [];
  var buildings = [];
  var cityMap = [];
  var mallMap = [];
  var trackMap = [];
  var cityBuildings = [];
  var mallBuildings = [];
  var trackBuildings = [];
  var place = 'city';
  var cityReturn = { x: 0, y: 0 };
  var worldReturn = { place: 'city', x: 0, y: 0 };
  var player = { x: 0, y: 0, vx: 0, vy: 0, dir: 0, walk: 0 };
  var npcs = [];
  var poles = [];
  var pieces = [];
  var walkers = [];
  var cars = [];
  var mallDoors = [];
  var shops = [];
  var rentals = [];
  var pumps = [];
  var cans = [];
  var slots = [null];
  var equipped = 0;
  var drive = { on: false, parked: false, x: 0, y: 0, dir: 2, kind: 'rental' };
  var energy = 100;
  var gas = 100;
  var near = null;
  var talk = { lines: [], i: 0, who: '', after: null };
  var quest = 'idle';
  var muted = false;
  var audio = { ctx: null };
  var ride = { pole: null, wait: 0, vehicle: null, phase: null };
  var lattice = 0;
  var flash = 0;
  var NUKE_SECS = 360;
  var nukeLeft = NUKE_SECS;
  var nuked = false;
  var nukeT = 0;
  var shake = 0;

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  function clamp(n, a, b) {
    return n < a ? a : n > b ? b : n;
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function tileAt(px, py) {
    var tx = Math.floor(px / TILE);
    var ty = Math.floor(py / TILE);
    var maxC = map[0] ? map[0].length : COLS;
    var maxR = map.length || ROWS;
    if (tx < 0 || ty < 0 || tx >= maxC || ty >= maxR) return 3;
    return map[ty][tx];
  }

  function solid(id) {
    return id === 3 || id === 8;
  }

  function blocked(x, y, w, h) {
    return solid(tileAt(x, y)) || solid(tileAt(x + w - 1, y)) ||
      solid(tileAt(x, y + h - 1)) || solid(tileAt(x + w - 1, y + h - 1));
  }

  function fill(x, y, w, h, id) {
    var maxC = map[0].length;
    var maxR = map.length;
    var i, j;
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i++) {
        var xx = x + i;
        var yy = y + j;
        if (xx >= 0 && yy >= 0 && xx < maxC && yy < maxR) map[yy][xx] = id;
      }
    }
  }

  function allocMap(c, r) {
    var x, y, m = [];
    for (y = 0; y < r; y++) {
      m[y] = [];
      for (x = 0; x < c; x++) m[y][x] = 0;
    }
    return m;
  }

  function placeMap(p) {
    if (p === 'mall') return mallMap;
    if (p === 'track') return trackMap;
    return cityMap;
  }

  function placeBuildings(p) {
    if (p === 'mall') return mallBuildings;
    if (p === 'track') return trackBuildings;
    return cityBuildings;
  }

  function usePlace(p) {
    place = p;
    map = placeMap(p);
    buildings = placeBuildings(p);
  }

  function snapCamToPlayer() {
    var maxX = Math.max(0, (map[0] ? map[0].length : COLS) * TILE - VW);
    var maxY = Math.max(0, (map.length || ROWS) * TILE - VH);
    cam.x = clamp(player.x - VW / 2, 0, maxX);
    cam.y = clamp(player.y - VH / 2, 0, maxY);
    cam.tx = cam.x;
    cam.ty = cam.y;
  }

  function addBuilding(x, y, w, h, col) {
    fill(x, y, w, h, 3);
    buildings.push({ x: x, y: y, w: w, h: h, col: col || '#888888' });
  }

  function buildMap() {
    map = allocMap(COLS, ROWS);
    buildings = [];
    fill(0, 0, COLS, ROWS, 7);
    fill(0, 0, CITY_W, CITY_H, 0);
    fill(0, 8, CITY_W, 3, 1);
    fill(0, 16, CITY_W, 3, 1);
    fill(0, 24, CITY_W, 3, 1);
    fill(10, 0, 3, CITY_H, 1);
    fill(22, 0, 3, 27, 1);
    fill(34, 0, 3, 27, 1);
    fill(56, 0, 3, CITY_H, 1);
    fill(14, 19, 7, 4, 4);
    fill(CITY_W, 8, COLS - CITY_W, 3, 9);
    fill(CITY_W, 16, COLS - CITY_W, 3, 9);
    fill(CITY_W, 24, COLS - CITY_W, 3, 9);
    fill(10, CITY_H, 3, ROWS - CITY_H, 9);
    fill(56, CITY_H, 3, ROWS - CITY_H, 9);
    fill(0, 50, COLS, 3, 9);
    fill(98, 0, 3, ROWS, 9);
    addBuilding(1, 1, 8, 6);
    addBuilding(14, 1, 7, 6);
    addBuilding(26, 1, 7, 6);
    addBuilding(38, 1, 9, 6);
    addBuilding(48, 1, 7, 6);
    addBuilding(1, 12, 8, 3, '#4a8a7a');
    addBuilding(14, 12, 7, 3);
    addBuilding(26, 12, 7, 3);
    addBuilding(38, 12, 9, 3);
    addBuilding(48, 12, 7, 3, '#4a8a7a');
    addBuilding(1, 20, 8, 3);
    addBuilding(26, 20, 7, 3);
    addBuilding(38, 20, 9, 3);
    addBuilding(48, 20, 7, 3);
    addBuilding(1, 28, 8, 15);
    addBuilding(14, 28, 41, 15);
    paintCountry();
    paintBase();
    paintCrosswalks();
    cityMap = map;
    cityBuildings = buildings;
    map = allocMap(MCOLS, MROWS);
    buildings = [];
    addBuilding(4, 4, 10, 6);
    addBuilding(18, 4, 12, 6);
    addBuilding(34, 4, 10, 6);
    addBuilding(4, 14, 8, 6);
    addBuilding(36, 14, 8, 6);
    addBuilding(4, 24, 10, 5);
    addBuilding(18, 24, 12, 5);
    addBuilding(34, 24, 10, 5);
    mallMap = map;
    mallBuildings = buildings;
    buildTrack();
    usePlace('city');
  }

  function buildTrack() {
    var i;
    map = allocMap(TCOLS, TROWS);
    buildings = [];
    fill(0, 0, TCOLS, TROWS, 7);
    fill(8, 6, 152, 5, 9);
    fill(8, 53, 152, 5, 9);
    fill(8, 6, 5, 52, 9);
    fill(155, 6, 5, 52, 9);
    fill(8, 18, 5, 18, 7);
    fill(8, 31, 22, 5, 9);
    fill(25, 18, 5, 18, 9);
    fill(8, 18, 22, 5, 9);
    fill(50, 6, 32, 5, 7);
    fill(48, 1, 12, 6, 9);
    fill(54, 1, 5, 10, 9);
    fill(54, 6, 20, 5, 9);
    fill(69, 1, 5, 10, 9);
    fill(69, 1, 14, 6, 9);
    fill(155, 20, 22, 5, 9);
    fill(172, 20, 5, 18, 9);
    fill(155, 33, 22, 5, 9);
    fill(18, 47, 90, 3, 1);
    fill(18, 47, 3, 6, 1);
    fill(105, 47, 3, 6, 1);
    for (i = 0; i < 6; i++) fill(30 + i * 2, 53, 1, 5, i % 2 ? 5 : 6);
    fill(148, 16, 10, 5, 12);
    fill(160, 38, 14, 6, 12);
    addBuilding(26, 60, 28, 5, '#6a7080');
    addBuilding(58, 60, 22, 5, '#6a7080');
    addBuilding(3, 22, 3, 14, '#5a6070');
    addBuilding(164, 8, 4, 10, '#5a6070');
    addBuilding(32, 42, 20, 3, '#4a8a7a');
    addBuilding(78, 42, 14, 3, '#888888');
    addBuilding(48, 38, 4, 4, '#d94a32');
    fill(4, 72, TCOLS - 10, 6, 9);
    fill(8, 72, 2, 6, 5);
    fill(TCOLS - 18, 72, 2, 6, 5);
    fill(TCOLS - 16, 72, 10, 6, 12);
    addBuilding(4, 67, 8, 3, '#3a3a42');
    addBuilding(4, 79, 8, 3, '#3a3a42');
    addBuilding(TCOLS - 14, 67, 8, 3, '#3a3a42');
    fill(22, 58, 5, 14, 9);
    fill(148, 58, 5, 14, 9);
    for (i = 2; i < TCOLS - 2; i += 6) {
      if (map[1]) map[1][i] = 8;
      if (map[TROWS - 2]) map[TROWS - 2][i] = 8;
    }
    trackMap = map;
    trackBuildings = buildings;
  }

  function bootEntities() {
    player.x = 18 * TILE;
    player.y = 20 * TILE;
    player.dir = 0;
    npcs = [
      { id: 'mira', name: 'Mira', kind: 'mira', place: 'city', x: 16 * TILE, y: 20 * TILE, lines: [] },
      { id: 'dash', name: 'Dash', kind: 'dash', place: 'city', x: 9 * TILE, y: 15 * TILE, lines: [] },
      { id: 'rex', name: 'Rex', kind: 'rex', place: 'city', x: 22 * TILE, y: 67 * TILE, lines: [] },
      { id: 'kit', name: 'Kit', kind: 'kit', place: 'city', x: 37 * TILE, y: 19 * TILE, lines: [] },
      { id: 'jan', name: 'Jan', kind: 'jan', place: 'mall', x: 18 * TILE, y: 10 * TILE, lines: [] },
      { id: 'oak', name: 'Oak', kind: 'oak', place: 'city', x: 106 * TILE, y: 7 * TILE, lines: [] },
      { id: 'ash', name: 'Ash', kind: 'ash', place: 'city', x: 76 * TILE, y: 62 * TILE, lines: [] }
    ];
    poles = [
      { id: 'bus-plaza', kind: 'bus', name: 'Plaza', x: 13 * TILE, y: 15 * TILE },
      { id: 'bus-east', kind: 'bus', name: 'East Side', x: 37 * TILE, y: 15 * TILE },
      { id: 'bus-base', kind: 'bus', name: 'South Base', x: 9 * TILE, y: 53 * TILE },
      { id: 'bus-mall', kind: 'bus', name: 'Mall', x: 26 * TILE, y: 27 * TILE },
      { id: 'bus-mall-east', kind: 'bus', name: 'Mall East', x: 59 * TILE, y: 36 * TILE },
      { id: 'bus-village', kind: 'bus', name: 'Village', x: 97 * TILE, y: 15 * TILE },
      { id: 'bus-farm', kind: 'bus', name: 'Farm', x: 55 * TILE, y: 53 * TILE },
      { id: 'taxi-plaza', kind: 'taxi', name: 'Plaza', x: 20 * TILE, y: 19 * TILE },
      { id: 'taxi-south', kind: 'taxi', name: 'South Block', x: 8 * TILE, y: 27 * TILE },
      { id: 'taxi-base', kind: 'taxi', name: 'Base Gate', x: 13 * TILE, y: 53 * TILE },
      { id: 'taxi-mall', kind: 'taxi', name: 'Mall', x: 39 * TILE, y: 27 * TILE },
      { id: 'taxi-village', kind: 'taxi', name: 'Village', x: 101 * TILE, y: 7 * TILE },
      { id: 'taxi-farm', kind: 'taxi', name: 'Farm', x: 80 * TILE, y: 53 * TILE }
    ];
    mallDoors = [
      { id: 'n', ox: 32, oy: 27, ow: 4, oh: 2, ix: 20, iy: 0, iw: 8, ih: 2, sx: 22, sy: 2, outX: 33, outY: 26 },
      { id: 's', ox: 32, oy: 43, ow: 4, oh: 2, ix: 20, iy: 30, iw: 8, ih: 2, sx: 22, sy: 29, outX: 33, outY: 43 },
      { id: 'w', ox: 13, oy: 34, ow: 1, oh: 2, ix: 0, iy: 13, iw: 2, ih: 6, sx: 2, sy: 16, outX: 12, outY: 34 },
      { id: 'e', ox: 55, oy: 34, ow: 1, oh: 2, ix: 46, iy: 13, iw: 2, ih: 6, sx: 44, sy: 16, outX: 55, outY: 34 }
    ];
    shops = [
      { name: 'Plaza snack', place: 'city', x: 19 * TILE, y: 22 * TILE },
      { name: 'Food court', place: 'mall', x: 26 * TILE, y: 12 * TILE },
      { name: 'Village shop', place: 'city', x: 94 * TILE, y: 15 * TILE },
      { name: 'Farm stand', place: 'city', x: 70 * TILE, y: 61 * TILE }
    ];
    rentals = [
      { name: 'West lot', place: 'city', x: 4 * TILE, y: 15 * TILE },
      { name: 'East lot', place: 'city', x: 51 * TILE, y: 15 * TILE },
      { name: 'Village lot', place: 'city', x: 88 * TILE, y: 15 * TILE },
      { name: 'Farm lot', place: 'city', x: 90 * TILE, y: 53 * TILE }
    ];
    pumps = [
      { name: 'West pump', place: 'city', x: 6 * TILE, y: 15 * TILE },
      { name: 'Plaza pump', place: 'city', x: 18 * TILE, y: 15 * TILE },
      { name: 'East pump', place: 'city', x: 52 * TILE, y: 15 * TILE },
      { name: 'Mall pump', place: 'city', x: 28 * TILE, y: 27 * TILE },
      { name: 'Village pump', place: 'city', x: 89 * TILE, y: 15 * TILE },
      { name: 'Farm pump', place: 'city', x: 90 * TILE, y: 50 * TILE },
      { name: 'Base pump', place: 'city', x: 12 * TILE, y: 50 * TILE }
    ];
    cans = [];
    slots = [null];
    equipped = 0;
    bootWalkers();
    bootCars();
    if (!pieces.length) resetPieces();
    settlePieces();
    refreshLines();
  }

  function plant(x, y) {
    if (map[y] && map[y][x] === 7) map[y][x] = 8;
  }

  function paintCountry() {
    fill(68, 28, 14, 10, 11);
    fill(84, 34, 12, 8, 11);
    fill(70, 62, 18, 10, 11);
    fill(104, 54, 12, 12, 11);
    fill(64, 20, 20, 2, 10);
    fill(80, 22, 2, 28, 10);
    fill(82, 54, 14, 2, 10);
    fill(104, 7, 10, 1, 10);
    addBuilding(86, 1, 8, 5, '#8a6238');
    addBuilding(104, 1, 8, 5, '#8a6238');
    addBuilding(86, 12, 8, 3, '#4a8a7a');
    addBuilding(104, 12, 7, 3, '#8a6238');
    addBuilding(90, 20, 6, 3, '#8a6238');
    addBuilding(74, 56, 8, 5, '#7a4a28');
    addBuilding(88, 58, 6, 4, '#4a8a7a');
    var trees = [
      [66, 4], [70, 6], [74, 3], [78, 12], [82, 6], [110, 6], [114, 12],
      [66, 32], [72, 40], [108, 28], [112, 36], [64, 56], [68, 60],
      [94, 70], [100, 66], [110, 70], [114, 58], [84, 74], [76, 74]
    ];
    trees.forEach(function (t) { plant(t[0], t[1]); plant(t[0] + 1, t[1]); });
  }

  function paintBase() {
    var wall = '#3a4234';
    var tower = '#2a3028';
    fill(8, 54, 38, 20, 12);
    addBuilding(8, 54, 38, 2, wall);
    addBuilding(8, 72, 38, 2, wall);
    addBuilding(8, 56, 2, 16, wall);
    addBuilding(44, 56, 2, 16, wall);
    fill(10, 54, 3, 2, 9);
    addBuilding(8, 54, 2, 3, tower);
    addBuilding(44, 54, 2, 3, tower);
    addBuilding(8, 71, 2, 3, tower);
    addBuilding(44, 71, 2, 3, tower);
    fill(10, 54, 3, 16, 1);
    fill(13, 64, 16, 2, 1);
    fill(20, 66, 8, 5, 4);
    addBuilding(16, 57, 12, 6, '#4a5840');
    addBuilding(30, 57, 10, 4, '#3e4a38');
    addBuilding(30, 63, 10, 4, '#3e4a38');
    addBuilding(13, 67, 6, 4, '#32363a');
  }

  function paintCrosswalks() {
    var vx = [10, 22, 34, 56];
    var hy = [8, 16, 24];
    var sy = [1, 7, 11, 15, 19, 23, 27, 33, 43];
    var sx = [3, 9, 13, 21, 25, 33, 37, 47, 55, 59];
    var i, j, x, y;
    for (i = 0; i < vx.length; i++) {
      for (j = 0; j < sy.length; j++) {
        x = vx[i];
        y = sy[j];
        if (y >= 0 && y < ROWS && map[y] && map[y][x] === 1) fill(x, y, 3, 1, 5);
      }
    }
    for (i = 0; i < hy.length; i++) {
      for (j = 0; j < sx.length; j++) {
        x = sx[j];
        y = hy[i];
        if (x >= 0 && x < COLS && map[y] && map[y][x] === 1) fill(x, y, 1, 3, 6);
      }
    }
  }

  function bootWalkers() {
    var kinds = ['fox', 'wolf', 'squirrel', 'cat', 'rabbit', 'raccoon', 'bear', 'pigeon'];
    walkers = [];
    var spots = [
      [16, 7], [40, 7], [8, 15], [28, 15],
      [18, 19], [40, 19], [8, 23], [40, 23],
      [6, 27], [50, 27], [13, 34], [55, 34],
      [70, 12], [90, 7], [106, 15], [92, 28],
      [66, 54], [92, 64], [110, 20], [80, 66],
      [24, 66], [36, 68]
    ];
    var mallSpots = [
      [16, 12], [24, 16], [32, 12], [20, 20], [16, 8], [12, 18], [32, 18], [16, 22]
    ];
    spots.forEach(function (s, i) {
      walkers.push({
        place: 'city',
        x: s[0] * TILE,
        y: s[1] * TILE,
        dir: i % 4,
        wait: Math.random(),
        species: kinds[i % kinds.length]
      });
    });
    mallSpots.forEach(function (s, i) {
      walkers.push({
        place: 'mall',
        x: s[0] * TILE,
        y: s[1] * TILE,
        dir: (i + 1) % 4,
        wait: Math.random(),
        species: kinds[(i + 3) % kinds.length]
      });
    });
  }

  function pt(tx, ty) {
    return { x: tx * TILE + 8, y: ty * TILE + 8 };
  }

  function makeLoop(x0, y0, x1, y1) {
    var pts = [];
    var x, y;
    for (x = x0; x < x1; x++) pts.push(pt(x, y0));
    for (y = y0; y < y1; y++) pts.push(pt(x1, y));
    for (x = x1; x > x0; x--) pts.push(pt(x, y1));
    for (y = y1; y > y0; y--) pts.push(pt(x0, y));
    return pts;
  }

  function makeVertShuttle(xDown, xUp, y0, y1) {
    var pts = [];
    var y;
    for (y = y0; y <= y1; y++) pts.push(pt(xDown, y));
    for (y = y1; y >= y0; y--) pts.push(pt(xUp, y));
    return pts;
  }

  function bootCars() {
    cars = [];
    function add(path, n, kind0) {
      var i, pi, kind, c, tries;
      for (i = 0; i < n; i++) {
        pi = Math.floor((i * path.length) / n) % path.length;
        kind = ['bus', 'taxi', 'car'][(kind0 + i) % 3];
        c = {
          kind: kind,
          path: path,
          pi: pi,
          x: path[pi].x,
          y: path[pi].y,
          dir: 2,
          stuck: 0,
          spd: kind === 'taxi' ? 168 : kind === 'bus' ? 150 : 158
        };
        tries = 0;
        while (tries < path.length && carHits(c, c.x, c.y, -1)) {
          pi = (pi + 7) % path.length;
          c.pi = pi;
          c.x = path[pi].x;
          c.y = path[pi].y;
          tries += 7;
        }
        cars.push(c);
      }
    }
    add(makeLoop(10, 10, 58, 24), 2, 0);
    add(makeLoop(56, 10, 98, 50), 2, 1);
    add(makeVertShuttle(12, 10, 46, 52), 1, 2);
    add(makeVertShuttle(100, 98, 10, 76), 2, 0);
  }

  function carSize(c) {
    var horiz = c.dir === 1 || c.dir === 2;
    var long = c.kind === 'bus' ? 18 : c.kind === 'taxi' ? 14 : c.kind === 'rocket' ? 18 : (c.kind === 'sport' || c.kind === 'outdoors') ? 16 : 12;
    var short = c.kind === 'bus' ? 8 : (c.kind === 'sport' || c.kind === 'outdoors' || c.kind === 'rocket') ? 6 : 7;
    return horiz ? { w: long, h: short } : { w: short, h: long };
  }

  function carHits(c, nx, ny, skip) {
    var a = carSize(c);
    var i, o, b, ahead;
    var fdx = c.dir === 2 ? 1 : c.dir === 1 ? -1 : 0;
    var fdy = c.dir === 0 ? 1 : c.dir === 3 ? -1 : 0;
    for (i = 0; i < cars.length; i++) {
      if (i === skip) continue;
      o = cars[i];
      b = carSize(o);
      if (!aabb(nx - a.w / 2, ny - a.h / 2, a.w + 2, a.h + 2, o.x - b.w / 2, o.y - b.h / 2, b.w, b.h)) continue;
      ahead = (o.x - c.x) * fdx + (o.y - c.y) * fdy;
      if (ahead > 0) return true;
    }
    if (scene === 'ride' && ride.vehicle) {
      o = ride.vehicle;
      o.dir = o.dir || c.dir;
      b = carSize(o);
      if (aabb(nx - a.w / 2, ny - a.h / 2, a.w + 2, a.h + 2, o.x - b.w / 2, o.y - b.h / 2, b.w, b.h)) {
        ahead = (o.x - c.x) * fdx + (o.y - c.y) * fdy;
        if (ahead > 0) return true;
      }
    }
    if (drive.on || drive.parked) {
      o = drive;
      b = carSize(o);
      if (aabb(nx - a.w / 2, ny - a.h / 2, a.w + 2, a.h + 2, o.x - b.w / 2, o.y - b.h / 2, b.w, b.h)) {
        ahead = (o.x - c.x) * fdx + (o.y - c.y) * fdy;
        if (ahead > 0) return true;
      }
    }
    return false;
  }

  function updateCars(dt) {
    var i, c, p, dx, dy, dist, nx, ny, nxt;
    for (i = 0; i < cars.length; i++) {
      c = cars[i];
      if (!c.path || !c.path.length) continue;
      p = c.path[c.pi];
      dx = p.x - c.x;
      dy = p.y - c.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 4) {
        c.pi = (c.pi + 1) % c.path.length;
        nxt = c.path[c.pi];
        dx = nxt.x - c.x;
        dy = nxt.y - c.y;
        if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 2 : 1;
        else if (dy) c.dir = dy > 0 ? 0 : 3;
        continue;
      }
      if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 2 : 1;
      else c.dir = dy > 0 ? 0 : 3;
      nx = c.x + (dx / dist) * c.spd * dt;
      ny = c.y + (dy / dist) * c.spd * dt;
      if (!carHits(c, nx, ny, i)) {
        c.x = nx;
        c.y = ny;
        c.stuck = 0;
      } else {
        c.stuck += dt;
        if (c.stuck > 0.18) {
          c.pi = (c.pi + 4) % c.path.length;
          c.x = c.path[c.pi].x;
          c.y = c.path[c.pi].y;
          c.stuck = 0;
        }
      }
    }
  }

  function resetPieces() {
    pieces = [
      { id: 1, place: 'city', x: 18 * TILE + 5, y: 21 * TILE + 5, got: false },
      { id: 2, place: 'city', x: 88 * TILE + 5, y: 19 * TILE + 5, got: false },
      { id: 3, place: 'city', x: 9 * TILE + 3, y: 15 * TILE + 5, got: false },
      { id: 4, place: 'city', x: 16 * TILE + 5, y: 7 * TILE + 5, got: false },
      { id: 5, place: 'mall', x: 31 * TILE + 5, y: 12 * TILE + 5, got: false },
      { id: 6, place: 'city', x: 82 * TILE + 5, y: 64 * TILE + 5, got: false }
    ];
  }

  function pieceTileOk(placeName, px, py) {
    var m = placeName === 'mall' ? mallMap : cityMap;
    var tx = Math.floor(px / TILE);
    var ty = Math.floor(py / TILE);
    if (!m[ty] || tx < 0 || tx >= m[0].length) return false;
    var id = m[ty][tx];
    return id !== 3 && id !== 8;
  }

  function settlePieces() {
    pieces.forEach(function (p) {
      if (pieceTileOk(p.place, p.x, p.y) && pieceTileOk(p.place, p.x + 3, p.y + 3)) return;
      var r, dx, dy, nx, ny;
      for (r = 1; r <= 10; r++) {
        for (dy = -r; dy <= r; dy++) {
          for (dx = -r; dx <= r; dx++) {
            nx = (Math.floor(p.x / TILE) + dx) * TILE + 5;
            ny = (Math.floor(p.y / TILE) + dy) * TILE + 5;
            if (pieceTileOk(p.place, nx, ny) && pieceTileOk(p.place, nx + 3, ny + 3)) {
              p.x = nx;
              p.y = ny;
              return;
            }
          }
        }
      }
    });
  }

  function pieceCount() {
    return pieces.filter(function (p) { return p.got; }).length;
  }

  function missingHints() {
    var hints = [
      'Plaza. On the grass by Mira.',
      'Village. Highway east. By the inn.',
      'West alley. Between the gray blocks and the road.',
      'North sidewalk. In front of the north buildings.',
      'Mall hall. Inside. East of the food court.',
      'Farm field. South of the barns.'
    ];
    return pieces.map(function (p, i) {
      return p.got ? null : hints[i];
    }).filter(Boolean);
  }

  function npc(id) {
    var i;
    for (i = 0; i < npcs.length; i++) if (npcs[i].id === id) return npcs[i];
    return npcs[0];
  }

  function refreshLines() {
    var n = pieceCount();
    if (quest === 'idle') {
      npc('mira').lines = [
        'Mira. Arctic fox. Civic works. The clouds are not weather.',
        'The forcefield blueprint was six pieces. I lost every one.',
        'Six minutes on the clock. Then the map nukes. City, mall, village, farm. Then South Base.',
        hasJerry()
          ? 'You already have a can. Fill it at a yellow pump, then press 1 at the car.'
          : 'Take this empty jerry can. Slot 1. Rent a car. Fill the can at a pump when you run dry.'
      ];
    } else if (quest === 'hunt') {
      npc('mira').lines = n >= 6
        ? [
          'That is all six. Rex at South Base. Do not stop for snacks.',
          hasJerry() ? 'Fill that can at a pump. You cannot return a dead car.' : 'Empty jerry can. Slot 1. Fill it at a pump.'
        ]
        : [
          'That is ' + n + ' of 6. Mall, village past the highway, farm south. Check the map.',
          hasJerry() ? 'Pump fills the can. Press 1 at the car to pour.' : 'Empty jerry can. Slot 1. You need it to rent.'
        ];
    } else if (quest === 'have') {
      npc('mira').lines = [
        'You still have the set? South. The base. Poles if you want speed.',
        hasJerry() ? 'Fill the can at a pump if the tank died.' : 'Empty jerry can. Slot 1.'
      ];
    } else {
      npc('mira').lines = [
        'I felt it lock in. A whole sky of glass. We get to keep the world.',
        hasJerry() ? 'Keep the can.' : 'Empty jerry can. Old habit.'
      ];
    }
    npc('dash').lines = [
      'Dash the squirrel. Blue pole is a bus. Yellow pole is a taxi.',
      'Teal buildings rent cars. Get a can from Mira first. Empty tank stops dead.',
      'Fill the can at a yellow pump. Press 1 to pour it in. No gas means you cannot return.',
      'Highway runs east to the village. South belt hits the farm. Watch the minimap.'
    ];
    if (quest === 'have' || (quest === 'hunt' && n >= 6)) {
      npc('rex').lines = [
        'Six pieces. That is the set.',
        'Copy that. Forcefield coming up. Stay on the pad and watch the sky.'
      ];
    } else if (quest === 'idle' || quest === 'hunt') {
      npc('rex').lines = ['South Base. Clock is live. You have ' + n + ' of 6. Still out:'].concat(missingHints());
    } else {
      npc('rex').lines = ['Forcefield is live. The world stays. Go home. Or do not. The meters still eat coins.'];
    }
    npc('kit').lines = ['Kit the cat. Mall, plus the country. Teal lot rents a car. Highway east. Farm is a long walk or a pole.'];
    npc('jan').lines = [
      'Jan the rabbit. Energy first. Walking spends it. The yellow bar is up top.',
      'Empty bar means you crawl at one third speed. Get to a shop. Plaza, this mall, village, farm stand.',
      n >= 6 || pieces[4] && pieces[4].got
        ? 'Food court is just gray too. You already took the scrap.'
        : 'Paper on the floor by the east shops. I thought it was a receipt.'
    ];
    npc('oak').lines = pieces[1] && pieces[1].got
      ? ['Oak the bear. You found the village scrap. The highway goes home if you want it.']
      : ['Oak the bear. Village. A scrap sat by the inn. Highway west is the city.'];
    npc('ash').lines = pieces[5] && pieces[5].got
      ? ['Ash the deer. Barn is quieter without that paper blowing in the barley.']
      : ['Ash the deer. Farm. Something white is in the south field. Poles on the belt road.'];
  }

  function questLabel() {
    if (quest === 'idle') return 'Find Mira · Plaza';
    if (quest === 'hunt') return 'Pieces ' + pieceCount() + ' / 6';
    if (quest === 'have') return 'All 6 · South Base';
    if (quest === 'build') return 'Forcefield coming up';
    return 'World saved';
  }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(SAVE) || '{}');
      if (d.quest) quest = d.quest;
      muted = !!d.muted;
      if (d.pieces && d.pieces.length === 6) {
        resetPieces();
        d.pieces.forEach(function (g, i) { if (pieces[i]) pieces[i].got = !!g; });
      }
      if (quest === 'build') quest = pieceCount() >= 6 ? 'have' : 'hunt';
      if (quest === 'have' && pieceCount() < 6) quest = 'hunt';
      if (typeof d.energy === 'number') energy = clamp(d.energy, 0, 100);
      if (typeof d.gas === 'number') gas = clamp(d.gas, 0, 100);
      if (typeof d.nukeLeft === 'number') nukeLeft = clamp(d.nukeLeft, 0, NUKE_SECS);
    } catch (e) {}
  }

  function save() {
    localStorage.setItem(SAVE, JSON.stringify({
      quest: quest,
      muted: muted,
      pieces: pieces.map(function (p) { return p.got; }),
      energy: energy,
      gas: gas,
      nukeLeft: nukeLeft
    }));
  }

  function clockText() {
    var s = Math.max(0, Math.ceil(nukeLeft));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function drawHud() {
    ui.stamps.textContent = questLabel();
    ui.mute.textContent = muted ? 'Muted' : 'Sound';
    if (ui.energy) {
      ui.energy.style.width = Math.max(0, energy) + '%';
      ui.energyWrap.classList.toggle('low', energy <= 22);
      ui.energyWrap.classList.toggle('empty', energy <= 0);
    }
    if (ui.gas) {
      ui.gas.style.width = Math.max(0, gas) + '%';
      ui.gasWrap.classList.toggle('low', gas <= 22);
      ui.gasWrap.classList.toggle('empty', gas <= 0);
    }
    if (ui.clock) {
      ui.clock.textContent = quest === 'saved' ? 'SAFE' : clockText();
      ui.clockWrap.classList.toggle('low', nukeLeft <= 60 && quest !== 'saved');
      ui.clockWrap.classList.toggle('empty', nukeLeft <= 15 && quest !== 'saved');
    }
    if (ui.slot1) {
      ui.slot1.classList.toggle('has', hasJerry());
      ui.slot1.classList.toggle('full', jerryFull());
      ui.slot1.classList.toggle('equip', equipped === 1);
    }
  }

  function tickNuke(dt) {
    if (nuked || quest === 'saved') return;
    nukeLeft = Math.max(0, nukeLeft - dt);
    drawHud();
    if (nukeLeft <= 0) startNuke();
  }

  function startNuke(force) {
    if (!force && (quest === 'saved' || lattice >= 1)) {
      quest = 'saved';
      lattice = 1;
      save();
      drawHud();
      return;
    }
    if (nuked || scene === 'nuke') return;
    nuked = true;
    nukeT = 0;
    flash = 1;
    shake = 1;
    lattice = 0;
    nukeLeft = 0;
    ride.vehicle = null;
    ride.path = null;
    ride.phase = null;
    drive.on = false;
    drive.parked = false;
    show(ui.title, false);
    show(ui.dialog, false);
    show(ui.card, false);
    show(ui.prompt, false);
    show(ui.hud, true);
    scene = 'nuke';
    save();
    drawHud();
    beep(70, 0.9, 0.09, 'sawtooth');
    beep(36, 1.3, 0.06, 'triangle');
  }

  function ensureAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio.ctx) audio.ctx = new AC();
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
  }

  function beep(freq, dur, gain, type) {
    if (muted || !audio.ctx) return;
    var o = audio.ctx.createOscillator();
    var g = audio.ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.04, audio.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + dur);
    o.connect(g);
    g.connect(audio.ctx.destination);
    o.start();
    o.stop(audio.ctx.currentTime + dur + 0.02);
  }

  function pix(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h));
  }

  function isRoad(tx, ty) {
    if (!map[ty] || tx < 0 || ty < 0 || tx >= map[0].length || ty >= map.length) return false;
    var id = map[ty][tx];
    return id === 1 || id === 5 || id === 6 || id === 9;
  }

  function pedWalk(px, py) {
    var id = tileAt(px, py);
    return id === 0 || id === 4 || id === 5 || id === 6 || id === 7 || id === 10 || id === 11 || id === 12;
  }

  function walkerOk(x, y) {
    if (x < 0 || y < 0) return false;
    if (x + CHAR_W > map[0].length * TILE || y + CHAR_H > map.length * TILE) return false;
    if (place === 'mall') return !blocked(x, y, CHAR_W, CHAR_H);
    return pedWalk(x, y) && pedWalk(x + CHAR_W - 1, y) &&
      pedWalk(x, y + CHAR_H - 1) && pedWalk(x + CHAR_W - 1, y + CHAR_H - 1);
  }

  function nearestRoad(px, py) {
    var tx = Math.floor(px / TILE);
    var ty = Math.floor(py / TILE);
    if (isRoad(tx, ty)) return { x: tx * TILE + 8, y: ty * TILE + 8 };
    var r, dx, dy;
    for (r = 1; r <= 4; r++) {
      for (dy = -r; dy <= r; dy++) {
        for (dx = -r; dx <= r; dx++) {
          if (isRoad(tx + dx, ty + dy)) {
            return { x: (tx + dx) * TILE + 8, y: (ty + dy) * TILE + 8 };
          }
        }
      }
    }
    return { x: px, y: py };
  }

  function findPath(sx, sy, ex, ey) {
    var start = [Math.floor(sx / TILE), Math.floor(sy / TILE)];
    var goal = [Math.floor(ex / TILE), Math.floor(ey / TILE)];
    var key = function (x, y) { return x + ',' + y; };
    var q = [start];
    var came = {};
    came[key(start[0], start[1])] = null;
    var head = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < q.length) {
      var cur = q[head++];
      if (cur[0] === goal[0] && cur[1] === goal[1]) break;
      var i;
      for (i = 0; i < 4; i++) {
        var nx = cur[0] + dirs[i][0];
        var ny = cur[1] + dirs[i][1];
        var k = key(nx, ny);
        if (came[k] !== undefined || !isRoad(nx, ny)) continue;
        came[k] = cur;
        q.push([nx, ny]);
      }
    }
    if (came[key(goal[0], goal[1])] === undefined && !(start[0] === goal[0] && start[1] === goal[1])) {
      return [{ x: sx, y: sy }, { x: ex, y: ey }];
    }
    var tiles = [];
    var at = goal;
    while (at) {
      tiles.push(at);
      at = came[key(at[0], at[1])];
    }
    tiles.reverse();
    return tiles.map(function (t) {
      return { x: t[0] * TILE + 8, y: t[1] * TILE + 8 };
    });
  }

  function drawTile(id, sx, sy) {
    var gx = sx - cam.x;
    var gy = sy - cam.y;
    var i, tx, ty;
    if (gx > VW || gy > VH || gx + TILE < 0 || gy + TILE < 0) return;
    if (nuked && (id === 7 || id === 4 || id === 11 || id === 10 || id === 12)) {
      pix(gx, gy, TILE, TILE, ((sx + sy) / TILE) % 2 === 0 ? '#4a3228' : '#3a281e');
      return;
    }
    if (nuked && id === 8) {
      pix(gx, gy, TILE, TILE, '#3a281e');
      pix(gx + 6, gy + 10, 3, 5, '#2a1c14');
      pix(gx + 4, gy + 8, 7, 3, '#4a3a30');
      return;
    }
    if (nuked && id === 3) {
      pix(gx, gy, TILE, TILE, '#3e3834');
      return;
    }
    if (id === 1) pix(gx, gy, TILE, TILE, nuked ? '#1a1816' : C.road);
    else if (id === 9) {
      pix(gx, gy, TILE, TILE, nuked ? '#161410' : C.hwy);
      tx = Math.floor(sx / TILE);
      ty = Math.floor(sy / TILE);
      if (place === 'track') {
        if (roadTile(tileAt(sx - TILE, sy + 8)) && roadTile(tileAt(sx + TILE + 8, sy + 8)) && tx % 2 === 0) {
          pix(gx + 1, gy + 7, TILE - 2, 2, C.line);
        } else if (roadTile(tileAt(sx + 8, sy - TILE)) && roadTile(tileAt(sx + 8, sy + TILE + 8)) && ty % 2 === 0) {
          pix(gx + 7, gy + 1, 2, TILE - 2, C.line);
        }
      } else if ((ty === 9 || ty === 17 || ty === 25 || ty === 51) && tx % 2 === 0) {
        pix(gx + 1, gy + 7, TILE - 2, 2, C.line);
      } else if ((tx === 11 || tx === 57 || tx === 99) && ty % 2 === 0) {
        pix(gx + 7, gy + 1, 2, TILE - 2, C.line);
      }
    } else if (id === 5) {
      pix(gx, gy, TILE, TILE, C.road);
      for (i = 0; i < 4; i++) pix(gx + 2 + i * 3, gy + 1, 2, TILE - 2, C.white);
    } else if (id === 6) {
      pix(gx, gy, TILE, TILE, C.road);
      for (i = 0; i < 4; i++) pix(gx + 1, gy + 2 + i * 3, TILE - 2, 2, C.white);
    } else if (id === 4) pix(gx, gy, TILE, TILE, C.plaza);
    else if (id === 3) pix(gx, gy, TILE, TILE, '#888888');
    else if (id === 7) pix(gx, gy, TILE, TILE, ((sx + sy) / TILE) % 2 === 0 ? C.grass : C.grass2);
    else if (id === 8) {
      pix(gx, gy, TILE, TILE, C.grass);
      pix(gx + 6, gy + 10, 3, 5, '#5a3a22');
      pix(gx + 2, gy + 1, 12, 10, C.tree);
      pix(gx + 4, gy + 3, 8, 6, '#3d6a30');
    } else if (id === 10) pix(gx, gy, TILE, TILE, C.dirt);
    else if (id === 11) pix(gx, gy, TILE, TILE, ((sx / TILE) % 2 === 0) ? C.field : '#b8a44c');
    else if (id === 12) pix(gx, gy, TILE, TILE, ((sx + sy) / TILE) % 2 === 0 ? C.tarmac : '#4e5642');
    else pix(gx, gy, TILE, TILE, C.walk);
  }

  function drawBuilding(b) {
    var h = nuked ? Math.max(TILE, Math.floor(b.h * TILE * 0.4)) : b.h * TILE;
    pix(b.x * TILE - cam.x, b.y * TILE - cam.y + (b.h * TILE - h), b.w * TILE, h, nuked ? '#3e3630' : (b.col || '#888888'));
  }

  function drawShop(s) {
    var gx = Math.round(s.x - cam.x);
    var gy = Math.round(s.y - cam.y);
    pix(gx - 1, gy + 4, 12, 8, '#6a4a32');
    pix(gx - 2, gy + 1, 14, 4, C.verm);
    pix(gx + 2, gy + 6, 3, 4, C.paper);
    pix(gx + 6, gy + 6, 2, 3, C.accent);
    pix(gx + 3, gy - 1, 6, 3, C.paper);
    pix(gx + 4, gy - 1, 4, 2, C.verm);
  }

  function useShop() {
    energy = 100;
    save();
    drawHud();
    interactLock = true;
    actEdge = false;
    beep(720, 0.1, 0.05, 'sine');
  }

  function drawRental(s) {
    var gx = Math.round(s.x - cam.x);
    var gy = Math.round(s.y - cam.y);
    pix(gx - 1, gy + 4, 13, 8, '#3a5248');
    pix(gx - 2, gy + 1, 15, 4, '#3cb8a0');
    pix(gx + 2, gy + 6, 8, 4, '#3cb8a0');
    pix(gx + 3, gy + 7, 2, 2, '#222');
    pix(gx + 7, gy + 7, 2, 2, '#222');
    pix(gx + 4, gy - 1, 5, 3, C.paper);
    pix(gx + 5, gy - 1, 3, 2, '#3cb8a0');
  }

  function drawPump(s) {
    var gx = Math.round(s.x - cam.x);
    var gy = Math.round(s.y - cam.y);
    pix(gx + 1, gy + 8, 6, 2, '#3a2418');
    pix(gx + 2, gy + 1, 5, 8, '#3a3a42');
    pix(gx + 3, gy + 2, 3, 3, C.accent);
    pix(gx + 7, gy + 3, 3, 1, '#222');
    pix(gx + 9, gy + 3, 1, 5, '#222');
    pix(gx + 3, gy - 1, 3, 2, C.verm);
  }

  function hasJerry() {
    return !!(slots[0] && slots[0].id === 'jerry');
  }

  function jerryFull() {
    return hasJerry() && !!slots[0].full;
  }

  function giveJerry() {
    if (hasJerry()) return false;
    slots[0] = { id: 'jerry', full: false };
    equipped = 0;
    drawHud();
    return true;
  }

  function canPourHere() {
    if (!jerryFull() || equipped !== 1 || gas >= 100) return false;
    if (drive.on) return true;
    if (!drive.parked) return false;
    return Math.abs(player.x - drive.x) + Math.abs(player.y - drive.y) < 26;
  }

  function pumpText() {
    if (jerryFull()) return 'Can is full';
    return 'Pump · Fill jerry can';
  }

  function pourReady() {
    if (!hasJerry() || gas >= 100) return null;
    if (!jerryFull()) return { kind: 'needpump', text: 'Fill the can at a pump' };
    if (equipped === 1) return { kind: 'pour', text: 'Pour jerry can' };
    return { kind: 'need1', text: 'Press 1 · Equip jerry can' };
  }

  function equipSlot(n) {
    if (n !== 1) return;
    if (!hasJerry()) {
      beep(140, 0.08, 0.04);
      return;
    }
    equipped = equipped === 1 ? 0 : 1;
    drawHud();
    beep(420, 0.07, 0.04, 'square');
  }

  function usePump() {
    if (equipped !== 1 || !hasJerry() || jerryFull()) {
      interactLock = true;
      actEdge = false;
      beep(140, 0.08, 0.04);
      return;
    }
    slots[0].full = true;
    drawHud();
    interactLock = true;
    actEdge = false;
    beep(500, 0.1, 0.05, 'square');
  }

  function roadTile(id) {
    return id === 1 || id === 5 || id === 6 || id === 9;
  }

  function roadOk(x, y, sz) {
    var hw = sz.w / 2;
    var hh = sz.h / 2;
    return roadTile(tileAt(x - hw + 1, y - hh + 1)) &&
      roadTile(tileAt(x + hw - 1, y - hh + 1)) &&
      roadTile(tileAt(x - hw + 1, y + hh - 1)) &&
      roadTile(tileAt(x + hw - 1, y + hh - 1));
  }

  function openOk(x, y, sz) {
    var hw = sz.w / 2;
    var hh = sz.h / 2;
    var maxC = (map[0] ? map[0].length : COLS) * TILE;
    var maxR = (map.length || ROWS) * TILE;
    if (x - hw < 0 || y - hh < 0 || x + hw > maxC || y + hh > maxR) return false;
    return !solid(tileAt(x - hw + 1, y - hh + 1)) &&
      !solid(tileAt(x + hw - 1, y - hh + 1)) &&
      !solid(tileAt(x - hw + 1, y + hh - 1)) &&
      !solid(tileAt(x + hw - 1, y + hh - 1));
  }

  function driveOk(x, y, sz) {
    return drive.kind === 'outdoors' ? openOk(x, y, sz) : roadOk(x, y, sz);
  }

  function nearestPed(px, py) {
    var tx = Math.floor(px / TILE);
    var ty = Math.floor(py / TILE);
    var r, dx, dy, x, y;
    if (pedWalk(px, py)) return { x: px, y: py };
    for (r = 1; r <= 5; r++) {
      for (dy = -r; dy <= r; dy++) {
        for (dx = -r; dx <= r; dx++) {
          x = (tx + dx) * TILE + 4;
          y = (ty + dy) * TILE + 4;
          if (pedWalk(x, y) && !blocked(x, y, CHAR_W, CHAR_H)) return { x: x, y: y };
        }
      }
    }
    return { x: px + 8, y: py };
  }

  function drawCan(c) {
    var gx = Math.round(c.x - cam.x);
    var gy = Math.round(c.y - cam.y);
    pix(gx + 1, gy + 2, 5, 7, C.verm);
    pix(gx + 2, gy + 3, 3, 4, C.accent);
    pix(gx + 2, gy + 1, 3, 2, '#3a2418');
    pix(gx + 3, gy, 2, 2, '#3a2418');
  }

  function takeCan(c) {
    if (!giveJerry()) {
      interactLock = true;
      actEdge = false;
      return;
    }
    c.gone = 18;
    interactLock = true;
    actEdge = false;
    beep(500, 0.1, 0.05, 'square');
  }

  function pourCan() {
    if (!jerryFull() || equipped !== 1 || gas >= 100) {
      interactLock = true;
      actEdge = false;
      return;
    }
    slots[0].full = false;
    equipped = 0;
    gas = 100;
    save();
    drawHud();
    interactLock = true;
    actEdge = false;
    beep(640, 0.12, 0.05, 'sine');
  }

  function rentCar() {
    if (!hasJerry()) {
      interactLock = true;
      actEdge = false;
      beep(140, 0.08, 0.04);
      return;
    }
    if (gas <= 0 && drive.parked) {
      interactLock = true;
      actEdge = false;
      beep(140, 0.08, 0.04);
      return;
    }
    gas = 100;
    var pad = nearestRoad(player.x, player.y);
    drive.on = true;
    drive.parked = false;
    drive.x = pad.x;
    drive.y = pad.y;
    drive.dir = 2;
    drive.kind = 'rental';
    player.x = pad.x;
    player.y = pad.y;
    interactLock = true;
    actEdge = false;
    beep(360, 0.1, 0.05, 'triangle');
  }

  function parkCar() {
    var n = nearestPed(drive.x, drive.y);
    player.x = n.x;
    player.y = n.y;
    drive.on = false;
    drive.parked = true;
    interactLock = true;
    actEdge = false;
    beep(280, 0.08, 0.04);
  }

  function boardCar() {
    if (gas <= 0) {
      if (jerryFull() && equipped === 1) pourCan();
      if (gas <= 0) {
        interactLock = true;
        actEdge = false;
        beep(140, 0.08, 0.04);
        return;
      }
    }
    drive.on = true;
    drive.parked = false;
    player.x = drive.x;
    player.y = drive.y;
    interactLock = true;
    actEdge = false;
    beep(360, 0.08, 0.04, 'triangle');
  }

  function returnCar() {
    if (gas <= 0) {
      interactLock = true;
      actEdge = false;
      beep(140, 0.08, 0.04);
      return;
    }
    if (drive.on) parkCar();
    drive.on = false;
    drive.parked = false;
    interactLock = true;
    actEdge = false;
    beep(200, 0.1, 0.04, 'sine');
  }

  function updateDrive(dt) {
    var cheat = drive.kind === 'sport' || drive.kind === 'outdoors' || drive.kind === 'rocket';
    if (!cheat && gas <= 0) {
      parkCar();
      return;
    }
    var spd = 108;
    if (drive.kind === 'outdoors') spd = 196;
    if (drive.kind === 'sport') spd = 392;
    if (drive.kind === 'rocket') spd = 1960;
    var ox = drive.x;
    var oy = drive.y;
    var vx = (hold.left ? -spd : 0) + (hold.right ? spd : 0);
    var vy = (hold.up ? -spd : 0) + (hold.down ? spd : 0);
    if (vx && vy) {
      vx *= 0.72;
      vy *= 0.72;
    }
    if (Math.abs(vx) > Math.abs(vy)) {
      if (vx > 0) drive.dir = 2;
      if (vx < 0) drive.dir = 1;
    } else if (vy) {
      drive.dir = vy > 0 ? 0 : 3;
    }
    var sz = carSize(drive);
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)) * dt / 8));
    var sdt = dt / steps;
    var i, nx, ny;
    for (i = 0; i < steps; i++) {
      nx = drive.x + vx * sdt;
      ny = drive.y + vy * sdt;
      if (driveOk(nx, drive.y, sz)) drive.x = nx;
      if (driveOk(drive.x, ny, sz)) drive.y = ny;
    }
    if (!cheat && Math.abs(drive.x - ox) + Math.abs(drive.y - oy) > 0.2) {
      gas = Math.max(0, gas - 4 * dt);
      drawHud();
    }
    player.x = drive.x;
    player.y = drive.y;
    var camLerp = drive.kind === 'rocket' ? 18 : 7;
    cam.tx = clamp(player.x - VW / 2, 0, Math.max(0, map[0].length * TILE - VW));
    cam.ty = clamp(player.y - VH / 2, 0, Math.max(0, map.length * TILE - VH));
    cam.x += (cam.tx - cam.x) * Math.min(1, dt * camLerp);
    cam.y += (cam.ty - cam.y) * Math.min(1, dt * camLerp);
  }

  function drawPole(p) {
    var gx = Math.round(p.x - cam.x);
    var gy = Math.round(p.y - cam.y);
    pix(gx, gy + 6, 3, 2, '#3a2418');
    pix(gx + 1, gy - 8, 1, 14, '#222');
    pix(gx, gy - 10, 3, 3, p.kind === 'bus' ? C.bus : C.taxi);
  }

  function drawForcefield() {
    if (lattice <= 0) return;
    var ex = 24 * TILE - cam.x;
    var ey = 68 * TILE - cam.y;
    var r = 20 + lattice * 180;
    ctx.strokeStyle = 'rgba(126,200,255,' + (0.35 + lattice * 0.4) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, r, Math.PI, 0, false);
    ctx.stroke();
  }

  function palOf(species) {
    if (species === 'wolf') return { fur: '#8b93a0', dark: '#5c6470', light: '#d8dce4', inner: '#c8a090', tip: '#d8dce4' };
    if (species === 'afox') return { fur: '#e8eef4', dark: '#b8c4d0', light: '#ffffff', inner: '#7ec8ff', tip: '#7ec8ff' };
    if (species === 'squirrel') return { fur: '#c47a3a', dark: '#8a5020', light: '#e8c090', inner: '#e8a070', tip: '#d4924a' };
    if (species === 'cat') return { fur: '#d4a04a', dark: '#a07828', light: '#f4e4c4', inner: '#f0b0a0', tip: '#d4a04a' };
    if (species === 'rabbit') return { fur: '#e8d4c4', dark: '#c4b0a0', light: '#fff6ee', inner: '#f0a0a8', tip: '#ffffff' };
    if (species === 'raccoon') return { fur: '#9a9088', dark: '#2e2e36', light: '#dcd6ce', inner: '#c09080', tip: '#2e2e36' };
    if (species === 'bear') return { fur: '#6b4a32', dark: '#3e2818', light: '#c4a07a', inner: '#8a6a4a', tip: '#6b4a32' };
    if (species === 'pigeon') return { fur: '#a8b0b8', dark: '#6a7380', light: '#ece6dc', inner: '#7ec8ff', tip: '#c4a070' };
    if (species === 'deer') return { fur: '#c49a5a', dark: '#8a6230', light: '#f0dcb0', inner: '#e8b070', tip: '#f0dcb0' };
    return { fur: '#e07a2a', dark: '#b85a14', light: '#f4d2a8', inner: '#f0a070', tip: '#f4e6d0' };
  }

  function npcCritter(kind) {
    if (kind === 'mira') return { species: 'afox', accent: '#7ec8ff', label: 'Arctic fox' };
    if (kind === 'rex') return { species: 'wolf', accent: '#7ed67a', label: 'Wolf' };
    if (kind === 'dash') return { species: 'squirrel', accent: C.bus, label: 'Squirrel' };
    if (kind === 'jan') return { species: 'rabbit', accent: '#e6a0d0', label: 'Rabbit' };
    if (kind === 'oak') return { species: 'bear', accent: '#8a6238', label: 'Bear' };
    if (kind === 'ash') return { species: 'deer', accent: '#c4b45a', label: 'Deer' };
    return { species: 'cat', accent: '#e07a2a', label: 'Cat' };
  }

  function drawAnimal(px, py, species, dir, accent, moving) {
    var pal = palOf(species);
    var gx = Math.round(px - cam.x);
    var gy = Math.round(py - cam.y) + (moving && Math.floor(time * 10) % 2 ? 1 : 0);
    var left = dir === 1;
    var back = dir === 3;
    var side = dir === 1 || dir === 2;
    function d(x, y, w, h, c) {
      pix(gx + (left ? CHAR_W - x - w : x), gy + y, w, h, c);
    }
    if (species === 'pigeon') {
      d(2, 3, 6, 5, pal.fur);
      d(3, 4, 4, 3, pal.light);
      if (!back) {
        d(8, 5, 2, 1, pal.tip);
        d(3, 4, 1, 1, '#1a1a20');
        d(6, 4, 1, 1, '#1a1a20');
      }
      d(1, 5, 2, 3, pal.dark);
      d(3, 8, 2, 2, pal.dark);
      d(6, 8, 2, 2, pal.dark);
      d(4, 10, 1, 2, pal.dark);
      d(6, 10, 1, 2, pal.dark);
      if (accent) d(2, 6, 6, 1, accent);
      return;
    }
    if (species === 'rabbit' || species === 'deer') {
      d(2, 0, 2, 4, pal.fur);
      d(6, 0, 2, 4, pal.fur);
      d(3, 1, 1, 3, pal.inner);
      d(6, 1, 1, 3, pal.inner);
    } else if (species === 'bear') {
      d(2, 1, 2, 2, pal.fur);
      d(6, 1, 2, 2, pal.fur);
    } else if (species === 'squirrel') {
      d(3, 0, 2, 2, pal.fur);
      d(6, 0, 2, 2, pal.fur);
      d(3, 1, 1, 1, pal.inner);
      d(7, 1, 1, 1, pal.inner);
    } else {
      d(2, 0, 2, 2, pal.fur);
      d(6, 0, 2, 2, pal.fur);
      d(3, 1, 1, 1, pal.inner);
      d(6, 1, 1, 1, pal.inner);
    }
    d(2, 2, 6, 4, pal.fur);
    if (species === 'raccoon') d(2, 3, 6, 2, pal.dark);
    if (!back) {
      d(3, 3, 1, 1, species === 'raccoon' ? pal.light : '#1a1a20');
      d(6, 3, 1, 1, species === 'raccoon' ? pal.light : '#1a1a20');
      d(4, 5, 2, 1, pal.light);
      d(5, 5, 1, 1, '#1a1a20');
      if (side) d(8, 4, 2, 2, pal.fur);
    }
    if (species === 'squirrel') {
      d(0, 3, 3, 7, pal.fur);
      d(0, 2, 2, 3, pal.tip);
    } else if (species === 'rabbit') {
      d(7, 8, 2, 2, pal.tip);
    } else if (species === 'cat') {
      d(0, 5, 2, 5, pal.fur);
    } else if (species === 'raccoon') {
      d(0, 6, 2, 2, pal.fur);
      d(0, 8, 2, 2, pal.dark);
      d(0, 10, 2, 1, pal.fur);
    } else if (species === 'bear') {
      d(8, 8, 2, 2, pal.fur);
    } else {
      d(0, 6, 3, 3, pal.fur);
      d(0, 5, 2, 2, pal.tip);
    }
    d(2, 6, 6, 4, pal.fur);
    d(3, 7, 4, 2, pal.light);
    if (accent) d(2, 6, 6, 1, accent);
    d(2, 10, 2, 2, pal.dark);
    d(6, 10, 2, 2, pal.dark);
  }

  function drawQuestMark(px, py) {
    var gx = Math.round(px - cam.x) + 3;
    var gy = Math.round(py - cam.y) - 8 + (Math.sin(time * 4) > 0 ? 0 : 1);
    pix(gx - 1, gy, 3, 1, C.paper);
    pix(gx + 1, gy + 1, 1, 1, C.paper);
    pix(gx, gy + 2, 1, 1, C.paper);
    pix(gx, gy + 4, 1, 1, C.paper);
  }

  function carColor(kind) {
    if (kind === 'bus') return C.bus;
    if (kind === 'taxi') return C.taxi;
    if (kind === 'rental') return '#3cb8a0';
    if (kind === 'sport') return '#d94a32';
    if (kind === 'outdoors') return '#6a8c32';
    if (kind === 'rocket') return '#efe8dc';
    return '#8b93a3';
  }

  function drawCar(c) {
    var s = carSize(c);
    var x = Math.round(c.x - cam.x - s.w / 2);
    var y = Math.round(c.y - cam.y - s.h / 2);
    var horiz = c.dir === 1 || c.dir === 2;
    var col = carColor(c.kind);
    var win = '#c5e4f4';
    var light = C.white;
    var tail = C.verm;
    if (x + s.w < 0 || y + s.h < 0 || x > VW || y > VH) return;
    pix(x, y, s.w, s.h, col);
    if (c.kind === 'sport' || c.kind === 'outdoors' || c.kind === 'rocket') {
      pix(x + (horiz ? 2 : 2), y + (horiz ? 2 : 3), horiz ? s.w - 4 : 2, horiz ? 2 : s.h - 6, c.kind === 'rocket' ? '#ff6a1a' : C.accent);
    }
    if (c.kind === 'rocket') {
      var flick = Math.floor(time * 18) % 2;
      if (horiz) {
        pix(c.dir === 2 ? x - 3 - flick : x + s.w, y + 1, 3 + flick, 4, '#ff8a2a');
        pix(c.dir === 2 ? x - 5 - flick : x + s.w + 3, y + 2, 2, 2, '#ffe27a');
      } else {
        pix(x + 1, c.dir === 0 ? y + s.h : y - 3 - flick, 4, 3 + flick, '#ff8a2a');
        pix(x + 2, c.dir === 0 ? y + s.h + 3 : y - 5 - flick, 2, 2, '#ffe27a');
      }
    }
    if (c.kind === 'taxi') {
      pix(x + (horiz ? s.w / 2 - 2 : 2), y + (horiz ? -2 : s.h / 2 - 2), horiz ? 4 : 3, horiz ? 2 : 4, C.taxi);
      pix(x + (horiz ? s.w / 2 - 1 : 3), y + (horiz ? -3 : s.h / 2 - 1), horiz ? 2 : 1, horiz ? 1 : 2, '#222');
    }
    if (horiz) {
      pix(x + 2, y + 1, s.w - 5, 3, win);
      pix(x + (c.dir === 2 ? s.w - 2 : 0), y + 2, 2, 3, light);
      pix(x + (c.dir === 2 ? 0 : s.w - 2), y + 2, 2, 2, tail);
      pix(x + 2, y + s.h - 2, 3, 2, '#222');
      pix(x + s.w - 5, y + s.h - 2, 3, 2, '#222');
      if (c.kind === 'bus') {
        pix(x + 6, y + 1, 1, 3, col);
        pix(x + 11, y + 1, 1, 3, col);
      }
    } else {
      pix(x + 1, y + 2, 3, s.h - 5, win);
      pix(x + 2, y + (c.dir === 0 ? s.h - 2 : 0), 3, 2, light);
      pix(x + 2, y + (c.dir === 0 ? 0 : s.h - 2), 2, 2, tail);
      pix(x, y + 2, 2, 3, '#222');
      pix(x + s.w - 2, y + 2, 2, 3, '#222');
      pix(x, y + s.h - 5, 2, 3, '#222');
      pix(x + s.w - 2, y + s.h - 5, 2, 3, '#222');
      if (c.kind === 'bus') {
        pix(x + 1, y + 6, 3, 1, col);
        pix(x + 1, y + 11, 3, 1, col);
      }
    }
    if (c.kind === 'car') pix(x + 1, y + 1, 2, 2, '#5a6270');
  }

  function drawVehicle() {
    if (ride.vehicle) drawCar(ride.vehicle);
  }

  function miniColor(id) {
    if (id === 1 || id === 5 || id === 6) return C.road;
    if (id === 9) return '#3a4050';
    if (id === 3) return '#7a7a7a';
    if (id === 4) return C.plaza;
    if (id === 7) return C.grass;
    if (id === 8) return C.tree;
    if (id === 10) return C.dirt;
    if (id === 11) return C.field;
    if (id === 12) return '#6a7a50';
    return C.walk;
  }

  function drawMinimap() {
    var src = place === 'track' ? trackMap : cityMap;
    var cols = src[0] ? src[0].length : COLS;
    var rows = src.length || ROWS;
    var mw = 64;
    var mh = 42;
    var ox = VW - mw - 5;
    var oy = VH - mh - 5;
    var i, j, tx, ty, id;
    var px, py, vx, vy, vw, vh;
    pix(ox - 2, oy - 2, mw + 4, mh + 4, '#3a2418');
    pix(ox - 1, oy - 1, mw + 2, mh + 2, C.paper);
    for (j = 0; j < mh; j++) {
      for (i = 0; i < mw; i++) {
        tx = Math.min(cols - 1, Math.floor(i * cols / mw));
        ty = Math.min(rows - 1, Math.floor(j * rows / mh));
        id = src[ty] ? src[ty][tx] : 7;
        pix(ox + i, oy + j, 1, 1, miniColor(id));
      }
    }
    vx = ox + Math.floor((cam.x / TILE) * mw / cols);
    vy = oy + Math.floor((cam.y / TILE) * mh / rows);
    vw = Math.max(3, Math.floor((VW / TILE) * mw / cols));
    vh = Math.max(3, Math.floor((VH / TILE) * mh / rows));
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 1;
    ctx.strokeRect(vx + 0.5, vy + 0.5, vw, vh);
    if (place === 'mall') {
      px = 34;
      py = 35;
    } else {
      px = player.x / TILE;
      py = player.y / TILE;
    }
    pix(ox + Math.floor(px * mw / cols), oy + Math.floor(py * mh / rows), 2, 2, C.accent);
  }

  function drawWorld() {
    var x, y;
    var savedX = cam.x;
    var savedY = cam.y;
    if (shake > 0) {
      cam.x += (Math.random() - 0.5) * 10 * shake;
      cam.y += (Math.random() - 0.5) * 10 * shake;
    }
    var maxC = map[0].length;
    var maxR = map.length;
    var x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    var y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    var x1 = Math.min(maxC, Math.ceil((cam.x + VW) / TILE) + 1);
    var y1 = Math.min(maxR, Math.ceil((cam.y + VH) / TILE) + 1);
    pix(0, 0, VW, VH, nuked ? '#3a1810' : (place === 'mall' ? '#2a2a2e' : C.night));
    for (y = y0; y < y1; y++) {
      for (x = x0; x < x1; x++) drawTile(map[y][x], x * TILE, y * TILE);
    }
    buildings.forEach(drawBuilding);
    if (place === 'city') {
      pix(32 * TILE - cam.x, 28 * TILE - cam.y, 4 * TILE, TILE, '#555555');
      pix(32 * TILE - cam.x, 42 * TILE - cam.y, 4 * TILE, TILE, '#555555');
      pix(14 * TILE - cam.x, 34 * TILE - cam.y, TILE, 2 * TILE, '#555555');
      pix(54 * TILE - cam.x, 34 * TILE - cam.y, TILE, 2 * TILE, '#555555');
      mallDoors.forEach(function (d) {
        pix(d.ox * TILE - cam.x, d.oy * TILE - cam.y, d.ow * TILE, d.oh * TILE, '#555555');
      });
      poles.forEach(drawPole);
      if (!nuked) cars.forEach(drawCar);
    } else if (place === 'mall') {
      pix(20 * TILE - cam.x, 0 - cam.y, 8 * TILE, 4, '#555555');
      pix(20 * TILE - cam.x, (MROWS - 1) * TILE - cam.y, 8 * TILE, TILE, '#555555');
      pix(0 - cam.x, 13 * TILE - cam.y, 4, 6 * TILE, '#555555');
      pix((MCOLS - 1) * TILE - cam.x, 13 * TILE - cam.y, TILE, 6 * TILE, '#555555');
    }
    if (!nuked) {
      shops.forEach(function (s) {
        if (s.place === place) drawShop(s);
      });
      rentals.forEach(function (s) {
        if (s.place === place) drawRental(s);
      });
      pumps.forEach(function (s) {
        if (s.place === place) drawPump(s);
      });
      cans.forEach(function (c) {
        if (c.place === place && c.gone <= 0) drawCan(c);
      });
      walkers.forEach(function (w) {
        if (w.place === place) drawAnimal(w.x, w.y, w.species, w.dir, null, w.wait <= 0);
      });
      npcs.forEach(function (e) {
        if (e.place !== place) return;
        var a = npcCritter(e.kind);
        drawAnimal(e.x, e.y, a.species, 0, a.accent, false);
        drawQuestMark(e.x, e.y);
      });
      pieces.forEach(function (p) {
        if (p.got || p.place !== place) return;
        if (Math.floor(time * 6) % 2 === 0) {
          pix(p.x - cam.x, p.y - cam.y, 3, 3, C.paper);
        }
      });
    }
    if (!nuked && !drive.on && (scene !== 'ride' || ride.phase !== 'go')) {
      drawAnimal(player.x, player.y, 'fox', player.dir, quest === 'have' || quest === 'build' ? C.paper : C.accent, player.walk);
    }
    if (!nuked && (drive.on || drive.parked)) drawCar(drive);
    drawVehicle();
    if (place === 'city') drawForcefield();
    if (flash > 0) {
      pix(0, 0, VW, VH, nuked
        ? 'rgba(255,150,50,' + Math.min(1, flash) + ')'
        : 'rgba(180,220,255,' + flash + ')');
    }
    drawMinimap();
    cam.x = savedX;
    cam.y = savedY;
  }

  function updateWorld(dt) {
    var spd, ox, oy, nx, ny;
    if (drive.on) {
      updateDrive(dt);
    } else {
      spd = energy <= 0 ? 16 : 48;
      player.vx = (hold.left ? -spd : 0) + (hold.right ? spd : 0);
      player.vy = (hold.up ? -spd : 0) + (hold.down ? spd : 0);
      if (player.vx && player.vy) {
        player.vx *= 0.72;
        player.vy *= 0.72;
      }
      if (Math.abs(player.vx) > Math.abs(player.vy)) {
        if (player.vx > 0) player.dir = 2;
        if (player.vx < 0) player.dir = 1;
      } else if (player.vy) {
        player.dir = player.vy > 0 ? 0 : 3;
      }
      player.walk = !!(player.vx || player.vy);
      ox = player.x;
      oy = player.y;
      nx = player.x + player.vx * dt;
      ny = player.y + player.vy * dt;
      if (!blocked(nx, player.y, CHAR_W, CHAR_H)) player.x = nx;
      if (!blocked(player.x, ny, CHAR_W, CHAR_H)) player.y = ny;
      player.x = clamp(player.x, 0, map[0].length * TILE - CHAR_W);
      player.y = clamp(player.y, 0, map.length * TILE - CHAR_H);
      if (Math.abs(player.x - ox) + Math.abs(player.y - oy) > 0.2) {
        energy = Math.max(0, energy - 0.8 * dt);
        drawHud();
      }
      cam.tx = clamp(player.x - VW / 2, 0, Math.max(0, map[0].length * TILE - VW));
      cam.ty = clamp(player.y - VH / 2, 0, Math.max(0, map.length * TILE - VH));
      cam.x += (cam.tx - cam.x) * Math.min(1, dt * 7);
      cam.y += (cam.ty - cam.y) * Math.min(1, dt * 7);
    }
    updateWalkers(dt);
    updateCars(dt);
    var ci;
    for (ci = 0; ci < cans.length; ci++) {
      if (cans[ci].gone > 0) cans[ci].gone -= dt;
    }

    if (quest === 'build') {
      lattice = Math.min(1, lattice + dt * 0.35);
      flash = Math.max(0, flash - dt);
      if (lattice > 0.55 && flash <= 0 && lattice < 0.58) {
        flash = 0.55;
        beep(220, 0.2, 0.05, 'sawtooth');
      }
      if (lattice >= 1) {
        quest = 'saved';
        save();
        drawHud();
        setTimeout(function () { openEnd(true); }, 700);
      }
    }

    near = null;
    var i, e, d;
    if (drive.on) {
      near = { kind: 'park', text: 'Exit · Hop out' };
      for (i = 0; i < rentals.length; i++) {
        e = rentals[i];
        if (e.place !== place) continue;
        d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
        if (d < 28) {
          near = gas <= 0
            ? { kind: 'return', e: e, text: 'No gas · Cannot return' }
            : { kind: 'return', e: e, text: 'Return car · ' + e.name };
        }
      }
      if (equipped === 1 && hasJerry()) {
        for (i = 0; i < pumps.length; i++) {
          e = pumps[i];
          if (e.place !== place) continue;
          d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
          if (d < 26) near = { kind: 'pump', e: e, text: pumpText() };
        }
      }
      for (i = 0; i < pieces.length; i++) {
        e = pieces[i];
        if (e.got || e.place !== place) continue;
        d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
        if (d < 26) near = { kind: 'piece', e: e, text: 'Pick up · Blueprint piece' };
      }
    } else {
      for (i = 0; i < npcs.length; i++) {
        e = npcs[i];
        if (e.place !== place) continue;
        d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
        if (d < 22) near = { kind: 'npc', e: e, text: 'Talk · ' + e.name };
      }
      if (place === 'city') {
        for (i = 0; i < poles.length; i++) {
          e = poles[i];
          d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
          if (d < 18) near = { kind: 'pole', e: e, text: 'Call · ' + (e.kind === 'bus' ? 'Bus' : 'Taxi') + ' · ' + e.name };
        }
        for (i = 0; i < mallDoors.length; i++) {
          e = mallDoors[i];
          if (inDoor(player, e.ox, e.oy, e.ow, e.oh)) {
            near = { kind: 'mall', e: e, text: 'Enter · Mall' };
          }
        }
      } else if (place === 'mall') {
        for (i = 0; i < mallDoors.length; i++) {
          e = mallDoors[i];
          if (inDoor(player, e.ix, e.iy, e.iw, e.ih)) {
            near = { kind: 'exit', e: e, text: 'Exit · Mall' };
          }
        }
      }
      for (i = 0; i < shops.length; i++) {
        e = shops[i];
        if (e.place !== place) continue;
        d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
        if (d < 20) near = { kind: 'shop', e: e, text: energy >= 100 ? 'Shop · Energy full' : 'Snack · Fill energy' };
      }
      if (equipped === 1 && hasJerry()) {
        for (i = 0; i < pumps.length; i++) {
          e = pumps[i];
          if (e.place !== place) continue;
          d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
          if (d < 20) near = { kind: 'pump', e: e, text: pumpText() };
        }
      }
      for (i = 0; i < rentals.length; i++) {
        e = rentals[i];
        if (e.place !== place) continue;
        d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
        if (d < 22) {
          if (drive.parked) {
            near = gas <= 0
              ? { kind: 'return', e: e, text: 'No gas · Cannot return' }
              : { kind: 'return', e: e, text: 'Return car · ' + e.name };
          } else if (!hasJerry()) near = { kind: 'rent', e: e, text: 'Ask Mira for a jerry can' };
          else near = { kind: 'rent', e: e, text: 'Rent a car · ' + e.name };
        }
      }
      if (drive.parked) {
        d = Math.abs(player.x - drive.x) + Math.abs(player.y - drive.y);
        if (d < 22) {
          if (equipped === 1 && jerryFull() && gas < 100) near = { kind: 'pour', text: 'Pour jerry can' };
          else if (gas > 0) near = { kind: 'board', text: 'Get in' };
          else if (pourReady()) near = pourReady();
          else near = { kind: 'dead', text: 'Dead · Fill the can at a pump' };
        }
      }
      for (i = 0; i < pieces.length; i++) {
        e = pieces[i];
        if (e.got || e.place !== place) continue;
        d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
        if (d < 22) near = { kind: 'piece', e: e, text: 'Pick up · Blueprint piece' };
      }
    }
    if (!near && drive.parked && gas <= 0) {
      ui.prompt.textContent = hasJerry() ? 'No gas · Fill the can at a pump' : 'No gas · Talk to Mira';
      show(ui.prompt, true);
    } else if (!near && energy <= 0 && !drive.on) {
      ui.prompt.textContent = 'No energy · Find a shop';
      show(ui.prompt, true);
    } else if (near) {
      ui.prompt.textContent = near.text;
      show(ui.prompt, true);
    } else show(ui.prompt, false);

    if (actEdge && near && !interactLock) {
      if (near.kind === 'npc') openTalk(near.e);
      else if (near.kind === 'pole') openPole(near.e);
      else if (near.kind === 'mall') enterMall(near.e);
      else if (near.kind === 'exit') exitMall(near.e);
      else if (near.kind === 'piece') takePiece(near.e);
      else if (near.kind === 'shop') useShop(near.e);
      else if (near.kind === 'pump') usePump(near.e);
      else if (near.kind === 'can') takeCan(near.e);
      else if (near.kind === 'pour') pourCan();
      else if (near.kind === 'rent') rentCar();
      else if (near.kind === 'park') parkCar();
      else if (near.kind === 'board') boardCar();
      else if (near.kind === 'return') returnCar();
    }
  }

  function inDoor(p, tx, ty, tw, th) {
    return aabb(p.x, p.y, CHAR_W, CHAR_H, tx * TILE, ty * TILE, tw * TILE, th * TILE);
  }

  function updateWalkers(dt) {
    var i, w, dx, dy, nx, ny, spd, mid, zebra, turn;
    for (i = 0; i < walkers.length; i++) {
      w = walkers[i];
      if (w.place !== place) continue;
      if (w.wait > 0) {
        w.wait -= dt;
        continue;
      }
      spd = 26;
      dx = w.dir === 2 ? spd : w.dir === 1 ? -spd : 0;
      dy = w.dir === 0 ? spd : w.dir === 3 ? -spd : 0;
      nx = w.x + dx * dt;
      ny = w.y + dy * dt;
      mid = tileAt(w.x + CHAR_W / 2, w.y + CHAR_H / 2);
      zebra = mid === 5 || mid === 6;
      turn = !walkerOk(nx, ny) || (!zebra && Math.random() < dt * 0.22);
      if (turn) {
        w.dir = pickWalkerDir(w);
        w.wait = zebra ? 0 : 0.12 + Math.random() * 0.9;
      } else {
        w.x = nx;
        w.y = ny;
      }
    }
  }

  function pickWalkerDir(w) {
    var dirs = [0, 1, 2, 3];
    var k, d, nx, ny, spd = 4;
    for (k = dirs.length - 1; k > 0; k--) {
      d = Math.floor(Math.random() * (k + 1));
      nx = dirs[k];
      dirs[k] = dirs[d];
      dirs[d] = nx;
    }
    for (k = 0; k < dirs.length; k++) {
      d = dirs[k];
      nx = w.x + (d === 2 ? spd : d === 1 ? -spd : 0);
      ny = w.y + (d === 0 ? spd : d === 3 ? -spd : 0);
      if (walkerOk(nx, ny)) return d;
    }
    return w.dir;
  }

  function takePiece(p) {
    p.got = true;
    if (pieceCount() >= 6) quest = 'have';
    refreshLines();
    save();
    drawHud();
    interactLock = true;
    beep(880, 0.1, 0.05, 'sine');
  }

  function enterMall(door) {
    cityReturn = { x: door.outX * TILE, y: door.outY * TILE };
    usePlace('mall');
    player.x = door.sx * TILE;
    player.y = door.sy * TILE;
    cam.x = clamp(player.x - VW / 2, 0, Math.max(0, MCOLS * TILE - VW));
    cam.y = clamp(player.y - VH / 2, 0, Math.max(0, MROWS * TILE - VH));
    cam.tx = cam.x;
    cam.ty = cam.y;
    interactLock = true;
    actEdge = false;
    beep(300, 0.08, 0.04);
  }

  function exitMall(door) {
    usePlace('city');
    player.x = door.outX * TILE;
    player.y = door.outY * TILE;
    interactLock = true;
    actEdge = false;
    beep(260, 0.08, 0.04);
  }

  function openTalk(e) {
    refreshLines();
    talk.who = e.name + ' · ' + npcCritter(e.kind).label;
    talk.lines = e.lines.slice();
    talk.i = 0;
    talk.after = function () {
      if (e.id === 'mira') {
        if (quest === 'idle') {
          quest = 'hunt';
          refreshLines();
          save();
          drawHud();
          beep(880, 0.1, 0.05, 'sine');
        }
        if (giveJerry()) beep(500, 0.1, 0.05, 'square');
      }
      if (e.id === 'rex' && (quest === 'have' || pieceCount() >= 6)) {
        quest = 'build';
        lattice = 0.05;
        save();
        drawHud();
        beep(200, 0.16, 0.05, 'triangle');
      }
    };
    ui.who.textContent = talk.who;
    ui.line.textContent = talk.lines[0] || '';
    show(ui.dialog, true);
    show(ui.prompt, false);
    scene = 'dialog';
    beep(520, 0.06, 0.03);
  }

  function closeTalk() {
    show(ui.dialog, false);
    show(ui.prompt, false);
    scene = 'world';
    actEdge = false;
    interactLock = true;
    if (talk.after) talk.after();
  }

  function stepTalk() {
    talk.i += 1;
    if (talk.i >= talk.lines.length) {
      closeTalk();
      return;
    }
    ui.line.textContent = talk.lines[talk.i];
    beep(560, 0.05, 0.025);
  }

  function openPole(p) {
    ride.pole = p;
    ui.cardK.textContent = p.kind === 'bus' ? 'Bus pole' : 'Taxi pole';
    ui.cardH.textContent = 'Call a ' + p.kind;
    ui.cardP.textContent = 'A ' + p.kind + ' rolls up. Where to?';
    ui.dests.innerHTML = '';
    poles.forEach(function (d) {
      if (d.kind !== p.kind || d.id === p.id) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = d.name;
      b.addEventListener('click', function () { takeRide(d); });
      ui.dests.appendChild(b);
    });
    show(ui.cardOk, false);
    show(ui.card, true);
    show(ui.prompt, false);
    scene = 'pick';
    beep(p.kind === 'bus' ? 300 : 420, 0.08, 0.04);
  }

  function closePick() {
    show(ui.card, false);
    ui.dests.innerHTML = '';
    scene = 'world';
    actEdge = false;
    interactLock = true;
  }

  function outsideView(x, y) {
    return x < cam.x - 32 || y < cam.y - 32 || x > cam.x + VW + 32 || y > cam.y + VH + 32;
  }

  function findEdgeRoad(px, py) {
    var sx = Math.floor(px / TILE);
    var sy = Math.floor(py / TILE);
    if (!isRoad(sx, sy)) {
      var n = nearestRoad(px, py);
      sx = Math.floor(n.x / TILE);
      sy = Math.floor(n.y / TILE);
    }
    var q = [[sx, sy]];
    var seen = {};
    seen[sx + ',' + sy] = 1;
    var head = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var best = null;
    var bestD = 1e9;
    var c, i, nx, ny, k, wx, wy, d;
    while (head < q.length && head < 500) {
      c = q[head++];
      wx = c[0] * TILE + 8;
      wy = c[1] * TILE + 8;
      if (outsideView(wx, wy)) {
        d = Math.abs(wx - px) + Math.abs(wy - py);
        if (d < bestD) {
          bestD = d;
          best = { x: wx, y: wy };
        }
        continue;
      }
      for (i = 0; i < 4; i++) {
        nx = c[0] + dirs[i][0];
        ny = c[1] + dirs[i][1];
        k = nx + ',' + ny;
        if (seen[k] || !isRoad(nx, ny)) continue;
        seen[k] = 1;
        q.push([nx, ny]);
      }
    }
    if (best) return best;
    if (px <= cam.x + VW / 2) return { x: cam.x - 36, y: py };
    return { x: cam.x + VW + 36, y: py };
  }

  function findLeaveRoad(px, py, dir) {
    var fdx = dir === 2 ? 1 : dir === 1 ? -1 : 0;
    var fdy = dir === 0 ? 1 : dir === 3 ? -1 : 0;
    var tx = Math.floor(px / TILE);
    var ty = Math.floor(py / TILE);
    var i, last = { x: px, y: py };
    for (i = 0; i < 48; i++) {
      if (!isRoad(tx + fdx, ty + fdy)) break;
      tx += fdx;
      ty += fdy;
      last = { x: tx * TILE + 8, y: ty * TILE + 8 };
      if (outsideView(last.x, last.y)) return last;
    }
    return findEdgeRoad(px, py);
  }

  function takeRide(dest) {
    closePick();
    var start = nearestRoad(ride.pole.x, ride.pole.y);
    var end = nearestRoad(dest.x, dest.y);
    var hail = findEdgeRoad(start.x, start.y);
    ride.dest = dest;
    ride.pickup = start;
    ride.drop = end;
    ride.phase = 'hail';
    ride.path = findPath(hail.x, hail.y, start.x, start.y);
    ride.pi = 0;
    ride.vehicle = { kind: ride.pole.kind, x: hail.x, y: hail.y, dir: 2 };
    scene = 'ride';
    ui.prompt.textContent = (ride.pole.kind === 'bus' ? 'Bus' : 'Taxi') + ' incoming';
    show(ui.prompt, true);
    beep(180, 0.12, 0.04, 'triangle');
  }

  function finishRide() {
    if (ride.dest && ride.phase !== 'leave') {
      player.x = ride.dest.x + 3;
      player.y = ride.dest.y;
    }
    ride.vehicle = null;
    ride.path = null;
    ride.phase = null;
    show(ui.prompt, false);
    scene = 'world';
    interactLock = true;
  }

  function followCam(dt, x, y) {
    cam.tx = clamp(x - VW / 2, 0, Math.max(0, cityMap[0].length * TILE - VW));
    cam.ty = clamp(y - VH / 2, 0, Math.max(0, cityMap.length * TILE - VH));
    cam.x += (cam.tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (cam.ty - cam.y) * Math.min(1, dt * 6);
  }

  function steerRide(dt, board) {
    var v = ride.vehicle;
    var p = ride.path[ride.pi];
    var dx = p.x - v.x;
    var dy = p.y - v.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var spd = v.kind === 'taxi' ? 168 : 150;
    if (Math.abs(dx) > Math.abs(dy)) v.dir = dx > 0 ? 2 : 1;
    else if (dy) v.dir = dy > 0 ? 0 : 3;
    if (dist < 3) {
      v.x = p.x;
      v.y = p.y;
      ride.pi += 1;
      return ride.pi >= ride.path.length;
    }
    v.x += (dx / dist) * spd * dt;
    v.y += (dy / dist) * spd * dt;
    if (board) {
      player.x = v.x;
      player.y = v.y;
      followCam(dt, v.x, v.y);
    } else {
      followCam(dt, player.x, player.y);
    }
    return false;
  }

  function updateRide(dt) {
    var v = ride.vehicle;
    var leave;
    if (!v || !ride.path || !ride.path.length) {
      finishRide();
      return;
    }
    if (steerRide(dt, ride.phase === 'go')) {
      if (ride.phase === 'hail') {
        v.x = ride.pickup.x;
        v.y = ride.pickup.y;
        ride.phase = 'go';
        ride.path = findPath(ride.pickup.x, ride.pickup.y, ride.drop.x, ride.drop.y);
        ride.pi = 0;
        show(ui.prompt, false);
        beep(220, 0.1, 0.04, 'triangle');
        return;
      }
      if (ride.phase === 'go') {
        player.x = ride.dest.x + 3;
        player.y = ride.dest.y;
        leave = findLeaveRoad(v.x, v.y, v.dir);
        ride.phase = 'leave';
        ride.path = findPath(v.x, v.y, leave.x, leave.y);
        ride.pi = 0;
        beep(640, 0.08, 0.04, 'sine');
        return;
      }
      finishRide();
    }
    if (ride.phase === 'leave' && outsideView(v.x, v.y)) finishRide();
  }

  function openEnd(won) {
    scene = 'end';
    show(ui.dialog, false);
    show(ui.card, false);
    if (ui.endK) {
      ui.endK.textContent = won ? 'The sky holds' : 'Time is up';
      ui.endH.textContent = won ? 'World saved' : 'Map nuked';
      ui.endP.textContent = won
        ? 'The forcefield locked in. The invasion bounced. The buses still run at dawn.'
        : 'Six minutes. The forcefield never locked. The city is ash.';
    }
    show(ui.end, true);
    beep(won ? 392 : 110, 0.22, 0.05, won ? 'sine' : 'sawtooth');
  }

  function onAct() {
    if (scene === 'title') return begin();
    if (scene === 'dialog') return stepTalk();
    if (scene === 'pick') return closePick();
    if (scene === 'end') return begin(true);
  }

  function begin() {
    ensureAudio();
    show(ui.title, false);
    show(ui.end, false);
    show(ui.card, false);
    show(ui.dialog, false);
    show(ui.hud, true);
    if (ui.slots) show(ui.slots, true);
    show(ui.pad, true);
    buildMap();
    bootEntities();
    usePlace('city');
    ride.vehicle = null;
    ride.path = null;
    ride.phase = null;
    drive.on = false;
    drive.parked = false;
    nuked = false;
    nukeT = 0;
    shake = 0;
    flash = 0;
    if (quest === 'saved') {
      lattice = 1;
    } else {
      if (quest === 'have') lattice = 0;
      if (nukeLeft <= 0) nukeLeft = NUKE_SECS;
    }
    drawHud();
    scene = 'world';
    beep(392, 0.08, 0.04, 'sine');
  }

  function findRoadWide(px, py) {
    var n = nearestRoad(px, py);
    var tx = Math.floor(n.x / TILE);
    var ty = Math.floor(n.y / TILE);
    if (isRoad(tx, ty)) return n;
    var r, dx, dy;
    for (r = 1; r <= 24; r++) {
      for (dy = -r; dy <= r; dy++) {
        for (dx = -r; dx <= r; dx++) {
          if (isRoad(tx + dx, ty + dy)) {
            return { x: (tx + dx) * TILE + 8, y: (ty + dy) * TILE + 8 };
          }
        }
      }
    }
    return { x: 12 * TILE + 8, y: 16 * TILE + 8 };
  }

  function findOpenWide(px, py) {
    var sz = { w: 16, h: 6 };
    if (openOk(px, py, sz)) return { x: px, y: py };
    var tx = Math.floor(px / TILE);
    var ty = Math.floor(py / TILE);
    var r, dx, dy, x, y;
    for (r = 1; r <= 24; r++) {
      for (dy = -r; dy <= r; dy++) {
        for (dx = -r; dx <= r; dx++) {
          x = (tx + dx) * TILE + 8;
          y = (ty + dy) * TILE + 8;
          if (openOk(x, y, sz)) return { x: x, y: y };
        }
      }
    }
    return { x: 18 * TILE + 8, y: 20 * TILE + 8 };
  }

  function enterCheatWorld() {
    if (scene === 'title') begin();
    show(ui.title, false);
    show(ui.dialog, false);
    show(ui.card, false);
    show(ui.hud, true);
    scene = 'world';
    interactLock = false;
    drawHud();
  }

  function spawnCheatCar(kind, label) {
    if (nuked || scene === 'nuke' || scene === 'end') return;
    if (scene === 'title') begin();
    if (place === 'mall') {
      usePlace('city');
      player.x = cityReturn.x || 18 * TILE;
      player.y = cityReturn.y || 20 * TILE;
    }
    var pad = kind === 'outdoors' ? findOpenWide(player.x, player.y) : findRoadWide(player.x, player.y);
    drive.on = true;
    drive.parked = false;
    drive.x = pad.x;
    drive.y = pad.y;
    drive.dir = 2;
    drive.kind = kind;
    gas = 100;
    player.x = pad.x;
    player.y = pad.y;
    snapCamToPlayer();
    enterCheatWorld();
    ui.prompt.textContent = label;
    show(ui.prompt, true);
    beep(880, 0.08, 0.05, 'square');
    beep(1180, 0.14, 0.04, 'square');
  }

  function goTrack() {
    if (nuked || scene === 'nuke' || scene === 'end') return;
    if (scene === 'title') begin();
    if (place !== 'track') {
      worldReturn.place = place === 'mall' ? 'mall' : 'city';
      worldReturn.x = player.x;
      worldReturn.y = player.y;
    }
    usePlace('track');
    player.x = 34 * TILE + 8;
    player.y = 55 * TILE + 8;
    drive.on = true;
    drive.parked = false;
    drive.x = player.x;
    drive.y = player.y;
    drive.dir = 2;
    if (drive.kind !== 'sport' && drive.kind !== 'outdoors' && drive.kind !== 'rocket') {
      drive.kind = 'sport';
    }
    gas = 100;
    snapCamToPlayer();
    enterCheatWorld();
    ui.prompt.textContent = 'Test track · F1 here · drag south · takemeback';
    show(ui.prompt, true);
    beep(520, 0.08, 0.05, 'square');
    beep(780, 0.12, 0.04, 'square');
  }

  function goWorldBack() {
    if (nuked || scene === 'nuke' || scene === 'end') return;
    if (place !== 'track') return;
    usePlace(worldReturn.place === 'mall' ? 'mall' : 'city');
    player.x = worldReturn.x || 18 * TILE;
    player.y = worldReturn.y || 20 * TILE;
    if (drive.on || drive.parked) {
      var pad = drive.kind === 'outdoors' ? findOpenWide(player.x, player.y) : findRoadWide(player.x, player.y);
      drive.x = pad.x;
      drive.y = pad.y;
      player.x = pad.x;
      player.y = pad.y;
    }
    snapCamToPlayer();
    enterCheatWorld();
    ui.prompt.textContent = 'Back in the city';
    show(ui.prompt, true);
    beep(360, 0.08, 0.04, 'triangle');
  }

  var typed = '';
  var NUKE_CODE = 'howdoiturnthison';
  var SPORT_CODE = 'vroom';
  var OUT_CODE = 'outdoors';
  var AWAY_CODE = 'takemeaway';
  var BACK_CODE = 'takemeback';
  var ROCKET_CODE = 'rocketpower';

  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typed = (typed + e.key.toLowerCase()).slice(-32);
      if (typed.slice(-NUKE_CODE.length) === NUKE_CODE) {
        typed = '';
        ensureAudio();
        startNuke(true);
      } else if (typed.slice(-AWAY_CODE.length) === AWAY_CODE) {
        typed = '';
        ensureAudio();
        goTrack();
      } else if (typed.slice(-BACK_CODE.length) === BACK_CODE) {
        typed = '';
        ensureAudio();
        goWorldBack();
      } else if (typed.slice(-ROCKET_CODE.length) === ROCKET_CODE) {
        typed = '';
        ensureAudio();
        spawnCheatCar('rocket', 'Rocket car');
      } else if (typed.slice(-SPORT_CODE.length) === SPORT_CODE) {
        typed = '';
        ensureAudio();
        spawnCheatCar('sport', 'Test sports car');
      } else if (typed.slice(-OUT_CODE.length) === OUT_CODE) {
        typed = '';
        ensureAudio();
        spawnCheatCar('outdoors', 'Outdoors racer');
      }
    }
    if ((e.key === '1' || e.code === 'Numpad1') && !e.repeat && (scene === 'world' || scene === 'ride')) {
      equipSlot(1);
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'z' || e.key === 'Z' || e.key === 'j' || e.key === 'J') {
      if (!e.repeat) {
        actEdge = true;
        onAct();
      }
      hold.act = true;
    }
    hold.up = keys.ArrowUp || keys.w || keys.W;
    hold.down = keys.ArrowDown || keys.s || keys.S;
    hold.left = keys.ArrowLeft || keys.a || keys.A;
    hold.right = keys.ArrowRight || keys.d || keys.D;
  });

  window.addEventListener('keyup', function (e) {
    keys[e.key] = false;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'z' || e.key === 'Z' || e.key === 'j' || e.key === 'J') {
      hold.act = false;
      interactLock = false;
    }
    if (e.key === 'Escape' && scene === 'dialog') closeTalk();
    if (e.key === 'Escape' && scene === 'pick') closePick();
    hold.up = keys.ArrowUp || keys.w || keys.W;
    hold.down = keys.ArrowDown || keys.s || keys.S;
    hold.left = keys.ArrowLeft || keys.a || keys.A;
    hold.right = keys.ArrowRight || keys.d || keys.D;
  });

  function bindPad() {
    ui.pad.querySelectorAll('[data-dir]').forEach(function (btn) {
      var dir = btn.getAttribute('data-dir');
      var go = function (on) { hold[dir] = on; };
      btn.addEventListener('pointerdown', function (e) { e.preventDefault(); go(true); });
      btn.addEventListener('pointerup', function () { go(false); });
      btn.addEventListener('pointerleave', function () { go(false); });
    });
    var act = document.getElementById('act');
    act.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      hold.act = true;
      actEdge = true;
      onAct();
    });
    act.addEventListener('pointerup', function () {
      hold.act = false;
      interactLock = false;
    });
  }

  if (ui.slot1) {
    ui.slot1.addEventListener('click', function (e) {
      e.preventDefault();
      if (scene === 'world' || scene === 'ride') equipSlot(1);
    });
  }

  ui.start.addEventListener('click', begin);
  ui.again.addEventListener('click', function () {
    quest = 'idle';
    lattice = 0;
    energy = 100;
    gas = 100;
    slots = [null];
    equipped = 0;
    nukeLeft = NUKE_SECS;
    nuked = false;
    nukeT = 0;
    shake = 0;
    flash = 0;
    resetPieces();
    save();
    begin();
  });
  ui.cardBack.addEventListener('click', closePick);
  ui.dialog.addEventListener('click', function () {
    if (scene === 'dialog') stepTalk();
  });
  ui.mute.addEventListener('click', function () {
    muted = !muted;
    if (!muted) ensureAudio();
    save();
    drawHud();
  });

  var last = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    if (scene === 'world' || scene === 'ride' || scene === 'dialog' || scene === 'pick') {
      tickNuke(dt);
    }
    if (scene === 'world') {
      updateWorld(dt);
      drawWorld();
    } else if (scene === 'ride') {
      updateRide(dt);
      updateCars(dt);
      updateWalkers(dt);
      drawWorld();
    } else if (scene === 'dialog' || scene === 'pick') {
      updateCars(dt);
      updateWalkers(dt);
      drawWorld();
    } else if (scene === 'nuke') {
      nukeT += dt;
      flash = Math.max(0, 1 - nukeT * 0.42);
      shake = Math.max(0, 1 - nukeT * 0.55);
      drawWorld();
      if (nukeT > 2.4) openEnd(false);
    } else if (scene === 'end') {
      updateCars(dt);
      updateWalkers(dt);
      drawWorld();
    } else if (scene === 'title') {
      cam.x = 180 + Math.sin(time * 0.2) * 16;
      cam.y = 200;
      if (!map.length) buildMap();
      updateCars(dt);
      updateWalkers(dt);
      drawWorld();
    }
    actEdge = false;
    requestAnimationFrame(frame);
  }

  load();
  buildMap();
  bootEntities();
  bindPad();
  drawHud();
  show(ui.pad, false);
  requestAnimationFrame(frame);
})();
