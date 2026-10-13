// Deterministic, qualitative geometry. This is not a calibrated LiDAR simulator.
const C = { bg: '#0d1b22', panel: '#10232c', grid: '#25404b', text: '#e0ecee', muted: '#829ba5', cyan: '#6fe1ca', amber: '#f3af70', surface: '#7396a3' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const noise = (n) => hash(n) + hash(n + 701) + hash(n + 1403) - 1.5;
const NAMES = { range: ['正面目标', '目标轮廓'], precision: ['平整墙面与墙角', '法向离散 / 通道分层'], ghost: ['真实反光牌', '轮廓膨胀 / 异位鬼影'], tail: ['前景边缘与背景墙', '空隙中的桥接点'], glass: ['玻璃与后方目标', '玻璃缺点 / 后方可见'], wet: ['湿区与周边目标', '地面缺点 / 地下伪点'], fog: ['水雾与固定目标', '空气回波 / 目标衰减'], dirt: ['污染窗口与目标墙', '局部缺点 / 近场噪点'] };

class Geometry {
  constructor() { this.surfaces = []; this.points = []; this.labels = []; this.rays = []; this.sensor = [0, -3.05, 1.02]; }
  point(p, color = C.cyan, opacity = .8, tag = '') { this.points.push({ p, color, opacity, tag }); }
  plane(corners, color = C.surface, spacing = .16, sample = true, tag = '') {
    this.surfaces.push({ corners, color });
    if (!sample) return;
    const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    const u = Math.max(1, Math.ceil(distance(corners[0], corners[1]) / spacing));
    const v = Math.max(1, Math.ceil(distance(corners[0], corners[3]) / spacing));
    for (let j = 0; j <= v; j++) for (let i = 0; i <= u; i++) {
      this.point(lerp(lerp(corners[0], corners[1], i / u), lerp(corners[3], corners[2], i / u), j / v), C.cyan, .78, tag);
    }
  }
  box(center, size, color = C.surface, spacing = .16, sample = true, tag = '') {
    const [x, y, z] = center, [w, d, h] = size;
    const a = [x-w/2,y-d/2,z-h/2], b = [x+w/2,y-d/2,z-h/2], c = [x+w/2,y+d/2,z-h/2], e = [x-w/2,y+d/2,z-h/2];
    const top = (p) => [p[0], p[1], p[2]+h];
    this.plane([a,b,top(b),top(a)],color,spacing,sample,tag);
    this.plane([b,c,top(c),top(b)],color,spacing,sample,tag);
    this.plane([e,a,top(a),top(e)],color,spacing,sample,tag);
    this.plane([top(a),top(b),top(c),top(e)],color,spacing,sample,tag);
  }
  cylinder(center, radius, height, color = C.surface, spacing = .12, sample = true, tag = '', topRadius = radius) {
    const n = 24, rows = Math.max(1, Math.ceil(height / spacing));
    const p = (a, z) => [center[0]+Math.cos(a)*(radius+(topRadius-radius)*z/height),center[1]+Math.sin(a)*(radius+(topRadius-radius)*z/height),center[2]+z];
    for (let i = 0; i < n; i++) {
      const a = i/n*Math.PI*2, b = (i+1)/n*Math.PI*2;
      this.surfaces.push({ corners:[p(a,0),p(b,0),p(b,height),p(a,height)], color });
    }
    if (sample) for (let j = 0; j <= rows; j++) {
      const z = j/rows*height, r = radius+(topRadius-radius)*j/rows;
      const count = Math.max(4, Math.ceil(Math.PI*2*Math.max(r,.02)/spacing));
      for (let i=0;i<count;i++) this.point(p(i/count*Math.PI*2,z),C.cyan,.85,tag);
    }
  }
  sphere(center, radius, spacing = .1, tag = 'target') {
    const p = (lat, lon) => [center[0]+radius*Math.cos(lat)*Math.cos(lon),center[1]+radius*Math.cos(lat)*Math.sin(lon),center[2]+radius*Math.sin(lat)];
    for(let j=0;j<10;j++) for(let i=0;i<16;i++) {
      const a=-Math.PI/2+j*Math.PI/10,b=a+Math.PI/10,u=i*Math.PI/8,v=u+Math.PI/8;
      this.surfaces.push({corners:[p(a,u),p(a,v),p(b,v),p(b,u)],color:'#9dbbc2'});
    }
    const rows=Math.max(3,Math.ceil(radius*Math.PI/spacing));
    for(let j=0;j<=rows;j++) {
      const lat=-Math.PI/2+j*Math.PI/rows,cols=Math.max(4,Math.ceil(Math.PI*2*radius*Math.cos(lat)/spacing));
      for(let i=0;i<cols;i++) this.point(p(lat,i/cols*Math.PI*2),C.cyan,.88,tag);
    }
  }
  target(kind, x, y, spacing = .1) {
    if (kind === 'car') {
      this.box([x,y,.52],[1.8,.85,.75],'#6b8796',spacing,true,'target');
      this.box([x,y+.06,1.08],[1.35,.65,.55],'#8ab5bf',spacing,true,'target');
      for (const s of [-1,1]) this.box([x+s*.73,y,.2],[.22,.95,.3],'#3f5664',spacing,true,'target');
    } else if (kind === 'cone') {
      this.box([x,y,.035],[.65,.65,.07],'#b78666',spacing,true,'target');
      this.cylinder([x,y,.07],.25,.72,'#a98870',spacing,true,'target',.035);
      this.cylinder([x,y,.4],.145,.13,'#c9d9d8',spacing,false,'target',.105);
    } else {
      const seated = kind === 'rider', lower = seated ? .4 : 0;
      this.sphere([x,y,1.57+lower*.2],.145,spacing);
      this.cylinder([x,y,.66+lower*.4],.18,.66,'#698f9b',spacing,true,'target',.225);
      for (const s of [-1,1]) {
        this.cylinder([x+s*.105,y,lower*.6],.075,.68-lower*.2,'#718e98',spacing,true,'target');
        this.cylinder([x+s*.28,y,.68+lower*.4],.055,.55,'#8ba8ae',spacing,true,'target');
      }
      if (seated) {
        this.box([x,y-.15,.66],[.08,.65,.55],'#7e9d9f',spacing,true,'target');
        this.box([x,y-.4,1.02],[.95,.07,.07],'#a3babc',spacing,true,'target');
        for (let i=0;i<60;i++) {
          const a=i/60*Math.PI*2;
          this.point([x+Math.cos(a)*.035,y-.48+Math.cos(a)*.36,.38+Math.sin(a)*.36],C.cyan,.9,'target');
        }
      }
    }
  }
  floor() {
    for(let x=-3.2;x<=3.2;x+=.24) for(let y=-2.4;y<=3.3;y+=.24) this.point([x,y,0],C.cyan,.24,'ground');
  }
}

export class AtlasScene {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.kind = canvas.dataset.scene;
    this.value = Number(canvas.closest('article')?.querySelector('input[type=range]')?.value || 35);
    this.targetKind = 'person'; this.mode = 'compare'; this.view = 'orbit'; this.baseline = false;
    this.yaw = -.48; this.pitch = .48; this.time = 0; this.lastFrame = performance.now(); this.lastDraw = 0;
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.paused = this.motionPreference.matches; this.visible = false; this.phase = 0;
    if(this.paused) { this.time=8.999; this.phase=2; }
    this.motionPreference.addEventListener('change', (event) => {
      if (event.matches) this.setPhase(2);
    });
    this.resizeObserver = new ResizeObserver(() => this.draw()); this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if(this.visible) { this.lastFrame = performance.now(); this.draw(); }
    }); this.intersectionObserver.observe(canvas);
    if(this.kind !== 'hero') this.bindCamera();
    this.rebuild();
  }
  bindCamera() {
    let drag = null;
    this.canvas.addEventListener('pointerdown',(event) => {
      // Preserve vertical scrolling on touchscreens; camera presets remain available.
      if(event.pointerType === 'touch') return;
      drag = [event.clientX,event.clientY]; this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove',(event) => {
      if(!drag) return;
      this.yaw += (event.clientX-drag[0])*.008;
      this.pitch = clamp(this.pitch+(event.clientY-drag[1])*.005,.08,1.48);
      this.view = 'custom'; drag = [event.clientX,event.clientY]; this.onView?.('custom'); this.draw();
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture']) this.canvas.addEventListener(name,() => { drag = null; });
    this.canvas.addEventListener('keydown',(event) => {
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault(); this.view = 'custom';
      this.yaw += event.key === 'ArrowLeft' ? -.08 : event.key === 'ArrowRight' ? .08 : 0;
      this.pitch = clamp(this.pitch+(event.key === 'ArrowUp' ? .06 : event.key === 'ArrowDown' ? -.06 : 0),.08,1.48);
      this.onView?.('custom'); this.draw();
    });
  }
  setView(view) {
    this.view=view;
    [this.yaw,this.pitch] = view === 'top' ? [0,1.48] : view === 'front' ? [0,.08] : view === 'side' ? [Math.PI/2,.12] : [-.48,.48];
    this.draw();
  }
  update(value) { this.value=Number(value); this.rebuild(); this.draw(); }
  setBaseline(active) { this.baseline=active; this.rebuild(); this.draw(); }
  setPhase(phase) { this.time=phase===2?8.999:phase*3+1.3; this.phase=phase; this.paused=true; this.onPhase?.(phase); this.onPause?.(); this.draw(); }
  reset() { this.time=this.paused?8.999:0; this.phase=this.paused?2:0; this.mode='compare'; this.baseline=false; this.targetKind='person'; this.setView('orbit'); this.rebuild(); this.draw(); }
  tick(now) {
    const dt=Math.min((now-this.lastFrame)/1000,.05); this.lastFrame=now;
    if(!this.visible || this.canvas.closest('[hidden]') || this.paused) return;
    this.time+=dt;
    const phase=Math.floor((this.time%9)/3);
    if(phase!==this.phase) { this.phase=phase; this.onPhase?.(phase); }
    if(now-this.lastDraw>=1000/30) { this.draw(); this.lastDraw=now; }
  }
  rebuild() {
    const g = new Geometry();
    const value=this.baseline ? (this.kind==='range'?5:this.kind==='precision'?10:0) : this.value;
    const a=value/100;
    if(this.kind==='hero') {
      g.box([-2.3,1.2,1.15],[1.35,1.3,2.3],'#698e9b',.14);
      g.target('car',1.4,1.8,.14); g.target('cone',-.4,.4,.09); g.target('person',2.6,-.6,.09); g.floor();
      g.rays=[[-2.3,.55,1.8],[1.4,1.35,1],[2.6,-.72,1.1],[-.4,.3,.5]];
    } else if(this.kind==='range') {
      g.target(this.targetKind,0,1.5,.055+value*.005); g.floor();
      g.rays=[[0,1.2,1.5],[-.2,1.2,.8],[.17,1.2,.25]];
      g.labels.push({p:[0,1.5,2],text:{person:'人 · 正面',car:'车 · 正面',rider:'骑行者 · 正面',cone:'锥桶 · 正面'}[this.targetKind]});
    } else if(this.kind==='precision') {
      g.plane([[-2,2,0],[2,2,0],[2,2,2.5],[-2,2,2.5]],'#779da8',.13,true,'wall');
      g.plane([[2,2,0],[2,.4,0],[2,.4,2.5],[2,2,2.5]],'#628d9b',.13,true,'corner');
      g.points.forEach((p,i) => { if(p.tag==='wall') p.p[1]+=noise(i)*(.025+value*.003)+(i%4===0 ? value*.002 : 0); else p.p[0]+=noise(i)*(.025+value*.003); });
      g.floor(); g.rays=[[-1,2,1.7],[0,2,1],[1,2,.4]];
      g.labels.push({p:[-1.1,2,2.55],text:'平面法向厚度'});
    } else if(this.kind==='ghost') {
      g.box([-.5,1.5,1.7],[1.55,.07,.9],'#adab88',.1,true,'sign');
      g.box([-.5,1.5,.65],[.09,.09,1.3],'#647f8a',.13); g.floor();
      for(let i=0;i<a*230;i++) {
        const x=-.5+(hash(i)-.5)*2.25, z=1.7+(hash(i+80)-.5)*1.4;
        if(Math.abs(x+.5)>.78 || Math.abs(z-1.7)>.45) g.point([x,1.48+noise(i)*.08,z],C.amber,.86,'anomaly');
        g.point([1.35+hash(i+70)*1.25,2.1+noise(i+21)*.16,.3+hash(i+400)*.85],C.amber,.82,'anomaly');
      }
      g.rays=[[-.5,1.46,1.7]]; g.labels.push({p:[-.5,1.5,2.3],text:'强反物'});
      if(a>.01) g.labels.push({p:[2,2.1,1.35],text:'异位鬼影',cloudOnly:true,color:C.amber});
    } else if(this.kind==='tail') {
      g.box([-.6,-.1,1],[.16,.18,2],'#809ca6',.08);
      g.plane([[-2,2.5,0],[2,2.5,0],[2,2.5,2.5],[-2,2.5,2.5]],'#628996',.16); g.floor();
      const edge=[-.51,-.18,1.04], far=[-.04,2.5,1.05];
      for(let i=0;i<a*170;i++) {
        const p=lerp(edge,far,.06+hash(i)*.88); p[0]+=noise(i+6)*.07; p[2]+=noise(i+66)*.13;
        g.point(p,C.amber,.86,'anomaly');
      }
      g.rays=[edge,far]; g.labels.push({p:[-.6,-.1,2.15],text:'前景边缘'},{p:[1.2,2.5,2.55],text:'背景'});
      if(a>.01) g.labels.push({p:[-.25,1.2,1.35],text:'桥接点',cloudOnly:true,color:C.amber});
    } else if(this.kind==='glass') {
      const rotation=value*Math.PI/180, point=(x,z)=>[x*Math.cos(rotation),.35+x*Math.sin(rotation),z];
      g.plane([point(-1.45,0),point(1.45,0),point(1.45,2.5),point(-1.45,2.5)],'#70b7c1',.25,false);
      for(const x of [-1.45,1.45]) g.box(point(x,1.25),[.055,.055,2.5],'#9eb2b9',.16);
      for(let i=0;i<25;i++) if(hash(i)>.35+value/110) g.point(point((hash(i+3)-.5)*2.8,hash(i+21)*2.5),C.cyan,.7,'glass');
      g.target('cone',.55,2.3,.12); g.floor();
      if(value>10) {
        const clone=g.points.filter((p)=>p.tag==='target');
        clone.forEach((p,i)=>{ if(hash(i+770)<value/100) g.point([p.p[0]-1.9,p.p[1]+.3,p.p[2]],C.amber,.74,'anomaly'); });
        g.labels.push({p:[-1.4,2.6,1.25],text:'可能的虚影',cloudOnly:true,color:C.amber});
      }
      g.rays=[[.55,2.05,.6]]; g.reflection=[[0,.35,1],[-2,-.75,1.5]];
      g.labels.push({p:point(-.7,2.6),text:'玻璃'},{p:[.8,2.3,1.35],text:'后方目标'});
    } else if(this.kind==='wet') {
      g.floor(); g.target('cone',1.7,2.1,.1);
      g.plane([[-1.5,-.1,.015],[1.4,-.1,.015],[1.4,2.3,.015],[-1.5,2.3,.015]],a>.01?'#497f96':'#465c67',.2,false);
      g.points=g.points.filter((p,i)=>!(p.tag==='ground'&&p.p[0]>-1.5&&p.p[0]<1.4&&p.p[1]>-.1&&p.p[1]<2.3&&hash(i)<a*.9));
      const clone=g.points.filter((p)=>p.tag==='target');
      clone.forEach((p,i)=>{ if(hash(i+79)<a*.8) g.point([p.p[0],p.p[1],-p.p[2]-.05],C.amber,.75,'anomaly'); });
      g.rays=[[-.2,.5,0]]; g.reflection=[[-.2,.5,0],[1.7,2.1,.6]];
      g.labels.push({p:[-.65,.6,.12],text:a>.01?'湿区 / 积水':'干燥地面'});
      if(a>.01) g.labels.push({p:[1.7,2.1,-1],text:'地面下方伪点',cloudOnly:true,color:C.amber});
    } else if(this.kind==='fog') {
      g.target('car',.5,2.2,.14); g.floor();
      g.points=g.points.filter((p,i)=>p.tag!=='target'||hash(i+231)>a*.73);
      for(let i=0;i<a*310;i++) g.point([(hash(i)-.5)*4,-1.6+hash(i+330)*3.3,.25+hash(i+70)*2.2],C.amber,.4+hash(i+180)*.45,'fog');
      g.rays=[[.5,1.75,1],[.5,1.75,.5]]; g.labels.push({p:[.5,2.2,1.8],text:'后方固定目标'});
    } else if(this.kind==='dirt') {
      g.plane([[-2.6,2,0],[2.6,2,0],[2.6,2,2.4],[-2.6,2,2.4]],'#6f94a2',.13,true,'wall'); g.floor();
      g.points=g.points.filter((p,i)=>!(p.tag==='wall'&&p.p[0]>-.6&&p.p[0]<1.6&&hash(i+290)<a*.96));
      for(let i=0;i<a*105;i++) g.point([-.25+hash(i)*.7,-2.5+hash(i+41)*.8,.7+hash(i+720)*.7],C.amber,.83,'anomaly');
      g.rays=[[-1.8,2,1.2],[.5,2,1.2],[2,2,1.2]];
      g.labels.push({p:[.5,2,2.55],text:a>.01?'污染方向对应缺点':'完整目标表面',cloudOnly:true,color:a>.01?C.amber:C.text});
    }
    this.model=g;
  }
  project(p, box) {
    const [x,y,z]=p, co=Math.cos(this.yaw), si=Math.sin(this.yaw);
    const side=x*co-y*si, depth=x*si+y*co;
    const scale=Math.min(box.w/7.7,box.h/4.75);
    return {x:box.x+box.w*.5+side*scale,y:box.y+box.h*.61-depth*Math.sin(this.pitch)*scale-(z-.5)*Math.cos(this.pitch)*scale,depth:depth*Math.cos(this.pitch)+(z-.5)*Math.sin(this.pitch)};
  }
  line(a,b,color,width=1,alpha=1,dashed=false) {
    const c=this.ctx; c.globalAlpha=alpha; c.strokeStyle=color; c.lineWidth=width; c.setLineDash(dashed?[5,6]:[]);
    c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke(); c.setLineDash([]); c.globalAlpha=1;
  }
  text(text,x,y,size=17,color=C.muted,align='left') {
    const c=this.ctx; c.font=`${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`; c.fillStyle=color; c.textAlign=align; c.globalAlpha=1; c.fillText(text,x,y);
  }
  paintSurface(surface,box,alpha=.2) {
    const c=this.ctx, points=surface.corners.map(p=>this.project(p,box));
    c.beginPath(); points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)); c.closePath();
    c.fillStyle=surface.color; c.globalAlpha=alpha; c.fill(); c.strokeStyle=surface.color; c.lineWidth=1.15; c.globalAlpha=.58; c.stroke(); c.globalAlpha=1;
  }
  paintGrid(box) {
    for(let n=-4;n<=4;n++) {
      this.line(this.project([n,-3.8,0],box),this.project([n,4,0],box),C.grid,1,.7);
      this.line(this.project([-4,n,0],box),this.project([4,n,0],box),C.grid,1,.7);
    }
    const center=this.project([0,0,0],box);
    this.line(center,this.project([1.4,0,0],box),'#6d8a94',1.2,.7);
    this.line(center,this.project([0,1.4,0],box),'#6d8a94',1.2,.7);
    this.line(center,this.project([0,0,1.4],box),'#6d8a94',1.2,.7);
  }
  paintSensor(box) {
    const g=new Geometry(); g.box([0,-3.05,.78],[.45,.4,.42],'#c7d6d9',.1,false);
    for(const s of g.surfaces) this.paintSurface(s,box,.6);
    const p=this.project(this.model.sensor,box),c=this.ctx;
    c.fillStyle=C.cyan; c.beginPath(); c.ellipse(p.x,p.y,10,3,0,0,Math.PI*2); c.fill();
    this.text('LiDAR',p.x,p.y+33,this.mobile?25:16,C.muted,'center');
  }
  paintBeam(box) {
    const cycle=(this.time%9)/3, phase=Math.floor(cycle), progress=cycle-phase;
    const start=this.project(this.model.sensor,box), c=this.ctx;
    const rays=this.model.rays;
    rays.forEach((p,i)=>{
      const end=this.project(p,box);
      const faded=this.kind==='dirt'&&i===1&&!this.baseline?1-this.value/110:1;
      this.line(start,end,C.amber,1,.18*faded);
      if(phase<2) {
        const t=(progress+i*.14)%1, ratio=phase===0?t:1-t;
        const head={x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio};
        const tail=phase===0?Math.max(0,ratio-.12):Math.min(1,ratio+.12);
        this.line({x:start.x+(end.x-start.x)*tail,y:start.y+(end.y-start.y)*tail},head,phase===0?C.amber:C.cyan,2.6,.9*faded);
        c.fillStyle=phase===0?C.amber:C.cyan; c.beginPath(); c.arc(head.x,head.y,3,0,Math.PI*2); c.fill();
      }
    });
    if(this.model.reflection && !this.baseline) this.line(...this.model.reflection.map(p=>this.project(p,box)),C.amber,1.5,.65,true);
    if(phase===2) {
      c.strokeStyle=C.cyan; c.globalAlpha=.5*(1-progress); c.lineWidth=1;
      c.beginPath(); c.ellipse(start.x,start.y,8+progress*26,3+progress*9,0,0,Math.PI*2); c.stroke(); c.globalAlpha=1;
    }
  }
  paintPoints(box,isScene=false) {
    const c=this.ctx, phase=Math.floor((this.time%9)/3), sweep=(this.time%3)/3;
    const points=this.model.points.map((point,i)=>({...point,i,screen:this.project(point.p,box)})).sort((a,b)=>b.screen.depth-a.screen.depth);
    for(const point of points) {
      if(isScene && point.tag!=='fog') continue;
      const {x,y}=point.screen;
      const band=Math.abs((x-box.x)/box.w-sweep)<.06;
      const revealed=(x-box.x)/box.w<=sweep;
      c.globalAlpha=point.opacity*(isScene?.45:phase===2?(revealed?.95:.18):phase===1?.57:.42);
      c.fillStyle=point.color;
      const radius=point.tag==='ground'?1.45:point.tag==='fog'?1.8:band&&!isScene?2.65:1.85;
      c.beginPath(); c.arc(x,y,radius,0,Math.PI*2); c.fill();
      if(band&&phase===2&&!isScene&&point.tag!=='ground') {
        c.globalAlpha=.075; c.beginPath(); c.arc(x,y,6,0,Math.PI*2); c.fill();
      }
    }
    c.globalAlpha=1;
  }
  paintLabels(box,isScene) {
    const occupied=[];
    for(const label of this.model.labels) {
      if(isScene&&label.cloudOnly) continue;
      const p=this.project(label.p,box);
      const size=this.mobile?26:16;
      const c=this.ctx; c.font=`${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
      const width=c.measureText(label.text).width+14;
      const x=clamp(p.x,box.x+width/2+12,box.x+box.w-width/2-12);
      let y=clamp(p.y-17,box.y+55,box.y+box.h-45);
      for(let i=0;i<5&&occupied.some(r=>Math.abs(r.x-x)<(r.width+width)/2&&Math.abs(r.y-y)<size+9);i++) y=clamp(y-size-12,box.y+55,box.y+box.h-45);
      occupied.push({x,y,width});
      if(Math.abs(y-(p.y-17))>8) this.line(p,{x,y:y+9},label.color||C.surface,1,.5);
      c.fillStyle=C.bg; c.globalAlpha=.86; c.fillRect(x-width/2,y-size,width,size+8);c.globalAlpha=1;
      this.text(label.text,x,y,size,label.color||C.text,'center');
    }
    if(isScene&&this.kind==='dirt') {
      const p=this.project(this.model.sensor,box);
      this.text(this.baseline?'清洁窗口':'污染窗口',p.x-30,p.y-38,this.mobile?26:16,this.baseline?C.cyan:C.amber,'right');
      if(!this.baseline) {
        const c=this.ctx; c.fillStyle='#c39570';
        for(let i=0;i<this.value/10;i++) { c.beginPath();c.arc(p.x-7+hash(i)*14,p.y-3+hash(i+24)*6,2.2,0,Math.PI*2);c.fill(); }
      }
    }
    if(isScene&&this.kind==='fog'&&!this.baseline) this.text('空气中的水滴',box.x+box.w*.38,box.y+box.h*.45,this.mobile?26:16,C.amber,'center');
  }
  paintPanel(box,isScene,hero=false) {
    const c=this.ctx; c.save(); c.beginPath(); c.rect(box.x,box.y,box.w,box.h); c.clip();
    this.paintGrid(box);
    if(isScene) {
      this.model.surfaces.map(s=>({s,depth:this.project(s.corners.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/4),[0,0,0]),box).depth})).sort((a,b)=>b.depth-a.depth).forEach(({s})=>this.paintSurface(s,box,this.kind==='glass'?.16:.48));
      this.paintPoints(box,true); this.paintBeam(box);
    } else this.paintPoints(box);
    this.paintSensor(box); this.paintLabels(box,isScene);
    if(!hero) {
      this.text(isScene?'A / 真实场景':'B / 点云结果',box.x+18,box.y+26,this.mobile?28:19,C.text);
      const descriptions=NAMES[this.kind]||['场景几何','表面点云'];
      this.text(descriptions[isScene?0:1],box.x+18,box.y+box.h-15,this.mobile?24:15,C.muted);
    }
    c.restore();
  }
  draw() {
    const rect=this.canvas.getBoundingClientRect(); if(!rect.width||!this.ctx) return;
    this.mobile=rect.width<560; const hero=this.kind==='hero';
    this.width=1000; this.height=hero?650:this.mobile&&this.mode==='compare'?850:500;
    this.canvas.style.aspectRatio=`${this.width} / ${this.height}`;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.round(rect.width*dpr),h=Math.round(rect.width*this.height/this.width*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h) { this.canvas.width=w;this.canvas.height=h; }
    const c=this.ctx; c.setTransform(w/this.width,0,0,h/this.height,0,0);
    c.fillStyle=C.bg; c.fillRect(0,0,this.width,this.height);
    const gradient=c.createRadialGradient(500,220,20,500,220,600); gradient.addColorStop(0,'#14313a');gradient.addColorStop(1,C.bg);c.fillStyle=gradient;c.fillRect(0,0,this.width,this.height);
    if(hero) {
      const box={x:25,y:30,w:950,h:575};
      this.paintGrid(box);
      this.model.surfaces.forEach(s=>this.paintSurface(s,box,.12));
      this.paintPoints(box); this.paintBeam(box);this.paintSensor(box);
      this.text('SURFACE → RETURN → GEOMETRY',32,33,17,C.muted);
      this.text('三维点云 · 定性演示',960,615,19,C.cyan,'right');
      return;
    }
    this.text(this.baseline?'REFERENCE / 基准条件':'EXPERIMENT / 当前条件',28,30,this.mobile?26:17,this.baseline?C.cyan:C.muted);
    const display=this.baseline?(this.kind==='range'?'5 m':this.kind==='precision'?'10 m':'基准示意'):(this.kind==='range'||this.kind==='precision'?this.value+' m':this.kind==='glass'?this.value+'°':'条件示意');
    this.text(display,972,30,this.mobile?26:17,C.text,'right');
    if(this.mode==='cloud') this.paintPanel({x:20,y:47,w:960,h:430},false);
    else if(this.mobile) {
      this.paintPanel({x:20,y:52,w:960,h:376},true);
      this.line({x:35,y:440},{x:965,y:440},C.grid,1);
      this.paintPanel({x:20,y:452,w:960,h:376},false);
    } else {
      this.paintPanel({x:20,y:52,w:470,h:424},true);
      this.line({x:500,y:58},{x:500,y:465},C.grid,1);
      this.paintPanel({x:510,y:52,w:470,h:424},false);
    }
  }
}
