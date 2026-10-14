import { cameraCondition, rowDisplacement } from './camera-data.js';

const C = { ink: '#40594e', muted: '#81917d', coral: '#dd8b72', mint: '#a6c5af', paper: '#f3ecd5' };
const hash = (i) => { const n = Math.sin(i * 127.1 + 31.7) * 43758.5453; return n - Math.floor(n); };

export class CameraScene {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.kind = canvas.dataset.camera;
    this.value = Number(canvas.closest('article').querySelector('input').value);
    this.targetKind = 'person'; this.baseline = false; this.time = 0; this.phase = 0;
    this.lastFrame = performance.now(); this.lastDraw = 0; this.visible = false;
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.paused = this.motionPreference.matches;
    this.motionPreference.addEventListener('change', (event) => {
      if (event.matches) { this.paused = true; this.onPause?.(); this.draw(); }
    });
    this.frame = document.createElement('canvas'); this.frame.width = 480; this.frame.height = 270;
    this.buffer = document.createElement('canvas');
    this.resizeObserver = new ResizeObserver(() => this.draw()); this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting; this.lastFrame = performance.now(); if (this.visible) this.draw();
    }); this.intersectionObserver.observe(canvas);
    this.draw();
  }
  update(value) { this.value = Number(value); this.draw(); }
  setBaseline(active) { this.baseline = active; this.draw(); }
  rebuild() {}
  reset() { this.time = 0; this.baseline = false; this.targetKind = 'person'; this.draw(); }
  tick(now) {
    const dt = Math.max(0, Math.min((now - this.lastFrame) / 1000, .05)); this.lastFrame = now;
    if (!this.visible || this.paused || this.canvas.closest('[hidden]')) return;
    this.time += dt;
    if (now - this.lastDraw > 1000 / 20) { this.draw(); this.lastDraw = now; }
  }
  text(c, text, x, y, size = 15, color = C.ink) {
    if (c.canvas === this.frame && this.mobile) size *= 1.35;
    c.fillStyle = color; c.font = `${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`; c.fillText(text, x, y);
  }
  target(c, x, y, scale = 1) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.fillStyle = C.coral;
    if (this.targetKind === 'car') {
      c.fillRect(-45, -30, 90, 28); c.fillRect(-27, -50, 50, 22);
      c.fillStyle = '#638c81'; c.fillRect(-21, -45, 38, 15);
      c.fillStyle = C.ink; for (const dx of [-28, 28]) { c.beginPath(); c.arc(dx, 0, 10, 0, 7); c.fill(); }
    } else if (this.targetKind === 'cone') {
      c.beginPath(); c.moveTo(0, -60); c.lineTo(22, 0); c.lineTo(-22, 0); c.closePath(); c.fill();
      c.fillStyle = '#f8f1da'; c.fillRect(-9, -38, 18, 8); c.fillStyle = C.ink; c.fillRect(-27, 0, 54, 7);
    } else {
      if (this.targetKind === 'rider') {
        c.strokeStyle = C.ink; c.lineWidth = 4;
        for (const dx of [-25, 25]) { c.beginPath(); c.arc(dx, -2, 17, 0, 7); c.stroke(); }
        c.beginPath(); c.moveTo(-25, -2); c.lineTo(0, -27); c.lineTo(25, -2); c.lineTo(-25, -2); c.stroke();
      }
      c.beginPath(); c.arc(0, -80, 11, 0, 7); c.fill(); c.fillRect(-12, -65, 24, 38);
      c.strokeStyle = C.ink; c.lineWidth = 7;
      c.beginPath(); c.moveTo(-7, -28); c.lineTo(-10, 0); c.moveTo(7, -28); c.lineTo(10, 0);
      c.moveTo(-12, -58); c.lineTo(-25, -33); c.moveTo(12, -58); c.lineTo(25, -33); c.stroke();
    }
    c.restore();
  }
  road(c, model) {
    c.fillStyle = '#dce4cf'; c.fillRect(0, 0, 480, 270);
    c.fillStyle = '#b6cab0'; c.beginPath(); c.moveTo(0, 114); c.lineTo(75, 55); c.lineTo(161, 111); c.lineTo(273, 39); c.lineTo(405, 108); c.lineTo(480, 74); c.lineTo(480, 160); c.lineTo(0, 160); c.fill();
    c.fillStyle = '#8da894'; c.fillRect(0, 143, 480, 127);
    c.fillStyle = '#b6b89e'; c.beginPath(); c.moveTo(212, 142); c.lineTo(283, 142); c.lineTo(455, 270); c.lineTo(29, 270); c.fill();
    c.strokeStyle = '#f8f0d5'; c.lineWidth = 4; c.setLineDash([13, 14]);
    c.beginPath(); c.moveTo(248, 151); c.lineTo(240, 270); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#efe6c6'; c.fillRect(62, 91, 86, 62); c.fillStyle = '#779989';
    for (let x = 71; x < 140; x += 17) c.fillRect(x, 103, 8, 16);
    c.fillStyle = C.ink; c.fillRect(387, 76, 5, 113); c.fillRect(367, 46, 46, 85);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i === 0 ? `rgba(239,134,100,${.08 + model.led * .92})` : '#738271';
      c.beginPath(); c.arc(390, 62 + i * 25, 8, 0, 7); c.fill();
    }
    if (this.kind === 'flicker' && model.amount) {
      c.fillStyle = `rgba(40,58,47,${model.amount * .65})`;
      for (let y = 48; y < 130; y += 18) c.fillRect(367, y + Math.sin(this.time) * 5, 46, 7);
    }
    const moving = ['motion', 'shutter'].includes(this.kind);
    const x = 230 + (moving ? Math.sin(this.time * .7) * 75 : 0);
    if (model.smear) {
      c.globalAlpha = 1 / 25;
      for (let i = 0; i < 25; i++) this.target(c, x + model.smear * (i / 24 - .5), 227);
      c.globalAlpha = 1;
    } else if (model.rowShift) {
      for (let y = 128; y < 237; y += 2) {
        c.save(); c.beginPath(); c.rect(0, y, 480, 2); c.clip();
        this.target(c, x + rowDisplacement(y, 270, model.rowShift), 227); c.restore();
      }
    } else this.target(c, x, 227);
    // A fixed texture chart makes actual sampling/detail loss visible.
    c.fillStyle = '#f6efd8'; c.fillRect(299, 171, 45, 41);
    c.fillStyle = C.ink; for (let i = 0; i < 10; i++) c.fillRect(302 + i * 4, 175, 2, 32);
  }
  grid(c, model) {
    c.fillStyle = '#eceddc'; c.fillRect(0, 0, 480, 270); c.strokeStyle = '#799b84'; c.lineWidth = 1.8;
    const project = (x, y) => {
      const nx = (x - 240) / 240, ny = (y - 135) / 135, k = 1 - model.distortion * (nx * nx + ny * ny);
      return [240 + (x - 240) * k, 135 + (y - 135) * k];
    };
    for (let x = 20; x <= 460; x += 44) {
      c.beginPath(); for (let y = 14; y <= 256; y += 2) { const p = project(x, y); y === 14 ? c.moveTo(...p) : c.lineTo(...p); } c.stroke();
    }
    for (let y = 14; y <= 256; y += 27) {
      c.beginPath(); for (let x = 20; x <= 460; x += 2) { const p = project(x, y); x === 20 ? c.moveTo(...p) : c.lineTo(...p); } c.stroke();
    }
    this.text(c, '中央', 223, 142, 14); this.text(c, '边缘', 375, 216, 14);
  }
  timing(c, model) {
    c.fillStyle = '#eeedda'; c.fillRect(0, 0, 480, 270);
    this.text(c, '同一时间基准 · 曝光事件示意', 20, 27, 14);
    for (let i = 0; i < 2; i++) {
      const y = 83 + i * 79; this.text(c, '相机 ' + (i ? 'B' : 'A'), 18, y - 22, 13);
      c.strokeStyle = '#b3bfa5'; c.beginPath(); c.moveTo(85, y); c.lineTo(451, y); c.stroke();
      for (let n = 0; n < 5; n++) {
        const x = 100 + n * 67 + (i ? model.offset : 0);
        c.strokeStyle = '#a6b499'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(100 + n * 67, 52); c.lineTo(100 + n * 67, 202); c.stroke(); c.setLineDash([]);
        if (i && n === 2 && model.missing) { this.text(c, '缺帧', x - 12, y - 13, 12, '#ad674f'); continue; }
        c.fillStyle = i ? C.coral : '#729d82'; c.fillRect(x, y - 13, 14, 26);
      }
    }
    this.text(c, model.amount ? 'B 的曝光偏移；虚线为共同触发参考' : 'A / B 曝光对齐参考', 20, 229, 13);
    this.text(c, '示意图不对应毫秒；接收时刻另测', 20, 251, 12, C.muted);
  }
  image(model) {
    const c = this.frame.getContext('2d'); c.clearRect(0, 0, 480, 270);
    if (this.kind === 'geometry') this.grid(c, model);
    else if (this.kind === 'timing') this.timing(c, model);
    else this.road(c, model);
    if (model.resolution < 480) {
      this.buffer.width = model.resolution; this.buffer.height = Math.round(model.resolution * 270 / 480);
      this.buffer.getContext('2d').drawImage(this.frame, 0, 0, this.buffer.width, this.buffer.height);
      c.imageSmoothingEnabled = false; c.drawImage(this.buffer, 0, 0, 480, 270); c.imageSmoothingEnabled = true;
    }
    if (model.darkness) { c.fillStyle = `rgba(15,27,24,${model.darkness})`; c.fillRect(0, 0, 480, 270); }
    if (model.noise) {
      const seed = Math.floor(this.time * 12) * 1337;
      for (let i = 0; i < 2200; i++) { c.fillStyle = `rgba(${i % 2 ? '240,239,184' : '8,26,22'},${hash(i + seed + 20) * model.noise * .4})`; c.fillRect(hash(i + seed) * 480, hash(i + seed + 6) * 270, 2, 2); }
    }
    if (model.clipping) {
      c.fillStyle = `rgba(255,250,224,${model.clipping * .97})`; c.fillRect(295, 0, 185, 230);
      c.fillStyle = `rgba(18,28,24,${model.clipping * .85})`; c.fillRect(0, 0, 292, 270);
      const g = c.createRadialGradient(420, 46, 4, 420, 46, 90); g.addColorStop(0, '#fff8df'); g.addColorStop(1, 'rgba(255,248,223,0)'); c.fillStyle = g; c.fillRect(300, 0, 180, 140);
    }
    if (model.haze) {
      const g = c.createLinearGradient(0, 80, 0, 270);
      g.addColorStop(0, `rgba(240,239,220,${model.haze})`); g.addColorStop(1, `rgba(240,239,220,${model.haze * .4})`);
      c.fillStyle = g; c.fillRect(0, 0, 480, 270);
    }
    if (model.dirt) {
      this.buffer.width = 480; this.buffer.height = 270; this.buffer.getContext('2d').drawImage(this.frame, 0, 0);
      for (let i = 0; i < 6; i++) {
        const x = hash(i + 30) * 440, y = hash(i + 90) * 250;
        c.save(); c.beginPath(); c.arc(x, y, 20 + model.dirt * 30, 0, 7); c.clip();
        c.globalAlpha = model.dirt; c.filter = `blur(${model.dirt * 5}px)`; c.drawImage(this.buffer, 0, 0); c.restore();
        const g = c.createRadialGradient(x, y, 3, x, y, 35 + model.dirt * 35);
        g.addColorStop(0, `rgba(132,111,76,${model.dirt * .6})`); g.addColorStop(1, 'rgba(190,179,132,0)');
        c.fillStyle = g; c.fillRect(x - 80, y - 80, 160, 160);
      }
      c.fillStyle = `rgba(242,231,198,${model.dirt * .25})`; c.fillRect(0, 0, 480, 270);
    }
    return this.frame;
  }
  draw() {
    const rect = this.canvas.getBoundingClientRect(); if (!rect.width || !this.ctx) return;
    const mobile = rect.width < 580, width = 1000, height = mobile ? 1260 : 395;
    this.mobile = mobile;
    this.canvas.style.aspectRatio = `${width}/${height}`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.width * height / width * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const c = this.ctx; c.setTransform(w / width, 0, 0, h / height, 0, 0); c.fillStyle = C.paper; c.fillRect(0, 0, width, height);
    const frameWidth = mobile ? 940 : 460, frameHeight = frameWidth * 270 / 480;
    const boxes = mobile ? [[30, 70], [30, 687]] : [[26, 51], [514, 51]];
    for (const [i, [baseX, y]] of boxes.entries()) {
      const x = baseX;
      this.text(c, i ? (this.baseline ? 'B / 无影响参考' : 'B / 当前条件示意') : 'A / 无影响参考', x, y - 15, mobile ? 34 : 17);
      const model = cameraCondition(this.kind, i && !this.baseline ? this.value : 0, this.time);
      c.drawImage(this.image(model), x, y, frameWidth, frameHeight);
      c.strokeStyle = '#c8cfb6'; c.lineWidth = 1.5; c.strokeRect(x, y, frameWidth, frameHeight);
    }
    this.text(c, '同一构图 · 定性对照 · 示意程度不对应设备参数', mobile ? 30 : 26, height - 20, mobile ? 29 : 14, C.muted);
  }
}
