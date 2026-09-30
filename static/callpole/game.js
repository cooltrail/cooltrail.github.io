(function () {
  'use strict';

  var VW = 384;
  var VH = 216;
  var TILE = 16;
  var COLS = 48;
  var ROWS = 36;
  var SAVE = 'callpole';

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
    pad: document.getElementById('pad')
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
    night: '#1a2238'
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
  var player = { x: 0, y: 0, vx: 0, vy: 0, dir: 0, walk: 0 };
  var npcs = [];
  var poles = [];
  var near = null;
  var talk = { lines: [], i: 0, who: '', after: null };
  var quest = 'idle';
  var muted = false;
  var audio = { ctx: null };
  var ride = { pole: null, wait: 0, vehicle: null };
  var lattice = 0;
  var flash = 0;

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
    return id === 3;
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

  function addBuilding(x, y, w, h, color) {
    fill(x, y, w, h, 3);
    buildings.push({ x: x, y: y, w: w, h: h, color: color });
  }

  function buildMap() {
    var x, y;
    map = [];
    buildings = [];
    for (y = 0; y < ROWS; y++) {
      map[y] = [];
      for (x = 0; x < COLS; x++) map[y][x] = 0;
    }
    fill(0, 8, COLS, 3, 1);
    fill(0, 16, COLS, 3, 1);
    fill(0, 24, COLS, 3, 1);
    fill(10, 0, 3, ROWS, 1);
    fill(22, 0, 3, ROWS, 1);
    fill(34, 0, 3, ROWS, 1);
    fill(10, 8, 3, 3, 2);
    fill(22, 8, 3, 3, 2);
    fill(34, 8, 3, 3, 2);
    fill(10, 16, 3, 3, 2);
    fill(22, 16, 3, 3, 2);
    fill(34, 16, 3, 3, 2);
    fill(10, 24, 3, 3, 2);
    fill(22, 24, 3, 3, 2);
    fill(34, 24, 3, 3, 2);
    fill(14, 19, 7, 4, 4);
    addBuilding(1, 1, 8, 6, '#6a7c92');
    addBuilding(14, 1, 7, 6, '#b85c4a');
    addBuilding(26, 1, 7, 6, '#4f6e78');
    addBuilding(38, 1, 9, 6, '#8a6a3a');
    addBuilding(1, 12, 8, 3, '#5a6a80');
    addBuilding(14, 12, 7, 3, '#c4784a');
    addBuilding(26, 12, 7, 3, '#3d5c72');
    addBuilding(38, 12, 9, 3, '#7a4e5c');
    addBuilding(1, 20, 8, 3, '#4a5a6e');
    addBuilding(26, 20, 7, 3, '#d2a24a');
    addBuilding(38, 20, 9, 3, '#5c6e58');
    addBuilding(1, 28, 8, 7, '#3e4a5c');
    addBuilding(14, 28, 7, 7, '#8c5a48');
    addBuilding(26, 28, 7, 7, '#486070');
    addBuilding(38, 28, 9, 7, '#6e5a40');
    addBuilding(14, 4, 3, 2, '#9aa8b4');
  }

  function bootEntities() {
    player.x = 16 * TILE;
    player.y = 18 * TILE;
    player.dir = 0;
    npcs = [
      { id: 'mira', name: 'Mira', kind: 'mira', x: 16 * TILE, y: 20 * TILE, lines: [] },
      { id: 'dash', name: 'Dash', kind: 'dash', x: 12 * TILE, y: 17 * TILE, lines: [] },
      { id: 'rex', name: 'Rex', kind: 'rex', x: 24 * TILE, y: 3 * TILE, lines: [] },
      { id: 'kit', name: 'Kit', kind: 'kit', x: 36 * TILE, y: 17 * TILE, lines: [] }
    ];
    poles = [
      { id: 'bus-plaza', kind: 'bus', name: 'Plaza', x: 12 * TILE, y: 18 * TILE },
      { id: 'bus-east', kind: 'bus', name: 'East Side', x: 36 * TILE, y: 18 * TILE },
      { id: 'bus-base', kind: 'bus', name: 'North Base', x: 22 * TILE, y: 6 * TILE },
      { id: 'taxi-plaza', kind: 'taxi', name: 'Plaza', x: 20 * TILE, y: 18 * TILE },
      { id: 'taxi-south', kind: 'taxi', name: 'South Block', x: 24 * TILE, y: 26 * TILE },
      { id: 'taxi-base', kind: 'taxi', name: 'Base Gate', x: 26 * TILE, y: 6 * TILE }
    ];
    refreshLines();
  }

  function npc(id) {
    var i;
    for (i = 0; i < npcs.length; i++) if (npcs[i].id === id) return npcs[i];
    return npcs[0];
  }

  function refreshLines() {
    if (quest === 'idle') {
      npc('mira').lines = [
        'Mira. Civic works. The clouds are not weather.',
        'I have a blueprint for a Lattice. A sky fence.',
        'The North Base can build it. Take this. Do not fold it.',
        'Call a bus or a taxi at a pole if your feet get bored.'
      ];
    } else if (quest === 'have') {
      npc('mira').lines = ['You still have it? North. The base. The poles if you want speed.'];
    } else {
      npc('mira').lines = ['I felt it come up from here. Like a held breath.'];
    }
    npc('dash').lines = [
      'Blue pole is a bus. Yellow pole is a taxi.',
      'Stand close. Call. Pick a stop. Try not to miss the last one.'
    ];
    if (quest === 'have') {
      npc('rex').lines = [
        'You Mira\'s runner? Let me see that paper.',
        'Copy that. We start the Lattice now. Stay on the pad.'
      ];
    } else if (quest === 'idle') {
      npc('rex').lines = ['North Base. We are waiting on a blueprint from downtown. You are not it. Yet.'];
    } else {
      npc('rex').lines = ['Lattice is live. Go home. Or do not. The meters still eat coins.'];
    }
    npc('kit').lines = ['Lights in the clouds. Not stars. I cancelled my dinner.'];
  }

  function questLabel() {
    if (quest === 'idle') return 'Find Mira · Plaza';
    if (quest === 'have') return 'Blueprint · North Base';
    if (quest === 'build') return 'Lattice coming up';
    return 'City saved';
  }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(SAVE) || '{}');
      if (d.quest) quest = d.quest;
      muted = !!d.muted;
      if (quest === 'build') quest = 'have';
    } catch (e) {}
  }

  function save() {
    localStorage.setItem(SAVE, JSON.stringify({ quest: quest, muted: muted }));
  }

  function drawHud() {
    ui.stamps.textContent = questLabel();
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

  function drawTile(id, sx, sy, tx, ty) {
    var gx = sx - cam.x;
    var gy = sy - cam.y;
    if (gx > VW || gy > VH || gx + TILE < 0 || gy + TILE < 0) return;
    if (id === 1) {
      pix(gx, gy, TILE, TILE, (tx + ty) % 5 === 0 ? C.road2 : C.road);
      if (ty === 9 || ty === 17 || ty === 25) {
        if (tx % 2 === 0) pix(gx + 2, gy + 7, 8, 2, C.line);
      }
      if (tx === 11 || tx === 23 || tx === 35) {
        if (ty % 2 === 0) pix(gx + 7, gy + 2, 2, 8, C.white);
      }
    } else if (id === 2) {
      pix(gx, gy, TILE, TILE, C.road);
      pix(gx + 1, gy + 1, 14, 3, C.white);
      pix(gx + 1, gy + 7, 14, 3, C.white);
      pix(gx + 1, gy + 12, 14, 3, C.white);
    } else if (id === 4) {
      pix(gx, gy, TILE, TILE, (tx + ty) % 2 ? C.plaza : C.plaza2);
    } else if (id === 3) {
      pix(gx, gy, TILE, TILE, C.walk2);
    } else {
      pix(gx, gy, TILE, TILE, hash(tx, ty) > 0.5 ? C.walk : C.walk2);
    }
  }

  function drawBuilding(b) {
    var gx = b.x * TILE - cam.x;
    var gy = b.y * TILE - cam.y - 10;
    var w = b.w * TILE;
    var h = b.h * TILE + 10;
    pix(gx + 2, gy + h - 4, w, 6, C.shadow);
    pix(gx, gy, w, h, b.color);
    pix(gx, gy, w, 4, '#1a1e28');
    var i, j;
    for (j = 8; j < h - 8; j += 6) {
      for (i = 4; i < w - 4; i += 6) {
        pix(gx + i, gy + j, 3, 3, (i + j) % 12 === 4 ? C.accent : '#dce8f0');
      }
    }
  }

  function drawPole(p) {
    var gx = p.x - cam.x;
    var gy = p.y - cam.y;
    var lit = p.kind === 'bus' ? C.bus : C.taxi;
    pix(gx + 2, gy + 14, 8, 3, C.shadow);
    pix(gx + 5, gy - 10, 3, 24, '#2a2e38');
    pix(gx + 2, gy - 12, 9, 8, lit);
    pix(gx + 4, gy - 10, 5, 4, C.paper);
    if (Math.floor(time * 4) % 2 === 0) pix(gx + 5, gy - 14, 3, 2, lit);
  }

  function drawLattice() {
    if (lattice <= 0) return;
    var gx = 23 * TILE - cam.x;
    var gy = 2 * TILE - cam.y - Math.floor(lattice * 28);
    pix(gx + 6, gy + 20, 8, 4, C.shadow);
    pix(gx + 8, gy, 4, 36, '#c5d0dc');
    pix(gx + 2, gy, 16, 6, '#8ab4d8');
    if (lattice > 0.6) {
      ctx.strokeStyle = 'rgba(120, 200, 255,' + (0.35 + Math.sin(time * 6) * 0.15) + ')';
      ctx.beginPath();
      ctx.arc(gx + 10, gy + 4, 40 + lattice * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawUfo() {
    if (quest === 'saved') return;
    var close = quest === 'build' ? 1 : quest === 'have' ? 0.55 : 0.25;
    var gx = 200 + Math.sin(time * 0.4) * 40 - cam.x * 0.08;
    var gy = 18 + (1 - close) * 16;
    pix(gx, gy + 4, 22, 6, '#8a94a8');
    pix(gx + 6, gy, 10, 6, '#c8d2e0');
    pix(gx + 8, gy + 2, 6, 3, quest === 'build' ? C.verm : C.accent);
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

  function drawFox(gx, gy, dir, walk) {
    var bob = walk ? (Math.floor(time * 10) % 2) : (Math.sin(time * 3) > 0.92 ? 1 : 0);
    shadow(gx, gy + bob, 12);
    var rows = dir === 3 ? FOX_UP : (dir === 0 ? FOX_DOWN : FOX_SIDE);
    blit(rows, gx + 1, gy + bob, PFOX, dir === 1);
    if (quest === 'have' || quest === 'build') pix(gx + 3, gy + 8 + bob, 7, 4, C.paper);
  }

  function drawPerson(kind, gx, gy) {
    var bob = Math.round(Math.sin(time * 2.2 + gx) * 1);
    shadow(gx, gy + bob, 12);
    if (kind === 'mira') {
      pix(gx + 3, gy + 6 + bob, 9, 8, '#4a6a88');
      pix(gx + 4, gy + 1 + bob, 7, 6, C.skin);
      pix(gx + 3, gy + bob, 9, 3, '#dce6f0');
      pix(gx + 6, gy + 3 + bob, 2, 2, C.ink);
    } else if (kind === 'rex') {
      pix(gx + 3, gy + 6 + bob, 9, 8, '#4a5440');
      pix(gx + 4, gy + 1 + bob, 7, 6, C.skin);
      pix(gx + 3, gy + bob, 9, 3, '#2f4a30');
      pix(gx + 6, gy + 3 + bob, 2, 2, C.ink);
    } else if (kind === 'dash') {
      pix(gx + 3, gy + 6 + bob, 9, 8, C.bus);
      pix(gx + 4, gy + 1 + bob, 7, 6, C.skin);
      pix(gx + 3, gy + bob, 9, 3, C.accent);
      pix(gx + 6, gy + 3 + bob, 2, 2, C.ink);
    } else {
      pix(gx + 4, gy + 7 + bob, 7, 6, '#7a5a70');
      pix(gx + 5, gy + 2 + bob, 6, 6, C.skin);
      pix(gx + 4, gy + 1 + bob, 7, 3, '#3a3048');
      pix(gx + 6, gy + 4 + bob, 2, 2, C.ink);
    }
  }

  function drawVehicle() {
    if (!ride.vehicle) return;
    var v = ride.vehicle;
    var gx = v.x - cam.x;
    var gy = v.y - cam.y;
    pix(gx, gy + 8, 28, 8, v.kind === 'bus' ? C.bus : C.taxi);
    pix(gx + 2, gy + 4, 8, 6, '#dce8f0');
    pix(gx + 12, gy + 4, 8, 6, '#dce8f0');
    pix(gx, gy + 14, 6, 4, '#2a2e38');
    pix(gx + 20, gy + 14, 6, 4, '#2a2e38');
  }

  function drawWorld() {
    var x, y;
    pix(0, 0, VW, VH, C.night);
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) drawTile(map[y][x], x * TILE, y * TILE, x, y);
    }
    poles.forEach(drawPole);
    buildings.forEach(drawBuilding);
    drawLattice();
    var list = npcs.map(function (e) {
      return { y: e.y, draw: function () { drawPerson(e.kind, e.x - cam.x, e.y - cam.y); } };
    });
    list.push({
      y: player.y,
      draw: function () { drawFox(player.x - cam.x, player.y - cam.y, player.dir, player.walk); }
    });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (e) { e.draw(); });
    drawVehicle();
    drawUfo();
    if (flash > 0) pix(0, 0, VW, VH, 'rgba(180,220,255,' + flash + ')');
  }

  function updateWorld(dt) {
    var spd = 76;
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
        setTimeout(openEnd, 700);
      }
    }

    near = null;
    var i, e, d;
    for (i = 0; i < npcs.length; i++) {
      e = npcs[i];
      d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
      if (d < 18) near = { kind: 'npc', e: e, text: 'Talk · ' + e.name };
    }
    for (i = 0; i < poles.length; i++) {
      e = poles[i];
      d = Math.abs(player.x - e.x) + Math.abs(player.y - e.y);
      if (d < 16) near = { kind: 'pole', e: e, text: 'Call · ' + (e.kind === 'bus' ? 'Bus' : 'Taxi') + ' · ' + e.name };
    }
    if (near) {
      ui.prompt.textContent = near.text;
      show(ui.prompt, true);
    } else show(ui.prompt, false);

    if (actEdge && near && !interactLock) {
      if (near.kind === 'npc') openTalk(near.e);
      else openPole(near.e);
    }
  }

  function openTalk(e) {
    refreshLines();
    talk.who = e.name;
    talk.lines = e.lines.slice();
    talk.i = 0;
    talk.after = function () {
      if (e.id === 'mira' && quest === 'idle') {
        quest = 'have';
        refreshLines();
        save();
        drawHud();
        beep(880, 0.1, 0.05, 'sine');
      }
      if (e.id === 'rex' && quest === 'have') {
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

  function takeRide(dest) {
    closePick();
    scene = 'ride';
    ride.vehicle = { kind: ride.pole.kind, x: player.x - 30, y: player.y };
    beep(180, 0.12, 0.04, 'triangle');
    setTimeout(function () {
      player.x = dest.x + 14;
      player.y = dest.y;
      cam.x = clamp(player.x - VW / 2 + 6, 0, COLS * TILE - VW);
      cam.y = clamp(player.y - VH / 2 + 8, 0, ROWS * TILE - VH);
      cam.tx = cam.x;
      cam.ty = cam.y;
      ride.vehicle = null;
      scene = 'world';
      interactLock = true;
      beep(640, 0.08, 0.04, 'sine');
    }, ride.pole.kind === 'taxi' ? 450 : 700);
  }

  function openEnd() {
    scene = 'end';
    show(ui.dialog, false);
    show(ui.card, false);
    show(ui.end, true);
    beep(392, 0.2, 0.05, 'sine');
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
    show(ui.pad, true);
    buildMap();
    bootEntities();
    if (quest === 'saved') {
      lattice = 1;
    } else if (quest === 'have') {
      lattice = 0;
    }
    drawHud();
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

  ui.start.addEventListener('click', begin);
  ui.again.addEventListener('click', function () {
    quest = 'idle';
    lattice = 0;
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
    if (scene === 'world' || scene === 'ride' || scene === 'build') {
      if (scene === 'world') updateWorld(dt);
      else {
        cam.x += (cam.tx - cam.x) * Math.min(1, dt * 7);
        cam.y += (cam.ty - cam.y) * Math.min(1, dt * 7);
        if (ride.vehicle) ride.vehicle.x += 90 * dt;
        if (quest === 'build') updateWorld(dt);
      }
      drawWorld();
    } else if (scene === 'dialog' || scene === 'pick') {
      drawWorld();
    } else if (scene === 'end') {
      drawWorld();
    } else if (scene === 'title') {
      cam.x = 180 + Math.sin(time * 0.2) * 16;
      cam.y = 200;
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
  drawHud();
  show(ui.pad, false);
  requestAnimationFrame(frame);
})();
