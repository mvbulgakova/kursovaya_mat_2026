// Раздел «Секущие»: прямая через рациональную точку кривой и вторая точка пересечения.
import { Q, CONICS, secondPoint, slopes, approx, tripleFromPoint } from '../core.js';
import { View, canvasPoint } from '../ui/plot2d.js';
import { css, esc, fmt, finder } from '../util.js';

const SCHOOL_NOTES = [
  'Окружность радиуса 1. Каждая точка с дробными координатами даёт прямоугольный треугольник с целыми сторонами.',
  'Окружность x² + y² = 2 и точка (1; 1) на ней.',
  'Гипербола. Некоторые точки на ней целые — это решения уравнения x² − 2y² = 1.',
  'Эллипс: его точки дают треугольники с углом 120° или 60° и целыми сторонами.',
  'На этой окружности нет ни одной точки с дробными координатами, поэтому провести прямую не через что.',
];

export default {
  id: 'secants',
  title: () => 'Секущие',
  html: L => `
  <div class="layout">
    <canvas class="plot" data-id="cv" width="800" height="800" aria-label="Чертёж кривой и секущей"></canvas>
    <div>
      <div class="panel">
        <label>Кривая</label>
        <select data-id="conic">${CONICS.map((c, i) => `<option value="${i}">${c.name}</option>`).join('')}</select>
        <p class="note" data-id="note"></p>
        <div data-id="ctl">
          <label>${L.uni ? 'Угловой коэффициент секущей t = p / q' : 'Наклон прямой t = p / q (на сколько поднимается прямая при шаге 1 вправо)'}</label>
          <div class="row">
            <input type="number" data-id="tp" value="1" step="1" aria-label="p">
            <span>/</span>
            <input type="number" data-id="tq" value="2" min="1" step="1" aria-label="q">
            <button class="act" data-id="vert" title="Вертикальная прямая">t = ∞</button>
          </div>
          <p class="note">Или коснитесь чертежа: прямая пройдёт через это место с ближайшим «простым» наклоном.</p>
          <div class="row" style="margin-top:8px">
            <button class="act main" data-id="play">▶ Запустить</button>
            <button class="act" data-id="clear">Очистить</button>
          </div>
          <label>Скорость</label>
          <input type="range" data-id="speed" min="1" max="40" value="8">
        </div>
        <div data-id="searchCtl" class="hidden">
          <div class="row" style="margin-top:8px">
            <label style="margin:0">Искать X² + Y² = 3Z² при Z ≤</label>
            <input type="number" data-id="H" value="300" min="1" max="5000">
            <button class="act" data-id="search">Искать</button>
          </div>
        </div>
      </div>
      <div class="panel" data-id="out"></div>
    </div>
  </div>`,

  mount(root, params, L) {
    const $ = finder(root);
    const v = View($('#cv'), 2.2);
    let C = CONICS[0], T = new Q(1, 2), cloud = [], timer = null, queue = [], searchHTML = null;

    // параметры из адреса: #secants/<кривая>/<p>/<q>
    const [ci, pp, qq] = params.map(Number);
    if (CONICS[ci]) { C = CONICS[ci]; $('#conic').value = ci; }
    if (Number.isInteger(pp) && qq > 0) T = new Q(pp, qq);

    function slopeQueue() {
      const all = slopes(40).filter(t => Math.abs(t.toNumber()) <= 8);
      all.sort((u, w) => (Number(u.d) + Math.abs(Number(u.n))) - (Number(w.d) + Math.abs(Number(w.n))));
      return [null, ...all];
    }
    function draw() {
      v.span = C.P0 ? 2.2 : 2.4;
      v.axes();
      v.curve((x, y) => C.Ff(x, y), css('--curve'));
      for (const p of cloud) v.dot(p.x.toNumber(), p.y.toNumber(), css('--accent2'), 3);
      if (!C.P0) return;
      const [x0, y0] = C.P0.map(q => q.toNumber());
      const P = secondPoint(C, T);
      v.line(x0, y0, T === null ? null : T.toNumber(), css('--accent'));
      v.dot(x0, y0, css('--ink'), 6, 'A');
      if (!P.infinite) v.dot(P.x.toNumber(), P.y.toNumber(), css('--accent'), 7, 'M');
    }
    function report() {
      const out = $('#out');
      if (!C.P0) {
        out.innerHTML = searchHTML ?? '<p class="note">Нажмите «Искать», чтобы перебрать все точки X/Z, Y/Z со знаменателем до заданного.</p>';
        return;
      }
      const P = secondPoint(C, T);
      const tStr = T === null ? '∞ (вертикальная прямая)' : T.toString();
      let h = `<table><tr><th>t</th><td class="mono">${tStr}</td></tr>`;
      if (P.infinite) {
        h += `<tr><th>M</th><td>${L.uni ? 'Прямая параллельна асимптоте: вторая точка пересечения бесконечно удалена.' : 'Прямая параллельна асимптоте и второй раз кривую не пересекает.'}</td></tr></table>`;
      } else {
        h += `<tr><th>x</th><td class="mono">${fmt(P.x)}</td></tr><tr><th>y</th><td class="mono">${fmt(P.y)}</td></tr>`;
        h += `<tr><th>проверка</th><td class="ok">точка лежит на кривой (подстановка даёт ровно 0)</td></tr></table>`;
        if (P.tangent) h += `<p class="note">Прямая касается кривой в точке A: вторая точка совпадает с A.</p>`;
        const tri = !P.tangent && !P.x.isZero() && !P.y.isZero() ? tripleFromPoint(P.x, P.y) : null;
        if (tri && C === CONICS[0]) {
          const [a, b, c] = tri;
          h += `<p>Пифагорова тройка: <b>${a}² + ${b}² = ${c}²</b> <a href="#triangles/right/${c}">к треугольнику →</a></p>`;
        }
        if (tri && C === CONICS[3]) {
          const [a, b, c] = tri;
          const s = P.x.toNumber() * P.y.toNumber() > 0 ? 120 : 60;
          h += `<p>Треугольник со сторонами <b>${a}, ${b}, ${c}</b> и углом ${s}° между первыми двумя.</p>`;
        }
        if (L.uni && T !== null) h += `<p class="note">Вторая точка: x₁ = x₀ − B(t)/A(t), где A(t) = ${C.a}+${C.b}t+${C.c}t² — по лемме о втором корне она рациональна.</p>`;
      }
      if (cloud.length) h += `<p class="note">Найдено точек: ${cloud.length}. Каждая получена одной прямой через A и проверена подстановкой.</p>`;
      out.innerHTML = h;
    }
    function refresh() {
      const i = CONICS.indexOf(C);
      $('#ctl').classList.toggle('hidden', !C.P0);
      $('#searchCtl').classList.toggle('hidden', !!C.P0);
      $('#note').textContent = L.uni ? C.note : SCHOOL_NOTES[i];
      draw(); report();
    }
    function setT(t) { T = t; if (t) { $('#tp').value = String(t.n); $('#tq').value = String(t.d); } refresh(); }
    function stop() { clearTimeout(timer); timer = null; $('#play').textContent = '▶ Запустить'; }
    function tick() {
      if (!queue.length) { stop(); return; }
      const t = queue.shift();
      const P = secondPoint(C, t);
      if (!P.infinite && !P.tangent) cloud.push(P);
      setT(t);
      timer = setTimeout(tick, 1000 / +$('#speed').value);
    }
    $('#play').onclick = () => {
      if (timer) { stop(); return; }
      if (!queue.length) { cloud = []; queue = slopeQueue(); }
      $('#play').textContent = '❚❚ Пауза';
      tick();
    };
    $('#conic').onchange = e => { stop(); queue = []; C = CONICS[+e.target.value]; cloud = []; searchHTML = null; setT(new Q(1, 2)); };
    $('#tp').oninput = $('#tq').oninput = () => {
      const p = parseInt($('#tp').value, 10), q = parseInt($('#tq').value, 10);
      if (Number.isFinite(p) && Number.isFinite(q) && q > 0) { T = new Q(p, q); refresh(); }
    };
    $('#vert').onclick = () => { T = null; refresh(); };
    $('#clear').onclick = () => { stop(); queue = []; cloud = []; refresh(); };
    $('#cv').addEventListener('pointerdown', e => {
      if (!C.P0) return;
      const [x, y] = canvasPoint(v, e);
      const [x0, y0] = C.P0.map(q => q.toNumber());
      if (Math.abs(x - x0) < 1e-3) { setT(null); return; }
      setT(approx((y - y0) / (x - x0), 30));
    });
    $('#search').onclick = () => {
      const H = Math.min(5000, Math.max(1, parseInt($('#H').value, 10) || 1));
      let tried = 0; const found = [];
      for (let Z = 1; Z <= H; Z++) for (let X = 0; X * X <= 3 * Z * Z; X++) {
        const r = 3 * Z * Z - X * X, Y = Math.round(Math.sqrt(r)); tried++;
        if (Y * Y === r) found.push([X, Y, Z]);
      }
      searchHTML = `<p>Перебрано ${tried.toLocaleString('ru')} пар (X, Z) с 1 ≤ Z ≤ ${H}.</p>` +
        (found.length ? `<p>Найдено: ${esc(JSON.stringify(found.slice(0, 5)))}</p>`
          : `<p class="ok">Ни одного решения X² + Y² = 3Z²: точек с дробными координатами нет.</p>
             <p class="note">Перебор только иллюстрирует теорему. Доказательство — через остатки от деления на 3: квадрат даёт остаток 0 или 1, поэтому X² + Y² делится на 3, только когда X и Y делятся на 3, а тогда и Z делится на 3 — противоречие с несократимостью.</p>`);
      report();
    };
    refresh();
    return () => stop();
  },
};
