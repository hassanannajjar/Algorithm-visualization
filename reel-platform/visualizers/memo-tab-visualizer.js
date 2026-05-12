/**
 * Reel visualizer: Memoization (top-down recursion tree with cache) vs Tabulation (bottom-up table).
 *
 * Shared recurrence — climb-stairs flavour to keep indices clean:
 *   f(1) = 1, f(2) = 2, f(n) = f(n-1) + f(n-2)   →   f(9) = 55
 *
 * Both panels are driven by event streams and paced so they finish at the same time.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var N = 9;
  var animationSpeed = 300;
  var isAnimating = false;
  var memVis = null;
  var tabVis = null;
  var animFrameId = null;

  var EXPECTED_MEMO_CALLS = 0;
  var EXPECTED_MEMO_HITS = 0;
  var EXPECTED_TAB_WRITES = N;

  function baseValue(k) {
    if (k === 1) return 1;
    if (k === 2) return 2;
    return null;
  }

  function buildTree(n, depth, path) {
    depth = depth || 0;
    path = path || [];
    var node = {
      n: n,
      depth: depth,
      id: path.join('-') || 'root',
      path: path.slice(),
      children: [],
      result: null,
      px: 0,
      py: 0
    };
    var base = baseValue(n);
    if (base !== null) {
      node.result = base;
      return node;
    }
    node.children.push(buildTree(n - 1, depth + 1, path.concat(['L'])));
    node.children.push(buildTree(n - 2, depth + 1, path.concat(['R'])));
    return node;
  }

  function buildMemoEvents(root) {
    var memo = {};
    var events = [];
    var callCount = 0;
    var hitCount = 0;

    function walk(node) {
      events.push({ type: 'enter', node: node });

      if (memo[node.n] !== undefined) {
        hitCount++;
        events.push({ type: 'cache', node: node, val: memo[node.n] });
        return memo[node.n];
      }

      callCount++;
      var base = baseValue(node.n);
      if (base !== null) {
        memo[node.n] = base;
        events.push({ type: 'resolve', node: node, val: base, store: true });
        return base;
      }

      var left = walk(node.children[0]);
      var right = walk(node.children[1]);
      var res = left + right;
      memo[node.n] = res;
      events.push({ type: 'resolve', node: node, val: res, store: true });
      return res;
    }

    var result = walk(root);
    return { events: events, callCount: callCount, hitCount: hitCount, result: result };
  }

  function buildTabEvents(n) {
    var f = [];
    f[1] = 1;
    f[2] = 2;
    var events = [];
    events.push({ type: 'base', i: 1, val: 1 });
    events.push({ type: 'base', i: 2, val: 2 });
    for (var i = 3; i <= n; i++) {
      var va = f[i - 1];
      var vb = f[i - 2];
      var v = va + vb;
      f[i] = v;
      events.push({ type: 'highlight', i: i, a: i - 1, b: i - 2, va: va, vb: vb });
      events.push({ type: 'compute', i: i, a: i - 1, b: i - 2, va: va, vb: vb });
      events.push({ type: 'write', i: i, val: v, a: i - 1, b: i - 2, va: va, vb: vb });
    }
    return { events: events, table: f, result: f[n] };
  }

  (function initExpected() {
    var preview = buildMemoEvents(buildTree(N));
    EXPECTED_MEMO_CALLS = preview.callCount;
    EXPECTED_MEMO_HITS = preview.hitCount;
    var w = document.getElementById('cmpMemoWork');
    var t = document.getElementById('cmpTabWork');
    if (w) w.textContent = String(EXPECTED_MEMO_CALLS);
    if (t) t.textContent = String(EXPECTED_TAB_WRITES);
  })();

  function setupCanvas(id) {
    var canvas = document.getElementById(id);
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rw = canvas.clientWidth || canvas.offsetWidth;
    var rh = canvas.clientHeight || canvas.offsetHeight;
    if (rw < 8 || rh < 8) {
      var par = canvas.parentElement;
      if (par) {
        rw = Math.max(rw, par.clientWidth || par.offsetWidth || 0);
        rh = Math.max(rh, par.clientHeight || par.offsetHeight || 0);
      }
    }
    if (rw < 8 || rh < 8) {
      var rect = canvas.getBoundingClientRect();
      rw = Math.max(8, rect.width);
      rh = Math.max(8, rect.height);
    }
    rw = Math.max(1, rw);
    rh = Math.max(1, rh);
    canvas.width = Math.round(rw * dpr);
    canvas.height = Math.round(rh * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: rw, h: rh };
  }

  function drawNode(ctx, x, y, label, opt) {
    opt = opt || {};
    var r = opt.r || 15;
    ctx.save();
    ctx.globalAlpha = opt.alpha !== undefined ? opt.alpha : 1;
    if (opt.glow) {
      ctx.shadowColor = opt.glow;
      ctx.shadowBlur = 20;
    }
    if (opt.pulse) {
      var s = 1 + Math.sin(Date.now() / 100) * 0.08;
      ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y);
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = opt.fill || '#0c0b12'; ctx.fill();
    ctx.lineWidth = 2.8; ctx.strokeStyle = opt.stroke || '#1a1a28'; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = opt.text || '#333344';
    var labelFs = Math.max(10, Math.round(r * 0.62));
    ctx.font = 'bold ' + labelFs + 'px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(label), x, y);
    if (opt.showRes && opt.res !== null && opt.res !== undefined) {
      var bubbleR = Math.max(8, Math.round(r * 0.42));
      var offX = r + Math.round(6 + r * 0.12);
      var offY = -r + Math.round(3 + r * 0.08);
      ctx.beginPath(); ctx.arc(x + offX, y + offY, bubbleR, 0, Math.PI * 2);
      ctx.fillStyle = '#090810'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = opt.stroke || '#1a1a28'; ctx.stroke();
      ctx.fillStyle = opt.text || '#333344';
      var resFs = Math.max(9, Math.round(labelFs * 0.82));
      ctx.font = 'bold ' + resFs + 'px "JetBrains Mono", monospace';
      ctx.fillText(String(opt.res), x + offX, y + offY);
    }
    ctx.restore();
  }

  function drawEdge(ctx, x1, y1, x2, y2, col, wid, alpha, glow) {
    col = col || '#1a1a28'; wid = wid || 1.2;
    alpha = alpha !== undefined ? alpha : 1;
    ctx.save(); ctx.globalAlpha = alpha;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 12; }
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = col; ctx.lineWidth = wid; ctx.stroke();
    ctx.restore();
  }

  function drawCurvedEdge(ctx, x1, y1, x2, y2, sideOffset, col, wid, alpha, glow) {
    col = col || '#1a1a28';
    wid = wid || 1.2;
    alpha = alpha !== undefined ? alpha : 1;
    var mx = (x1 + x2) / 2 + sideOffset;
    var my = (y1 + y2) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 12; }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.strokeStyle = col;
    ctx.lineWidth = wid;
    ctx.stroke();
    ctx.restore();
  }

  function drawScanner(ctx, x1, y1, x2, y2, prog, col) {
    var x = x1 + (x2 - x1) * prog;
    var y = y1 + (y2 - y1) * prog;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowColor = col; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }

  function layoutTree(node, x, y, spread, vStep) {
    vStep = vStep || 32;
    node.px = x; node.py = y;
    if (node.children.length === 2) {
      layoutTree(node.children[0], x - spread / 2, y + vStep, spread / 2, vStep);
      layoutTree(node.children[1], x + spread / 2, y + vStep, spread / 2, vStep);
    }
  }

  function treeVisualDepth(node) {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(treeVisualDepth(node.children[0]), treeVisualDepth(node.children[1]));
  }

  function clampTreeToCanvasWidth(map, w, nodeR) {
    var pad = Math.max(nodeR + 10, 20);
    var minX = Infinity;
    var maxX = -Infinity;
    for (var id in map) {
      var n = map[id];
      if (n.px - pad < minX) minX = n.px - pad;
      if (n.px + pad > maxX) maxX = n.px + pad;
    }
    if (minX === Infinity) return;
    var span = maxX - minX;
    var avail = Math.max(20, w - 16);
    if (span <= avail) return;
    var scale = avail / span;
    if (scale > 0.98) return;
    var mid = (minX + maxX) / 2;
    var target = w / 2;
    for (var id2 in map) {
      map[id2].px = (map[id2].px - mid) * scale + target;
    }
  }

  function computeTreeGeom(w, h, depthNodes) {
    var spreadDiv = 2.18;
    var bottomReserve = 16;
    var d = (depthNodes != null && depthNodes > 0) ? depthNodes : 10;
    d = Math.max(2, d);
    var segments = Math.max(1, d - 1);
    var maxR = Math.max(9, Math.min(13, w * 0.021));
    var topY = Math.max(18, Math.round(maxR + 8));
    var vStep = Math.round((h - topY - bottomReserve) / segments);
    vStep = Math.max(15, Math.min(120, vStep));
    var nr = Math.max(8, Math.min(12, w * 0.02));
    var nrActive = Math.min(nr + 3, 14);
    var edgePad = Math.round(Math.max(8, nr * 0.76));
    return {
      spreadDiv: spreadDiv,
      vStep: vStep,
      topY: topY,
      nr: nr,
      nrActive: nrActive,
      edgePad: edgePad
    };
  }

  function indexNodes(node, map) {
    map[node.id] = node;
    for (var i = 0; i < node.children.length; i++) indexNodes(node.children[i], map);
  }

  function MemoVis() {
    this.tree = buildTree(N);
    var memData = buildMemoEvents(this.tree);
    this.events = memData.events;
    this.idx = 0;
    this.calls = 0;
    this.hits = 0;
    this.states = {};
    this.results = {};
    this.scanner = null;
    this.scanT0 = 0;
    this.memoStore = {};

    this.buildStrip();

    var s = setupCanvas('memCanvas');
    if (!s) return;
    this.ctx = s.ctx; this.w = s.w; this.h = s.h;

    this.map = {};
    indexNodes(this.tree, this.map);
    this.geom = computeTreeGeom(this.w, this.h, treeVisualDepth(this.tree));
    layoutTree(this.tree, this.w / 2, this.geom.topY, this.w / this.geom.spreadDiv, this.geom.vStep);
    clampTreeToCanvasWidth(this.map, this.w, this.geom.nrActive);
    this.makeDots('memProgress');
    this.draw();
  }

  MemoVis.prototype.buildStrip = function() {
    var strip = document.getElementById('memoStrip');
    if (!strip) return;
    strip.innerHTML = '';
    this.stripCells = {};
    for (var i = 1; i <= N; i++) {
      var c = document.createElement('div');
      c.className = 'memo-cell';
      c.innerHTML =
        '<div class="mc-idx">f[' + i + ']</div>' +
        '<div class="mc-val">·</div>';
      strip.appendChild(c);
      this.stripCells[i] = c;
    }
  };

  MemoVis.prototype.clearStripStates = function() {
    if (!this.stripCells) return;
    for (var k in this.stripCells) {
      this.stripCells[k].classList.remove('writing', 'hit');
    }
  };

  MemoVis.prototype.markStrip = function(n, val, kind) {
    if (!this.stripCells) return;
    this.clearStripStates();
    var c = this.stripCells[n];
    if (!c) return;
    var v = c.querySelector('.mc-val');
    if (v && val !== undefined && val !== null) v.textContent = String(val);
    if (kind === 'write') {
      c.classList.add('filled', 'writing');
    } else if (kind === 'hit') {
      c.classList.add('filled', 'hit');
    } else if (kind === 'filled') {
      c.classList.add('filled');
    }
  };

  MemoVis.prototype.makeDots = function(id) {
    var c = document.getElementById(id);
    if (!c) return;
    c.innerHTML = '';
    this.totalDots = Math.min(this.events.length, 34);
    for (var i = 0; i < this.totalDots; i++) {
      var d = document.createElement('div');
      d.className = 'progress-dot';
      d.style.height = (3 + Math.random() * 7) + 'px';
      c.appendChild(d);
    }
  };

  MemoVis.prototype.step = function() {
    if (this.idx >= this.events.length) return false;
    var ev = this.events[this.idx];
    var node = ev.node;

    if (ev.type === 'enter') {
      this.calls++;
      if (window.MemTabAudio) window.MemTabAudio.memoEnter();
      this.states[node.id] = { active: true, resolved: false, cached: false };
    } else if (ev.type === 'cache') {
      this.hits++;
      if (window.MemTabAudio) window.MemTabAudio.memoCache();
      this.results[node.id] = ev.val;
      this.states[node.id] = { active: false, resolved: true, cached: true };
      this.markStrip(node.n, ev.val, 'hit');
    } else if (ev.type === 'resolve') {
      this.results[node.id] = ev.val;
      var st = this.states[node.id] || {};
      st.resolved = true; st.active = false;
      this.states[node.id] = st;
      if (window.MemTabAudio) window.MemTabAudio.memoResolve(node.n);
      if (ev.store) {
        this.memoStore[node.n] = ev.val;
        this.markStrip(node.n, ev.val, 'write');
      }
      var lbl = document.getElementById('memFibLabel');
      var val = document.getElementById('memFibVal');
      if (lbl) lbl.textContent = 'fib(' + node.n + ')=';
      if (val) val.textContent = String(ev.val);
    }

    this.idx++;
    var prog = Math.floor((this.idx / this.events.length) * this.totalDots);
    var dots = document.querySelectorAll('#memProgress .progress-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('active', i < prog);
    var el1 = document.getElementById('memCalls');
    var el2 = document.getElementById('memHits');
    if (el1) el1.textContent = this.calls;
    if (el2) el2.textContent = this.hits;
    return this.idx < this.events.length;
  };

  MemoVis.prototype.draw = function() {
    var ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);

    var ep = this.geom ? this.geom.edgePad : 14;
    for (var id in this.map) {
      var node = this.map[id];
      for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        var ps = this.states[node.id];
        var cs = this.states[child.id];
        var col = '#151520', wid = 1, alpha = 0.2, glow = null;
        if (ps && (ps.active || ps.resolved || ps.cached)) { col = '#a78bfa'; alpha = 0.32; }
        if (cs && cs.active) { col = '#a78bfa'; wid = 2.4; alpha = 0.85; glow = 'rgba(167,139,250,0.25)'; }
        if (cs && cs.cached) { col = '#fbbf24'; wid = 2.2; alpha = 0.7; glow = 'rgba(251,191,36,0.25)'; }
        drawEdge(ctx, node.px, node.py + ep, child.px, child.py - ep, col, wid, alpha, glow);
      }
    }

    if (this.scanner) {
      var dt = Date.now() - this.scanT0;
      var p = Math.min(dt / 250, 1);
      drawScanner(ctx, this.scanner.from.px, this.scanner.from.py + ep, this.scanner.to.px, this.scanner.to.py - ep, p, '#a78bfa');
      if (p >= 1) this.scanner = null;
    }

    var gm = this.geom;
    for (var nid in this.map) {
      var n = this.map[nid];
      var st = this.states[n.id] || {};
      var active = st.active;
      var resolved = st.resolved;
      var cached = st.cached;
      var visited = active || resolved || cached;
      var fill = '#0a0910', stroke = '#1a1a28', text = '#2a2a3a', glow = null, alpha = 0.15;
      if (visited) {
        alpha = 1;
        if (active) { fill = '#1b1330'; stroke = '#a78bfa'; text = '#c8b8ff'; glow = 'rgba(167,139,250,0.32)'; }
        else if (cached) { fill = '#221a0a'; stroke = '#fbbf24'; text = '#fbbf24'; glow = 'rgba(251,191,36,0.25)'; }
        else if (resolved) { fill = '#161028'; stroke = '#7a5fcc'; text = '#a78bfa'; }
      }
      var res = this.results[n.id];
      var nrad = gm ? (active ? gm.nrActive : gm.nr) : (active ? 22 : 18);
      drawNode(ctx, n.px, n.py, n.n, {
        r: nrad, fill: fill, stroke: stroke, text: text,
        glow: glow, alpha: alpha, showRes: resolved || cached, res: res,
        pulse: active
      });
    }
  };

  MemoVis.prototype.reset = function() {
    this.idx = 0; this.calls = 0; this.hits = 0;
    this.states = {}; this.results = {}; this.scanner = null;
    this.memoStore = {};
    this.buildStrip();
    var el1 = document.getElementById('memCalls');
    var el2 = document.getElementById('memHits');
    var el3 = document.getElementById('memFibLabel');
    var el4 = document.getElementById('memFibVal');
    if (el1) el1.textContent = '0';
    if (el2) el2.textContent = '0';
    if (el3) el3.textContent = 'fib(' + N + ')=';
    if (el4) el4.textContent = '?';
    var dots = document.querySelectorAll('#memProgress .progress-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.remove('active');
    this.draw();
  };

  function TabTreeVis() {
    this.events = buildTabEvents(N).events;
    this.idx = 0;
    this.writes = 0;
    this.values = {};
    this.states = {};
    this.currentReadA = null;
    this.currentReadB = null;
    this.currentWrite = null;

    var s = setupCanvas('tabCanvas');
    if (!s) return;
    this.ctx = s.ctx; this.w = s.w; this.h = s.h;

    this.layoutNodes();
    this.makeDots('tabProgress');
    this.draw();
  }

  TabTreeVis.prototype.layoutNodes = function() {
    var topPad = 22;
    var bottomPad = 42;
    var avail = Math.max(40, this.h - topPad - bottomPad);
    var step = avail / (N - 1);
    this.nodeR = Math.max(11, Math.min(16, this.w * 0.038));
    this.nodeRActive = this.nodeR + 3;
    this.edgePad = Math.round(this.nodeR * 0.78);
    this.positions = {};
    var cx = this.w / 2;
    for (var i = 1; i <= N; i++) {
      var y = this.h - bottomPad - (i - 1) * step;
      this.positions[i] = { x: cx, y: y };
    }
  };

  TabTreeVis.prototype.makeDots = function(id) {
    var c = document.getElementById(id);
    if (!c) return;
    c.innerHTML = '';
    this.totalDots = Math.min(this.events.length, 34);
    for (var i = 0; i < this.totalDots; i++) {
      var d = document.createElement('div');
      d.className = 'progress-dot';
      d.style.height = (3 + Math.random() * 7) + 'px';
      c.appendChild(d);
    }
  };

  TabTreeVis.prototype.setFormula = function(html) {
    var el = document.getElementById('tabFormula');
    if (el) el.innerHTML = html;
  };

  TabTreeVis.prototype.setIndex = function(i) {
    var el = document.getElementById('tabIndex');
    if (el) el.textContent = String(i);
  };

  TabTreeVis.prototype.step = function() {
    if (this.idx >= this.events.length) return false;
    var ev = this.events[this.idx];

    if (ev.type === 'base') {
      this.values[ev.i] = ev.val;
      this.states[ev.i] = { base: true, written: true };
      this.writes++;
      this.currentWrite = ev.i;
      this.currentReadA = null;
      this.currentReadB = null;
      if (window.MemTabAudio) window.MemTabAudio.tabFill(true);
      this.setFormula('<span class="hi-eq">base</span>  f[' + ev.i + '] = ' + ev.val);
      this.setIndex(ev.i);
    } else if (ev.type === 'highlight') {
      this.currentReadA = ev.a;
      this.currentReadB = ev.b;
      this.currentWrite = ev.i;
      if (window.MemTabAudio) window.MemTabAudio.tabLook();
      this.setFormula(
        'f[<span class="hi-i">' + ev.i + '</span>] = ' +
        'f[<span class="hi-a">' + ev.a + '</span>] + ' +
        'f[<span class="hi-b">' + ev.b + '</span>]'
      );
      this.setIndex(ev.i);
    } else if (ev.type === 'compute') {
      if (window.MemTabAudio) window.MemTabAudio.tabLook();
      this.setFormula(
        'f[<span class="hi-i">' + ev.i + '</span>] = ' +
        '<span class="hi-a">' + ev.va + '</span> + ' +
        '<span class="hi-b">' + ev.vb + '</span>'
      );
      this.setIndex(ev.i);
    } else if (ev.type === 'write') {
      this.values[ev.i] = ev.val;
      this.states[ev.i] = { written: true };
      this.writes++;
      this.currentWrite = ev.i;
      this.currentReadA = null;
      this.currentReadB = null;
      if (window.MemTabAudio) window.MemTabAudio.tabFill(false);
      this.setFormula(
        'f[<span class="hi-i">' + ev.i + '</span>] = ' +
        '<span class="hi-eq">' + ev.val + '</span>'
      );
      this.setIndex(ev.i);
      var lbl = document.getElementById('tabFibLabel');
      var val = document.getElementById('tabFibVal');
      if (lbl) lbl.textContent = 'fib(' + ev.i + ')=';
      if (val) val.textContent = String(ev.val);
    }

    this.idx++;
    var prog = Math.floor((this.idx / this.events.length) * this.totalDots);
    var dots = document.querySelectorAll('#tabProgress .progress-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('active', i < prog);
    var wEl = document.getElementById('tabWrites');
    if (wEl) wEl.textContent = String(this.writes);
    return this.idx < this.events.length;
  };

  TabTreeVis.prototype.draw = function() {
    var ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);

    var ep = this.edgePad;
    var shortCurve = Math.max(18, this.w * 0.07);
    var longCurve = Math.max(34, this.w * 0.16);

    for (var i = 3; i <= N; i++) {
      var to = this.positions[i];
      var from1 = this.positions[i - 1];
      var from2 = this.positions[i - 2];

      var aWritten = this.states[i - 1] && this.states[i - 1].written;
      var bWritten = this.states[i - 2] && this.states[i - 2].written;
      var readingA = (this.currentReadA === i - 1 && this.currentWrite === i);
      var readingB = (this.currentReadB === i - 2 && this.currentWrite === i);

      var colA = '#151520', wA = 1, aA = 0.18, gA = null;
      if (aWritten) { colA = '#4ade80'; aA = 0.32; }
      if (readingA) { colA = '#fbbf24'; wA = 2.4; aA = 0.9; gA = 'rgba(251,191,36,0.3)'; }
      drawCurvedEdge(ctx, from1.x, from1.y - ep, to.x, to.y + ep, +shortCurve, colA, wA, aA, gA);

      var colB = '#151520', wB = 1, aB = 0.18, gB = null;
      if (bWritten) { colB = '#4ade80'; aB = 0.32; }
      if (readingB) { colB = '#fbbf24'; wB = 2.4; aB = 0.9; gB = 'rgba(251,191,36,0.3)'; }
      drawCurvedEdge(ctx, from2.x, from2.y - ep, to.x, to.y + ep, -longCurve, colB, wB, aB, gB);
    }

    for (var n = 1; n <= N; n++) {
      var pos = this.positions[n];
      var st = this.states[n] || {};
      var written = !!st.written;
      var isBase = !!st.base;
      var reading = (this.currentReadA === n || this.currentReadB === n) && this.currentWrite !== n;
      var writing = this.currentWrite === n && !written;
      var fill = '#0a0910', stroke = '#1a1a28', text = '#2a2a3a', glow = null, alpha = 0.18, pulse = false;
      if (writing) {
        fill = '#0e1f15'; stroke = '#4ade80'; text = '#a8f0c2'; glow = 'rgba(74,222,128,0.35)'; alpha = 1; pulse = true;
      } else if (reading) {
        fill = '#221a0a'; stroke = '#fbbf24'; text = '#fbbf24'; glow = 'rgba(251,191,36,0.3)'; alpha = 1;
      } else if (isBase) {
        fill = '#0a1f1d'; stroke = '#14b8a6'; text = '#5eead4'; alpha = 1;
      } else if (written) {
        fill = '#0e1f15'; stroke = '#4ade80'; text = '#86efac'; alpha = 1;
      }
      drawNode(ctx, pos.x, pos.y, n, {
        r: (writing || reading) ? this.nodeRActive : this.nodeR,
        fill: fill, stroke: stroke, text: text,
        glow: glow, alpha: alpha, pulse: pulse,
        showRes: written, res: this.values[n]
      });
    }
  };

  TabTreeVis.prototype.reset = function() {
    this.idx = 0;
    this.writes = 0;
    this.values = {};
    this.states = {};
    this.currentReadA = null;
    this.currentReadB = null;
    this.currentWrite = null;
    var wEl = document.getElementById('tabWrites');
    var iEl = document.getElementById('tabIndex');
    var fLbl = document.getElementById('tabFibLabel');
    var fVal = document.getElementById('tabFibVal');
    if (wEl) wEl.textContent = '0';
    if (iEl) iEl.textContent = '–';
    if (fLbl) fLbl.textContent = 'fib(' + N + ')=';
    if (fVal) fVal.textContent = '?';
    this.setFormula('for i = 3..n  →  f[i] = f[i-1] + f[i-2]');
    var dots = document.querySelectorAll('#tabProgress .progress-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.remove('active');
    this.draw();
  };

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function startLoop() {
    if (animFrameId) return;
    function loop() {
      if (memVis) memVis.draw();
      if (tabVis) tabVis.draw();
      animFrameId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopLoop() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  async function doPlay() {
    if (isAnimating) return;
    if (!memVis || !tabVis) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.MemTabAudio) window.MemTabAudio.unlock();

    memVis.reset();
    tabVis.reset();
    await sleep(280);

    startLoop();

    var memDone = false;
    var tabDone = false;
    while (!memDone || !tabDone) {
      if (!memDone) memDone = !memVis.step();
      if (!tabDone) tabDone = !tabVis.step();
      await sleep(animationSpeed);
    }

    if (window.MemTabAudio) window.MemTabAudio.playComplete();
    await sleep(500);
    stopLoop();

    var w = document.getElementById('cmpMemoWork');
    var t = document.getElementById('cmpTabWork');
    if (w) w.textContent = String(memVis.calls);
    if (t) t.textContent = String(tabVis.writes);

    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    if (memVis) memVis.reset();
    if (tabVis) tabVis.reset();
    var w = document.getElementById('cmpMemoWork');
    var t = document.getElementById('cmpTabWork');
    if (w) w.textContent = String(EXPECTED_MEMO_CALLS);
    if (t) t.textContent = String(EXPECTED_TAB_WRITES);
  }

  function init() {
    memVis = new MemoVis();
    tabVis = new TabTreeVis();
  }

  var initDebounce = null;
  function scheduleInit() {
    if (isAnimating) return;
    clearTimeout(initDebounce);
    initDebounce = setTimeout(function() { init(); }, 30);
  }

  function wirePlatform() {
    if (window.MemTabAudio) window.MemTabAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) {
        animationSpeed = 850 - v;
      },
      onLayoutRefresh: scheduleInit,
      recordDownloadBasename: 'memo-vs-tab-instagram-reel-1080x1920'
    });

    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        init();
        var pr = document.querySelector('.reel-viz-visualizer');
        if (pr && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function() {
            scheduleInit();
          });
          ro.observe(pr);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wirePlatform);
  } else {
    wirePlatform();
  }
})();
