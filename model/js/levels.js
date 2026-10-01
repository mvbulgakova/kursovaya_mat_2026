// Уровни игры и проверка ответов. Интерфейс — в sections/game.js.
import { Q, CONICS, CUBICS, secondPoint, isSquare } from './core.js';

const deg = d => d * Math.PI / 180;

/** Полярный угол второй точки секущей с наклоном t (в радианах, 0..2π). */
export function landingAngle(C, t) {
  const P = secondPoint(C, t);
  if (P.infinite) return null;
  const a = Math.atan2(P.y.toNumber(), P.x.toNumber());
  return { P, angle: a < 0 ? a + 2 * Math.PI : a };
}
export const inArc = (a, [from, to]) => a >= deg(from) && a <= deg(to);

/** Кратчайшее число ходов «удвоить» и «прибавить P» от P до kP (цепочка сложений). */
export function chainLength(k) {
  const dist = new Map([[1, 0]]), queue = [1];
  while (queue.length) {
    const n = queue.shift();
    if (n === k) return dist.get(n);
    for (const m of [n + 1, 2 * n]) if (m <= k && !dist.has(m)) { dist.set(m, dist.get(n) + 1); queue.push(m); }
  }
  return Infinity;
}

/** Все прямоугольные треугольники a < b с гипотенузой c (или с катетом leg). */
export function triplesWith({ hyp, leg }) {
  const out = [];
  if (hyp) for (let a = 1; a * a * 2 < hyp * hyp; a++) { const b = isSquare(hyp * hyp - a * a); if (b > a) out.push([a, b, hyp]); }
  if (leg) for (let c = leg + 1; c < leg * leg; c++) { const b = isSquare(c * c - leg * leg); if (b > 0) out.push([Math.min(leg, b), Math.max(leg, b), c]); }
  return out;
}

/** Есть ли рациональная точка на x² + y² = n: каждый простой p ≡ 3 (mod 4) входит в n в чётной степени. */
export function sumOfTwoSquares(n) {
  for (let p = 2, m = n; p <= m; p++) {
    let e = 0; while (m % p === 0) { m /= p; e++; }
    if (p % 4 === 3 && e % 2) return false;
  }
  return true;
}
/** Модули, по которым школьный перебор остатков доказывает отсутствие точек. */
export function goodModuli(n) {
  const res = [];
  if (n % 4 === 3) res.push(4);
  for (let p = 3; p <= n; p += 2) {
    let e = 0, m = n; while (m % p === 0) { m /= p; e++; }
    if (p % 4 === 3 && e % 2 === 1 && [3, 7, 11].includes(p)) res.push(p);
  }
  return res;
}

export const LEVELS = [
  { id: 'arc1', type: 'arc', title: 'Первый выстрел', conic: 0, arc: [40, 100], stars: [2, 4],
    text: 'Подберите наклон t = p/q прямой из точки A так, чтобы она второй раз пересекла окружность внутри подсвеченной дуги.' },
  { id: 'arc2', type: 'arc', title: 'Нижняя дуга', conic: 0, arc: [250, 290], stars: [2, 5],
    text: 'Теперь дуга внизу. Отрицательный наклон тоже можно.' },
  { id: 'tri25', type: 'triple', title: 'Гипотенуза 25', hyp: 25,
    text: 'Найдите все прямоугольные треугольники с целыми сторонами и гипотенузой 25.' },
  { id: 'yes5', type: 'circle', title: 'Окружность x² + y² = 5', n: 5,
    text: 'Есть ли на окружности x² + y² = 5 точка с дробными (рациональными) координатами?' },
  { id: 'no3', type: 'circle', title: 'Окружность x² + y² = 3', n: 3,
    text: 'А на окружности x² + y² = 3?' },
  { id: 'arc3', type: 'arc', title: 'Узкая щель', conic: 0, arc: [147, 149], stars: [2, 6],
    text: 'Дуга совсем узкая — понадобится дробь посложнее. Звёзды даются за маленький знаменатель.' },
  { id: 'tri65', type: 'triple', title: 'Гипотенуза 65', hyp: 65,
    text: 'У гипотенузы 65 треугольников много. Найдите все.' },
  { id: 'ell1', type: 'arc', title: 'Эллипс', conic: 3, arc: [80, 120], stars: [2, 5],
    text: 'Тот же приём на эллипсе x² + xy + y² = 1: прямая выходит из точки A(1; 0).' },
  { id: 'yes34', type: 'circle', title: 'Окружность x² + y² = 34', n: 34,
    text: 'Есть ли рациональная точка на окружности x² + y² = 34?' },
  { id: 'no21', type: 'circle', title: 'Окружность x² + y² = 21', n: 21,
    text: 'А на x² + y² = 21? Если нет — по какому модулю это видно?' },
  { id: 'leg20', type: 'triple', title: 'Катет 20', leg: 20,
    text: 'Найдите все прямоугольные треугольники с целыми сторонами, у которых один из катетов равен 20.' },
  { id: 'arc4', type: 'arc', title: 'Снайпер', conic: 0, arc: [70.2, 70.8], stars: [17, 30],
    text: 'Дуга шириной в один градус.' },
  { id: 'cub4', type: 'cubic', title: 'Кубика: 4P', cubic: 1, k: 4, uniOnly: true,
    text: 'На кривой y² = x³ − 2 дана точка P(3; 5). Получите точку 4P хордами и касательными за наименьшее число ходов.' },
  { id: 'cub11', type: 'cubic', title: 'Кубика: 11P', cubic: 1, k: 11, uniOnly: true,
    text: 'Теперь 11P. Числа будут огромными, но ходов нужно немного.' },
  { id: 'cub6', type: 'cubic', title: 'Возвращение', cubic: 0, k: 6, uniOnly: true,
    text: 'На кривой y² = x³ + 1 точка P(2; 3). Дойдите до точки O — бесконечно удалённой.' },
];

/** Звёзды за уровень по результату (0 — не пройден). */
export function scoreArc(level, t) {
  const r = t === null ? null : landingAngle(CONICS[level.conic], t);
  if (!r || !inArc(r.angle, level.arc)) return 0;
  const q = Number(t.d);
  return q <= level.stars[0] ? 3 : q <= level.stars[1] ? 2 : 1;
}
export function scoreTriple(level, found) {
  const all = triplesWith(level);
  const key = t => t.slice(0, 2).join(',');
  const got = all.filter(t => found.some(f => key(f) === key(t))).length;
  return { got, total: all.length, stars: got === all.length ? 3 : got >= all.length / 2 ? 2 : got ? 1 : 0 };
}
export function checkTripleInput(level, a, b) {
  if (!(a > 0 && b > 0)) return false;
  const [x, y] = [Math.min(a, b), Math.max(a, b)];
  return triplesWith(level).some(t => t[0] === x && t[1] === y);
}
/** Ответ «есть точка»: точная проверка x² + y² = n. */
export function checkCirclePoint(n, x, y) {
  return x !== null && y !== null && x.mul(x).add(y.mul(y)).eq(new Q(n));
}
export function scoreCubic(level, moves) {
  const best = chainLength(level.k);
  return moves <= best ? 3 : moves <= best + 1 ? 2 : 1;
}
export { CUBICS };
