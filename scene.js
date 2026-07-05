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
const cameraPresets = {
  front: {
    position: new THREE.Vector3(0, 0.55, 10.2),
    target: new THREE.Vector3(0, -0.05, -0.2),
    fov: 44,
  },
  back: {
    position: new THREE.Vector3(0, 0.55, -10.2),
    target: new THREE.Vector3(0, -0.05, 0),
    fov: 44,
  },
  left: {
    position: new THREE.Vector3(-10.2, 0.55, 0),
    target: new THREE.Vector3(0, -0.05, 0),
    fov: 44,
  },
  right: {
    position: new THREE.Vector3(10.2, 0.55, 0),
    target: new THREE.Vector3(0, -0.05, 0),
    fov: 44,
  },
  top: {
    position: new THREE.Vector3(0, 8.7, 6.2),
    target: new THREE.Vector3(0, -0.38, 0),
    fov: 48,
  },
};
let cameraPreset = new URLSearchParams(window.location.search).get("view") || "";

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

const touchView = {
  activePointerId: null,
  startX: 0,
  startY: 0,
  startYaw: 0,
  startPitch: 0,
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

function createLabelTexture(lines, options = {}) {
  const width = options.width || 512;
  const height = options.height || 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = options.color || "rgba(210, 150, 116, 0.92)";
  context.textAlign = options.align || "center";
  context.textBaseline = "middle";
  context.font = options.font || "700 48px Inter, Arial, sans-serif";
  const lineHeight = options.lineHeight || 62;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  for (const [index, line] of lines.entries()) {
    context.fillText(line, width / 2, startY + index * lineHeight);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const [microphoneTexture] = await Promise.all([
  loadTexture("assets/microphone-overlay.png"),
]);

const booth = new THREE.Group();
scene.add(booth);

const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x05080d,
  roughness: 0.86,
  metalness: 0.18,
  emissive: 0x010205,
  emissiveIntensity: 0.28,
});

const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x0b0f14,
  roughness: 0.68,
  metalness: 0.24,
});

const trimMaterial = new THREE.MeshStandardMaterial({
  color: 0x05070a,
  roughness: 0.42,
  metalness: 0.65,
});

const ledMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd9a6,
  emissive: 0xffb45f,
  emissiveIntensity: 2.8,
  roughness: 0.2,
  transparent: true,
});

const stageRiserMaterial = new THREE.MeshStandardMaterial({
  color: 0x111820,
  roughness: 0.58,
  metalness: 0.22,
  emissive: 0x03060a,
  emissiveIntensity: 0.55,
});

const seamMaterial = new THREE.LineBasicMaterial({
  color: 0x4c6a87,
  transparent: true,
  opacity: 0.46,
});
const microphoneBaseTarget = new THREE.Vector3(0, -1.34, 0.72);
const wallSpotLights = [];
const wallSpotBars = [];
const ceilingLights = [];
const exteriorSeams = [];
const lightingState = {
  powered: true,
  currentLevel: 1,
  targetLevel: 1,
  activeLevel: 1,
  idleLevel: 0.16,
};

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

function facetVectors(angle) {
  return {
    radial: new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
    tangent: new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)),
  };
}

function addFacetPanel(
  angle,
  bottomRadius,
  topRadius,
  yBottom,
  yTop,
  widthScale = 0.96,
  material = wallMaterial,
) {
  const { radial, tangent } = facetVectors(angle);
  const bottomHalfWidth = bottomRadius * Math.tan(Math.PI / 8) * widthScale;
  const topHalfWidth = topRadius * Math.tan(Math.PI / 8) * widthScale;
  const points = [
    radial.clone().multiplyScalar(bottomRadius).add(tangent.clone().multiplyScalar(-bottomHalfWidth)).setY(yBottom),
    radial.clone().multiplyScalar(bottomRadius).add(tangent.clone().multiplyScalar(bottomHalfWidth)).setY(yBottom),
    radial.clone().multiplyScalar(topRadius).add(tangent.clone().multiplyScalar(topHalfWidth)).setY(yTop),
    radial.clone().multiplyScalar(topRadius).add(tangent.clone().multiplyScalar(-topHalfWidth)).setY(yTop),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  booth.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), seamMaterial);
  booth.add(edges);
  return mesh;
}

function addRadialBox(angle, radius, y, width, height, depth, material = trimMaterial) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  mesh.rotation.y = angle;
  booth.add(mesh);
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

function addFacetLine(angle, radius, y, offset, length, tilt = 0) {
  const { radial, tangent } = facetVectors(angle);
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-length / 2, 0, 0),
    new THREE.Vector3(length / 2, 0, 0),
  ]);
  const line = new THREE.Line(geometry, seamMaterial);
  const position = radial.clone().multiplyScalar(radius).add(tangent.multiplyScalar(offset));
  line.position.set(position.x, y, position.z);
  line.rotation.set(0, angle, tilt);
  booth.add(line);
  exteriorSeams.push(line);
  return line;
}

function addLightBar(angle, radius, y, offset = 0) {
  const { radial, tangent } = facetVectors(angle);
  const position = radial.clone().multiplyScalar(radius).add(tangent.multiplyScalar(offset));
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20), ledMaterial);
  bar.position.set(position.x, y, position.z);
  bar.rotation.set(Math.PI / 2, 0, 0);
  booth.add(bar);
  wallSpotBars.push(bar);
  const light = new THREE.SpotLight(0xffd7a2, 1.18, 7.5, 0.32, 0.7, 1.35);
  light.position.set(position.x, y - 0.05, position.z);
  light.target.position.copy(microphoneBaseTarget);
  booth.add(light, light.target);
  wallSpotLights.push(light);
}

function addLabelPlane(texture, width, height, angle, radius, y, inward = false) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  plane.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  plane.rotation.y = inward ? angle + Math.PI : angle;
  booth.add(plane);
  return plane;
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

function startTouchPan(event) {
  if (!cameraBase.mobile || touchView.activePointerId !== null) {
    return;
  }

  touchView.activePointerId = event.pointerId;
  touchView.startX = event.clientX;
  touchView.startY = event.clientY;
  touchView.startYaw = touchView.targetYaw;
  touchView.startPitch = touchView.targetPitch;
  renderer.domElement.setPointerCapture(event.pointerId);
}

function moveTouchPan(event) {
  if (touchView.activePointerId !== event.pointerId) {
    return;
  }

  const dx = event.clientX - touchView.startX;
  const dy = event.clientY - touchView.startY;
  touchView.targetYaw = clamp(touchView.startYaw + dx / 150, -1.15, 1.15);
  touchView.targetPitch = clamp(touchView.startPitch + dy / 180, -1, 1);
}

function endTouchPan(event) {
  if (touchView.activePointerId !== event.pointerId) {
    return;
  }

  touchView.activePointerId = null;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
}

function updateCameraFromSensors() {
  imu.yaw += (imu.targetYaw - imu.yaw) * 0.08;
  imu.pitch += (imu.targetPitch - imu.pitch) * 0.08;
  touchView.yaw += (touchView.targetYaw - touchView.yaw) * 0.16;
  touchView.pitch += (touchView.targetPitch - touchView.pitch) * 0.16;
  const yaw = clamp(imu.yaw + touchView.yaw, -1.25, 1.25);
  const pitch = clamp(imu.pitch + touchView.pitch, -1.1, 1.1);
  cameraTarget.copy(cameraBase.target);

  if (cameraBase.mobile) {
    cameraTarget.x += yaw * 1.05;
    cameraTarget.y += pitch * -0.58;
    camera.position.x = cameraBase.position.x + yaw * 0.38;
    camera.position.y = cameraBase.position.y + pitch * -0.18;
  } else {
    camera.position.copy(cameraBase.position);
  }

  camera.lookAt(cameraTarget);
}

function setCameraPreset(name) {
  if (!cameraPresets[name]) {
    return false;
  }
  cameraPreset = name;
  resize();
  return true;
}

const shell = {
  bottomRadius: 3.08,
  topRadius: 2.42,
  baseY: -1.34,
  shoulderY: 1.78,
  roofY: 2.52,
};
const frontAngle = 0;
const facetAngles = Array.from({ length: 8 }, (_, index) => index * Math.PI / 4);

for (const angle of facetAngles) {
  if (angle === frontAngle) {
    continue;
  }
  addFacetPanel(angle, shell.bottomRadius, shell.topRadius, shell.baseY, shell.shoulderY);
}

for (const side of [-1, 1]) {
  const angle = side * Math.PI / 8;
  addFacetPanel(angle, shell.bottomRadius, shell.topRadius, shell.baseY, shell.shoulderY, 0.34);
}

const doorFrameMaterial = new THREE.MeshStandardMaterial({
  color: 0x070a0f,
  roughness: 0.34,
  metalness: 0.72,
  emissive: 0x010306,
  emissiveIntensity: 0.28,
});
addRadialBox(0, shell.bottomRadius - 0.02, 0.04, 0.18, 2.72, 0.26, doorFrameMaterial).position.x = -0.84;
addRadialBox(0, shell.bottomRadius - 0.02, 0.04, 0.18, 2.72, 0.26, doorFrameMaterial).position.x = 0.84;
addRadialBox(0, shell.topRadius + 0.12, 1.46, 1.88, 0.18, 0.28, doorFrameMaterial);

const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x0b1117,
  roughness: 0.08,
  metalness: 0.05,
  transmission: 0.16,
  transparent: true,
  opacity: 0.38,
});
const entryGlass = new THREE.Mesh(new THREE.BoxGeometry(1.34, 2.28, 0.04), glassMaterial);
entryGlass.position.set(0, 0.02, shell.bottomRadius + 0.02);
booth.add(entryGlass);

const warmTrimMaterial = new THREE.MeshStandardMaterial({
  color: 0xb7835e,
  emissive: 0x7a3f24,
  emissiveIntensity: 0.38,
  roughness: 0.34,
  metalness: 0.48,
});
for (const width of [1.55, 2.05, 2.55]) {
  const frame = new THREE.Group();
  const z = shell.bottomRadius + 0.08 + (width - 1.55) * 0.36;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.42, 0.035), warmTrimMaterial);
  const right = left.clone();
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.035, 0.035), warmTrimMaterial);
  left.position.set(-width / 2, 0.02, z);
  right.position.set(width / 2, 0.02, z);
  top.position.set(0, 1.24, z);
  frame.add(left, right, top);
  booth.add(frame);
}

const baseRing = new THREE.Mesh(
  new THREE.CylinderGeometry(3.22, 3.38, 0.36, 8, 1, false),
  stageRiserMaterial,
);
baseRing.position.set(0, shell.baseY - 0.11, 0);
baseRing.scale.z = 0.72;
booth.add(baseRing);
const baseEdges = new THREE.LineSegments(new THREE.EdgesGeometry(baseRing.geometry), seamMaterial);
baseEdges.position.copy(baseRing.position);
baseEdges.scale.copy(baseRing.scale);
booth.add(baseEdges);

for (const angle of facetAngles) {
  const { radial } = facetVectors(angle);
  const position = radial.clone().multiplyScalar(3.16);
  const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.035, 0.055), warmTrimMaterial);
  underglow.position.set(position.x, shell.baseY - 0.01, position.z);
  underglow.rotation.y = angle;
  booth.add(underglow);
}

for (const angle of facetAngles) {
  addRadialBox(angle + Math.PI / 8, 3.08, 0.18, 0.08, 2.95, 0.12, trimMaterial);
}

const stageDeck = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.95, 0.18, 8), floorMaterial);
stageDeck.position.set(0, -1.42, 0.22);
stageDeck.scale.z = 0.68;
booth.add(stageDeck);

const lowerFloor = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, 2.3), floorMaterial);
lowerFloor.position.set(0, -1.75, 2.48);
booth.add(lowerFloor);

const stageStep = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.34, 0.2), stageRiserMaterial);
stageStep.position.set(0, -1.58, 1.52);
booth.add(stageStep);

const stageApron = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.24, 0.16), trimMaterial);
stageApron.position.set(0, -1.82, 1.66);
booth.add(stageApron);

const stageLip = new THREE.Mesh(
  new THREE.BoxGeometry(5.35, 0.025, 0.035),
  new THREE.MeshStandardMaterial({
    color: 0x93a1b2,
    emissive: 0x233247,
    emissiveIntensity: 0.42,
    roughness: 0.38,
    metalness: 0.35,
  }),
);
stageLip.position.set(0, -1.32, 1.4);
booth.add(stageLip);

const stoolCushionMaterial = new THREE.MeshStandardMaterial({
  color: 0x15100e,
  roughness: 0.82,
  metalness: 0.05,
});
const stoolLegMaterial = new THREE.MeshStandardMaterial({
  color: 0x050608,
  roughness: 0.42,
  metalness: 0.62,
});
const stool = new THREE.Group();
const stoolCushion = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.22, 36), stoolCushionMaterial);
stoolCushion.position.set(0, -0.92, 1.2);
const stoolStem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.62, 18), stoolLegMaterial);
stoolStem.position.set(0, -1.24, 1.2);
const stoolBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.045, 30), stoolLegMaterial);
stoolBase.position.set(0, -1.57, 1.2);
stool.add(stoolCushion, stoolStem, stoolBase);
booth.add(stool);

const roof = new THREE.Mesh(
  new THREE.CylinderGeometry(0.9, 2.52, 0.74, 8),
  new THREE.MeshStandardMaterial({
    color: 0x121923,
    roughness: 0.68,
    metalness: 0.3,
    emissive: 0x04070d,
    emissiveIntensity: 0.5,
  }),
);
roof.position.set(0, shell.roofY, 0);
roof.scale.z = 0.72;
booth.add(roof);
const roofEdges = new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry), seamMaterial);
roofEdges.position.copy(roof.position);
roofEdges.scale.copy(roof.scale);
booth.add(roofEdges);

const ceilingLampMaterial = new THREE.MeshStandardMaterial({
  color: 0x1c1712,
  roughness: 0.36,
  metalness: 0.7,
  emissive: 0x4a2a16,
  emissiveIntensity: 0.38,
});
const ceilingLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.18, 28), ceilingLampMaterial);
ceilingLamp.position.set(0, 1.82, 0.1);
booth.add(ceilingLamp);
const centralSpot = new THREE.SpotLight(0xffcc86, 1.75, 6.8, 0.42, 0.78, 1.25);
centralSpot.position.set(0, 1.72, 0.1);
centralSpot.target.position.copy(microphoneBaseTarget);
booth.add(centralSpot, centralSpot.target);
ceilingLights.push(centralSpot);

const desk = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.42, 0.34), trimMaterial);
desk.position.set(0, -0.7, -2.55);
booth.add(desk);

for (const angle of facetAngles) {
  if (angle !== frontAngle) {
    addFacetLine(angle, 3.04, 0.18, -0.44, 0.86, -0.68);
    addFacetLine(angle, 2.88, 0.78, 0.36, 0.78, 0.62);
    addFacetLine(angle, 2.7, 1.32, -0.1, 0.62, -0.18);
  }
}

for (const angle of facetAngles) {
  addLightBar(angle, 2.24, 1.78, 0);
}

const exteriorBrandTexture = createLabelTexture(["ZONE TRIP", "ARU"], {
  width: 512,
  height: 384,
  font: "800 52px Inter, Arial, sans-serif",
  lineHeight: 70,
  color: "rgba(207, 142, 105, 0.92)",
});
addLabelPlane(exteriorBrandTexture, 1.15, 0.86, Math.PI / 4, 3.02, 0.08);

const listenTexture = createLabelTexture(["Listen.", "Reflect.", "Speak.", "Release."], {
  width: 384,
  height: 512,
  font: "700 42px Inter, Arial, sans-serif",
  lineHeight: 74,
  color: "rgba(218, 160, 124, 0.88)",
});
addLabelPlane(listenTexture, 0.78, 1.05, -Math.PI / 4, 2.62, 0.32, true);

const privacyTexture = createLabelTexture(["This is not", "recorded.", "It is not", "ranked.", "Speak freely."], {
  width: 512,
  height: 512,
  font: "700 36px Inter, Arial, sans-serif",
  lineHeight: 62,
  color: "rgba(202, 134, 98, 0.76)",
});
addLabelPlane(privacyTexture, 0.92, 1.05, Math.PI / 4, 2.62, 0.2, true);

const micMaterial = new THREE.MeshBasicMaterial({
  map: microphoneTexture,
  transparent: true,
  alphaTest: 0.03,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const microphone = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), micMaterial);
microphone.position.set(0, -0.53, 0.62);
microphone.renderOrder = 10;
scene.add(microphone);

const ambient = new THREE.HemisphereLight(0x5f7188, 0x030407, 0.18);
scene.add(ambient);
const exteriorFill = new THREE.DirectionalLight(0x9fb8d6, 1.15);
exteriorFill.position.set(4, 5.2, 5.5);
exteriorFill.visible = false;
scene.add(exteriorFill);

function setPowerState(powered) {
  lightingState.powered = Boolean(powered);
  lightingState.targetLevel = lightingState.powered
    ? lightingState.activeLevel
    : lightingState.idleLevel;
}

window.ZoneTripScene = {
  scene,
  camera,
  renderer,
  views: {
    presets: cameraPresets,
    set: setCameraPreset,
  },
  motion: {
    state: imu,
    requestPermission: requestOrientation,
    recalibrate() {
      imu.baseline = null;
      imu.yaw = 0;
      imu.pitch = 0;
      imu.targetYaw = 0;
      imu.targetPitch = 0;
      touchView.yaw = 0;
      touchView.pitch = 0;
      touchView.targetYaw = 0;
      touchView.targetPitch = 0;
    },
    touch: touchView,
  },
  lighting: {
    ambient,
    exteriorFill,
    wallSpots: wallSpotLights,
    setPowerState,
    state: lightingState,
  },
};

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;

  const preset = cameraPresets[cameraPreset];
  const hasPreset = Boolean(preset);
  const mobile = !preset && width <= 620;
  cameraBase.mobile = mobile;
  if (preset) {
    camera.fov = preset.fov;
    cameraBase.position.copy(preset.position);
    cameraBase.target.copy(preset.target);
  } else {
    camera.fov = 42;
    cameraBase.position.set(0, mobile ? -0.04 : 0.18, mobile ? 7.4 : 6.1);
    cameraBase.target.set(0, mobile ? -0.18 : -0.08, -0.78);
  }
  camera.updateProjectionMatrix();
  renderer.toneMappingExposure = hasPreset ? 1.9 : 1.15;
  scene.fog.density = hasPreset ? 0.018 : 0.045;
  ambient.intensity = hasPreset ? 0.42 : 0.18;
  exteriorFill.visible = hasPreset;
  camera.position.copy(cameraBase.position);
  booth.scale.setScalar(mobile ? 1.04 : 1);
  booth.position.y = preset ? -0.04 : mobile ? -0.04 : -0.02;
  microphone.visible = !preset;
  microphone.scale.set(mobile ? 1.38 : 1.34, mobile ? 2.45 : 2.38, 1);
  microphone.position.y = mobile ? -0.18 : -0.26;
  microphone.position.z = mobile ? 1.34 : 1.2;
  updateCameraFromSensors();
}

function animate(now = 0) {
  const t = now * 0.001;
  lightingState.currentLevel += (lightingState.targetLevel - lightingState.currentLevel) * 0.045;
  for (const light of wallSpotLights) {
    light.intensity = (1.38 + Math.cos(t * 0.22) * 0.06) * lightingState.currentLevel;
  }
  for (const light of ceilingLights) {
    light.intensity = (1.75 + Math.sin(t * 0.18) * 0.04) * lightingState.currentLevel;
  }
  ledMaterial.emissiveIntensity = 2.8 * lightingState.currentLevel;
  ledMaterial.opacity = 0.35 + lightingState.currentLevel * 0.65;
  for (const bar of wallSpotBars) {
    bar.visible = lightingState.currentLevel > 0.03;
  }
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
renderer.domElement.addEventListener("pointerdown", startTouchPan);
renderer.domElement.addEventListener("pointermove", moveTouchPan);
renderer.domElement.addEventListener("pointerup", endTouchPan);
renderer.domElement.addEventListener("pointercancel", endTouchPan);
requestAnimationFrame(animate);
