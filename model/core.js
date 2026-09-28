/*
 * Ядро модели: точная арифметика рациональных чисел над BigInt,
 * метод секущих для коник и сложение точек на кубике y^2 = x^3 + ax + b.
 * Подключается и страницей (обычный <script>), и тестами в Node (require).
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------
  //  Рациональные числа
  // ------------------------------------------------------------------
  function babs(a) { return a < 0n ? -a : a; }
  function bgcd(a, b) {
    a = babs(a); b = babs(b);
    while (b) { const r = a % b; a = b; b = r; }
    return a;
  }

  class Q {
    constructor(n, d = 1n) {
      n = BigInt(n); d = BigInt(d);
      if (d === 0n) throw new Error('деление на нуль');
      if (d < 0n) { n = -n; d = -d; }
      const g = bgcd(n, d) || 1n;
      this.n = n / g; this.d = d / g;
    }
    // дробь, про которую заранее известно, что она несократима (d > 0)
    static raw(n, d) {
      const q = Object.create(Q.prototype);
      q.n = n; q.d = d;
      return q;
    }
    static of(x) {
      if (x instanceof Q) return x;
      if (typeof x === 'string' && x.includes('/')) {
        const [a, b] = x.split('/');
        return new Q(BigInt(a.trim()), BigInt(b.trim()));
      }
      return new Q(BigInt(x));
    }
    add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
    div(o) { o = Q.of(o); return new Q(this.n * o.d, this.d * o.n); }
    neg() { return new Q(-this.n, this.d); }
    isZero() { return this.n === 0n; }
    eq(o) { o = Q.of(o); return this.n === o.n && this.d === o.d; }
    toNumber() {
      // устойчиво и для очень длинных числителей/знаменателей
      const sn = babs(this.n).toString(), sd = this.d.toString(), k = 15;
      const e = (sn.length - Math.min(k, sn.length)) - (sd.length - Math.min(k, sd.length));
      const sign = this.n < 0n ? -1 : 1;
      return sign * Number(sn.slice(0, k)) / Number(sd.slice(0, k)) * 10 ** e;
    }
    toString() { return this.d === 1n ? this.n.toString() : this.n + '/' + this.d; }
    height() { return Math.max(babs(this.n).toString().length, this.d.toString().length); }
  }

  // ------------------------------------------------------------------
  //  Коники  ax^2 + bxy + cy^2 + dx + ey + f = 0
  // ------------------------------------------------------------------
  function conic(name, coeffs, P0, note) {
    const [a, b, c, d, e, f] = coeffs.map(Q.of);
    return {
      name, note,
      a, b, c, d, e, f,
      P0: P0 ? [Q.of(P0[0]), Q.of(P0[1])] : null,
      F(x, y) {
        x = Q.of(x); y = Q.of(y);
        return a.mul(x).mul(x).add(b.mul(x).mul(y)).add(c.mul(y).mul(y))
          .add(d.mul(x)).add(e.mul(y)).add(f);
      },
      Ff(x, y) { // вещественное значение для рисования
        const n = v => v.toNumber();
        return n(a) * x * x + n(b) * x * y + n(c) * y * y + n(d) * x + n(e) * y + n(f);
      },
    };
  }

  const CONICS = [
    conic('x² + y² = 1', [1, 0, 1, 0, 0, -1], [-1, 0],
      'Единичная окружность, точка A(−1; 0). Рациональные точки ↔ пифагоровы тройки.'),
    conic('x² + y² = 2', [1, 0, 1, 0, 0, -2], [1, 1],
      'Окружность из упражнения 5.1, отмеченная точка (1; 1).'),
    conic('x² − 2y² = 1', [1, 0, -2, 0, 0, -1], [1, 0],
      'Гипербола Пелля, отмеченная точка (1; 0).'),
    conic('x² + xy + y² = 1', [1, 1, 1, 0, 0, -1], [1, 0],
      'Эллипс треугольников с углом 120°, отмеченная точка (1; 0).'),
    conic('x² + y² = 3', [1, 0, 1, 0, 0, -3], null,
      'Рациональных точек нет (теорема 2.7): отмеченной точки для секущих не существует.'),
  ];

  /**
   * Вторая точка пересечения коники с прямой через P0.
   * t — угловой коэффициент (Q) или null для вертикальной прямой.
   * Возвращает {x, y} либо {infinite: true} (вторая точка бесконечно удалена),
   * {tangent: true} означает, что прямая касается коники в P0.
   */
  function secondPoint(C, t) {
    const [x0, y0] = C.P0;
    let A, B, dir; // u*(A u + B) = 0, точка = P0 + u*dir
    if (t === null) {
      A = C.c;
      B = C.b.mul(x0).add(C.c.mul(y0).mul(2)).add(C.e);
      dir = [new Q(0), new Q(1)];
    } else {
      A = C.a.add(C.b.mul(t)).add(C.c.mul(t).mul(t));
      B = C.a.mul(x0).mul(2).add(C.b.mul(x0.mul(t).add(y0)))
        .add(C.c.mul(y0).mul(t).mul(2)).add(C.d).add(C.e.mul(t));
      dir = [new Q(1), t];
    }
    if (A.isZero()) return { infinite: true, A, B };
    const u = B.div(A).neg();
    const res = { x: x0.add(u.mul(dir[0])), y: y0.add(u.mul(dir[1])), A, B };
    if (u.isZero()) res.tangent = true;
    return res;
  }

  /** Все несократимые p/q с |p| <= N, 1 <= q <= N. */
  function slopes(N) {
    const out = [];
    for (let q = 1; q <= N; q++)
      for (let p = -N; p <= N; p++)
        if (bgcd(BigInt(p), BigInt(q)) === 1n) out.push(new Q(p, q));
    return out;
  }

  /** Лучшее приближение вещественного числа дробью со знаменателем <= maxQ. */
  function approx(x, maxQ = 60) {
    let best = null, bestErr = Infinity;
    for (let q = 1; q <= maxQ; q++) {
      const p = Math.round(x * q);
      const err = Math.abs(x - p / q);
      if (err < bestErr - 1e-12) { best = new Q(p, q); bestErr = err; }
    }
    return best;
  }

  /** Пифагорова тройка по рациональной точке единичной окружности. */
  function tripleFromPoint(x, y) {
    const c = x.d * y.d / bgcd(x.d, y.d);
    const A = babs(x.n * (c / x.d)), B = babs(y.n * (c / y.d));
    return [A, B, c];
  }

  // ------------------------------------------------------------------
  //  Кубики  y^2 = x^3 + ax + b,  O — бесконечно удалённая точка
  // ------------------------------------------------------------------
  const O = { O: true };

  function cubic(name, a, b, P, note) {
    a = Q.of(a); b = Q.of(b);
    return {
      name, note, a, b, P: [Q.of(P[0]), Q.of(P[1])],
      onCurve(pt) {
        if (pt.O) return true;
        const [x, y] = pt;
        return y.mul(y).eq(x.mul(x).mul(x).add(a.mul(x)).add(b));
      },
      Ff(x, y) { return y * y - (x * x * x + a.toNumber() * x + b.toNumber()); },
    };
  }

  const CUBICS = [
    cubic('y² = x³ + 1', 0, 1, [2, 3],
      'Точка P(2; 3) имеет порядок 6: подгруппа ⟨P⟩ конечна (упражнение 5.6).'),
    cubic('y² = x³ − 2', 0, -2, [3, 5],
      'Точка P(3; 5) имеет бесконечный порядок: знаменатели кратных растут лавинообразно.'),
  ];

  /** Сумма точек и угловой коэффициент использованной прямой. */
  function addPoints(E, P, R) {
    if (P.O) return { sum: R, lambda: null };
    if (R.O) return { sum: P, lambda: null };
    const [x1, y1] = P, [x2, y2] = R;
    let lambda;
    if (x1.eq(x2)) {
      if (y1.add(y2).isZero()) return { sum: O, lambda: null, vertical: true };
      // удвоение: касательная, λ = (3x² + a) / (2y)
      lambda = x1.mul(x1).mul(3).add(E.a).div(y1.mul(2));
    } else {
      lambda = y2.sub(y1).div(x2.sub(x1));
    }
    const x3 = lambda.mul(lambda).sub(x1).sub(x2);
    const y3 = lambda.mul(x1.sub(x3)).sub(y1);
    return { sum: [x3, y3], lambda };
  }

  function multiples(E, n) {
    const out = [{ k: 1, pt: E.P, lambda: null }];
    let cur = E.P;
    for (let k = 2; k <= n; k++) {
      const r = addPoints(E, cur, E.P);
      out.push({ k, pt: r.sum, lambda: r.lambda, from: cur });
      cur = r.sum;
    }
    return out;
  }

  // ------------------------------------------------------------------
  //  Быстрое вычисление nP через полиномы деления.
  //  Для целой точки P на y^2 = x^3 + ax + b с целыми a, b
  //    x(nP) = x - ψ(n-1)ψ(n+1) / ψ(n)^2,
  //  где ψ(n) — целые числа, заданные рекуррентными формулами. Дробь может
  //  сократиться только на простые, по модулю которых кривая или точка
  //  вырождаются; здесь это 2 и 3, остальное проверяется в тестах.
  // ------------------------------------------------------------------
  function psiValues(x, y, a, b, M) {
    const P = [0n, 1n, 2n * y,
      3n * x ** 4n + 6n * a * x * x + 12n * b * x - a * a,
      4n * y * (x ** 6n + 5n * a * x ** 4n + 20n * b * x ** 3n - 5n * a * a * x * x
        - 4n * a * b * x - 8n * b * b - a ** 3n)];
    for (let n = 5; n <= M; n++) {
      const m = n >> 1;
      P[n] = n % 2
        ? P[m + 2] * P[m] ** 3n - P[m - 1] * P[m + 1] ** 3n
        : P[m] * (P[m + 2] * P[m - 1] ** 2n - P[m - 2] * P[m + 1] ** 2n) / (2n * y);
    }
    return P;
  }

  function multiplesFast(E, N) {
    const x = E.P[0].n, y = E.P[1].n, a = E.a.n, b = E.b.n;
    if (E.P[0].d !== 1n || E.P[1].d !== 1n || E.a.d !== 1n || E.b.d !== 1n)
      throw new Error('нужна целая точка на кривой с целыми коэффициентами');
    const psi = psiValues(x, y, a, b, Math.max(4, N + 2));
    const out = [{ k: 1, pt: E.P }];
    for (let n = 2; n <= N; n++) {
      if (psi[n] === 0n) { out.push({ k: n, pt: O }); continue; }
      let X = x * psi[n] ** 2n - psi[n - 1] * psi[n + 1], D = babs(psi[n]);
      for (const p of [2n, 3n])
        while (D % p === 0n && X % (p * p) === 0n) { D /= p; X /= p * p; }
      // y(nP) = ψ(2n) / (2ψ(n)^4) = T / (4y ψ(n)^3), приводим к знаменателю D^3
      const T = psi[n + 2] * psi[n - 1] ** 2n - psi[n - 2] * psi[n + 1] ** 2n;
      const num = T * D ** 3n, den = 4n * y * psi[n] ** 3n;
      if (num % den !== 0n) throw new Error('несократимость нарушена при n = ' + n);
      out.push({ k: n, pt: [Q.raw(X, D * D), Q.raw(num / den, D ** 3n)] });
    }
    return out;
  }


  // ------------------------------------------------------------------
  //  Целые треугольники и задачи для урока
  // ------------------------------------------------------------------
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
  function isSquare(n) { const r = Math.round(Math.sqrt(n)); return r * r === n ? r : -1; }

  /**
   * Треугольники с целыми сторонами a <= b и третьей стороной c <= N:
   *   right — прямоугольные (c — гипотенуза), a^2 + b^2 = c^2;
   *   deg120 — угол 120° между a и b, c^2 = a^2 + ab + b^2;
   *   deg60 — угол 60° между a и b (a < b), c^2 = a^2 - ab + b^2.
   * Для каждого указан параметр t секущей, которая даёт эту точку коники.
   */
  const KINDS = {
    right: { name: 'прямоугольные', angle: 90, c2: (a, b) => a * a + b * b },
    deg120: { name: 'с углом 120°', angle: 120, c2: (a, b) => a * a + a * b + b * b },
    deg60: { name: 'с углом 60°', angle: 60, c2: (a, b) => a * a - a * b + b * b },
  };

  function triangles(kind, N, primitiveOnly) {
    const K = KINDS[kind], out = [];
    for (let a = 1; a <= N; a++) for (let b = a; b <= N; b++) {
      if (kind === 'deg60' && a === b) continue; // равносторонние неинтересны
      const c2 = K.c2(a, b); if (c2 > N * N) break;
      const c = isSquare(c2); if (c < 0) continue;
      const g = gcd(gcd(a, b), c);
      if (primitiveOnly && g > 1) continue;
      out.push({ kind, a, b, c, g, t: slopeFor(kind, a, b, c) });
    }
    out.sort((u, v) => u.c - v.c || u.a - v.a);
    return out;
  }

  // Точка (a/c, b/c) лежит на конике; t — угловой коэффициент секущей через
  // отмеченную точку: A(−1; 0) для окружности, (1; 0) для эллипсов.
  function slopeFor(kind, a, b, c) {
    if (kind === 'right') return new Q(b, a + c);
    return new Q(b, a - c);
  }

  /** Героновы треугольники: целые стороны a <= b <= c <= N и целая площадь. */
  function heronTriangles(N, primitiveOnly) {
    const out = [];
    for (let c = 1; c <= N; c++) for (let b = 1; b <= c; b++) for (let a = Math.max(1, c - b + 1); a <= b; a++) {
      const s16 = (a + b + c) * (-a + b + c) * (a - b + c) * (a + b - c);
      const r = isSquare(s16); if (r < 0 || r % 4) continue;
      const g = gcd(gcd(a, b), c);
      if (primitiveOnly && g > 1) continue;
      out.push({ kind: 'heron', a, b, c, g, S: r / 4, right: a * a + b * b === c * c });
    }
    return out;
  }

  /** Все точки с целыми координатами на окружности x^2 + y^2 = R^2. */
  function latticePoints(R) {
    const pts = [];
    for (let x = -R; x <= R; x++) {
      const y = isSquare(R * R - x * x); if (y < 0) continue;
      pts.push([x, y]); if (y) pts.push([x, -y]);
    }
    return pts.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  }

  // Детерминированный генератор случайных чисел: один и тот же номер набора
  // всегда даёт одни и те же задачи.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  const TASKS = {
    hyp: { title: 'Гипотенуза по катетам', kind: 'right',
      make: T => ({ q: `Катеты прямоугольного треугольника равны ${T.a} и ${T.b}. Найдите гипотенузу.`, ans: `${T.c}` }) },
    leg: { title: 'Катет по гипотенузе', kind: 'right',
      make: T => ({ q: `Гипотенуза прямоугольного треугольника равна ${T.c}, а один из катетов равен ${T.b}. Найдите другой катет.`, ans: `${T.a}` }) },
    area: { title: 'Площадь прямоугольного треугольника', kind: 'right',
      make: T => ({ q: `Гипотенуза прямоугольного треугольника равна ${T.c}, а один из катетов равен ${T.a}. Найдите площадь треугольника.`, ans: fmtHalf(T.a * T.b) }) },
    diag: { title: 'Диагональ прямоугольника', kind: 'right',
      make: T => ({ q: `Стороны прямоугольника равны ${T.a} и ${T.b}. Найдите его диагональ.`, ans: `${T.c}` }) },
    dist: { title: 'Расстояние между точками', kind: 'right',
      make: (T, r) => {
        const x1 = Math.floor(r() * 21) - 10, y1 = Math.floor(r() * 21) - 10;
        const sx = r() < .5 ? -1 : 1, sy = r() < .5 ? -1 : 1, sw = r() < .5;
        const dx = sw ? T.b : T.a, dy = sw ? T.a : T.b;
        return { q: `Найдите расстояние между точками A(${x1}; ${y1}) и B(${x1 + sx * dx}; ${y1 + sy * dy}).`, ans: `${T.c}` };
      } },
    cos120: { title: 'Теорема косинусов, 120°', kind: 'deg120',
      make: T => ({ q: `Две стороны треугольника равны ${T.a} и ${T.b}, а угол между ними равен 120°. Найдите третью сторону.`, ans: `${T.c}` }) },
    cos60: { title: 'Теорема косинусов, 60°', kind: 'deg60',
      make: T => ({ q: `Две стороны треугольника равны ${T.a} и ${T.b}, а угол между ними равен 60°. Найдите третью сторону.`, ans: `${T.c}` }) },
    heron: { title: 'Площадь по трём сторонам', kind: 'heron',
      make: T => ({ q: `Стороны треугольника равны ${T.a}, ${T.b} и ${T.c}. Найдите его площадь.`, ans: `${T.S}` }) },
    lattice: { title: 'Целые точки на окружности', kind: 'lattice',
      make: T => ({ q: `Найдите все точки с целыми координатами, лежащие на окружности x² + y² = ${T.R * T.R}.`,
        ans: `${T.pts.length} точек: ` + T.pts.map(p => `(${p[0]}; ${p[1]})`).join(', ') }) },
  };
  function fmtHalf(n) { return n % 2 ? `${(n - 1) / 2},5` : `${n / 2}`; }

  function pool(kind, N) {
    if (kind === 'heron') return heronTriangles(Math.min(N, 60), false).filter(T => !T.right);
    if (kind === 'lattice') {
      const out = [];
      for (let R = 5; R <= Math.min(N, 65); R++) {
        const pts = latticePoints(R);
        if (pts.length > 4 && pts.length <= 20) out.push({ R, pts });
      }
      return out;
    }
    return triangles(kind, N, false).filter(T => T.c >= 5);
  }

  /** Варианты самостоятельной работы: [{tasks: [{type, q, ans}]}]. */
  function worksheet(types, variants, N, seed) {
    const r = rng(seed), pools = {};
    const res = [];
    for (let v = 0; v < variants; v++) {
      const tasks = [];
      for (const type of types) {
        const def = TASKS[type];
        const P = pools[def.kind] || (pools[def.kind] = pool(def.kind, N));
        if (!P.length) continue;
        const T = P[Math.floor(r() * P.length)];
        tasks.push({ type, ...def.make(T, r) });
      }
      res.push({ tasks });
    }
    return res;
  }

  const api = { Q, bgcd, CONICS, CUBICS, O, secondPoint, slopes, approx,
    tripleFromPoint, addPoints, multiples, multiplesFast,
    KINDS, triangles, heronTriangles, latticePoints, TASKS, worksheet };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RP = api;
})(typeof window !== 'undefined' ? window : globalThis);
