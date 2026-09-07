// RaceEngine.js - Three.js 3D Perspective Urban Highway Engine
import * as THREE from 'three';
export class RaceEngine {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    // Track parameters
    this.trackLength = 600; // Total world Z units to Finish Line
    this.laneWidth = 4.0;
    this.numLanes = 4;
    this.lanesX = [-6, -2, 2, 6]; // X position for lanes 0, 1, 2, 3
    // Player cars mapping: peerId -> { mesh, color, lane, targetProgress, currentProgress, wpm, name, nitroParticles }
    this.cars = new Map();
    this.localPlayerId = null;
    // Environment elements for forward movement loop
    this.buildings = [];
    this.streetLights = [];
    this.portalArches = [];
    this.roadTextureOffset = 0;
    this.roadMaterial = null;
    // Animation & State
    this.lastTime = performance.now();
    this.isRunning = false;
    this.currentSpeed = 0; // World speed units
    this.onResize = this.onResize.bind(this);
  }
  init() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060810);
    this.scene.fog = new THREE.FogExp2(0x060810, 0.008);
    // 2. Camera - FIXED Perspective Camera looking down the highway
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Camera fixed position behind & above Lane 1 (player lane)
    this.camera.position.set(-2, 4.2, 10);
    this.camera.lookAt(-2, 1.5, -40);
    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x00f3ff, 0.8);
    dirLight.position.set(20, 50, 20);
    this.scene.add(dirLight);
    // Cyan & Pink Ambient Neon Point Lights
    const neonLight1 = new THREE.PointLight(0x00f3ff, 2, 80);
    neonLight1.position.set(-15, 10, -50);
    this.scene.add(neonLight1);
    const neonLight2 = new THREE.PointLight(0xff0055, 2, 80);
    neonLight2.position.set(15, 10, -100);
    this.scene.add(neonLight2);
    // 5. Build Environment
    this.createRoad();
    this.createCityScenery();
    this.createFinishLine();
    window.addEventListener('resize', this.onResize);
  }
  createRoad() {
    // Road plane geometry
    const roadWidth = this.laneWidth * this.numLanes + 4;
    const geometry = new THREE.PlaneGeometry(roadWidth, this.trackLength + 100);
    
    // Canvas generated grid texture for asphalt & neon lane markings
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#0c0f17';
    ctx.fillRect(0, 0, 512, 1024);
    
    // Outer metallic borders
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(0, 0, 8, 1024);
    ctx.fillRect(504, 0, 8, 1024);
    // Lane divider dashed neon lines
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.setLineDash([40, 40]);
    const laneStep = 512 / 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneStep, 0);
      ctx.lineTo(i * laneStep, 1024);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 15);
    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.2,
      metalness: 0.8
    });
    const roadMesh = new THREE.Mesh(geometry, this.roadMaterial);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -this.trackLength / 2 + 10);
    this.scene.add(roadMesh);
  }
  createCityScenery() {
    // Generate Skyscrapers flanking the left and right sides
    const buildingColors = [0x0f172a, 0x1e1b4b, 0x090d16, 0x172554];
    const neonWindowColors = [0x00f3ff, 0xff0055, 0x00ff66, 0x9d4edd, 0xffb703];
    for (let z = 20; z > -this.trackLength - 50; z -= 25) {
      // Left side buildings
      this.createBuilding(-22 - Math.random() * 8, z, buildingColors, neonWindowColors);
      // Right side buildings
      this.createBuilding(22 + Math.random() * 8, z, buildingColors, neonWindowColors);
      // Add Overhead Portal Arch every 100 units
      if (Math.abs(z) % 100 === 0 && Math.abs(z) > 0) {
        this.createPortalArch(z);
      }
    }
  }
  createBuilding(x, z, buildingColors, neonColors) {
    const width = 12 + Math.random() * 10;
    const height = 30 + Math.random() * 50;
    const depth = 12 + Math.random() * 10;
    const geo = new THREE.BoxGeometry(width, height, depth);
    const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.3,
      metalness: 0.7
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    this.scene.add(mesh);
    this.buildings.push(mesh);
    // Glowing Neon Window Strips on Building Front
    const windowGeo = new THREE.PlaneGeometry(width * 0.7, height * 0.8);
    const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)];
    const windowMat = new THREE.MeshBasicMaterial({
      color: neonColor,
      transparent: true,
      opacity: 0.3 + Math.random() * 0.4
    });
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.set(x > 0 ? x - depth/2 - 0.1 : x + depth/2 + 0.1, height / 2, z);
    windowMesh.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.scene.add(windowMesh);
  }
  createPortalArch(z) {
    const group = new THREE.Group();
    // Arch pillars & beam
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const beamGeo = new THREE.BoxGeometry(24, 0.8, 0.8);
    const beam = new THREE.Mesh(beamGeo, mat);
    beam.position.set(0, 10, z);
    const pillarGeo = new THREE.BoxGeometry(0.8, 10, 0.8);
    const leftPillar = new THREE.Mesh(pillarGeo, mat);
    leftPillar.position.set(-12, 5, z);
    const rightPillar = new THREE.Mesh(pillarGeo, mat);
    rightPillar.position.set(12, 5, z);
    group.add(beam, leftPillar, rightPillar);
    this.scene.add(group);
    this.portalArches.push(group);
  }
  createFinishLine() {
    const finishZ = -this.trackLength;
    const group = new THREE.Group();
    // Arch structure
    const archMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
    const beamGeo = new THREE.BoxGeometry(26, 2, 2);
    const beam = new THREE.Mesh(beamGeo, archMat);
    beam.position.set(0, 12, finishZ);
    const pillarGeo = new THREE.BoxGeometry(2, 12, 2);
    const p1 = new THREE.Mesh(pillarGeo, archMat);
    p1.position.set(-13, 6, finishZ);
    const p2 = new THREE.Mesh(pillarGeo, archMat);
    p2.position.set(13, 6, finishZ);
    // Glowing FINISH banner text simulation
    const bannerGeo = new THREE.PlaneGeometry(18, 3);
    const bannerMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 11, finishZ + 0.1);
    // Checkered ground strip
    const groundGeo = new THREE.PlaneGeometry(24, 6);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const groundStrip = new THREE.Mesh(groundGeo, groundMat);
    groundStrip.rotation.x = -Math.PI / 2;
    groundStrip.position.set(0, 0.05, finishZ);
    group.add(beam, p1, p2, banner, groundStrip);
    this.scene.add(group);
  }
  // Create 3D Car Model for a player
  createCarMesh(colorHex) {
    const carGroup = new THREE.Group();
    const mainColor = new THREE.Color(colorHex);
    // Body chassis
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.8, 4.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      metalness: 0.8,
      roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    carGroup.add(body);
    // Cabin / Windshield
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.6, 2.0);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d14,
      metalness: 0.9,
      roughness: 0.1
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.1, -0.2);
    carGroup.add(cabin);
    // Headlights (Front cyan/white)
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const hlGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
    const hl1 = new THREE.Mesh(hlGeo, headlightMat);
    hl1.position.set(-0.7, 0.6, -2.1);
    const hl2 = new THREE.Mesh(hlGeo, headlightMat);
    hl2.position.set(0.7, 0.6, -2.1);
    carGroup.add(hl1, hl2);
    // Taillights (Rear red glow)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const tlGeo = new THREE.BoxGeometry(0.5, 0.2, 0.1);
    const tl1 = new THREE.Mesh(tlGeo, tailMat);
    tl1.position.set(-0.7, 0.6, 2.1);
    const tl2 = new THREE.Mesh(tlGeo, tailMat);
    tl2.position.set(0.7, 0.6, 2.1);
    carGroup.add(tl1, tl2);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    
    const wheelPositions = [
      [-1.1, 0.4, -1.3], [1.1, 0.4, -1.3],
      [-1.1, 0.4, 1.3],  [1.1, 0.4, 1.3]
    ];
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(...pos);
      carGroup.add(wheel);
    });
    // Underglow Light
    const underglow = new THREE.PointLight(mainColor, 2, 6);
    underglow.position.set(0, 0.2, 0);
    carGroup.add(underglow);
    return carGroup;
  }
  addPlayerCar(peerId, colorHex, laneIndex, name, isLocal = false) {
    const mesh = this.createCarMesh(colorHex);
    const laneX = this.lanesX[laneIndex % 4];
    mesh.position.set(laneX, 0, 0); // Start position Z = 0
    this.scene.add(mesh);
    if (isLocal) {
      this.localPlayerId = peerId;
      // Position camera relative to local player lane
      this.camera.position.set(laneX, 4.2, 10);
      this.camera.lookAt(laneX, 1.5, -40);
    }
    this.cars.set(peerId, {
      peerId,
      mesh,
      color: colorHex,
      lane: laneIndex,
      name,
      targetProgress: 0, // 0 to 100%
      currentProgress: 0,
      wpm: 0,
      isLocal
    });
  }
  updatePlayerProgress(peerId, progressPercent, wpm) {
    const carData = this.cars.get(peerId);
    if (carData) {
      carData.targetProgress = progressPercent;
      carData.wpm = wpm;
    }
  }
  removePlayerCar(peerId) {
    const carData = this.cars.get(peerId);
    if (carData) {
      this.scene.remove(carData.mesh);
      this.cars.delete(peerId);
    }
  }
  start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();
  }

  stop() {
    this.isRunning = false;
  }

  animate() {
    if (!this.isRunning) return;
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

  // 1. Update cars position based on progress % (0 to 100%)
  let localWPM = 0;
  this.cars.forEach(car => {
    const prevZ = car.mesh.position.z;

    // Lerp smooth interpolation towards target progress
    car.currentProgress += (car.targetProgress - car.currentProgress) * (delta * 6);

    // Calculate world Z position (0 to -trackLength)
    const targetZ = -(car.currentProgress / 100) * this.trackLength;
    car.mesh.position.z = targetZ;

    if (car.isLocal) {
      localWPM = car.wpm;
      // velocidad real = cuánto avanzó el auto este frame (no el wpm crudo)
      this.currentSpeed = (prevZ - targetZ) / Math.max(delta, 0.0001);

      // Camera smoothly follows player car along Z axis (como estaba original)
      this.camera.position.z = car.mesh.position.z + 10;
      this.camera.lookAt(car.mesh.position.x, 1.5, car.mesh.position.z - 40);
    }
  });

  // 2. Animate Road Texture movement según el avance REAL del auto local
  if (this.roadMaterial && this.roadMaterial.map) {
    this.roadMaterial.map.offset.y -= this.currentSpeed * delta * 0.05;
  }

  this.renderer.render(this.scene, this.camera);
}
  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  destroy() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}