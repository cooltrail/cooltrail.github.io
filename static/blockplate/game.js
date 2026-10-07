const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const PLATE = 200;
const HILL = { x: -58, z: 42, radius: 16, height: 6.5 };
const BUMPS = Array.from({ length: 7 }, (_, i) => ({
  x: 46 + i * 5.5,
  z: -40,
  h: 0.2 + i * 0.11,
  len: 5.2,
}));
const BODY_W = 0.42;
const BODY_H = 1.05;
const BODY_D = 0.16;
const TRACK_RX = 30.5;
const TRACK_RY = 18.5;
const ROAD_HALF = 3.4;

const keys = new Set();
const pad = new Set();
let leaveQueued = false;

const canvas = document.getElementById("view");
const hint = document.getElementById("hint");
const boot = document.getElementById("boot");

function showError(message) {
  boot.textContent = message;
  boot.classList.remove("hidden");
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
  pad.clear();
});

function bindHold(button, dir) {
  const on = (event) => {
    event.preventDefault();
    pad.add(dir);
    button.setPointerCapture(event.pointerId);
  };
  const off = () => pad.delete(dir);
  button.addEventListener("pointerdown", on);
  button.addEventListener("pointerup", off);
  button.addEventListener("pointercancel", off);
  button.addEventListener("lostpointercapture", off);
}

document.querySelectorAll("[data-dir]").forEach((button) => {
  bindHold(button, button.dataset.dir);
});

document.getElementById("jump").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  leaveQueued = true;
});

function held(code, dir) {
  return keys.has(code) || pad.has(dir);
}

function studTexture(THREE) {
  const size = 64;
  const texCanvas = document.createElement("canvas");
  texCanvas.width = size;
  texCanvas.height = size;
  const ctx = texCanvas.getContext("2d");
  ctx.fillStyle = "#3c9636";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#4aaa42";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(18, 60, 16, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  const texture = new THREE.CanvasTexture(texCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(PLATE / 2, PLATE / 2);
  texture.anisotropy = 8;
  return texture;
}

function trackFrame(t, rx = TRACK_RX, ry = TRACK_RY) {
  const a = t * Math.PI * 2;
  const x = Math.cos(a) * rx;
  const z = -Math.sin(a) * ry;
  let tx = -Math.sin(a) * rx;
  let tz = -Math.cos(a) * ry;
  const len = Math.hypot(tx, tz) || 1;
  tx /= len;
  tz /= len;
  return {
    x,
    z,
    tx,
    tz,
    nx: -tz,
    nz: tx,
    yaw: Math.atan2(tx, tz),
  };
}

function ribbonGeometry(THREE, offset, halfWidth, y) {
  const segs = 96;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const frame = trackFrame(i / segs);
    const cx = frame.x + frame.nx * offset;
    const cz = frame.z + frame.nz * offset;
    positions.push(
      cx + frame.nx * halfWidth, y, cz + frame.nz * halfWidth,
      cx - frame.nx * halfWidth, y, cz - frame.nz * halfWidth,
    );
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function groundHeight(x, z) {
  let h = 0;
  const dx = x - HILL.x;
  const dz = z - HILL.z;
  const dist = Math.hypot(dx, dz);
  if (dist < HILL.radius) {
    const t = 1 - dist / HILL.radius;
    h = t * t * HILL.height;
  }
  for (const bump of BUMPS) {
    const bx = x - bump.x;
    const bz = z - bump.z;
    if (Math.abs(bz) > bump.len / 2 || Math.abs(bx) >= bump.h) continue;
    h = Math.max(h, Math.sqrt(bump.h * bump.h - bx * bx));
  }
  return h;
}

function checkerTexture(THREE) {
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 128;
  texCanvas.height = 32;
  const ctx = texCanvas.getContext("2d");
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 2; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#f4f4f4" : "#1a1a1a";
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const texture = new THREE.CanvasTexture(texCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function sampleStations(keys, count, smooth) {
  const z0 = keys[0].z;
  const z1 = keys[keys.length - 1].z;
  const fields = Object.keys(keys[0]).filter((key) => key !== "z");
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const z = z0 + ((z1 - z0) * i) / (count - 1);
    let seg = 0;
    while (seg < keys.length - 2 && z > keys[seg + 1].z) seg += 1;
    const span = keys[seg + 1].z - keys[seg].z || 1;
    const t = Math.min(1, Math.max(0, (z - keys[seg].z) / span));
    const i0 = Math.max(0, seg - 1);
    const i1 = seg;
    const i2 = seg + 1;
    const i3 = Math.min(keys.length - 1, seg + 2);
    const st = { z };
    for (const key of fields) {
      const raw = smooth
        ? catmull(keys[i0][key], keys[i1][key], keys[i2][key], keys[i3][key], t)
        : keys[i1][key] + (keys[i2][key] - keys[i1][key]) * t;
      const lo = Math.min(keys[i1][key], keys[i2][key]);
      const hi = Math.max(keys[i1][key], keys[i2][key]);
      const pad = (hi - lo) * 0.18 + 0.002;
      st[key] = Math.min(hi + pad, Math.max(lo - pad, raw));
    }
    st.hw = Math.max(0.05, st.hw);
    st.roof = Math.min(0.98, Math.max(0.16, st.roof));
    st.box = Math.max(0.45, st.box);
    if (st.ys < st.yb + 0.03) st.ys = st.yb + 0.03;
    if (st.yt < st.ys) st.yt = st.ys;
    out.push(st);
  }
  return out;
}

function crossSection(st, around, boxy) {
  const pts = [];
  const crown = st.crown || 0;
  for (let i = 0; i < around; i += 1) {
    const a = (i / around) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    if (boxy) {
      const p = Math.max(2.2, st.box);
      const ax = Math.abs(ca);
      const ay = Math.abs(sa);
      const denom = (ax ** p + ay ** p) ** (1 / p) || 1;
      const nx = ca / denom;
      const ny = sa / denom;
      const y = ny >= 0
        ? st.ys + (st.yt - st.ys) * ny
        : st.ys + (st.ys - st.yb) * ny;
      const taper = ny >= 0
        ? st.roof + (1 - st.roof) * (1 - Math.min(1, Math.abs(ny)))
        : 0.86 + 0.14 * (1 - Math.min(1, Math.abs(ny)));
      pts.push([nx * st.hw * taper, y]);
      continue;
    }
    const yBase = sa >= 0
      ? st.ys + (st.yt - st.ys) * Math.pow(sa, 0.78)
      : st.ys + (st.yb - st.ys) * Math.pow(-sa, 0.88);
    const shoulder = sa > 0
      ? Math.pow(Math.abs(ca), 0.5) * Math.pow(sa, 0.22) * (1 - sa * sa)
      : 0;
    const lift = sa >= 0 ? Math.pow(sa, st.box) : 0;
    const tuck = sa < 0 ? Math.pow(-sa, 1.15) : 0;
    const w = st.hw * (1 - lift * (1 - st.roof) - tuck * 0.16);
    pts.push([ca * Math.max(w, 0.04), yBase + crown * shoulder]);
  }
  return pts;
}

function loftMesh(THREE, keys, mat, opts = {}) {
  const around = opts.around ?? 32;
  const count = opts.slices ?? 40;
  const stations = sampleStations(keys, count, opts.smooth !== false);
  const positions = [];
  const indices = [];
  for (const st of stations) {
    for (const [x, y] of crossSection(st, around, !!opts.boxy)) positions.push(x, y, st.z);
  }
  for (let s = 0; s < count - 1; s += 1) {
    for (let i = 0; i < around; i += 1) {
      const i2 = (i + 1) % around;
      const a = s * around + i;
      const b = s * around + i2;
      const c = (s + 1) * around + i;
      const d = (s + 1) * around + i2;
      indices.push(a, b, d, a, d, c);
    }
  }
  const rearCenter = positions.length / 3;
  positions.push(0, stations[0].ys, stations[0].z);
  const frontCenter = positions.length / 3;
  positions.push(0, stations[count - 1].ys, stations[count - 1].z);
  const front = (count - 1) * around;
  for (let i = 0; i < around; i += 1) {
    const i2 = (i + 1) % around;
    indices.push(rearCenter, i2, i);
    indices.push(frontCenter, front + i, front + i2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function glassSheet(THREE, parent, mat, o) {
  const cols = o.cols ?? 14;
  const rows = o.rows ?? 8;
  const positions = [];
  const indices = [];
  const stride = cols + 1;
  for (let r = 0; r <= rows; r += 1) {
    const v = r / rows;
    const y = o.y0 + (o.y1 - o.y0) * v;
    const z = o.z0 + (o.z1 - o.z0) * v;
    const hw = o.hw0 + (o.hw1 - o.hw0) * v;
    for (let c = 0; c <= cols; c += 1) {
      const u = c / cols;
      const s = u * 2 - 1;
      const bow = Math.sin(u * Math.PI) * (o.bow ?? 0.04) * (0.35 + 0.65 * Math.sin(v * Math.PI));
      positions.push((o.x ?? 0) + s * hw, y + bow * (o.by ?? 0.15), z + bow);
    }
  }
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const a = r * stride + c;
      const b = a + 1;
      const d = a + stride;
      const e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  parent.add(mesh);
  return mesh;
}

function sideGlass(THREE, parent, mat, o) {
  const cols = o.cols ?? 10;
  const rows = o.rows ?? 6;
  const sign = o.x >= 0 ? 1 : -1;
  const positions = [];
  const indices = [];
  const stride = cols + 1;
  for (let r = 0; r <= rows; r += 1) {
    const v = r / rows;
    const y = o.y0 + (o.y1 - o.y0) * v;
    for (let c = 0; c <= cols; c += 1) {
      const u = c / cols;
      const z = o.z0 + (o.z1 - o.z0) * u;
      const bow = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * (o.bow ?? 0.035);
      positions.push(o.x + bow * sign, y, z);
    }
  }
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const a = r * stride + c;
      const b = a + 1;
      const d = a + stride;
      const e = d + 1;
      if (sign > 0) indices.push(a, d, b, b, d, e);
      else indices.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  parent.add(mesh);
  return mesh;
}

function put(THREE, parent, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function roundLamp(THREE, parent, mats, x, y, z, r, nz) {
  const lens = put(THREE, parent, new THREE.SphereGeometry(r, 18, 14), mats.lamp, x, y, z + nz * r * 0.2);
  lens.scale.set(1, 1, 0.45);
  const bezel = put(THREE, parent, new THREE.TorusGeometry(r * 1.05, r * 0.22, 8, 18), mats.chrome, x, y, z);
  return lens;
}

function tailLamp(THREE, parent, mat, x, y, z, r) {
  const lens = put(THREE, parent, new THREE.SphereGeometry(r, 16, 12), mat, x, y, z);
  lens.scale.set(1.15, 0.72, 0.4);
  return lens;
}

function mirror(THREE, parent, mat, x, y, z) {
  const stalk = put(THREE, parent, new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), mat, x, y, z);
  stalk.rotation.z = Math.PI / 2;
  const head = put(THREE, parent, new THREE.SphereGeometry(0.055, 12, 10), mat, x + Math.sign(x || 1) * 0.1, y + 0.02, z + 0.02);
  head.scale.set(1.5, 0.75, 0.65);
}

function windowPair(THREE, parent, glass, dark, spec) {
  glassSheet(THREE, parent, dark, { ...spec, bow: (spec.bow ?? 0.04) * 0.35 });
  glassSheet(THREE, parent, glass, spec);
}

function sideWindowPair(THREE, parent, glass, dark, spec) {
  sideGlass(THREE, parent, dark, { ...spec, bow: 0.012 });
  sideGlass(THREE, parent, glass, spec);
}

function wheelArch(THREE, parent, mat, x, y, z, radius) {
  const arch = put(THREE, parent, new THREE.TorusGeometry(radius * 1.04, 0.045, 8, 18, Math.PI), mat, x, y, z);
  arch.rotation.y = Math.PI / 2;
  arch.castShadow = true;
  return arch;
}

function lathe(THREE, points, segments) {
  const geo = new THREE.LatheGeometry(points.map((p) => new THREE.Vector2(p[0], p[1])), segments);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

function makeCar(THREE, color, kind = "911") {
  const spec = CAR_SPECS[kind] || CAR_SPECS["911"];
  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);
  const paint = carPaint(THREE, color, spec.paint);
  const dark = carPaint(THREE, 0x1a1e24, { roughness: 0.55, metalness: 0.08 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9ecfe4,
    roughness: 0.04,
    metalness: 0.08,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const lamp = new THREE.MeshStandardMaterial({
    color: 0xfff6d2,
    emissive: 0xffeab0,
    emissiveIntensity: 0.75,
    roughness: 0.18,
  });
  const tail = new THREE.MeshStandardMaterial({
    color: 0xc3251c,
    emissive: 0x8d140e,
    emissiveIntensity: 0.5,
    roughness: 0.32,
  });
  const chrome = carPaint(THREE, 0xd5dbe3, { roughness: 0.16, metalness: 0.82 });
  const rubber = carPaint(THREE, 0x1b1b1b, { roughness: 0.72, metalness: 0.02 });
  const rim = carPaint(THREE, 0xb7bec6, { roughness: 0.28, metalness: 0.7 });
  const mats = { paint, dark, glass, lamp, tail, chrome, rubber, rim, THREE };
  for (const shell of spec.shells) {
    chassis.add(loftMesh(THREE, shell.keys, shell.mat === "roof" ? carPaint(THREE, 0xf7f4ee, { roughness: 0.4, metalness: 0.08 }) : paint, shell.loft));
  }
  spec.dress(chassis, mats);

  const { radius, halfTrack, axle, tireWidth } = spec;
  const tireGeo = lathe(THREE, [
    [radius * 0.74, -tireWidth * 0.5],
    [radius * 0.9, -tireWidth * 0.4],
    [radius, -tireWidth * 0.16],
    [radius, tireWidth * 0.16],
    [radius * 0.9, tireWidth * 0.4],
    [radius * 0.74, tireWidth * 0.5],
  ], 36);
  const rimGeo = lathe(THREE, [
    [radius * 0.16, -tireWidth * 0.08],
    [radius * 0.58, -tireWidth * 0.1],
    [radius * 0.68, 0],
    [radius * 0.46, tireWidth * 0.16],
    [radius * 0.16, tireWidth * 0.2],
  ], 32);
  const hubGeo = new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, tireWidth * 0.22, 16);
  hubGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(tireWidth * 0.22, radius * 0.46, 0.028);
  const wheels = [];
  const spokes = spec.spokes ?? 5;
  for (const [x, z, front] of [[halfTrack, axle, true], [-halfTrack, axle, true], [halfTrack, -axle, false], [-halfTrack, -axle, false]]) {
    const steer = new THREE.Group();
    steer.position.set(x, radius, z);
    const strut = new THREE.Group();
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, rubber);
    tire.castShadow = true;
    spin.add(tire);
    const rimMesh = new THREE.Mesh(rimGeo, rim);
    spin.add(rimMesh);
    const hub = new THREE.Mesh(hubGeo, rim);
    hub.position.x = tireWidth * 0.12;
    spin.add(hub);
    for (let i = 0; i < spokes; i += 1) {
      const pivot = new THREE.Group();
      pivot.rotation.x = (i / spokes) * Math.PI * 2;
      const spoke = new THREE.Mesh(spokeGeo, rim);
      spoke.position.y = radius * 0.34;
      pivot.add(spoke);
      spin.add(pivot);
    }
    strut.add(spin);
    steer.add(strut);
    group.add(steer);
    wheels.push({ steer, strut, spin, radius, front, x, z });
  }
  group.userData.chassis = chassis;
  group.userData.wheels = wheels;
  return group;
}

const S = (z, hw, yb, ys, yt, roof, box, crown = 0) => ({ z, hw, yb, ys, yt, roof, box, crown });

const CAR_SPECS = {
  "911": {
    radius: 0.27,
    halfTrack: 0.86,
    axle: 1.05,
    tireWidth: 0.24,
    spokes: 5,
    shells: [{
      keys: [
        S(-1.8, 0.74, 0.3, 0.44, 0.5, 0.9, 1.55, 0.05),
        S(-1.55, 0.96, 0.27, 0.48, 0.56, 0.7, 1.35, 0.16),
        S(-1.18, 1.04, 0.26, 0.52, 0.58, 0.48, 1.25, 0.22),
        S(-0.75, 0.84, 0.26, 0.55, 0.92, 0.44, 1.5, 0.04),
        S(-0.25, 0.74, 0.27, 0.58, 1.04, 0.4, 1.6, 0),
        S(0.22, 0.74, 0.27, 0.5, 0.72, 0.55, 1.4, 0.02),
        S(0.7, 0.78, 0.26, 0.44, 0.48, 0.72, 1.25, 0.08),
        S(1.15, 0.9, 0.26, 0.4, 0.44, 0.62, 1.2, 0.18),
        S(1.55, 0.66, 0.29, 0.4, 0.42, 0.85, 1.45, 0.06),
        S(1.76, 0.42, 0.32, 0.38, 0.4, 0.92, 1.8, 0),
      ],
    }],
    dress(chassis, m) {
      windowPair(m.THREE, chassis, m.glass, m.dark, { y0: 0.52, z0: 0.62, y1: 0.98, z1: -0.02, hw0: 0.56, hw1: 0.34, bow: 0.08, rows: 8, cols: 16 });
      glassSheet(m.THREE, chassis, m.dark, { y0: 0.78, z0: -0.18, y1: 0.58, z1: -1.05, hw0: 0.38, hw1: 0.52, bow: 0.02, rows: 6, cols: 12 });
      glassSheet(m.THREE, chassis, m.glass, { y0: 0.8, z0: -0.16, y1: 0.6, z1: -1.08, hw0: 0.36, hw1: 0.5, bow: 0.05, rows: 6, cols: 12 });
      for (const x of [0.76, -0.76]) {
        sideWindowPair(m.THREE, chassis, m.glass, m.dark, { x, y0: 0.58, z0: 0.12, y1: 0.92, z1: -0.28, bow: 0.035, rows: 6, cols: 10 });
        const frontDoor = put(m.THREE, chassis, new m.THREE.BoxGeometry(0.015, 0.32, 0.018), m.dark, x, 0.52, 0.28);
        frontDoor.castShadow = false;
        const rearDoor = put(m.THREE, chassis, new m.THREE.BoxGeometry(0.015, 0.28, 0.018), m.dark, x, 0.5, -0.42);
        rearDoor.castShadow = false;
      }
      for (const x of [-0.5, 0.5]) roundLamp(m.THREE, chassis, m, x, 0.5, 1.58, 0.1, 1);
      const shut = put(m.THREE, chassis, new m.THREE.BoxGeometry(1.15, 0.012, 0.02), m.dark, 0, 0.5, 0.78);
      shut.castShadow = false;
      const bar = put(m.THREE, chassis, new m.THREE.BoxGeometry(1.42, 0.07, 0.045, 12, 1, 1), m.tail, 0, 0.48, -1.76);
      bar.castShadow = false;
      for (const x of [-0.66, 0.66]) tailLamp(m.THREE, chassis, m.tail, x, 0.48, -1.74, 0.08);
      const lip = put(m.THREE, chassis, new m.THREE.BoxGeometry(1.55, 0.05, 0.34, 12, 1, 3), m.paint, 0, 0.68, -1.66);
      lip.rotation.x = -0.22;
      lip.castShadow = true;
      for (const x of [-0.78, 0.78]) mirror(m.THREE, chassis, m.chrome, x, 0.7, 0.22);
      for (const x of [-0.22, 0.22]) {
        const pipe = put(m.THREE, chassis, new m.THREE.CylinderGeometry(0.035, 0.04, 0.12, 12), m.chrome, x, 0.32, -1.78);
        pipe.rotation.x = Math.PI / 2;
      }
      const skirt = put(m.THREE, chassis, new m.THREE.BoxGeometry(1.35, 0.06, 1.7), m.dark, 0, 0.28, -0.1);
      skirt.castShadow = true;
    },
  },
  jeep: {
    radius: 0.38,
    halfTrack: 0.9,
    axle: 1.02,
    tireWidth: 0.28,
    spokes: 5,
    shells: [{
      loft: { around: 28, slices: 32, boxy: true },
      keys: [
        S(-1.45, 0.62, 0.55, 0.78, 1.02, 0.9, 7),
        S(-0.7, 0.78, 0.52, 0.86, 1.12, 0.88, 8),
        S(0.15, 0.8, 0.52, 0.88, 1.16, 0.88, 8),
        S(0.85, 0.76, 0.5, 0.8, 0.92, 0.92, 6),
        S(1.35, 0.7, 0.48, 0.66, 0.7, 0.94, 5),
      ],
    }],
    dress(chassis, m) {
      const hood = loftMesh(m.THREE, [
        S(0.55, 0.7, 0.62, 0.78, 0.84, 0.9, 3),
        S(1.15, 0.68, 0.58, 0.7, 0.74, 0.94, 2.6),
        S(1.48, 0.6, 0.55, 0.64, 0.66, 0.96, 2.4),
      ], m.paint, { around: 20, slices: 16, boxy: true });
      chassis.add(hood);
      glassSheet(m.THREE, chassis, m.dark, { y0: 0.78, z0: 0.72, y1: 1.28, z1: 0.5, hw0: 0.62, hw1: 0.58, bow: 0.012, rows: 6, cols: 10 });
      glassSheet(m.THREE, chassis, m.glass, { y0: 0.8, z0: 0.74, y1: 1.32, z1: 0.52, hw0: 0.6, hw1: 0.56, bow: 0.02, rows: 8, cols: 12 });
      const barPath = new m.THREE.CatmullRomCurve3([
        new m.THREE.Vector3(-0.62, 1.05, -0.15),
        new m.THREE.Vector3(-0.62, 1.58, -0.15),
        new m.THREE.Vector3(0, 1.62, -0.15),
        new m.THREE.Vector3(0.62, 1.58, -0.15),
        new m.THREE.Vector3(0.62, 1.05, -0.15),
      ]);
      const cage = new m.THREE.Mesh(new m.THREE.TubeGeometry(barPath, 28, 0.035, 8, false), m.dark);
      cage.castShadow = true;
      chassis.add(cage);
      put(m.THREE, chassis, new m.THREE.BoxGeometry(0.66, 0.34, 0.04), m.dark, 0, 0.72, 1.5);
      for (let i = 0; i < 7; i += 1) {
        put(m.THREE, chassis, new m.THREE.BoxGeometry(0.035, 0.3, 0.03), m.paint, -0.24 + i * 0.08, 0.72, 1.53);
      }
      for (const x of [-0.42, 0.42]) roundLamp(m.THREE, chassis, m, x, 0.78, 1.46, 0.1, 1);
      const spareTire = lathe(m.THREE, [
        [0.22, -0.05], [0.3, -0.04], [0.34, 0], [0.3, 0.04], [0.22, 0.05],
      ], 24);
      const spare = put(m.THREE, chassis, spareTire, m.rubber, 0, 1.05, -1.48);
      spare.rotation.y = Math.PI / 2;
      spare.castShadow = true;
      for (const x of [-0.86, 0.86]) {
        wheelArch(m.THREE, chassis, m.paint, x, 0.38, 1.02, 0.38);
        wheelArch(m.THREE, chassis, m.paint, x, 0.38, -1.02, 0.38);
        mirror(m.THREE, chassis, m.chrome, x, 1.05, 0.45);
      }
      const bumper = put(m.THREE, chassis, new m.THREE.CapsuleGeometry(0.06, 1.15, 6, 12), m.chrome, 0, 0.58, 1.52);
      bumper.rotation.z = Math.PI / 2;
    },
  },
  bus: {
    radius: 0.32,
    halfTrack: 0.82,
    axle: 1.28,
    tireWidth: 0.22,
    spokes: 6,
    shells: [
      {
        loft: { around: 24, slices: 34, boxy: true },
        keys: [
          S(-1.72, 0.55, 0.48, 0.9, 1.48, 0.94, 8),
          S(-1.2, 0.84, 0.42, 1.05, 1.58, 0.92, 9),
          S(0, 0.86, 0.42, 1.08, 1.62, 0.92, 9),
          S(1.15, 0.84, 0.42, 1.02, 1.5, 0.94, 8),
          S(1.55, 0.62, 0.46, 0.85, 1.15, 0.94, 5),
          S(1.78, 0.28, 0.5, 0.7, 0.82, 0.9, 3.2),
        ],
      },
      {
        mat: "roof",
        loft: { around: 20, slices: 24, boxy: true },
        keys: [
          S(-1.45, 0.7, 1.42, 1.55, 1.72, 0.9, 3.2),
          S(0.2, 0.74, 1.45, 1.58, 1.76, 0.88, 3.4),
          S(1.35, 0.58, 1.35, 1.48, 1.6, 0.9, 2.8),
        ],
      },
    ],
    dress(chassis, m) {
      windowPair(m.THREE, chassis, m.glass, m.dark, { x: -0.34, y0: 1.05, z0: 1.58, y1: 1.48, z1: 1.42, hw0: 0.28, hw1: 0.26, bow: 0.03, rows: 6, cols: 6 });
      windowPair(m.THREE, chassis, m.glass, m.dark, { x: 0.34, y0: 1.05, z0: 1.58, y1: 1.48, z1: 1.42, hw0: 0.28, hw1: 0.26, bow: 0.03, rows: 6, cols: 6 });
      for (const x of [-0.9, 0.9]) {
        for (const z of [-1.05, -0.45, 0.15, 0.75]) {
          sideWindowPair(m.THREE, chassis, m.glass, m.dark, { x, y0: 1.05, y1: 1.42, z0: z - 0.18, z1: z + 0.18, bow: 0.025, rows: 4, cols: 4 });
        }
        mirror(m.THREE, chassis, m.chrome, x, 1.15, 1.15);
      }
      for (const x of [-0.48, 0.48]) roundLamp(m.THREE, chassis, m, x, 0.7, 1.7, 0.09, 1);
      const bumper = put(m.THREE, chassis, new m.THREE.CapsuleGeometry(0.07, 1.2, 6, 12), m.chrome, 0, 0.52, 1.72);
      bumper.rotation.z = Math.PI / 2;
      const rear = put(m.THREE, chassis, new m.THREE.CapsuleGeometry(0.06, 1.15, 4, 10), m.chrome, 0, 0.55, -1.74);
      rear.rotation.z = Math.PI / 2;
    },
  },
  beetle: {
    radius: 0.26,
    halfTrack: 0.7,
    axle: 0.78,
    tireWidth: 0.18,
    spokes: 5,
    shells: [{
      loft: { around: 30, slices: 36 },
      keys: [
        S(-1.2, 0.28, 0.4, 0.48, 0.54, 0.75, 1.4),
        S(-0.72, 0.5, 0.32, 0.54, 0.82, 0.62, 1.05),
        S(-0.15, 0.52, 0.32, 0.58, 0.98, 0.58, 0.95),
        S(0.3, 0.52, 0.32, 0.56, 0.92, 0.6, 0.95),
        S(0.75, 0.46, 0.34, 0.5, 0.66, 0.7, 1.15),
        S(1.18, 0.26, 0.4, 0.46, 0.5, 0.8, 1.5),
      ],
    }],
    dress(chassis, m) {
      const blister = new m.THREE.SphereGeometry(1, 22, 16);
      for (const z of [-0.62, 0.68]) {
        for (const x of [-0.58, 0.58]) {
          const fender = put(m.THREE, chassis, blister, m.paint, x, 0.46, z);
          fender.scale.set(0.26, 0.18, 0.46);
          fender.castShadow = true;
        }
      }
      for (const x of [-0.52, 0.52]) {
        const board = put(m.THREE, chassis, new m.THREE.BoxGeometry(0.08, 0.05, 0.7, 1, 1, 6), m.dark, x, 0.34, 0.05);
        board.castShadow = true;
      }
      windowPair(m.THREE, chassis, m.glass, m.dark, { y0: 0.58, z0: 0.62, y1: 1.05, z1: 0.02, hw0: 0.42, hw1: 0.26, bow: 0.08, rows: 8, cols: 14 });
      glassSheet(m.THREE, chassis, m.glass, { y0: 0.9, z0: -0.15, y1: 0.62, z1: -0.62, hw0: 0.3, hw1: 0.36, bow: 0.04, rows: 6, cols: 10 });
      for (const x of [-0.42, 0.42]) {
        roundLamp(m.THREE, chassis, m, x, 0.5, 1.05, 0.09, 1);
        sideWindowPair(m.THREE, chassis, m.glass, m.dark, { x: x > 0 ? 0.5 : -0.5, y0: 0.68, y1: 0.98, z0: 0.15, z1: -0.2, bow: 0.03, rows: 5, cols: 6 });
      }
      for (const x of [-0.32, 0.32]) tailLamp(m.THREE, chassis, m.tail, x, 0.5, -1.12, 0.055);
    },
  },
  wedge: {
    radius: 0.26,
    halfTrack: 0.92,
    axle: 1.15,
    tireWidth: 0.26,
    spokes: 5,
    shells: [{
      loft: { around: 28, slices: 46, boxy: true },
      keys: [
        S(-1.9, 0.5, 0.24, 0.34, 0.4, 0.92, 6),
        S(-1.25, 0.98, 0.2, 0.38, 0.48, 0.9, 7),
        S(-0.35, 0.94, 0.2, 0.36, 0.52, 0.82, 6),
        S(0.15, 0.82, 0.2, 0.34, 0.72, 0.55, 3.2),
        S(0.6, 0.92, 0.2, 0.32, 0.4, 0.92, 6),
        S(1.35, 0.8, 0.2, 0.28, 0.32, 0.96, 8),
        S(1.9, 0.16, 0.22, 0.26, 0.28, 0.94, 4),
      ],
    }],
    dress(chassis, m) {
      windowPair(m.THREE, chassis, m.glass, m.dark, { y0: 0.36, z0: 0.48, y1: 0.66, z1: 0.12, hw0: 0.48, hw1: 0.28, bow: 0.03, rows: 6, cols: 12 });
      for (let i = 0; i < 10; i += 1) {
        const slat = put(m.THREE, chassis, new m.THREE.BoxGeometry(1.2, 0.018, 0.07), m.dark, 0, 0.5, -0.45 - i * 0.12);
        slat.rotation.x = 0.2;
      }
      const wing = put(m.THREE, chassis, new m.THREE.BoxGeometry(1.65, 0.025, 0.32, 8, 1, 2), m.paint, 0, 0.78, -1.55);
      wing.castShadow = true;
      for (const x of [-0.55, 0.55]) {
        const pillar = put(m.THREE, chassis, new m.THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), m.dark, x, 0.64, -1.55);
        pillar.castShadow = true;
      }
      for (const x of [-0.55, 0.55]) {
        const pop = put(m.THREE, chassis, new m.THREE.BoxGeometry(0.22, 0.06, 0.1, 1, 1, 2), m.lamp, x, 0.34, 1.55);
        pop.rotation.x = 0.4;
      }
      for (const x of [-0.7, 0.7]) tailLamp(m.THREE, chassis, m.tail, x, 0.36, -1.82, 0.05);
      for (const x of [-0.95, 0.95]) mirror(m.THREE, chassis, m.chrome, x, 0.42, 0.35);
    },
  },
  f150: {
    radius: 0.36,
    halfTrack: 0.86,
    axle: 1.22,
    tireWidth: 0.28,
    spokes: 6,
    shells: [
      {
        loft: { around: 24, slices: 28, boxy: true, smooth: false },
        keys: [
          S(-1.9, 0.72, 0.48, 0.7, 0.86, 0.94, 8),
          S(-0.9, 0.84, 0.46, 0.74, 0.9, 0.94, 9),
          S(0.2, 0.8, 0.48, 0.72, 0.84, 0.94, 8),
        ],
      },
      {
        loft: { around: 24, slices: 30, boxy: true, smooth: false },
        keys: [
          S(0.05, 0.8, 0.55, 0.95, 1.48, 0.9, 8),
          S(0.75, 0.82, 0.52, 0.98, 1.5, 0.9, 9),
          S(1.2, 0.8, 0.5, 0.82, 1.05, 0.94, 7),
          S(1.75, 0.78, 0.46, 0.64, 0.68, 0.96, 6),
          S(2.08, 0.68, 0.44, 0.56, 0.58, 0.98, 5),
        ],
      },
    ],
    dress(chassis, m) {
      const bed = put(m.THREE, chassis, new m.THREE.BoxGeometry(1.35, 0.12, 1.7, 1, 1, 4), m.dark, 0, 0.78, -0.85);
      bed.receiveShadow = true;
      windowPair(m.THREE, chassis, m.glass, m.dark, { y0: 1.02, z0: 1.22, y1: 1.42, z1: 0.78, hw0: 0.66, hw1: 0.58, bow: 0.025, rows: 6, cols: 12 });
      for (const x of [-0.84, 0.84]) {
        sideWindowPair(m.THREE, chassis, m.glass, m.dark, { x, y0: 1.05, y1: 1.38, z0: 1.0, z1: 0.35, bow: 0.03, rows: 5, cols: 8 });
        mirror(m.THREE, chassis, m.chrome, x, 1.12, 1.05);
        wheelArch(m.THREE, chassis, m.paint, x, 0.36, 1.22, 0.36);
        wheelArch(m.THREE, chassis, m.paint, x, 0.36, -1.22, 0.36);
      }
      put(m.THREE, chassis, new m.THREE.BoxGeometry(0.9, 0.32, 0.04), m.dark, 0, 0.72, 2.02);
      for (let i = 0; i < 5; i += 1) {
        put(m.THREE, chassis, new m.THREE.BoxGeometry(0.04, 0.28, 0.025), m.chrome, -0.28 + i * 0.14, 0.72, 2.05);
      }
      for (const x of [-0.55, 0.55]) {
        const lamp = put(m.THREE, chassis, new m.THREE.BoxGeometry(0.28, 0.12, 0.06, 2, 2, 1), m.lamp, x, 0.62, 2.02);
        lamp.castShadow = false;
      }
      const bumper = put(m.THREE, chassis, new m.THREE.CapsuleGeometry(0.08, 1.35, 6, 14), m.chrome, 0, 0.5, 2.08);
      bumper.rotation.z = Math.PI / 2;
      for (const x of [-0.6, 0.6]) tailLamp(m.THREE, chassis, m.tail, x, 0.72, -1.88, 0.06);
    },
  },
  cyber: {
    radius: 0.34,
    halfTrack: 0.92,
    axle: 1.25,
    tireWidth: 0.24,
    spokes: 7,
    paint: { roughness: 0.38, metalness: 0.55 },
    shells: [{
      loft: { around: 24, slices: 32, smooth: false, boxy: true },
      keys: [
        S(-1.95, 0.78, 0.4, 0.72, 1.22, 0.98, 12),
        S(-1.15, 0.96, 0.36, 0.8, 1.35, 0.98, 14),
        S(-0.15, 0.94, 0.34, 0.7, 0.98, 0.98, 12),
        S(0.75, 0.9, 0.32, 0.58, 0.7, 0.99, 12),
        S(1.5, 0.82, 0.32, 0.46, 0.5, 0.99, 10),
        S(1.98, 0.28, 0.34, 0.4, 0.42, 0.99, 8),
      ],
    }],
    dress(chassis, m) {
      glassSheet(m.THREE, chassis, m.dark, { y0: 0.58, z0: 1.15, y1: 1.05, z1: 0.15, hw0: 0.78, hw1: 0.7, bow: 0.01, rows: 8, cols: 16 });
      glassSheet(m.THREE, chassis, m.glass, { y0: 0.6, z0: 1.2, y1: 1.08, z1: 0.18, hw0: 0.76, hw1: 0.68, bow: 0.02, rows: 10, cols: 18 });
      const bar = put(m.THREE, chassis, new m.THREE.BoxGeometry(1.25, 0.04, 0.04, 16, 1, 1), m.lamp, 0, 0.5, 1.48);
      bar.castShadow = false;
      for (const x of [-0.95, 0.95]) {
        wheelArch(m.THREE, chassis, m.dark, x, 0.34, 1.25, 0.36);
        wheelArch(m.THREE, chassis, m.dark, x, 0.34, -1.25, 0.36);
      }
      for (const z of [-0.4, 0.45]) {
        put(m.THREE, chassis, new m.THREE.BoxGeometry(1.7, 0.012, 0.02), m.dark, 0, 0.62, z);
      }
      for (const x of [-0.7, 0.7]) tailLamp(m.THREE, chassis, m.tail, x, 0.62, -1.9, 0.05);
    },
  },
};

function plainMaterial(THREE, color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.02,
  });
}

function carPaint(THREE, color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.32,
    metalness: opts.metalness ?? 0.2,
    flatShading: !!opts.flat,
  });
}

async function main() {
  const THREE = await import(THREE_URL);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec8f2);
  scene.fog = new THREE.Fog(0x8ec8f2, 70, 210);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 420);

  scene.add(new THREE.HemisphereLight(0xd7ecff, 0x3d6b32, 0.85));

  const sun = new THREE.DirectionalLight(0xfff3d6, 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 36;
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE, 2, PLATE),
    new THREE.MeshStandardMaterial({
      map: studTexture(THREE),
      roughness: 0.9,
      metalness: 0,
    }),
  );
  plate.position.y = -1;
  plate.receiveShadow = true;
  scene.add(plate);

  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE + 1.2, 1.2, PLATE + 1.2),
    plainMaterial(THREE, 0x2f6e2c),
  );
  lip.position.y = -1.7;
  lip.receiveShadow = true;
  scene.add(lip);

  const asphalt = new THREE.Mesh(
    ribbonGeometry(THREE, 0, ROAD_HALF, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide }),
  );
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf3f0e6, roughness: 0.8, side: THREE.DoubleSide });
  for (const offset of [ROAD_HALF - 0.22, -(ROAD_HALF - 0.22)]) {
    const line = new THREE.Mesh(ribbonGeometry(THREE, offset, 0.1, 0.1), lineMat);
    line.receiveShadow = true;
    scene.add(line);
  }

  const curbGeo = new THREE.BoxGeometry(0.42, 0.16, 2.15);
  for (let i = 0; i < 56; i += 1) {
    const frame = trackFrame(i / 56);
    const curb = new THREE.Mesh(curbGeo, plainMaterial(THREE, i % 2 === 0 ? 0xd94a32 : 0xf4f4f4));
    const out = ROAD_HALF + 0.28;
    curb.position.set(frame.x + frame.nx * out, 0.14, frame.z + frame.nz * out);
    curb.rotation.y = frame.yaw;
    curb.receiveShadow = true;
    scene.add(curb);
  }

  const start = trackFrame(0);
  const finish = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_HALF * 2 - 0.3, 0.03, 0.55),
    new THREE.MeshStandardMaterial({ map: checkerTexture(THREE), roughness: 0.7 }),
  );
  finish.position.set(start.x, 0.12, start.z);
  finish.rotation.y = start.yaw;
  finish.receiveShadow = true;
  scene.add(finish);

  const bumpRoad = new THREE.Mesh(
    new THREE.BoxGeometry(44, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.9 }),
  );
  bumpRoad.position.set(62, 0.05, -40);
  bumpRoad.receiveShadow = true;
  scene.add(bumpRoad);
  const bumpGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
  bumpGeo.rotateX(Math.PI / 2);
  for (const bump of BUMPS) {
    const mesh = new THREE.Mesh(bumpGeo, plainMaterial(THREE, 0xd7d2c8));
    mesh.scale.set(bump.h, bump.h, bump.len);
    mesh.position.set(bump.x, 0, bump.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const hillGeo = new THREE.PlaneGeometry(HILL.radius * 2, HILL.radius * 2, 40, 40);
  hillGeo.rotateX(-Math.PI / 2);
  const hillPos = hillGeo.attributes.position;
  for (let i = 0; i < hillPos.count; i += 1) {
    const lx = hillPos.getX(i);
    const lz = hillPos.getZ(i);
    const dist = Math.hypot(lx, lz);
    const t = dist < HILL.radius ? 1 - dist / HILL.radius : 0;
    hillPos.setY(i, t * t * HILL.height);
  }
  hillGeo.computeVertexNormals();
  const hill = new THREE.Mesh(hillGeo, plainMaterial(THREE, 0xa07848));
  hill.position.set(HILL.x, 0.04, HILL.z);
  hill.receiveShadow = true;
  hill.castShadow = true;
  scene.add(hill);

  const racers = [
    { t: 0.02, speed: 0.046, lane: 1.05, color: 0xf4f4f4, kind: "wedge" },
    { t: 0.22, speed: 0.03, lane: -1.05, color: 0x2f6fed, kind: "f150" },
    { t: 0.45, speed: 0.04, lane: 1.05, color: 0xf4d03f, kind: "beetle" },
    { t: 0.66, speed: 0.028, lane: -1.05, color: 0x2e7d32, kind: "jeep" },
    { t: 0.84, speed: 0.034, lane: 1.05, color: 0xc0392b, kind: "bus" },
  ].map((racer) => {
    const mesh = makeCar(THREE, racer.color, racer.kind);
    scene.add(mesh);
    return { ...racer, mesh, base: racer.speed };
  });

  const parked = [
    { x: 40, z: -48, yaw: Math.PI / 2, color: 0xc5ccd6, kind: "cyber" },
    { x: -42, z: 26, yaw: 0.6, color: 0x1a1a1a, kind: "911" },
    { x: 70, z: -52, yaw: -0.4, color: 0xf1c40f, kind: "jeep" },
  ].map((spot) => {
    const mesh = makeCar(THREE, spot.color, spot.kind);
    mesh.position.set(spot.x, 0.02, spot.z);
    mesh.rotation.y = spot.yaw;
    scene.add(mesh);
    return mesh;
  });

  const side = plainMaterial(THREE, 0xf2c14e);
  const top = plainMaterial(THREE, 0xf6d56a);
  const bottom = plainMaterial(THREE, 0xc9962e);
  const block = new THREE.Mesh(new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D), [
    side, side, top, bottom, side, side,
  ]);
  block.castShadow = true;
  block.receiveShadow = true;

  const spawn = trackFrame(0.08);
  const car = makeCar(THREE, 0xe67e22, "911");
  block.position.set(0, 0.72, -0.02);
  block.visible = false;
  car.add(block);
  car.position.set(spawn.x, 0.02, spawn.z);
  car.rotation.y = spawn.yaw;
  scene.add(car);

  let driving = true;
  let heading = spawn.yaw;
  let carSpeed = 0;
  let spaceWasDown = false;
  const ride = { vel: 0, pitch: 0, roll: 0, pVel: 0, rVel: 0 };
  const velocity = new THREE.Vector3();
  const actBtn = document.getElementById("jump");
  let yaw = 0;
  let pitch = 0.38;
  const distance = 9.5;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    yaw -= dx * 0.005;
    pitch = Math.min(1.15, Math.max(0.18, pitch + dy * 0.004));
  });
  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener("resize", resize);
  resize();

  const look = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const edge = PLATE / 2 - 1.8;
  const clock = new THREE.Clock();

  function nearCar() {
    const dx = block.position.x - car.position.x;
    const dz = block.position.z - car.position.z;
    return dx * dx + dz * dz < 3.2 * 3.2;
  }

  function exitCar() {
    carSpeed = 0;
    const rx = Math.cos(heading);
    const rz = -Math.sin(heading);
    car.updateMatrixWorld();
    scene.attach(block);
    const bx = car.position.x + rx * 1.6;
    const bz = car.position.z + rz * 1.6;
    block.position.set(bx, groundHeight(bx, bz) + BODY_H / 2, bz);
    block.rotation.set(0, 0, 0);
    block.visible = true;
    velocity.set(0, 0, 0);
    driving = false;
    actBtn.textContent = "In";
    actBtn.setAttribute("aria-label", "Get in");
  }

  function enterCar() {
    scene.updateMatrixWorld();
    car.attach(block);
    block.position.set(0, 0.72, -0.02);
    block.rotation.set(0, 0, 0);
    block.visible = false;
    driving = true;
    actBtn.textContent = "Out";
    actBtn.setAttribute("aria-label", "Get out");
  }

  function pushBlock(mesh, meshYaw) {
    const dx = block.position.x - mesh.position.x;
    const dz = block.position.z - mesh.position.z;
    const rx = Math.cos(meshYaw);
    const rz = -Math.sin(meshYaw);
    const fx = Math.sin(meshYaw);
    const fz = Math.cos(meshYaw);
    const localX = dx * rx + dz * rz;
    const localZ = dx * fx + dz * fz;
    const limitX = 0.85 + 0.3;
    const limitZ = 1.65 + 0.3;
    if (Math.abs(localX) >= limitX || Math.abs(localZ) >= limitZ) return;
    const pushX = limitX - Math.abs(localX);
    const pushZ = limitZ - Math.abs(localZ);
    if (pushX < pushZ) {
      const sign = Math.sign(localX) || 1;
      block.position.x += rx * sign * pushX;
      block.position.z += rz * sign * pushX;
    } else {
      const sign = Math.sign(localZ) || 1;
      block.position.x += fx * sign * pushZ;
      block.position.z += fz * sign * pushZ;
    }
  }

  function suspendCar(mesh, meshYaw, dt) {
    const wheels = mesh.userData.wheels;
    const fx = Math.sin(meshYaw);
    const fz = Math.cos(meshYaw);
    const rx = Math.cos(meshYaw);
    const rz = -Math.sin(meshYaw);
    const samples = wheels.map((wheel) => {
      const x = mesh.position.x + rx * wheel.x + fx * wheel.z;
      const z = mesh.position.z + rz * wheel.x + fz * wheel.z;
      return groundHeight(x, z);
    });
    const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    ride.vel += (avg - mesh.position.y) * 78 * dt;
    ride.vel *= Math.exp(-4.4 * dt);
    mesh.position.y += ride.vel * dt;

    const front = (samples[0] + samples[1]) / 2;
    const back = (samples[2] + samples[3]) / 2;
    const left = (samples[1] + samples[3]) / 2;
    const right = (samples[0] + samples[2]) / 2;
    const targetPitch = Math.atan2(front - back, 2.2);
    const targetRoll = Math.atan2(left - right, 1.6);
    ride.pVel += (targetPitch - ride.pitch) * 46 * dt;
    ride.rVel += (targetRoll - ride.roll) * 46 * dt;
    ride.pVel *= Math.exp(-5 * dt);
    ride.rVel *= Math.exp(-5 * dt);
    ride.pitch += ride.pVel * dt;
    ride.roll += ride.rVel * dt;
    mesh.userData.chassis.rotation.x = -ride.pitch;
    mesh.userData.chassis.rotation.z = -ride.roll;

    for (let i = 0; i < wheels.length; i += 1) {
      wheels[i].strut.position.y = Math.max(-0.42, Math.min(0.26, samples[i] - mesh.position.y));
    }
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (keys.has("KeyQ")) yaw += dt * 1.4;
    if (keys.has("KeyE")) yaw -= dt * 1.4;

    const spaceDown = keys.has("Space");
    if ((spaceDown && !spaceWasDown) || leaveQueued) {
      if (driving) exitCar();
      else if (nearCar()) enterCar();
    }
    spaceWasDown = spaceDown;
    leaveQueued = false;

    const gas = held("KeyW", "up") || keys.has("ArrowUp");
    const braking = held("KeyS", "down") || keys.has("ArrowDown");
    const steerLeft = held("KeyA", "left") || keys.has("ArrowLeft");
    const steerRight = held("KeyD", "right") || keys.has("ArrowRight");

    if (driving) {
      if (gas && !braking) carSpeed += 32 * dt;
      else if (braking) carSpeed -= 42 * dt;
      else carSpeed *= Math.exp(-2.4 * dt);
      carSpeed = Math.min(18, Math.max(-7, carSpeed));
      if (Math.abs(carSpeed) < 0.05 && !gas && !braking) carSpeed = 0;
    }

    const steerInput = (steerRight ? 1 : 0) - (steerLeft ? 1 : 0);
    if (driving) {
      const speedFactor = Math.min(1, Math.max(0.28, Math.abs(carSpeed) / 10));
      heading += steerInput * 2.15 * speedFactor * Math.sign(carSpeed || 1) * dt;

      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      car.position.x += fx * carSpeed * dt;
      car.position.z += fz * carSpeed * dt;
      if (Math.abs(car.position.x) > edge) {
        car.position.x = Math.sign(car.position.x) * edge;
        carSpeed *= 0.35;
      }
      if (Math.abs(car.position.z) > edge) {
        car.position.z = Math.sign(car.position.z) * edge;
        carSpeed *= 0.35;
      }
      car.rotation.y = heading;
      suspendCar(car, heading, dt);
      for (const wheel of car.userData.wheels) {
        if (wheel.front) wheel.steer.rotation.y = steerInput * 0.5;
        wheel.spin.rotation.x += (carSpeed * dt) / wheel.radius;
      }
    }

    for (const racer of racers) {
      let speed = racer.base;
      for (const other of racers) {
        if (other === racer || Math.sign(other.lane) !== Math.sign(racer.lane)) continue;
        let gap = other.t - racer.t;
        if (gap < -0.5) gap += 1;
        if (gap > 0.5) gap -= 1;
        if (gap > 0 && gap < 0.07) speed *= 0.45;
      }
      racer.speed += (speed - racer.speed) * Math.min(1, dt * 3);
      racer.t = (racer.t + racer.speed * dt) % 1;
      const pose = trackFrame(racer.t);
      racer.mesh.position.set(
        pose.x + pose.nx * racer.lane,
        0.08,
        pose.z + pose.nz * racer.lane,
      );
      racer.mesh.rotation.y = pose.yaw;
      racer.mesh.position.y = 0.02;
      const travel = racer.speed * 155;
      for (const wheel of racer.mesh.userData.wheels) {
        wheel.spin.rotation.x += (travel * dt) / wheel.radius;
      }
    }

    if (driving) {
      let bumped = false;
      const others = racers.map((racer) => racer.mesh).concat(parked);
      for (const mesh of others) {
        const meshYaw = mesh.rotation.y;
        const dx = car.position.x - mesh.position.x;
        const dz = car.position.z - mesh.position.z;
        const rx = Math.cos(meshYaw);
        const rz = -Math.sin(meshYaw);
        const fx = Math.sin(meshYaw);
        const fz = Math.cos(meshYaw);
        const localX = dx * rx + dz * rz;
        const localZ = dx * fx + dz * fz;
        const limitX = 1.7;
        const limitZ = 3.3;
        if (Math.abs(localX) >= limitX || Math.abs(localZ) >= limitZ) continue;
        const pushX = limitX - Math.abs(localX);
        const pushZ = limitZ - Math.abs(localZ);
        if (pushX < pushZ) {
          const sign = Math.sign(localX) || 1;
          car.position.x += rx * sign * pushX;
          car.position.z += rz * sign * pushX;
        } else {
          const sign = Math.sign(localZ) || 1;
          car.position.x += fx * sign * pushZ;
          car.position.z += fz * sign * pushZ;
        }
        bumped = true;
      }
      if (bumped) carSpeed *= 0.72;
    } else {
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      wish.set(0, 0, 0);
      if (gas) wish.add(forward);
      if (braking) wish.sub(forward);
      if (steerLeft) wish.sub(right);
      if (steerRight) wish.add(right);
      if (wish.lengthSq() > 0) wish.normalize();
      const moving = wish.lengthSq() > 0;
      velocity.x += wish.x * (moving ? 36 : 0) * dt;
      velocity.z += wish.z * (moving ? 36 : 0) * dt;
      const damp = Math.exp(-8 * dt);
      velocity.x *= damp;
      velocity.z *= damp;
      const speed = Math.hypot(velocity.x, velocity.z);
      if (speed > 7) {
        velocity.x *= 7 / speed;
        velocity.z *= 7 / speed;
      }
      block.position.x += velocity.x * dt;
      block.position.z += velocity.z * dt;
      const foot = PLATE / 2 - 0.4;
      block.position.x = Math.min(foot, Math.max(-foot, block.position.x));
      block.position.z = Math.min(foot, Math.max(-foot, block.position.z));
      block.position.y = groundHeight(block.position.x, block.position.z) + BODY_H / 2;
      pushBlock(car, heading);
      for (const racer of racers) pushBlock(racer.mesh, racer.mesh.rotation.y);
      for (const mesh of parked) pushBlock(mesh, mesh.rotation.y);
    }

    const camDist = driving ? distance : 6.5;
    const behind = (driving ? heading + Math.PI : 0) + yaw;
    const focus = driving ? car.position : block.position;
    look.set(
      Math.sin(behind) * Math.cos(pitch) * camDist,
      Math.sin(pitch) * camDist + (driving ? 1.1 : 0.5),
      Math.cos(behind) * Math.cos(pitch) * camDist,
    );
    camera.position.copy(focus).add(look);
    camera.lookAt(focus.x, focus.y + (driving ? 0.7 : 0), focus.z);

    sun.position.set(focus.x + 12, 18, focus.z + 8);
    sun.target.position.set(focus.x, 0, focus.z);
    sun.target.updateMatrixWorld();

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  setTimeout(() => hint.classList.add("hidden"), 7000);
  requestAnimationFrame(frame);
}

main().catch(() => {
  showError("The 3D game could not start. Check your connection and reload.");
});
