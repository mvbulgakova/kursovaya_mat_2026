// Чертёж треугольника в SVG. Вершина C в начале координат, CA = b по оси,
// CB = a под углом C (из теоремы косинусов), AB = c.

const fmtNum = x => (Number.isInteger(x) ? String(x) : String(+x.toFixed(2)).replace('.', ','));

/**
 * t: { a, b, c } — длины сторон (числа);
 * opt.labels: подписи сторон { a, b, c } (по умолчанию сами длины; null — без подписи);
 * opt.angle: подпись угла C (например, '120°'), opt.right: отметить прямой угол;
 * opt.height: провести высоту из B на CA с подписью;
 * opt.w, opt.h: размер области рисования.
 */
export function triangleSVG(t, opt = {}) {
  const W = opt.w || 400, H = opt.h || 300, pad = 42;
  const { a, b, c } = t;
  const cosC = (a * a + b * b - c * c) / (2 * a * b);
  const C = Math.acos(Math.max(-1, Math.min(1, cosC)));
  const P = [[0, 0], [b, 0], [a * Math.cos(C), a * Math.sin(C)]]; // C, A, B
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys);
  const s = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / maxY);
  const ox = pad + (W - 2 * pad - (maxX - minX) * s) / 2;
  const X = x => ox + (x - minX) * s, Y = y => H - pad - y * s;
  const ink = 'var(--ink, #1d1d1f)', acc = 'var(--accent, #b4442c)', acc2 = 'var(--accent2, #2b5c8a)';
  const L = opt.labels || {};
  const lab = (k, def) => (k in L ? L[k] : fmtNum(def));
  // подпись стороны — снаружи треугольника, по нормали к стороне
  const side = (i, j, text) => {
    if (text === null || text === undefined) return '';
    const [x1, y1] = [X(P[i][0]), Y(P[i][1])], [x2, y2] = [X(P[j][0]), Y(P[j][1])];
    const cx = (X(P[0][0]) + X(P[1][0]) + X(P[2][0])) / 3, cy = (Y(P[0][1]) + Y(P[1][1]) + Y(P[2][1])) / 3;
    let nx = y2 - y1, ny = x1 - x2; const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
    return `<text x="${(mx + nx * 18).toFixed(1)}" y="${(my + ny * 18 + 6).toFixed(1)}" text-anchor="middle" font-size="18" fill="${ink}" font-family="Georgia, serif">${text}</text>`;
  };
  const pts = P.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
  let extra = '';
  const [cx0, cy0] = [X(0), Y(0)];
  if (opt.right || Math.abs(cosC) < 1e-12 && opt.right !== false) {
    const u = 14, ex = Math.cos(C), ey = Math.sin(C);
    extra += `<path d="M${cx0 + u} ${cy0} L${cx0 + u + u * ex} ${cy0 - u * ey} L${cx0 + u * ex} ${cy0 - u * ey}" fill="none" stroke="${acc}"/>`;
  } else if (opt.angle) {
    const r = 26, ex = cx0 + r * Math.cos(C), ey = cy0 - r * Math.sin(C);
    extra += `<path d="M${cx0 + r} ${cy0} A${r} ${r} 0 0 0 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${acc}"/>`
      // подпись угла — снаружи треугольника, против биссектрисы
      + `<text x="${(cx0 - 14 * Math.cos(C / 2)).toFixed(1)}" y="${(cy0 + 14 * Math.sin(C / 2) + 12).toFixed(1)}" text-anchor="end" font-size="15" fill="${acc}" font-family="Georgia, serif">${opt.angle}</text>`;
  }
  if (opt.height) {
    const hx = P[2][0], hy = P[2][1];
    extra += `<line x1="${X(hx)}" y1="${Y(hy)}" x2="${X(hx)}" y2="${Y(0)}" stroke="${acc2}" stroke-dasharray="5 4"/>`;
    if (hx < minX + 1e-9 || hx > b) // основание высоты вне стороны CA — продолжаем её пунктиром
      extra += `<line x1="${X(Math.min(0, hx))}" y1="${Y(0)}" x2="${X(Math.max(b, hx))}" y2="${Y(0)}" stroke="${acc2}" stroke-dasharray="2 4"/>`;
    const right = X(hx) > (X(0) + X(b)) / 2;
    extra += `<text x="${X(hx) + (right ? -8 : 8)}" y="${(Y(hy) + Y(0)) / 2}" text-anchor="${right ? 'end' : 'start'}" font-size="16" fill="${acc2}" font-family="Georgia, serif">${opt.height}</text>`;
  }
  return `<svg class="fig" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="треугольник">`
    + `<polygon points="${pts}" fill="var(--fill, #f3e6e1)" stroke="${ink}" stroke-width="2"/>` + extra
    + side(0, 1, lab('b', b)) + side(0, 2, lab('a', a)) + side(1, 2, lab('c', c)) + '</svg>';
}

/** Отрезок на клетчатой плоскости между двумя точками (для задач на координаты). */
export function segmentSVG(A, B, opt = {}) {
  const W = opt.w || 300, H = opt.h || 300, pad = 30;
  const minX = Math.min(A[0], B[0], 0), maxX = Math.max(A[0], B[0], 0);
  const minY = Math.min(A[1], B[1], 0), maxY = Math.max(A[1], B[1], 0);
  const s = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1));
  const X = x => pad + (x - minX) * s, Y = y => H - pad - (y - minY) * s;
  const ink = 'var(--ink, #1d1d1f)', acc = 'var(--accent, #b4442c)', mut = 'var(--muted, #888)';
  let g = `<line x1="${X(minX)}" y1="${Y(0)}" x2="${X(maxX)}" y2="${Y(0)}" stroke="${mut}"/>`
    + `<line x1="${X(0)}" y1="${Y(minY)}" x2="${X(0)}" y2="${Y(maxY)}" stroke="${mut}"/>`
    + `<line x1="${X(A[0])}" y1="${Y(A[1])}" x2="${X(B[0])}" y2="${Y(A[1])}" stroke="${mut}" stroke-dasharray="4 4"/>`
    + `<line x1="${X(B[0])}" y1="${Y(A[1])}" x2="${X(B[0])}" y2="${Y(B[1])}" stroke="${mut}" stroke-dasharray="4 4"/>`
    + `<line x1="${X(A[0])}" y1="${Y(A[1])}" x2="${X(B[0])}" y2="${Y(B[1])}" stroke="${acc}" stroke-width="2.5"/>`;
  for (const [P, name] of [[A, 'A'], [B, 'B']])
    g += `<circle cx="${X(P[0])}" cy="${Y(P[1])}" r="4" fill="${ink}"/><text x="${X(P[0]) + 6}" y="${Y(P[1]) - 6}" font-size="16" fill="${ink}" font-family="Georgia, serif">${name}</text>`;
  g += `<text x="${X(0) + 4}" y="${Y(0) + 15}" font-size="12" fill="${mut}">0</text>`;
  return `<svg class="fig" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="отрезок AB">${g}</svg>`;
}

/** Прямоугольный параллелепипед a × b × c с диагональю (кабинетная проекция). */
export function boxSVG(a, b, c, opt = {}) {
  const W = opt.w || 320, H = opt.h || 260, pad = 30;
  const k = 0.45, ang = Math.PI / 6; // сокращение и угол для глубины
  const dx = b * k * Math.cos(ang), dy = b * k * Math.sin(ang);
  const s = Math.min((W - 2 * pad) / (a + dx), (H - 2 * pad) / (c + dy));
  const X = x => pad + x * s, Y = y => H - pad - y * s;
  const v = (x, y, z) => [X(x + z * k * Math.cos(ang)), Y(y + z * k * Math.sin(ang))]; // x — длина, y — высота, z — глубина
  const ink = 'var(--ink, #1d1d1f)', acc = 'var(--accent, #b4442c)', mut = 'var(--muted, #888)';
  const L = opt.labels || {};
  const seg = (p, q, col = ink, dash = '') => `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${col}" stroke-width="${col === acc ? 2.5 : 1.5}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  const V = {};
  for (const x of [0, a]) for (const y of [0, c]) for (const z of [0, b]) V[`${x ? 1 : 0}${y ? 1 : 0}${z ? 1 : 0}`] = v(x, y, z);
  let g = '';
  // невидимые рёбра — пунктиром
  g += seg(V['000'], V['001'], mut, '4 4') + seg(V['001'], V['101'], mut, '4 4') + seg(V['001'], V['011'], mut, '4 4');
  const vis = [['000', '100'], ['000', '010'], ['100', '110'], ['010', '110'], ['100', '101'], ['110', '111'],
    ['010', '011'], ['011', '111'], ['101', '111']];
  for (const [p, q] of vis) g += seg(V[p], V[q]);
  g += seg(V['000'], V['111'], acc);
  const t = (p, text, dx2 = 0, dy2 = 0) => text == null ? '' : `<text x="${p[0] + dx2}" y="${p[1] + dy2}" font-size="16" text-anchor="middle" fill="${ink}" font-family="Georgia, serif">${text}</text>`;
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  g += t(mid(V['000'], V['100']), 'a' in L ? L.a : a, 0, 20) + t(mid(V['100'], V['101']), 'b' in L ? L.b : b, 18, 10)
    + t(mid(V['000'], V['010']), 'c' in L ? L.c : c, -16, 5) + t(mid(V['000'], V['111']), 'd' in L ? L.d : '', -14, -14);
  return `<svg class="fig" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="параллелепипед">${g}</svg>`;
}
