const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const PLATE = 96;
const BLOCK = 1.7;
const EYE = 0.85;

const keys = new Set();
const pad = new Set();
let jumpQueued = false;

const canvas = document.getElementById("view");
const hint = document.getElementById("hint");
const boot = document.getElementById("boot");

function showError(message) {
  boot.textContent = message;
  boot.classList.remove("hidden");
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space" && !event.repeat) jumpQueued = true;
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
  jumpQueued = true;
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

function faceMaterial(THREE, color) {
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 128;
  texCanvas.height = 128;
  const ctx = texCanvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#2a2418";
  ctx.beginPath();
  ctx.arc(46, 54, 9, 0, Math.PI * 2);
  ctx.arc(82, 54, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(49, 51, 3, 0, Math.PI * 2);
  ctx.arc(85, 51, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a2418";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(64, 70, 26, 0.25, Math.PI - 0.25);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(texCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.62,
    metalness: 0.02,
  });
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

  const face = faceMaterial(THREE, "#f2c14e");
  const top = plainMaterial(THREE, 0xf6d56a);
  const bottom = plainMaterial(THREE, 0xc9962e);
  const block = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK), [
    face, face, top, bottom, face, face,
  ]);
  block.castShadow = true;
  block.receiveShadow = true;

  const player = new THREE.Group();
  player.add(block);
  player.position.y = BLOCK / 2;
  scene.add(player);

  let yaw = 0.65;
  let pitch = 0.42;
  const distance = 8;
  let vy = 0;
  let grounded = true;
  const velocity = new THREE.Vector3();
  let walk = 0;
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

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const look = new THREE.Vector3();
  const half = PLATE / 2 - BLOCK / 2 - 0.15;
  const clock = new THREE.Clock();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (keys.has("KeyQ")) yaw += dt * 1.4;
    if (keys.has("KeyE")) yaw -= dt * 1.4;

    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    wish.set(0, 0, 0);
    if (held("KeyW", "up") || keys.has("ArrowUp")) wish.add(forward);
    if (held("KeyS", "down") || keys.has("ArrowDown")) wish.sub(forward);
    if (held("KeyA", "left") || keys.has("ArrowLeft")) wish.sub(right);
    if (held("KeyD", "right") || keys.has("ArrowRight")) wish.add(right);

    const moving = wish.lengthSq() > 0;
    if (moving) wish.normalize();

    const accel = moving ? 48 : 0;
    const drag = grounded ? 6 : 2;
    velocity.x += wish.x * accel * dt;
    velocity.z += wish.z * accel * dt;
    const damp = Math.exp(-drag * dt);
    velocity.x *= damp;
    velocity.z *= damp;

    const speed = Math.hypot(velocity.x, velocity.z);
    const maxSpeed = 9;
    if (speed > maxSpeed) {
      velocity.x *= maxSpeed / speed;
      velocity.z *= maxSpeed / speed;
    }

    player.position.x += velocity.x * dt;
    player.position.z += velocity.z * dt;
    player.position.x = Math.min(half, Math.max(-half, player.position.x));
    player.position.z = Math.min(half, Math.max(-half, player.position.z));

    if (jumpQueued && grounded) {
      vy = 8.2;
      grounded = false;
    }
    jumpQueued = false;

    vy += -26 * dt;
    player.position.y += vy * dt;
    if (player.position.y <= BLOCK / 2) {
      player.position.y = BLOCK / 2;
      vy = 0;
      grounded = true;
    }

    if (moving && grounded) {
      walk += dt * speed * 1.3;
      block.position.y = Math.abs(Math.sin(walk)) * 0.08;
      const faceYaw = Math.atan2(wish.x, wish.z);
      const turn = Math.atan2(Math.sin(faceYaw - player.rotation.y), Math.cos(faceYaw - player.rotation.y));
      player.rotation.y += turn * Math.min(1, dt * 12);
    } else {
      block.position.y += (0 - block.position.y) * Math.min(1, dt * 10);
    }

    look.set(
      Math.sin(yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance + EYE,
      Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.position.copy(player.position).add(look);
    camera.lookAt(player.position.x, player.position.y + 0.35, player.position.z);

    sun.position.set(player.position.x + 12, 18, player.position.z + 8);
    sun.target.position.set(player.position.x, 0, player.position.z);
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
