// Раздел «Целые треугольники»: прямоугольные, с углом 120° и 60°, героновы.
import { Q, CONICS, triangles, heronTriangles } from '../core.js';
import { View } from '../ui/plot2d.js';
import { triangleSVG } from '../ui/triangle-svg.js';
import { css, finder } from '../util.js';

const KIND_ANGLE = { right: null, deg120: '120°', deg60: '60°' };
const ELLIPSE60 = { Ff: (x, y) => x * x - x * y + y * y - 1, P0: [new Q(1), new Q(0)] };
const fracStr = (n, d) => new Q(n, d).toString();

export default {
  id: 'triangles',
  title: () => 'Целые треугольники',
  html: L => `
  <div class="layout">
    <div>
      <div data-id="fig"></div>
      <canvas class="plot" data-id="cv" width="800" height="800" aria-label="Точка на кривой, соответствующая треугольнику"></canvas>
    </div>
    <div>
      <div class="panel">
        <label>Какие треугольники</label>
        <select data-id="kind">
          <option value="right">прямоугольные (пифагоровы тройки)</option>
          <option value="deg120">с углом 120°</option>
          <option value="deg60">с углом 60°</option>
          <option value="heron">героновы (целая площадь)</option>
        </select>
        <div class="row" style="margin-top:8px">
          <label style="margin:0">Стороны не больше</label>
          <input type="number" data-id="N" value="100" min="5" max="1000">
        </div>
        <label class="inline"><input type="checkbox" data-id="prim" checked> ${L.uni ? 'только несократимые (НОД сторон 1)' : 'без «увеличенных копий» (3, 4, 5 есть, 6, 8, 10 нет)'}</label>
        <p class="note" data-id="count"></p>
      </div>
      <div class="panel" data-id="info"></div>
      <div class="panel scroll"><div class="cards" data-id="list"></div></div>
    </div>
  </div>`,

  mount(root, params, L) {
    const $ = finder(root);
    const v = View($('#cv'), 1.4, 0, 0.3);
    let data = [], sel = null;
    // #triangles/<вид>/<граница>
    if (['right', 'deg120', 'deg60', 'heron'].includes(params[0])) $('#kind').value = params[0];
    if (+params[1] > 0) $('#N').value = params[1];

    function refresh() {
      const kind = $('#kind').value, maxN = kind === 'heron' ? 150 : 1000;
      $('#N').max = maxN;
      const N = Math.min(maxN, Math.max(5, parseInt($('#N').value, 10) || 5));
      const prim = $('#prim').checked;
      data = kind === 'heron' ? heronTriangles(N, prim) : triangles(kind, N, prim);
      $('#count').textContent = `Найдено: ${data.length}` + (kind === 'heron' && N === 150 ? ' (для героновых стороны до 150)' : '');
      const shown = data.slice(0, 400);
      $('#list').innerHTML = shown.map((t, i) =>
        `<button data-i="${i}" aria-pressed="false">${t.a}, ${t.b}, ${t.c}<small>${t.S !== undefined ? 'S = ' + t.S : (L.uni ? 't = ' + t.t : '')}</small></button>`).join('')
        + (data.length > shown.length ? `<p class="note">…и ещё ${data.length - shown.length}</p>` : '');
      select(data.length ? 0 : -1);
    }
    function select(i) {
      sel = i >= 0 ? data[i] : null;
      root.querySelectorAll('[data-id="list"] button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === i));
      drawFig(); drawConic(); info();
    }
    function drawFig() {
      const t = sel;
      if (!t) { $('#fig').innerHTML = ''; return; }
      // для героновых: самая длинная сторона — основание CA, высота из B
      if (t.kind === 'heron') {
        $('#fig').innerHTML = triangleSVG({ a: t.a, b: t.c, c: t.b },
          { height: 'h = ' + fracStr(2 * t.S, t.c), right: false, labels: { a: t.a, b: t.c, c: t.b } });
      } else {
        $('#fig').innerHTML = triangleSVG(t, { angle: KIND_ANGLE[t.kind], right: t.kind === 'right' });
      }
    }
    function drawConic() {
      const t = sel, show = t && t.kind !== 'heron';
      $('#cv').classList.toggle('hidden', !show);
      if (!show) return;
      const K = { right: CONICS[0], deg120: CONICS[3], deg60: ELLIPSE60 }[t.kind];
      v.axes(); v.curve(K.Ff, css('--curve'));
      const [x0, y0] = K.P0.map(q => q.toNumber());
      v.line(x0, y0, t.t.toNumber(), css('--accent'));
      v.dot(x0, y0, css('--ink'), 6, 'A');
      v.dot(t.a / t.c, t.b / t.c, css('--accent'), 7, `(${t.a}/${t.c}; ${t.b}/${t.c})`);
    }
    function info() {
      const t = sel, box = $('#info');
      if (!t) { box.innerHTML = '<p class="note">Ничего не найдено — увеличьте границу.</p>'; return; }
      const k = t.g > 1 ? `<p class="note">Это увеличенный в ${t.g} раза треугольник ${t.a / t.g}, ${t.b / t.g}, ${t.c / t.g}.</p>` : '';
      const line = L.uni ? `Её даёт секущая через A с угловым коэффициентом <b>t = ${t.t}</b>.` : `Её даёт прямая через A с наклоном <b>${t.t}</b>.`;
      const html = {
        right: () => `<h2>${t.a}² + ${t.b}² = ${t.c}²</h2>
          <p>Разделим на ${t.c}²: точка (${t.a}/${t.c}; ${t.b}/${t.c}) лежит на окружности x² + y² = 1. ${line}</p>`,
        deg120: () => `<h2>${t.a}² + ${t.a}·${t.b} + ${t.b}² = ${t.c}²</h2>
          <p>По теореме косинусов угол между сторонами ${t.a} и ${t.b} равен 120°. Точка (${t.a}/${t.c}; ${t.b}/${t.c}) лежит на эллипсе x² + xy + y² = 1. ${line}</p>`,
        deg60: () => `<h2>${t.a}² − ${t.a}·${t.b} + ${t.b}² = ${t.c}²</h2>
          <p>Угол между сторонами ${t.a} и ${t.b} равен 60°. Точка (${t.a}/${t.c}; ${t.b}/${t.c}) лежит на эллипсе x² − xy + y² = 1. ${line}</p>`,
        heron: () => `<h2>Стороны ${t.a}, ${t.b}, ${t.c}; площадь ${t.S}</h2>
          <p>Высота к стороне ${t.c} равна ${fracStr(2 * t.S, t.c)} и делит треугольник на два прямоугольных с дробными сторонами — каждый из них получается из точки на окружности.</p>
          ${t.right ? '<p class="note">Этот треугольник сам прямоугольный.</p>' : ''}`,
      }[t.kind]();
      box.innerHTML = html + k;
    }
    $('#kind').onchange = () => { if ($('#kind').value === 'heron' && +$('#N').value > 150) $('#N').value = 60; refresh(); };
    $('#N').onchange = $('#prim').onchange = refresh;
    $('#list').onclick = e => { const b = e.target.closest('button'); if (b) select(+b.dataset.i); };
    refresh();
  },
};
