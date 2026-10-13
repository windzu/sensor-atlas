import * as THREE from './vendor/three.module.js';
import { palette as P, random, copy, baselineValue, returnsFor } from './scene-data.js';
import { buildTopic } from './scene-models.js';

// Coverage and returns are qualitative illustrations, not measured results.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => x * x * (3 - 2 * x);
const v3 = (p) => new THREE.Vector3(...p);
let sharedRenderer, activeScene;

export class LowPolyScene {
  constructor(canvas) {
    this.canvas = canvas; this.kind = canvas.dataset.scene; this.isHero = this.kind === 'hero';
    this.copy = copy[this.kind];
    this.value = Number(canvas.closest('article')?.querySelector('input[type=range]')?.value || 35);
    this.mode = 'compare'; this.view = 'orbit'; this.baseline = false; this.targetKind = 'person';
    this.time = 1.6; this.phase = 0; this.lastFrame = performance.now(); this.lastDraw = 0;
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.paused = this.motionPreference.matches;
    if (this.paused) { this.time = 8.8; this.phase = 2; }
    this.visible = false; this.coverage = this.value / 100;
    this.defaultYaw = this.copy.sceneYaw ?? .92;
    this.yaw = this.defaultYaw; this.pitch = .48; this.viewSpan = 6.2;
    if (!sharedRenderer) {
      sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      sharedRenderer.domElement.className = 'lowpoly-renderer';
      sharedRenderer.domElement.setAttribute('aria-hidden', 'true');
      sharedRenderer.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        if (activeScene) { activeScene.paused = true; activeScene.onPause?.(); activeScene.status.textContent = '画面暂时不可用，请刷新页面'; }
      });
      sharedRenderer.domElement.addEventListener('webglcontextrestored', () => {
        if (activeScene) { sharedRenderer.shadowMap.needsUpdate = true; activeScene.draw(); }
      });
    }
    this.renderer = sharedRenderer;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.autoClear = false;
    this.scene = new THREE.Scene();
    this.cloudScene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-6, 6, 4, -4, .1, 70);
    this.cloudCamera = new THREE.OrthographicCamera(-3, 3, 2, -2, .1, 70);
    this.lookAt = new THREE.Vector3(0, .55, 0);
    this.materials = new Map();
    this.setupWorld(); this.setupOverlay(); this.bindCamera(); this.rebuild();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) { this.lastFrame = performance.now(); this.draw(); }
    });
    this.intersectionObserver.observe(canvas);
    this.motionPreference.addEventListener('change', (event) => {
      if (event.matches) this.setPhase(2);
    });
    canvas.closest('.animation-card, .hero-visual').classList.add('lowpoly-card');
  }
  material(color, options = {}) {
    if (Object.keys(options).length) {
      const material = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, ...options });
      material.userData.owned = true; return material;
    }
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }));
    return this.materials.get(color);
  }
  mesh(geometry, color, position, parent = this.scene, options = {}) {
    const mesh = new THREE.Mesh(geometry, this.material(color, options));
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  box(size, color, position, parent = this.scene) {
    return this.mesh(new THREE.BoxGeometry(...size), color, position, parent);
  }
  // Chamfered profiles give the device a designed silhouette.
  housing(width, height, depth, color, parent, position) {
    const s = new THREE.Shape(), r = .07, w = depth / 2, h = height / 2;
    s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.lineTo(w, -h + r);
    s.lineTo(w, h - r); s.lineTo(w - r, h); s.lineTo(-w + r, h);
    s.lineTo(-w, h - r); s.lineTo(-w, -h + r); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-width / 2, 0, 0);
    return this.mesh(geo, color, position, parent);
  }
  setupWorld() {
    this.scene.add(new THREE.HemisphereLight('#fff5d9', '#94bba9', 2.2));
    const sun = new THREE.DirectionalLight('#fff1d5', 3);
    sun.position.set(-3, 9, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 30 });
    sun.shadow.normalBias = .025; sun.shadow.bias = -.00015; this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#b6e6d1', .6);
    fill.position.set(5, 3, -7); this.scene.add(fill);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: .09 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.56; shadow.receiveShadow = true; this.scene.add(shadow);
    const base = this.mesh(new THREE.CylinderGeometry(4.1, 3.85, .35, 8), P.soil, [0, -.28, 0]); base.scale.z = .74;
    const top = this.mesh(new THREE.CylinderGeometry(4.12, 4.12, .12, 8), P.mint, [0, -.045, 0]); top.scale.z = .74;
    this.makeTerrain();
    this.box([6.1, .025, 1.25], '#eae7c9', [0, .027, .68]);
    for (let i = 0; i < 6; i++) this.box([.38, .012, .045], P.ivory, [-1.7 + i * .62, .047, .7]);
    for (const [x, z, scale] of [[-2.9, -1.2, .78], [-1.7, -2.05, .58], [3.15, 1.7, .5]]) this.makeTree(x, z, scale);
    for (const [x, z, size] of [[-3.2, .3, .29], [2.8, -1.9, .3], [-.9, -2.15, .17]]) {
      const rock = this.mesh(new THREE.DodecahedronGeometry(size, 0), P.stone, [x, size * .45, z]);
      rock.scale.set(1.1, .7, .8); rock.rotation.set(.3, .2, .15);
    }
    this.makeSensor(); this.windowDirt.visible = this.kind === 'dirt';
    if (this.kind === 'dirt') {
      this.makeWall(); this.makeCone(-.6, 1.65); this.makeCone(1.7, -2.0, .75);
    } else buildTopic(this);
    this.makeOptics(); this.setupCloud();
  }
  makeTerrain() {
    const verts = [], colors = [], palette = ['#a6d9c3', '#8ecdb8', '#99d2bf', '#b2dfc8'];
    for (let i = 0; i < 8; i++) {
      const a = (i + .5) / 8 * Math.PI * 2, b = (i + 1.5) / 8 * Math.PI * 2;
      verts.push(0, .02, 0, Math.cos(a) * 4.1, .025, Math.sin(a) * 3.03, Math.cos(b) * 4.1, .025, Math.sin(b) * 3.03);
      const c = new THREE.Color(palette[i % palette.length]);
      for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, this.material(P.mint, { vertexColors: true, side: THREE.DoubleSide }));
    terrain.receiveShadow = true; this.scene.add(terrain);
  }
  makeTree(x, z, scale) {
    const tree = new THREE.Group(); tree.position.set(x, .08, z); tree.scale.setScalar(scale);
    this.box([.14, .8, .14], P.soil, [0, .4, 0], tree);
    const crown = this.mesh(new THREE.ConeGeometry(.64, 1.25, 5), '#7fb69d', [0, 1.12, 0], tree); crown.rotation.y = .25;
    const upper = this.mesh(new THREE.ConeGeometry(.48, .98, 5), P.mintLight, [0, 1.68, 0], tree); upper.rotation.y = .5;
    this.scene.add(tree);
  }
  makeCone(x, z, scale = 1, parent = this.scene) {
    const cone = new THREE.Group(); cone.position.set(x, .04, z); cone.scale.setScalar(scale);
    this.box([.44, .04, .44], P.coral, [0, .02, 0], cone);
    this.mesh(new THREE.CylinderGeometry(.035, .16, .49, 6), P.coral, [0, .29, 0], cone);
    this.mesh(new THREE.CylinderGeometry(.076, .107, .12, 6), P.ivory, [0, .33, 0], cone);
    parent.add(cone); return cone;
  }
  makeSensor() {
    const sensor = new THREE.Group(); sensor.position.set(-2.25, .06, .7);
    this.box([1.05, .15, .97], P.ivory, [0, .08, 0], sensor);
    this.box([.48, .48, .43], '#e3dbc1', [0, .36, 0], sensor);
    this.housing(.84, .8, .94, P.coral, sensor, [0, 1.0, 0]);
    this.housing(.89, .09, .98, P.ivory, sensor, [0, 1.45, 0]);
    this.housing(.07, .41, .73, P.charcoal, sensor, [.438, 1.04, 0]);
    this.box([.012, .025, .55], P.mintLight, [.48, 1.16, 0], sensor);
    this.box([.06, .24, .16], '#d75f53', [-.45, 1.02, 0], sensor);
    for (const z of [-.31, .31]) this.mesh(new THREE.CylinderGeometry(.03, .03, .012, 6), P.stone, [.25, 1.503, z], sensor);
    this.windowDirt = new THREE.Group(); sensor.add(this.windowDirt);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Shape(), radius = .055 + random(i + 8) * .073;
      for (let j = 0; j < 6; j++) {
        const angle = j / 6 * Math.PI * 2, r = radius * (.65 + random(i * 6 + j) * .5);
        if (j === 0) s.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else s.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      s.closePath();
      const geo = new THREE.ShapeGeometry(s); geo.rotateY(Math.PI / 2);
      const dirt = this.mesh(geo, i % 2 ? '#aa795a' : P.dirt, [.483 + i * .0005, 1.04 + (random(i + 50) - .5) * .24, -.1 + (random(i + 20) - .5) * .28], this.windowDirt, { side: THREE.DoubleSide });
      dirt.castShadow = false;
    }
    this.scene.add(sensor); this.sensor = sensor;
    this.source = new THREE.Vector3(-1.76, 1.10, .7);
    const led = this.mesh(new THREE.SphereGeometry(.035, 6, 4), P.mintLight, [.48, .89, .26], sensor); led.castShadow = false;
  }
  makeWall() {
    this.wall = new THREE.Group(); this.wall.position.set(2.15, .06, -.4);
    this.box([.14, 2.12, 3.7], '#e4e2c5', [0, 1.2, 0], this.wall);
    this.box([.19, .11, 3.95], P.ivory, [0, 2.29, 0], this.wall);
    for (const z of [-1.88, 1.88]) {
      this.box([.19, 2.28, .09], P.ivory, [0, 1.19, z], this.wall);
      this.box([.63, .16, .5], '#99b9a6', [0, .08, z], this.wall);
    }
    // The physical wall stays intact; missing returns exist only in the cloud.
    for (const side of [-.077, .077]) {
      for (let i = 0; i < 7; i++) this.box([.008, 1.86, .012], '#c5cdb5', [side, 1.2, -1.58 + i * .52], this.wall);
      for (let i = 0; i < 4; i++) this.box([.008, .012, 3.42], '#c5cdb5', [side, .42 + i * .51, 0], this.wall);
    }
    this.scene.add(this.wall);
    this.wallSweep = this.box([.012, 1.95, .10], P.mintLight, [2.067, 1.27, 0]);
    this.wallSweep.castShadow = false;
    this.wallSweep.material = this.material(P.mintLight, { transparent: true, opacity: .65 });
    this.backSweep = this.wallSweep.clone(); this.backSweep.position.x = 2.235; this.scene.add(this.backSweep);
  }
  makeOptics() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      ...this.source.toArray(), 2.055, .33, -1.6, 2.055, 2.3, -1.6,
      ...this.source.toArray(), 2.055, 2.3, -1.6, 2.055, 2.3, 1.24,
      ...this.source.toArray(), 2.055, 2.3, 1.24, 2.055, .33, 1.24
    ], 3));
    this.fan = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: P.mintLight, transparent: true, opacity: .075, side: THREE.DoubleSide, depthWrite: false }));
    this.scene.add(this.fan); this.pulses = [];
    const sheetGeo = new THREE.BufferGeometry();
    sheetGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    this.scanSheet = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({ color: '#72bfa8', transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false }));
    this.scanSheet.frustumCulled = false; this.scene.add(this.scanSheet);
    const lines = [];
    for (let i = 0; i < 13; i++) {
      const end = this.rayTargets?.[i]?.clone() || new THREE.Vector3(2.055, .65 + random(i + 311) * 1.37, -1.55 + i / 12 * 2.8);
      lines.push(...this.source.toArray(), ...end.toArray());
      const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(.045, 0), new THREE.MeshBasicMaterial({ color: i > 4 && i < 9 ? P.coral : '#6cb59c' }));
      const trail = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .22, 4), new THREE.MeshBasicMaterial({ color: '#72b59c', transparent: true, opacity: .7 }));
      trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(this.source).normalize());
      this.scene.add(dot, trail); this.pulses.push({ dot, trail, end, blocked: i > 4 && i < 9 });
    }
    const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    this.rays = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#78b29e', transparent: true, opacity: .16, depthWrite: false })); this.scene.add(this.rays);
  }
  setupCloud() {
    this.cloud = new THREE.Group(); this.cloudScene.add(this.cloud);
    if (this.kind === 'dirt') {
      const reference = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.10, 2.12, 3.7)), new THREE.LineBasicMaterial({ color: '#a6b3a0', transparent: true, opacity: .4 }));
      reference.position.set(2.15, 1.26, -.4); this.cloud.add(reference);
      this.samples = [];
      for (let z = -2.22; z <= 1.44; z += .115) for (let y = .23; y <= 2.25; y += .115) this.samples.push({ p: [2.06, y, z], tag: 'wall' });
    } else this.cloudScene.add(this.references);
    const floor = new THREE.GridHelper(7, 7, '#d6d9bf', '#e2e1cb'); floor.position.y = .06; this.cloudScene.add(floor);
    this.returnGeo = new THREE.BufferGeometry();
    this.returnGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4096 * 3), 3));
    this.returnPoints = new THREE.Points(this.returnGeo, new THREE.PointsMaterial({ color: '#5b9e87', size: 2.5, sizeAttenuation: false, transparent: true }));
    this.cloud.add(this.returnPoints);
    this.noiseGeo = new THREE.BufferGeometry();
    this.noiseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2048 * 3), 3));
    this.noisePoints = new THREE.Points(this.noiseGeo, new THREE.PointsMaterial({ color: P.coral, size: 3.5, sizeAttenuation: false })); this.cloud.add(this.noisePoints);
    if (this.isHero) {
      this.heroReturns = new THREE.Points(this.returnGeo, new THREE.PointsMaterial({ color: '#f6f4d7', size: 2.8, sizeAttenuation: false }));
      this.scene.add(this.heroReturns);
    }
  }
  setupOverlay() {
    const stage = document.createElement('div'); stage.className = 'lowpoly-stage';
    this.canvas.before(stage); stage.append(this.canvas); this.stage = stage;
    const overlay = document.createElement('div'); overlay.className = 'lowpoly-overlay';
    overlay.innerHTML = '<div class="lowpoly-heading"><span class="mono">WINDOW / 08</span><p>一层脏污，<br>一片缺失。</p></div><div class="lowpoly-return"><span class="mono">POINT CLOUD</span><strong>目标回波</strong><span class="return-condition"></span></div><div class="lowpoly-label sensor-label">LiDAR<span>局部窗口污染</span></div><div class="lowpoly-label wall-label">目标墙<span>表面保持完整</span></div><div class="lowpoly-status"><i></i><span></span></div>';
    stage.append(overlay);
    this.sensorLabel = overlay.querySelector('.sensor-label'); this.wallLabel = overlay.querySelector('.wall-label');
    this.status = overlay.querySelector('.lowpoly-status span'); this.condition = overlay.querySelector('.return-condition');
    this.returnLabel = overlay.querySelector('.lowpoly-return'); this.heading = overlay.querySelector('.lowpoly-heading p');
    overlay.querySelector('.lowpoly-heading .mono').textContent = this.copy.code;
    this.returnLabel.querySelector('strong').textContent = this.copy.result;
    this.wallLabel.firstChild.textContent = this.copy.target;
    this.wallLabel.querySelector('span').textContent = this.copy.note;
    if (this.isHero) stage.classList.add('hero-stage');
  }
  bindCamera() {
    let drag = null;
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      drag = [event.clientX, event.clientY]; this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!drag) return;
      this.yaw -= (event.clientX - drag[0]) * .006;
      this.pitch = clamp(this.pitch + (event.clientY - drag[1]) * .004, .14, 1.48);
      drag = [event.clientX, event.clientY]; this.view = 'custom'; this.onView?.('custom'); this.draw();
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.canvas.addEventListener(event, () => { drag = null; });
    this.canvas.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      this.yaw += event.key === 'ArrowLeft' ? .08 : event.key === 'ArrowRight' ? -.08 : 0;
      this.pitch = clamp(this.pitch + (event.key === 'ArrowUp' ? .06 : event.key === 'ArrowDown' ? -.06 : 0), .14, 1.48);
      this.view = 'custom'; this.onView?.('custom'); this.draw();
    });
  }
  setView(view) {
    this.view = view;
    [this.yaw, this.pitch] = view === 'front' ? [0, .18] : view === 'side' ? [Math.PI / 2, .26] : view === 'top' ? [this.defaultYaw, 1.48] : [this.defaultYaw, .48];
    this.draw();
  }
  update(value) { this.value = Number(value); this.rebuild(); this.draw(); }
  setBaseline(active) { this.baseline = active; this.rebuild(); this.draw(); }
  setPhase(phase) {
    this.time = phase * 3 + 1.6; this.phase = phase; this.paused = true;
    this.onPhase?.(phase); this.onPause?.(); this.draw();
  }
  reset() {
    this.time = this.paused ? 8.8 : 1.6; this.phase = this.paused ? 2 : 0;
    this.mode = 'compare'; this.baseline = false; this.targetKind = 'person'; this.setView('orbit'); this.rebuild(); this.draw();
  }
  rebuild() {
    const value = this.baseline ? baselineValue(this.kind) : this.value;
    const coverage = this.kind === 'dirt' ? value / 100 : 0; this.coverage = coverage;
    if (this.kind === 'range' && this.modelKey !== this.targetKind + ':' + value) {
      buildTopic(this, value); this.modelKey = this.targetKind + ':' + value;
    }
    if (this.kind === 'glass') {
      this.glassGroup.rotation.y = value * Math.PI / 180;
      this.glassReference.position.set(0, 0, 0); this.glassReference.rotation.set(0, 0, 0);
      this.glassReference.matrix.identity();
      this.glassGroup.updateWorldMatrix(true, true);
      this.glassReference.applyMatrix4(this.glassGroup.children[0].matrixWorld);
    }
    if (this.kind === 'wet') this.puddle.visible = value > 0;
    if (this.kind === 'fog') {
      this.fogGroup.visible = value > 0;
      this.fogGroup.children.forEach((puff) => { puff.material.opacity = .025 + value / 100 * .23; });
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.pulses.forEach(({ dot, trail, blocked }) => {
      const color = blocked && coverage > .05 ? P.coral : '#6cb59c';
      dot.material.color.set(color); trail.material.color.set(color);
    });
    this.windowDirt.children.forEach((mesh, i) => {
      mesh.visible = coverage > i * .09; mesh.scale.setScalar(clamp((coverage - i * .09) * 3, .08, 1));
    });
    const points = returnsFor(this.kind, this.samples, value);
    for (const [geometry, list] of [[this.returnGeo, points.valid], [this.noiseGeo, points.anomalous]]) {
      const attribute = geometry.getAttribute('position');
      list.forEach((p, i) => attribute.setXYZ(i, ...p));
      attribute.needsUpdate = true; geometry.setDrawRange(0, list.length); geometry.computeBoundingSphere();
    }
    if (this.stage) {
      const clean = this.baseline || value === baselineValue(this.kind);
      this.stage.classList.toggle('is-clean', clean);
      this.heading.innerHTML = clean ? this.copy.clean || '' : this.copy.heading;
      this.sensorLabel.querySelector('span').textContent = this.kind === 'dirt' ? coverage ? '局部窗口污染' : '清洁窗口' : '发射与接收';
      this.condition.textContent = clean ? '基准条件 · 定性示意' : this.copy.condition;
      this.canvas.dataset.returnCount = points.valid.length;
      this.canvas.dataset.anomalyCount = points.anomalous.length;
      if (this.targetName) this.wallLabel.firstChild.textContent = this.targetName;
    }
  }
  tick(now) {
    const dt = Math.min((now - this.lastFrame) / 1000, .05); this.lastFrame = now;
    if (!this.visible || this.canvas.closest('[hidden]') || this.paused) return;
    this.time += dt;
    const phase = Math.floor((this.time % 9) / 3);
    if (phase !== this.phase) { this.phase = phase; this.onPhase?.(phase); }
    if (now - this.lastDraw > 1000 / 40) { this.draw(); this.lastDraw = now; }
  }
  updateMotion() {
    if (this.kind !== 'dirt') { this.updateTopicMotion(); return; }
    const t = this.time % 9, phase = Math.floor(t / 3), progress = (t % 3) / 3;
    this.fan.visible = this.mode === 'compare' && phase < 2; this.fan.material.opacity = .045 + Math.sin(progress * Math.PI) * .035;
    this.wallSweep.visible = phase !== 1; this.wallSweep.position.z = -1.65 + progress * 2.84;
    this.backSweep.visible = this.wallSweep.visible; this.backSweep.position.z = this.wallSweep.position.z;
    const scanZ = this.wallSweep.position.z;
    const obstructed = scanZ > -.95 && scanZ < .18 && this.coverage > .05;
    const reach = obstructed ? 1 - this.coverage * .72 : 1;
    const lower = this.source.clone().lerp(new THREE.Vector3(2.055, .28, scanZ), reach);
    const upper = this.source.clone().lerp(new THREE.Vector3(2.055, 2.27, scanZ), reach);
    const sheet = this.scanSheet.geometry.getAttribute('position');
    sheet.setXYZ(0, ...this.source.toArray()); sheet.setXYZ(1, ...lower.toArray()); sheet.setXYZ(2, ...upper.toArray());
    sheet.needsUpdate = true; this.scanSheet.visible = phase < 2;
    this.scanSheet.material.color.set(obstructed ? P.coral : '#72bfa8');
    this.scanSheet.material.opacity = phase === 0 ? .18 : .10;
    this.wallSweep.material.opacity = obstructed ? .08 : .65;
    this.pulses.forEach(({ dot, trail, end, blocked }, i) => {
      const p = (progress + i * .062) % 1, travel = smooth(phase === 1 ? 1 - p : p);
      dot.position.lerpVectors(this.source, end, blocked && this.coverage > .05 ? travel * (1 - this.coverage * .82) : travel);
      trail.position.copy(dot.position); trail.visible = phase < 2;
      dot.visible = phase < 2; dot.scale.setScalar(blocked ? 1 + this.coverage * .35 : 1);
    });
    this.returnPoints.material.opacity = phase === 2 ? 1 : .74;
    const status = ['发射扫描', '回波返回', '点云成像'][phase] + (this.paused ? ' · 已暂停' : ' · 循环演示');
    if (this.status.textContent !== status) this.status.textContent = status;
  }
  updateTopicMotion() {
    const phase = Math.floor((this.time % 9) / 3), progress = (this.time % 3) / 3;
    const value = this.baseline ? baselineValue(this.kind) : this.value;
    const bounds = this.scanBounds, z = bounds[3] + smooth(progress) * (bounds[4] - bounds[3]);
    const fogReach = this.kind === 'fog' ? 1 - value / 100 * .35 : 1;
    const low = this.source.clone().lerp(new THREE.Vector3(bounds[0], bounds[1], z), fogReach);
    const high = this.source.clone().lerp(new THREE.Vector3(bounds[0], bounds[2], z), fogReach);
    const sheet = this.scanSheet.geometry.getAttribute('position');
    sheet.setXYZ(0, ...this.source.toArray()); sheet.setXYZ(1, ...low.toArray()); sheet.setXYZ(2, ...high.toArray());
    sheet.needsUpdate = true; this.scanSheet.visible = phase < 2;
    this.scanSheet.material.opacity = phase === 0 ? .16 : .09;
    this.fan.visible = false;
    if (this.wallSweep) {
      this.wallSweep.visible = phase !== 1; this.wallSweep.position.z = z;
      this.backSweep.visible = this.wallSweep.visible; this.backSweep.position.z = z;
    }
    const linePositions = this.rays.geometry.getAttribute('position');
    this.pulses.forEach(({ dot, trail, end }, i) => {
      end.copy(this.rayTargets[i]);
      linePositions.setXYZ(i * 2, ...this.source.toArray()); linePositions.setXYZ(i * 2 + 1, ...end.toArray());
      const t = (progress + i * .062) % 1;
      dot.position.lerpVectors(this.source, end, smooth(phase === 1 ? 1 - t : t) * fogReach);
      dot.visible = phase < 2; trail.visible = phase < 2; trail.position.copy(dot.position);
      trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(this.source).normalize());
      const abnormal = phase === 1 && value > 0 && ['ghost', 'tail', 'wet', 'fog'].includes(this.kind) && i % 3 === 0;
      dot.material.color.set(abnormal ? P.coral : '#6cb59c'); trail.material.color.copy(dot.material.color);
    });
    linePositions.needsUpdate = true;
    this.rays.geometry.computeBoundingSphere();
    if (this.fogGroup) this.fogGroup.children.forEach((puff, i) => {
      const [x, y, z] = puff.userData.origin;
      puff.position.set(x + Math.sin(this.time * .35 + i) * .11, y + Math.sin(this.time * .25 + i) * .035, z + Math.cos(this.time * .30 + i) * .07);
    });
    this.returnPoints.material.opacity = phase === 2 ? 1 : .74;
    if (this.heroReturns) this.heroReturns.visible = phase === 2;
    const status = ['发射扫描', '回波返回', '点云成像'][phase] + (this.paused ? ' · 已暂停' : ' · 循环演示');
    if (this.status.textContent !== status) this.status.textContent = status;
  }
  moveCamera(camera, width, height, cloud = false) {
    const cameraSpan = (this.isHero ? 7.8 : this.viewSpan) + Math.max(0, (this.pitch - .75) / .73) * 2;
    const aspect = width / height, span = cloud ? Math.max(this.copy.cloudSpan || 3.5, (this.copy.cloudWidth || 4.6) / aspect) : cameraSpan;
    camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2;
    const fixedCloud = cloud && this.mode === 'compare';
    const yaw = fixedCloud ? this.copy.cloudYaw || .26 : this.yaw, pitch = fixedCloud ? .3 : this.pitch;
    const target = cloud ? v3(this.copy.cloudCenter || [.7, 1, -.3]) : this.lookAt;
    camera.position.set(Math.cos(yaw) * Math.cos(pitch) * 16, Math.sin(pitch) * 16, Math.sin(yaw) * Math.cos(pitch) * 16).add(target);
    camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  placeLabel(element, world, camera, viewport) {
    const p = v3(world).project(camera);
    const x = viewport.x + (p.x + 1) * viewport.w / 2, y = viewport.y + (1 - p.y) * viewport.h / 2;
    element.hidden = !(x > 35 && x < viewport.x + viewport.w - 35 && y > 95 && y < viewport.y + viewport.h - 50) || this.mode === 'cloud' || this.mobile;
    element.style.left = x + 'px'; element.style.top = y + 'px';
  }
  draw() {
    const width = this.canvas.getBoundingClientRect().width;
    if (!width || !this.renderer || this.canvas.closest('[hidden]')) return;
    this.mobile = width < 620;
    const height = Math.round(width * (this.isHero ? .88 : this.mobile && this.mode === 'compare' ? 1.5 : .59));
    this.canvas.style.aspectRatio = width + ' / ' + height;
    if (this.width !== width || this.height !== height || activeScene !== this) {
      this.width = width; this.height = height; this.renderer.setSize(width, height, false);
      if (activeScene !== this) {
        this.stage.prepend(this.renderer.domElement); activeScene = this;
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
    this.updateMotion(); this.stage.classList.toggle('cloud-only', this.mode === 'cloud');
    const inset = this.mobile
      ? { x: 16, y: height - width * .39 - 15, w: width - 32, h: width * .39 }
      : { x: width * .73, y: height * .32, w: width * .245, h: width * .27 };
    const world = this.isHero ? { x: 0, y: 0, w: width, h: height } : { x: 0, y: this.mobile ? 70 : 0, w: this.mobile ? width : width * .81, h: this.mobile ? width * .72 : height };
    this.renderer.setScissorTest(false); this.renderer.setClearColor(P.cream, 0); this.renderer.clear();
    if (this.mode === 'compare') {
      this.moveCamera(this.camera, world.w, world.h);
      this.renderer.setViewport(world.x, height - world.y - world.h, world.w, world.h); this.renderer.render(this.scene, this.camera);
      this.placeLabel(this.sensorLabel, [-2.65, -.35, 1.1], this.camera, world);
      this.placeLabel(this.wallLabel, this.targetLabelPosition || [2.15, 2.58, -.4], this.camera, world);
      this.returnLabel.style.left = inset.x + 'px'; this.returnLabel.style.top = inset.y - 52 + 'px'; this.returnLabel.style.width = inset.w + 'px';
    } else {
      this.sensorLabel.hidden = true; this.wallLabel.hidden = true;
      this.returnLabel.style.left = '24px'; this.returnLabel.style.top = '24px'; this.returnLabel.style.width = 'auto';
    }
    if (this.isHero) return;
    const cloud = this.mode === 'cloud' ? { x: 0, y: 0, w: width, h: height } : inset;
    this.moveCamera(this.cloudCamera, cloud.w, cloud.h, true);
    this.renderer.setScissorTest(true); this.renderer.setScissor(cloud.x, height - cloud.y - cloud.h, cloud.w, cloud.h);
    this.renderer.setViewport(cloud.x, height - cloud.y - cloud.h, cloud.w, cloud.h);
    this.renderer.setClearColor('#f0edda', 1); this.renderer.clear(); this.renderer.render(this.cloudScene, this.cloudCamera);
    this.renderer.setScissorTest(false);
  }
}
