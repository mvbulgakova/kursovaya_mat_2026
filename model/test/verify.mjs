#!/usr/bin/env node
/*
 * Проверка модели и всех числовых выкладок курсовой работы.
 * Запуск:  node model/test/verify.mjs
 * Всё считается в точной рациональной арифметике, без округления.
 */
import * as RP from '../js/core.js';
import * as TK from '../js/tasks.js';
import * as LV from '../js/levels.js';
import { encode } from '../js/lib/qrcode.js';
import jsQR from 'jsqr';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { Q, CONICS, CUBICS, secondPoint, slopes, addPoints, multiples, tripleFromPoint } = RP;

let failures = 0, checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { failures++; console.error('  ОШИБКА: ' + msg); }
}
const q = s => Q.of(s);
const pt = (x, y) => [q(x), q(y)];
const same = (P, x, y) => P.x.eq(q(x)) && P.y.eq(q(y));

// ---------------------------------------------------------------- 1
console.log('1. Секущие для всех несократимых p/q, |p|, q <= 12');
const T = slopes(12);
let total = 0;
for (const C of CONICS) {
  if (!C.P0) continue;
  ok(C.F(...C.P0).isZero(), `${C.name}: отмеченная точка не на кривой`);
  let n = 0;
  for (const t of [...T, null]) {
    const P = secondPoint(C, t);
    if (P.infinite) continue;
    ok(C.F(P.x, P.y).isZero(), `${C.name}, t=${t}: F(x1,y1) != 0`);
    n++;
  }
  console.log(`   ${C.name}: ${n} точек, все дают точный нуль`);
  total += n;
}
console.log(`   значений параметра на одну конику: ${T.length} (+ вертикальная прямая)`);
console.log(`   всего проверено точек: ${total}`);

// ---------------------------------------------------------------- 2
console.log('2. Выкладки главы 1');
{
  const C = CONICS[0];
  ok(same(secondPoint(C, q('1/2')), '3/5', '4/5'), 't=1/2 -> (3/5,4/5)');
  ok(same(secondPoint(C, q('2/3')), '5/13', '12/13'), 't=2/3 -> (5/13,12/13)');
  ok(same(secondPoint(C, q(1)), 0, 1), 't=1 -> (0,1)');
  ok(secondPoint(C, null).tangent, 'x=-1 — касательная в A');
  const trip = (p, q_) => [p * p - q_ * q_, 2 * p * q_, p * p + q_ * q_];
  const table = [[2, 1, [3, 4, 5]], [3, 2, [5, 12, 13]], [4, 1, [15, 8, 17]],
    [4, 3, [7, 24, 25]], [5, 2, [21, 20, 29]], [3, 1, [8, 6, 10]]];
  for (const [p, q_, abc] of table)
    ok(JSON.stringify(trip(p, q_)) === JSON.stringify(abc), `тройка для p=${p}, q=${q_}`);
  // теорема 1.3 (обратная часть) на всех примитивных тройках с c <= 500
  const g = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  let cnt = 0;
  for (let c = 1; c <= 500; c++) for (let a = 1; a < c; a++) {
    const b2 = c * c - a * a, b = Math.round(Math.sqrt(b2));
    if (b * b !== b2 || b % 2 || g(g(a, b), c) !== 1) continue;
    const found = [];
    for (let p = 1; p * p < c; p++) for (let s = 1; s < p; s++)
      if (g(p, s) === 1 && (p - s) % 2 === 1 && p * p - s * s === a && 2 * p * s === b)
        found.push([p, s]);
    ok(found.length === 1, `тройка (${a},${b},${c}) представима ровно одной парой`);
    cnt++;
  }
  console.log(`   теорема 1.3 проверена на ${cnt} примитивных тройках с c <= 500`);
  const [a, b, c] = tripleFromPoint(q('5/13'), q('12/13'));
  ok(a === 5n && b === 12n && c === 13n, 'тройка по точке (5/13, 12/13)');
}

// ---------------------------------------------------------------- 3
console.log('3. Выкладки главы 2');
{
  const H = CONICS[2];
  ok(same(secondPoint(H, q(1)), 3, 2), 'Пелль: t=1 -> (3,2)');
  ok(same(secondPoint(H, q('3/4')), 17, 12), 'Пелль: t=3/4 -> (17,12)');
  ok(same(secondPoint(H, q('5/7')), 99, 70), 'Пелль: t=5/7 -> (99,70)');
  const E = CONICS[3];
  for (const t of T) {
    const P = secondPoint(E, t);
    if (P.infinite) continue;
    const den = t.mul(t).add(t).add(1);
    ok(P.x.eq(t.mul(t).sub(1).div(den)), 'эллипс 120°: формула для x');
    ok(P.y.eq(t.mul(t.add(2)).div(den).neg()), 'эллипс 120°: формула для y');
  }
  for (const [m, n, abc] of [[2, 1, [3, 5, 7]], [3, 1, [8, 7, 13]], [4, 1, [15, 9, 21]]]) {
    const a = m * m - n * n, b = 2 * m * n + n * n, c = m * m + m * n + n * n;
    ok(JSON.stringify([a, b, c]) === JSON.stringify(abc), `эйзенштейнова тройка m=${m}, n=${n}`);
    ok(a * a + a * b + b * b === c * c, `a²+ab+b²=c² для m=${m}, n=${n}`);
    // замена t = n/m даёт точку (-a/c, -b/c)
    const P = secondPoint(E, new Q(n, m));
    ok(same(P, `${-a}/${c}`, `${-b}/${c}`), `t=n/m даёт (-a/c,-b/c) для m=${m}, n=${n}`);
  }
  // x^2+y^2=3 и x^2+y^2=7: нет решений X^2+Y^2=kZ^2 с НОД=1 при малых высотах
  for (const k of [3, 7]) {
    let found = 0;
    for (let Z = 1; Z <= 200; Z++) for (let X = 0; X <= 2 * Z; X++) {
      const r = k * Z * Z - X * X; if (r < 0) break;
      const Y = Math.round(Math.sqrt(r)); if (Y * Y === r) found++;
    }
    ok(found === 0, `x²+y²=${k}: найдено решение`);
  }
  console.log('   решений X²+Y²=3Z² и X²+Y²=7Z² с 1 <= Z <= 200 нет');
}

// ---------------------------------------------------------------- 4
console.log('4. Выкладки главы 4 и упражнений');
{
  const [E1, E2] = CUBICS;
  const m1 = multiples(E1, 6);
  ok(m1[1].pt[0].eq(0) && m1[1].pt[1].eq(1), '2P=(0,1)');
  ok(m1[2].pt[0].eq(-1) && m1[2].pt[1].eq(0), '3P=(-1,0)');
  ok(m1[3].pt[0].eq(0) && m1[3].pt[1].eq(-1), '4P=(0,-1)');
  ok(m1[4].pt[0].eq(2) && m1[4].pt[1].eq(-3), '5P=(2,-3)');
  ok(m1[5].pt.O === true, '6P=O');
  const d = addPoints(E2, E2.P, E2.P);
  ok(d.lambda.eq('27/10') && d.sum[0].eq('129/100') && d.sum[1].eq('-383/1000'),
    'y²=x³-2: λ=27/10, 2P=(129/100,-383/1000)');
  const m2 = multiples(E2, 10);
  for (const r of m2) ok(!r.pt.O && E2.onCurve(r.pt), `y²=x³-2: ${r.k}P на кривой`);
  console.log('   высоты кратных P(3;5): ' + m2.map(r => r.pt[0].height()).join(', ') + ' знаков');
  // формула удвоения с λ=(3x²+a)/(2y) при a != 0 (рис. 4.1, y² = x³ - 2x + 2)
  const E3 = { a: q(-2), b: q(2) };
  const P = pt(1, 1), D = addPoints(E3, P, P).sum;
  ok(D[1].mul(D[1]).eq(D[0].mul(D[0]).mul(D[0]).sub(D[0].mul(2)).add(2)),
    'удвоение на кривой с a != 0');
  // упражнение 5.1: точки и пропущенная вертикальная прямая
  const C2 = CONICS[1];
  for (const [t, x, y] of [['0', -1, 1], ['1', -1, -1], ['1/3', '-7/5', '1/5'], ['3', '1/5', '-7/5']])
    ok(same(secondPoint(C2, q(t)), x, y), `упр. 5.1: t=${t}`);
  ok(secondPoint(C2, q(-1)).tangent, 'упр. 5.1: касательной отвечает t=-1');
  ok(same(secondPoint(C2, null), 1, -1), 'упр. 5.1: вертикальная прямая даёт (1;-1)');
  // упражнение 5.3
  const H3 = { ...CONICS[2] };
  const pell3 = t => { const s = t.mul(t).mul(3); const den = s.sub(1); return [s.add(1).div(den), t.mul(2).div(den)]; };
  for (const [t, x, y] of [['1', 2, 1], ['2/3', 7, 4], ['3/5', 26, 15]]) {
    const [X, Y] = pell3(q(t));
    ok(X.eq(x) && Y.eq(y) && X.mul(X).sub(Y.mul(Y).mul(3)).eq(1), `упр. 5.3: t=${t}`);
  }
}

// ---------------------------------------------------------------- 5
console.log('5. Быстрое вычисление nP (полиномы деления)');
{
  for (const E of CUBICS) {
    const fast = RP.multiplesFast(E, 60), slow = multiples(E, 60);
    for (let i = 0; i < 60; i++) {
      const A = fast[i].pt, B = slow[i].pt;
      if (A.O || B.O) { ok(A.O && B.O, `${E.name}: ${i + 1}P = O`); continue; }
      ok(A[0].n === B[0].n && A[0].d === B[0].d && A[1].n === B[1].n && A[1].d === B[1].d,
        `${E.name}: ${i + 1}P совпадает с пошаговым сложением`);
    }
  }
  const E = CUBICS[1], big = RP.multiplesFast(E, 200);
  for (const r of big) {
    const [x, y] = r.pt, a = E.a.n, b = E.b.n;
    // y^2 = x^3 + ax + b  <=>  Y^2 D^6... проверяем в целых числах с общим знаменателем
    const X = x.n, D2 = x.d, Y = y.n, D3 = y.d;
    ok(D3 * D3 === D2 * D2 * D2, `${r.k}P: знаменатели согласованы`);
    ok(Y * Y === X ** 3n + a * X * D2 * D2 + b * D2 ** 3n, `${r.k}P лежит на кривой`);
  }
  console.log(`   y² = x³ − 2: 200 кратных точек лежат на кривой, у 200P ${big[199].pt[0].d.toString().length} цифр в знаменателе`);
}

// ---------------------------------------------------------------- 6
console.log('6. Целые треугольники и задачи');
{
  const g = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  const R = RP.triangles('right', 300, false);
  for (const t of R) ok(t.a * t.a + t.b * t.b === t.c * t.c, `прямоугольный ${t.a},${t.b},${t.c}`);
  for (const t of RP.triangles('right', 300, true)) {
    const P = secondPoint(CONICS[0], t.t);
    ok(same(P, `${t.a}/${t.c}`, `${t.b}/${t.c}`) || same(P, `${t.b}/${t.c}`, `${t.a}/${t.c}`) ||
      P.x.eq(new Q(t.a, t.c)) && P.y.eq(new Q(t.b, t.c)), `секущая t=${t.t} даёт тройку ${t.a},${t.b},${t.c}`);
  }
  const T120 = RP.triangles('deg120', 400, true);
  for (const t of T120) {
    ok(t.a * t.a + t.a * t.b + t.b * t.b === t.c * t.c, `120°: ${t.a},${t.b},${t.c}`);
    ok(same(secondPoint(CONICS[3], t.t), `${t.a}/${t.c}`, `${t.b}/${t.c}`), `120°: секущая t=${t.t}`);
  }
  // критерий из § 2.4: m > n, НОД = 1, 3 ∤ (m − n) — ровно все несократимые тройки
  const byFormula = new Set();
  for (let m = 2; m < 40; m++) for (let n = 1; n < m; n++) {
    if (g(m, n) !== 1 || (m - n) % 3 === 0) continue;
    const a = m * m - n * n, b = 2 * m * n + n * n, c = m * m + m * n + n * n;
    if (c <= 400) byFormula.add([Math.min(a, b), Math.max(a, b), c].join());
  }
  ok(byFormula.size === T120.length && T120.every(t => byFormula.has([t.a, t.b, t.c].join())),
    'формулы § 2.4 дают все несократимые треугольники с углом 120°');
  for (const t of RP.triangles('deg60', 300, false)) ok(t.a * t.a - t.a * t.b + t.b * t.b === t.c * t.c, `60°: ${t.a},${t.b},${t.c}`);
  for (const t of RP.heronTriangles(80, false)) {
    const s = (t.a + t.b + t.c) / 2;
    ok(Math.abs(Math.sqrt(s * (s - t.a) * (s - t.b) * (s - t.c)) - t.S) < 1e-9, `героновский ${t.a},${t.b},${t.c}`);
  }
  for (const R0 of [5, 25, 65]) for (const [x, y] of RP.latticePoints(R0)) ok(x * x + y * y === R0 * R0, `целая точка на x²+y²=${R0}²`);
  console.log(`   ${R.length} прямоугольных и ${T120.length} несократимых треугольников с углом 120° проверены`);
}

// ---------------------------------------------------------------- 7
console.log('7. Тренажёр: задачи, ответы, коды результата');
{
  const J = x => JSON.stringify(x, (k, v) => (typeof v === 'bigint' ? v.toString() : v));
  const topics = TK.TOPIC_IDS;
  // ответ пересчитываем заново по числам из текста условия — независимо от генератора
  const nums = q => (q.match(/-?\d+/g) || []).map(Number);
  const heronS = (a, b, c) => { const p = (a + b + c) / 2; return Math.sqrt(p * (p - a) * (p - b) * (p - c)); };
  const expect = {
    hyp: ([a, b]) => [Math.hypot(a, b)], leg: ([c, b]) => [Math.sqrt(c * c - b * b)],
    area: ([c, a]) => [a * Math.sqrt(c * c - a * a) / 2], diag: ([a, b]) => [Math.hypot(a, b)],
    dist: ([x1, y1, x2, y2]) => [Math.hypot(x2 - x1, y2 - y1)],
    mid: ([x1, y1, x2, y2]) => [(x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1)],
    cos120: ([a, b]) => [Math.sqrt(a * a + b * b + a * b)], cos60: ([a, b]) => [Math.sqrt(a * a + b * b - a * b)],
    heron: ([a, b, c]) => [heronS(a, b, c)], height: ([a, b, c]) => [2 * heronS(a, b, c) / c],
    box: ([a, b, c]) => [Math.sqrt(a * a + b * b + c * c)],
    lattice: ([R2]) => { let k = 0; for (let x = -200; x <= 200; x++) for (let y = -200; y <= 200; y++) if (x * x + y * y === R2) k++; return [k]; },
  };
  let n = 0;
  for (const N of [30, 100, 300]) for (let seed = 1; seed <= 6; seed++) for (let v = 1; v <= 8; v++) {
    const tasks = TK.variant(seed, v, topics, N);
    ok(tasks.length === topics.length, 'в варианте все темы');
    ok(J(tasks) === J(TK.variant(seed, v, topics, N)), 'вариант воспроизводится');
    for (const t of tasks) {
      const want = expect[t.topic](nums(t.q).filter((x, i) => !(t.topic.startsWith('cos') && i === 2)));
      ok(want.length === t.answers.length && want.every((w, j) => Math.abs(w - t.answers[j].value.toNumber()) < 1e-9),
        `${t.topic}: ответ сходится с условием (${t.q})`);
      const inputs = t.answers.map(a => TK.showQ(a.value));
      ok(TK.grade([t], [inputs])[0].every(Boolean), `${t.topic}: напечатанный ответ принимается`);
      n++;
    }
  }
  console.log(`   ${n} задач: ответы пересчитаны по условию`);
  ok(J(TK.variant(1, 1, topics, 100)) !== J(TK.variant(1, 2, topics, 100)), 'варианты различаются');
  const P = TK.parseAnswer;
  for (const [s, q] of [['12', '12'], ['12,5', '25/2'], ['12.5', '25/2'], ['25/2', '25/2'], ['12 1/2', '25/2'], ['−3', '-3'], [' 7 ', '7'], ['0,25', '1/4']])
    ok(P(s)?.eq(q), `разбор ответа «${s}»`);
  for (const s of ['', 'abc', '1/0', '1,2,3', '5 см']) ok(P(s) === null, `«${s}» не число`);
  let codes = 0;
  for (let v = 1; v <= 40; v++) for (let sc = 0; sc <= 12; sc += 3) for (const att of [1, 3, 9]) {
    const c = TK.resultCode(77, topics, 100, v, sc, 12, att);
    const r = TK.readCode(c, 77, topics, 100);
    ok(r && r.v === v && r.score === sc && r.total === 12 && r.attempt === Math.min(att, 7), `код ${c} читается`);
    ok(TK.readCode(c, 78, topics, 100) === null, 'код чужого набора отклоняется');
    ok(TK.readCode(c.toLowerCase().replace('-', ' '), 77, topics, 100) !== null, 'регистр и пробелы не важны');
    codes++;
  }
  // одна ошибочная буква почти всегда ловится контрольной суммой
  let caught = 0, tries = 0;
  const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  for (let v = 1; v <= 20; v++) {
    const c = TK.resultCode(5, topics, 100, v, 7, 12, 1).replace('-', '');
    for (let i = 0; i < 7; i++) for (const ch of ALPH) if (ch !== c[i]) {
      tries++; if (TK.readCode(c.slice(0, i) + ch + c.slice(i + 1), 5, topics, 100) === null) caught++;
    }
  }
  ok(caught / tries > 0.99, 'опечатки в коде отлавливаются');
  console.log(`   ${codes} кодов результата; опечаток поймано ${caught} из ${tries}`);
}

// ---------------------------------------------------------------- 8
console.log('8. QR-коды (проверка независимым декодером jsQR)');
{
  const decode = text => {
    const { size, modules } = encode(text), s = 5, q = 4, W = (size + 2 * q) * s;
    const px = new Uint8ClampedArray(W * W * 4).fill(255);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x])
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const i = (((y + q) * s + dy) * W + (x + q) * s + dx) * 4; px[i] = px[i + 1] = px[i + 2] = 0;
      }
    return jsQR(px, W, W)?.data;
  };
  const versions = new Set();
  const samples = ['https://mvbulgakova.github.io/kursovaya_mat_2026/#check/4821/17/' + TK.TOPIC_IDS.join('-') + '/300',
    'Вариант 1 · √2 ≈ 1,41', 'A'];
  for (let L = 2; L <= 330; L += 7) samples.push(Array.from({ length: L }, (_, i) => String.fromCharCode(33 + (i * 13 + L) % 90)).join(''));
  for (const t of samples) { ok(decode(t) === t, `QR «${t.slice(0, 30)}…»`); versions.add(encode(t).version); }
  console.log(`   ${samples.length} строк декодированы без ошибок, версии ${[...versions].sort((a, b) => a - b).join(', ')}`);
}

// ---------------------------------------------------------------- 9
console.log('9. Офлайн-режим: service worker знает все файлы');
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/^\s+'([^']+)',$/gm)].map(m => m[1]));
  const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = ['index.html', 'manifest.webmanifest', ...['css', 'icons', 'js'].flatMap(d => walk(join(root, d)).map(p => relative(root, p)))];
  for (const f of files) ok(listed.has(f), `файл ${f} есть в sw.js`);
  for (const f of listed) if (f !== './') ok(files.includes(f), `файл ${f} из sw.js существует`);
  console.log(`   ${files.length} файлов`);
}

// ---------------------------------------------------------------- 10
console.log('10. Игра: каждый уровень решается');
{
  for (const lv of LV.LEVELS) {
    if (lv.type === 'arc') {
      let best = null;
      for (let q = 1; q <= 60 && !best; q++) for (let p = -8 * q; p <= 8 * q && !best; p++)
        if (RP.gcd(p, q) === 1 && LV.scoreArc(lv, new Q(p, q))) best = new Q(p, q);
      ok(best && LV.scoreArc(lv, best) === 3, `${lv.id}: решение на три звезды (${best})`);
    }
    if (lv.type === 'triple') {
      const all = LV.triplesWith(lv);
      ok(all.length >= 2 && all.every(([a, b, c]) => a * a + b * b === c * c), `${lv.id}: ${all.length} треугольников`);
      ok(LV.scoreTriple(lv, all).stars === 3, `${lv.id}: все найдены — три звезды`);
    }
    if (lv.type === 'circle') {
      const has = LV.sumOfTwoSquares(lv.n);
      let found = false; // перебор X² + Y² = n·Z² подтверждает ответ
      for (let Z = 1; Z <= 60 && !found; Z++) for (let X = 0; X * X <= lv.n * Z * Z; X++) {
        const Y = Math.round(Math.sqrt(lv.n * Z * Z - X * X)); if (Y * Y + X * X === lv.n * Z * Z) { found = true; break; }
      }
      ok(found === has, `${lv.id}: ответ «${has ? 'есть' : 'нет'}» верен`);
      if (!has) for (const m of LV.goodModuli(lv.n)) { // довод по модулю m действительно работает
        const sq = [...new Set(Array.from({ length: m }, (_, k) => k * k % m))];
        const z0 = m === 4 ? sq.filter(a => sq.some(b => (a + b) % 4 === lv.n % 4)).length === 0 : sq.filter(a => sq.includes((m - a) % m)).every(a => a === 0);
        ok(z0, `${lv.id}: по модулю ${m} противоречие`);
      }
      ok(has || LV.goodModuli(lv.n).length > 0, `${lv.id}: есть подходящий модуль`);
    }
    if (lv.type === 'cubic') {
      const E = LV.CUBICS[lv.cubic];
      // проходим оптимальную цепочку и сверяем с быстрым вычислением kP
      const path = []; for (let k = lv.k; k > 1; ) { if (k % 2 === 0) { path.unshift('dbl'); k /= 2; } else { path.unshift('add'); k -= 1; } }
      let R = E.P, k = 1;
      for (const st of path) { R = RP.addPoints(E, R, st === 'dbl' ? R : E.P).sum; k = st === 'dbl' ? 2 * k : k + 1; }
      const want = RP.multiplesFast(E, lv.k)[lv.k - 1].pt;
      ok(k === lv.k && (R.O ? want.O : R[0].eq(want[0]) && R[1].eq(want[1])), `${lv.id}: ${lv.k}P совпадает`);
      ok(path.length <= LV.chainLength(lv.k) + 1, `${lv.id}: цепочка из ${path.length} ходов`);
    }
  }
  console.log(`   ${LV.LEVELS.length} уровней`);
}

console.log(`\nПроверок: ${checks}, ошибок: ${failures}`);
process.exit(failures ? 1 : 0);
