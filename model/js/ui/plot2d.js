// Координатная плоскость на canvas: оси, сетка, кривые F(x, y) = 0, прямые, точки.
import { css } from '../util.js';

export function View(canvas, span, cx = 0, cy = 0) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const v = {
    ctx, W, H, span, cx, cy,
    X: x => W / 2 + (x - v.cx) / v.span * W / 2,
    Y: y => H / 2 - (y - v.cy) / v.span * H / 2,
    inv(px, py) { return [v.cx + (px - W / 2) / (W / 2) * v.span, v.cy - (py - H / 2) / (H / 2) * v.span]; },
    axes() {
      ctx.fillStyle = css('--panel'); ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1;
      const step = v.span > 4 ? 1 : 0.5;
      for (let g = Math.ceil((v.cx - v.span) / step) * step; g <= v.cx + v.span; g += step) {
        ctx.beginPath(); ctx.moveTo(v.X(g), 0); ctx.lineTo(v.X(g), H); ctx.stroke();
      }
      for (let g = Math.ceil((v.cy - v.span) / step) * step; g <= v.cy + v.span; g += step) {
        ctx.beginPath(); ctx.moveTo(0, v.Y(g)); ctx.lineTo(W, v.Y(g)); ctx.stroke();
      }
      ctx.strokeStyle = css('--muted'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, v.Y(0)); ctx.lineTo(W, v.Y(0));
      ctx.moveTo(v.X(0), 0); ctx.lineTo(v.X(0), H); ctx.stroke();
    },
    // линия уровня F = 0 (марширующие квадраты)
    curve(F, color, width = 2.5) {
      const N = 320, dx = 2 * v.span / N;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      const val = [];
      for (let i = 0; i <= N; i++) {
        val.push([]);
        for (let j = 0; j <= N; j++) val[i].push(F(v.cx - v.span + i * dx, v.cy - v.span + j * dx));
      }
      const lerp = (a, b) => a / (a - b);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = v.cx - v.span + i * dx, y = v.cy - v.span + j * dx;
        const c = [val[i][j], val[i + 1][j], val[i + 1][j + 1], val[i][j + 1]];
        const pts = [];
        const e = [[0, 1, s => [x + s * dx, y]], [1, 2, s => [x + dx, y + s * dx]],
                   [3, 2, s => [x + s * dx, y + dx]], [0, 3, s => [x, y + s * dx]]];
        for (const [a, b, p] of e) if ((c[a] > 0) !== (c[b] > 0)) pts.push(p(lerp(c[a], c[b])));
        for (let k = 0; k + 1 < pts.length; k += 2) {
          ctx.moveTo(v.X(pts[k][0]), v.Y(pts[k][1])); ctx.lineTo(v.X(pts[k + 1][0]), v.Y(pts[k + 1][1]));
        }
      }
      ctx.stroke();
    },
    // дуга окружности x² + y² = r² от угла a до b (для игры)
    arc(r, a, b, color, width = 10) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.arc(v.X(0), v.Y(0), r / v.span * W / 2, -b, -a); ctx.stroke(); ctx.lineCap = 'butt';
    },
    line(x0, y0, t, color, dash = [], width = 1.5) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
      if (t === null) { ctx.moveTo(v.X(x0), 0); ctx.lineTo(v.X(x0), H); }
      else { const L = 3 * v.span; ctx.moveTo(v.X(x0 - L), v.Y(y0 - t * L)); ctx.lineTo(v.X(x0 + L), v.Y(y0 + t * L)); }
      ctx.stroke(); ctx.setLineDash([]);
    },
    segment(x0, y0, x1, y1, color, width = 1.5) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      ctx.moveTo(v.X(x0), v.Y(y0)); ctx.lineTo(v.X(x1), v.Y(y1)); ctx.stroke();
    },
    dot(x, y, color, r = 5, label) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(v.X(x), v.Y(y), r, 0, 7); ctx.fill();
      if (label) {
        ctx.font = '24px Georgia, serif'; ctx.fillStyle = css('--ink');
        ctx.fillText(label, v.X(x) + 8, v.Y(y) - 8);
      }
    },
    ring(x, y, color, r = 12, width = 3) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(v.X(x), v.Y(y), r, 0, 7); ctx.stroke();
    },
  };
  return v;
}

/** Координаты касания или щелчка в системе координат чертежа. */
export function canvasPoint(v, e) {
  const r = e.target.getBoundingClientRect();
  return v.inv((e.clientX - r.left) / r.width * v.W, (e.clientY - r.top) / r.height * v.H);
}
