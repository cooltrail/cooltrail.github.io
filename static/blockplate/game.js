const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const PLATE = 96;
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

  const side = plainMaterial(THREE, 0xf2c14e);
  const top = plainMaterial(THREE, 0xf6d56a);
  const bottom = plainMaterial(THREE, 0xc9962e);
  const block = new THREE.Mesh(new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D), [
    side, side, top, bottom, side, side,
  ]);
  block.castShadow = true;
  block.receiveShadow = true;

  const spawn = trackFrame(0.08);
  const car = makeCar(THREE, 0xff7a1a);
  block.position.set(0, 0.72, -0.02);
  car.add(block);
  car.position.set(spawn.x, 0.08, spawn.z);
  car.rotation.y = spawn.yaw;
  scene.add(car);

  let driving = true;
  let heading = spawn.yaw;
  let carSpeed = 0;
  let spaceWasDown = false;
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
    block.position.set(car.position.x + rx * 1.6, BODY_H / 2, car.position.z + rz * 1.6);
    block.rotation.set(0, 0, 0);
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

    if (driving) {
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
      for (const wheel of racer.mesh.userData.wheels) wheel.rotation.x -= racer.speed * 90 * dt;
    }

    if (driving) {
      let bumped = false;
      for (const racer of racers) {
        const pose = trackFrame(racer.t);
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
      block.position.y = BODY_H / 2;
      pushBlock(car, heading);
      for (const racer of racers) pushBlock(racer.mesh, racer.mesh.rotation.y);
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
    camera.lookAt(focus.x, driving ? 0.9 : focus.y, focus.z);

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
