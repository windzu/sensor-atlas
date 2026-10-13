import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkOnly = process.argv.includes('--check');
const meta = [
  { id: 'range', subtitle: '目标能看多远', control: '示意距离', min: 5, max: 80, step: 5, value: 35, unit: 'm', insight: '距离增大，轮廓会变稀。实测以还能分辨出目标轮廓的距离为准。', kind: '基础性能' },
  { id: 'precision', subtitle: '从侧面看平面厚度', control: '示意距离', min: 10, max: 80, step: 10, value: 40, unit: 'm', insight: '比较墙面厚度与墙角形态，同时看点云是否变稀。本项以不存在整体偏移为前提。', kind: '基础性能' },
  { id: 'ghost', subtitle: '强回波之外的假目标', control: '强反影响', min: 0, max: 100, step: 10, value: 70, unit: 'level', insight: '重点检查真实物体之外的成团假点，以及轮廓向外膨胀的现象。', kind: '异常场景' },
  { id: 'tail', subtitle: '边缘与背景之间的拉丝', control: '混合回波影响', min: 0, max: 100, step: 10, value: 70, unit: 'level', insight: '前景和背景之间本应为空。静止片段仍有粘连点，才有助于判断边缘拖尾。', kind: '异常场景' },
  { id: 'glass', subtitle: '看见后方，未必看见玻璃', control: '观察角度示意', min: 0, max: 60, step: 5, value: 35, unit: '°', insight: '门框和玻璃后方的点，不算玻璃本身被检测到。', kind: '异常场景' },
  { id: 'wet', subtitle: '水膜改变反射方向', control: '湿润／积水影响', min: 0, max: 100, step: 10, value: 70, unit: 'level', insight: '对照同种路面的干湿区域，观察地面缺点与不对应实物的异常点。', kind: '异常场景' },
  { id: 'fog', subtitle: '目标变弱，空气产生回波', control: '水雾程度示意', min: 0, max: 100, step: 10, value: 60, unit: 'level', insight: '同时看真实目标损失了多少点、空气中增加了哪些点，并记录窗口是否被淋湿。', kind: '异常场景' },
  { id: 'dirt', subtitle: '窗口污染影响整条光路', control: '窗口脏污程度', min: 0, max: 100, step: 10, value: 60, unit: 'level', insight: '观察污染位置对应的缺点区域，并在清洁后检查是否恢复。', kind: '异常场景' }
];
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const source = await readFile(path.join(root, 'content/lidar/hardware-evaluation.md'), 'utf8');
const sections = [...source.matchAll(/^## (\d+)\. ([^\n]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
if (sections.length !== 8) throw new Error('Expected exactly eight numbered LiDAR evaluation sections.');
const topics = sections.map((match, i) => {
  if (Number(match[1]) !== i + 1) throw new Error('Evaluation section order is invalid.');
  const body = match[3];
  const principle = body.match(/^\*\*基本原理\*\*：(.+)$/m)?.[1];
  const objects = body.match(/^\*\*测试[^*]+\*\*：(.+)$/m)?.[1];
  const report = body.match(/^\*\*报告内容\*\*：(.+)$/m)?.[1];
  const steps = [...body.matchAll(/^- (.+)$/gm)].map((m) => m[1]);
  if (!principle || !objects || !report || !steps.length) throw new Error('Incomplete section: ' + match[2]);
  return { ...meta[i], number: String(i + 1).padStart(2, '0'), title: match[2], principle, objects, report, steps };
});
const panel = (t) => {
  const controls = '<div class="animation-controls"><button type="button" class="play-button" aria-pressed="false">暂停动画 <span aria-hidden="true">Ⅱ</span></button><label for="slider-' + t.id + '">' + escape(t.control) + '<output id="value-' + t.id + '" for="slider-' + t.id + '">' + (t.unit === 'level' ? '中等' : t.value + ' ' + t.unit) + '</output><input id="slider-' + t.id + '" type="range" min="' + t.min + '" max="' + t.max + '" step="' + t.step + '" value="' + t.value + '" data-unit="' + t.unit + '"></label><button type="button" class="reset-button">重置</button></div>';
  const targets = t.id === 'range' ? '<div class="target-picker" role="group" aria-label="示意目标"><button class="active" type="button" data-target="person" aria-pressed="true">人</button><button type="button" data-target="car" aria-pressed="false">车</button><button type="button" data-target="rider" aria-pressed="false">骑行者</button><button type="button" data-target="cone" aria-pressed="false">锥桶</button></div>' : '';
  return '<article id="' + t.id + '" class="topic-panel' + (t.number === '01' ? ' is-active' : '') + '" role="tabpanel" aria-labelledby="tab-' + t.id + '" tabindex="0"><div class="topic-title-row"><span class="topic-number mono">' + t.number + '</span><div><p class="eyebrow">' + escape(t.kind) + '</p><h2>' + escape(t.title) + '</h2><p class="topic-subtitle">' + escape(t.subtitle) + '</p></div></div><div class="principle-layout"><div class="animation-card"><div class="animation-topline"><span class="mono">FIG. ' + t.number + ' / PRINCIPLE</span><span class="small-pill">原理示意</span></div>' + targets + '<canvas class="principle-canvas" data-scene="' + t.id + '" width="900" height="440" role="img" aria-label="' + escape(t.title + '原理动画。' + t.insight) + '">' + escape(t.principle) + '</canvas><div class="animation-legend"><span><i class="legend-dot teal"></i>真实表面／有效回波</span><span><i class="legend-dot orange"></i>光束／异常回波</span></div>' + controls + '</div><div class="principle-copy"><span class="block-label mono">01 / 理解原理</span><p class="principle-text">' + escape(t.principle) + '</p><div class="insight"><span aria-hidden="true">↳</span><p>' + escape(t.insight) + '</p></div></div></div><div class="operation-grid"><section class="objects-block"><span class="block-label mono">02 / 选择场景</span><h3>用什么测</h3><p>' + escape(t.objects) + '</p></section><section class="steps-block"><span class="block-label mono">03 / 录包与回放</span><h3>现场怎么做</h3><ol>' + t.steps.map((s) => '<li>' + escape(s) + '</li>').join('') + '</ol></section></div><section class="report-block"><div><span class="block-label mono">04 / 保留证据</span><h3>报告里体现什么</h3></div><p>' + escape(t.report) + '</p></section></article>';
};
const sources = [...source.split('## 参考资料')[1].matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)];
const replacements = {
  TOPIC_NAV: topics.map((t) => '<a id="tab-' + t.id + '" href="#' + t.id + '" data-topic="' + t.id + '" role="tab" aria-controls="' + t.id + '" aria-selected="' + (t.number === '01') + '" tabindex="' + (t.number === '01' ? '0' : '-1') + '"><span class="mono">' + t.number + '</span><span>' + escape(t.title) + '</span><span class="topic-nav-arrow" aria-hidden="true">↗</span></a>').join(''),
  TOPIC_OPTIONS: topics.map((t) => '<option value="' + t.id + '">' + t.number + ' · ' + escape(t.title) + '</option>').join(''),
  TOPIC_PANELS: topics.map(panel).join('\n'),
  SOURCE_LINKS: sources.map((s) => '<li><a href="' + escape(s[2]) + '" target="_blank" rel="noopener noreferrer">' + escape(s[1]) + ' ↗</a></li>').join('')
};
const outputs = new Map();
async function walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative);
    else {
      let data = await readFile(path.join(dir, entry.name));
      if (entry.name.endsWith('.html')) {
        let html = data.toString();
        for (const [key, value] of Object.entries(replacements)) html = html.replaceAll('{{' + key + '}}', value);
        if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unfilled template: ' + relative);
        data = Buffer.from(html);
      }
      outputs.set(relative, data);
    }
  }
}
await walk(path.join(root, 'web'));
outputs.set('downloads/lidar-hardware-evaluation.md', Buffer.from(source));
outputs.set('assets/topics.json', Buffer.from(JSON.stringify(topics, null, 2) + '\n'));
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
process.stdout.write((checkOnly ? 'Verified' : 'Built') + ' ' + outputs.size + ' static files, 8 evaluation sections.\n');
