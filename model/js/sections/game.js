// Раздел «Игра»: уровни на метод секущих, тройки, остатки и кубики.
import { Q, CONICS, addPoints } from '../core.js';
import { LEVELS, CUBICS, landingAngle, inArc, scoreArc, scoreTriple, checkTripleInput, sumOfTwoSquares, goodModuli, checkCirclePoint, scoreCubic, chainLength } from '../levels.js';
import { parseAnswer } from '../tasks.js';
import { View } from '../ui/plot2d.js';
import { css, esc, fmt, finder, store } from '../util.js';

const starsStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const levelsFor = L => LEVELS.filter(l => L.uni || !l.uniOnly);
const progress = () => store.get('game', {});
function saveStars(id, n) {
  const p = progress();
  if ((p[id] || 0) < n) { p[id] = n; store.set('game', p); }
}

// ----------------------------------------------------------------- салют из точек
function confetti(canvas, x0, y0) {
  const ctx = canvas.getContext('2d'), W = canvas.width = canvas.clientWidth * 2, H = canvas.height = canvas.clientHeight * 2;
  const colors = [css('--accent'), css('--accent2'), css('--ok'), '#d9a400'];
  const parts = Array.from({ length: 90 }, (_, i) => {
    const a = 2 * Math.atan(i / 7 - 6.4) * 2, v = 6 + (i % 7) * 2.2; // направления — по рациональным t
    return { x: x0 * 2, y: y0 * 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, c: colors[i % 4], r: 3 + (i % 3) * 2 };
  });
  const t0 = performance.now();
  (function step(now) {
    const k = (now - t0) / 1600;
    ctx.clearRect(0, 0, W, H);
    if (k > 1) return;
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.35;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(step);
  })(t0);
}

// ----------------------------------------------------------------- карта уровней
function mapHTML(L) {
  const p = progress(), levels = levelsFor(L);
  const total = levels.reduce((s, l) => s + (p[l.id] || 0), 0);
  return `
  <div class="panel"><div class="row" style="justify-content:space-between">
    <h2 style="margin:0">Уровни</h2><span class="stars" style="font-size:1.2rem">★ ${total} / ${levels.length * 3}</span></div>
    <p class="note" style="margin:6px 0 0">Каждый пройденный уровень открывает следующий. Звёзды — за изящное решение: маленький знаменатель, все треугольники, верный ответ с первой попытки.</p>
  </div>
  <div class="hero" style="margin-top:12px">${levels.map((l, i) => {
    const open = i === 0 || p[levels[i - 1].id] > 0 || p[l.id] > 0;
    return open
      ? `<a href="#game/${l.id}"><b>${i + 1}. ${esc(l.title)}</b><span class="stars">${starsStr(p[l.id] || 0)}</span></a>`
      : `<a aria-disabled="true" style="opacity:.45;pointer-events:none"><b>${i + 1}. ${esc(l.title)}</b><span class="note">🔒 закрыт</span></a>`;
  }).join('')}</div>
  <p style="margin-top:12px"><button class="act" data-id="reset">Начать заново</button></p>`;
}

// ----------------------------------------------------------------- уровень
function levelHTML(L, lv) {
  const levels = levelsFor(L), i = levels.indexOf(lv);
  const ctl = {
    arc: `<label>Наклон прямой t = p / q</label>
      <div class="row"><button class="act" data-d="p-1">−</button><input type="number" data-id="p" value="1" style="width:5em"><button class="act" data-d="p1">+</button>
        <span>/</span><button class="act" data-d="q-1">−</button><input type="number" data-id="q" value="1" min="1" style="width:5em"><button class="act" data-d="q1">+</button></div>
      <p><button class="act main" data-id="shoot">Провести прямую</button></p>`,
    triple: `<label>Катеты</label><div class="row"><input type="number" data-id="a" min="1" placeholder="a" style="width:6em"><input type="number" data-id="b" min="1" placeholder="b" style="width:6em">
      <button class="act main" data-id="add">Проверить</button></div><div data-id="found" style="margin-top:8px"></div>`,
    circle: `<div class="row"><button class="act" data-id="yes">Есть</button><button class="act" data-id="no">Нет</button></div>
      <div data-id="yesBox" class="hidden"><label>Точка (дроби можно: 1/2)</label><div class="row">
        x = <input data-id="x" style="width:6em"> y = <input data-id="y" style="width:6em"><button class="act main" data-id="checkPt">Проверить</button></div></div>
      <div data-id="noBox" class="hidden"><label>По какому модулю видно, что точек нет? Посмотрите, какие остатки дают квадраты.</label>
        <div class="row">${[3, 4, 5, 7, 8].map(m => `<button class="act" data-m="${m}">mod ${m}</button>`).join('')}</div><div data-id="table" style="margin-top:8px"></div></div>`,
    cubic: `<div class="row"><button class="act main" data-id="addP">R + P (хорда)</button><button class="act main" data-id="dbl">2R (касательная)</button>
      <button class="act" data-id="restart">Сначала</button></div><div data-id="state" style="margin-top:8px"></div>`,
  }[lv.type];
  return `
  <p><a href="#game">← все уровни</a></p>
  <div class="layout">
    <div style="position:relative">
      <canvas class="plot" data-id="cv" width="800" height="800"></canvas>
      <canvas data-id="fx" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
    </div>
    <div>
      <div class="panel"><h2>${i + 1}. ${esc(lv.title)}</h2><p>${esc(lv.text)}</p>${ctl}</div>
      <div class="panel" data-id="msg" aria-live="polite"></div>
      <div class="panel hidden" data-id="win"><span class="stars" data-id="winStars" style="font-size:1.6rem"></span>
        ${levels[i + 1] ? `<p><a class="act main" href="#game/${levels[i + 1].id}">Следующий уровень →</a></p>` : '<p>Это был последний уровень!</p>'}</div>
    </div>
  </div>`;
}

function mountLevel(root, L, lv) {
  const $ = finder(root);
  const cv = $('#cv'), v = View(cv, 1.6);
  const say = (html, cls = '') => { $('#msg').innerHTML = `<span class="${cls}">${html}</span>`; };
  let won = 0, anim = 0;
  function win(stars, at) {
    won = Math.max(won, stars); saveStars(lv.id, stars);
    $('#win').classList.remove('hidden'); $('#winStars').textContent = starsStr(won);
    const r = cv.getBoundingClientRect();
    confetti($('#fx'), at ? at[0] / v.W * r.width : r.width / 2, at ? at[1] / v.H * r.height : r.height / 2);
  }

  if (lv.type === 'arc') {
    const C = CONICS[lv.conic];
    v.span = lv.conic === 0 ? 1.6 : 1.7;
    let shot = null, grow = 1;
    const arcPts = () => { // дуга на кривой: радиус по направлению из начала координат
      const pts = [];
      for (let a = lv.arc[0]; a <= lv.arc[1]; a += 0.1) {
        const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
        const r = 1 / Math.sqrt(C.Ff(c, s) + 1);
        pts.push([r * c, r * s]);
      }
      return pts;
    };
    const draw = () => {
      v.axes(); v.curve((x, y) => C.Ff(x, y), css('--curve'));
      const pts = arcPts(), ctx = v.ctx;
      ctx.strokeStyle = css('--ok'); ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.globalAlpha = 0.45; ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(v.X(x), v.Y(y)) : ctx.moveTo(v.X(x), v.Y(y))));
      ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
      const [x0, y0] = C.P0.map(q => q.toNumber());
      if (shot) {
        const P = shot.P, tx = P.x.toNumber(), ty = P.y.toNumber();
        v.segment(x0, y0, x0 + (tx - x0) * grow * 1.25, y0 + (ty - y0) * grow * 1.25, css('--accent'), 2);
        if (grow >= 1) v.dot(tx, ty, shot.hit ? css('--ok') : css('--accent'), 9);
      }
      v.dot(x0, y0, css('--ink'), 7, 'A');
    };
    const T = () => { const p = parseInt($('#p').value, 10), q = Math.max(1, parseInt($('#q').value, 10) || 1); return Number.isFinite(p) ? new Q(p, q) : null; };
    root.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const [k, d] = [b.dataset.d[0], +b.dataset.d.slice(1)];
      const el = $('#' + k); el.value = Math.max(k === 'q' ? 1 : -99, (parseInt(el.value, 10) || 0) + d);
    });
    $('#shoot').onclick = () => {
      const t = T(); if (!t) return;
      const r = landingAngle(C, t);
      if (!r) { say('Прямая параллельна асимптоте и второй раз кривую не пересекает.', 'bad'); return; }
      const hit = inArc(r.angle, lv.arc);
      shot = { P: r.P, hit }; grow = 0;
      cancelAnimationFrame(anim);
      const t0 = performance.now();
      const step = now => {
        grow = Math.min(1, (now - t0) / 450); draw();
        if (grow < 1) { anim = requestAnimationFrame(step); return; }
        const deg = (r.angle * 180 / Math.PI).toFixed(1);
        if (hit) {
          const st = scoreArc(lv, t);
          say(`Попадание! Точка (${r.P.x}; ${r.P.y}), угол ${deg}°.${st < 3 ? ' Попробуйте дробь с меньшим знаменателем — будет больше звёзд.' : ''}`, 'ok');
          win(st, [v.X(r.P.x.toNumber()), v.Y(r.P.y.toNumber())]);
        } else {
          say(`Мимо: точка (${r.P.x}; ${r.P.y}) под углом ${deg}°, а нужно от ${lv.arc[0]}° до ${lv.arc[1]}°.`, 'bad');
        }
      };
      anim = requestAnimationFrame(step);
    };
    draw();
    say('Подсказка: чем больше наклон, тем дальше против часовой стрелки уходит точка.', 'note');
  }

  if (lv.type === 'triple') {
    const found = [];
    const draw = () => {
      v.span = 1.3; v.cx = 0.5; v.cy = 0.5;
      v.axes(); v.curve((x, y) => x * x + y * y - 1, css('--curve'));
      for (const [a, b, c] of found) {
        v.segment(0, 0, a / c, b / c, css('--accent2'), 1.5);
        v.dot(a / c, b / c, css('--accent'), 7, `${a}, ${b}`);
        v.dot(b / c, a / c, css('--accent'), 5);
      }
    };
    $('#add').onclick = () => {
      const a = parseInt($('#a').value, 10), b = parseInt($('#b').value, 10);
      if (!checkTripleInput(lv, a, b)) {
        const c = lv.hyp || null;
        say(c ? `${a}² + ${b}² = ${a * a + b * b}, а нужно ${c}² = ${c * c}.` : `Такого треугольника нет: проверьте теорему Пифагора.`, 'bad');
        return;
      }
      const t = [Math.min(a, b), Math.max(a, b)];
      if (found.some(f => f[0] === t[0] && f[1] === t[1])) { say('Этот треугольник уже найден.', 'note'); return; }
      const c = lv.hyp || Math.round(Math.hypot(a, b));
      found.push([...t, c]);
      const s = scoreTriple(lv, found);
      $('#found').innerHTML = found.map(f => `<div>✓ ${f[0]}, ${f[1]}, ${f[2]}</div>`).join('') + `<p class="note">Найдено ${s.got} из ${s.total}</p>`;
      say(s.got === s.total ? 'Все найдены!' : 'Верно! Ищите дальше.', 'ok');
      draw();
      const rect = [v.X(t[0] / c), v.Y(t[1] / c)];
      if (s.stars) win(s.stars, s.got === s.total ? null : rect);
    };
    draw();
    say(`Каждый треугольник — это точка на окружности радиуса 1: (a/c; b/c).`, 'note');
  }

  if (lv.type === 'circle') {
    const n = lv.n, has = sumOfTwoSquares(n);
    let mistakes = 0;
    const draw = (pt) => {
      v.span = Math.sqrt(n) * 1.3; v.cx = 0; v.cy = 0;
      v.axes(); v.curve((x, y) => x * x + y * y - n, css('--curve'));
      if (pt) v.dot(pt[0], pt[1], css('--ok'), 9);
    };
    const award = () => Math.max(1, 3 - mistakes);
    $('#yes').onclick = () => {
      $('#noBox').classList.add('hidden');
      if (!has) { mistakes++; say('Не спешите: попробуйте найти такую точку — не получится. Подумайте про остатки.', 'bad'); return; }
      $('#yesBox').classList.remove('hidden'); say('Найдите эту точку.', 'note');
    };
    $('#no').onclick = () => {
      $('#yesBox').classList.add('hidden');
      if (has) { mistakes++; say('Точка есть! Попробуйте небольшие целые или дробные числа.', 'bad'); return; }
      $('#noBox').classList.remove('hidden'); say('Верно, точек нет. Теперь докажите.', 'ok');
    };
    $('#checkPt').onclick = () => {
      const x = parseAnswer($('#x').value), y = parseAnswer($('#y').value);
      if (checkCirclePoint(n, x, y)) {
        say(`(${x})² + (${y})² = ${n}. Есть! А дальше секущие дадут бесконечно много таких точек.`, 'ok');
        draw([x.toNumber(), y.toNumber()]); win(award(), [v.X(x.toNumber()), v.Y(y.toNumber())]);
      } else { mistakes++; say(x && y ? `(${x})² + (${y})² = ${x.mul(x).add(y.mul(y))}, а нужно ${n}.` : 'Введите два числа.', 'bad'); }
    };
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      const m = +b.dataset.m;
      const sq = [...new Set(Array.from({ length: m }, (_, k) => k * k % m))].sort((a, c) => a - c);
      const sums = new Set(); sq.forEach(a => sq.forEach(c => sums.add((a + c) % m)));
      const good = goodModuli(n).includes(m);
      $('#table').innerHTML = `<p class="note">Квадраты по модулю ${m}: ${sq.join(', ')}. Суммы двух квадратов: ${[...sums].sort((a, c) => a - c).join(', ')}. ${n}·Z² по модулю ${m}: ${[...new Set(sq.map(z => n * z % m))].sort((a, c) => a - c).join(', ')}.</p>`;
      if (good) {
        say(m === 4
          ? `Да: если Z нечётно, X² + Y² ≡ ${n % 4} (mod 4) — невозможно; если Z чётно, X и Y чётны — противоречие с несократимостью.`
          : `Да: X² + Y² ≡ 0 (mod ${m}) только при X ≡ Y ≡ 0, тогда ${m} делит и Z — противоречие с несократимостью.`, 'ok');
        win(award());
      } else { mistakes++; say(`По модулю ${m} противоречия не видно — попробуйте другой.`, 'bad'); }
    });
    draw();
  }

  if (lv.type === 'cubic') {
    const E = CUBICS[lv.cubic];
    let R = E.P, k = 1, moves = 0, line = null;
    v.span = lv.cubic === 0 ? 3.6 : 6; v.cx = lv.cubic === 0 ? 0.6 : 2;
    const draw = () => {
      v.axes(); v.curve((x, y) => E.Ff(x, y), css('--curve'));
      if (line) v.line(line[0], line[1], line[2], css('--accent'), [6, 5]);
      v.dot(E.P[0].toNumber(), E.P[1].toNumber(), css('--ink'), 6, 'P');
      if (!R.O) {
        const [x, y] = R.map(q => q.toNumber());
        if (Math.abs(x - v.cx) < v.span && Math.abs(y) < v.span) v.dot(x, y, css('--accent'), 8, 'R');
      }
    };
    const state = () => {
      $('#state').innerHTML = `<p>Сейчас R = ${k}P${R.O ? ' = O' : ` = (<span class="mono">${fmt(R[0], 40)}; ${fmt(R[1], 40)}</span>)`}. Ходов: ${moves}. Цель: ${lv.k}P.</p>`;
    };
    const move = dbl => {
      if (R.O) return;
      const r = addPoints(E, R, dbl ? R : E.P);
      line = r.lambda && R[0].d.toString().length < 30 ? [R[0].toNumber(), R[1].toNumber(), r.lambda.toNumber()] : null;
      R = r.sum; k = dbl ? 2 * k : k + 1; moves++;
      draw(); state();
      if (k === lv.k) {
        const st = scoreCubic(lv, moves);
        say(`Готово за ${moves} ${moves < 5 ? 'хода' : 'ходов'}${st < 3 ? `; можно за ${chainLength(lv.k)}` : ' — лучше нельзя'}.`, 'ok');
        win(st);
      } else if (k > lv.k) say(`Перелёт: ${k}P больше цели. Нажмите «Сначала».`, 'bad');
      else say(dbl ? 'Касательная в R пересекла кривую в третьей точке; её отражение — 2R.' : 'Прямая через R и P дала третью точку; её отражение — R + P.', 'note');
    };
    $('#addP').onclick = () => move(false);
    $('#dbl').onclick = () => move(true);
    $('#restart').onclick = () => { R = E.P; k = 1; moves = 0; line = null; draw(); state(); say('', ''); };
    draw(); state();
  }
  return () => cancelAnimationFrame(anim);
}

export default {
  id: 'game',
  title: () => 'Игра',
  html: (L, params) => {
    const lv = levelsFor(L).find(l => l.id === params[0]);
    return lv ? levelHTML(L, lv) : mapHTML(L);
  },
  mount(root, params, L) {
    const lv = levelsFor(L).find(l => l.id === params[0]);
    if (lv) return mountLevel(root, L, lv);
    const bind = () => {
      root.querySelector('[data-id="reset"]').onclick = () => {
        if (!confirm('Стереть все звёзды?')) return;
        store.set('game', {}); root.innerHTML = mapHTML(L); bind();
      };
    };
    bind();
  },
};
