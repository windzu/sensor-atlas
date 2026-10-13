import { AtlasScene } from './animation.js';

const scenes = [...document.querySelectorAll('canvas[data-scene]')].map((canvas) => new AtlasScene(canvas));
const sceneFor = (canvas) => scenes.find((scene) => scene.canvas === canvas);
const fmt = (value, unit) => unit === 'level' ? (value === 0 ? '无影响示意' : value <= 30 ? '轻微' : value <= 60 ? '中等' : '明显') : value + ' ' + unit;

for (const panel of document.querySelectorAll('.topic-panel')) {
  const canvas = panel.querySelector('canvas'), scene = sceneFor(canvas);
  const slider = panel.querySelector('input[type=range]'), output = panel.querySelector('output');
  const play = panel.querySelector('.play-button');
  const original = Number(slider.value);
  function refreshPlay() {
    play.innerHTML = scene.paused ? '播放动画 <span aria-hidden="true">▶</span>' : '暂停动画 <span aria-hidden="true">Ⅱ</span>';
    play.setAttribute('aria-pressed', String(scene.paused));
  }
  function refreshValue() { output.textContent = fmt(Number(slider.value), slider.dataset.unit); scene.update(slider.value); }
  slider.addEventListener('input', refreshValue);
  play.addEventListener('click', () => { scene.paused = !scene.paused; refreshPlay(); scene.draw(); });
  panel.querySelector('.reset-button').addEventListener('click', () => {
    slider.value = original;
    const first = panel.querySelector('[data-target]');
    if (first) first.click();
    scene.time = 0; refreshValue();
  });
  for (const target of panel.querySelectorAll('[data-target]')) {
    target.addEventListener('click', () => {
      scene.targetKind = target.dataset.target;
      for (const button of panel.querySelectorAll('[data-target]')) {
        const active = button === target;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      }
      scene.draw();
    });
  }
  refreshPlay(); refreshValue();
}

const hero = document.querySelector('.hero-canvas');
if (hero) {
  const scene = sceneFor(hero), pause = document.querySelector('.hero-pause');
  function refresh() {
    pause.textContent = scene.paused ? '▶' : 'Ⅱ';
    pause.setAttribute('aria-pressed', String(scene.paused));
    pause.setAttribute('aria-label', scene.paused ? '播放首页动画' : '暂停首页动画');
  }
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
    panels.forEach((panel, i) => {
      panel.classList.toggle('is-active', i === index);
      panel.hidden = i !== index;
    });
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    select.value = panels[index].id;
    previous.disabled = index === 0; next.disabled = index === panels.length - 1;
    document.querySelector('.pagination-count').textContent = String(index + 1).padStart(2, '0') + ' / 08';
    document.title = panels[index].querySelector('h2').textContent + ' · LiDAR 评测｜Sensor Atlas';
    if (updateUrl) history.replaceState(null, '', '#' + panels[index].id);
    if (focus) { panels[index].focus({ preventScroll: true }); panels[index].scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
    sceneFor(panels[index].querySelector('canvas')).draw();
  }
  document.body.classList.add('js-ready');
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

document.addEventListener('visibilitychange', () => scenes.forEach((scene) => { scene.lastFrame = performance.now(); }));
function tick(now) {
  if (!document.hidden) scenes.forEach((scene) => scene.tick(now));
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
