import * as THREE from './vendor/three.module.js';
import { palette as P, random } from './scene-data.js';

function dispose(group) {
  if (!group) return;
  group.removeFromParent();
  group.traverse((node) => {
    node.geometry?.dispose();
    if (node.material?.userData.owned || node.isLineSegments) node.material?.dispose();
  });
}
function sampleMesh(s, mesh, tag = 'target', spacing = .14) {
  mesh.updateWorldMatrix(true, false);
  const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index;
  const n = indices ? indices.count : positions.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
    const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
    const count = Math.max(1, Math.ceil(area / (spacing * spacing * 1.4)));
    for (let j = 0; j < count; j++) {
      const u = Math.sqrt((j + .5) / count), v = random(i * 67 + j + 9);
      s.samples.push({ p: a.clone().multiplyScalar(1 - u).addScaledVector(b, u * (1 - v)).addScaledVector(c, u * v).toArray(), tag });
    }
  }
}
function sampleGroup(s, group, tag = 'target', spacing = .14) {
  group.traverse((node) => { if (node.isMesh && !node.userData.decorative) sampleMesh(s, node, tag, spacing); });
}
function reference(s, mesh, opacity = .30) {
  mesh.updateWorldMatrix(true, false);
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: '#a3b69f', transparent: true, opacity }));
  line.applyMatrix4(mesh.matrixWorld); s.references.add(line); return line;
}
function wallSamples(s, x = 2.06, zMin = -2.22, zMax = 1.44) {
  for (let z = zMin; z <= zMax; z += .13) for (let y = .23; y <= 2.25; y += .13) s.samples.push({ p: [x, y, z], tag: 'wall' });
}
function bar(s, parent, from, to, radius, color) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mesh = s.mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6), color, a.clone().add(b).multiplyScalar(.5).toArray(), parent);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return mesh;
}
function person(s, parent, x, z, rider = false) {
  const group = new THREE.Group(); group.position.set(x, .07, z); parent.add(group);
  const lift = rider ? .43 : 0;
  const torso = s.housing(.44, .57, .30, rider ? '#93c5aa' : '#b0ceb2', group, [0, 1.03 + lift, 0]);
  if (rider) torso.rotation.z = .23;
  s.mesh(new THREE.IcosahedronGeometry(.175, 1), '#dfc39b', [-.025, 1.54 + lift, 0], group);
  const cap = s.mesh(new THREE.SphereGeometry(.183, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), rider ? P.coral : P.charcoal, [-.025, 1.59 + lift, 0], group);
  cap.userData.decorative = true;
  for (const side of [-1, 1]) {
    const zLeg = side * .105;
    bar(s, group, [0, .76 + lift, zLeg], rider ? [-.24, .65, zLeg] : [.03, .18, zLeg], .072, P.charcoal);
    if (rider) bar(s, group, [-.24, .65, zLeg], [.03, .30, zLeg], .062, P.charcoal);
    s.box([.24, .10, .14], P.charcoal, [-.035, rider ? .29 : .10, zLeg], group);
    bar(s, group, [0, 1.21 + lift, side * .22], rider ? [-.43, 1.09, side * .25] : [.03, .76, side * .25], .055, '#dfc39b');
  }
  return group;
}
function car(s, parent, x, z, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, .10, z); group.scale.setScalar(scale); parent.add(group);
  s.housing(1.72, .54, 1.02, '#91c9b2', group, [0, .48, 0]);
  s.housing(.94, .48, .88, '#a5d8bf', group, [.10, .95, 0]);
  s.box([.90, .035, .87], P.ivory, [.10, 1.215, 0], group);
  const windowColor = '#526f64';
  s.box([.012, .28, .70], windowColor, [-.383, .96, 0], group);
  s.box([.012, .28, .70], windowColor, [.581, .96, 0], group);
  for (const side of [-1, 1]) {
    s.box([.69, .28, .016], windowColor, [.10, .96, side * .45], group);
    s.box([.034, .31, .022], '#a5d8bf', [.13, .96, side * .467], group);
    s.box([.10, .045, .027], P.ivory, [.22, .64, side * .518], group);
    s.box([.045, .11, .19], P.coral, [.87, .54, side * .34], group);
    s.box([.035, .11, .22], P.ivory, [-.865, .54, side * .34], group);
    for (const wheelX of [-.54, .54]) {
      const wheel = s.mesh(new THREE.CylinderGeometry(.23, .23, .12, 10), P.charcoal, [wheelX, .27, side * .53], group);
      wheel.rotation.x = Math.PI / 2;
      const rim = s.mesh(new THREE.CylinderGeometry(.108, .108, .125, 8), P.ivory, [wheelX, .27, side * .54], group);
      rim.rotation.x = Math.PI / 2; rim.userData.decorative = true;
    }
  }
  s.box([.06, .075, .87], '#d5d6bb', [.89, .33, 0], group);
  return group;
}
function bicycle(s, parent, x, z) {
  const group = new THREE.Group(); group.position.set(x, .07, z); parent.add(group);
  for (const wheelX of [-.47, .47]) {
    s.mesh(new THREE.TorusGeometry(.34, .035, 4, 12), P.charcoal, [wheelX, .37, 0], group);
    bar(s, group, [wheelX - .3, .37, 0], [wheelX + .3, .37, 0], .012, '#cad5ba');
    bar(s, group, [wheelX, .07, 0], [wheelX, .67, 0], .012, '#cad5ba');
  }
  for (const [a, b] of [
    [[-.47, .37, 0], [-.26, .97, 0]], [[-.26, .97, 0], [.21, .95, 0]],
    [[.21, .95, 0], [.03, .35, 0]], [[.03, .35, 0], [-.26, .97, 0]],
    [[.03, .35, 0], [.47, .37, 0]], [[.47, .37, 0], [.21, .95, 0]]
  ]) bar(s, group, a, b, .027, P.coral);
  s.box([.23, .055, .15], P.charcoal, [.20, 1.02, 0], group);
  bar(s, group, [-.26, .97, -.27], [-.26, .97, .27], .025, P.charcoal);
  return group;
}

export function buildTopic(s, value = s.value) {
  dispose(s.modelRoot); dispose(s.references);
  s.modelRoot = new THREE.Group(); s.scene.add(s.modelRoot);
  s.references = new THREE.Group(); s.cloudScene.add(s.references);
  s.samples = []; s.targetLabelPosition = [1.9, 2.6, -.4];
  const root = s.modelRoot;
  const box = (size, color, position) => s.box(size, color, position, root);
  const wall = () => {
    s.makeWall(); root.add(s.wall, s.wallSweep, s.backSweep);
    wallSamples(s); reference(s, s.wall.children[0]);
  };
  if (s.kind === 'range') {
    const x = 1.10 + value / 100 * 1.16, z = .30;
    let target;
    if (s.targetKind === 'car') target = car(s, root, x, z);
    else if (s.targetKind === 'cone') target = s.makeCone(x, z, 1.45, root);
    else if (s.targetKind === 'rider') {
      target = new THREE.Group(); root.add(target);
      bicycle(s, target, x, z); person(s, target, x + .05, z, true);
    } else target = person(s, root, x, z);
    sampleGroup(s, target, 'target', .095);
    const bounds = new THREE.Box3().setFromObject(target), center = bounds.getCenter(new THREE.Vector3());
    s.targetLabelPosition = [center.x, bounds.max.y + .27, center.z];
    s.targetName = { person: '行人 · 正面', car: '车辆 · 正面', rider: '骑行者 · 正面', cone: '锥桶 · 正面' }[s.targetKind];
    s.scanBounds = [x, .15, bounds.max.y, z - .6, z + .6];
  } else if (s.kind === 'precision') {
    wall();
    const corner = box([2.7, 2.12, .14], '#b9d2b9', [.86, 1.26, -2.32]);
    box([2.85, .10, .19], P.ivory, [.85, 2.35, -2.32]);
    box([.08, 2.28, .19], P.ivory, [-.54, 1.19, -2.32]);
    for (let x = -.45; x <= 2.10; x += .13) for (let y = .23; y <= 2.25; y += .13) s.samples.push({ p: [x, y, -2.24], tag: 'corner' });
    reference(s, corner); s.scanBounds = [2.055, .28, 2.27, -1.65, 1.2];
  } else if (s.kind === 'ghost') {
    box([.32, .09, .42], '#9eb8a2', [1.99, .12, -.4]);
    box([.08, 1.58, .08], '#a7b4a0', [1.99, .85, -.4]);
    box([.17, 1.03, 1.63], P.coral, [1.99, 1.78, -.4]);
    const sign = box([.012, .84, 1.44], '#f6e5af', [1.90, 1.78, -.4]);
    const back = box([.012, .84, 1.44], '#f6e5af', [2.08, 1.78, -.4]);
    for (const sideX of [1.888, 2.092]) {
      const triangle = new THREE.Shape();
      triangle.moveTo(-.24, -.16); triangle.lineTo(.24, -.16); triangle.lineTo(0, .23); triangle.closePath();
      const geo = new THREE.ShapeGeometry(triangle); geo.rotateY(Math.PI / 2);
      const icon = s.mesh(geo, '#bc8c65', [sideX, 1.78, -.4], root, { side: THREE.DoubleSide }); icon.castShadow = false;
    }
    sampleMesh(s, sign, 'sign', .075); reference(s, back);
    s.targetLabelPosition = [1.99, 2.61, -.4]; s.scanBounds = [1.888, 1.35, 2.20, -1.12, .32];
  } else if (s.kind === 'tail') {
    wall();
    const post = s.mesh(new THREE.CylinderGeometry(.12, .14, 1.75, 6), P.coral, [.36, .99, .25], root);
    s.mesh(new THREE.CylinderGeometry(.123, .123, .17, 6), P.ivory, [.36, 1.59, .25], root);
    s.mesh(new THREE.CylinderGeometry(.24, .24, .09, 6), '#b6c6a8', [.36, .12, .25], root);
    sampleMesh(s, post, 'foreground', .085); reference(s, post);
    s.scanBounds = [2.055, .40, 1.9, -.35, .85];
  } else if (s.kind === 'glass') {
    s.glassGroup = new THREE.Group(); s.glassGroup.position.set(.45, .08, -.35); root.add(s.glassGroup);
    const panel = s.box([.035, 2.14, 2.36], P.mintLight, [0, 1.18, 0], s.glassGroup);
    panel.material = s.material('#b8e6d3', { transparent: true, opacity: .24, roughness: .25, side: THREE.DoubleSide, depthWrite: false });
    panel.castShadow = false;
    for (const z of [-1.24, 1.24]) {
      s.box([.075, 2.33, .07], P.ivory, [0, 1.22, z], s.glassGroup);
      s.box([.38, .13, .34], P.stone, [0, .09, z], s.glassGroup);
    }
    for (const y of [.16, 2.32]) s.box([.075, .075, 2.55], P.ivory, [0, y, 0], s.glassGroup);
    for (const z of [-.4, .6]) {
      const glint = s.box([.05, .70, .022], P.ivory, [0, 1.46, z], s.glassGroup);
      glint.rotation.x = .6; glint.material = s.material(P.ivory, { transparent: true, opacity: .45 }); glint.castShadow = false;
    }
    sampleMesh(s, panel, 'glass', .19);
    const target = s.makeCone(2.2, -.45, 1.9, root); sampleGroup(s, target, 'target', .095);
    s.glassReference = reference(s, panel);
    s.targetLabelPosition = [.45, 2.67, -.35]; s.scanBounds = [2.2, .18, 1.09, -1.1, .25];
  } else if (s.kind === 'wet') {
    s.puddle = new THREE.Group(); root.add(s.puddle);
    const shape = new THREE.Shape(), points = [[-.25, -.1], [.3, -.22], [1.4, -.02], [1.63, .47], [1.4, 1.25], [.64, 1.47], [-.2, 1.2], [-.36, .50]];
    points.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z)); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(Math.PI / 2);
    const water = s.mesh(geo, '#86bfb0', [0, .065, 0], s.puddle, { side: THREE.DoubleSide, roughness: .30 }); water.castShadow = false;
    for (let i = 0; i < 4; i++) {
      const glint = s.box([.44 + i * .06, .008, .032], '#c3e5ce', [.23 + i * .24, .073, .40 + i * .20], s.puddle);
      glint.rotation.y = .25; glint.castShadow = false;
    }
    const target = s.makeCone(1.85, .28, 1.9, root); sampleGroup(s, target, 'target', .10);
    for (let x = -.9; x <= 2.4; x += .16) for (let z = -.6; z <= 1.6; z += .16) s.samples.push({ p: [x, .05, z], tag: 'ground' });
    s.targetLabelPosition = [.7, .35, .7]; s.scanBounds = [1.60, .05, .55, -.16, 1.34];
  } else if (s.kind === 'fog') {
    const target = car(s, root, 1.60, .05); sampleGroup(s, target, 'target', .12);
    s.fogGroup = new THREE.Group(); root.add(s.fogGroup);
    for (let i = 0; i < 13; i++) {
      const position = [-.9 + random(i + 27) * 3.3, .42 + random(i + 32) * 1.23, -.85 + random(i + 24) * 1.85];
      const puff = s.mesh(new THREE.DodecahedronGeometry(.36 + random(i + 79) * .35, 1), P.ivory, position, s.fogGroup, { transparent: true, opacity: .14, depthWrite: false });
      puff.scale.set(1.4, .8, 1); puff.castShadow = false; puff.userData.origin = [...position];
    }
    s.targetLabelPosition = [1.6, 1.65, .05]; s.scanBounds = [1.45, .28, 1.10, -.60, .60];
  } else if (s.kind === 'hero') {
    const target = car(s, root, 1.44, -.45, 1.05); sampleGroup(s, target, 'target', .16);
    const walker = person(s, root, .33, 1.55); sampleGroup(s, walker, 'target', .15);
    s.makeCone(2.67, 1.09, 1.1, root);
    s.scanBounds = [1.25, .20, 1.5, -1.1, 1.6];
  }
  const targetPoints = s.samples.filter((point) => point.tag !== 'ground' && point.tag !== 'glass');
  s.rayTargets = Array.from({ length: 13 }, (_, i) => new THREE.Vector3(...targetPoints[Math.floor(i / 13 * targetPoints.length)].p));
}
