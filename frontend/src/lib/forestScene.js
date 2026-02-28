import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sky gradient shader  (top → horizon → ground-haze)
// ─────────────────────────────────────────────────────────────────────────────
const SKY_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBot;
  uniform float uRadius;
  varying vec3 vWorldPos;
  void main() {
    float h = clamp((vWorldPos.y + uRadius * 0.1) / (uRadius * 1.1), 0.0, 1.0);
    vec3 col = h > 0.5
      ? mix(uMid, uTop, (h - 0.5) * 2.0)
      : mix(uBot, uMid, h * 2.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function buildSkyDome(radius) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uTop: { value: new THREE.Color(0x1a6dd4) },
      uMid: { value: new THREE.Color(0x87ceeb) },
      uBot: { value: new THREE.Color(0xd4e8c2) },
      uRadius: { value: radius }
    },
    side: THREE.BackSide,
    depthWrite: false
  });
  return new THREE.Mesh(geo, mat);
}

// ─────────────────────────────────────────────────────────────────────────────
// Procedural cloud cluster
// ─────────────────────────────────────────────────────────────────────────────
function buildCloud(scene, x, y, z, opacity) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true,
    opacity: opacity ?? 0.88, roughness: 1, metalness: 0, envMapIntensity: 0
  });
  const puffCount = 20 + Math.floor(Math.random() * 8);
  for (let i = 0; i < puffCount; i++) {
    const r = 4 + Math.random() * 5;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), mat);
    puff.position.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 8
    );
    puff.castShadow = false;
    group.add(puff);
  }
  group.position.set(x, y, z);
  group.userData.isCloud = true;
  group.userData.speed = 0.008 + Math.random() * 0.012;
  scene.add(group);
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sun  (5-layer: corona → glow → halo → disc → hot core)
// ─────────────────────────────────────────────────────────────────────────────
function buildSunDisc() {
  const group = new THREE.Group();
  const layers = [
    { r: 55, color: 0xffeea0, op: 0.06 },
    { r: 32, color: 0xffdd60, op: 0.18 },
    { r: 20, color: 0xfff0a0, op: 0.45 },
    { r: 12, color: 0xfffacd, op: 1.00 },
    { r: 6, color: 0xffffff, op: 1.00 }
  ];
  const mats = [];
  for (const l of layers) {
    const mat = new THREE.MeshBasicMaterial({
      color: l.color, transparent: true, opacity: l.op,
      side: THREE.DoubleSide, depthWrite: false
    });
    mats.push(mat);
    group.add(new THREE.Mesh(new THREE.CircleGeometry(l.r, 64), mat));
  }
  group.position.set(320, 260, -500);
  group.userData.isSun = true;
  group.userData.mats = mats;
  group.userData.defOps = layers.map((l) => l.op);
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Moon  (atmosphere + halo + disc + crescent shadow)
// ─────────────────────────────────────────────────────────────────────────────
function buildMoonDisc() {
  const group = new THREE.Group();
  const mkMat = (color, op) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });

  const atmMat = mkMat(0xd0d8ff, 0.0);
  const haloMat = mkMat(0xe8ecff, 0.0);
  const discMat = mkMat(0xdde4ff, 0.0);
  const shadMat = mkMat(0x06082a, 0.0);

  group.add(new THREE.Mesh(new THREE.CircleGeometry(40, 64), atmMat));
  group.add(new THREE.Mesh(new THREE.CircleGeometry(24, 64), haloMat));
  group.add(new THREE.Mesh(new THREE.CircleGeometry(14, 64), discMat));

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(12, 64), shadMat);
  shadow.position.set(6, 3, 0.1);
  group.add(shadow);

  group.position.set(-280, 240, -480);
  group.userData.isMoon = true;
  group.userData.mats = [atmMat, haloMat, discMat];
  group.userData.shadowMat = shadMat;
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Star field  (1 800 points, upper hemisphere)
// ─────────────────────────────────────────────────────────────────────────────
function buildStarField() {
  const N = 1800, R = 800;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.48;
    pos[i * 3] = R * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = R * Math.cos(phi) + 30;
    pos[i * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.8, color: 0xffffff, transparent: true, opacity: 0.0,
    depthWrite: false, sizeAttenuation: false
  });
  const stars = new THREE.Points(geo, mat);
  stars.userData.mat = mat;
  return stars;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scene
// ─────────────────────────────────────────────────────────────────────────────
export function initializeForestScene(config) {
  const {
    mountEl,
    api,
    focusFilename = "",
    onSpawnStart = () => { },
    onSpawnEnd = () => { },
    onStatusChange = () => { },
    onCountChange = () => { },
    onFocusModeChange = () => { }
  } = config;
  const normalizeFilename = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const noQuery = raw.split("?")[0];
    const tail = noQuery.split("/").pop() || "";
    try {
      return decodeURIComponent(tail);
    } catch (_) {
      return tail;
    }
  };
  let pendingFocusFilename = normalizeFilename(focusFilename);

  // ── Textures ────────────────────────────────────────────────────────────────
  const loader = new THREE.TextureLoader();
  const grassTex = loader.load("https://threejs.org/examples/textures/terrain/grasslight-big.jpg");
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(30, 30);

  const waterNorm = loader.load("https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg");
  waterNorm.wrapS = waterNorm.wrapT = THREE.RepeatWrapping;
  waterNorm.repeat.set(2, 30);

  // ── Scene / Camera / Renderer ────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.0025);

  const width = mountEl.clientWidth || window.innerWidth;
  const height = mountEl.clientHeight || window.innerHeight;
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(0, 30, 80);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mountEl.appendChild(renderer.domElement);

  // ── Sky Dome ─────────────────────────────────────────────────────────────────
  const skyDome = buildSkyDome(900);
  scene.add(skyDome);

  // ── Sun / Moon / Stars ───────────────────────────────────────────────────────
  const sunDisc = buildSunDisc(); scene.add(sunDisc);
  const moonDisc = buildMoonDisc(); scene.add(moonDisc);
  const starField = buildStarField(); scene.add(starField);

  // ── Clouds ───────────────────────────────────────────────────────────────────
  const clouds = [];
  const CLOUD_BOUNDS = { xMin: -240, xMax: 240, zMin: -240, zMax: 240, yMin: 72, yMax: 118 };
  const CLOUD_GRID = { cols: 5, rows: 4 };
  const xStep = (CLOUD_BOUNDS.xMax - CLOUD_BOUNDS.xMin) / CLOUD_GRID.cols;
  const zStep = (CLOUD_BOUNDS.zMax - CLOUD_BOUNDS.zMin) / CLOUD_GRID.rows;

  for (let row = 0; row < CLOUD_GRID.rows; row++) {
    for (let col = 0; col < CLOUD_GRID.cols; col++) {
      const cx = CLOUD_BOUNDS.xMin + xStep * (col + 0.5) + (Math.random() - 0.5) * xStep * 0.55;
      const cz = CLOUD_BOUNDS.zMin + zStep * (row + 0.5) + (Math.random() - 0.5) * zStep * 0.55;
      const cy = CLOUD_BOUNDS.yMin + Math.random() * (CLOUD_BOUNDS.yMax - CLOUD_BOUNDS.yMin);
      const cloud = buildCloud(scene, cx, cy, cz);
      cloud.userData.baseY = cy;
      cloud.userData.phase = Math.random() * Math.PI * 2;
      cloud.userData.wrapMinX = CLOUD_BOUNDS.xMin - 70;
      cloud.userData.wrapMaxX = CLOUD_BOUNDS.xMax + 70;
      cloud.userData.zMin = CLOUD_BOUNDS.zMin;
      cloud.userData.zMax = CLOUD_BOUNDS.zMax;
      clouds.push(cloud);
    }
  }

  // ── Lights ───────────────────────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0xfff4e0, 0.9);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff6d0, 2.8);
  sunLight.position.set(320, 260, -500);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -250; sunLight.shadow.camera.right = 250;
  sunLight.shadow.camera.top = 250; sunLight.shadow.camera.bottom = -250;
  sunLight.shadow.bias = -0.0003;
  scene.add(sunLight);

  const fillLight = new THREE.HemisphereLight(0x87ceeb, 0x3d6b3d, 0.55);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffc87a, 0.4);
  rimLight.position.set(-100, 30, 200);
  scene.add(rimLight);

  // ── River helper ─────────────────────────────────────────────────────────────
  function getRiverCenterX(wz) { return Math.sin(wz * 0.02) * 32; }

  // ── Ground  (valley-shaped) ──────────────────────────────────────────────────
  //  world-Y of vertex = ground.position.y(-0.1) + Z_attr
  //  River surface = y 0.5   (Z_attr 0.6 at water edge)
  //  Valley targets:
  //    d < 11 (riverbed) : Z_attr = 0.1  → world-Y 0.0
  //    11 < d < 26 (bank): Z_attr climbs 0.6 → 1.3
  //    d > 26             : normal rolling noise
  const RIVER_HALF = 11, BANK_HALF = 26;

  const groundGeo = new THREE.PlaneGeometry(500, 500, 80, 80);
  const posAttr = groundGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const gx = posAttr.getX(i);
    const gyPlane = posAttr.getY(i);
    const worldZ = -gyPlane;                 // plane-Y → world -Z after rotation.x=-PI/2
    const base =
      Math.sin(gx * 0.07) * Math.cos(worldZ * 0.06) * 1.0 +
      Math.sin(gx * 0.18 + worldZ * 0.14) * 0.35 +
      Math.cos(gx * 0.04 - worldZ * 0.09) * 0.55;

    const rxc = getRiverCenterX(worldZ);
    const dist = Math.abs(gx - rxc);

    let zA;
    if (dist < RIVER_HALF) {
      zA = 0.1;
    } else if (dist < BANK_HALF) {
      const t = (dist - RIVER_HALF) / (BANK_HALF - RIVER_HALF);
      const tgt = 0.6 + t * 0.7;
      zA = tgt + base * t * t * 0.4;
    } else {
      zA = base;
    }
    posAttr.setZ(i, zA);
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, color: 0x4a7c3f, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  // â”€â”€ Distant background (outside playable map) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const farGroundGeo = new THREE.PlaneGeometry(1700, 1700, 56, 56);
  const farPos = farGroundGeo.attributes.position;
  for (let i = 0; i < farPos.count; i++) {
    const gx = farPos.getX(i);
    const gyPlane = farPos.getY(i);
    const dist = Math.hypot(gx, gyPlane);
    const noise =
      Math.sin(gx * 0.012) * 1.8 +
      Math.cos(gyPlane * 0.015) * 1.4 +
      Math.sin((gx + gyPlane) * 0.009) * 1.2;
    const rimRise = Math.max(0, (dist - 280) / 520) * 13;
    farPos.setZ(i, noise + rimRise);
  }
  farGroundGeo.computeVertexNormals();

  const farGroundMat = new THREE.MeshStandardMaterial({
    color: 0x607b59, roughness: 1.0, metalness: 0.0
  });
  const farGround = new THREE.Mesh(farGroundGeo, farGroundMat);
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.y = -14;
  farGround.receiveShadow = false;
  scene.add(farGround);

  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x7f96a8, roughness: 1.0, metalness: 0.0,
    transparent: true, opacity: 0.44, depthWrite: false
  });
  const distantMountains = new THREE.Group();
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
    const radius = 620 + Math.random() * 520;
    const h = 26 + Math.random() * 54;
    const base = 22 + Math.random() * 32;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(base, h, 14), mountainMat);
    mountain.position.set(Math.cos(a) * radius, -16 + h * 0.42, Math.sin(a) * radius);
    mountain.scale.set(1.1 + Math.random() * 1.2, 1, 1);
    mountain.rotation.y = Math.random() * Math.PI * 2;
    mountain.castShadow = false;
    mountain.receiveShadow = false;
    distantMountains.add(mountain);
  }
  scene.add(distantMountains);

  const distantTreeMat = new THREE.MeshStandardMaterial({
    color: 0x355a39, roughness: 0.95, metalness: 0.0,
    transparent: true, opacity: 0.58, depthWrite: false
  });
  const distantTrees = new THREE.Group();
  for (let i = 0; i < 110; i++) {
    const a = Math.random() * Math.PI * 2;
    const radius = 560 + Math.random() * 560;
    const h = 6 + Math.random() * 11;
    const r = 1.2 + Math.random() * 2.0;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), distantTreeMat);
    tree.position.set(Math.cos(a) * radius, -16 + h * 0.45, Math.sin(a) * radius);
    tree.rotation.y = Math.random() * Math.PI * 2;
    tree.castShadow = false;
    tree.receiveShadow = false;
    distantTrees.add(tree);
  }
  scene.add(distantTrees);

  // ── River ────────────────────────────────────────────────────────────────────
  const RIVER_W = 22, SEG = 240;
  const curve = [];
  for (let i = 0; i <= SEG; i++) {
    const z = (i / SEG - 0.5) * 500;
    curve.push(new THREE.Vector3(getRiverCenterX(z), 0.5, z));
  }
  const riverPath = new THREE.CatmullRomCurve3(curve);
  const rVerts = [], rUVs = [], rIdx = [];
  const pts = riverPath.getSpacedPoints(SEG);
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const tan = i < pts.length - 1
      ? pts[i + 1].clone().sub(pt).normalize()
      : pt.clone().sub(pts[i - 1]).normalize();
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(RIVER_W / 2);
    rVerts.push(pt.x - right.x, pt.y, pt.z - right.z, pt.x + right.x, pt.y, pt.z + right.z);
    const vp = i / SEG;
    rUVs.push(0, vp, 1, vp);
    if (i < SEG) {
      const b = i * 2;
      rIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute("position", new THREE.Float32BufferAttribute(rVerts, 3));
  riverGeo.setAttribute("uv", new THREE.Float32BufferAttribute(rUVs, 2));
  riverGeo.setIndex(rIdx);
  riverGeo.computeVertexNormals();

  const riverMat = new THREE.MeshPhongMaterial({
    color: 0x1a88dd, emissive: 0x001a33, normalMap: waterNorm,
    shininess: 200, transparent: true, opacity: 0.86,
    depthWrite: false, side: THREE.DoubleSide
  });
  const river = new THREE.Mesh(riverGeo, riverMat);
  river.renderOrder = 1;
  scene.add(river);

  // ── Riverbank rocks ──────────────────────────────────────────────────────────
  function spawnBankRock(x, z) {
    const sz = 0.5 + Math.random() * 1.2;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(sz, 1),
      new THREE.MeshStandardMaterial({ color: 0x808070, roughness: 0.9, metalness: 0.04 })
    );
    rock.position.set(x, 0.4 + Math.random() * 0.3, z);
    rock.scale.set(1 + Math.random() * 0.4, 0.4 + Math.random() * 0.35, 1 + Math.random() * 0.4);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI);
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
  }
  for (let i = 0; i < 420; i++) {
    const wz = (Math.random() - 0.5) * 480;
    const side = Math.random() < 0.5 ? 1 : -1;
    const off = (11 + Math.random() * 9) * side;
    spawnBankRock(getRiverCenterX(wz) + off + (Math.random() - 0.5) * 2, wz);
  }

  // ── Trees ────────────────────────────────────────────────────────────────────
  function createTree(x, z) {
    const g = new THREE.Group();
    const trunkH = 3.5 + Math.random() * 2.5;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.72, trunkH, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a2511, roughness: 0.97 })
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = trunk.receiveShadow = true;
    g.add(trunk);

    const leafCols = [0x295c30, 0x1a4728, 0x3a7a3a, 0x2e6644];
    const lm = new THREE.MeshStandardMaterial({
      color: leafCols[Math.floor(Math.random() * leafCols.length)], roughness: 0.88
    });
    const layers = [
      { r: 3.6, h: 5.0, y: trunkH + 1.8 },
      { r: 2.8, h: 4.2, y: trunkH + 4.0 },
      { r: 1.8, h: 3.0, y: trunkH + 6.2 }
    ];
    for (const l of layers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(l.r, l.h, 8), lm);
      cone.position.y = l.y;
      cone.castShadow = true;
      g.add(cone);
    }
    const sc = 0.75 + Math.random() * 0.45;
    g.scale.set(sc, sc, sc);
    g.rotation.y = Math.random() * Math.PI * 2;
    g.position.set(x, 0, z);
    scene.add(g);
  }

  // ── Rocks ────────────────────────────────────────────────────────────────────
  function createRock(x, z) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1 + Math.random() * 0.8, 1),
      new THREE.MeshStandardMaterial({ color: 0x666655, roughness: 0.88, metalness: 0.05 })
    );
    rock.position.set(x, 0.5, z);
    rock.scale.set(1 + Math.random(), 0.55 + Math.random() * 0.55, 1 + Math.random());
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
  }

  // ── Flowers ──────────────────────────────────────────────────────────────────
  function createFlower(x, z) {
    const flowerColors = [0xff3070, 0xffcc00, 0xff6090, 0x00eeff, 0xcc44ff];
    const col = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5),
      new THREE.MeshStandardMaterial({ color: 0x3a8a3a })
    );
    stem.position.set(x, 0.3, z);
    scene.add(stem);

    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4 })
    );
    bloom.position.set(x, 0.65, z);
    scene.add(bloom);
  }

  // ── Populate ─────────────────────────────────────────────────────────────────
  for (let i = 0; i < 130; i++) {
    const x = (Math.random() - 0.5) * 400;
    const z = (Math.random() - 0.5) * 400;
    if (Math.abs(x - getRiverCenterX(z)) < 24) continue;
    createTree(x, z);
  }
  for (let i = 0; i < 70; i++) {
    const x = (Math.random() - 0.5) * 350;
    const z = (Math.random() - 0.5) * 350;
    if (Math.abs(x - getRiverCenterX(z)) < 22) continue;
    createRock(x, z);
  }
  for (let i = 0; i < 180; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x - getRiverCenterX(z)) < 22) continue;
    createFlower(x, z);
  }

  // ── Rain particles ───────────────────────────────────────────────────────────
  const RAIN_N = 8000;
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N * 3; i += 3) {
    rainPos[i] = (Math.random() - 0.5) * 400;
    rainPos[i + 1] = Math.random() * 120;
    rainPos[i + 2] = (Math.random() - 0.5) * 400;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    size: 0.18, color: 0x99bbff, transparent: true, opacity: 0.0, depthWrite: false
  });
  scene.add(new THREE.Points(rainGeo, rainMat));

  // ── Snow particles ───────────────────────────────────────────────────────────
  const SNOW_N = 5000;
  const snowPos = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N * 3; i += 3) {
    snowPos[i] = (Math.random() - 0.5) * 400;
    snowPos[i + 1] = Math.random() * 100;
    snowPos[i + 2] = (Math.random() - 0.5) * 400;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({
    size: 0.5, color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false
  });
  scene.add(new THREE.Points(snowGeo, snowMat));

  // ── Fireflies ────────────────────────────────────────────────────────────────
  const FF_N = 500;
  const ffPos = new Float32Array(FF_N * 3);
  for (let i = 0; i < FF_N * 3; i += 3) {
    ffPos[i] = (Math.random() - 0.5) * 280;
    ffPos[i + 1] = 1 + Math.random() * 14;
    ffPos[i + 2] = (Math.random() - 0.5) * 280;
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute("position", new THREE.BufferAttribute(ffPos, 3));
  const fireflyMat = new THREE.PointsMaterial({
    size: 0.32, color: 0xeeff88, transparent: true, opacity: 0.0, depthWrite: false
  });
  const fireflies = new THREE.Points(ffGeo, fireflyMat);
  scene.add(fireflies);

  // ── Animal spawning ──────────────────────────────────────────────────────────
  const spawnedAnimals = new Set();
  const renderedAnimals = new Set();
  const spawnQueue = [];
  let isSpawning = false;
  let destroyed = false;
  let initialSyncDone = false;
  let pendingFocusHoldMs = 0;
  let focusReleaseTimer = null;

  function toDisplayName(animalData) {
    const rawOwner = String(animalData?.owner_name || "").trim();
    if (rawOwner) return rawOwner;
    const fallback = normalizeFilename(animalData?.filename || "").replace(/\.[^.]+$/, "");
    return fallback || "Unknown";
  }

  function hashLabel(label) {
    let h = 0;
    for (let i = 0; i < label.length; i++) h = ((h << 5) - h + label.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function buildNameTagSprite(text) {
    const label = String(text || "Unknown").slice(0, 24);
    const candyThemes = [
      { a: "#ffd6e8", b: "#ffc8a8", border: "#ffffff", text: "#6f2b5c" },
      { a: "#d8f6ff", b: "#bce9ff", border: "#ffffff", text: "#1f4f73" },
      { a: "#e6ffd8", b: "#ccf2b7", border: "#ffffff", text: "#2d5f2f" },
      { a: "#fff3c4", b: "#ffe39c", border: "#ffffff", text: "#6b4c1e" },
      { a: "#ece2ff", b: "#d7c4ff", border: "#ffffff", text: "#4d3b79" },
    ];
    const theme = candyThemes[hashLabel(label) % candyThemes.length];
    const canvas = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fontSize = 14;
    const padX = 11;
    const padY = 7;
    const iconSpace = 14;
    const ctx = canvas.getContext("2d");
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    const textWidth = Math.ceil(ctx.measureText(label).width);
    const logicalWidth = textWidth + padX * 2 + iconSpace;
    const logicalHeight = fontSize + padY * 2;
    canvas.width = Math.ceil(logicalWidth * dpr);
    canvas.height = Math.ceil(logicalHeight * dpr);

    const paint = canvas.getContext("2d");
    paint.scale(dpr, dpr);
    paint.font = `600 ${fontSize}px Inter, sans-serif`;
    paint.textBaseline = "middle";
    const h = logicalHeight;
    const w = logicalWidth;

    // Candy badge.
    const bg = paint.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, theme.a);
    bg.addColorStop(1, theme.b);
    paint.fillStyle = bg;
    paint.strokeStyle = "rgba(255,255,255,0.92)";
    paint.lineWidth = 1.2;
    paint.shadowColor = "rgba(38, 38, 80, 0.20)";
    paint.shadowBlur = 6;
    paint.beginPath();
    paint.roundRect(0.5, 0.5, w - 1, h - 1, 10);
    paint.fill();
    paint.stroke();

    // Top gloss.
    paint.shadowBlur = 0;
    paint.fillStyle = "rgba(255,255,255,0.33)";
    paint.beginPath();
    paint.roundRect(2, 2, w - 4, h * 0.42, 8);
    paint.fill();

    // Star icon.
    const cy = h / 2;
    const cx = padX + 5;
    paint.fillStyle = "#fff7a8";
    paint.strokeStyle = "rgba(255, 220, 80, 0.9)";
    paint.lineWidth = 1;
    paint.beginPath();
    paint.moveTo(cx, cy - 4.2);
    paint.lineTo(cx + 1.5, cy - 1.2);
    paint.lineTo(cx + 4.8, cy - 0.8);
    paint.lineTo(cx + 2.3, cy + 1.3);
    paint.lineTo(cx + 3.1, cy + 4.5);
    paint.lineTo(cx, cy + 2.7);
    paint.lineTo(cx - 3.1, cy + 4.5);
    paint.lineTo(cx - 2.3, cy + 1.3);
    paint.lineTo(cx - 4.8, cy - 0.8);
    paint.lineTo(cx - 1.5, cy - 1.2);
    paint.closePath();
    paint.fill();
    paint.stroke();

    paint.shadowBlur = 0;
    paint.fillStyle = theme.text;
    paint.fillText(label, padX + iconSpace, h / 2 + 0.2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 20;
    const baseHeight = 1.15;
    const aspect = logicalWidth / Math.max(1, logicalHeight);
    sprite.scale.set(baseHeight * aspect, baseHeight, 1);
    sprite.center.set(0.5, 0);
    return sprite;
  }

  function buildCleanTextureFromImage(image) {
    try {
      const w = Number(image?.width || 0);
      const h = Number(image?.height || 0);
      if (!w || !h) return null;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Estimate matte color from 4 corners (typical residual background area).
      const sampleSize = Math.max(4, Math.floor(Math.min(w, h) * 0.06));
      const corners = [
        [0, 0],
        [w - sampleSize, 0],
        [0, h - sampleSize],
        [w - sampleSize, h - sampleSize],
      ];
      let sr = 0, sg = 0, sb = 0, count = 0;
      for (const [sx, sy] of corners) {
        for (let y = sy; y < sy + sampleSize; y++) {
          for (let x = sx; x < sx + sampleSize; x++) {
            const i = (y * w + x) * 4;
            sr += data[i];
            sg += data[i + 1];
            sb += data[i + 2];
            count += 1;
          }
        }
      }
      if (!count) return null;
      const kr = sr / count;
      const kg = sg / count;
      const kb = sb / count;

      const hard = 20;
      const soft = 58;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const dr = data[i] - kr;
        const dg = data[i + 1] - kg;
        const db = data[i + 2] - kb;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist <= hard) {
          data[i + 3] = 0;
        } else if (dist < soft) {
          const t = (dist - hard) / (soft - hard);
          data[i + 3] = Math.min(data[i + 3], Math.round(255 * t));
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    } catch (_) {
      return null;
    }
  }

  function createAnimalSprite(animalData) {
    loader.load(api.assetUrl(animalData.url), (texture) => {
      if (destroyed) return;
      
      const processed = buildCleanTextureFromImage(texture.image);
      const mat = new THREE.SpriteMaterial({
        map: processed || texture,
        transparent: true,
        alphaTest: 0.05,
      });
      
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0, 0, 0);

      let x, y, z;
      if (animalData.type === "sky") {
        x = (Math.random() - 0.5) * 150;
        y = 22 + Math.random() * 12;
        z = (Math.random() - 0.5) * 150;
      } else if (animalData.type === "water") {
        z = (Math.random() - 0.5) * 350;
        x = getRiverCenterX(z) + (Math.random() - 0.5) * 8;
        y = 1.5;
        sprite.material.color.setHex(0x88ccff);
      } else {
        do {
          x = (Math.random() - 0.5) * 360;
          z = (Math.random() - 0.5) * 360;
        } while (Math.abs(x - getRiverCenterX(z)) < 26);
        y = 2.5;
      }
      
      sprite.position.set(x, y, z);
      sprite.userData = {
        type: animalData.type,
        offset: Math.random() * 100,
        targetScale: 5,
        filename: animalData.filename
      };

      const nameTag = buildNameTagSprite(toDisplayName(animalData));
      nameTag.position.set(x, y + 4.8, z);
      scene.add(nameTag);
      sprite.userData.nameTag = nameTag;
      
      scene.add(sprite);
      renderedAnimals.add(animalData.filename);
      onCountChange(spawnedAnimals.size);
      reportForestState();
      
      if (pendingFocusFilename && pendingFocusFilename === normalizeFilename(animalData.filename)) {
        focusOnAnimal(pendingFocusFilename, { holdMs: pendingFocusHoldMs });
      }
    });
  }

  async function processSpawnQueue() {
    if (destroyed || isSpawning || spawnQueue.length === 0) return;
    isSpawning = true;
    const animal = spawnQueue.shift();
    onSpawnStart(animal);
    await sleep(6200);
    if (destroyed) return;
    onSpawnEnd();
    createAnimalSprite(animal);
    onStatusChange(`Spawned: ${animal.filename}`);
    focusOnAnimal(animal.filename, { holdMs: 5000 });
    isSpawning = false;
    processSpawnQueue();
  }

  async function listenForSpawn() {
    try {
      const resp = await api.getLatestAnimals();
      if (!resp.ok) throw new Error("latest_animals failed");
      const animals = Array.isArray((resp.data || {}).items) ? resp.data.items : [];
      if (!initialSyncDone) {
        for (const a of animals) {
          if (spawnedAnimals.has(a.filename)) continue;
          spawnedAnimals.add(a.filename);
          createAnimalSprite(a);
        }
        initialSyncDone = true;
        onStatusChange("Initial forest sync complete");
        return;
      }
      for (const a of animals) {
        if (!spawnedAnimals.has(a.filename)) {
          spawnedAnimals.add(a.filename);
          spawnQueue.push(a);
        }
      }
      processSpawnQueue();
    } catch (_) {
      onStatusChange("Spawn listener disconnected");
    }
  }

  async function reportForestState() {
    try { await api.reportForestState(Array.from(renderedAnimals)); } catch (_) { }
  }

  // ── Sky colors helper ────────────────────────────────────────────────────────
  function setSkyColors(top, mid, bot, fogColor, fogDensity) {
    const u = skyDome.material.uniforms;
    u.uTop.value.setHex(top);
    u.uMid.value.setHex(mid);
    u.uBot.value.setHex(bot);
    scene.fog.color.setHex(fogColor);
    scene.fog.density = fogDensity;
    renderer.setClearColor(fogColor);
  }

  // ── Time mode ────────────────────────────────────────────────────────────────
  let currentTimeMode = "morning";
  let currentWeatherMode = "sunny";

  function applyTimeMode(mode) {
    currentTimeMode = mode;
    if (mode === "morning") {
      setSkyColors(0x1a6dd4, 0x87ceeb, 0xd4e8c2, 0x87ceeb, 0.0025);
      ambientLight.color.setHex(0xfff4e0); ambientLight.intensity = 0.9;
      sunLight.color.setHex(0xfff6d0); sunLight.intensity = 2.8;
      sunLight.position.set(320, 260, -500);
      fillLight.color.setHex(0x87ceeb);
      fillLight.groundColor.setHex(0x3d6b3d); fillLight.intensity = 0.55;
      fireflyMat.opacity = 0.0;
      riverMat.color.setHex(0x1a88dd); riverMat.emissive.setHex(0x001a33);
      farGroundMat.color.setHex(0x587554);
      mountainMat.color.setHex(0x8da5b8);
      distantTreeMat.color.setHex(0x3e6645);
      renderer.toneMappingExposure = 1.15;
      // sun on
      sunDisc.visible = true;
      sunDisc.userData.mats.forEach((m, i) => { m.opacity = sunDisc.userData.defOps[i]; });
      // moon + stars off
      moonDisc.userData.mats.forEach((m) => { m.opacity = 0.0; });
      moonDisc.userData.shadowMat.opacity = 0.0;
      starField.userData.mat.opacity = 0.0;
      // clouds white
      for (const c of clouds) c.children.forEach((m) => {
        if (m.material) { m.material.color.setHex(0xffffff); m.material.opacity = 0.88; }
      });
    } else {
      setSkyColors(0x02051a, 0x060c2a, 0x0a1a10, 0x030811, 0.006);
      ambientLight.color.setHex(0x1a2244); ambientLight.intensity = 0.3;
      sunLight.color.setHex(0x8899cc); sunLight.intensity = 0.35;
      sunLight.position.set(-120, 150, -200);
      fillLight.color.setHex(0x080c22);
      fillLight.groundColor.setHex(0x0c1a0c); fillLight.intensity = 0.18;
      fireflyMat.opacity = 0.9;
      riverMat.color.setHex(0x0f2244); riverMat.emissive.setHex(0x001833);
      farGroundMat.color.setHex(0x162027);
      mountainMat.color.setHex(0x2c3a4a);
      distantTreeMat.color.setHex(0x1a2f29);
      renderer.toneMappingExposure = 0.65;
      // sun off
      sunDisc.visible = false;
      sunDisc.userData.mats.forEach((m) => { m.opacity = 0.0; });
      // moon on
      moonDisc.userData.mats[0].opacity = 0.12;
      moonDisc.userData.mats[1].opacity = 0.38;
      moonDisc.userData.mats[2].opacity = 0.96;
      moonDisc.userData.shadowMat.opacity = 1.0;
      // stars on
      starField.userData.mat.opacity = 0.88;
      // clouds dark-blue
      for (const c of clouds) c.children.forEach((m) => {
        if (m.material) { m.material.color.setHex(0x3a4c70); m.material.opacity = 0.55; }
      });
    }
  }

  // ── Weather mode ─────────────────────────────────────────────────────────────
  function applyWeatherMode(mode) {
    currentWeatherMode = mode;
    rainMat.opacity = 0.0;
    snowMat.opacity = 0.0;

    if (mode === "rain") {
      rainMat.opacity = 0.52;
      if (currentTimeMode === "morning") {
        setSkyColors(0x4a6a80, 0x6a8fa8, 0x8aaa9a, 0x6a8fa8, 0.007);
        farGroundMat.color.setHex(0x4f6460);
        mountainMat.color.setHex(0x708596);
        distantTreeMat.color.setHex(0x3a5747);
      } else {
        setSkyColors(0x030810, 0x080e1a, 0x090e10, 0x060c14, 0.009);
        farGroundMat.color.setHex(0x111921);
        mountainMat.color.setHex(0x1f2c39);
        distantTreeMat.color.setHex(0x152622);
      }
    } else if (mode === "snow") {
      snowMat.opacity = 0.7;
      if (currentTimeMode === "morning") {
        setSkyColors(0x8aa8c4, 0xc4d8e8, 0xd8e8e8, 0xc4d8e8, 0.005);
        groundMat.color.setHex(0xd0e0d8);
        farGroundMat.color.setHex(0xb7c4c1);
        mountainMat.color.setHex(0xcbd7e2);
        distantTreeMat.color.setHex(0x7d95a6);
      } else {
        setSkyColors(0x080c18, 0x0e1528, 0x101820, 0x0c1220, 0.007);
        groundMat.color.setHex(0x6080a0);
        farGroundMat.color.setHex(0x455567);
        mountainMat.color.setHex(0x74879d);
        distantTreeMat.color.setHex(0x465f6f);
      }
    } else {
      groundMat.color.setHex(0x4a7c3f);
      applyTimeMode(currentTimeMode);
    }
  }

  // ── Orbit controls ───────────────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.22;
  controls.minDistance = 10;
  controls.maxDistance = 400;
  controls.maxPolarAngle = Math.PI / 2.05;
  const defaultCameraPosition = new THREE.Vector3(0, 30, 80);
  const defaultControlTarget = new THREE.Vector3(0, 8, 0);
  const defaultCameraZoom = camera.zoom;
  camera.position.copy(defaultCameraPosition);
  controls.target.copy(defaultControlTarget);
  camera.zoom = defaultCameraZoom;
  camera.updateProjectionMatrix();
  controls.update();
  controls.saveState();
  let focusActive = false;
  let freeCameraPosition = camera.position.clone();
  let freeControlTarget = controls.target.clone();
  let freeAutoRotate = controls.autoRotate;

  function releaseFocus(options = {}) {
    const toInitial = Boolean(options.toInitial);
    if (focusReleaseTimer) {
      clearTimeout(focusReleaseTimer);
      focusReleaseTimer = null;
    }
    pendingFocusFilename = "";
    pendingFocusHoldMs = 0;
    if (toInitial) {
      camera.position.copy(defaultCameraPosition);
      controls.target.copy(defaultControlTarget);
      camera.zoom = defaultCameraZoom;
      camera.updateProjectionMatrix();
      controls.autoRotate = true;
    } else if (focusActive) {
      camera.position.copy(freeCameraPosition);
      controls.target.copy(freeControlTarget);
      controls.autoRotate = false;
    } else {
      camera.position.copy(defaultCameraPosition);
      controls.target.copy(defaultControlTarget);
      controls.autoRotate = false;
    }
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    focusActive = false;
    controls.update();
    onFocusModeChange(false);
    onStatusChange("Free camera mode");
  }

  function resetToInitialCamera() {
    releaseFocus({ toInitial: true });
    onStatusChange("Initial camera view");
  }

  function focusOnAnimal(filename, options = {}) {
    const holdMs = Math.max(0, Number(options.holdMs || 0));
    const wanted = normalizeFilename(filename);
    if (!wanted) return false;
    let targetSprite = null;
    scene.traverse((obj) => {
      if (targetSprite) return;
      if (!obj?.isSprite) return;
      if (normalizeFilename(obj.userData?.filename) === wanted) targetSprite = obj;
    });
    if (!targetSprite) {
      pendingFocusFilename = wanted;
      pendingFocusHoldMs = holdMs;
      return false;
    }

    const p = targetSprite.position.clone();
    const offset = new THREE.Vector3(0, 12, 26);
    if (!focusActive) {
      freeCameraPosition = camera.position.clone();
      freeControlTarget = controls.target.clone();
      freeAutoRotate = controls.autoRotate;
    }
    camera.position.copy(p.clone().add(offset));
    controls.target.copy(p);
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.autoRotate = false;
    focusActive = true;
    controls.update();
    pendingFocusFilename = "";
    pendingFocusHoldMs = 0;
    onFocusModeChange(true);
    onStatusChange(`Focused on: ${wanted}`);
    if (focusReleaseTimer) {
      clearTimeout(focusReleaseTimer);
      focusReleaseTimer = null;
    }
    if (holdMs > 0) {
      focusReleaseTimer = setTimeout(() => {
        releaseFocus();
      }, holdMs);
    }
    return true;
  }

  // ── Animate ──────────────────────────────────────────────────────────────────
  let rafId = 0;
  function animate() {
    if (destroyed) return;
    rafId = requestAnimationFrame(animate);
    const now = Date.now() * 0.001;

    // Water ripple
    waterNorm.offset.y -= 0.0018;
    waterNorm.offset.x += 0.0004;

    // Fireflies
    fireflies.rotation.y += 0.0003;
    fireflies.position.y = Math.sin(now * 0.25) * 1.8;

    // Clouds drift
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed;
      if (cloud.position.x > cloud.userData.wrapMaxX) {
        cloud.position.x = cloud.userData.wrapMinX;
        cloud.position.z = cloud.userData.zMin + Math.random() * (cloud.userData.zMax - cloud.userData.zMin);
        cloud.userData.baseY = CLOUD_BOUNDS.yMin + Math.random() * (CLOUD_BOUNDS.yMax - CLOUD_BOUNDS.yMin);
      }
      cloud.position.y = cloud.userData.baseY + Math.sin(now * 0.18 + cloud.userData.phase) * 1.1;
    }

    // Sun / moon always face camera (billboard)
    if (sunDisc.visible) sunDisc.quaternion.copy(camera.quaternion);
    moonDisc.quaternion.copy(camera.quaternion);

    // Rain
    if (rainMat.opacity > 0) {
      const rp = rainGeo.attributes.position.array;
      for (let i = 1; i < rp.length; i += 3) {
        rp[i] -= 1.4;
        if (rp[i] < -5) rp[i] = 110;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // Snow
    if (snowMat.opacity > 0) {
      const sp = snowGeo.attributes.position.array;
      for (let i = 0; i < sp.length; i += 3) {
        sp[i] += Math.sin(now * 0.5 + sp[i + 2]) * 0.04;
        sp[i + 1] -= 0.22;
        if (sp[i + 1] < -5) sp[i + 1] = 95;
      }
      snowGeo.attributes.position.needsUpdate = true;
    }

    // Animal sprites
    scene.traverse((obj) => {
      if (obj.isSprite && obj.userData.type) {
        // Handle scaling in
        if (obj.scale.x < obj.userData.targetScale && !obj.userData.fullySpawned) {
           obj.scale.set(obj.scale.x + 0.1, obj.scale.y + 0.1, 1);
           if (obj.scale.x >= obj.userData.targetScale) obj.userData.fullySpawned = true;
        }

        const off = obj.userData.offset;
        const baseScale = obj.userData.targetScale;
        
        // 1. Squash & Stretch (Scale X / Scale Y inversion)
        // 2. Wobble (Rotation Z)
        // 3. Hover / Move
        
        if (obj.userData.type === "sky") {
          // Sky animals: Fly around, gentle wing flap squash/stretch, slight tilt
          obj.position.x += Math.cos(now + off) * 0.05;
          obj.position.y += Math.sin(now * 2 + off) * 0.02;
          
          const flap = Math.sin(now * 8 + off);
          if (obj.userData.fullySpawned) {
            obj.scale.set(baseScale * (1 + flap * 0.05), baseScale * (1 - flap * 0.08), 1);
          }
          // Tilt into the turn direction
          obj.material.rotation = Math.cos(now + off) * -0.15;
          
        } else if (obj.userData.type === "water") {
          // Water animals: Swim forward, gentle wobble side to side, horizontal squash
          obj.position.z += Math.sin(now + off) * 0.04;
          
          const swim = Math.sin(now * 3 + off);
          if (obj.userData.fullySpawned) {
             obj.scale.set(baseScale * (1 - swim * 0.04), baseScale * (1 + swim * 0.04), 1);
          }
          obj.material.rotation = Math.sin(now * 2 + off) * 0.08;
          
        } else {
          // Ground animals: Jump/Bounce (Y position), strong squash on landing, stretch in air, wobble walking
          const hop = Math.abs(Math.sin(now * 4 + off)); // 0 to 1
           
          // Strong squash when on the ground (hop near 0), stretch when in air (hop near 1)
          const stretch = hop; 
          const squash = 1.0 - hop;
          
          if (obj.userData.fullySpawned) {
            // scale X: narrower in air, wider on ground
            // scale Y: taller in air, shorter on ground
            obj.scale.set(baseScale * (1 - stretch * 0.1 + squash * 0.15), baseScale * (1 + stretch * 0.2 - squash * 0.1), 1);
          }
          
          obj.position.y = 2.5 + hop * 1.5;
          
          // Wobble side to side
          obj.material.rotation = Math.sin(now * 4 + off) * 0.12; 
        }

        const nameTag = obj.userData.nameTag;
        if (nameTag?.isSprite) {
          nameTag.position.set(obj.position.x, obj.position.y + 4.8, obj.position.z);
          // Don't wobble the text, just fade it in
          nameTag.material.opacity = Math.min(1, Math.max(0, obj.scale.x / 2));
        }
      }
    });

    controls.update();
    renderer.render(scene, camera);
  }

  // ── Resize ───────────────────────────────────────────────────────────────────
  function handleResize() {
    if (destroyed) return;
    const w = mountEl.clientWidth || window.innerWidth;
    const h = mountEl.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  function handleKeydown(event) {
    if (event.key === "Escape") releaseFocus();
  }

  window.addEventListener("resize", handleResize);
  window.addEventListener("keydown", handleKeydown);
  applyTimeMode("morning");
  animate();
  listenForSpawn();
  const spawnInterval = setInterval(listenForSpawn, 2000);
  const reportInterval = setInterval(reportForestState, 3000);

  return {
    applyTimeMode,
    applyWeatherMode,
    focusOnAnimal,
    releaseFocus,
    resetToInitialCamera,
    cleanup: () => {
      destroyed = true;
      clearInterval(spawnInterval);
      clearInterval(reportInterval);
      if (focusReleaseTimer) clearTimeout(focusReleaseTimer);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeydown);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement?.parentNode === mountEl)
        mountEl.removeChild(renderer.domElement);
    }
  };
}
