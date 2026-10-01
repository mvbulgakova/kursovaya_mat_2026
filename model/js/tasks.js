// Задачи тренажёра. Числа берутся из пифагоровых, эйзенштейновых троек,
// героновых треугольников и пифагоровых четвёрок, поэтому ответы получаются
// целыми или простыми дробями. Всё детерминировано: один и тот же набор,
// вариант и список тем всегда дают одни и те же задачи.
import { Q, triangles, heronTriangles, latticePoints, rng, isSquare } from './core.js';

const half = n => new Q(n, 2);

/** Числа-ответы печатаем по-школьному: 12,5 вместо 25/2, когда это возможно. */
export function showQ(q) {
  if (q.d === 1n) return q.n.toString();
  let d = q.d;
  for (const p of [2n, 5n]) while (d % p === 0n) d /= p;
  if (d === 1n) { // конечная десятичная дробь
    const s = (Number(q.n) / Number(q.d)).toString().replace('.', ',');
    if (s.length < 12) return s;
  }
  return `${q.n}/${q.d}`;
}

/** Разбор ответа ученика: «12», «−3», «12,5», «12.5», «25/2», «12 1/2». */
export function parseAnswer(str) {
  if (str == null) return null;
  let s = String(str).trim().replace(/[−–—]/g, '-').replace(/\s+/g, ' ').replace(',', '.');
  if (!s) return null;
  try {
    let m;
    if ((m = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/))) { // смешанная дробь
      const q = new Q(BigInt(m[2]) * BigInt(m[4]) + BigInt(m[3]), BigInt(m[4]));
      return m[1] ? q.neg() : q;
    }
    if ((m = s.match(/^(-?\d+)\/(\d+)$/))) return BigInt(m[2]) === 0n ? null : new Q(BigInt(m[1]), BigInt(m[2]));
    if ((m = s.match(/^(-?)(\d*)\.(\d+)$/))) {
      const q = new Q(BigInt((m[2] || '0') + m[3]), 10n ** BigInt(m[3].length));
      return m[1] ? q.neg() : q;
    }
    if (/^-?\d+$/.test(s)) return new Q(BigInt(s));
  } catch { /* не число */ }
  return null;
}

// ----------------------------------------------------------------- наборы чисел
function quadruples(N) {
  const out = [];
  for (let a = 1; a <= N; a++) for (let b = a; b <= N; b++) for (let c = b; c <= N; c++) {
    const d = isSquare(a * a + b * b + c * c);
    if (d > 0 && d <= N * 1.8) out.push({ a, b, c, d });
  }
  return out;
}
const POOLS = {};
function pool(kind, N) {
  const key = kind + N;
  if (POOLS[key]) return POOLS[key];
  let P;
  if (kind === 'heron') P = heronTriangles(Math.min(N, 60), false).filter(T => !T.right);
  else if (kind === 'quad') P = quadruples(Math.min(N, 40));
  else if (kind === 'lattice') {
    P = [];
    for (let R = 5; R <= Math.min(N, 65); R++) {
      const pts = latticePoints(R);
      if (pts.length > 4 && pts.length <= 20) P.push({ R, pts });
    }
  } else P = triangles(kind, N, false).filter(T => T.c >= 5);
  return (POOLS[key] = P);
}

// ----------------------------------------------------------------- темы
// make(T, r) → { q: текст, fig: чертёж, answers: [{ label, value: Q }], solution }
export const TOPICS = {
  hyp: {
    title: 'Гипотенуза по катетам', kind: 'right',
    hint: 'Теорема Пифагора: c² = a² + b².',
    make: T => ({
      q: `Катеты прямоугольного треугольника равны ${T.a} и ${T.b}. Найдите гипотенузу.`,
      fig: { type: 'tri', t: T, labels: { a: T.a, b: T.b, c: '?' }, right: true },
      answers: [{ value: new Q(T.c) }],
      solution: `c² = ${T.a}² + ${T.b}² = ${T.a * T.a} + ${T.b * T.b} = ${T.c * T.c}, c = ${T.c}.`,
    }),
  },
  leg: {
    title: 'Катет по гипотенузе', kind: 'right',
    hint: 'Из теоремы Пифагора: a² = c² − b².',
    make: T => ({
      q: `Гипотенуза прямоугольного треугольника равна ${T.c}, а один из катетов равен ${T.b}. Найдите другой катет.`,
      fig: { type: 'tri', t: T, labels: { a: '?', b: T.b, c: T.c }, right: true },
      answers: [{ value: new Q(T.a) }],
      solution: `a² = ${T.c}² − ${T.b}² = ${T.c * T.c - T.b * T.b}, a = ${T.a}.`,
    }),
  },
  area: {
    title: 'Площадь прямоугольного треугольника', kind: 'right',
    hint: 'Сначала найдите второй катет по теореме Пифагора, затем S = ab/2.',
    make: T => ({
      q: `Гипотенуза прямоугольного треугольника равна ${T.c}, а один из катетов равен ${T.a}. Найдите площадь треугольника.`,
      fig: { type: 'tri', t: T, labels: { a: T.a, b: null, c: T.c }, right: true },
      answers: [{ value: half(T.a * T.b) }],
      solution: `Второй катет: √(${T.c}² − ${T.a}²) = ${T.b}; S = ${T.a}·${T.b}/2 = ${showQ(half(T.a * T.b))}.`,
    }),
  },
  diag: {
    title: 'Диагональ прямоугольника', kind: 'right',
    hint: 'Диагональ делит прямоугольник на два прямоугольных треугольника.',
    make: T => ({
      q: `Стороны прямоугольника равны ${T.a} и ${T.b}. Найдите его диагональ.`,
      fig: null,
      answers: [{ value: new Q(T.c) }],
      solution: `d² = ${T.a}² + ${T.b}² = ${T.c * T.c}, d = ${T.c}.`,
    }),
  },
  dist: {
    title: 'Расстояние между точками', kind: 'right',
    hint: 'AB = √((x₂ − x₁)² + (y₂ − y₁)²).',
    make: (T, r) => {
      const x1 = Math.floor(r() * 21) - 10, y1 = Math.floor(r() * 21) - 10;
      const sx = r() < 0.5 ? -1 : 1, sy = r() < 0.5 ? -1 : 1, sw = r() < 0.5;
      const dx = sw ? T.b : T.a, dy = sw ? T.a : T.b;
      const A = [x1, y1], B = [x1 + sx * dx, y1 + sy * dy];
      return {
        q: `Найдите расстояние между точками A(${A[0]}; ${A[1]}) и B(${B[0]}; ${B[1]}).`,
        fig: { type: 'seg', A, B },
        answers: [{ value: new Q(T.c) }],
        solution: `AB² = ${dx}² + ${dy}² = ${T.c * T.c}, AB = ${T.c}.`,
      };
    },
  },
  mid: {
    title: 'Середина и длина отрезка', kind: 'right',
    hint: 'Середина: ((x₁ + x₂)/2; (y₁ + y₂)/2). Длина — по теореме Пифагора.',
    make: (T, r) => {
      const x1 = Math.floor(r() * 17) - 8, y1 = Math.floor(r() * 17) - 8;
      const sx = r() < 0.5 ? -1 : 1, sy = r() < 0.5 ? -1 : 1;
      const A = [x1, y1], B = [x1 + sx * T.a, y1 + sy * T.b];
      const mx = half(A[0] + B[0]), my = half(A[1] + B[1]);
      return {
        q: `Даны точки A(${A[0]}; ${A[1]}) и B(${B[0]}; ${B[1]}). Найдите координаты середины отрезка AB и его длину.`,
        fig: { type: 'seg', A, B },
        answers: [{ label: 'x середины', value: mx }, { label: 'y середины', value: my }, { label: 'длина', value: new Q(T.c) }],
        solution: `M(${showQ(mx)}; ${showQ(my)}), AB = √(${T.a}² + ${T.b}²) = ${T.c}.`,
      };
    },
  },
  cos120: {
    title: 'Теорема косинусов, 120°', kind: 'deg120',
    hint: 'c² = a² + b² − 2ab·cos 120° = a² + b² + ab.',
    make: T => ({
      q: `Две стороны треугольника равны ${T.a} и ${T.b}, а угол между ними равен 120°. Найдите третью сторону.`,
      fig: { type: 'tri', t: T, labels: { a: T.a, b: T.b, c: '?' }, angle: '120°' },
      answers: [{ value: new Q(T.c) }],
      solution: `c² = ${T.a}² + ${T.b}² + ${T.a}·${T.b} = ${T.c * T.c}, c = ${T.c}.`,
    }),
  },
  cos60: {
    title: 'Теорема косинусов, 60°', kind: 'deg60',
    hint: 'c² = a² + b² − 2ab·cos 60° = a² + b² − ab.',
    make: T => ({
      q: `Две стороны треугольника равны ${T.a} и ${T.b}, а угол между ними равен 60°. Найдите третью сторону.`,
      fig: { type: 'tri', t: T, labels: { a: T.a, b: T.b, c: '?' }, angle: '60°' },
      answers: [{ value: new Q(T.c) }],
      solution: `c² = ${T.a}² + ${T.b}² − ${T.a}·${T.b} = ${T.c * T.c}, c = ${T.c}.`,
    }),
  },
  heron: {
    title: 'Площадь по трём сторонам', kind: 'heron',
    hint: 'Формула Герона: S = √(p(p − a)(p − b)(p − c)), p — полупериметр.',
    make: T => {
      const p = (T.a + T.b + T.c) / 2;
      return {
        q: `Стороны треугольника равны ${T.a}, ${T.b} и ${T.c}. Найдите его площадь.`,
        fig: { type: 'tri', t: { a: T.a, b: T.c, c: T.b }, labels: { a: T.a, b: T.c, c: T.b }, right: false },
        answers: [{ value: new Q(T.S) }],
        solution: `p = ${p}; S = √(${p}·${p - T.a}·${p - T.b}·${p - T.c}) = ${T.S}.`,
      };
    },
  },
  height: {
    title: 'Высота к большей стороне', kind: 'heron',
    hint: 'Найдите площадь по формуле Герона, затем h = 2S / c.',
    make: T => {
      const h = new Q(2 * T.S, T.c);
      return {
        q: `Стороны треугольника равны ${T.a}, ${T.b} и ${T.c}. Найдите высоту, проведённую к стороне ${T.c}.`,
        fig: { type: 'tri', t: { a: T.a, b: T.c, c: T.b }, labels: { a: T.a, b: T.c, c: T.b }, right: false, height: 'h = ?' },
        answers: [{ value: h }],
        solution: `S = ${T.S}, h = 2·${T.S}/${T.c} = ${showQ(h)}.`,
      };
    },
  },
  box: {
    title: 'Диагональ прямоугольного параллелепипеда', kind: 'quad',
    hint: 'd² = a² + b² + c² — теорема Пифагора дважды.',
    make: T => ({
      q: `Измерения прямоугольного параллелепипеда равны ${T.a}, ${T.b} и ${T.c}. Найдите его диагональ.`,
      fig: { type: 'box', a: T.a, b: T.b, c: T.c, labels: { d: 'd = ?' } },
      answers: [{ value: new Q(T.d) }],
      solution: `d² = ${T.a}² + ${T.b}² + ${T.c}² = ${T.d * T.d}, d = ${T.d}.`,
    }),
  },
  lattice: {
    title: 'Целые точки на окружности', kind: 'lattice',
    hint: 'Ищите пары целых x, y с x² + y² = R²; не забудьте точки со знаком минус и на осях.',
    make: T => ({
      q: `Сколько точек с целыми координатами лежит на окружности x² + y² = ${T.R * T.R}?`,
      fig: null,
      answers: [{ value: new Q(T.pts.length) }],
      solution: `${T.pts.length}: ` + T.pts.map(p => `(${p[0]}; ${p[1]})`).join(', ') + '.',
    }),
  },
};
export const TOPIC_IDS = Object.keys(TOPICS);

// ----------------------------------------------------------------- варианты
export function hash32(str) {
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(str)) { h ^= ch; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** Задачи варианта v (нумерация с 1) набора seed. */
export function variant(seed, v, topics, N) {
  const r = rng(hash32(`${seed}|${v}|${topics.join('-')}|${N}`));
  const tasks = [];
  for (const id of topics) {
    const def = TOPICS[id]; if (!def) continue;
    const P = pool(def.kind, N); if (!P.length) continue;
    const T = P[Math.floor(r() * P.length)];
    tasks.push({ topic: id, ...def.make(T, r) });
  }
  return tasks;
}

/** Проверка ответов: inputs[i][j] — строка, введённая в j-е поле задачи i. */
export function grade(tasks, inputs) {
  return tasks.map((t, i) => t.answers.map((a, j) => {
    const q = parseAnswer(inputs[i]?.[j]);
    return q !== null && q.eq(a.value);
  }));
}

// ----------------------------------------------------------------- код результата
// 35 бит = 7 символов: вариант (7), баллы (5), всего (5), попытка (3), контроль (15).
const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const setKey = (seed, topics, N) => `${seed}|${topics.join('-')}|${N}`;

export function resultCode(seed, topics, N, v, score, total, attempt) {
  const payload = (BigInt(v & 127) << 13n) | (BigInt(score & 31) << 8n) | (BigInt(total & 31) << 3n) | BigInt(Math.min(attempt, 7) & 7);
  const check = BigInt(hash32(setKey(seed, topics, N) + '#' + payload) & 0x7fff);
  let x = (payload << 15n) | check, s = '';
  for (let i = 0; i < 7; i++) { s = ALPH[Number(x & 31n)] + s; x >>= 5n; }
  return s.slice(0, 4) + '-' + s.slice(4);
}

export function readCode(code, seed, topics, N) {
  const s = String(code).toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{7}$/.test(s)) return null;
  let x = 0n;
  for (const ch of s) x = (x << 5n) | BigInt(ALPH.indexOf(ch));
  const payload = x >> 15n, check = x & 0x7fffn;
  if (BigInt(hash32(setKey(seed, topics, N) + '#' + payload) & 0x7fff) !== check) return null;
  const v = Number(payload >> 13n), score = Number((payload >> 8n) & 31n), total = Number((payload >> 3n) & 31n), attempt = Number(payload & 7n);
  if (!v || score > total) return null;
  return { v, score, total, attempt };
}
