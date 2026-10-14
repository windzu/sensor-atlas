import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cameraMeta } from '../web/assets/camera-data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkOnly = process.argv.includes('--check');
const meta = [
  { id: 'range', subtitle: '从完整轮廓，到临界距离', control: '示意距离', min: 5, max: 80, step: 5, value: 35, unit: 'm', insight: '对比连续帧中的轮廓，而不是只数几个孤立点。', kind: '基础性能', visual: '距离增大 → 目标采样变稀', baseline: '近距离参考', labels: ['正面目标', '目标点云'], focus: '看轮廓连续性' },
  { id: 'precision', subtitle: '沿平面法向，观察点云厚度', control: '示意距离', min: 10, max: 80, step: 10, value: 40, unit: 'm', insight: '墙面厚度反映离散程度；整体测距偏差需要独立真值。', kind: '基础性能', visual: '理想平面 → 法向残差与分层', baseline: '近距离参考', labels: ['平整墙面与墙角', '平面法向离散'], focus: '看厚度与分层' },
  { id: 'ghost', subtitle: '把真实反光物，与异位回波分开', control: '强反影响示意', min: 0, max: 100, step: 10, value: 70, unit: 'level', insight: '轮廓膨胀与异位鬼影分别记录，先确认异常位置没有实物。', kind: '异常场景', visual: '强回波 → 膨胀与异位假点', baseline: '无异常参考', labels: ['反光牌与空旷背景', '膨胀 / 异位鬼影'], focus: '找真实轮廓外的点' },
  { id: 'tail', subtitle: '前景到背景之间，本应是空的', control: '混合回波影响', min: 0, max: 100, step: 10, value: 70, unit: 'level', insight: '先检查静止单帧，再判断硬件边缘拖尾。', kind: '异常场景', visual: '边缘混合回波 → 空隙中的桥接点', baseline: '无异常参考', labels: ['前景边缘与背景墙', '空隙中的拖尾'], focus: '检查静止时的空隙' },
  { id: 'glass', subtitle: '后方可见，不代表玻璃可见', control: '观察角度示意', min: 0, max: 60, step: 5, value: 35, unit: '°', insight: '分别检查玻璃表面、后方目标与疑似镜像。', kind: '异常场景', visual: '透射 / 反射 → 表面缺点与虚影', baseline: '正对观察参考', labels: ['玻璃与后方目标', '透射目标 / 疑似镜像'], focus: '分清三个空间区域' },
  { id: 'wet', subtitle: '对照干湿区域，寻找缺点与伪点', control: '湿润／积水影响', min: 0, max: 100, step: 10, value: 70, unit: 'level', insight: '匹配距离与入射角，地面下方伪点需先排除姿态错误。', kind: '异常场景', visual: '地面反射变化 → 缺点与地面下方伪点', baseline: '干燥地面参考', labels: ['湿区与附近目标', '地面缺点 / 反射伪点'], focus: '同时看地上与地下' },
  { id: 'fog', subtitle: '同时观察空气回波与目标损失', control: '水雾程度示意', min: 0, max: 100, step: 10, value: 60, unit: 'level', insight: '空气水雾与窗口水滴分开记录，喷雾程度不换算成能见度。', kind: '异常场景', visual: '水滴散射 → 空气回波与目标衰减', baseline: '清晰空气参考', labels: ['水雾与固定目标', '空气噪点 / 目标变稀'], focus: '目标与空气一起看' },
  { id: 'dirt', subtitle: '污染之前、之后，再看清洁恢复', control: '窗口脏污程度', min: 0, max: 100, step: 10, value: 60, unit: 'level', insight: '点云变化、诊断告警与清洁恢复是三份独立证据。', kind: '异常场景', visual: '光路遮挡 → 局部缺点与近场异常', baseline: '清洁窗口参考', labels: ['污染窗口与目标墙', '缺点方向 / 近场噪点'], focus: '对照清洁前后' }
];
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const source = await readFile(path.join(root, 'content/lidar/hardware-evaluation.md'), 'utf8');
const cameraSource = await readFile(path.join(root, 'content/camera/hardware-evaluation.md'), 'utf8');
function parseTopics(source, metadata, label) {
const sections = [...source.matchAll(/^## (\d+)\. ([^\n]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
if (sections.length !== metadata.length) throw new Error('Expected ' + metadata.length + ' numbered ' + label + ' evaluation sections.');
return sections.map((match, i) => {
  if (Number(match[1]) !== i + 1) throw new Error('Evaluation section order is invalid.');
  const body = match[3];
  const field = (label) => body.match(new RegExp('^\\*\\*' + label + '\\*\\*：(.+)$', 'm'))?.[1];
  const principle = field('基本原理'), objects = field('测试[^*]+'), report = field('报告内容');
  const judgment = field('观察与判定'), review = field('复核要点');
  const stepSection = body.split('**录包回放**：')[1]?.split('**观察与判定**')[0] || '';
  const steps = [...stepSection.matchAll(/^- (.+)$/gm)].map((m) => m[1]);
  if (!principle || !objects || !report || !judgment || !review || !steps.length) throw new Error('Incomplete section: ' + match[2]);
  return { ...metadata[i], number: String(i + 1).padStart(2, '0'), title: match[2], principle, objects, report, judgment, review, steps };
});
}
const topics = parseTopics(source, meta, 'LiDAR');
const cameraTopics = parseTopics(cameraSource, cameraMeta, 'Camera');

// The common sections use a small, escaped Markdown subset: paragraphs and tables.
function commonSection(title, source) {
  const body = source.split('## ' + title + '\n')[1]?.split('\n## ')[0];
  if (!body) throw new Error('Missing common section: ' + title);
  return body.trim().split(/\n\s*\n/).map((block) => {
    if (!block.startsWith('|')) return '<p>' + escape(block.replaceAll('\n', ' ')) + '</p>';
    const rows = block.split('\n').filter((row) => !/^\|\s*[-:]+/.test(row)).map((row) => row.split('|').slice(1, -1).map((cell) => cell.trim()));
    return '<div class="table-scroll" tabindex="0" role="region" aria-label="' + escape(title) + '表格"><table><thead><tr>' + rows[0].map((cell) => '<th scope="col">' + escape(cell) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(1).map((row) => '<tr>' + row.map((cell) => '<td>' + escape(cell) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }).join('\n');
}

function panel(t, sensor) {
  const targets = t.id === 'range' ? '<div class="target-picker" role="group" aria-label="示意目标"><button class="active" type="button" data-target="person" aria-pressed="true">人</button><button type="button" data-target="car" aria-pressed="false">车</button><button type="button" data-target="rider" aria-pressed="false">骑行者</button><button type="button" data-target="cone" aria-pressed="false">锥桶</button></div>' : '';
  return `<article id="${t.id}" class="topic-panel${t.number === '01' ? ' is-active' : ''}" role="tabpanel" aria-labelledby="tab-${t.id}" tabindex="0">
    <div class="topic-title-row"><span class="topic-number mono">${t.number}</span><div><p class="eyebrow">${escape(t.kind)}</p><h2>${escape(t.title)}</h2><p class="topic-subtitle">${escape(t.subtitle)}</p></div><span class="focus-tag">${escape(t.focus)}</span></div>
    <div class="principle-layout">
      ${sensor === 'camera' ? cameraVisual(t) : `<div class="animation-card">
        <div class="animation-topline"><span class="mono">FIG. ${t.number} / LIDAR LAB</span><span class="small-pill">定性原理演示</span></div>
        <div class="scene-toolbar">${targets}<div class="view-picker" role="group" aria-label="显示方式"><button type="button" data-mode="compare" aria-pressed="true">场景 + 点云</button><button type="button" data-mode="cloud" aria-pressed="false">仅点云</button></div><div class="camera-picker" role="group" aria-label="观察视角"><button type="button" data-view="orbit" aria-pressed="true">斜视</button><button type="button" data-view="front" aria-pressed="false">正视</button><button type="button" data-view="side" aria-pressed="false">侧视</button><button type="button" data-view="top" aria-pressed="false">俯视</button></div></div>
        <canvas class="principle-canvas" data-scene="${t.id}" width="1000" height="500" tabindex="0" role="img" aria-label="${escape(t.title + '三维场景与点云对照。' + t.visual + '。可拖动或用方向键调整视角。')}" aria-describedby="caption-${t.id}">${escape(t.principle)}</canvas>
        <div class="scene-caption" id="caption-${t.id}"><span>${escape(t.visual)}</span><span class="scene-gesture">拖动旋转 · 方向键微调</span></div>
        <div class="animation-legend"><span><i class="legend-dot teal"></i>有效表面点</span><span><i class="legend-dot orange"></i>异常点／光路</span><span><i class="legend-dot grey"></i>场景参考</span></div>
        <div class="phase-picker" role="group" aria-label="演示阶段"><button type="button" data-phase="0" aria-pressed="true"><span class="mono">01</span> 发射扫描</button><button type="button" data-phase="1" aria-pressed="false"><span class="mono">02</span> 回波返回</button><button type="button" data-phase="2" aria-pressed="false"><span class="mono">03</span> 点云成像</button></div>
        <div class="animation-controls"><button type="button" class="play-button" aria-pressed="false">暂停 <span aria-hidden="true">Ⅱ</span></button><label for="slider-${t.id}">${escape(t.control)}<output id="value-${t.id}" for="slider-${t.id}">${t.unit === 'level' ? '中等' : t.value + ' ' + t.unit}</output><input id="slider-${t.id}" type="range" min="${t.min}" max="${t.max}" step="${t.step}" value="${t.value}" data-unit="${t.unit}"></label><button type="button" class="baseline-button" aria-pressed="false" data-baseline-label="${escape(t.baseline)}">查看基准</button><button type="button" class="reset-button">重置</button></div>
      </div>`}
      <div class="principle-copy"><div><span class="block-label mono">01 / 理解原理</span><p class="principle-text">${escape(t.principle)}</p></div><div class="insight"><span aria-hidden="true">↳</span><p>${escape(t.insight)}</p></div></div>
    </div>
    <div class="operation-grid"><section class="objects-block"><span class="block-label mono">02 / 选择场景</span><h3>用什么测</h3><p>${escape(t.objects)}</p><div class="review-note"><span>复核要点</span><p>${escape(t.review)}</p></div></section><section class="steps-block"><span class="block-label mono">03 / 录包与回放</span><h3>现场怎么做</h3><ol>${t.steps.map((s) => '<li>' + escape(s) + '</li>').join('')}</ol></section></div>
    <section class="judgment-block"><span class="block-label mono">04 / 观察与判定</span><h3>什么结果才有依据</h3><p>${escape(t.judgment)}</p></section>
    <section class="report-block"><div><span class="block-label mono">05 / 保留证据</span><h3>报告里体现什么</h3></div><p>${escape(t.report)}</p></section>
  </article>`;
}
function cameraVisual(t) {
  const targets = t.id === 'detail' ? '<div class="target-picker" role="group" aria-label="示意目标"><button class="active" type="button" data-target="person" aria-pressed="true">人</button><button type="button" data-target="car" aria-pressed="false">车</button><button type="button" data-target="rider" aria-pressed="false">骑行者</button><button type="button" data-target="cone" aria-pressed="false">锥桶</button></div>' : '';
  return `<div class="animation-card camera-card">
    <div class="animation-topline"><span class="mono">FIG. ${t.number} / CAMERA LAB</span><span class="small-pill">定性${t.id === 'timing' ? '时序' : '成像'}演示</span></div>${targets ? '\n    <div class="scene-toolbar">' + targets + '</div>' : ''}
    <canvas class="camera-canvas" data-camera="${t.id}" width="1000" height="395" role="img" aria-label="${escape(t.title + '基准与当前条件对照。' + t.visual)}" aria-describedby="caption-${t.id}">${escape(t.principle)}</canvas>
    <div class="scene-caption" id="caption-${t.id}"><span>${escape(t.visual)}</span><span>示意图 · 非实测图像</span></div>
    <div class="animation-controls"><button type="button" class="play-button" aria-pressed="false">暂停 <span aria-hidden="true">Ⅱ</span></button><label for="slider-${t.id}">${escape(t.control)}<output for="slider-${t.id}">中等</output><input id="slider-${t.id}" type="range" min="0" max="100" step="10" value="${t.value}" data-unit="level"></label><button type="button" class="baseline-button" aria-pressed="false" data-baseline-label="${escape(t.baseline)}">查看基准</button><button type="button" class="reset-button">重置</button></div>
  </div>`;
}
function guideReplacements(source, topics, sensor) {
const sources = [...(source.split('## 参考资料')[1] || '').matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)];
return {
  TOPIC_NAV: topics.map((t) => '<a id="tab-' + t.id + '" href="#' + t.id + '" data-topic="' + t.id + '" role="tab" aria-controls="' + t.id + '" aria-selected="' + (t.number === '01') + '" tabindex="' + (t.number === '01' ? '0' : '-1') + '"><span class="mono">' + t.number + '</span><span>' + escape(t.title) + '</span><span class="topic-nav-arrow" aria-hidden="true">↗</span></a>').join(''),
  TOPIC_OPTIONS: topics.map((t) => '<option value="' + t.id + '">' + t.number + ' · ' + escape(t.title) + '</option>').join(''),
  TOPIC_PANELS: topics.map((t) => panel(t, sensor)).join('\n'),
  PREPARATION: commonSection('评测前准备', source),
  CONVENTIONS: commonSection('判定与复核约定', source),
  REPORT_TEMPLATE: commonSection('报告模板', source),
  SOURCE_LINKS: sources.map((s) => '<li><a href="' + escape(s[2]) + '" target="_blank" rel="noopener noreferrer">' + escape(s[1]) + ' ↗</a></li>').join('')
};
}
const replacements = guideReplacements(source, topics, 'lidar');
const cameraReplacements = guideReplacements(cameraSource, cameraTopics, 'camera');
const outputs = new Map();
async function walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative);
    else {
      let data = await readFile(path.join(dir, entry.name));
      if (entry.name.endsWith('.html')) {
        let html = data.toString();
        const guide = entry.name === 'camera.html' ? cameraReplacements : replacements;
        for (const [key, value] of Object.entries(guide)) html = html.replaceAll('{{' + key + '}}', value);
        if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unfilled template: ' + relative);
        data = Buffer.from(html);
      }
      outputs.set(relative, data);
    }
  }
}
await walk(path.join(root, 'web'));
// Vendor the pinned Three.js runtime so the static site works without a CDN.
for (const name of ['three.module.js', 'three.core.js']) {
  outputs.set('assets/vendor/' + name, await readFile(path.join(root, 'node_modules/three/build', name)));
}
outputs.set('assets/vendor/THREE-LICENSE.txt', await readFile(path.join(root, 'node_modules/three/LICENSE')));
outputs.set('downloads/lidar-hardware-evaluation.md', Buffer.from(source));
outputs.set('downloads/camera-hardware-evaluation.md', Buffer.from(cameraSource));
outputs.set('assets/topics.json', Buffer.from(JSON.stringify(topics, null, 2) + '\n'));
outputs.set('assets/camera-topics.json', Buffer.from(JSON.stringify(cameraTopics, null, 2) + '\n'));
outputs.set('.nojekyll', Buffer.from(''));
outputs.set('404.html', Buffer.from('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面未找到｜Sensor Atlas</title><style>body{font:18px system-ui;background:#f5f4ee;color:#163a3a;max-width:600px;margin:15vh auto;padding:24px}a{color:#087c85}</style><h1>这张图谱还没有这一页。</h1><p>返回专题目录，继续阅读。</p><a href="./">Sensor Atlas 首页 →</a></html>'));
for (const [relative, data] of outputs) {
  const file = path.join(root, 'docs', relative);
  if (checkOnly) {
    let existing;
    try { existing = await readFile(file); } catch { throw new Error('Generated file missing: ' + relative); }
    if (!existing.equals(data)) throw new Error('Generated file stale: ' + relative + '. Run npm run build.');
  } else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }
}
process.stdout.write((checkOnly ? 'Verified' : 'Built') + ' ' + outputs.size + ' static files, ' + (topics.length + cameraTopics.length) + ' evaluation sections.\n');
