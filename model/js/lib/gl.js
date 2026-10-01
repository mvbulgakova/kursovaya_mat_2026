// Маленькая обёртка над WebGL2: матрицы, шейдеры, буферы, камера-«орбита».
// Если WebGL2 недоступен, те же сцены рисуются на Canvas 2D (каркас и точки).

// ----------------------------------------------------------------- матрицы 4×4 (по столбцам)
export const mat4 = {
  mul(a, b) {
    const r = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      r[i * 4 + j] = s;
    }
    return r;
  },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  },
  lookAt(eye, center, up) {
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const z = norm(sub(eye, center)), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  },
};

/** Проекция точки: экранные координаты в пикселях холста и глубина. */
export function project(mvp, p, W, H) {
  const [x, y, z] = p;
  const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
  const cy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
  const cz = mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14];
  const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
  return [(cx / cw + 1) / 2 * W, (1 - cy / cw) / 2 * H, cz / cw];
}

// ----------------------------------------------------------------- камера
export class Orbit {
  constructor(canvas, { yaw = 0.7, pitch = 0.45, dist = 5.5, onChange }) {
    Object.assign(this, { yaw, pitch, dist, onChange });
    const pts = new Map();
    let last = null, pinch = null, moved = 0;
    this.moved = () => moved > 6;
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      last = [e.clientX, e.clientY]; moved = 0;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = [Math.hypot(a[0] - b[0], a[1] - b[1]), this.dist]; }
    });
    canvas.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        this.dist = Math.min(14, Math.max(2.2, pinch[1] * pinch[0] / (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1)));
        moved = 99;
      } else if (last) {
        const dx = e.clientX - last[0], dy = e.clientY - last[1];
        moved += Math.abs(dx) + Math.abs(dy);
        this.yaw -= dx * 0.008;
        this.pitch = Math.min(1.5, Math.max(-1.5, this.pitch + dy * 0.008));
        last = [e.clientX, e.clientY];
      }
      onChange?.();
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) last = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.dist = Math.min(14, Math.max(2.2, this.dist * Math.exp(e.deltaY * 0.001)));
      onChange?.();
    }, { passive: false });
  }
  eye() {
    const { yaw, pitch, dist } = this;
    return [dist * Math.cos(pitch) * Math.cos(yaw), dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch)];
  }
  mvp(aspect) {
    return mat4.mul(mat4.perspective(0.7, aspect, 0.1, 100), mat4.lookAt(this.eye(), [0, 0, 0], [0, 0, 1]));
  }
}

// ----------------------------------------------------------------- геометрия
/** Параметрическая поверхность f(u, v) → { pos, nrm, idx, lines }. */
export function surfaceMesh(f, [u0, u1], [v0, v1], nu, nv) {
  const pos = [], nrm = [], idx = [], lines = [];
  const P = (u, v) => f(u, v);
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = u0 + (u1 - u0) * i / nu, v = v0 + (v1 - v0) * j / nv, e = 1e-4;
    const p = P(u, v), pu = P(u + e, v), pv = P(u, v + e);
    const a = [pu[0] - p[0], pu[1] - p[1], pu[2] - p[2]], b = [pv[0] - p[0], pv[1] - p[1], pv[2] - p[2]];
    let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    pos.push(...p); nrm.push(...n);
  }
  const id = (i, j) => i * (nv + 1) + j;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) idx.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
  // каркас: каждая четвёртая линия сетки
  const step = 4;
  for (let i = 0; i <= nu; i += step) for (let j = 0; j < nv; j++) lines.push(P(u0 + (u1 - u0) * i / nu, v0 + (v1 - v0) * j / nv), P(u0 + (u1 - u0) * i / nu, v0 + (v1 - v0) * (j + 1) / nv));
  for (let j = 0; j <= nv; j += step) for (let i = 0; i < nu; i++) lines.push(P(u0 + (u1 - u0) * i / nu, v0 + (v1 - v0) * j / nv), P(u0 + (u1 - u0) * (i + 1) / nu, v0 + (v1 - v0) * j / nv));
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx), lines };
}

export function hexToRGB(hex) {
  const h = hex.replace('#', '').trim();
  const v = h.length === 3 ? h.split('').map(c => parseInt(c + c, 16)) : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return v.map(x => (isNaN(x) ? 0.5 : x / 255));
}

// ----------------------------------------------------------------- рендерер WebGL2
const VS_SURF = `#version 300 es
in vec3 p; in vec3 n; uniform mat4 mvp; uniform vec3 eye; out vec3 vn; out vec3 vv;
void main(){ vn = n; vv = normalize(eye - p); gl_Position = mvp * vec4(p, 1.0); }`;
const FS_SURF = `#version 300 es
precision mediump float; in vec3 vn; in vec3 vv; uniform vec3 color; uniform float alpha; out vec4 o;
void main(){
  vec3 n = normalize(vn); if (dot(n, vv) < 0.0) n = -n;
  vec3 l = normalize(vec3(0.4, 0.3, 1.0));
  float d = max(dot(n, l), 0.0), rim = pow(1.0 - max(dot(n, vv), 0.0), 2.0);
  float s = pow(max(dot(reflect(-l, n), vv), 0.0), 24.0);
  o = vec4(color * (0.35 + 0.65 * d) + vec3(0.5) * s + color * rim * 0.5, alpha);
}`;
const VS_FLAT = `#version 300 es
in vec3 p; uniform mat4 mvp; uniform float size; void main(){ gl_Position = mvp * vec4(p, 1.0); gl_PointSize = size / gl_Position.w; }`;
const FS_FLAT = `#version 300 es
precision mediump float; uniform vec3 color; uniform float alpha; uniform bool round; out vec4 o;
void main(){ if (round && length(gl_PointCoord - 0.5) > 0.5) discard; o = vec4(color, alpha); }`;

function program(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

/**
 * Рисует сцену: { surface: mesh, surfColor, lines: [{ segs: [[p, q]...], color, alpha }],
 * points: [{ pts: [[x,y,z]...], color, size }] }.
 */
export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false });
  if (!gl) return createRenderer2D(canvas);
  const surf = program(gl, VS_SURF, FS_SURF), flat = program(gl, VS_FLAT, FS_FLAT);
  const vao = gl.createVertexArray(), buf = gl.createBuffer(), nbuf = gl.createBuffer(), ibuf = gl.createBuffer();
  let meshKey = null, nIdx = 0;
  const U = (p, name) => gl.getUniformLocation(p, name);
  function setMesh(mesh) {
    if (meshKey === mesh) return;
    meshKey = mesh;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(surf, 'p')); gl.vertexAttribPointer(gl.getAttribLocation(surf, 'p'), 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, nbuf); gl.bufferData(gl.ARRAY_BUFFER, mesh.nrm, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(surf, 'n')); gl.vertexAttribPointer(gl.getAttribLocation(surf, 'n'), 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    nIdx = mesh.idx.length;
    gl.bindVertexArray(null);
  }
  const fbuf = gl.createBuffer(), fvao = gl.createVertexArray();
  function flatDraw(mode, data, color, alpha, size, mvp) {
    gl.useProgram(flat);
    gl.bindVertexArray(fvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, fbuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const loc = gl.getAttribLocation(flat, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(U(flat, 'mvp'), false, mvp);
    gl.uniform3fv(U(flat, 'color'), color); gl.uniform1f(U(flat, 'alpha'), alpha);
    gl.uniform1f(U(flat, 'size'), size); gl.uniform1i(U(flat, 'round'), mode === gl.POINTS ? 1 : 0);
    gl.drawArrays(mode, 0, data.length / 3);
  }
  return {
    kind: 'webgl2',
    draw(scene, orbit, bg) {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H);
      gl.clearColor(...bg, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const mvp = orbit.mvp(W / H);
      // непрозрачное: линии и точки
      for (const L of scene.lines || []) flatDraw(gl.LINES, new Float32Array(L.segs.flat(2)), L.color, L.alpha ?? 1, 1, mvp);
      for (const P of scene.points || []) if (P.pts.length) flatDraw(gl.POINTS, new Float32Array(P.pts.flat()), P.color, 1, P.size * dpr * 11, mvp);
      // полупрозрачная поверхность поверх, без записи глубины
      if (scene.surface) {
        setMesh(scene.surface);
        gl.useProgram(surf); gl.bindVertexArray(vao);
        gl.uniformMatrix4fv(U(surf, 'mvp'), false, mvp);
        gl.uniform3fv(U(surf, 'eye'), orbit.eye());
        gl.uniform3fv(U(surf, 'color'), scene.surfColor); gl.uniform1f(U(surf, 'alpha'), 0.38);
        gl.depthMask(false);
        gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
        gl.depthMask(true);
        gl.bindVertexArray(null);
      }
      return mvp;
    },
  };
}

function createRenderer2D(canvas) {
  const ctx = canvas.getContext('2d');
  const rgb = c => `rgb(${c.map(x => Math.round(x * 255)).join(',')})`;
  return {
    kind: 'canvas2d',
    draw(scene, orbit, bg) {
      const W = canvas.width = canvas.clientWidth, H = canvas.height = canvas.clientHeight;
      ctx.fillStyle = rgb(bg); ctx.fillRect(0, 0, W, H);
      const mvp = orbit.mvp(W / H);
      const pr = p => project(mvp, p, W, H);
      if (scene.surface) {
        ctx.strokeStyle = rgb(scene.surfColor); ctx.globalAlpha = 0.35; ctx.beginPath();
        for (let i = 0; i < scene.surface.lines.length; i += 2) {
          const a = pr(scene.surface.lines[i]), b = pr(scene.surface.lines[i + 1]);
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (const L of scene.lines || []) {
        ctx.strokeStyle = rgb(L.color); ctx.globalAlpha = L.alpha ?? 1; ctx.beginPath();
        for (const [p, q] of L.segs) { const a = pr(p), b = pr(q); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (const P of scene.points || []) {
        ctx.fillStyle = rgb(P.color);
        for (const p of P.pts) { const a = pr(p); ctx.beginPath(); ctx.arc(a[0], a[1], P.size * 1.2, 0, 7); ctx.fill(); }
      }
      return mvp;
    },
  };
}
