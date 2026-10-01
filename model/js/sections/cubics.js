// Раздел «Кубики»: кратные nP методом хорд и касательных (только уровень «Вуз»).
import { CUBICS, multiplesFast, addPoints } from '../core.js';
import { View } from '../ui/plot2d.js';
import { css, fmt, finder } from '../util.js';

export default {
  id: 'cubics',
  title: () => 'Кубики',
  uniOnly: true,
  html: () => `
  <div class="layout">
    <div>
      <canvas class="plot" data-id="cv" width="800" height="800" aria-label="Чертёж кубики и её точек"></canvas>
      <canvas class="plot wide" data-id="cvH" width="800" height="400" aria-label="Рост числа цифр в знаменателе"></canvas>
    </div>
    <div>
      <div class="panel">
        <label>Кривая</label>
        <select data-id="cubic">${CUBICS.map((c, i) => `<option value="${i}">${c.name}</option>`).join('')}</select>
        <p class="note" data-id="note"></p>
        <label>Сколько кратных nP вычислить (до 200)</label>
        <div class="row">
          <input type="number" data-id="n" value="6" min="1" max="200">
          <button class="act" data-id="step">+1</button>
          <button class="act" data-id="step10">+10</button>
        </div>
      </div>
      <div class="panel scroll" data-id="out"></div>
    </div>
  </div>`,

  mount(root, params) {
    const $ = finder(root);
    const v = View($('#cv'), 3.5, 0.5, 0);
    let E = CUBICS[0], nShow = 6;
    const cache = {};
    if (CUBICS[+params[0]]) { E = CUBICS[+params[0]]; $('#cubic').value = params[0]; }
    if (+params[1] > 0) nShow = Math.min(200, +params[1]);

    const getMultiples = n => {
      if (!cache[E.name] || cache[E.name].length < n) cache[E.name] = multiplesFast(E, Math.max(n, 20));
      return cache[E.name].slice(0, n);
    };
    function drawHeights(list) {
      const cv = $('#cvH'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
      ctx.fillStyle = css('--panel'); ctx.fillRect(0, 0, W, H);
      const vals = list.map(r => (r.pt.O ? 0 : r.pt[0].d.toString().length));
      const maxV = Math.max(1, ...vals), Lm = 70, B = 50, w = (W - Lm - 20) / list.length;
      ctx.strokeStyle = css('--muted'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Lm, 20); ctx.lineTo(Lm, H - B); ctx.lineTo(W - 10, H - B); ctx.stroke();
      ctx.fillStyle = css('--accent2');
      vals.forEach((val, i) => { const h = (H - B - 30) * val / maxV; ctx.fillRect(Lm + i * w + w * 0.1, H - B - h, Math.max(1, w * 0.8), h); });
      ctx.fillStyle = css('--ink'); ctx.font = '22px Georgia, serif';
      ctx.fillText(`цифр в знаменателе x(nP): до ${maxV}`, Lm + 10, 34);
      ctx.fillStyle = css('--muted'); ctx.font = '20px Georgia, serif';
      ctx.fillText('n = 1', Lm, H - B + 28); ctx.fillText(`n = ${list.length}`, W - 90, H - B + 28);
    }
    function refresh() {
      $('#note').textContent = E.note;
      $('#n').value = nShow;
      const list = getMultiples(nShow);
      v.span = E === CUBICS[0] ? 3.6 : 6; v.cx = E === CUBICS[0] ? 0.6 : 2;
      v.axes();
      v.curve((x, y) => E.Ff(x, y), css('--curve'));
      const last = list[list.length - 1], prev = list[list.length - 2];
      if (prev && !prev.pt.O && !last.pt.O && prev.pt[0].d.toString().length < 200) {
        const r = addPoints(E, prev.pt, E.P);
        if (r.lambda) { const [fx, fy] = prev.pt.map(q => q.toNumber()); v.line(fx, fy, r.lambda.toNumber(), css('--accent'), [6, 5]); }
      }
      for (const r of list) if (!r.pt.O) {
        const [x, y] = r.pt.map(q => q.toNumber());
        if (Math.abs(x - v.cx) < v.span && Math.abs(y - v.cy) < v.span)
          v.dot(x, y, r === last ? css('--accent') : css('--accent2'), 5, list.length <= 12 ? (r.k === 1 ? 'P' : r.k + 'P') : '');
      }
      drawHeights(list);
      let h = '<table><tr><th>n</th><th>nP</th></tr>';
      for (const r of list) {
        const ptStr = r.pt.O ? 'O (бесконечно удалённая точка)' : `(${fmt(r.pt[0], 40)}; ${fmt(r.pt[1], 40)})`;
        h += `<tr><td>${r.k}</td><td class="mono">${ptStr}</td></tr>`;
      }
      h += '</table>';
      const ord = list.find(r => r.pt.O);
      h += ord ? `<p>Порядок точки P равен <b>${ord.k}</b>: подгруппа ⟨P⟩ конечна. Для коники так не бывает (следствие 2.6).</p>`
        : `<p class="note">nP ≠ O при n ≤ ${nShow}. Число цифр растёт примерно как n², поэтому точки быстро «убегают» и перестают помещаться на чертеже. Координаты считаются через полиномы деления: x(nP) = x − ψₙ₋₁ψₙ₊₁/ψₙ².</p>`;
      $('#out').innerHTML = h;
    }
    const setN = n => { nShow = Math.min(200, Math.max(1, n)); refresh(); };
    $('#cubic').onchange = e => { E = CUBICS[+e.target.value]; refresh(); };
    $('#n').onchange = () => setN(parseInt($('#n').value, 10) || 1);
    $('#step').onclick = () => setN(nShow + 1);
    $('#step10').onclick = () => setN(nShow + 10);
    refresh();
  },
};
