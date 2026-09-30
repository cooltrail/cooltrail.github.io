(function () {
  'use strict';

  var VW = 384;
  var VH = 216;
  var TILE = 16;
  var COLS = 48;
  var ROWS = 36;
  var SAVE = 'lantern-isle';

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
    end: document.getElementById('end'),
    again: document.getElementById('again'),
    pad: document.getElementById('pad')
  };

  var C = {
    grass: '#5ec46a',
    grass2: '#49b35c',
    grass3: '#7ed67a',
    path: '#efd3a0',
    path2: '#dfba7d',
    path3: '#c99a5a',
    sand: '#f6e2b3',
    sand2: '#ecc887',
    water: '#3aa0c8',
    water2: '#2b88b5',
    water3: '#5ec4dc',
    foam: '#e7f8ff',
    leaf: '#2f8f4e',
    leaf2: '#48b85f',
    leaf3: '#1e6b38',
    wood: '#8b4e2a',
    wood2: '#c17a3a',
    rock: '#8d9088',
    rock2: '#c5c8be',
    plaza: '#e8d5a8',
    plaza2: '#d4bc86',
    dock: '#c17a3a',
    flower: '#ff6b8a',
    flower2: '#ffd25a',
    paper: '#fff4d6',
    ink: '#3a2418',
    accent: '#f5c542',
    verm: '#d94a32',
    verm2: '#f06a4a',
    cap: '#e07a2a',
    skin: '#f0c9a0',
    shirt: '#fff4d6',
    shadow: 'rgba(30, 40, 20, 0.28)'
  };

  var keys = {};
  var hold = { up: false, down: false, left: false, right: false, act: false };
  var actEdge = false;
  var interactLock = false;
  var scene = 'title';
  var time = 0;
  var cam = { x: 0, y: 0, tx: 0, ty: 0 };
  var map = [];
  var player = { x: 0, y: 0, vx: 0, vy: 0, dir: 0, walk: 0 };
  var npcs = [];
  var gates = [];
  var items = [];
  var lanterns = [];
  var near = null;
  var talk = { lines: [], i: 0, who: '', after: null };
  var stamps = { toss: false, tide: false, climb: false, dash: false };
  var quest = 'idle';
  var muted = false;
  var audio = { ctx: null, t: 0 };
  var trialId = null;
  var trial = null;
  var particles = [];

  var TRIALS = {
    toss: {
      name: 'Lantern Toss',
      keeper: 'Crane',
      blurb: 'Hold to charge, release to throw. Knock every hanging lantern before you run out of pebbles.'
    },
    tide: {
      name: 'Tide Steps',
      keeper: 'Otter',
      blurb: 'Stones drift in on the beat. Tap when they kiss the marker. Three misses and the tide takes you.'
    },
    climb: {
      name: 'Switchback',
      keeper: 'Goat',
      blurb: 'Left, right, jump. Reach the peak before the wind count runs out. Pinecones fall. They are rude.'
    },
    dash: {
      name: 'Harbor Dash',
      keeper: 'Hare',
      blurb: 'The boardwalk runs itself. Jump the crates and the gaps. Make the buoy in one piece.'
    }
  };

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
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return 3;
    return map[ty][tx];
  }

  function solid(id) {
    return id === 3 || id === 4 || id === 5 || id === 9;
  }

  function blocked(x, y, w, h) {
    return solid(tileAt(x, y)) || solid(tileAt(x + w - 1, y)) ||
      solid(tileAt(x, y + h - 1)) || solid(tileAt(x + w - 1, y + h - 1));
  }

  function fill(x, y, w, h, id) {
    var i, j;
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i++) {
        var xx = x + i;
        var yy = y + j;
        if (xx >= 0 && yy >= 0 && xx < COLS && yy < ROWS) map[yy][xx] = id;
      }
    }
  }

  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function buildMap() {
    var x, y;
    map = [];
    for (y = 0; y < ROWS; y++) {
      map[y] = [];
      for (x = 0; x < COLS; x++) map[y][x] = 0;
    }
    fill(0, ROWS - 5, COLS, 5, 3);
    fill(18, ROWS - 6, 10, 3, 7);
    fill(18, ROWS - 7, 10, 1, 2);
    fill(0, ROWS - 8, COLS, 3, 2);
    fill(20, 14, 10, 8, 6);
    fill(22, 21, 4, 8, 1);
    fill(24, 8, 3, 8, 1);
    fill(8, 16, 14, 2, 1);
    fill(28, 16, 14, 2, 1);
    fill(24, 4, 3, 5, 1);
    fill(30, 8, 12, 6, 2);
    fill(2, 12, 8, 8, 0);
    fill(0, 0, COLS, 5, 9);
    fill(16, 4, 16, 2, 5);
    for (y = 0; y < ROWS - 8; y++) {
      for (x = 0; x < COLS; x++) {
        if (map[y][x] !== 0) continue;
        if (hash(x, y) > 0.86) map[y][x] = 4;
        else if (hash(x + 9, y) > 0.9) map[y][x] = 8;
      }
    }
    fill(20, 14, 10, 8, 6);
    fill(22, 21, 4, 8, 1);
    fill(24, 8, 3, 8, 1);
    fill(8, 16, 14, 2, 1);
    fill(28, 16, 14, 2, 1);
    fill(24, 4, 3, 5, 1);
    fill(18, ROWS - 6, 10, 3, 7);
    clearSpot(24, 3, 2, 1);
    clearSpot(36, 10, 2, 2);
    clearSpot(4, 17, 2, 0);
    clearSpot(40, 17, 2, 1);
    clearSpot(20, 28, 1, 2);
    clearSpot(12, 22, 1, 0);
    clearSpot(25, 5, 1, 1);
    clearSpot(6, 17, 1, 0);
    clearSpot(34, 10, 1, 2);
    clearSpot(38, 17, 1, 1);
    clearSpot(41, 12, 1, 2);
  }

  function clearSpot(tx, ty, r, id) {
    var x, y;
    for (y = ty - r; y <= ty + r; y++) {
      for (x = tx - r; x <= tx + r; x++) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        if (y >= ROWS - 5) continue;
        map[y][x] = id;
      }
    }
  }

  function bootEntities() {
    player.x = 22 * TILE + 2;
    player.y = 29 * TILE;
    player.dir = 3;
    npcs = [
      { id: 'ferry', name: 'Ferry', kind: 'ferry', x: 20 * TILE, y: 28 * TILE, lines: [] },
      { id: 'crane', name: 'Crane', kind: 'crane', x: 34 * TILE, y: 10 * TILE, lines: [] },
      { id: 'otter', name: 'Otter', kind: 'otter', x: 6 * TILE, y: 17 * TILE, lines: [] },
      { id: 'goat', name: 'Goat', kind: 'goat', x: 25 * TILE, y: 5 * TILE, lines: [] },
      { id: 'hare', name: 'Hare', kind: 'hare', x: 38 * TILE, y: 17 * TILE, lines: [] },
      { id: 'kid', name: 'Pip', kind: 'kid', x: 12 * TILE, y: 22 * TILE, lines: [] }
    ];
    gates = [
      { id: 'toss', x: 36 * TILE, y: 10 * TILE, w: 16, h: 16 },
      { id: 'tide', x: 4 * TILE, y: 17 * TILE, w: 16, h: 16 },
      { id: 'climb', x: 24 * TILE, y: 3 * TILE, w: 16, h: 16 },
      { id: 'dash', x: 40 * TILE, y: 17 * TILE, w: 16, h: 16 }
    ];
    lanterns = [
      { id: 'toss', x: 29 * TILE, y: 15 * TILE },
      { id: 'tide', x: 20 * TILE, y: 15 * TILE },
      { id: 'climb', x: 22 * TILE, y: 14 * TILE },
      { id: 'dash', x: 27 * TILE, y: 14 * TILE }
    ];
    items = [];
    if (quest !== 'done') {
      items.push({ id: 'bell', x: 41 * TILE + 4, y: 12 * TILE + 4, got: quest === 'have' });
    }
    refreshLines();
  }

  function refreshLines() {
    var n = stampCount();
    npc('ferry').lines = n >= 4
      ? ['The whole plaza is singing. You did that.', 'Go stand in the middle. The island wants to say your name.']
      : ['Welcome to Lantern Isle.', 'Four keepers, four gates, four quiet lights.', 'Walk the paths. Talk first. Then step through a gate.'];
    npc('crane').lines = stamps.toss
      ? ['Clean throws. The cove still hums from them.']
      : ['I hang lanterns for the tide.', 'A pebble, an arc, a little luck. The gate is behind me.'];
    npc('otter').lines = stamps.tide
      ? ['You have river feet now. I can tell.']
      : ['The stones only listen if you do.', 'Step when they kiss the mark. My gate is the wooden one.'];
    npc('goat').lines = stamps.climb
      ? ['Most folks quit at the second pinecone. Not you.']
      : ['Up is a conversation with gravity.', 'The mountain gate is the stone lintel. Mind the cones.'];
    npc('hare').lines = stamps.dash
      ? ['You run like you owe the dock money.']
      : ['Boardwalk, crates, one buoy.', 'If you think, you fall. The east gate is mine.'];
    if (quest === 'idle') {
      npc('kid').lines = ['I dropped a silver bell in the east grass.', 'If you hear a tiny ring, that is it. Please?'];
    } else if (quest === 'have') {
      npc('kid').lines = ['You found it! The bell. Oh.', 'Here — a ribbon for your cap. The keepers like that sort of thing.'];
    } else {
      npc('kid').lines = ['It rings when I run. I will not run. Much.'];
    }
  }

  function npc(id) {
    var i;
    for (i = 0; i < npcs.length; i++) if (npcs[i].id === id) return npcs[i];
    return npcs[0];
  }

  function stampCount() {
    return (stamps.toss ? 1 : 0) + (stamps.tide ? 1 : 0) + (stamps.climb ? 1 : 0) + (stamps.dash ? 1 : 0);
  }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(SAVE) || '{}');
      if (d.stamps) stamps = d.stamps;
      if (d.quest) quest = d.quest;
      muted = !!d.muted;
    } catch (e) {}
  }

  function save() {
    localStorage.setItem(SAVE, JSON.stringify({ stamps: stamps, quest: quest, muted: muted }));
  }

  function drawStamps() {
    ui.stamps.innerHTML = '';
    ['tide', 'climb', 'toss', 'dash'].forEach(function (id) {
      var s = document.createElement('div');
      s.className = 'stamp' + (stamps[id] ? ' on' : '');
      ui.stamps.appendChild(s);
    });
    ui.mute.textContent = muted ? 'Muted' : 'Sound';
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

  function shadow(gx, gy, w) {
    ctx.fillStyle = C.shadow;
    ctx.beginPath();
    ctx.ellipse(Math.round(gx + w / 2), Math.round(gy + 15), w * 0.45, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function land(id) {
    return id !== 3;
  }

  function tileId(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return 3;
    return map[ty][tx];
  }

  function drawTile(id, sx, sy, tx, ty) {
    var gx = sx - cam.x;
    var gy = sy - cam.y;
    if (gx > VW || gy > VH || gx + TILE < 0 || gy + TILE < 0) return;
    var speckle = hash(tx, ty);
    if (id === 3) {
      var wave = Math.sin(time * 2.2 + tx * 0.5 + ty * 0.35);
      pix(gx, gy, TILE, TILE, wave > 0.15 ? C.water3 : wave < -0.4 ? C.water2 : C.water);
      if ((tx + ty + Math.floor(time * 3)) % 8 === 0) pix(gx + 4, gy + 6, 6, 1, C.foam);
      if (!land(tileId(tx, ty - 1))) {} else pix(gx, gy, TILE, 3, C.foam);
      if (land(tileId(tx, ty + 1))) pix(gx, gy + 13, TILE, 3, C.sand);
      if (land(tileId(tx - 1, ty))) pix(gx, gy, 2, TILE, C.foam);
      if (land(tileId(tx + 1, ty))) pix(gx + 14, gy, 2, TILE, C.foam);
      return;
    }
    if (id === 0 || id === 4 || id === 8) {
      pix(gx, gy, TILE, TILE, speckle > 0.55 ? C.grass : C.grass2);
      if (speckle > 0.82) pix(gx + 5, gy + 8, 2, 2, C.grass3);
      if (speckle < 0.12) pix(gx + 10, gy + 3, 2, 2, C.leaf3);
    } else if (id === 1) {
      pix(gx, gy, TILE, TILE, C.path);
      if (speckle > 0.5) pix(gx + 3, gy + 9, 3, 2, C.path2);
      if (tileId(tx, ty - 1) === 0) pix(gx, gy, TILE, 2, C.path3);
      if (tileId(tx, ty + 1) === 0) pix(gx, gy + 14, TILE, 2, C.path3);
      if (tileId(tx - 1, ty) === 0) pix(gx, gy, 2, TILE, C.path3);
      if (tileId(tx + 1, ty) === 0) pix(gx + 14, gy, 2, TILE, C.path3);
    } else if (id === 2) {
      pix(gx, gy, TILE, TILE, C.sand);
      if (speckle > 0.45) pix(gx + 7, gy + 10, 2, 2, C.sand2);
      if (speckle > 0.8) pix(gx + 3, gy + 4, 1, 1, C.paper);
    } else if (id === 6) {
      pix(gx, gy, TILE, TILE, (tx + ty) % 2 ? C.plaza : C.plaza2);
      pix(gx + 1, gy + 1, 1, 1, C.paper);
    } else if (id === 7) {
      pix(gx, gy, TILE, TILE, C.dock);
      pix(gx, gy + 5, TILE, 2, C.wood);
      pix(gx, gy + 12, TILE, 2, C.wood);
      pix(gx + 7, gy, 2, TILE, C.wood2);
    } else if (id === 5 || id === 9) {
      pix(gx, gy, TILE, TILE, id === 9 ? '#6f8b6a' : C.rock);
      pix(gx + 2, gy + 4, 12, 9, C.rock2);
      pix(gx + 4, gy + 2, 8, 4, C.paper);
    }
    if (id === 8) {
      pix(gx + 3, gy + 9, 4, 4, speckle > 0.5 ? C.flower : C.flower2);
      pix(gx + 8, gy + 7, 3, 3, speckle > 0.5 ? C.flower2 : C.flower);
      pix(gx + 6, gy + 11, 2, 3, C.leaf);
    }
  }

  function drawTree(sx, sy) {
    var gx = sx - cam.x;
    var gy = sy - cam.y - 6;
    pix(gx + 3, gy + 18, 11, 4, C.shadow);
    pix(gx + 7, gy + 12, 3, 10, C.wood);
    pix(gx + 6, gy + 14, 5, 3, C.wood2);
    pix(gx + 1, gy + 1, 15, 14, C.leaf3);
    pix(gx + 2, gy, 13, 13, C.leaf);
    pix(gx + 4, gy + 2, 8, 7, C.leaf2);
    pix(gx + 6, gy + 3, 3, 3, C.grass3);
  }

  function drawGate(g) {
    var gx = g.x - cam.x - 6;
    var gy = g.y - cam.y - 10;
    var lit = stamps[g.id];
    pix(gx + 4, gy + 22, 20, 4, C.shadow);
    pix(gx + 3, gy + 6, 4, 20, C.verm);
    pix(gx + 21, gy + 6, 4, 20, C.verm);
    pix(gx + 2, gy + 5, 6, 3, C.verm2);
    pix(gx + 20, gy + 5, 6, 3, C.verm2);
    pix(gx, gy + 2, 28, 5, C.verm);
    pix(gx + 2, gy - 1, 24, 4, C.verm2);
    pix(gx + 1, gy + 1, 26, 2, C.accent);
    pix(gx + 12, gy + 8, 3, 8, lit ? C.accent : C.wood);
    pix(gx + 10, gy + 15, 7, 7, lit ? C.accent : '#6a4430');
    if (lit) pix(gx + 12, gy + 17, 3, 3, C.paper);
  }

  function drawLantern(L) {
    var gx = L.x - cam.x;
    var gy = L.y - cam.y;
    var lit = stamps[L.id];
    var glow = lit ? 0.5 + Math.sin(time * 4 + L.x) * 0.15 : 0;
    pix(gx + 2, gy + 16, 10, 3, C.shadow);
    pix(gx + 6, gy + 8, 3, 10, C.wood);
    pix(gx + 2, gy + 1, 11, 10, lit ? C.verm : '#6a5344');
    pix(gx + 3, gy + 2, 9, 8, lit ? C.accent : '#8a7360');
    pix(gx + 5, gy + 4, 5, 4, lit ? C.paper : '#c4b49a');
    if (lit) {
      pix(gx + 1, gy - 1, 13, 2, 'rgba(245,197,66,' + glow + ')');
      if (Math.floor(time * 6 + L.x) % 5 === 0) pix(gx + 12, gy, 2, 2, C.paper);
    }
  }

  function blit(rows, x, y, pal, flip) {
    var h = rows.length;
    var w = rows[0].length;
    var r, c, ch, col;
    x = Math.round(x);
    y = Math.round(y);
    for (r = 0; r < h; r++) {
      for (c = 0; c < w; c++) {
        ch = rows[r].charAt(flip ? w - 1 - c : c);
        col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }

  var PFOX = {
    k: '#3a2418', w: '#fff4d6', o: '#e07a2a', r: '#c44b22',
    c: '#f0c9a0', n: '#8b4e2a', p: '#ff8aa0', y: '#f5c542',
    '.': null
  };
  var FOX_DOWN = [
    '..kkkkkk..',
    '.krrwwrrk.',
    'krwwowwwrk',
    'kwoowwoowk',
    'kwwkkkkwwk',
    '.kwwwwwwk.',
    '..kcccck..',
    '.kcoyyock.',
    '.kcoooock.',
    '..kcccck..',
    '..kk..kk..'
  ];
  var FOX_SIDE = [
    '..kkkkk...',
    '.krrwwwk..',
    'krwowwwwk.',
    'kwoowwwwk.',
    'kwwwkkwk..',
    '.kwwwwwk..',
    '..kccck...',
    '.kcyyock..',
    '.kcooock..',
    '..kccck...',
    '..kk.kk...'
  ];
  var FOX_UP = [
    '..kkkkkk..',
    '.krrrrrrk.',
    'krrwwwwrrk',
    'krwwwwwwrk',
    'kwwwwwwwwk',
    '.kwwwwwwk.',
    '..kcccck..',
    '.kcccccck.',
    '.kcccccck.',
    '..kcccck..',
    '..kk..kk..'
  ];

  function drawFox(gx, gy, dir, walk, ribbon) {
    var bob = walk ? (Math.floor(time * 10) % 2) : (Math.sin(time * 3) > 0.92 ? 1 : 0);
    shadow(gx, gy + bob, 12);
    var rows = dir === 3 ? FOX_UP : (dir === 0 ? FOX_DOWN : FOX_SIDE);
    blit(rows, gx + 1, gy + bob, PFOX, dir === 1);
    if (ribbon) pix(gx + 4, gy + 9 + bob, 6, 2, '#7ec8ff');
  }

  function drawCritter(kind, gx, gy) {
    var bob = Math.round(Math.sin(time * 2.4 + gx) * 1);
    shadow(gx, gy + bob, 12);
    if (kind === 'crane') {
      pix(gx + 6, gy + 2 + bob, 3, 10, '#fff4d6');
      pix(gx + 5, gy + bob, 5, 5, '#fff4d6');
      pix(gx + 7, gy - 1 + bob, 2, 4, C.verm);
      pix(gx + 9, gy + 3 + bob, 4, 2, C.ink);
      pix(gx + 4, gy + 12 + bob, 7, 3, '#fff4d6');
    } else if (kind === 'otter') {
      pix(gx + 2, gy + 4 + bob, 12, 8, '#8b4e2a');
      pix(gx + 4, gy + 6 + bob, 8, 5, '#e8c9a0');
      pix(gx + 3, gy + 1 + bob, 5, 5, '#8b4e2a');
      pix(gx + 10, gy + 2 + bob, 5, 4, '#8b4e2a');
      pix(gx + 5, gy + 3 + bob, 2, 2, C.ink);
    } else if (kind === 'goat') {
      pix(gx + 3, gy + 5 + bob, 10, 8, '#efe6d4');
      pix(gx + 4, gy + 1 + bob, 8, 6, '#efe6d4');
      pix(gx + 3, gy - 2 + bob, 2, 5, C.ink);
      pix(gx + 11, gy - 2 + bob, 2, 5, C.ink);
      pix(gx + 6, gy + 4 + bob, 2, 2, C.ink);
      pix(gx + 9, gy + 4 + bob, 2, 2, C.ink);
    } else if (kind === 'hare') {
      pix(gx + 4, gy + 6 + bob, 9, 8, '#e8c48a');
      pix(gx + 5, gy + 2 + bob, 7, 6, '#e8c48a');
      pix(gx + 5, gy - 4 + bob, 2, 7, '#e8c48a');
      pix(gx + 9, gy - 5 + bob, 2, 8, '#e8c48a');
      pix(gx + 7, gy + 4 + bob, 2, 2, C.ink);
    } else if (kind === 'ferry') {
      pix(gx + 3, gy + 6 + bob, 9, 8, '#3a7ca8');
      pix(gx + 4, gy + 1 + bob, 7, 6, C.skin);
      pix(gx + 3, gy + bob, 9, 3, '#1f4e72');
      pix(gx + 6, gy + 3 + bob, 2, 2, C.ink);
    } else {
      pix(gx + 4, gy + 7 + bob, 7, 6, '#7ec8ff');
      pix(gx + 5, gy + 2 + bob, 6, 6, C.skin);
      pix(gx + 4, gy + 1 + bob, 7, 3, '#f06a4a');
      pix(gx + 6, gy + 4 + bob, 2, 2, C.ink);
    }
  }

  function drawItem(it) {
    if (it.got) return;
    var gx = it.x - cam.x;
    var gy = it.y - cam.y + Math.sin(time * 3) * 2;
    pix(gx + 1, gy + 8, 6, 2, C.shadow);
    pix(gx + 1, gy, 6, 6, '#e8e0d0');
    pix(gx + 2, gy + 1, 4, 4, C.accent);
    pix(gx + 3, gy - 2, 2, 2, C.paper);
  }

  function drawWorld() {
    var x, y;
    ctx.fillStyle = C.water2;
    ctx.fillRect(0, 0, VW, VH);
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) drawTile(map[y][x], x * TILE, y * TILE, x, y);
    }
    lanterns.forEach(drawLantern);
    gates.forEach(drawGate);
    items.forEach(drawItem);
    var drawList = npcs.map(function (e) {
      return {
        y: e.y,
        draw: function () { drawCritter(e.kind, e.x - cam.x, e.y - cam.y); }
      };
    });
    drawList.push({
      y: player.y,
      draw: function () {
        drawFox(player.x - cam.x, player.y - cam.y, player.dir, player.walk, quest === 'done');
      }
    });
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        if (map[y][x] === 4) {
          (function (sx, sy) {
            drawList.push({ y: sy + 14, draw: function () { drawTree(sx, sy); } });
          })(x * TILE, y * TILE);
        }
      }
    }
    drawList.sort(function (a, b) { return a.y - b.y; });
    drawList.forEach(function (e) { e.draw(); });
  }

  function updateWorld(dt) {
    var spd = 68;
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
    var nx = player.x + player.vx * dt;
    var ny = player.y + player.vy * dt;
    if (!blocked(nx, player.y + 10, 10, 6)) player.x = nx;
    if (!blocked(player.x, ny + 10, 10, 6)) player.y = ny;
    player.x = clamp(player.x, 0, COLS * TILE - 12);
    player.y = clamp(player.y, 0, ROWS * TILE - 16);
    cam.tx = clamp(player.x - VW / 2 + 6, 0, COLS * TILE - VW);
    cam.ty = clamp(player.y - VH / 2 + 8, 0, ROWS * TILE - VH);
    cam.x += (cam.tx - cam.x) * Math.min(1, dt * 7);
    cam.y += (cam.ty - cam.y) * Math.min(1, dt * 7);

    near = null;
    var i, e, d;
    for (i = 0; i < npcs.length; i++) {
      e = npcs[i];
      d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
      if (d < 18) near = { kind: 'npc', e: e, text: 'Talk · ' + e.name };
    }
    for (i = 0; i < gates.length; i++) {
      e = gates[i];
      if (aabb(player.x, player.y, 12, 14, e.x - 2, e.y - 2, e.w + 4, e.h + 4)) {
        near = { kind: 'gate', e: e, text: (stamps[e.id] ? 'Replay · ' : 'Play · ') + TRIALS[e.id].name };
      }
    }
    for (i = 0; i < items.length; i++) {
      e = items[i];
      if (!e.got && aabb(player.x, player.y, 12, 14, e.x, e.y, 8, 8)) {
        e.got = true;
        quest = 'have';
        beep(880, 0.12, 0.05, 'sine');
        refreshLines();
        save();
      }
    }
    if (near) {
      ui.prompt.textContent = near.text;
      show(ui.prompt, true);
    } else show(ui.prompt, false);

    if (actEdge && near && !interactLock) {
      if (near.kind === 'npc') openTalk(near.e);
      else openIntro(near.e.id);
    }
  }

  function openTalk(e) {
    refreshLines();
    talk.who = e.name;
    talk.lines = e.lines.slice();
    talk.i = 0;
    talk.after = function () {
      if (e.id === 'kid' && quest === 'have') {
        quest = 'done';
        refreshLines();
        save();
      }
      if (e.id === 'ferry' && stampCount() >= 4) openEnd();
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

  function openIntro(id) {
    trialId = id;
    var t = TRIALS[id];
    ui.cardK.textContent = t.keeper;
    ui.cardH.textContent = t.name;
    ui.cardP.textContent = t.blurb;
    ui.cardOk.textContent = 'Begin';
    show(ui.card, true);
    show(ui.prompt, false);
    scene = 'intro';
  }

  function openResult(win, note) {
    scene = 'result';
    ui.cardK.textContent = win ? 'Lit' : 'Not yet';
    ui.cardH.textContent = win ? TRIALS[trialId].name : 'Almost';
    ui.cardP.textContent = note;
    ui.cardOk.textContent = win ? 'Back to the isle' : 'Try again';
    show(ui.card, true);
    if (win) {
      stamps[trialId] = true;
      refreshLines();
      save();
      drawStamps();
      beep(523, 0.1, 0.05, 'sine');
      setTimeout(function () { beep(659, 0.12, 0.05, 'sine'); }, 120);
      setTimeout(function () { beep(784, 0.18, 0.05, 'sine'); }, 240);
    } else beep(140, 0.18, 0.05, 'triangle');
  }

  function startTrial() {
    show(ui.card, false);
    scene = 'trial';
    trial = makeTrial(trialId);
  }

  function returnWorld() {
    show(ui.card, false);
    show(ui.end, false);
    scene = 'world';
    trial = null;
    if (stampCount() >= 4 && !window._isleEnded) {
      window._isleEnded = true;
      setTimeout(openEnd, 600);
    }
  }

  function openEnd() {
    scene = 'end';
    show(ui.dialog, false);
    show(ui.card, false);
    show(ui.end, true);
    beep(392, 0.2, 0.05, 'sine');
  }

  function makeTrial(id) {
    if (id === 'toss') return tossTrial();
    if (id === 'tide') return tideTrial();
    if (id === 'climb') return climbTrial();
    return dashTrial();
  }

  function tossTrial() {
    var angle = -0.7;
    var power = 0;
    var charging = false;
    var pebbles = 8;
    var ball = null;
    var lamps = [
      { x: 150, y: 70, r: 8, hit: false },
      { x: 200, y: 48, r: 8, hit: false },
      { x: 248, y: 78, r: 8, hit: false },
      { x: 280, y: 40, r: 8, hit: false },
      { x: 230, y: 110, r: 8, hit: false }
    ];
    function left() {
      return lamps.filter(function (L) { return !L.hit; }).length;
    }
    return {
      update: function (dt) {
        if (hold.up) angle -= 1.4 * dt;
        if (hold.down) angle += 1.4 * dt;
        angle = clamp(angle, -1.25, -0.15);
        if (hold.act && !ball && pebbles) {
          charging = true;
          power = Math.min(1, power + dt * 1.3);
        }
        if (charging && !hold.act && !ball && pebbles) {
          charging = false;
          pebbles -= 1;
          var p = 50 + power * 170;
          ball = { x: 36, y: 132, vx: Math.cos(angle) * p, vy: Math.sin(angle) * p };
          power = 0;
          beep(300, 0.05, 0.04);
        }
        if (ball) {
          ball.vy += 220 * dt;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          lamps.forEach(function (L) {
            if (L.hit) return;
            var dx = ball.x - L.x;
            var dy = ball.y - L.y;
            if (dx * dx + dy * dy < (L.r + 3) * (L.r + 3)) {
              L.hit = true;
              beep(740, 0.08, 0.05, 'sine');
            }
          });
          if (ball.y > 160 || ball.x > 330 || ball.x < -8) ball = null;
        }
        if (left() === 0) openResult(true, 'Every lantern swung. Crane would nod, once.');
        else if (!ball && pebbles <= 0 && left()) openResult(false, 'Pebbles gone. The cove keeps its lights.');
      },
      draw: function () {
        pix(0, 0, VW, VH, '#7ec8ea');
        pix(0, 150, VW, 30, C.sand);
        pix(0, 148, VW, 3, C.water2);
        lamps.forEach(function (L) {
          if (L.hit) return;
          pix(L.x - 1, 20, 2, L.y - 20, C.wood);
          pix(L.x - 7, L.y - 6, 14, 12, C.accent);
          pix(L.x - 4, L.y - 3, 8, 6, C.paper);
        });
        drawFox(22, 124, 2, false, quest === 'done');
        var ax = 36 + Math.cos(angle) * 28;
        var ay = 132 + Math.sin(angle) * 28;
        ctx.strokeStyle = C.ink;
        ctx.beginPath();
        ctx.moveTo(36, 132);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        pix(8, 12, 80, 8, '#222');
        pix(8, 12, 80 * power, 8, C.accent);
        ctx.fillStyle = C.ink;
        ctx.font = '8px monospace';
        ctx.fillStyle = C.paper;
        ctx.fillText('pebbles ' + pebbles, 8, 36);
        if (ball) pix(ball.x - 2, ball.y - 2, 4, 4, C.rock2);
      }
    };
  }

  function tideTrial() {
    var notes = [];
    var t = 0;
    var hits = 0;
    var miss = 0;
    var spawn = 0.7;
    var total = 16;
    var made = 0;
    function spawnNote() {
      if (made >= total) return;
      notes.push({ x: 330, hit: false, miss: false });
      made += 1;
    }
    spawnNote();
    return {
      update: function (dt) {
        t += dt;
        spawn -= dt;
        if (spawn <= 0) {
          spawn = 0.55 + Math.random() * 0.25;
          spawnNote();
        }
        notes.forEach(function (n) { n.x -= 120 * dt; });
        var windowed = notes.find(function (n) { return !n.hit && !n.miss && n.x > 52 && n.x < 84; });
        if (actEdge) {
          if (windowed) {
            windowed.hit = true;
            hits += 1;
            beep(660, 0.06, 0.05, 'sine');
          } else {
            miss += 1;
            beep(160, 0.08, 0.04);
          }
        }
        notes.forEach(function (n) {
          if (!n.hit && !n.miss && n.x < 48) {
            n.miss = true;
            miss += 1;
          }
        });
        if (miss >= 3) openResult(false, 'The stones got shy. Otter pretends not to watch.');
        else if (made >= total && notes.every(function (n) { return n.hit || n.miss; }) && miss < 3) {
          openResult(true, hits + ' clean steps. The river liked you.');
        }
      },
      draw: function () {
        pix(0, 0, VW, VH, '#3cb371');
        pix(0, 110, VW, 70, C.water);
        pix(64, 96, 12, 28, C.accent);
        notes.forEach(function (n) {
          if (n.hit || n.miss) return;
          pix(n.x, 102, 18, 18, C.rock2);
          pix(n.x + 4, 106, 10, 8, C.paper);
        });
        ctx.fillStyle = C.paper;
        ctx.font = '8px monospace';
        ctx.fillText('miss ' + miss + '/3', 8, 16);
      }
    };
  }

  function climbTrial() {
    var p = { x: 150, y: 420, vx: 0, vy: 0, on: false };
    var plats = [{ x: 120, y: 450, w: 80 }];
    var i;
    for (i = 0; i < 14; i++) {
      plats.push({
        x: 40 + (i % 3) * 80 + (i % 2) * 20,
        y: 420 - i * 28,
        w: 50 + (i % 2) * 18
      });
    }
    var goal = 420 - 14 * 28 - 20;
    var cones = [];
    var clock = 45;
    var camY = 300;
    return {
      update: function (dt) {
        clock -= dt;
        p.vx = (hold.left ? -90 : 0) + (hold.right ? 90 : 0);
        if (actEdge && p.on) {
          p.vy = -168;
          p.on = false;
          beep(420, 0.05, 0.03);
        }
        p.vy += 420 * dt;
        p.x = clamp(p.x + p.vx * dt, 8, 300);
        p.y += p.vy * dt;
        p.on = false;
        plats.forEach(function (pl) {
          if (p.vy >= 0 && p.x + 10 > pl.x && p.x < pl.x + pl.w && p.y + 14 > pl.y && p.y + 14 < pl.y + 10 && p.y < pl.y) {
            p.y = pl.y - 14;
            p.vy = 0;
            p.on = true;
          }
        });
        if (Math.random() < dt * 0.9) cones.push({ x: 20 + Math.random() * 280, y: camY - 20, vy: 40 });
        cones.forEach(function (c) {
          c.y += (c.vy + 60) * dt;
          if (aabb(p.x, p.y, 10, 14, c.x, c.y, 6, 8)) {
            p.vy = 40;
            p.x += c.x < p.x ? 12 : -12;
          }
        });
        cones = cones.filter(function (c) { return c.y < camY + 220; });
        camY += (p.y - 90 - camY) * Math.min(1, dt * 4);
        if (p.y + 14 > 470) {
          p.x = 150;
          p.y = 436;
          p.vy = 0;
        }
        if (p.y < goal) openResult(true, 'The peak, and a goat who refuses to be impressed.');
        else if (clock <= 0) openResult(false, 'Wind count emptied. The mountain stays.');
      },
      draw: function () {
        pix(0, 0, VW, VH, '#6fbf88');
        plats.forEach(function (pl) {
          pix(pl.x, pl.y - camY, pl.w, 6, C.rock2);
        });
        cones.forEach(function (c) { pix(c.x, c.y - camY, 6, 8, C.wood); });
        drawFox(p.x, p.y - camY - 2, 3, !p.on, quest === 'done');
        pix(40, goal - 8 - camY, 240, 6, C.accent);
        ctx.fillStyle = C.paper;
        ctx.font = '8px monospace';
        ctx.fillText(Math.ceil(Math.max(0, clock)) + 's', 8, 16);
      }
    };
  }

  function dashTrial() {
    var y = 110;
    var vy = 0;
    var on = true;
    var dist = 0;
    var goal = 1400;
    var obs = [];
    var i;
    for (i = 0; i < 18; i++) {
      obs.push({ x: 220 + i * 78, kind: i % 3 === 2 ? 'gap' : 'crate' });
    }
    return {
      update: function (dt) {
        dist += 140 * dt;
        if (actEdge && on) {
          vy = -210;
          on = false;
          beep(400, 0.04, 0.03);
        }
        vy += 560 * dt;
        y += vy * dt;
        if (y >= 110) {
          y = 110;
          vy = 0;
          on = true;
        }
        var dead = false;
        obs.forEach(function (o) {
          var sx = o.x - dist;
          if (o.kind === 'crate' && aabb(40, y, 12, 14, sx, 108, 16, 16)) dead = true;
          if (o.kind === 'gap' && on && sx < 50 && sx + 28 > 40) dead = true;
        });
        if (dead) openResult(false, 'A crate 1, you 0. Hare pretends to stretch.');
        else if (dist >= goal) openResult(true, 'Buoy. Breath. The dock makes a small fuss.');
      },
      draw: function () {
        pix(0, 0, VW, VH, '#8fd3ee');
        pix(0, 124, VW, 56, C.water);
        pix(0, 118, VW, 8, C.dock);
        obs.forEach(function (o) {
          var sx = o.x - dist;
          if (o.kind === 'crate') pix(sx, 108, 16, 16, C.wood);
          else pix(sx, 118, 28, 10, C.water2);
        });
        drawFox(38, y - 4, 2, true, quest === 'done');
        pix(8, 8, 120, 6, '#222');
        pix(8, 8, 120 * clamp(dist / goal, 0, 1), 6, C.accent);
      }
    };
  }

  function onAct() {
    if (scene === 'title') return begin();
    if (scene === 'dialog') return stepTalk();
    if (scene === 'intro') return startTrial();
    if (scene === 'result') {
      if (ui.cardOk.textContent === 'Try again') startTrial();
      else returnWorld();
      return;
    }
    if (scene === 'end') return begin(true);
  }

  function begin(keep) {
    ensureAudio();
    if (!keep) {
      // keep save
    }
    show(ui.title, false);
    show(ui.end, false);
    show(ui.card, false);
    show(ui.dialog, false);
    show(ui.hud, true);
    show(ui.pad, true);
    buildMap();
    bootEntities();
    drawStamps();
    scene = 'world';
    beep(392, 0.08, 0.04, 'sine');
  }

  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
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

  ui.start.addEventListener('click', begin);
  ui.again.addEventListener('click', function () { begin(true); });
  ui.cardOk.addEventListener('click', function () {
    if (scene === 'intro') startTrial();
    else if (scene === 'result') {
      if (ui.cardOk.textContent === 'Try again') startTrial();
      else returnWorld();
    }
  });
  ui.cardBack.addEventListener('click', returnWorld);
  ui.dialog.addEventListener('click', function () {
    if (scene === 'dialog') stepTalk();
  });
  ui.mute.addEventListener('click', function () {
    muted = !muted;
    if (!muted) ensureAudio();
    save();
    drawStamps();
  });

  var last = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    if (scene === 'world') {
      updateWorld(dt);
      drawWorld();
    } else if (scene === 'dialog' || scene === 'intro') {
      drawWorld();
    } else if (scene === 'trial' && trial) {
      trial.update(dt);
      if (scene === 'trial') trial.draw();
    } else if (scene === 'result' || scene === 'end') {
      if (trial) trial.draw();
      else drawWorld();
    } else if (scene === 'title') {
      cam.x = 248 + Math.sin(time * 0.22) * 18;
      cam.y = 168;
      if (!map.length) buildMap();
      drawWorld();
    }
    actEdge = false;
    requestAnimationFrame(frame);
  }

  load();
  buildMap();
  bootEntities();
  bindPad();
  drawStamps();
  show(ui.pad, false);
  requestAnimationFrame(frame);
})();
