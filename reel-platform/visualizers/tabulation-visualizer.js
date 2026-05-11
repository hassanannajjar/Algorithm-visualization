/**
 * Reel visualizer: Simple recursion (top-down tree) vs Tabulation (bottom-up table).
 *
 * Uses the climbing-stairs recurrence to match the script: f(1)=1, f(2)=2, f(n)=f(n-1)+f(n-2).
 * The tabulation timeline runs three sub-events per iteration (highlight → compute → write)
 * to roughly match the recursive call density.
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
  var recVis = null;
  var tabVis = null;
  var animFrameId = null;

  var EXPECTED_REC_CALLS = 0;
  var EXPECTED_TAB_WRITES = N;

  function baseValue(k) {
    if (k === 1) return 1;
    if (k === 2) return 2;
    return null;
  }

  function countRecursiveProfile(n) {
    var calls = 0;
    var seenN = {};
    var redundant = 0;
    function fib(k) {
      calls++;
      if (seenN[k]) redundant++;
      seenN[k] = true;
      var base = baseValue(k);
      if (base !== null) return base;
      return fib(k - 1) + fib(k - 2);
    }
    fib(n);
    return { calls: calls, redundant: redundant };
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

  function flattenRec(node, events, parentId) {
    events = events || [];
    events.push({ type: 'enter', node: node, parentId: parentId });
    var base = baseValue(node.n);
    if (base !== null) {
      events.push({ type: 'resolve', node: node, val: base });
    } else {
      flattenRec(node.children[0], events, node.id);
      flattenRec(node.children[1], events, node.id);
      events.push({ type: 'resolve', node: node });
    }
    events.push({ type: 'exit', node: node });
    return events;
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
    var p = countRecursiveProfile(N);
    EXPECTED_REC_CALLS = p.calls;
    var t1 = document.getElementById('tabCallsRec');
    var t2 = document.getElementById('tabWritesMem');
    if (t1) t1.textContent = String(EXPECTED_REC_CALLS);
    if (t2) t2.textContent = String(EXPECTED_TAB_WRITES);
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

  function RecVis() {
    this.tree = buildTree(N);
    this.events = flattenRec(this.tree);
    this.idx = 0;
    this.calls = 0;
    this.redundant = 0;
    this.nEnterCount = {};
    this.states = {};
    this.results = {};
    this.scanner = null;
    this.scanT0 = 0;

    var s = setupCanvas('recCanvas');
    if (!s) return;
    this.ctx = s.ctx; this.w = s.w; this.h = s.h;

    this.map = {};
    indexNodes(this.tree, this.map);
    this.geom = computeTreeGeom(this.w, this.h, treeVisualDepth(this.tree));
    layoutTree(this.tree, this.w / 2, this.geom.topY, this.w / this.geom.spreadDiv, this.geom.vStep);
    clampTreeToCanvasWidth(this.map, this.w, this.geom.nrActive);
    this.makeDots('recProgress');
    this.draw();
  }

  RecVis.prototype.makeDots = function(id) {
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

  RecVis.prototype.step = function() {
    if (this.idx >= this.events.length) return false;
    var ev = this.events[this.idx];
    var node = ev.node;

    if (ev.type === 'enter') {
      var prev = this.nEnterCount[node.n] || 0;
      if (window.TabReelAudio) window.TabReelAudio.recEnter(prev > 0);
      if (prev > 0) this.redundant++;
      this.nEnterCount[node.n] = prev + 1;

      this.calls++;
      this.states[node.id] = { active: true, resolved: false };
      if (ev.parentId && this.map[ev.parentId]) {
        this.scanner = { from: this.map[ev.parentId], to: node };
        this.scanT0 = Date.now();
      }
    } else if (ev.type === 'resolve') {
      var resVal;
      if (ev.val !== undefined) {
        resVal = ev.val;
      } else {
        resVal = this.results[node.children[0].id] + this.results[node.children[1].id];
      }
      this.results[node.id] = resVal;
      var st = this.states[node.id] || {};
      st.resolved = true; st.active = false;
      this.states[node.id] = st;
      if (window.TabReelAudio) window.TabReelAudio.recResolve(node.n);
      var lbl = document.getElementById('recFibLabel');
      var val = document.getElementById('recFibVal');
      if (lbl) lbl.textContent = 'fib(' + node.n + ')=';
      if (val) val.textContent = String(this.results[node.id]);
    }

    this.idx++;
    var prog = Math.floor((this.idx / this.events.length) * this.totalDots);
    var dots = document.querySelectorAll('#recProgress .progress-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('active', i < prog);
    var el = document.getElementById('recCalls');
    var er = document.getElementById('recRedundant');
    if (el) el.textContent = this.calls;
    if (er) er.textContent = this.redundant;
    return this.idx < this.events.length;
  };

  RecVis.prototype.draw = function() {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    var ep = this.geom ? this.geom.edgePad : 14;
    for (var id in this.map) {
      var node = this.map[id];
      for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        var ps = this.states[node.id];
        var cs = this.states[child.id];
        var col = '#151520', wid = 1, alpha = 0.2, glow = null;
        if (ps && (ps.active || ps.resolved)) { col = '#ff4d6d'; alpha = 0.3; }
        if (cs && cs.active) { col = '#ff4d6d'; wid = 2.4; alpha = 0.8; glow = 'rgba(255,77,109,0.25)'; }
        drawEdge(ctx, node.px, node.py + ep, child.px, child.py - ep, col, wid, alpha, glow);
      }
    }

    if (this.scanner) {
      var dt = Date.now() - this.scanT0;
      var p = Math.min(dt / 250, 1);
      drawScanner(ctx, this.scanner.from.px, this.scanner.from.py + ep, this.scanner.to.px, this.scanner.to.py - ep, p, '#ff4d6d');
      if (p >= 1) this.scanner = null;
    }

    for (var nid in this.map) {
      var n2 = this.map[nid];
      var st = this.states[n2.id] || {};
      var active = st.active;
      var resolved = st.resolved;
      var visited = active || resolved;
      var fill = '#0a0910', stroke = '#1a1a28', text = '#2a2a3a', glow = null, alpha = 0.15;
      if (visited) {
        alpha = 1;
        if (active) { fill = '#2a1018'; stroke = '#ff4d6d'; text = '#ff4d6d'; glow = 'rgba(255,77,109,0.3)'; }
        else if (resolved) { fill = '#1a0e14'; stroke = '#aa4466'; text = '#cc6677'; }
      }
      var g = this.geom;
      var nr = g ? (active ? g.nrActive : g.nr) : (active ? 22 : 18);
      drawNode(ctx, n2.px, n2.py, n2.n, {
        r: nr, fill: fill, stroke: stroke, text: text,
        glow: glow, alpha: alpha, showRes: resolved, res: this.results[n2.id],
        pulse: active
      });
    }
  };

  RecVis.prototype.reset = function() {
    this.idx = 0; this.calls = 0; this.redundant = 0; this.nEnterCount = {};
    this.states = {}; this.results = {}; this.scanner = null;
    var el1 = document.getElementById('recCalls');
    var el2 = document.getElementById('recRedundant');
    var el3 = document.getElementById('recFibLabel');
    var el4 = document.getElementById('recFibVal');
    if (el1) el1.textContent = '0';
    if (el2) el2.textContent = '0';
    if (el3) el3.textContent = 'fib(' + N + ')=';
    if (el4) el4.textContent = '?';
    var dots = document.querySelectorAll('#recProgress .progress-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.remove('active');
    this.draw();
  };

  function TabVis() {
    this.events = buildTabEvents(N).events;
    this.idx = 0;
    this.writes = 0;
    this.cellEls = {};
    this.buildCells();
    this.makeDots('tabProgress');
    this.draw();
  }

  TabVis.prototype.buildCells = function() {
    var grid = document.getElementById('tabGrid');
    if (!grid) return;
    grid.innerHTML = '';
    this.cellEls = {};
    for (var i = 1; i <= N; i++) {
      var cell = document.createElement('div');
      cell.className = 'tab-cell empty';
      cell.dataset.i = String(i);
      cell.innerHTML =
        '<div class="idx">f[' + i + ']</div>' +
        '<div class="val">·</div>' +
        '<div class="arrow">↗</div>';
      grid.appendChild(cell);
      this.cellEls[i] = cell;
    }
  };

  TabVis.prototype.makeDots = function(id) {
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

  TabVis.prototype.clearReads = function() {
    for (var k in this.cellEls) {
      this.cellEls[k].classList.remove('reading', 'writing');
    }
  };

  TabVis.prototype.setFormula = function(html) {
    var el = document.getElementById('tabFormula');
    if (el) el.innerHTML = html;
  };

  TabVis.prototype.markFilled = function(i, val, isBase) {
    var cell = this.cellEls[i];
    if (!cell) return;
    cell.classList.remove('empty', 'writing', 'reading');
    if (isBase) cell.classList.add('base');
    else cell.classList.add('filled');
    var v = cell.querySelector('.val');
    if (v) v.textContent = String(val);
  };

  TabVis.prototype.step = function() {
    if (this.idx >= this.events.length) return false;
    var ev = this.events[this.idx];

    if (ev.type === 'base') {
      this.markFilled(ev.i, ev.val, true);
      this.writes++;
      if (window.TabReelAudio) window.TabReelAudio.tabFill(true);
      this.setFormula('<span class="hi-eq">base</span>  f[' + ev.i + '] = ' + ev.val);
      this.setIndex(ev.i);
    } else if (ev.type === 'highlight') {
      this.clearReads();
      var ca = this.cellEls[ev.a];
      var cb = this.cellEls[ev.b];
      if (ca) ca.classList.add('reading');
      if (cb) cb.classList.add('reading');
      var pendCell = this.cellEls[ev.i];
      if (pendCell) pendCell.classList.add('writing');
      if (window.TabReelAudio) window.TabReelAudio.tabLook();
      this.setFormula(
        'f[<span class="hi-i">' + ev.i + '</span>] = ' +
        'f[<span class="hi-a">' + ev.a + '</span>] + ' +
        'f[<span class="hi-b">' + ev.b + '</span>]'
      );
      this.setIndex(ev.i);
    } else if (ev.type === 'compute') {
      if (window.TabReelAudio) window.TabReelAudio.tabLook();
      this.setFormula(
        'f[<span class="hi-i">' + ev.i + '</span>] = ' +
        '<span class="hi-a">' + ev.va + '</span> + ' +
        '<span class="hi-b">' + ev.vb + '</span>'
      );
      this.setIndex(ev.i);
    } else if (ev.type === 'write') {
      this.clearReads();
      this.markFilled(ev.i, ev.val, false);
      this.writes++;
      if (window.TabReelAudio) window.TabReelAudio.tabFill(false);
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

  TabVis.prototype.setIndex = function(i) {
    var el = document.getElementById('tabIndex');
    if (el) el.textContent = String(i);
  };

  TabVis.prototype.draw = function() {};

  TabVis.prototype.reset = function() {
    this.idx = 0;
    this.writes = 0;
    this.buildCells();
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
  };

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function startLoop() {
    if (animFrameId) return;
    function loop() {
      if (recVis) recVis.draw();
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
    if (!recVis || !tabVis) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.TabReelAudio) window.TabReelAudio.unlock();

    recVis.reset();
    tabVis.reset();
    await sleep(280);

    startLoop();

    var recDone = false;
    var tabDone = false;
    while (!recDone || !tabDone) {
      if (!recDone) recDone = !recVis.step();
      if (!tabDone) tabDone = !tabVis.step();
      await sleep(animationSpeed);
    }

    if (window.TabReelAudio) window.TabReelAudio.playComplete();
    await sleep(500);
    stopLoop();

    var t1 = document.getElementById('tabCallsRec');
    var t2 = document.getElementById('tabWritesMem');
    if (t1) t1.textContent = String(recVis.calls);
    if (t2) t2.textContent = String(tabVis.writes);

    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    if (recVis) recVis.reset();
    if (tabVis) tabVis.reset();
    var t1 = document.getElementById('tabCallsRec');
    var t2 = document.getElementById('tabWritesMem');
    if (t1) t1.textContent = String(EXPECTED_REC_CALLS);
    if (t2) t2.textContent = String(EXPECTED_TAB_WRITES);
  }

  function init() {
    recVis = new RecVis();
    tabVis = new TabVis();
  }

  var initDebounce = null;
  function scheduleInit() {
    if (isAnimating) return;
    clearTimeout(initDebounce);
    initDebounce = setTimeout(function() { init(); }, 30);
  }

  function wirePlatform() {
    if (window.TabReelAudio) window.TabReelAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) {
        animationSpeed = 850 - v;
      },
      onLayoutRefresh: scheduleInit,
      recordDownloadBasename: 'tabulation-instagram-reel-1080x1920'
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
