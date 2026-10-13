export const palette = {
  cream: '#eee5c4', ivory: '#fff3d9', mint: '#89cbbb', mintLight: '#b3e2ce',
  coral: '#ed7765', charcoal: '#394d49', stone: '#a9b7a0', dirt: '#93664f', soil: '#c4ae80'
};
export const random = (n) => { const x = Math.sin(n * 127.1 + 91.7) * 43758.5453; return x - Math.floor(x); };
const jitter = (n) => random(n) + random(n + 97) + random(n + 197) - 1.5;
export const copy = {
  range: { code: 'RANGE / 01', heading: '距离渐远，<br>轮廓渐稀。', clean: '近距参考，<br>完整轮廓。', target: '正面目标', note: '按距离改变采样', result: '目标轮廓', condition: '距离示意 · 采样密度', cloudCenter: [1.25, .95, .3], cloudWidth: 3.4, cloudSpan: 2.9 },
  precision: { code: 'PRECISION / 02', heading: '一面平墙，<br>一层厚度。', clean: '近距参考，<br>观察离散。', target: '平墙与墙角', note: '物理表面保持平整', result: '法向离散', condition: '平面厚度 · 通道分层', cloudYaw: .85, cloudWidth: 5.4, cloudCenter: [1.1, 1, -.6] },
  ghost: { code: 'GHOST / 03', heading: '反光之外，<br>还有假点。', clean: '真实轮廓，<br>基准回波。', target: '强反光牌', note: '空旷处没有实物', result: '真实与异位', condition: '轮廓膨胀 · 异位鬼影', cloudWidth: 4.6 },
  tail: { code: 'TAIL / 04', heading: '两个表面，<br>一段拖尾。', clean: '两个表面，<br>清晰分离。', target: '前景与背景', note: '中间本应没有点', result: '空隙中的点', condition: '边缘混合 · 桥接拖尾', cloudYaw: 1.25, cloudWidth: 4.8 },
  glass: { code: 'GLASS / 05', heading: '看穿玻璃，<br>不等于看见。', clean: '正对玻璃，<br>检查透射。', target: '玻璃与后方', note: '透射与反射分别看', result: '三个空间区域', condition: '表面缺点 · 后方与虚影', cloudYaw: .72, cloudWidth: 4.7, sceneYaw: .2 },
  wet: { code: 'WET / 06', heading: '地面湿了，<br>回波变了。', clean: '干燥地面，<br>基准回波。', target: '湿区与锥桶', note: '比较相近入射角', result: '地上与地下', condition: '地面缺点 · 地下伪点', cloudCenter: [.6, .1, .3], cloudSpan: 4.2, cloudWidth: 5.8, cloudYaw: .8 },
  fog: { code: 'FOG / 07', heading: '雾里有点，<br>目标变稀。', clean: '清晰空气，<br>完整目标。', target: '后方固定车辆', note: '空气与目标一起看', result: '水雾中的回波', condition: '空气噪点 · 目标衰减', cloudCenter: [.5, 1, .15], cloudWidth: 4.7 },
  dirt: { code: 'WINDOW / 08', heading: '一层脏污，<br>一片缺失。', clean: '清洁窗口，<br>完整回波。', target: '目标墙', note: '表面保持完整', result: '目标回波', condition: '局部稀疏 · 近场噪点', cloudWidth: 4.6 },
  hero: { code: 'LIDAR / FIELD NOTES', heading: '', target: '', note: '', result: '', condition: '' }
};

export const baselineValue = (kind) => kind === 'range' ? 5 : kind === 'precision' ? 10 : 0;

// Pure deterministic transforms keep each qualitative phenomenon distinct.
// Scene coordinates are illustrative; the slider is not a calibrated simulation.
export function returnsFor(kind, samples, value) {
  const a = value / 100, valid = [], anomalous = [];
  const addNoise = (count, make) => { for (let i = 0; i < count; i++) anomalous.push(make(i)); };
  for (let i = 0; i < samples.length; i++) {
    const { p, tag } = samples[i], q = [...p];
    if (kind === 'range') {
      if (tag === 'target' && random(i + 770) < (value - 5) / 75 * .84) continue;
    } else if (kind === 'precision') {
      const sigma = .018 + (value - 10) / 70 * .23;
      if (tag === 'wall') q[0] += jitter(i + 121) * sigma + (i % 4 === 0 ? sigma * .5 : 0);
      if (tag === 'corner') q[2] += jitter(i + 121) * sigma;
    } else if (kind === 'glass') {
      if (tag === 'glass') {
        if (random(i + 888) < .88 + value / 800) continue;
        const angle = value * Math.PI / 180, x = q[0] - .45, z = q[2] + .35;
        q[0] = .45 + x * Math.cos(angle) + z * Math.sin(angle);
        q[2] = -.35 - x * Math.sin(angle) + z * Math.cos(angle);
      }
      if (tag === 'target' && value > 10 && random(i + 280) < value / 95) {
        anomalous.push([q[0] + .15, q[1], q[2] + 1.55]);
      }
    } else if (kind === 'wet') {
      const inPuddle = q[0] > -.2 && q[0] < 1.55 && q[2] > -.15 && q[2] < 1.35;
      if (tag === 'ground' && inPuddle && random(i + 721) < a * .9) continue;
      if (tag === 'target' && random(i + 77) < a * .8) anomalous.push([q[0], -q[1] - .04, q[2]]);
    } else if (kind === 'fog') {
      if (tag === 'target' && random(i + 341) < a * .74) continue;
    } else if (kind === 'dirt') {
      const inSector = q[2] > -.95 && q[2] < .18 && q[1] > .4 && q[1] < 2.12;
      if (tag === 'wall' && inSector && random(i + 704) < a * .98) continue;
    }
    valid.push(q);
  }
  if (kind === 'ghost') {
    addNoise(a * 110, (i) => [1.94 + jitter(i) * .035, 1.72 + (random(i + 70) - .5) * 1.34, -.4 + (random(i + 71) - .5) * 1.95]);
    addNoise(a * 125, (i) => [2.20 + jitter(i + 77) * .10, .28 + random(i + 80) * .63, 1.1 + random(i + 79) * .7]);
  }
  if (kind === 'tail') addNoise(a * 145, (i) => {
    const t = .05 + random(i + 76) * .9;
    return [.37 + t * 1.69, .65 + random(i + 15) * .7, .25 - t * .35 + jitter(i + 72) * .07];
  });
  if (kind === 'fog') addNoise(a * 190, (i) => [-1.3 + random(i + 76) * 3, .22 + random(i + 78) * 1.65, -.95 + random(i + 77) * 2.15]);
  if (kind === 'dirt') addNoise(a * 42, (i) => [-1.3 + random(i + 84) * .5, .75 + random(i + 85) * .65, .35 + random(i + 87) * .55]);
  return { valid, anomalous };
}
