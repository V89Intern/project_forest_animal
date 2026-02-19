import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function initializeForestScene(config) {
  const {
    mountEl,
    api,
    onSpawnStart = () => {},
    onSpawnEnd = () => {},
    onStatusChange = () => {},
    onCountChange = () => {}
  } = config;

  const textureLoader = new THREE.TextureLoader();
  const grassTexture = textureLoader.load("https://threejs.org/examples/textures/terrain/grasslight-big.jpg");
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(30, 30);

  const waterNormal = textureLoader.load("https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg");
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.repeat.set(2, 30);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x051015);
  scene.fog = new THREE.FogExp2(0x051015, 0.004);

  const width = mountEl.clientWidth || window.innerWidth;
  const height = mountEl.clientHeight || window.innerHeight;
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 30, 80);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mountEl.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
  scene.add(ambientLight);

  const moonLight = new THREE.DirectionalLight(0xaaccff, 0.8);
  moonLight.position.set(100, 150, 100);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 2048;
  moonLight.shadow.mapSize.height = 2048;
  moonLight.shadow.camera.left = -200;
  moonLight.shadow.camera.right = 200;
  moonLight.shadow.camera.top = 200;
  moonLight.shadow.camera.bottom = -200;
  scene.add(moonLight);

  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({
    map: grassTexture,
    color: 0x335533,
    roughness: 0.9
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  const riverWidth = 16;
  const segments = 200;
  const curvePoints = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const z = (t - 0.5) * 420;
    const x = Math.sin(z * 0.02) * 30;
    curvePoints.push(new THREE.Vector3(x, 0.1, z));
  }
  const riverPath = new THREE.CatmullRomCurve3(curvePoints);

  const riverGeo = new THREE.BufferGeometry();
  const vertices = [];
  const uvs = [];
  const indices = [];
  const pathPoints = riverPath.getSpacedPoints(segments);

  for (let i = 0; i < pathPoints.length; i += 1) {
    const point = pathPoints[i];
    let tangent;
    if (i < pathPoints.length - 1) tangent = pathPoints[i + 1].clone().sub(point).normalize();
    else tangent = point.clone().sub(pathPoints[i - 1]).normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(riverWidth / 2);

    vertices.push(point.x - right.x, point.y, point.z - right.z);
    vertices.push(point.x + right.x, point.y, point.z + right.z);

    const vProgress = i / segments;
    uvs.push(0, vProgress);
    uvs.push(1, vProgress);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }
  riverGeo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  riverGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  riverGeo.setIndex(indices);
  riverGeo.computeVertexNormals();

  const riverMat = new THREE.MeshPhongMaterial({
    color: 0x0088ff,
    emissive: 0x002244,
    normalMap: waterNormal,
    shininess: 100,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide
  });
  const river = new THREE.Mesh(riverGeo, riverMat);
  scene.add(river);

  function getRiverCenterX(z) {
    return Math.sin(z * 0.02) * 30;
  }

  function createTree(x, z) {
    const treeGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d2926 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1e5945, roughness: 0.8 });
    const bottomCone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4, 8), leavesMat);
    bottomCone.position.y = 4;
    bottomCone.castShadow = true;
    treeGroup.add(bottomCone);

    const topCone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 8), leavesMat);
    topCone.position.y = 6;
    topCone.castShadow = true;
    treeGroup.add(topCone);

    treeGroup.position.set(x, 0, z);
    treeGroup.rotation.y = Math.random() * Math.PI;
    const scale = 0.8 + Math.random() * 0.5;
    treeGroup.scale.set(scale, scale, scale);
    scene.add(treeGroup);
  }

  function createRock(x, z) {
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, 0.5, z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.scale.set(1 + Math.random(), 0.5 + Math.random() * 0.5, 1 + Math.random());
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(rock);
  }

  function createFlower(x, z) {
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5);
    const stemMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(x, 0.25, z);

    const bloomGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const colors = [0xff007f, 0x00ffff, 0xffff00];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const bloomMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2 });
    const bloom = new THREE.Mesh(bloomGeo, bloomMat);
    bloom.position.set(x, 0.5, z);
    const light = new THREE.PointLight(color, 0.5, 3);
    light.position.set(x, 0.5, z);
    scene.add(stem);
    scene.add(bloom);
    scene.add(light);
  }

  for (let i = 0; i < 120; i += 1) {
    const x = (Math.random() - 0.5) * 350;
    const z = (Math.random() - 0.5) * 350;
    if (Math.abs(x - getRiverCenterX(z)) < 10) continue;
    createTree(x, z);
  }

  for (let i = 0; i < 60; i += 1) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x - getRiverCenterX(z)) < 9) continue;
    createRock(x, z);
  }

  for (let i = 0; i < 150; i += 1) {
    const x = (Math.random() - 0.5) * 250;
    const z = (Math.random() - 0.5) * 250;
    if (Math.abs(x - getRiverCenterX(z)) < 9) continue;
    createFlower(x, z);
  }

  const fireflyGeo = new THREE.BufferGeometry();
  const fireflyCount = 400;
  const fireflyPos = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount * 3; i += 1) fireflyPos[i] = (Math.random() - 0.5) * 300;
  fireflyGeo.setAttribute("position", new THREE.BufferAttribute(fireflyPos, 3));
  const fireflyMat = new THREE.PointsMaterial({ size: 0.3, color: 0xffffaa, transparent: true, opacity: 0.8 });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
  scene.add(fireflies);

  const spawnedAnimals = new Set();
  const renderedAnimals = new Set();
  const spawnQueue = [];
  let isSpawning = false;
  let destroyed = false;

  function createAnimalSprite(animalData) {
    textureLoader.load(api.assetUrl(animalData.url), (texture) => {
      if (destroyed) return;
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0, 0, 0);
      sprite.castShadow = true;

      let x;
      let y;
      let z;
      if (animalData.type === "sky") {
        x = (Math.random() - 0.5) * 150;
        y = 20 + Math.random() * 10;
        z = (Math.random() - 0.5) * 150;
      } else if (animalData.type === "water") {
        z = (Math.random() - 0.5) * 350;
        x = getRiverCenterX(z) + (Math.random() - 0.5) * 6;
        y = 1.5;
        sprite.material.color.setHex(0x88ccff);
      } else {
        do {
          x = (Math.random() - 0.5) * 350;
          z = (Math.random() - 0.5) * 350;
        } while (Math.abs(x - getRiverCenterX(z)) < 12);
        y = 2.5;
      }

      sprite.position.set(x, y, z);
      sprite.userData = { type: animalData.type, offset: Math.random() * 100, targetScale: 5 };
      scene.add(sprite);
      renderedAnimals.add(animalData.filename);
      onCountChange(spawnedAnimals.size);
      reportForestState();
    });
  }

  async function processSpawnQueue() {
    if (destroyed || isSpawning || spawnQueue.length === 0) return;
    isSpawning = true;
    const animal = spawnQueue.shift();
    onSpawnStart(animal);
    await sleep(3000);
    if (destroyed) return;
    onSpawnEnd();
    createAnimalSprite(animal);
    onStatusChange(`Spawned: ${animal.filename}`);
    isSpawning = false;
    processSpawnQueue();
  }

  async function listenForSpawn() {
    try {
      const resp = await api.getLatestAnimals();
      if (!resp.ok) throw new Error("latest_animals failed");
      const payload = resp.data || {};
      const animals = Array.isArray(payload.items) ? payload.items : [];
      for (const animal of animals) {
        if (!spawnedAnimals.has(animal.filename)) {
          spawnedAnimals.add(animal.filename);
          spawnQueue.push(animal);
        }
      }
      processSpawnQueue();
    } catch (_err) {
      onStatusChange("Spawn listener disconnected");
    }
  }

  async function reportForestState() {
    try {
      await api.reportForestState(Array.from(renderedAnimals));
    } catch (_err) {
      // noop
    }
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;

  let rafId = 0;
  function animate() {
    if (destroyed) return;
    rafId = requestAnimationFrame(animate);
    const now = Date.now() * 0.001;
    waterNormal.offset.y -= 0.002;
    river.position.y = 0.1 + Math.sin(now * 0.5) * 0.05;
    fireflies.rotation.y += 0.0005;
    fireflies.position.y = Math.sin(now * 0.5) * 2;

    scene.traverse((obj) => {
      if (obj.isSprite && obj.userData.type) {
        if (obj.scale.x < obj.userData.targetScale) {
          obj.scale.set(obj.scale.x + 0.1, obj.scale.y + 0.1, 1);
        }
        const off = obj.userData.offset;
        if (obj.userData.type === "sky") {
          obj.position.x += Math.cos(now + off) * 0.05;
          obj.position.y += Math.sin(now * 2 + off) * 0.02;
        } else if (obj.userData.type === "water") {
          obj.position.z += Math.sin(now + off) * 0.04;
        } else {
          obj.position.y = 2.5 + Math.abs(Math.sin(now * 5 + off)) * 0.8;
        }
      }
    });

    controls.update();
    renderer.render(scene, camera);
  }

  function handleResize() {
    if (destroyed) return;
    const w = mountEl.clientWidth || window.innerWidth;
    const h = mountEl.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener("resize", handleResize);
  animate();
  listenForSpawn();
  const spawnInterval = setInterval(listenForSpawn, 2000);
  const reportInterval = setInterval(reportForestState, 3000);

  return () => {
    destroyed = true;
    clearInterval(spawnInterval);
    clearInterval(reportInterval);
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", handleResize);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode === mountEl) {
      mountEl.removeChild(renderer.domElement);
    }
  };
}
