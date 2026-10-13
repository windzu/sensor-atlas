import { AtlasScene } from './animation.js';

const canvases = [...document.querySelectorAll('canvas[data-scene]')];
let LowPolyScene;
try { ({ LowPolyScene } = await import('./lowpoly-scene.js')); }
catch (error) { console.warn('3D scenes unavailable; using the geometric view.', error); }
const scenes = canvases.map((canvas) => {
  if (LowPolyScene) {
    try { return new LowPolyScene(canvas); }
    catch (error) { console.warn('WebGL unavailable; using the geometric view.', error); }
  }
  return new AtlasScene(canvas);
});
const sceneFor = (canvas) => scenes.find((scene) => scene.canvas === canvas);
const fmt = (value, unit) => unit === 'level' ? (value === 0 ? '无影响参考' : value <= 30 ? '轻微' : value <= 60 ? '中等' : '明显') : value + ' ' + unit;

for (const panel of document.querySelectorAll('.topic-panel')) {
  const scene = sceneFor(panel.querySelector('canvas[data-scene]'));
  const slider = panel.querySelector('input[type=range]'), output = panel.querySelector('output');
  const play = panel.querySelector('.play-button'), baseline = panel.querySelector('.baseline-button');
  const original = Number(slider.value);
  const group = (selector, attribute, value) => {
    for (const button of panel.querySelectorAll(selector)) {
      const active = button.getAttribute(attribute) === value;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    }
  };
  function refreshPlay() {
    play.innerHTML = scene.paused ? '播放 <span aria-hidden="true">▶</span>' : '暂停 <span aria-hidden="true">Ⅱ</span>';
    play.setAttribute('aria-pressed', String(scene.paused));
    play.setAttribute('aria-label', scene.paused ? '播放演示' : '暂停演示');
  }
  function refreshBaseline() {
    baseline.setAttribute('aria-pressed', String(scene.baseline));
    baseline.textContent = scene.baseline ? '返回当前条件' : '查看基准';
    baseline.setAttribute('aria-label', scene.baseline ? '返回当前条件' : '查看' + baseline.dataset.baselineLabel);
    slider.disabled = scene.baseline;
    const value = scene.baseline ? Number(slider.min) : Number(slider.value);
    output.textContent = (scene.baseline ? '基准 · ' : '') + fmt(value, slider.dataset.unit);
    slider.setAttribute('aria-valuetext', output.textContent);
  }
  function refreshValue() { scene.update(slider.value); refreshBaseline(); }
  scene.onPause = refreshPlay;
  scene.onPhase = (phase) => group('[data-phase]', 'data-phase', String(phase));
  scene.onView = (view) => group('[data-view]', 'data-view', view);
  slider.addEventListener('input', refreshValue);
  play.addEventListener('click', () => { scene.paused = !scene.paused; refreshPlay(); scene.draw(); });
  baseline.addEventListener('click', () => { scene.setBaseline(!scene.baseline); refreshBaseline(); });
  for (const button of panel.querySelectorAll('[data-target]')) button.addEventListener('click', () => {
    scene.targetKind = button.dataset.target; group('[data-target]', 'data-target', button.dataset.target); scene.rebuild(); scene.draw();
  });
  for (const button of panel.querySelectorAll('[data-mode]')) button.addEventListener('click', () => {
    scene.mode = button.dataset.mode; group('[data-mode]', 'data-mode', scene.mode); scene.draw();
  });
  for (const button of panel.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
    scene.setView(button.dataset.view); scene.onView(scene.view);
  });
  for (const button of panel.querySelectorAll('[data-phase]')) button.addEventListener('click', () => scene.setPhase(Number(button.dataset.phase)));
  panel.querySelector('.reset-button').addEventListener('click', () => {
    slider.value = original; scene.paused = scene.motionPreference.matches; scene.reset();
    group('[data-target]', 'data-target', 'person'); group('[data-mode]', 'data-mode', 'compare');
    scene.onView('orbit'); scene.onPhase(scene.phase); refreshValue(); refreshPlay();
  });
  refreshPlay(); refreshValue(); scene.onPhase(scene.phase);
}

const hero = document.querySelector('.hero-canvas');
if (hero) {
  const scene = sceneFor(hero), pause = document.querySelector('.hero-pause');
  function refresh() {
    pause.textContent = scene.paused ? '▶' : 'Ⅱ';
    pause.setAttribute('aria-pressed', String(scene.paused));
    pause.setAttribute('aria-label', scene.paused ? '播放首页动画' : '暂停首页动画');
  }
  scene.onPause = refresh;
  pause.addEventListener('click', () => { scene.paused = !scene.paused; refresh(); scene.draw(); });
  refresh();
}

const tabs = [...document.querySelectorAll('[data-topic]')];
if (tabs.length) {
  const panels = [...document.querySelectorAll('.topic-panel')];
  const select = document.querySelector('#topic-select');
  const previous = document.querySelector('.pagination-prev'), next = document.querySelector('.pagination-next');
  let active = 0;
  function activate(id, updateUrl = true, focus = false) {
    let index = panels.findIndex((panel) => panel.id === id);
    if (index < 0) index = 0;
    active = index;
    panels.forEach((panel, i) => { panel.classList.toggle('is-active', i === index); panel.hidden = i !== index; });
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
    select.value = panels[index].id;
    previous.disabled = index === 0; next.disabled = index === panels.length - 1;
    document.querySelector('.pagination-count').textContent = String(index + 1).padStart(2, '0') + ' / 08';
    document.title = panels[index].querySelector('h2').textContent + ' · LiDAR 评测｜Sensor Atlas';
    if (updateUrl) history.replaceState(null, '', '#' + panels[index].id);
    if (focus) {
      panels[index].focus({ preventScroll: true });
      panels[index].scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
    sceneFor(panels[index].querySelector('canvas[data-scene]')).draw();
  }
  activate(location.hash.slice(1), false);
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', (event) => { event.preventDefault(); activate(tab.dataset.topic); });
    tab.addEventListener('keydown', (event) => {
      let indexToGo;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') indexToGo = (index + 1) % tabs.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') indexToGo = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') indexToGo = 0;
      else if (event.key === 'End') indexToGo = tabs.length - 1;
      if (indexToGo !== undefined) { event.preventDefault(); activate(tabs[indexToGo].dataset.topic); tabs[indexToGo].focus(); }
    });
  }
  select.addEventListener('change', () => activate(select.value));
  previous.addEventListener('click', () => activate(panels[Math.max(0, active - 1)].id, true, true));
  next.addEventListener('click', () => activate(panels[Math.min(panels.length - 1, active + 1)].id, true, true));
  window.addEventListener('hashchange', () => activate(location.hash.slice(1), false));
}

document.body.classList.add('js-ready');
// Reposition a deep link after progressive enhancement hides the other topics.
const initialTopic = document.querySelector('.topic-panel.is-active');
if (initialTopic && location.hash === '#' + initialTopic.id) {
  requestAnimationFrame(() => initialTopic.scrollIntoView({ behavior: 'instant', block: 'start' }));
}
document.addEventListener('visibilitychange', () => scenes.forEach((scene) => { scene.lastFrame = performance.now(); }));
function tick(now) {
  if (!document.hidden) scenes.forEach((scene) => scene.tick(now));
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
