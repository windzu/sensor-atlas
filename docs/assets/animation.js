// All scenes are qualitative illustrations, not calibrated sensor simulations.
const C = { ink: '#173b3c', teal: '#147b7d', tealLight: '#75a5a0', orange: '#cb6536', muted: '#657676', line: '#b9cabc', pale: '#dbe5d6', lime: '#dfeaab' };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise = (n) => (hash(n) + hash(n + 1000) + hash(n + 2000) + hash(n + 3000) - 2);

export class AtlasScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.kind = canvas.dataset.scene;
    this.width = 900;
    this.height = this.kind === 'hero' ? 540 : 440;
    this.value = this.kind === 'hero' ? 50 : Number(canvas.closest('article')?.querySelector('input[type=range]')?.value || 60);
    this.targetKind = 'person';
    this.hitContext = document.createElement('canvas').getContext('2d');
    this.paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.visible = false;
    this.time = 0;
    this.mobile = false;
    this.lastFrame = performance.now();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.draw();
    }, { rootMargin: '80px' });
    this.intersectionObserver.observe(canvas);
  }
  update(value) { this.value = Number(value); this.draw(); }
  tick(now) {
    const delta = Math.min((now - this.lastFrame) / 1000, .05);
    this.lastFrame = now;
    if (!this.paused && this.visible) { this.time += delta; this.draw(); }
  }
  draw() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.ctx.setTransform(w / this.width, 0, 0, h / this.height, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.mobile = rect.width < 430;
    this.grid();
    const render = this[this.kind];
    if (typeof render === 'function') render.call(this, this.time);
  }
  grid() {
    const x = this.ctx;
    x.fillStyle = '#bfd0bc';
    x.globalAlpha = .65;
    for (let i = 24; i < this.width; i += 34) for (let j = 24; j < this.height; j += 34) {
      x.beginPath(); x.arc(i, j, .85, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
  }
  line(x1, y1, x2, y2, color = C.line, width = 2, dashed = false, alpha = 1) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width;
    if (dashed) c.setLineDash([7, 7]);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
  }
  poly(points, stroke = C.line, fill = null, width = 2, alpha = 1) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.beginPath();
    points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    c.restore();
  }
  dot(x, y, size = 2.5, color = C.teal, alpha = 1) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.fillStyle = color; c.beginPath(); c.arc(x, y, size, 0, Math.PI * 2); c.fill(); c.restore();
  }
  label(text, x, y, color = C.muted, align = 'left', size = 20) {
    const c = this.ctx; c.save(); c.fillStyle = color; c.textAlign = align;
    c.font = (this.mobile ? Math.max(size, 32) : size) + 'px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    c.fillText(text, x, y); c.restore();
  }
  sensor(x = 108, y = 225, label = true) {
    const c = this.ctx; c.save();
    c.fillStyle = C.ink; c.beginPath(); c.roundRect(x - 43, y - 31, 86, 58, 11); c.fill();
    c.fillStyle = '#5e8e7e'; c.fillRect(x - 43, y - 13, 86, 11);
    c.strokeStyle = '#dfeaab'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y - 25, 29, 5, 0, 0, Math.PI * 2); c.stroke();
    this.dot(x + 32, y + 15, 3, C.lime);
    this.line(x - 22, y + 29, x - 29, y + 53, C.ink, 2);
    this.line(x + 22, y + 29, x + 29, y + 53, C.ink, 2);
    if (label) this.label('LiDAR', x, y + 79, C.ink, 'center', 19);
    c.restore();
  }
  beam(ax, ay, bx, by, t, color = C.orange, alpha = .6, offset = 0) {
    this.line(ax, ay, bx, by, color, 1.5, false, alpha * .25);
    const s = ((t * .45 + offset) % 1 + 1) % 1;
    this.line(ax + (bx - ax) * Math.max(0, s - .09), ay + (by - ay) * Math.max(0, s - .09), ax + (bx - ax) * s, ay + (by - ay) * s, color, 2.7, false, alpha);
    const r = ((t * .45 + offset + .48) % 1 + 1) % 1;
    this.dot(bx + (ax - bx) * r, by + (ay - by) * r, 3, C.teal, alpha);
  }
  surfacePoints(x, y, w, h, spacing = 12, alpha = 1, seed = 0) {
    for (let j = 0; j <= h; j += spacing) for (let i = 0; i <= w; i += spacing) {
      this.dot(x + i + noise(i + j + seed) * .8, y + j, 2.2, C.teal, alpha);
    }
  }
  targetPath(kind, cx, bottom, scale = 1) {
    const p = new Path2D();
    const X = (v) => cx + v * scale, Y = (v) => bottom + v * scale;
    if (kind === 'person' || kind === 'rider') {
      p.arc(X(0), Y(-169), 16 * scale, 0, Math.PI * 2);
      p.rect(X(-24), Y(-143), 48 * scale, 70 * scale);
      p.rect(X(-22), Y(-74), 17 * scale, 74 * scale);
      p.rect(X(5), Y(-74), 17 * scale, 74 * scale);
      p.rect(X(-39), Y(-137), 13 * scale, 69 * scale);
      p.rect(X(26), Y(-137), 13 * scale, 69 * scale);
      if (kind === 'rider') {
        p.rect(X(-56), Y(-96), 112 * scale, 9 * scale);
        p.ellipse(X(0), Y(-26), 9 * scale, 27 * scale, 0, 0, Math.PI * 2);
        p.rect(X(-7), Y(-86), 14 * scale, 56 * scale);
      }
    } else if (kind === 'car') {
      p.moveTo(X(-108), Y(-29)); p.lineTo(X(-97), Y(-94)); p.lineTo(X(-67), Y(-140)); p.lineTo(X(67), Y(-140));
      p.lineTo(X(97), Y(-94)); p.lineTo(X(108), Y(-29)); p.closePath();
      p.rect(X(-93), Y(-30), 30 * scale, 30 * scale); p.rect(X(63), Y(-30), 30 * scale, 30 * scale);
    } else {
      p.moveTo(X(-9), Y(-122)); p.lineTo(X(9), Y(-122)); p.lineTo(X(47), Y(-14)); p.lineTo(X(-47), Y(-14)); p.closePath();
      p.rect(X(-62), Y(-14), 124 * scale, 14 * scale);
    }
    return p;
  }
  target(kind, cx, bottom, scale = 1, spacing = 9, alpha = 1, color = C.teal, outline = true) {
    const c = this.ctx, p = this.targetPath(kind, cx, bottom, scale);
    if (outline) { c.save(); c.strokeStyle = C.line; c.lineWidth = 1.4; c.setLineDash([5, 6]); c.stroke(p); c.restore(); }
    for (let y = bottom - 195 * scale; y <= bottom; y += spacing) for (let x = cx - 120 * scale; x <= cx + 120 * scale; x += spacing) {
      if (this.hitContext.isPointInPath(p, x, y)) this.dot(x, y, spacing > 17 ? 3.2 : 2.4, color, alpha);
    }
  }
  hero(t) {
    const c = this.ctx;
    const origin = [460, 455];
    const left = [[80, 275], [135, 244], [270, 312], [215, 347]];
    const right = [[645, 185], [800, 242], [800, 361], [645, 302]];
    this.poly([[80, 275], [80, 150], [135, 119], [135, 244]], C.line, '#dae3d6');
    this.poly([[135, 119], [270, 187], [270, 312], [135, 244]], C.line, '#eff4e9');
    this.poly(left, C.line, '#e6ecde');
    this.poly(right, C.line, '#e4ecde');
    this.poly([[645, 185], [723, 143], [857, 197], [800, 242]], C.line, '#f9fbf2');
    this.poly([[800, 242], [857, 197], [857, 316], [800, 361]], C.line, '#d5e1d0');
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 14; col++) {
        const u = col / 13, v = row / 9;
        this.dot(135 + u * 135, 125 + u * 68 + v * 119, 2, C.teal, .72);
        this.dot(650 + u * 147, 194 + u * 54 + v * 102, 2, C.teal, .8);
      }
    }
    this.line(225, 412, 647, 236, C.line, 1.2, true);
    this.line(690, 457, 337, 197, C.line, 1.2, true);
    this.target('cone', 450, 320, .52, 6, .85);
    const angle = Math.sin(t * .45) * .65 - 1.58;
    const end = [origin[0] + Math.cos(angle) * 338, origin[1] + Math.sin(angle) * 338];
    c.save(); c.fillStyle = '#cb653616'; c.beginPath(); c.moveTo(...origin); c.arc(...origin, 338, angle - .09, angle + .09); c.closePath(); c.fill(); c.restore();
    this.beam(...origin, ...end, t, C.orange, .9);
    for (let i = 0; i < 13; i++) {
      const a = -2.4 + i * .13; this.dot(origin[0] + Math.cos(a) * 230, origin[1] + Math.sin(a) * 230, 2, C.teal, .6);
    }
    this.sensor(...origin, false);
    this.label('表面 → 回波 → 点云', 450, 58, C.ink, 'center', 23);
    this.label('扫描', 735, 445, C.orange, 'center', 19);
    this.line(711, 433, end[0] + 15, end[1] + 9, C.orange, 1, true, .5);
  }
  range(t) {
    const distance = this.value;
    this.sensor(110, 235);
    this.line(185, 337, 812, 337, C.line, 1.4);
    for (let i = 0; i <= 6; i++) this.line(200 + i * 90, 337, 200 + i * 90, 344, C.line, 1.4);
    const targetX = 572 + distance * 1.7;
    const spacing = 5 + distance * .3;
    this.target(this.targetKind, targetX, 320, this.targetKind === 'car' ? 1.12 : 1.17, spacing, .88);
    this.beam(151, 232, targetX, 216, t);
    this.beam(151, 232, targetX - 10, 293, t, C.orange, .6, .2);
    this.label('距离示意 ' + distance + ' m', 455, 393, C.ink, 'center', 22);
    const titles = { person: '人 · 正面', car: '车 · 正面', rider: '骑行者 · 正面', cone: '锥桶 · 正面' };
    this.label(titles[this.targetKind], targetX, 60, C.ink, 'center', 21);
    this.label('轮廓参考', targetX, 362, C.muted, 'center', 17);
  }
  precision(t) {
    const c = this.ctx, spread = 1.7 + (this.value / 80) ** 2 * 16;
    this.label('墙面 · 侧视', 270, 56, C.ink, 'center', 23);
    this.label('墙角 · 俯视', 650, 56, C.ink, 'center', 23);
    this.line(270, 90, 270, 338, C.line, 2);
    this.line(652, 92, 652, 240, C.line, 2);
    this.line(652, 240, 786, 240, C.line, 2);
    for (let i = 0; i < 180; i++) {
      const pulse = Math.sin(t * .8 + i * .01) * .25;
      this.dot(270 + noise(i) * spread + pulse, 99 + hash(i + 5) * 228, 2.6);
      this.dot(652 + noise(i + 600) * spread, 99 + hash(i + 60) * 140, 2.5);
      this.dot(655 + hash(i + 18) * 127, 240 + noise(i + 200) * spread, 2.5);
    }
    const a = spread * 2.4;
    this.line(270 - a, 362, 270 + a, 362, C.orange, 2);
    this.line(270 - a, 354, 270 - a, 370, C.orange, 2);
    this.line(270 + a, 354, 270 + a, 370, C.orange, 2);
    this.label('厚度示意', 270, 402, C.orange, 'center', 20);
    this.label('观察分层与粘连', 650, 333, C.muted, 'center', 20);
    this.beam(444, 280, 280, 214, t, C.orange, .45);
    c.save(); c.strokeStyle = C.line; c.lineWidth = 1; c.setLineDash([4, 6]); c.strokeRect(250 - a, 88, 40 + a * 2, 251); c.restore();
  }
  ghost(t) {
    const amount = this.value / 100, c = this.ctx;
    this.sensor(110, 238);
    this.line(575, 210, 575, 337, C.line, 5);
    c.fillStyle = '#f7f0d9'; c.fillRect(491, 115, 168, 95); c.strokeStyle = C.ink; c.lineWidth = 2; c.strokeRect(491, 115, 168, 95);
    this.surfacePoints(499, 125, 145, 71, 10);
    this.beam(152, 232, 568, 161, t, C.orange, .85);
    this.label('真实反光牌', 575, 79, C.ink, 'center', 22);
    for (let i = 0; i < amount * 80; i++) {
      const a = hash(i + 30) * Math.PI * 2, r = 18 + hash(i + 75) * 22;
      this.dot(575 + Math.cos(a) * (88 + r), 162 + Math.sin(a) * (45 + r), 2.6, C.orange, .5 + .35 * Math.sin(t + i) ** 2);
    }
    if (amount > .05) {
      const fx = 707, fy = 303;
      for (let i = 0; i < amount * 74; i++) this.dot(fx - 65 + hash(i) * 130, fy - 30 + hash(i + 300) * 60, 2.8, C.orange, .6);
      this.line(642, 271, 773, 271, C.orange, 1.4, true);
      this.line(642, 335, 773, 335, C.orange, 1.4, true);
      this.label('错误位置的鬼影', 707, 378, C.orange, 'center', 20);
      this.label('轮廓膨胀', 787, 156, C.orange, 'center', 18);
    } else this.label('观察真实轮廓之外', 570, 381, C.muted, 'center', 21);
  }
  tail(t) {
    const amount = this.value / 100;
    this.sensor(110, 244);
    this.poly([[422, 93], [442, 93], [442, 285], [422, 285]], C.line, '#d9e5d6');
    this.surfacePoints(428, 101, 6, 171, 8);
    this.line(754, 76, 754, 329, C.line, 3);
    for (let j = 80; j < 328; j += 8) this.dot(752 + noise(j) * 2, j, 2.6);
    this.poly([[151, 240], [749, 277], [749, 323]], null, '#cb653610');
    this.beam(151, 240, 440, 283, t, C.orange, .85);
    this.beam(151, 242, 752, 300, t, C.orange, .65, .12);
    for (let i = 0; i < amount * 70; i++) {
      const progress = .06 + hash(i + 7) * .88;
      this.dot(442 + (752 - 442) * progress, 282 + progress * 18 + noise(i) * 10, 2.6, C.orange, .65);
    }
    this.label('近处物体边缘', 431, 55, C.ink, 'center', 20);
    this.label('远处背景', 754, 55, C.ink, 'center', 20);
    this.label(amount > .05 ? '本应为空 → 拉丝／粘连点' : '前后景之间本应为空', 590, 381, amount > .05 ? C.orange : C.muted, 'center', 21);
  }
  glass(t) {
    const angle = this.value / 60, c = this.ctx;
    this.sensor(110, 233);
    this.poly([[470, 85], [506, 70], [506, 336], [470, 351]], '#74a6a0', '#77b7b516', 2);
    this.target('cone', 733, 330, 1.04, 9, .8);
    this.beam(151, 230, 732, 244, t, C.orange, .8);
    for (let i = 0; i < 17 - angle * 11; i++) this.dot(472, 92 + hash(i + 80) * 244, 2.3, C.teal, .7);
    const reflectionEnd = [355 - angle * 120, 78];
    this.beam(484, 238, ...reflectionEnd, t, C.tealLight, .7, .2);
    this.label('玻璃表面', 486, 43, C.ink, 'center', 21);
    this.label('后方真实目标', 733, 86, C.ink, 'center', 21);
    this.label('透射', 605, 215, C.muted, 'center', 19);
    this.label('反射', 312, 151, C.muted, 'center', 19);
    c.save(); c.globalAlpha = .12 + angle * .23; c.strokeStyle = C.orange; c.lineWidth = 1.7; c.setLineDash([5, 8]);
    c.stroke(this.targetPath('cone', 785, 180, .42)); c.restore();
    if (angle > .15) this.label('可能的虚影', 782, 190, C.orange, 'center', 18);
    this.label('玻璃后的点 ≠ 玻璃本身可见', 478, 407, C.ink, 'center', 22);
  }
  wet(t) {
    const amount = this.value / 100, ground = 267, c = this.ctx;
    this.sensor(110, 174);
    this.line(190, ground, 842, ground, C.line, 2);
    c.fillStyle = '#92bab321'; c.beginPath(); c.ellipse(485, ground + 3, 153, 15, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 110; i++) {
      const x = 191 + i * 5.8;
      if (x > 333 && x < 639 && hash(i + 900) < amount * .87) continue;
      this.dot(x, ground + noise(i) * 2, 2.5);
    }
    this.target('cone', 745, ground, .86, 9, .8);
    this.beam(152, 170, 461, ground, t, C.orange, .85);
    this.beam(461, ground, 734, 164, t, C.tealLight, .65, .2);
    if (amount > .05) {
      c.save(); c.translate(0, ground * 2); c.scale(1, -1);
      this.target('cone', 745, ground, .8, 12, amount * .7, C.orange, false); c.restore();
      this.label('可能的地面下方伪点', 660, 408, C.orange, 'center', 20);
    }
    this.label('真实地面', 299, 239, C.ink, 'center', 20);
    this.label(amount > .05 ? '湿区／积水 → 地面缺点' : '干燥地面', 453, 321, amount > .05 ? C.orange : C.muted, 'center', 20);
    this.label('真实目标', 745, 127, C.ink, 'center', 20);
  }
  fog(t) {
    const amount = this.value / 100, c = this.ctx;
    this.sensor(110, 235);
    const gradient = c.createRadialGradient(461, 205, 30, 461, 205, 203);
    gradient.addColorStop(0, 'rgba(183,201,190,' + (amount * .65) + ')'); gradient.addColorStop(1, 'rgba(183,201,190,0)');
    c.fillStyle = gradient; c.fillRect(224, 48, 460, 311);
    this.target('cone', 757, 320, 1.23, 8 + amount * 16, 1 - amount * .65);
    this.beam(151, 231, 750, 245, t, C.orange, 1 - amount * .68);
    for (let i = 0; i < amount * 75; i++) {
      const px = 276 + hash(i + 3) * 330 + Math.sin(t * .45 + i) * 7;
      const py = 85 + hash(i + 87) * 243;
      this.dot(px, py, 2 + hash(i) * 2, i % 3 ? C.orange : C.tealLight, .4 + amount * .25);
    }
    this.label('雾滴散射', 457, 59, C.ink, 'center', 22);
    this.label('后方目标', 756, 59, C.ink, 'center', 22);
    this.label(amount > .05 ? '空气噪点增加' : '清晰光路', 460, 376, amount > .05 ? C.orange : C.muted, 'center', 21);
    this.label(amount > .05 ? '目标回波变弱' : '完整目标轮廓', 745, 376, C.muted, 'center', 21);
  }
  dirt(t) {
    const amount = this.value / 100, c = this.ctx;
    this.sensor(135, 208);
    c.save(); c.strokeStyle = C.line; c.lineWidth = 1.5; c.beginPath(); c.arc(144, 327, 58, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#c8ddd3'; c.fillRect(152, 282, 7, 87);
    for (let i = 0; i < amount * 17; i++) {
      const y = 289 + hash(i + 4) * 70;
      c.fillStyle = '#8c7257'; c.beginPath(); c.ellipse(154, y, 7 + hash(i) * 9, 4 + hash(i + 70) * 8, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    this.line(175, 225, 174, 275, C.line, 1.4, true);
    this.line(726, 65, 726, 324, C.line, 3);
    for (let i = 0; i < 185; i++) {
      const y = 72 + hash(i + 73) * 246;
      if (y > 140 && y < 265 && hash(i + 38) < amount * .94) continue;
      this.dot(723 + noise(i) * 3, y, 2.6);
    }
    this.beam(178, 202, 724, 102, t, C.orange, .75);
    this.beam(178, 202, 724, 202, t, C.orange, 1 - amount * .92, .2);
    this.beam(178, 202, 724, 305, t, C.orange, .6, .4);
    for (let i = 0; i < amount * 25; i++) this.dot(199 + hash(i) * 78, 168 + hash(i + 5) * 71, 2.7, C.orange, .7);
    this.label('窗口放大示意', 144, 415, C.ink, 'center', 20);
    this.label('目标表面', 726, 39, C.ink, 'center', 22);
    this.label(amount > .05 ? '污染方向对应缺点区' : '窗口清洁 → 回波恢复', 608, 382, amount > .05 ? C.orange : C.muted, 'center', 21);
  }
}
