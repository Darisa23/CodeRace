// RaceEngine.js - Three.js urban night highway (rojo / negro)
// - Escenario largo con edificios pegados a la pista (geometría fusionada, pocos draw calls)
// - Sensación de velocidad: FOV dinámico, líneas de velocidad, vibración de cámara, postes y pórticos que pasan
// - Meta espectacular (pórtico, banner, rayos de luz, tribunas) y señales de distancia
// - Nitro visual (llamas, FOV, líneas) + soporte opcional para modelos .glb exportados desde Blender
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TRACK_LENGTH = 3000;          // distancia hasta la meta (unidades de mundo)
const ROAD_HALF = 10;               // media anchura de la calzada
const LANES_X = [-6, -2, 2, 6];
const SIDEWALK_EDGE = 11.6;         // x donde empiezan las fachadas
const POLE_SPACING = 30;
const GANTRY_SPACING = 150;
const MAX_SPEED_REF = 60;           // u/s que se consideran "a tope" para efectos

const C_RED = 0xff1733;
const C_DEEP = 0xc4001a;
const C_EMBER = 0xff4d3d;
const C_BONE = 0xf4eeee;
const C_BG = 0x050304;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function canvasTexture(canvas, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  return t;
}

function radialGlowTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return canvasTexture(c);
}

export class RaceEngine {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Parámetros de pista
    this.trackLength = TRACK_LENGTH;
    this.laneWidth = 4.0;
    this.numLanes = 4;
    this.lanesX = LANES_X;

    // peerId -> datos del coche
    this.cars = new Map();
    this.localPlayerId = null;

    // Estado
    this.isRunning = false;
    this.attract = true;           // modo fondo del lobby (cámara a la deriva)
    this.attractZ = 40;
    this.lastTime = performance.now();
    this.elapsed = 0;
    this.rafId = null;

    // FX de cámara / velocidad
    this.baseFov = 60;
    this.nitroLevel = 0;           // 0..1 suavizado
    this.localSpeed = 0;           // u/s del coche local (suavizado)
    this.speedFactor = 0;          // 0..1+
    this.camZ = 0;
    this.lastPoleIndex = 0;
    this.gantryZs = [];
    this.nextGantry = 0;
    this.finishFired = false;
    this.finishTime = 0;

    // Callbacks para el audio (los conecta main.js)
    this.onPassBy = () => {};      // ({ kind: 'pole'|'gantry'|'finish', side, speed })
    this.onFinishCross = () => {}; // el coche local cruzó la meta

    // Modelos opcionales de Blender
    this.carTemplate = null;

    this.isMobile = typeof window !== 'undefined' &&
      window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  // ===========================================================
  // INIT
  // ===========================================================
  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(C_BG);
    this.scene.fog = new THREE.FogExp2(C_BG, 0.0105);

    this.camera = new THREE.PerspectiveCamera(
      this.baseFov, window.innerWidth / window.innerHeight, 0.1, 1400
    );
    this.camera.position.set(0, 4.2, 10);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isMobile,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));

    // Luces (escena mayormente emisiva; las luces solo dan volumen a coches y asfalto)
    this.scene.add(new THREE.AmbientLight(0xffe9e9, 0.9));
    const dir = new THREE.DirectionalLight(0xff3b4d, 1.4);
    dir.position.set(-12, 30, 20);
    this.scene.add(dir);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(14, 12, -30);
    this.scene.add(rim);

    this.glowTex = radialGlowTexture();
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.createSky();
    this.createRoad();
    this.createCurbsAndRails();
    this.createStreetLights();
    this.createGantries();
    this.createCity();
    this.createBillboards();
    this.createDistanceMarkers();
    this.createFinishLine();
    this.createSpeedLines();

    window.addEventListener('resize', this.onResize);
    this.lastTime = performance.now();
    this.loop();
  }

  // Carga opcional de modelos hechos en Blender (public/models/car.glb). Si no existe se usa el procedural.
  async loadModels({ carUrl = '/models/car.glb' } = {}) {
    try {
      const gltf = await new GLTFLoader().loadAsync(carUrl);
      this.carTemplate = gltf.scene;
      console.info('[RaceEngine] Modelo de coche cargado:', carUrl);
    } catch (e) {
      this.carTemplate = null; // sin modelo => coche procedural
    }
  }

  // ===========================================================
  // SKY / HORIZON GLOW
  // ===========================================================
  createSky() {
    const mat = new THREE.MeshBasicMaterial({
      map: this.glowTex, color: C_RED, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(700, 360), mat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    const sunMat = new THREE.MeshBasicMaterial({
      color: C_RED, transparent: true, opacity: 0.9, fog: false, depthWrite: false
    });
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(55, 48), sunMat);
    this.sun.renderOrder = -1;
    this.scene.add(this.sun);
  }

  // ===========================================================
  // ROAD
  // ===========================================================
  createRoad() {
    const length = this.trackLength + 420;
    const tile = 24; // unidades de mundo por repetición de textura
    const c = makeCanvas(512, 1024);
    const g = c.getContext('2d');

    g.fillStyle = '#0d0809';
    g.fillRect(0, 0, 512, 1024);
    // grano de asfalto
    for (let i = 0; i < 9000; i++) {
      const v = Math.random();
      g.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 220 : 0},${v > 0.5 ? 220 : 0},${Math.random() * 0.05})`;
      g.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2);
    }
    const px = (x) => (x + ROAD_HALF) * 25.6;

    // bordes rojos continuos con brillo
    g.shadowColor = '#ff1733'; g.shadowBlur = 14;
    g.fillStyle = '#ff1733';
    g.fillRect(px(-9.55), 0, 7, 1024);
    g.fillRect(px(9.55) - 7, 0, 7, 1024);
    // doble línea central roja
    g.fillRect(px(-0.18) - 3, 0, 5, 1024);
    g.fillRect(px(0.18) - 2, 0, 5, 1024);
    g.shadowBlur = 0;
    // líneas de carril discontinuas (3 trazos por tile = 4u trazo / 4u hueco)
    g.fillStyle = 'rgba(244,238,238,0.85)';
    for (const lx of [-4, 4]) {
      for (let i = 0; i < 3; i++) {
        g.fillRect(px(lx) - 3, i * 341.33, 6, 170.67);
      }
    }

    const tex = canvasTexture(c, { repeat: true });
    tex.repeat.set(1, length / tile);
    tex.anisotropy = this.maxAniso;
    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.55, metalness: 0.2
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, length), this.roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -this.trackLength / 2 + 60);
    this.scene.add(road);

    // suelo oscuro hasta el horizonte (se ve entre edificios)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, length),
      new THREE.MeshBasicMaterial({ color: 0x070405 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -this.trackLength / 2 + 60);
    this.scene.add(ground);
  }

  createCurbsAndRails() {
    const length = this.trackLength + 420;
    const zc = -this.trackLength / 2 + 60;

    // aceras
    const walkMat = new THREE.MeshBasicMaterial({ color: 0x140b0d });
    const walkGeo = new THREE.BoxGeometry(SIDEWALK_EDGE - ROAD_HALF, 0.22, length);
    // línea de neón en el bordillo
    const kerbMat = new THREE.MeshBasicMaterial({ color: C_RED });
    const kerbGeo = new THREE.BoxGeometry(0.1, 0.06, length);
    // barandilla baja
    const railGeo = new THREE.BoxGeometry(0.08, 0.14, length);
    const railMat = new THREE.MeshBasicMaterial({ color: 0x2a1a1d });
    const railGlowGeo = new THREE.BoxGeometry(0.05, 0.05, length);

    for (const s of [-1, 1]) {
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.position.set(s * (ROAD_HALF + (SIDEWALK_EDGE - ROAD_HALF) / 2), 0.11, zc);
      this.scene.add(walk);

      const kerb = new THREE.Mesh(kerbGeo, kerbMat);
      kerb.position.set(s * (ROAD_HALF + 0.05), 0.25, zc);
      this.scene.add(kerb);

      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(s * 10.45, 0.85, zc);
      this.scene.add(rail);
      const railGlow = new THREE.Mesh(railGlowGeo, kerbMat);
      railGlow.position.set(s * 10.38, 0.74, zc);
      this.scene.add(railGlow);
    }

    // postes de la barandilla (cada 4u => pasan muy rápido y dan sensación de velocidad)
    const count = Math.floor(length / 4);
    const postGeo = new THREE.BoxGeometry(0.16, 0.9, 0.16);
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshBasicMaterial({ color: 0x1d1215 }), count * 2);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const s of [-1, 1]) {
      for (let k = 0; k < count; k++) {
        m.makeTranslation(s * 10.45, 0.55, 80 - k * 4);
        posts.setMatrixAt(i++, m);
      }
    }
    this.scene.add(posts);
  }

  // ===========================================================
  // STREET LIGHTS (postes con brazo, cabeza emisiva y charco de luz)
  // ===========================================================
  createStreetLights() {
    const n = Math.floor((this.trackLength + 300) / POLE_SPACING);
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.16, 9, 6);
    const armGeo = new THREE.BoxGeometry(2.4, 0.14, 0.14);
    const headGeo = new THREE.BoxGeometry(1.0, 0.12, 0.5);
    const poleMat = new THREE.MeshBasicMaterial({ color: 0x1a0f12 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const poolGeo = new THREE.PlaneGeometry(9, 9);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({
      map: this.glowTex, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    const poles = new THREE.InstancedMesh(poleGeo, poleMat, n * 2);
    const arms = new THREE.InstancedMesh(armGeo, poleMat, n * 2);
    const heads = new THREE.InstancedMesh(headGeo, headMat, n * 2);
    const pools = new THREE.InstancedMesh(poolGeo, poolMat, n * 2);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    let i = 0;
    for (let k = 0; k < n; k++) {
      for (const s of [-1, 1]) {
        const z = 60 - k * POLE_SPACING - (s > 0 ? POLE_SPACING / 2 : 0);
        m.makeTranslation(s * 10.95, 4.5, z); poles.setMatrixAt(i, m);
        m.makeTranslation(s * 9.75, 9, z); arms.setMatrixAt(i, m);
        m.makeTranslation(s * 8.55, 8.88, z); heads.setMatrixAt(i, m);
        m.makeTranslation(s * 7.4, 0.3, z); pools.setMatrixAt(i, m);
        col.setHex(k % 3 === 0 ? C_BONE : C_RED);
        heads.setColorAt(i, col);
        pools.setColorAt(i, col);
        i++;
      }
    }
    this.scene.add(poles, arms, heads, pools);
  }

  // ===========================================================
  // GANTRIES (pórticos aéreos cada 150u: pasan por encima y marcan el ritmo)
  // ===========================================================
  createGantries() {
    const zs = [];
    for (let z = -GANTRY_SPACING; z > -this.trackLength + 80; z -= GANTRY_SPACING) zs.push(z);
    this.gantryZs = zs;

    const beamGeo = new THREE.BoxGeometry(ROAD_HALF * 2 + 5, 0.9, 1.2);
    const pillarGeo = new THREE.BoxGeometry(0.9, 9, 0.9);
    const ledGeo = new THREE.BoxGeometry(ROAD_HALF * 2 + 3, 0.12, 0.3);
    const dark = new THREE.MeshBasicMaterial({ color: 0x160d10 });
    const led = new THREE.MeshBasicMaterial({ color: C_RED });

    const beams = new THREE.InstancedMesh(beamGeo, dark, zs.length);
    const pillars = new THREE.InstancedMesh(pillarGeo, dark, zs.length * 2);
    const leds = new THREE.InstancedMesh(ledGeo, led, zs.length);
    const m = new THREE.Matrix4();
    zs.forEach((z, k) => {
      m.makeTranslation(0, 9, z); beams.setMatrixAt(k, m);
      m.makeTranslation(0, 8.45, z + 0.5); leds.setMatrixAt(k, m);
      m.makeTranslation(-12.2, 4.5, z); pillars.setMatrixAt(k * 2, m);
      m.makeTranslation(12.2, 4.5, z); pillars.setMatrixAt(k * 2 + 1, m);
    });
    this.scene.add(beams, pillars, leds);
  }

  // ===========================================================
  // CITY: edificios pegados a la pista (fachada a ~1.6u de la acera)
  // ===========================================================
  buildWindowTexture() {
    const cell = 32, n = 8;
    const c = makeCanvas(cell * n, cell * n);
    const g = c.getContext('2d');
    const rng = mulberry32(1234);
    g.fillStyle = '#0a0607';
    g.fillRect(0, 0, c.width, c.height);
    const lit = ['#ff1f3a', '#ff3b4d', '#c4001a', '#ff6a55', '#c4001a', '#f4eeee', '#8a0014'];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = x * cell, py = y * cell;
        const isLit = rng() < 0.3;
        if (isLit) {
          const col = lit[Math.floor(rng() * lit.length)];
          g.fillStyle = col;
          g.globalAlpha = 0.4 + rng() * 0.5;
        } else {
          g.fillStyle = '#1b0e11';
          g.globalAlpha = 1;
        }
        g.fillRect(px + 6, py + 7, cell - 12, cell - 15);
        g.globalAlpha = 1;
        // marco
        g.strokeStyle = 'rgba(255,23,51,0.07)';
        g.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
      }
    }
    const t = canvasTexture(c, { repeat: true });
    t.anisotropy = this.maxAniso;
    return t;
  }

  makeBuildingGeometry(w, h, d, x, z, rng) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    const tile = 8 * 2.1; // 8 celdas de 2.1u por repetición
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
    const ox = Math.floor(rng() * 8) / 8, oy = Math.floor(rng() * 8) / 8;
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const idx = f * 4 + v;
        if (f === 2 || f === 3) {
          uv.setXY(idx, 0.004, 0.996); // techo/suelo: zona de pared oscura
        } else {
          uv.setXY(idx, uv.getX(idx) * dims[f][0] / tile + ox, uv.getY(idx) * dims[f][1] / tile + oy);
        }
      }
    }
    // color por vértice: más oscuro en la base, más claro arriba + variación por edificio
    const colors = new Float32Array(pos.count * 3);
    const tint = 0.75 + rng() * 0.25;
    for (let i = 0; i < pos.count; i++) {
      const k = (0.45 + 0.55 * ((pos.getY(i) + h / 2) / h)) * tint;
      colors[i * 3] = k; colors[i * 3 + 1] = k * 0.92; colors[i * 3 + 2] = k * 0.92;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.deleteAttribute('normal');
    geo.translate(x, h / 2, z);
    return geo;
  }

  createCity() {
    const tex = this.buildWindowTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
    const rng = mulberry32(777);
    const zStart = 90;
    const zEnd = -(this.trackLength + 300);

    const neonBars = []; // { x, y, z, len, color }
    const beacons = [];
    const geos = [];
    const flush = (force = false) => {
      if (geos.length >= 40 || (force && geos.length)) {
        const merged = mergeGeometries(geos.splice(0, geos.length));
        const mesh = new THREE.Mesh(merged, mat);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
      }
    };

    for (const s of [-1, 1]) {
      // Fila cercana: fachada continua casi pegada a la acera
      let z = zStart;
      while (z > zEnd) {
        const d = 9 + rng() * 9;
        const w = 8 + rng() * 9;
        const h = 16 + Math.pow(rng(), 1.6) * 62;
        const gap = rng() < 0.12 ? 6 + rng() * 6 : rng() * 1.6; // callejones ocasionales
        const setback = rng() < 0.2 ? rng() * 2.5 : 0;
        const x = s * (SIDEWALK_EDGE + setback + w / 2);
        const zc = z - d / 2;
        geos.push(this.makeBuildingGeometry(w, h, d, x, zc, rng));
        flush();

        if (rng() < 0.5) {
          neonBars.push({
            x: s * (SIDEWALK_EDGE + setback - 0.12),
            y: 3 + rng() * (h - 8),
            z: zc + (rng() - 0.5) * (d - 2),
            len: 4 + rng() * 14,
            color: rng() < 0.7 ? C_RED : C_BONE
          });
        }
        if (h > 55) beacons.push({ x, y: h + 0.4, z: zc });
        z -= d + gap;
      }

      // Fila lejana: torres altas que forman el skyline
      const step = this.isMobile ? 46 : 30;
      for (let zf = zStart; zf > zEnd; zf -= step + rng() * 16) {
        const w = 16 + rng() * 14;
        const d = 18 + rng() * 14;
        const h = 60 + rng() * 120;
        const x = s * (32 + rng() * 26 + w / 2);
        geos.push(this.makeBuildingGeometry(w, h, d, x, zf, rng));
        flush();
        if (rng() < 0.6) beacons.push({ x, y: h + 0.4, z: zf });
      }
    }
    flush(true);

    // Barras de neón verticales en las fachadas cercanas
    const barGeo = new THREE.BoxGeometry(0.22, 1, 0.5);
    const bars = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), neonBars.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    neonBars.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(1, b.len, 1));
      bars.setMatrixAt(i, m);
      bars.setColorAt(i, col.setHex(b.color));
    });
    this.scene.add(bars);

    // Balizas rojas en lo alto de los rascacielos (parpadean)
    const beaconGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: C_RED });
    const bm = new THREE.InstancedMesh(beaconGeo, this.beaconMat, beacons.length);
    beacons.forEach((b, i) => { m.makeTranslation(b.x, b.y, b.z); bm.setMatrixAt(i, m); });
    this.scene.add(bm);
  }

  createBillboards() {
    const texts = ['PYTHON', 'def race():', 'NITRO', 'import speed', 'SCRIPT RACE', 'while True:', '</>', '0xFF1733'];
    const rng = mulberry32(99);
    const mats = texts.map((t) => {
      const c = makeCanvas(512, 256);
      const g = c.getContext('2d');
      g.fillStyle = '#0b0507';
      g.fillRect(0, 0, 512, 256);
      g.strokeStyle = '#ff1733'; g.lineWidth = 8;
      g.shadowColor = '#ff1733'; g.shadowBlur = 24;
      g.strokeRect(14, 14, 484, 228);
      g.fillStyle = rng() < 0.5 ? '#ff1733' : '#f4eeee';
      g.font = 'bold 74px "Fira Code", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, 256, 130, 450);
      return new THREE.MeshBasicMaterial({ map: canvasTexture(c) });
    });
    const geo = new THREE.PlaneGeometry(14, 7);
    let k = 0;
    for (let z = -70; z > -this.trackLength - 100; z -= 110 + rng() * 80) {
      const s = k % 2 === 0 ? -1 : 1;
      const board = new THREE.Mesh(geo, mats[k % mats.length]);
      board.position.set(s * (SIDEWALK_EDGE - 0.35), 13 + rng() * 14, z);
      board.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.scene.add(board);
      k++;
    }
  }

  // ===========================================================
  // DISTANCE MARKERS (anuncian la meta)
  // ===========================================================
  createDistanceMarkers() {
    const marks = [500, 300, 200, 100, 50];
    for (const dist of marks) {
      const c = makeCanvas(256, 128);
      const g = c.getContext('2d');
      g.fillStyle = '#0b0507'; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = '#ff1733'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 118);
      g.fillStyle = '#f4eeee';
      g.font = 'bold 70px Orbitron, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${dist} M`, 128, 66);
      const mat = new THREE.MeshBasicMaterial({ map: canvasTexture(c) });
      const z = -this.trackLength + dist;
      for (const s of [-1, 1]) {
        const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), mat);
        board.position.set(s * 11.2, 5.4, z);
        this.scene.add(board);
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 5.4, 0.2),
          new THREE.MeshBasicMaterial({ color: 0x1a0f12 })
        );
        post.position.set(s * 11.2, 2.7, z - 0.15);
        this.scene.add(post);
      }
    }
  }

  // ===========================================================
  // FINISH LINE
  // ===========================================================
  createFinishLine() {
    const fz = -this.trackLength;
    const g = new THREE.Group();
    g.position.set(0, 0, fz);
    this.finishGroup = g;

    // Franja a cuadros en la calzada
    const cc = makeCanvas(256, 64);
    const cg = cc.getContext('2d');
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
      cg.fillStyle = (x + y) % 2 ? '#f4eeee' : '#0a0607';
      cg.fillRect(x * 32, y * 32, 32, 32);
    }
    const ct = canvasTexture(cc);
    ct.magFilter = THREE.NearestFilter;
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2 - 1, 2.4),
      new THREE.MeshBasicMaterial({ map: ct })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.04, 0);
    g.add(strip);

    // Resplandor pulsante sobre la meta
    this.finishGlowMat = new THREE.MeshBasicMaterial({
      map: this.glowTex, color: C_RED, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2 + 14, 22), this.finishGlowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.08, 0);
    g.add(glow);

    // Torres y viga principal
    const dark = new THREE.MeshStandardMaterial({ color: 0x120a0d, metalness: 0.7, roughness: 0.35 });
    const ledMat = new THREE.MeshBasicMaterial({ color: C_RED });
    for (const s of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 15, 1.8), dark);
      tower.position.set(s * 12.4, 7.5, 0);
      g.add(tower);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 14, 0.12), ledMat);
      strip2.position.set(s * 12.4, 7.5, 0.95);
      g.add(strip2);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(27, 2.4, 2.2), dark);
    beam.position.set(0, 15, 0);
    g.add(beam);
    const underLed = new THREE.Mesh(new THREE.BoxGeometry(25, 0.18, 0.3), ledMat);
    underLed.position.set(0, 13.7, 0.8);
    g.add(underLed);

    // Banner "META"
    const bc = makeCanvas(1024, 192);
    const bg = bc.getContext('2d');
    bg.fillStyle = '#0b0507'; bg.fillRect(0, 0, 1024, 192);
    for (let i = 0; i < 32; i++) {
      bg.fillStyle = i % 2 ? '#f4eeee' : '#0b0507';
      bg.fillRect(i * 32, 0, 32, 20); bg.fillRect(i * 32, 172, 32, 20);
    }
    bg.shadowColor = '#ff1733'; bg.shadowBlur = 30;
    bg.fillStyle = '#ff1733';
    bg.font = '900 130px Orbitron, sans-serif';
    bg.textAlign = 'center'; bg.textBaseline = 'middle';
    bg.fillText('META', 512, 98);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 4.1),
      new THREE.MeshBasicMaterial({ map: canvasTexture(bc), side: THREE.DoubleSide })
    );
    banner.position.set(0, 15, 1.15);
    g.add(banner);

    // Haces de luz (reflectores que oscilan)
    this.finishBeams = [];
    const beamMat = new THREE.MeshBasicMaterial({
      color: C_RED, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 3.2, 70, 14, 1, true), beamMat);
        cone.geometry.translate(0, 35, 0);
        cone.position.set(s * 12.4, 0.2, 0);
        cone.userData = { s, phase: k * Math.PI, base: s * 0.18 };
        g.add(cone);
        this.finishBeams.push(cone);
      }
    }

    // Tribunas con público
    const standMat = new THREE.MeshBasicMaterial({ color: 0x120a0d });
    const crowdGeo = new THREE.BoxGeometry(0.55, 0.9, 0.35);
    const crowdPerSide = 3 * 18;
    this.crowd = new THREE.InstancedMesh(
      crowdGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), crowdPerSide * 2
    );
    this.crowdBase = [];
    const col = new THREE.Color();
    let ci = 0;
    for (const s of [-1, 1]) {
      for (let r = 0; r < 3; r++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2 + r * 1.2, 26), standMat);
        step.position.set(s * (SIDEWALK_EDGE + 5.2 + (2 - r) * 2.6), (1.2 + r * 1.2) / 2, -2);
        g.add(step);
        for (let k = 0; k < 18; k++) {
          const x = s * (SIDEWALK_EDGE + 2.0 + (2 - r) * 2.6);
          const y = 1.2 + r * 1.2 + 0.5;
          const z = -12 + k * 1.4;
          this.crowdBase.push({ x, y, z, ph: Math.random() * 6.28 });
          this.crowd.setColorAt(ci, col.setHex([C_RED, C_BONE, C_EMBER, C_DEEP][(k + r) % 4]));
          ci++;
        }
      }
    }
    g.add(this.crowd);

    this.scene.add(g);
  }

  // ===========================================================
  // SPEED LINES (hijas de la cámara)
  // ===========================================================
  createSpeedLines() {
    const N = this.isMobile ? 70 : 130;
    this.speedLineN = N;
    this.speedLineData = [];
    const pos = new Float32Array(N * 6);
    const col = new Float32Array(N * 6);
    const c1 = new THREE.Color(C_BONE), c2 = new THREE.Color(C_RED);
    for (let i = 0; i < N; i++) {
      const d = {};
      this.respawnLine(d, true);
      this.speedLineData.push(d);
      const c = Math.random() < 0.6 ? c1 : c2;
      for (let v = 0; v < 2; v++) {
        col[i * 6 + v * 3] = c.r; col[i * 6 + v * 3 + 1] = c.g; col[i * 6 + v * 3 + 2] = c.b;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.speedLineMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    });
    this.speedLines = new THREE.LineSegments(geo, this.speedLineMat);
    this.speedLines.frustumCulled = false;
    this.camera.add(this.speedLines);
  }

  respawnLine(d, anywhere = false) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.8 + Math.random() * 13;
    d.x = Math.cos(a) * r * 1.5;
    d.y = Math.sin(a) * r * 0.85;
    d.z = anywhere ? -2 - Math.random() * 70 : -70 - Math.random() * 10;
    d.k = 0.7 + Math.random() * 0.8;
  }

  updateSpeedLines(delta) {
    const sf = this.speedFactor, nl = this.nitroLevel;
    const intensity = clamp((sf - 0.22) * 0.95 + nl * 0.55, 0, 0.85);
    this.speedLineMat.opacity = intensity;
    if (intensity < 0.01) return;

    const v = this.localSpeed * 1.6 + 25 + nl * 60;
    const len = clamp(this.localSpeed * 0.07 + nl * 9, 0.5, 16);
    const p = this.speedLines.geometry.attributes.position;
    for (let i = 0; i < this.speedLineN; i++) {
      const d = this.speedLineData[i];
      d.z += v * d.k * delta;
      if (d.z > -1.5) this.respawnLine(d);
      p.setXYZ(i * 2, d.x, d.y, d.z);
      p.setXYZ(i * 2 + 1, d.x, d.y, d.z - len * d.k);
    }
    p.needsUpdate = true;
  }

  // ===========================================================
  // CARS
  // ===========================================================
  createCarMesh(colorHex) {
    const group = this.carTemplate ? this.cloneCarTemplate(colorHex) : this.createProceduralCar(colorHex);
    this.attachCarFx(group, colorHex);
    return group;
  }

  cloneCarTemplate(colorHex) {
    const model = this.carTemplate.clone(true);
    const color = new THREE.Color(colorHex);
    const wheels = [];
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        if (/body|paint|carroceria|chassis/i.test(o.material.name || o.name)) {
          o.material.color.copy(color);
        }
      }
      if (/wheel|rueda|tire|tyre/i.test(o.name)) wheels.push(o);
    });
    // Ajuste: largo 4.6u, apoyado en el suelo, centrado
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = 4.6 / Math.max(size.z, 0.001);
    model.scale.setScalar(s);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);
    const group = new THREE.Group();
    group.add(model);
    group.userData.wheels = wheels;
    return group;
  }

  createProceduralCar(colorHex) {
    const group = new THREE.Group();
    const color = new THREE.Color(colorHex);
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.28 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b0608, metalness: 0.6, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0a0608, metalness: 0.9, roughness: 0.08, emissive: 0x24040a
    });

    // Casco inferior (perfil lateral extruido a lo ancho)
    const hull = new THREE.Shape();
    const pts = [[-2.25, 0.32], [-2.32, 0.62], [-1.5, 0.82], [-0.5, 0.92], [0.9, 0.96], [2.0, 1.02], [2.25, 0.9], [2.25, 0.32]];
    hull.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) hull.lineTo(pts[i][0], pts[i][1]);
    hull.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hull, {
      depth: 1.7, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, steps: 1
    });
    hullGeo.rotateY(-Math.PI / 2);
    hullGeo.translate(0.85, 0, 0);
    group.add(new THREE.Mesh(hullGeo, bodyMat));

    // Cabina
    const cab = new THREE.Shape();
    const cp = [[-0.95, 0.92], [-0.25, 1.38], [0.85, 1.36], [1.5, 0.96]];
    cab.moveTo(cp[0][0], cp[0][1]);
    for (let i = 1; i < cp.length; i++) cab.lineTo(cp[i][0], cp[i][1]);
    cab.closePath();
    const cabGeo = new THREE.ExtrudeGeometry(cab, {
      depth: 1.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2
    });
    cabGeo.rotateY(-Math.PI / 2);
    cabGeo.translate(0.62, 0, 0);
    group.add(new THREE.Mesh(cabGeo, glassMat));

    // Alerón y splitter
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.55), darkMat);
    wing.position.set(0, 1.42, 2.05);
    group.add(wing);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.1), darkMat);
      strut.position.set(s * 0.7, 1.2, 2.05);
      group.add(strut);
    }
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 0.55), darkMat);
    splitter.position.set(0, 0.26, -2.25);
    group.add(splitter);

    // Faros y luz trasera
    const headMat = new THREE.MeshBasicMaterial({ color: C_BONE });
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.06), headMat);
      hl.position.set(s * 0.62, 0.7, -2.4);
      group.add(hl);
    }
    const tailMat = new THREE.MeshBasicMaterial({ color: C_RED });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.06), tailMat);
    tail.position.set(0, 0.86, 2.42);
    group.add(tail);
    group.userData.tailMat = tailMat;

    // Neón lateral con el color del jugador
    const neonMat = new THREE.MeshBasicMaterial({ color });
    for (const s of [-1, 1]) {
      const neon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 3.8), neonMat);
      neon.position.set(s * 1.0, 0.38, 0);
      group.add(neon);
    }

    // Ruedas: pivot (gira) + neumático + llanta
    const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 22);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.38, 10);
    rimGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.7 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9a8a8a, metalness: 1, roughness: 0.25 });
    const wheels = [];
    for (const [x, z] of [[-1.03, -1.4], [1.03, -1.4], [-1.03, 1.4], [1.03, 1.4]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.42, z);
      pivot.add(new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(rimGeo, rimMat));
      group.add(pivot);
      wheels.push(pivot);
    }
    group.userData.wheels = wheels;
    return group;
  }

  // Efectos comunes (para coche procedural y modelos de Blender): brillo inferior y llamas de nitro
  attachCarFx(group, colorHex) {
    const color = new THREE.Color(colorHex);
    const glowMat = new THREE.MeshBasicMaterial({
      map: this.glowTex, color, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.4), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.06;
    group.add(glow);

    // Llamas del escape (conos que apuntan hacia atrás +z)
    const flames = new THREE.Group();
    flames.visible = false;
    const outerMat = new THREE.MeshBasicMaterial({
      color: C_EMBER, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const innerMat = new THREE.MeshBasicMaterial({
      color: C_BONE, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const coneOuter = new THREE.ConeGeometry(0.3, 1, 10);
    coneOuter.rotateX(Math.PI / 2);
    coneOuter.translate(0, 0, 0.5);
    const coneInner = new THREE.ConeGeometry(0.15, 1, 8);
    coneInner.rotateX(Math.PI / 2);
    coneInner.translate(0, 0, 0.5);
    const parts = [];
    for (const s of [-1, 1]) {
      const o = new THREE.Mesh(coneOuter, outerMat);
      const i = new THREE.Mesh(coneInner, innerMat);
      o.position.set(s * 0.55, 0.5, 2.45);
      i.position.set(s * 0.55, 0.5, 2.45);
      flames.add(o, i);
      parts.push(o, i);
    }
    group.add(flames);
    group.userData.flames = flames;
    group.userData.flameParts = parts;
    group.userData.glowMat = glowMat;
  }

  addPlayerCar(peerId, colorHex, laneIndex, name, isLocal = false) {
    this.removePlayerCar(peerId);
    const mesh = this.createCarMesh(colorHex);
    const laneX = this.lanesX[laneIndex % 4];
    mesh.position.set(laneX, 0, 0);
    this.scene.add(mesh);

    if (isLocal) {
      this.localPlayerId = peerId;
      this.camZ = 9;
      this.camera.position.set(laneX, 4.2, 9);
    }

    this.cars.set(peerId, {
      peerId, mesh, color: colorHex, lane: laneIndex, name, isLocal,
      targetProgress: 0, currentProgress: 0,
      wpm: 0, speed: 0, prevZ: 0, nitro: false, nitroFx: 0,
      finishedAt: 0
    });
  }

  clearCars() {
    this.cars.forEach((c) => this.scene.remove(c.mesh));
    this.cars.clear();
    this.localPlayerId = null;
  }

  updatePlayerProgress(peerId, progressPercent, wpm, nitro) {
    const car = this.cars.get(peerId);
    if (!car) return;
    car.targetProgress = progressPercent;
    car.wpm = wpm;
    if (nitro !== undefined) car.nitro = !!nitro;
  }

  setNitro(peerId, active) {
    const car = this.cars.get(peerId);
    if (car) car.nitro = !!active;
  }

  removePlayerCar(peerId) {
    const car = this.cars.get(peerId);
    if (car) {
      this.scene.remove(car.mesh);
      this.cars.delete(peerId);
    }
  }

  // ===========================================================
  // LOOP
  // ===========================================================
  start() {
    // Nueva carrera: sale del modo fondo y reinicia contadores de eventos
    this.attract = false;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.nextGantry = 0;
    this.lastPoleIndex = 0;
    this.finishFired = false;
    this.finishTime = 0;
    this.nitroLevel = 0;
    this.localSpeed = 0;
    this.cars.forEach((c) => { c.prevZ = c.mesh.position.z; });
    this.loop();
  }

  stop() {
    // Vuelve al modo fondo (el render sigue para el lobby)
    this.attract = true;
    this.attractZ = 40;
    this.isRunning = false;
  }

  loop() {
    if (this.rafId) return;           // evita bucles duplicados
    this.rafId = requestAnimationFrame(this.animate);
  }

  animate() {
    this.rafId = requestAnimationFrame(this.animate);
    if (!this.renderer) return;

    const now = performance.now();
    const delta = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsed += delta;

    if (this.attract) this.updateAttract(delta);
    else this.updateRace(delta);

    this.updateAmbient(delta);
    this.renderer.render(this.scene, this.camera);
  }

  // Cámara del lobby: recorre la ciudad lentamente
  updateAttract(delta) {
    this.attractZ -= 22 * delta;
    if (this.attractZ < -900) this.attractZ = 40;
    this.camera.position.set(Math.sin(this.elapsed * 0.25) * 3, 5.5, this.attractZ);
    this.camera.lookAt(Math.sin(this.elapsed * 0.25) * 2, 3, this.attractZ - 40);
    this.localSpeed = 22;
    this.speedFactor = 0.25;
    this.nitroLevel = 0;
    this.camera.fov += (this.baseFov - this.camera.fov) * Math.min(1, delta * 4);
    this.camera.updateProjectionMatrix();
    this.updateSpeedLines(delta);
    this.syncSky();
  }

  updateRace(delta) {
    const k = 1 - Math.exp(-delta * 5); // suavizado independiente del framerate
    let local = null;

    this.cars.forEach((car) => {
      // Posición suavizada: las teclas llegan a saltos, el coche avanza de forma continua
      car.currentProgress += (car.targetProgress - car.currentProgress) * k;
      let z = -(car.currentProgress / 100) * this.trackLength;

      // Después de cruzar la meta el coche sigue de largo y frena
      if (car.targetProgress >= 99.99) {
        car.finishedAt += delta;
        z -= Math.min(70, car.finishedAt * 30 * Math.max(0.2, 1 - car.finishedAt * 0.25));
      }
      car.mesh.position.z = z;

      const inst = (car.prevZ - z) / Math.max(delta, 0.0001);
      car.speed += (inst - car.speed) * (1 - Math.exp(-delta * 6));
      car.prevZ = z;

      // Nitro suavizado por coche
      car.nitroFx += ((car.nitro ? 1 : 0) - car.nitroFx) * (1 - Math.exp(-delta * 8));

      this.updateCarVisuals(car, delta);
      if (car.isLocal) local = car;
    });

    if (!local) return;

    this.localSpeed = local.speed;
    this.speedFactor = clamp(local.speed / MAX_SPEED_REF, 0, 1.3);
    this.nitroLevel += ((local.nitro ? 1 : 0) - this.nitroLevel) * (1 - Math.exp(-delta * 5));
    const nl = this.nitroLevel, sf = this.speedFactor;

    // --- Cámara: más atrás y baja con la velocidad, FOV dinámico, vibración ---
    const carZ = local.mesh.position.z;
    const carX = local.mesh.position.x;
    const targetCamZ = carZ + 8.2 + sf * 1.6 + nl * 2.4;
    this.camZ += (targetCamZ - this.camZ) * (1 - Math.exp(-delta * 9));

    const shakeAmp = 0.012 * sf + 0.07 * nl;
    const t = this.elapsed;
    const sx = (Math.sin(t * 41) + Math.sin(t * 27.3)) * 0.5 * shakeAmp;
    const sy = (Math.sin(t * 37.7) + Math.sin(t * 23.1)) * 0.5 * shakeAmp;

    this.camera.position.x += (carX - this.camera.position.x) * (1 - Math.exp(-delta * 8));
    this.camera.position.x += sx;
    this.camera.position.y = 3.9 - sf * 0.35 - nl * 0.45 + sy;
    this.camera.position.z = this.camZ;
    this.camera.lookAt(carX, 1.35, carZ - 28);

    const fov = this.baseFov + 11 * Math.min(1, sf) + 15 * nl;
    if (Math.abs(fov - this.camera.fov) > 0.02) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-delta * 6));
      this.camera.updateProjectionMatrix();
    }

    this.updateSpeedLines(delta);
    this.syncSky();
    this.emitPassBys(local);
  }

  updateCarVisuals(car, delta) {
    const ud = car.mesh.userData;
    const speed = car.speed;

    // Ruedas: v = ω r  (r ≈ 0.42)
    if (ud.wheels) {
      const w = speed / 0.42 * delta;
      ud.wheels.forEach((p) => { p.rotation.x -= w; });
    }

    // Vibración del chasis y cabeceo (se hunde atrás al acelerar)
    const vib = Math.min(1, speed / 25) * 0.006 + car.nitroFx * 0.02;
    car.mesh.position.y = Math.sin(this.elapsed * 55 + car.lane) * vib;
    const accel = (speed - (car.lastSpeed || 0)) / Math.max(delta, 0.0001);
    car.lastSpeed = speed;
    const pitchTarget = clamp(-accel * 0.0006, -0.04, 0.04) - car.nitroFx * 0.025;
    car.mesh.rotation.x += (pitchTarget - car.mesh.rotation.x) * Math.min(1, delta * 6);

    // Llamas del nitro
    if (ud.flames) {
      const on = car.nitroFx > 0.05;
      ud.flames.visible = on;
      if (on) {
        const len = (0.9 + Math.random() * 0.7) * car.nitroFx * 1.9;
        ud.flameParts.forEach((m, i) => {
          const inner = i % 2 === 1;
          m.scale.set(1, 1, (inner ? 0.6 : 1) * len * (0.85 + Math.random() * 0.3));
        });
      }
    }
    if (ud.glowMat) ud.glowMat.opacity = 0.7 + car.nitroFx * 0.3 + Math.sin(this.elapsed * 6) * 0.05;
    if (ud.tailMat) ud.tailMat.color.setHex(speed < 2 ? C_RED : C_DEEP);
  }

  // Eventos para el audio: postes que pasan, pórticos, meta
  emitPassBys(local) {
    const camZ = this.camera.position.z;

    const poleIndex = Math.floor((-camZ + 60) / POLE_SPACING);
    if (poleIndex > this.lastPoleIndex) {
      this.lastPoleIndex = poleIndex;
      if (this.localSpeed > 8) {
        this.onPassBy({ kind: 'pole', side: poleIndex % 2 ? 1 : -1, speed: this.localSpeed });
      }
    }

    while (this.nextGantry < this.gantryZs.length && local.mesh.position.z < this.gantryZs[this.nextGantry]) {
      if (this.localSpeed > 8) this.onPassBy({ kind: 'gantry', side: 0, speed: this.localSpeed });
      this.nextGantry++;
    }

    if (!this.finishFired && local.mesh.position.z <= -this.trackLength) {
      this.finishFired = true;
      this.finishTime = this.elapsed;
      this.onPassBy({ kind: 'finish', side: 0, speed: this.localSpeed });
      this.onFinishCross();
    }
  }

  // Animaciones ambientales: baliza, meta, público, rayos
  updateAmbient() {
    const t = this.elapsed;
    if (this.beaconMat) {
      const on = Math.sin(t * 2.2) > -0.3;
      this.beaconMat.color.setHex(on ? C_RED : 0x3a0710);
    }
    if (this.finishGlowMat) this.finishGlowMat.opacity = 0.55 + Math.sin(t * 4) * 0.2 + (this.finishFired ? 0.4 : 0);
    if (this.finishBeams) {
      this.finishBeams.forEach((c) => {
        const u = c.userData;
        c.rotation.z = u.s * (0.22 + Math.sin(t * 1.3 + u.phase) * 0.28);
        c.rotation.x = Math.sin(t * 0.9 + u.phase) * 0.25;
      });
    }
    if (this.crowd) {
      const m = this._m || (this._m = new THREE.Matrix4());
      this.crowdBase.forEach((b, i) => {
        const bounce = Math.max(0, Math.sin(t * (this.finishFired ? 9 : 3.5) + b.ph)) * (this.finishFired ? 0.7 : 0.25);
        m.makeTranslation(b.x, b.y + bounce, b.z);
        this.crowd.setMatrixAt(i, m);
      });
      this.crowd.instanceMatrix.needsUpdate = true;
    }
  }

  // El resplandor del horizonte acompaña a la cámara (siempre "al fondo")
  syncSky() {
    const cz = this.camera.position.z;
    this.sky.position.set(this.camera.position.x * 0.5, 55, cz - 760);
    this.sun.position.set(this.camera.position.x * 0.5, 38, cz - 780);
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener('resize', this.onResize);
    if (this.renderer) this.renderer.dispose();
  }
}
