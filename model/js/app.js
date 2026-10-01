// Оболочка приложения: уровень «Школа / Вуз», навигация по #адресу, service worker.
import { store } from './util.js';
import home from './sections/home.js';
import secants from './sections/secants.js';
import triangles from './sections/triangles.js';
import trainer from './sections/trainer.js';
import cubics from './sections/cubics.js';

// разделы, которые грузятся только при первом открытии
const lazy = {
  sphere: () => import('./sections/sphere.js'),
};
const NAV = [
  ['home', 'Главная'], ['secants', 'Секущие'], ['triangles', 'Целые треугольники'],
  ['trainer', 'Тренажёр'], ['sphere', '3D-сфера'], ['cubics', 'Кубики', true],
];
const loaded = { home, secants, triangles, trainer, cubics };
// служебные адреса тренажёра ведут в тот же раздел
const ALIAS = { check: 'trainer', results: 'trainer' };

const view = document.getElementById('view');
const nav = document.getElementById('nav');
let level = store.get('level', 'school');
let cleanup = null, token = 0;

const L = () => ({ uni: level === 'uni', school: level !== 'uni', name: level });

function renderNav(current) {
  nav.innerHTML = NAV.filter(([, , uniOnly]) => !uniOnly || level === 'uni')
    .map(([id, title]) => `<a href="#${id}" ${id === current ? 'aria-current="page"' : ''}>${title}</a>`).join('');
}
function renderLevel() {
  document.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', b.dataset.level === level));
}

async function route() {
  const my = ++token;
  const parts = decodeURIComponent(location.hash.slice(1)).split('/').filter(Boolean);
  let id = parts[0] || 'home';
  const sectionId = ALIAS[id] || id;
  let section = loaded[sectionId];
  if (!section && lazy[sectionId]) {
    view.innerHTML = '<p class="note">Загрузка…</p>';
    section = loaded[sectionId] = (await lazy[sectionId]()).default;
    if (my !== token) return;
  }
  if (!section || (section.uniOnly && level !== 'uni')) { section = home; id = 'home'; }
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  renderNav(section.id);
  document.title = (section.id === 'home' ? '' : section.title(L()) + ' — ') + 'Рациональные точки';
  view.innerHTML = section.html(L(), parts.slice(1), id);
  cleanup = section.mount(view, parts.slice(1), L(), id) || null;
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => {
  level = b.dataset.level; store.set('level', level); renderLevel(); route();
});
window.addEventListener('hashchange', route);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', route);
renderLevel();
route();

// работа без интернета
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker:', e));
}
