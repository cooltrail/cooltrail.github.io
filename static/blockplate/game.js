const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const PLATE = 96;
const BODY_W = 0.9;
const BODY_H = 3.2;
const BODY_D = 0.32;
const TRACK_RX = 30.5;
const TRACK_RY = 18.5;
const ROAD_HALF = 3.4;

const keys = new Set();
const pad = new Set();

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

bindHold(document.getElementById("jump"), "down");

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

function faceMaterial(THREE, color) {
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 64;
  texCanvas.height = 220;
  const ctx = texCanvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 220);
  ctx.fillStyle = "#2a2418";
  ctx.beginPath();
  ctx.arc(20, 48, 5, 0, Math.PI * 2);
  ctx.arc(44, 48, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(22, 46, 1.6, 0, Math.PI * 2);
  ctx.arc(46, 46, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a2418";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(32, 58, 12, 0.25, Math.PI - 0.25);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(texCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.62,
    metalness: 0.02,
  });
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

function makeCar(THREE, color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.46, 3.05),
    plainMaterial(THREE, color),
  );
  body.position.y = 0.52;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.4, 1.3),
    plainMaterial(THREE, 0x243044),
  );
  cabin.position.set(0, 0.9, -0.12);
  cabin.castShadow = true;
  group.add(cabin);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.26, 0.06),
    plainMaterial(THREE, 0xb7e4f8),
  );
  glass.position.set(0, 0.92, 0.52);
  group.add(glass);

  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.1, 0.06),
    plainMaterial(THREE, 0xfff4c4),
  );
  lamp.position.set(0.42, 0.58, 1.52);
  group.add(lamp);
  const lamp2 = lamp.clone();
  lamp2.position.x = -0.42;
  group.add(lamp2);

  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.06),
    plainMaterial(THREE, 0xd94a32),
  );
  tail.position.set(0, 0.62, -1.52);
  group.add(tail);

  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = plainMaterial(THREE, 0x1b1b1b);
  const wheels = [];
  const fronts = [];
  for (const [x, z, front] of [[0.72, 0.95, true], [-0.72, 0.95, true], [0.72, -0.95, false], [-0.72, -0.95, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.28, z);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.castShadow = true;
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
    if (front) fronts.push(pivot);
  }
  group.userData.wheels = wheels;
  group.userData.fronts = fronts;
  return group;
}

function plainMaterial(THREE, color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.02,
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
  scene.fog = new THREE.Fog(0x8ec8f2, 42, 110);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);

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

  const racers = [
    { t: 0.02, speed: 0.042, lane: 1.05, color: 0xd94a32 },
    { t: 0.24, speed: 0.034, lane: -1.05, color: 0x3d7ec9 },
    { t: 0.47, speed: 0.05, lane: 1.05, color: 0xf2c14e },
    { t: 0.68, speed: 0.03, lane: -1.05, color: 0xf7f7f7 },
    { t: 0.86, speed: 0.038, lane: 1.05, color: 0x3cb371 },
  ].map((racer) => {
    const mesh = makeCar(THREE, racer.color);
    scene.add(mesh);
    return { ...racer, mesh, base: racer.speed };
  });

  const face = faceMaterial(THREE, "#f2c14e");
  const side = plainMaterial(THREE, 0xe0ae38);
  const top = plainMaterial(THREE, 0xf6d56a);
  const bottom = plainMaterial(THREE, 0xc9962e);
  const block = new THREE.Mesh(new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D), [
    side, side, top, bottom, face, face,
  ]);
  block.castShadow = true;
  block.receiveShadow = true;

  const spawn = trackFrame(0.08);
  const car = makeCar(THREE, 0xff7a1a);
  block.scale.set(0.5, 0.5, 0.5);
  block.position.set(0, 1.22, -0.05);
  car.add(block);
  car.position.set(spawn.x, 0.08, spawn.z);
  car.rotation.y = spawn.yaw;
  scene.add(car);

  let heading = spawn.yaw;
  let carSpeed = 0;
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
  const edge = PLATE / 2 - 1.8;
  const clock = new THREE.Clock();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (keys.has("KeyQ")) yaw += dt * 1.4;
    if (keys.has("KeyE")) yaw -= dt * 1.4;

    const gas = held("KeyW", "up") || keys.has("ArrowUp");
    const braking = held("KeyS", "down") || keys.has("ArrowDown") || keys.has("Space");
    const steerLeft = held("KeyA", "left") || keys.has("ArrowLeft");
    const steerRight = held("KeyD", "right") || keys.has("ArrowRight");

    if (gas && !braking) carSpeed += 32 * dt;
    else if (braking) carSpeed -= 42 * dt;
    else carSpeed *= Math.exp(-2.4 * dt);
    carSpeed = Math.min(18, Math.max(-7, carSpeed));
    if (Math.abs(carSpeed) < 0.05 && !gas && !braking) carSpeed = 0;

    const turn = (steerLeft ? 1 : 0) - (steerRight ? 1 : 0);
    const speedFactor = Math.min(1, Math.max(0.28, Math.abs(carSpeed) / 10));
    heading += turn * 2.15 * speedFactor * Math.sign(carSpeed || 1) * dt;

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
    car.position.y = 0.08;

    const steerVisual = (steerRight ? 1 : 0) - (steerLeft ? 1 : 0);
    for (const pivot of car.userData.fronts) pivot.rotation.y = steerVisual * 0.38;
    for (const wheel of car.userData.wheels) wheel.rotation.x -= carSpeed * dt * 2.4;

    let bumped = false;
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
      for (const wheel of racer.mesh.userData.wheels) wheel.rotation.x -= racer.speed * 90 * dt;

      const dx = car.position.x - racer.mesh.position.x;
      const dz = car.position.z - racer.mesh.position.z;
      const rx = Math.cos(pose.yaw);
      const rz = -Math.sin(pose.yaw);
      const localX = dx * rx + dz * rz;
      const localZ = dx * pose.tx + dz * pose.tz;
      const limitX = 1.55;
      const limitZ = 3.15;
      if (Math.abs(localX) >= limitX || Math.abs(localZ) >= limitZ) continue;
      const pushX = limitX - Math.abs(localX);
      const pushZ = limitZ - Math.abs(localZ);
      if (pushX < pushZ) {
        const sign = Math.sign(localX) || 1;
        car.position.x += rx * sign * pushX;
        car.position.z += rz * sign * pushX;
      } else {
        const sign = Math.sign(localZ) || 1;
        car.position.x += pose.tx * sign * pushZ;
        car.position.z += pose.tz * sign * pushZ;
      }
      bumped = true;
    }
    if (bumped) carSpeed *= 0.72;

    const behind = heading + Math.PI + yaw;
    look.set(
      Math.sin(behind) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance + 1.1,
      Math.cos(behind) * Math.cos(pitch) * distance,
    );
    camera.position.copy(car.position).add(look);
    camera.lookAt(car.position.x, 0.9, car.position.z);

    sun.position.set(car.position.x + 12, 18, car.position.z + 8);
    sun.target.position.set(car.position.x, 0, car.position.z);
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
