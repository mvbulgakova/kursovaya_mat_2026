// Раздел «3D-сфера»: стереографическая проекция и пифагоровы четвёрки (WebGL2).
import { Q, SURFACES, surfacePoint, integerForm } from '../core.js';
import { createRenderer, Orbit, surfaceMesh, project, hexToRGB } from '../lib/gl.js';
import { boxSVG } from '../ui/triangle-svg.js';
import { css, finder } from '../util.js';

// дробные значения параметра: знаменатели 1–3, |значение| ≤ 2
function grid() {
  const vals = [];
  for (let q = 1; q <= 3; q++) for (let p = -2 * q; p <= 2 * q; p++) {
    let a = Math.abs(p), b = q; while (b) [a, b] = [b, a % b];
    if (a === 1 || p === 0 && q === 1) vals.push(new Q(p, q));
  }
  return vals.sort((u, v) => u.toNumber() - v.toNumber());
}

const MESHES = {
  sphere: () => surfaceMesh((u, v) => [Math.cos(u) * Math.cos(v), Math.cos(u) * Math.sin(v), Math.sin(u)], [-Math.PI / 2, Math.PI / 2], [0, 2 * Math.PI], 48, 96),
  hyperboloid: () => surfaceMesh((u, v) => [Math.cosh(u) * Math.cos(v), Math.cosh(u) * Math.sin(v), Math.sinh(u)], [-1.4, 1.4], [0, 2 * Math.PI], 48, 96),
};

export default {
  id: 'sphere',
  title: () => '3D-сфера',
  html: L => `
  <div class="layout">
    <div style="position:relative">
      <canvas class="plot" data-id="cv" aria-label="Трёхмерная сцена: поверхность и точки"></canvas>
      <p class="note" style="margin:6px 0 0">Вращайте пальцем или мышью, приближайте щипком или колёсиком. Коснитесь точки, чтобы выбрать её.</p>
    </div>
    <div>
      <div class="panel">
        ${L.uni ? `<label>Поверхность</label><select data-id="surf">${SURFACES.map((S, i) => `<option value="${i}">${S.name}</option>`).join('')}</select>` : ''}
        <p class="note" data-id="about"></p>
        <div class="row">
          <button class="act main" data-id="lift">▲ Поднять точки</button>
          <label class="inline"><input type="checkbox" data-id="all" checked> все прямые</label>
        </div>
      </div>
      <div class="panel" data-id="info"></div>
      <div data-id="box"></div>
    </div>
  </div>`,

  mount(root, params, L) {
    const $ = finder(root);
    const cv = $('#cv');
    let S = SURFACES[0];
    if (L.uni && SURFACES[+params[0]]) { S = SURFACES[+params[0]]; $('#surf').value = params[0]; }
    let renderer;
    try { renderer = createRenderer(cv); } catch (e) { console.warn(e); }
    if (!renderer) { $('#info').innerHTML = '<p class="bad">Не удалось включить графику на этом устройстве.</p>'; return; }

    let pts = [], sel = null, lift = 0, target = 0, raf = 0, mesh = null, mvp = null;
    const vals = grid();
    const orbit = new Orbit(cv, { onChange: () => request() });

    function build() {
      mesh = MESHES[S.id]();
      orbit.dist = S.id === 'sphere' ? 5.5 : 9.5;
      pts = [];
      for (const s of vals) for (const t of vals) {
        const r = surfacePoint(S, s, t);
        if (r.infinite) continue;
        const X = r.X.map(v => v.toNumber());
        if (Math.hypot(...X) > 3.2) continue; // слишком далеко для чертежа
        pts.push({ s, t, P: r.P.map(v => v.toNumber()), X, exact: r });
      }
      const pick = pts.find(p => p.s.eq(new Q(1, 2)) && p.t.eq(new Q(1, 3))) || pts[0];
      select(pick);
    }
    const P0 = () => S.P0.map(v => v.toNumber());
    function pos(p) { // точка на пути от плоскости к поверхности
      return p.P.map((v, i) => v + (p.X[i] - v) * lift);
    }
    function scene() {
      const c = n => hexToRGB(css(n));
      const p0 = P0();
      const lines = [];
      // плоскость: квадратная сетка
      const segs = [];
      const P = (s, t) => S.plane(new Q(s * 2, 2), new Q(t * 2, 2)).map(v => v.toNumber());
      for (let k = -2; k <= 2; k += 0.5) segs.push([P(k, -2), P(k, 2)], [P(-2, k), P(2, k)]);
      lines.push({ segs, color: c('--muted'), alpha: 0.35 });
      if ($('#all').checked) lines.push({ segs: pts.map(p => [p0, pos(p)]), color: c('--accent2'), alpha: 0.12 });
      if (sel) {
        const far = sel.X.map((v, i) => p0[i] + (v - p0[i]) * 1.15);
        lines.push({ segs: [[p0, far]], color: c('--accent'), alpha: 1 });
      }
      return {
        surface: mesh, surfColor: c('--accent2'), lines,
        points: [
          { pts: pts.map(p => p.P), color: c('--muted'), size: 1.4 },
          { pts: pts.map(pos), color: c('--accent2'), size: 2.2 },
          { pts: [p0], color: c('--ink'), size: 4 },
          ...(sel ? [{ pts: [sel.P, pos(sel)], color: c('--accent'), size: 4.2 }] : []),
        ],
      };
    }
    function frame() {
      raf = 0;
      if (Math.abs(lift - target) > 1e-3) { lift += (target - lift) * 0.08; request(); } else lift = target;
      mvp = renderer.draw(scene(), orbit, hexToRGB(css('--panel')));
    }
    function request() { if (!raf) raf = requestAnimationFrame(frame); }

    function select(p) {
      sel = p;
      const r = p.exact, [X, Y, Z, W] = integerForm(r.X);
      const coords = r.X.map(v => v.toString()).join('; ');
      const pl = r.P.map(v => v.toString()).join('; ');
      const abs = v => (v < 0n ? -v : v);
      const eq = S.id === 'sphere'
        ? `${abs(X)}² + ${abs(Y)}² + ${abs(Z)}² = ${W}²`
        : `${abs(X)}² + ${abs(Y)}² − ${abs(Z)}² = ${W}²`;
      $('#info').innerHTML = L.uni
        ? `<h3>${eq}</h3>
           <table><tr><th>точка плоскости</th><td class="mono">(${pl})</td></tr>
           <tr><th>λ</th><td class="mono">${r.lam}</td></tr>
           <tr><th>точка поверхности</th><td class="mono">(${coords})</td></tr></table>
           <p class="note">Прямая через P₀(${S.P0.join('; ')}) и точку ${S.planeName}: X = P₀ + λ(P − P₀), λ = −2B(P₀, d)/Q(d) рационально — как лемма о втором корне, только в пространстве.</p>`
        : `<h3>${eq}</h3>
           <p>Прямая из северного полюса N(0; 0; 1) через точку (${pl}) на плоскости попадает в точку сферы (${coords}).</p>
           <p class="note">Все три координаты — дроби со знаменателем ${W}. Умножив на ${W}, получаем целые числа, сумма квадратов которых — квадрат.</p>`;
      const showBox = S.id === 'sphere' && X !== 0n && Y !== 0n && Z !== 0n;
      $('#box').innerHTML = showBox
        ? `<div class="panel"><h3>Ящик ${abs(X)} × ${abs(Y)} × ${abs(Z)}</h3>${boxSVG(Number(abs(X)), Number(abs(Y)), Number(abs(Z)), { labels: { d: 'd = ' + W }, w: 320, h: 250 })}
           <p class="note">Его пространственная диагональ — ровно ${W}. <a href="#trainer">Задачи на такие ящики — в тренажёре</a>.</p></div>`
        : '';
      request();
    }
    cv.addEventListener('pointerup', e => {
      if (orbit.moved() || !mvp) return;
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
      let best = null, bd = 30 * (cv.width / r.width);
      for (const p of pts) {
        const [sx, sy] = project(mvp, pos(p), cv.width, cv.height);
        const d = Math.hypot(sx - x, sy - y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) select(best);
    });
    $('#lift').onclick = () => {
      target = target ? 0 : 1;
      $('#lift').textContent = target ? '▼ Опустить точки' : '▲ Поднять точки';
      request();
    };
    $('#all').onchange = request;
    if (L.uni) $('#surf').onchange = e => { S = SURFACES[+e.target.value]; history.replaceState(null, '', '#sphere/' + e.target.value); about(); build(); };
    function about() {
      $('#about').textContent = S.id === 'sphere'
        ? (L.uni ? 'Стереографическая проекция из полюса N(0; 0; 1): рациональные точки плоскости z = 0 взаимно однозначно соответствуют рациональным точкам сферы без N.'
          : 'Сетка точек с дробными координатами на плоскости. Нажмите «Поднять»: каждая точка уедет по прямой из полюса N на сферу и останется «дробной».')
        : 'Однополостный гиперболоид и его рациональная точка (1; 0; 0). Прямые через неё и рациональные точки плоскости x = 0 дают все остальные рациональные точки (кроме лежащих на прямых через P₀ по поверхности).';
    }
    const ro = new ResizeObserver(request); ro.observe(cv);
    about(); build();
    // при первом открытии точки поднимаются сами
    const autoLift = setTimeout(() => { if (!target) $('#lift').click(); }, 600);
    return () => { clearTimeout(autoLift); cancelAnimationFrame(raf); ro.disconnect(); };
  },
};
