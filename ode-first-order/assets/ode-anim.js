/* ODE lesson animation engine
   Canvas 2D plots with timeline animations (direction fields, isocline ticks,
   RK4 solution tracing, envelope families) plus a minimal rotating 3D surface
   renderer. No dependencies. */

(function () {
  'use strict';

  const COLORS = {
    teal: '#2dd4d4', pink: '#ff4db8', wine: '#ff5a7a', purple: '#a78bfa',
    amber: '#fbbf24', green: '#34d399', blue: '#60a5fa', white: '#e5e7eb',
    grid: 'rgba(255,255,255,0.07)', axis: 'rgba(255,255,255,0.30)',
    tick: 'rgba(229,231,235,0.55)'
  };

  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = t => Math.max(0, Math.min(1, t));

  /* ---------------- Plot: world coordinates on a canvas ---------------- */

  class Plot {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      Object.assign(this, { xmin: -5, xmax: 5, ymin: -5, ymax: 5, pad: 30, xtick: 1, ytick: 1 }, opts);
      this.resize();
    }
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = this.cv.clientWidth || 480, h = this.cv.clientHeight || 360;
      this.cv.width = w * dpr;
      this.cv.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
    }
    X(x) { return this.pad + (x - this.xmin) / (this.xmax - this.xmin) * (this.w - 2 * this.pad); }
    Y(y) { return this.h - this.pad - (y - this.ymin) / (this.ymax - this.ymin) * (this.h - 2 * this.pad); }
    clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
    axes() {
      const c = this.ctx;
      c.save();
      c.lineWidth = 1;
      c.strokeStyle = COLORS.grid;
      c.beginPath();
      for (let x = Math.ceil(this.xmin / this.xtick) * this.xtick; x <= this.xmax + 1e-9; x += this.xtick) {
        c.moveTo(this.X(x), this.Y(this.ymin));
        c.lineTo(this.X(x), this.Y(this.ymax));
      }
      for (let y = Math.ceil(this.ymin / this.ytick) * this.ytick; y <= this.ymax + 1e-9; y += this.ytick) {
        c.moveTo(this.X(this.xmin), this.Y(y));
        c.lineTo(this.X(this.xmax), this.Y(y));
      }
      c.stroke();
      c.strokeStyle = COLORS.axis;
      c.beginPath();
      if (this.ymin < 0 && this.ymax > 0) { c.moveTo(this.X(this.xmin), this.Y(0)); c.lineTo(this.X(this.xmax), this.Y(0)); }
      if (this.xmin < 0 && this.xmax > 0) { c.moveTo(this.X(0), this.Y(this.ymin)); c.lineTo(this.X(0), this.Y(this.ymax)); }
      c.stroke();
      c.fillStyle = COLORS.tick;
      c.font = '11px system-ui, sans-serif';
      c.textAlign = 'center';
      const lx = Math.max(this.xtick, Math.ceil((this.xmax - this.xmin) / 8 / this.xtick) * this.xtick);
      for (let x = Math.ceil(this.xmin / lx) * lx; x <= this.xmax + 1e-9; x += lx) {
        if (Math.abs(x) > 1e-9) c.fillText(this.fmt(x), this.X(x), this.h - this.pad + 14);
      }
      c.textAlign = 'right';
      const ly = Math.max(this.ytick, Math.ceil((this.ymax - this.ymin) / 8 / this.ytick) * this.ytick);
      for (let y = Math.ceil(this.ymin / ly) * ly; y <= this.ymax + 1e-9; y += ly) {
        if (Math.abs(y) > 1e-9) c.fillText(this.fmt(y), this.pad - 5, this.Y(y) + 4);
      }
      c.restore();
    }
    fmt(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1); }
    label(text, x, y, color, align) {
      const c = this.ctx;
      c.save();
      c.fillStyle = color || COLORS.white;
      c.font = '600 12.5px system-ui, sans-serif';
      c.textAlign = align || 'left';
      c.fillText(text, this.X(x), this.Y(y));
      c.restore();
    }
    /* draw a portion (progress 0..1) of a parametric curve t -> [x,y] */
    param(fn, t0, t1, opts) {
      const o = Object.assign({ n: 240, color: COLORS.white, width: 2, progress: 1, dash: null, head: false }, opts);
      if (o.progress <= 0) return;
      const c = this.ctx, m = Math.max(2, Math.floor(o.n * clamp01(o.progress)));
      c.save();
      c.strokeStyle = o.color; c.lineWidth = o.width; c.lineJoin = 'round';
      if (o.dash) c.setLineDash(o.dash);
      c.beginPath();
      let last = null;
      for (let i = 0; i <= m; i++) {
        const t = t0 + (t1 - t0) * (i / o.n);
        const p = fn(t);
        if (!p || !isFinite(p[0]) || !isFinite(p[1])) { last = null; continue; }
        const sx = this.X(p[0]), sy = this.Y(p[1]);
        if (sy < -2000 || sy > 3000) { last = null; continue; }
        if (last === null) c.moveTo(sx, sy); else c.lineTo(sx, sy);
        last = [sx, sy];
      }
      c.stroke();
      if (o.head && last && o.progress < 1) {
        c.fillStyle = o.color;
        c.beginPath(); c.arc(last[0], last[1], 4, 0, 2 * Math.PI); c.fill();
      }
      c.restore();
    }
    /* draw a portion of a polyline of world points */
    path(pts, opts) {
      const o = Object.assign({ color: COLORS.white, width: 2.4, progress: 1, head: false }, opts);
      if (o.progress <= 0 || pts.length < 2) return;
      const c = this.ctx, m = Math.max(1, Math.floor((pts.length - 1) * clamp01(o.progress)));
      c.save();
      c.strokeStyle = o.color; c.lineWidth = o.width; c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(this.X(pts[0][0]), this.Y(pts[0][1]));
      for (let i = 1; i <= m; i++) c.lineTo(this.X(pts[i][0]), this.Y(pts[i][1]));
      c.stroke();
      if (o.head && o.progress < 1) {
        const p = pts[m];
        c.fillStyle = o.color;
        c.beginPath(); c.arc(this.X(p[0]), this.Y(p[1]), 4, 0, 2 * Math.PI); c.fill();
      }
      c.restore();
    }
    dot(x, y, color, r) {
      const c = this.ctx;
      c.save();
      c.fillStyle = color || COLORS.white;
      c.beginPath(); c.arc(this.X(x), this.Y(y), r || 4.5, 0, 2 * Math.PI); c.fill();
      c.restore();
    }
    /* short slope segment (direction element) centred at world (x,y) */
    tick(x, y, slope, color, len, arrowHead) {
      const c = this.ctx;
      const ang = Math.atan(slope);            /* screen y is flipped */
      const L = (len || 14) / 2;
      const dx = Math.cos(ang) * L, dy = Math.sin(ang) * L;
      const sx = this.X(x), sy = this.Y(y);
      c.save();
      c.strokeStyle = color || COLORS.teal;
      c.fillStyle = c.strokeStyle;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(sx - dx, sy + dy);
      c.lineTo(sx + dx, sy - dy);
      c.stroke();
      if (arrowHead) {
        const hx = sx + dx, hy = sy - dy;
        c.translate(hx, hy); c.rotate(-ang);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-5, -2.6); c.lineTo(-5, 2.6); c.closePath(); c.fill();
      }
      c.restore();
    }
    /* place n slope ticks along a parametric curve */
    ticksOnCurve(fn, t0, t1, n, slope, color, progress, arrowHead) {
      const m = Math.floor(n * clamp01(progress === undefined ? 1 : progress));
      for (let i = 0; i < m; i++) {
        const t = t0 + (t1 - t0) * ((i + 0.5) / n);
        const p = fn(t);
        if (p && isFinite(p[0]) && isFinite(p[1]) &&
            p[0] > this.xmin && p[0] < this.xmax && p[1] > this.ymin && p[1] < this.ymax) {
          this.tick(p[0], p[1], slope, color, 15, arrowHead);
        }
      }
    }
  }

  /* ---------------- direction fields + solutions ---------------- */

  function fieldPoints(plot, f, nx, ny) {
    const pts = [];
    nx = nx || 16; ny = ny || 12;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const x = plot.xmin + (i + 0.5) / nx * (plot.xmax - plot.xmin);
        const y = plot.ymin + (j + 0.5) / ny * (plot.ymax - plot.ymin);
        const s = f(x, y);
        if (isFinite(s)) pts.push({ x, y, s });
      }
    }
    /* reveal order: sweep by slope value, so isocline structure is visible */
    pts.sort((a, b) => Math.atan(a.s) - Math.atan(b.s));
    return pts;
  }

  function drawField(plot, pts, progress, color, arrowHead) {
    const m = Math.floor(pts.length * clamp01(progress));
    for (let i = 0; i < m; i++) plot.tick(pts[i].x, pts[i].y, pts[i].s, color, 13, arrowHead);
  }

  function rk4Path(f, x0, y0, dir, xEnd, opts) {
    const o = Object.assign({ dt: 0.02, ybound: 1e3 }, opts);
    const pts = [[x0, y0]];
    let x = x0, y = y0;
    const h = o.dt * dir;
    for (let i = 0; i < 20000; i++) {
      const k1 = f(x, y);
      const k2 = f(x + h / 2, y + h / 2 * k1);
      const k3 = f(x + h / 2, y + h / 2 * k2);
      const k4 = f(x + h, y + h * k3);
      if (![k1, k2, k3, k4].every(isFinite)) break;
      y += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
      x += h;
      if (!isFinite(y) || Math.abs(y) > o.ybound) break;
      pts.push([x, y]);
      if (dir > 0 ? x >= xEnd : x <= xEnd) break;
    }
    return pts;
  }

  /* solution through (x0,y0) traced both ways, ordered left -> right */
  function solutionPath(plot, f, x0, y0, opts) {
    const back = rk4Path(f, x0, y0, -1, plot.xmin - 0.5, opts).slice(1).reverse();
    const fwd = rk4Path(f, x0, y0, 1, plot.xmax + 0.5, opts);
    return back.concat(fwd);
  }

  /* ---------------- Timeline: phased looping animation ---------------- */

  class Timeline {
    /* phases: [{d: ms, draw(p)}]; background() drawn every frame first.
       Restarts on click; starts when scrolled into view; loops after holdMs. */
    constructor(canvas, background, phases, opts) {
      this.cv = canvas;
      this.bg = background;
      this.phases = phases;
      this.o = Object.assign({ holdMs: 2600, loop: true }, opts);
      this.total = phases.reduce((s, p) => s + p.d, 0);
      this.t0 = null;
      this.running = false;
      canvas.title = 'Click to replay';
      canvas.addEventListener('click', () => { this.t0 = performance.now(); });
      const io = new IntersectionObserver(es => {
        es.forEach(e => { if (e.isIntersecting) this.start(); });
      }, { threshold: 0.25 });
      io.observe(canvas);
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.t0 = performance.now();
      const frame = now => {
        let t = now - this.t0;
        if (this.o.loop) {
          const cycle = this.total + this.o.holdMs;
          t = t % cycle;
        }
        this.bg();
        let acc = 0;
        for (const ph of this.phases) {
          const local = (t - acc) / ph.d;
          if (local <= 0) break;
          ph.draw(easeInOut(clamp01(local)));
          acc += ph.d;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }

  /* ---------------- minimal 3D surface renderer ---------------- */

  class Surface3D {
    constructor(canvas, f, opts) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.f = f;
      this.o = Object.assign({
        xmin: -2, xmax: 2, ymin: -2, ymax: 2, n: 34,
        zmin: null, zmax: null, tilt: 0.42, spin: 0.00022,
        levelCurves: [], stops: ['#3b1f6e', '#169999', '#ff4db8']
      }, opts);
      this.resize();
      this.mesh();
      canvas.title = 'Rotating surface';
      const io = new IntersectionObserver(es => {
        es.forEach(e => { if (e.isIntersecting) this.start(); });
      }, { threshold: 0.25 });
      io.observe(canvas);
    }
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = this.cv.clientWidth || 480, h = this.cv.clientHeight || 360;
      this.cv.width = w * dpr; this.cv.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
    }
    mesh() {
      const { xmin, xmax, ymin, ymax, n } = this.o;
      this.grid = [];
      let zmin = Infinity, zmax = -Infinity;
      for (let i = 0; i <= n; i++) {
        const row = [];
        for (let j = 0; j <= n; j++) {
          const x = xmin + (xmax - xmin) * i / n;
          const y = ymin + (ymax - ymin) * j / n;
          let z = this.f(x, y);
          row.push([x, y, z]);
          if (isFinite(z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
        }
        this.grid.push(row);
      }
      if (this.o.zmin !== null) zmin = this.o.zmin;
      if (this.o.zmax !== null) zmax = this.o.zmax;
      this.zmin = zmin; this.zmax = zmax;
    }
    colorAt(t) {
      const stops = this.o.stops.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
      const seg = t * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(seg));
      const u = seg - i;
      const rgb = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * u));
      return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }
    project(x, y, z, ang) {
      const { xmin, xmax, ymin, ymax } = this.o;
      const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
      const nx = (x - cx) / (xmax - xmin), ny = (y - cy) / (ymax - ymin);
      const nz = (Math.min(Math.max(z, this.zmin), this.zmax) - this.zmin) / (this.zmax - this.zmin) - 0.5;
      const rx = nx * Math.cos(ang) - ny * Math.sin(ang);
      const ry = nx * Math.sin(ang) + ny * Math.cos(ang);
      const t = this.o.tilt;
      const sx = rx;
      const sy = -nz * (1 - t) + ry * t;
      const depth = ry * (1 - t) + nz * 0.2;
      const S = Math.min(this.w, this.h) * 0.78;
      return [this.w / 2 + sx * S, this.h / 2 + sy * S * 0.95, depth];
    }
    start() {
      if (this.running) return;
      this.running = true;
      const frame = now => {
        const ang = now * this.o.spin;
        const c = this.ctx, n = this.o.n;
        c.clearRect(0, 0, this.w, this.h);
        const quads = [];
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const q = [this.grid[i][j], this.grid[i + 1][j], this.grid[i + 1][j + 1], this.grid[i][j + 1]];
            if (!q.every(p => isFinite(p[2]))) continue;
            const pts = q.map(p => this.project(p[0], p[1], p[2], ang));
            const depth = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
            const zAvg = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4;
            quads.push({ pts, depth, zAvg });
          }
        }
        quads.sort((a, b) => a.depth - b.depth);
        for (const q of quads) {
          const t = clamp01((q.zAvg - this.zmin) / (this.zmax - this.zmin));
          c.fillStyle = this.colorAt(t);
          c.strokeStyle = 'rgba(0,0,0,0.25)';
          c.lineWidth = 0.5;
          c.globalAlpha = 0.92;
          c.beginPath();
          c.moveTo(q.pts[0][0], q.pts[0][1]);
          for (let k = 1; k < 4; k++) c.lineTo(q.pts[k][0], q.pts[k][1]);
          c.closePath(); c.fill(); c.stroke();
        }
        c.globalAlpha = 1;
        /* bright level curves on top of the surface */
        for (const lc of this.o.levelCurves) {
          c.strokeStyle = lc.color || COLORS.white;
          c.lineWidth = 2.2;
          c.beginPath();
          let first = true;
          for (let k = 0; k <= 200; k++) {
            const t = lc.t0 + (lc.t1 - lc.t0) * k / 200;
            const p = lc.fn(t);
            if (!p || !p.every(isFinite)) { first = true; continue; }
            const s = this.project(p[0], p[1], p[2] + (this.zmax - this.zmin) * 0.012, ang);
            if (first) { c.moveTo(s[0], s[1]); first = false; } else c.lineTo(s[0], s[1]);
          }
          c.stroke();
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }

  /* ---------------- exports ---------------- */

  window.ODE = {
    COLORS, Plot, Timeline, Surface3D,
    fieldPoints, drawField, rk4Path, solutionPath,
    ease: easeInOut, clamp01
  };
})();
