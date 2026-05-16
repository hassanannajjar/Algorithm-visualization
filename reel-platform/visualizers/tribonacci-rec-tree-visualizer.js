/**
 * Recursive naive Tribonacci: ternary recursion tree + hover each code line to
 * highlight matching calls and show return / combination results.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var MAX_N = 7;
  var DEFAULT_N = 5;
  var CODE_LINES = [
    'if (n === 0) return 0;',
    'if (n === 1) return 1;',
    'if (n === 2) return 1;',
    'return trib(n - 1) + trib(n - 2) + trib(n - 3);'
  ];

  var targetN = DEFAULT_N;
  var root = null;
  var nodeMap = {};
  var nodeList = [];
  var canvasInfo = null;
  var hoverLine = -1;
  var isAnimating = false;
  var tourDelayMs = 500;
  var rafLoop = null;

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
      py: 0,
      lineKind: n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3
    };
    if (n === 0) {
      node.result = 0;
      return node;
    }
    if (n === 1) {
      node.result = 1;
      return node;
    }
    if (n === 2) {
      node.result = 1;
      return node;
    }
    node.children.push(buildTree(n - 1, depth + 1, path.concat(['p'])));
    node.children.push(buildTree(n - 2, depth + 1, path.concat(['q'])));
    node.children.push(buildTree(n - 3, depth + 1, path.concat(['r'])));
    node.result =
      node.children[0].result + node.children[1].result + node.children[2].result;
    return node;
  }

  function countNodes(node) {
    var c = 1;
    for (var i = 0; i < node.children.length; i++) c += countNodes(node.children[i]);
    return c;
  }

  function treeVisualDepth(node) {
    if (!node.children || node.children.length === 0) return 1;
    var m = 0;
    for (var i = 0; i < node.children.length; i++) {
      var d = treeVisualDepth(node.children[i]);
      if (d > m) m = d;
    }
    return 1 + m;
  }

  function layoutTree(node, x, y, spread, vStep) {
    node.px = x;
    node.py = y;
    if (node.children.length !== 3) return;
    var childSpread = spread * 0.5;
    layoutTree(node.children[0], x - spread, y + vStep, childSpread, vStep);
    layoutTree(node.children[1], x, y + vStep, childSpread, vStep);
    layoutTree(node.children[2], x + spread, y + vStep, childSpread, vStep);
  }

  function indexNodes(node, map) {
    map[node.id] = node;
    for (var i = 0; i < node.children.length; i++) indexNodes(node.children[i], map);
  }

  function collectNodes(node, arr) {
    arr.push(node);
    for (var i = 0; i < node.children.length; i++) collectNodes(node.children[i], arr);
  }

  function clampTreeToCanvasWidth(map, w, nodeR) {
    var pad = Math.max(nodeR + 10, 18);
    var minX = Infinity;
    var maxX = -Infinity;
    for (var id in map) {
      var n = map[id];
      if (n.px - pad < minX) minX = n.px - pad;
      if (n.px + pad > maxX) maxX = n.px + pad;
    }
    if (minX === Infinity) return;
    var span = maxX - minX;
    var avail = Math.max(40, w - 20);
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
    var bottomReserve = 20;
    var d = Math.max(2, depthNodes || 2);
    var segments = Math.max(1, d - 1);
    var maxR = Math.max(9, Math.min(13, w * 0.019));
    var topY = Math.max(18, Math.round(maxR + 10));
    var vStep = Math.round((h - topY - bottomReserve) / segments);
    vStep = Math.max(14, Math.min(100, vStep));
    var nr = Math.max(8, Math.min(12, w * 0.018));
    var nrActive = Math.min(nr + 3, 14);
    var edgePad = Math.round(Math.max(8, nr * 0.76));
    return { vStep: vStep, topY: topY, nr: nr, nrActive: nrActive, edgePad: edgePad };
  }

  function setupCanvas() {
    var canvas = document.getElementById('tribRecCanvas');
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
    rw = Math.max(120, rw);
    rh = Math.max(200, rh);
    canvas.width = Math.round(rw * dpr);
    canvas.height = Math.round(rh * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: rw, h: rh };
  }

  function nodeMatchesHover(n) {
    if (hoverLine < 0) return true;
    return n.lineKind === hoverLine;
  }

  function drawEdge(ctx, x1, y1, x2, y2, opt) {
    opt = opt || {};
    var col = opt.col || '#1a1a28';
    var wid = opt.wid != null ? opt.wid : 1.4;
    var alpha = opt.alpha != null ? opt.alpha : 1;
    var glow = opt.glow;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = col;
    ctx.lineWidth = wid;
    ctx.stroke();
    ctx.restore();
  }

  function drawNode(ctx, x, y, label, opt) {
    opt = opt || {};
    var r = opt.r || 14;
    ctx.save();
    ctx.globalAlpha = opt.alpha != null ? opt.alpha : 1;
    if (opt.glow) {
      ctx.shadowColor = opt.glow;
      ctx.shadowBlur = 22;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = opt.fill || '#0c0b12';
    ctx.fill();
    ctx.lineWidth = opt.strokeW != null ? opt.strokeW : 2.6;
    ctx.strokeStyle = opt.stroke || '#1a1a28';
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = opt.text || '#c4c4dd';
    var labelFs = Math.max(10, Math.round(r * 0.58));
    ctx.font = 'bold ' + labelFs + 'px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), x, y);
    if (opt.showRes && opt.res !== null && opt.res !== undefined) {
      var bubbleR = Math.max(7, Math.round(r * 0.38));
      var offX = r + Math.round(5 + r * 0.1);
      var offY = -r + Math.round(2 + r * 0.06);
      ctx.beginPath();
      ctx.arc(x + offX, y + offY, bubbleR, 0, Math.PI * 2);
      ctx.fillStyle = '#07060e';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = opt.stroke || '#1a1a28';
      ctx.stroke();
      ctx.fillStyle = opt.text || '#c4c4dd';
      var resFs = Math.max(8, Math.round(labelFs * 0.78));
      ctx.font = 'bold ' + resFs + 'px "JetBrains Mono", monospace';
      ctx.fillText(String(opt.res), x + offX, y + offY);
    }
    ctx.restore();
  }

  function drawTree() {
    if (!root || !canvasInfo) return;
    var ctx = canvasInfo.ctx;
    var w = canvasInfo.w;
    var h = canvasInfo.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(5, 4, 12, 0.92)';
    ctx.fillRect(0, 0, w, h);

    var geom = computeTreeGeom(w, h, treeVisualDepth(root));
    var nr = geom.nr;
    var dim = hoverLine >= 0;

    function drawSubtreeEdges(node) {
      for (var i = 0; i < node.children.length; i++) {
        var ch = node.children[i];
        var hot = nodeMatchesHover(node) || nodeMatchesHover(ch);
        var alpha = dim && !hot ? 0.07 : hot ? 0.95 : 0.32;
        var col = hot ? 'rgba(34, 211, 238, 0.85)' : '#252538';
        var glow = hot ? 'rgba(34, 211, 238, 0.5)' : null;
        var wid = hot ? 2 : 1.2;
        drawEdge(ctx, node.px, node.py + nr * 0.55, ch.px, ch.py - nr * 0.65, {
          col: col,
          alpha: alpha,
          wid: wid,
          glow: glow
        });
        drawSubtreeEdges(ch);
      }
    }
    drawSubtreeEdges(root);

    for (var i = 0; i < nodeList.length; i++) {
      var n = nodeList[i];
      var hot = nodeMatchesHover(n);
      var alpha = dim && !hot ? 0.2 : 1;
      var fill = hot ? 'rgba(34, 211, 238, 0.16)' : '#0c0b12';
      var stroke = hot ? 'rgba(34, 211, 238, 0.92)' : '#2a2840';
      var text = hot ? '#e8fdff' : '#6b6580';
      var glow = hot ? 'rgba(34, 211, 238, 0.55)' : null;
      drawNode(ctx, n.px, n.py, n.n, {
        r: hot ? geom.nrActive : nr,
        fill: fill,
        stroke: stroke,
        strokeW: hot ? 3 : 2.4,
        text: text,
        alpha: alpha,
        glow: glow,
        showRes: true,
        res: n.result
      });
    }
  }

  function updateExplain() {
    var box = document.getElementById('tribRecExplain');
    if (!box) return;

    if (hoverLine < 0) {
      box.innerHTML =
        '<span class="ex-line"></span>Hover any line in the code. The tree lights up every call ' +
        'that executes that line, and the bubbles show each call’s return value.';
      return;
    }

    var matches = nodeList.filter(function(n) { return n.lineKind === hoverLine; });
    var title = document.createElement('span');
    title.className = 'ex-line';
    title.textContent = 'Line ' + (hoverLine + 1) + ' · ' + CODE_LINES[hoverLine];

    var body = document.createElement('div');
    body.textContent = buildExplainBody(hoverLine, matches);

    box.innerHTML = '';
    box.appendChild(title);
    box.appendChild(body);
  }

  function buildExplainBody(lineIdx, matches) {
    var nCalls = matches.length;
    if (nCalls === 0) return 'No calls use this line for the current n.';

    if (lineIdx === 0) {
      return (
        'Base case: ' +
        nCalls +
        ' call(s) with n = 0. Each immediately returns 0 (shown in the bubble).'
      );
    }
    if (lineIdx === 1) {
      return (
        'Base case: ' +
        nCalls +
        ' call(s) with n = 1. Each returns 1.'
      );
    }
    if (lineIdx === 2) {
      return (
        'Base case: ' +
        nCalls +
        ' call(s) with n = 2. Each returns 1.'
      );
    }

    var internal = matches.filter(function(m) { return m.n >= 3; });
    internal.sort(function(a, b) { return a.n - b.n; });
    var v = internal[0];
    var c = v.children;
    var ex =
      'Recursive case: ' +
      nCalls +
      ' call(s) with n ≥ 3. Each waits for three subtrees, then returns their sum. ';
    ex +=
      'Smallest example here: trib(' +
      v.n +
      ') = trib(' +
      c[0].n +
      ')+trib(' +
      c[1].n +
      ')+trib(' +
      c[2].n +
      ') = ' +
      c[0].result +
      '+' +
      c[1].result +
      '+' +
      c[2].result +
      ' = ' +
      v.result +
      '.';
    return ex;
  }

  function syncCodeLineClasses() {
    var lines = document.querySelectorAll('#tribRecCode .code-line');
    for (var i = 0; i < lines.length; i++) {
      lines[i].classList.toggle('is-hover', parseInt(lines[i].getAttribute('data-line'), 10) === hoverLine);
    }
  }

  function setHoverLine(idx) {
    hoverLine = typeof idx === 'number' ? idx : -1;
    syncCodeLineClasses();
    updateExplain();
    drawTree();
  }

  function layoutAndDraw() {
    if (!root) return;
    canvasInfo = setupCanvas();
    if (!canvasInfo) return;
    var geom = computeTreeGeom(canvasInfo.w, canvasInfo.h, treeVisualDepth(root));
    var spread0 = Math.max(38, canvasInfo.w * 0.38);
    layoutTree(root, canvasInfo.w / 2, geom.topY, spread0, geom.vStep);
    clampTreeToCanvasWidth(nodeMap, canvasInfo.w, geom.nrActive);
    drawTree();
  }

  function refreshFromN() {
    var input = document.getElementById('tribRecN');
    if (input) targetN = clampN(input.value);
    if (input && String(targetN) !== input.value) input.value = String(targetN);

    root = buildTree(targetN);
    nodeMap = {};
    indexNodes(root, nodeMap);
    nodeList = [];
    collectNodes(root, nodeList);

    var cEl = document.getElementById('tribRecCount');
    var aEl = document.getElementById('tribRecAnswer');
    var nLbl = document.getElementById('tribRecNLabel');
    if (cEl) cEl.textContent = String(countNodes(root));
    if (aEl) aEl.textContent = String(root.result);
    if (nLbl) nLbl.textContent = String(targetN);

    hoverLine = -1;
    syncCodeLineClasses();
    layoutAndDraw();
    updateExplain();
  }

  function clampN(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) n = DEFAULT_N;
    return Math.max(0, Math.min(MAX_N, n));
  }

  function wireCodeHover() {
    var pre = document.getElementById('tribRecCode');
    if (!pre) return;
    pre.addEventListener('mousemove', function(e) {
      var line = e.target.closest('.code-line');
      var idx = line ? parseInt(line.getAttribute('data-line'), 10) : -1;
      if (idx !== hoverLine) setHoverLine(idx);
    });
    pre.addEventListener('mouseleave', function() {
      setHoverLine(-1);
    });
  }

  function renderCodeOnce() {
    var pre = document.getElementById('tribRecCode');
    if (!pre || pre.querySelector('.code-line')) return;
    pre.innerHTML = '';
    for (var i = 0; i < CODE_LINES.length; i++) {
      var div = document.createElement('div');
      div.className = 'code-line';
      div.setAttribute('data-num', String(i + 1));
      div.setAttribute('data-line', String(i));
      div.textContent = CODE_LINES[i];
      pre.appendChild(div);
    }
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  async function doPlayTour() {
    if (isAnimating) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    for (var i = 0; i < 4; i++) {
      setHoverLine(i);
      await sleep(tourDelayMs);
    }
    setHoverLine(-1);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    refreshFromN();
  }

  function scheduleResize() {
    if (rafLoop) cancelAnimationFrame(rafLoop);
    rafLoop = requestAnimationFrame(function() {
      rafLoop = null;
      layoutAndDraw();
    });
  }

  function wirePlatform() {
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlayTour,
      onReset: doReset,
      onSpeedInput: function(v) {
        tourDelayMs = Math.max(220, 920 - v);
      },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'tribonacci-recursive-tree-instagram-reel-1080x1920'
    });

    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        renderCodeOnce();
        wireCodeHover();
        refreshFromN();
        var host = document.querySelector('.trec-viz');
        if (host && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function() { scheduleResize(); });
          ro.observe(host);
        }
        var input = document.getElementById('tribRecN');
        if (input) input.addEventListener('change', function() { if (!isAnimating) refreshFromN(); });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wirePlatform);
  } else {
    wirePlatform();
  }
})();
