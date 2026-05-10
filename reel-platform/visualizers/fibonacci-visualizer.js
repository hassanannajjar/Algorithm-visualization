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
  var memVis = null;
  var animFrameId = null;

  var EXPECTED_REC_CALLS = 109;
  var EXPECTED_REC_REDUNDANT = 0;
  var EXPECTED_MEM_CALLS = 17;

  function countRecursiveProfile(n) {
    var calls = 0;
    var seenN = {};
    var redundant = 0;
    function fib(k) {
      calls++;
      if (seenN[k]) redundant++;
      seenN[k] = true;
      if (k <= 1) return k;
      return fib(k - 1) + fib(k - 2);
    }
    fib(n);
    return { calls: calls, redundant: redundant };
  }

  function buildMemEvents(root) {
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

      if (node.n <= 1) {
        memo[node.n] = node.n;
        events.push({ type: 'resolve', node: node, val: node.n });
        return node.n;
      }

      var left = walk(node.children[0]);
      var right = walk(node.children[1]);
      var res = left + right;
      memo[node.n] = res;
      events.push({ type: 'resolve', node: node, val: res });
      return res;
    }

    var result = walk(root);
    return { events: events, callCount: callCount, hitCount: hitCount, result: result };
  }

  (function initExpected() {
    var p = countRecursiveProfile(N);
    EXPECTED_REC_CALLS = p.calls;
    EXPECTED_REC_REDUNDANT = p.redundant;
    var root0 = buildTree(N);
    var mem0 = buildMemEvents(root0);
    EXPECTED_MEM_CALLS = mem0.events.filter(function(e) { return e.type === 'enter'; }).length;
    var t1 = document.getElementById('tabCallsRec');
    var t2 = document.getElementById('tabCallsMem');
    if (t1) t1.textContent = String(EXPECTED_REC_CALLS);
    if (t2) t2.textContent = String(EXPECTED_MEM_CALLS);
  })();

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
    if (n <= 1) {
      node.result = n;
      return node;
    }
    node.children.push(buildTree(n - 1, depth + 1, path.concat(['L'])));
    node.children.push(buildTree(n - 2, depth + 1, path.concat(['R'])));
    return node;
  }

  function flattenRec(node, events, parentId) {
    events = events || [];
    events.push({ type: 'enter', node: node, parentId: parentId });
    if (node.n <= 1) {
      events.push({ type: 'resolve', node: node, val: node.n });
    } else {
      flattenRec(node.children[0], events, node.id);
      flattenRec(node.children[1], events, node.id);
      events.push({ type: 'resolve', node: node });
    }
    events.push({ type: 'exit', node: node });
    return events;
  }

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
      if (window.FibReelAudio) window.FibReelAudio.recEnter(prev > 0);
      if (prev > 0) this.redundant++;
      this.nEnterCount[node.n] = prev + 1;

      this.calls++;
      this.states[node.id] = { active: true, resolved: false };
      if (ev.parentId && this.map[ev.parentId]) {
        this.scanner = { from: this.map[ev.parentId], to: node };
        this.scanT0 = Date.now();
      }
    } else if (ev.type === 'resolve') {
      this.results[node.id] = ev.val !== undefined ? ev.val : (this.results[node.children[0].id] + this.results[node.children[1].id]);
      var st = this.states[node.id] || {};
      st.resolved = true; st.active = false;
      this.states[node.id] = st;
      if (window.FibReelAudio) window.FibReelAudio.recResolve(node.n);
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
      var node = this.map[nid];
      var st = this.states[node.id] || {};
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
      drawNode(ctx, node.px, node.py, node.n, {
        r: nr, fill: fill, stroke: stroke, text: text,
        glow: glow, alpha: alpha, showRes: resolved, res: this.results[node.id],
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

  function MemVis() {
    this.tree = buildTree(N);
    var memData = buildMemEvents(this.tree);
    this.events = memData.events;
    this.idx = 0;
    this.calls = 0;
    this.hits = 0;
    this.states = {};
    this.results = {};
    this.scanner = null;
    this.scanT0 = 0;

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

  MemVis.prototype.makeDots = function(id) {
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

  MemVis.prototype.step = function() {
    if (this.idx >= this.events.length) return false;
    var ev = this.events[this.idx];
    var node = ev.node;

    if (ev.type === 'enter') {
      this.calls++;
      if (window.FibReelAudio) window.FibReelAudio.memoEnter();
      this.states[node.id] = { active: true, resolved: false, cached: false };
    } else if (ev.type === 'cache') {
      this.hits++;
      if (window.FibReelAudio) window.FibReelAudio.memoCache();
      this.results[node.id] = ev.val;
      this.states[node.id] = { active: false, resolved: true, cached: true };
    } else if (ev.type === 'resolve') {
      this.results[node.id] = ev.val;
      var st = this.states[node.id] || {};
      st.resolved = true; st.active = false;
      this.states[node.id] = st;
      if (window.FibReelAudio) window.FibReelAudio.memoResolve(node.n);
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

  MemVis.prototype.draw = function() {
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
        if (ps && (ps.active || ps.resolved || ps.cached)) { col = '#4ade80'; alpha = 0.3; }
        if (cs && cs.active) { col = '#4ade80'; wid = 2.4; alpha = 0.8; glow = 'rgba(74,222,128,0.25)'; }
        if (cs && cs.cached) { col = '#fbbf24'; alpha = 0.5; glow = 'rgba(251,191,36,0.2)'; }
        drawEdge(ctx, node.px, node.py + ep, child.px, child.py - ep, col, wid, alpha, glow);
      }
    }

    if (this.scanner) {
      var dt = Date.now() - this.scanT0;
      var p = Math.min(dt / 250, 1);
      drawScanner(ctx, this.scanner.from.px, this.scanner.from.py + ep, this.scanner.to.px, this.scanner.to.py - ep, p, '#4ade80');
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
        if (active) { fill = '#12221a'; stroke = '#4ade80'; text = '#4ade80'; glow = 'rgba(74,222,128,0.3)'; }
        else if (cached) { fill = '#221a0a'; stroke = '#fbbf24'; text = '#fbbf24'; glow = 'rgba(251,191,36,0.25)'; }
        else if (resolved) { fill = '#0e1a12'; stroke = '#449955'; text = '#66bb77'; }
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

  MemVis.prototype.reset = function() {
    this.idx = 0; this.calls = 0; this.hits = 0;
    this.states = {}; this.results = {}; this.scanner = null;
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

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function startLoop() {
    if (animFrameId) return;
    function loop() {
      if (recVis) recVis.draw();
      if (memVis) memVis.draw();
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
    if (!recVis || !memVis) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.FibReelAudio) window.FibReelAudio.unlock();

    recVis.reset();
    memVis.reset();
    await sleep(280);

    startLoop();

    var recDone = false;
    var memDone = false;
    while (!recDone || !memDone) {
      if (!recDone) recDone = !recVis.step();
      if (!memDone) memDone = !memVis.step();
      await sleep(animationSpeed);
    }

    if (window.FibReelAudio) window.FibReelAudio.playComplete();
    await sleep(500);
    stopLoop();

    var t1 = document.getElementById('tabCallsRec');
    var t2 = document.getElementById('tabCallsMem');
    if (t1) t1.textContent = String(recVis.calls);
    if (t2) t2.textContent = String(memVis.calls);

    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    if (recVis) recVis.reset();
    if (memVis) memVis.reset();
    var t1 = document.getElementById('tabCallsRec');
    var t2 = document.getElementById('tabCallsMem');
    if (t1) t1.textContent = String(EXPECTED_REC_CALLS);
    if (t2) t2.textContent = String(EXPECTED_MEM_CALLS);
  }

  function init() {
    recVis = new RecVis();
    memVis = new MemVis();
  }

  var initDebounce = null;
  function scheduleInit() {
    if (isAnimating) return;
    clearTimeout(initDebounce);
    initDebounce = setTimeout(function() { init(); }, 30);
  }

  function wirePlatform() {
    if (window.FibReelAudio) window.FibReelAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) {
        animationSpeed = 850 - v;
      },
      onLayoutRefresh: scheduleInit,
      recordDownloadBasename: 'fibonacci-instagram-reel-1080x1920.webm'
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
