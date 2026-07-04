import * as THREE from "./vendor/three/three.module.js";

const container = document.querySelector("#stage-scene");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020307);
scene.fog = new THREE.FogExp2(0x060910, 0.045);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 1.35, 8.2);
camera.lookAt(0, 0.85, 0);
const cameraBase = {
  mobile: false,
  position: new THREE.Vector3(),
  target: new THREE.Vector3(),
};
const cameraTarget = new THREE.Vector3();

const imu = {
  supported: "DeviceOrientationEvent" in window,
  permission: "requestPermission" in (window.DeviceOrientationEvent || {}),
  enabled: false,
  baseline: null,
  targetYaw: 0,
  targetPitch: 0,
  yaw: 0,
  pitch: 0,
};

const loader = new THREE.TextureLoader();

function loadTexture(path) {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  }).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  });
}

function makeMistTexture(seed = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 58; i += 1) {
    const angle = i * 0.83 + seed;
    const x = 256 + Math.cos(angle) * (28 + (i % 7) * 13);
    const y = 256 + Math.sin(angle * 0.8) * (45 + (i % 9) * 9);
    const radius = 42 + ((i * 17) % 76);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(210, 235, 255, 0.14)");
    gradient.addColorStop(0.5, "rgba(120, 170, 210, 0.045)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 0.72, radius * 1.18, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const [microphoneTexture] = await Promise.all([
  loadTexture("assets/microphone-overlay.png"),
]);

const booth = new THREE.Group();
scene.add(booth);

const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x18212b,
  roughness: 0.72,
  metalness: 0.22,
  emissive: 0x050912,
  emissiveIntensity: 0.45,
});

const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x1b2028,
  roughness: 0.55,
  metalness: 0.24,
});

const trimMaterial = new THREE.MeshStandardMaterial({
  color: 0x05070a,
  roughness: 0.42,
  metalness: 0.65,
});

const mirrorGlassMaterial = new THREE.MeshStandardMaterial({
  color: 0x0e1c26,
  roughness: 0.18,
  metalness: 0.45,
  emissive: 0x0b1d2b,
  emissiveIntensity: 0.4,
});

const ledMaterial = new THREE.MeshStandardMaterial({
  color: 0xbcdcff,
  emissive: 0xaed8ff,
  emissiveIntensity: 4.8,
  roughness: 0.2,
});

const seamMaterial = new THREE.LineBasicMaterial({
  color: 0x4c6a87,
  transparent: true,
  opacity: 0.46,
});

function addPanel(width, height, x, y, z, rotY = 0, material = wallMaterial) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  booth.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), seamMaterial);
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  booth.add(edges);
  return mesh;
}

function addSeam(length, x, y, z, rotY = 0, rotZ = 0) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-length / 2, 0, 0),
    new THREE.Vector3(length / 2, 0, 0),
  ]);
  const seam = new THREE.Line(geometry, seamMaterial);
  seam.position.set(x, y, z);
  seam.rotation.set(0, rotY, rotZ);
  booth.add(seam);
  return seam;
}

function addLedStrip(length, x, y, z, rotY = 0, rotZ = 0) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(length, 0.035, 0.035), ledMaterial);
  strip.position.set(x, y, z);
  strip.rotation.set(0, rotY, rotZ);
  booth.add(strip);
  const glow = new THREE.PointLight(0xb6d9ff, 0.28, 2.2, 2);
  glow.position.set(x, y, z + 0.08);
  booth.add(glow);
  return strip;
}

function addLightBar(x, y, z, rotY = 0) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.055, 0.06), ledMaterial);
  bar.position.set(x, y, z);
  bar.rotation.y = rotY;
  booth.add(bar);
  const light = new THREE.SpotLight(0xd8e9ff, 2.7, 6.2, 0.46, 0.65, 1.4);
  light.position.set(x, y - 0.04, z + 0.08);
  light.target.position.set(x * 0.28, -1.1, -0.25);
  booth.add(light, light.target);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(value) {
  return ((value + 180) % 360) - 180;
}

function enableOrientation() {
  if (imu.enabled || !imu.supported) {
    return;
  }
  imu.enabled = true;
  window.addEventListener("deviceorientation", handleOrientation, true);
}

async function requestOrientation() {
  if (!imu.supported) {
    return;
  }

  if (imu.permission) {
    try {
      const permission = await window.DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        return;
      }
    } catch (error) {
      return;
    }
  }

  enableOrientation();
}

function handleOrientation(event) {
  if (typeof event.beta !== "number" || typeof event.gamma !== "number") {
    return;
  }

  const sample = {
    beta: event.beta,
    gamma: event.gamma,
    alpha: typeof event.alpha === "number" ? event.alpha : 0,
  };

  if (!imu.baseline) {
    imu.baseline = sample;
  }

  const orientation = window.screen?.orientation?.angle ?? window.orientation ?? 0;
  let yaw = normalizeAngle(sample.gamma - imu.baseline.gamma);
  let pitch = normalizeAngle(sample.beta - imu.baseline.beta);

  if (Math.abs(orientation) === 90) {
    yaw = normalizeAngle(sample.beta - imu.baseline.beta) * (orientation > 0 ? -1 : 1);
    pitch = normalizeAngle(sample.gamma - imu.baseline.gamma);
  }

  imu.targetYaw = clamp(yaw / 28, -1, 1);
  imu.targetPitch = clamp(pitch / 24, -1, 1);
}

function updateCameraFromSensors() {
  imu.yaw += (imu.targetYaw - imu.yaw) * 0.08;
  imu.pitch += (imu.targetPitch - imu.pitch) * 0.08;
  cameraTarget.copy(cameraBase.target);

  if (cameraBase.mobile) {
    cameraTarget.x += imu.yaw * 1.05;
    cameraTarget.y += imu.pitch * -0.58;
    camera.position.x = cameraBase.position.x + imu.yaw * 0.38;
    camera.position.y = cameraBase.position.y + imu.pitch * -0.18;
  } else {
    camera.position.copy(cameraBase.position);
  }

  camera.lookAt(cameraTarget);
}

const rear = addPanel(3.65, 3.25, 0, 0.7, -2.7);
const leftRear = addPanel(2.1, 3.1, -2.05, 0.62, -2.16, -0.62);
const rightRear = addPanel(2.1, 3.1, 2.05, 0.62, -2.16, 0.62);
const leftFront = addPanel(1.75, 2.75, -3.0, 0.46, -0.72, -0.28);
const rightFront = addPanel(1.75, 2.75, 3.0, 0.46, -0.72, 0.28);

for (const [x, y, z, rotY] of [
  [-1.1, 2.55, -2.72, 0],
  [1.1, 2.55, -2.72, 0],
  [-2.45, 2.42, -1.6, -0.62],
  [2.45, 2.42, -1.6, 0.62],
]) {
  addPanel(1.95, 0.72, x, y, z, rotY, wallMaterial);
}

const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.75, 0.18, 8), floorMaterial);
floor.position.set(0, -1.42, -0.45);
floor.scale.z = 0.78;
booth.add(floor);

const roof = new THREE.Mesh(
  new THREE.CylinderGeometry(2.7, 3.35, 0.58, 8),
  new THREE.MeshStandardMaterial({
    color: 0x121923,
    roughness: 0.68,
    metalness: 0.3,
    emissive: 0x04070d,
    emissiveIntensity: 0.5,
  }),
);
roof.position.set(0, 2.35, -1.16);
roof.scale.z = 0.72;
booth.add(roof);
const roofEdges = new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry), seamMaterial);
roofEdges.position.copy(roof.position);
roofEdges.scale.copy(roof.scale);
booth.add(roofEdges);

const rearRail = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 0.08), ledMaterial);
rearRail.position.set(0, -0.48, -2.61);
booth.add(rearRail);

const desk = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.42, 0.34), trimMaterial);
desk.position.set(0, -0.7, -2.55);
booth.add(desk);

const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.95, 96), mirrorGlassMaterial);
mirror.position.set(0, 0.92, -2.5);
mirror.scale.y = 1.22;
booth.add(mirror);

const mirrorRim = new THREE.Mesh(
  new THREE.TorusGeometry(0.98, 0.045, 16, 96),
  new THREE.MeshStandardMaterial({
    color: 0x1b2532,
    roughness: 0.35,
    metalness: 0.75,
    emissive: 0x122235,
    emissiveIntensity: 0.35,
  }),
);
mirrorRim.position.copy(mirror.position);
mirrorRim.scale.y = 1.22;
booth.add(mirrorRim);

const mistA = new THREE.Mesh(
  new THREE.CircleGeometry(0.86, 96),
  new THREE.MeshBasicMaterial({
    map: makeMistTexture(0),
    transparent: true,
    opacity: 0.56,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
mistA.position.set(0, 0.92, -2.43);
mistA.scale.y = 1.18;
booth.add(mistA);

const mistB = new THREE.Mesh(
  new THREE.CircleGeometry(0.78, 96),
  new THREE.MeshBasicMaterial({
    map: makeMistTexture(1.7),
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
mistB.position.set(0, 0.92, -2.41);
mistB.scale.y = 1.13;
booth.add(mistB);

for (const strip of [
  [-1.5, 1.45, -2.61, 0, 0.55],
  [1.5, 1.45, -2.61, 0, -0.55],
  [-1.95, 0.3, -2.18, -0.62, -0.5],
  [1.95, 0.3, -2.18, 0.62, 0.5],
  [-2.78, 1.08, -0.73, -0.28, 0.48],
  [2.78, 1.08, -0.73, 0.28, -0.48],
  [-2.65, -0.4, -0.73, -0.28, -0.65],
  [2.65, -0.4, -0.73, 0.28, 0.65],
]) {
  addLedStrip(0.86, ...strip);
}

for (const seam of [
  [1.15, -1.06, 1.12, -2.58, 0, -0.72],
  [1.1, 1.04, 1.05, -2.58, 0, 0.74],
  [0.88, -1.88, 0.86, -2.12, -0.62, 0.86],
  [0.88, 1.88, 0.86, -2.12, 0.62, -0.86],
  [1.0, -2.88, 0.42, -0.7, -0.28, 0.86],
  [1.0, 2.88, 0.42, -0.7, 0.28, -0.86],
  [0.92, -2.7, 1.58, -0.72, -0.28, -0.55],
  [0.92, 2.7, 1.58, -0.72, 0.28, 0.55],
]) {
  addSeam(...seam);
}

addLightBar(-1.95, 2.08, -1.42, -0.48);
addLightBar(0, 2.28, -2.42, 0);
addLightBar(1.95, 2.08, -1.42, 0.48);

const micMaterial = new THREE.MeshBasicMaterial({
  map: microphoneTexture,
  transparent: true,
  alphaTest: 0.03,
  depthWrite: false,
});
const microphone = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), micMaterial);
microphone.position.set(0, -0.53, 0.62);
scene.add(microphone);

const ambient = new THREE.HemisphereLight(0x7b91aa, 0x07080b, 0.34);
scene.add(ambient);

const overhead = new THREE.SpotLight(0xc8ddff, 4.8, 9, 0.38, 0.72, 1.25);
overhead.position.set(0, 3.15, 1.25);
overhead.target.position.set(0, -1.28, 0);
scene.add(overhead, overhead.target);

const rimLeft = new THREE.PointLight(0x6f92c8, 1.15, 5.4, 2.2);
rimLeft.position.set(-3.2, 0.55, 0.9);
scene.add(rimLeft);

const rimRight = new THREE.PointLight(0x6f92c8, 1.15, 5.4, 2.2);
rimRight.position.set(3.2, 0.55, 0.9);
scene.add(rimRight);

const mirrorGlow = new THREE.PointLight(0x9fd7ff, 2.2, 4.2, 1.7);
mirrorGlow.position.set(0, 0.92, -1.85);
scene.add(mirrorGlow);

const footGlow = new THREE.PointLight(0x7988ff, 1.6, 5, 2);
footGlow.position.set(0, -1.18, 1.35);
scene.add(footGlow);

window.ZoneTripScene = {
  scene,
  camera,
  renderer,
  motion: {
    state: imu,
    requestPermission: requestOrientation,
    recalibrate() {
      imu.baseline = null;
      imu.yaw = 0;
      imu.pitch = 0;
      imu.targetYaw = 0;
      imu.targetPitch = 0;
    },
  },
  lighting: {
    ambient,
    overhead,
    mirror: mirrorGlow,
    foot: footGlow,
    rimLeft,
    rimRight,
  },
};

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const mobile = width <= 620;
  cameraBase.mobile = mobile;
  cameraBase.position.set(0, mobile ? 0.9 : 1.12, mobile ? 8.9 : 7.7);
  cameraBase.target.set(0, mobile ? 0.45 : 0.42, -1.0);
  camera.position.copy(cameraBase.position);
  booth.scale.setScalar(mobile ? 1.16 : 1);
  booth.position.y = mobile ? -0.05 : 0;
  microphone.scale.set(mobile ? 1.88 : 1.4, mobile ? 3.34 : 2.48, 1);
  microphone.position.y = mobile ? -0.52 : -0.55;
  microphone.position.z = mobile ? 0.74 : 0.62;
  updateCameraFromSensors();
}

function animate(now = 0) {
  const t = now * 0.001;
  mistA.rotation.z = Math.sin(t * 0.16) * 0.22;
  mistB.rotation.z = 0.8 + Math.cos(t * 0.13) * 0.28;
  mistA.material.opacity = 0.48 + Math.sin(t * 0.7) * 0.08;
  mistB.material.opacity = 0.28 + Math.cos(t * 0.53) * 0.06;
  mirrorGlow.intensity = 2 + Math.sin(t * 0.9) * 0.38;
  overhead.intensity = 4.55 + Math.cos(t * 0.22) * 0.2;
  updateCameraFromSensors();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resize();
window.addEventListener("resize", resize);
if (imu.supported && !imu.permission) {
  enableOrientation();
}
window.addEventListener("pointerdown", requestOrientation, { once: true });
window.addEventListener("touchstart", requestOrientation, { once: true, passive: true });
requestAnimationFrame(animate);
