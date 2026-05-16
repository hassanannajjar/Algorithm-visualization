/**
 * Pattern 3 — Grid 2D DP (Unique Paths): grid fill + line-by-line code.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var ROWS = 3;
  var COLS = 4;
  var CODE_LINES = [
    'const dp = Array(m).fill(0).map(() => Array(n).fill(0));',
    'for (let i = 0; i < m; i++) dp[i][0] = 1;',
    'for (let j = 0; j < n; j++) dp[0][j] = 1;',
    'for (let i = 1; i < m; i++) {',
    '  for (let j = 1; j < n; j++) {',
    '    dp[i][j] = dp[i-1][j] + dp[i][j-1];',
    '  }',
    '}',
    'return dp[m-1][n-1];'
  ];

  var animationSpeed = 280;
  var isAnimating = false;
  var dpFull = [];
  var steps = [];
  var stepIndex = 0;
  var canvasInfo = null;
  var rafId = null;

  function buildDpTable(m, n) {
    var dp = [];
    for (var r = 0; r < m; r++) {
      dp[r] = [];
      for (var c = 0; c < n; c++) dp[r][c] = 0;
    }
    for (var i = 0; i < m; i++) dp[i][0] = 1;
    for (var j = 0; j < n; j++) dp[0][j] = 1;
    for (var ri = 1; ri < m; ri++) {
      for (var cj = 1; cj < n; cj++) {
        dp[ri][cj] = dp[ri - 1][cj] + dp[ri][cj - 1];
      }
    }
    return dp;
  }

  function buildSteps() {
    var m = ROWS;
    var n = COLS;
    var out = [];
    var dp = [];
    for (var r = 0; r < m; r++) {
      dp[r] = [];
      for (var c = 0; c < n; c++) dp[r][c] = -1;
    }

    out.push({
      line: -1,
      explain: '1D DP is one row of decisions. 2D DP is a grid — every cell looks ↑ above and ← left. Same thinking, new dimension.',
      filled: JSON.parse(JSON.stringify(dp)),
      cur: null,
      refs: []
    });

    out.push({
      line: 0,
      explain: 'Create an m×n table. We\'ll fill paths from start (0,0) to goal (' + (m - 1) + ',' + (n - 1) + ').',
      filled: JSON.parse(JSON.stringify(dp)),
      cur: null,
      refs: []
    });

    for (var i = 0; i < m; i++) {
      dp[i][0] = 1;
      out.push({
        line: 1,
        explain: 'First column: only one way down → dp[' + i + '][0] = 1.',
        filled: JSON.parse(JSON.stringify(dp)),
        cur: { r: i, c: 0 },
        refs: [],
        writeVal: 1
      });
    }

    for (var j = 1; j < n; j++) {
      dp[0][j] = 1;
      out.push({
        line: 2,
        explain: 'First row: only one way right → dp[0][' + j + '] = 1.',
        filled: JSON.parse(JSON.stringify(dp)),
        cur: { r: 0, c: j },
        refs: [],
        writeVal: 1
      });
    }

    out.push({
      line: 3,
      explain: 'Bases done. Now fill the rest — each inner cell uses ↑ + ←.',
      filled: JSON.parse(JSON.stringify(dp)),
      cur: null,
      refs: []
    });

    for (var ri = 1; ri < m; ri++) {
      for (var cj = 1; cj < n; cj++) {
        var up = dp[ri - 1][cj];
        var left = dp[ri][cj - 1];
        out.push({
          line: 4,
          explain: 'Cell (' + ri + ',' + cj + '): read dp[' + (ri - 1) + '][' + cj + ']=' + up + ' (↑) and dp[' + ri + '][' + (cj - 1) + ']=' + left + ' (←).',
          filled: JSON.parse(JSON.stringify(dp)),
          cur: { r: ri, c: cj },
          refs: [{ r: ri - 1, c: cj, kind: 'up' }, { r: ri, c: cj - 1, kind: 'left' }],
          up: up,
          left: left
        });
        var sum = up + left;
        dp[ri][cj] = sum;
        out.push({
          line: 5,
          explain: 'dp[' + ri + '][' + cj + '] = ' + up + ' + ' + left + ' = ' + sum + '.',
          filled: JSON.parse(JSON.stringify(dp)),
          cur: { r: ri, c: cj },
          refs: [{ r: ri - 1, c: cj, kind: 'up' }, { r: ri, c: cj - 1, kind: 'left' }],
          writeVal: sum,
          up: up,
          left: left
        });
      }
    }

    out.push({
      line: 6,
      explain: 'return dp[m-1][n-1] → ' + dp[m - 1][n - 1] + ' paths. The table grew in two directions — the logic stayed the same.',
      filled: JSON.parse(JSON.stringify(dp)),
      cur: { r: m - 1, c: n - 1 },
      refs: [],
      result: dp[m - 1][n - 1]
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('gdProgressFill');
    if (el) el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('gdCode');
    if (!pre) return;
    pre.innerHTML = '';
    for (var i = 0; i < CODE_LINES.length; i++) {
      var row = document.createElement('div');
      row.className = 'code-line';
      row.setAttribute('data-line-idx', String(i));
      row.textContent = CODE_LINES[i];
      pre.appendChild(row);
    }
  }

  function setLineHighlight(lineIdx) {
    var nodes = document.querySelectorAll('.gd-code .code-line');
    for (var i = 0; i < nodes.length; i++) {
      var idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step) {
    var idxEl = document.getElementById('gdStepIndex');
    var totEl = document.getElementById('gdStepTotal');
    var goalEl = document.getElementById('gdGoal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'dp[' + (ROWS - 1) + '][' + (COLS - 1) + ']';
    var resEl = document.getElementById('gdResult');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var hero = document.getElementById('gdHeroLine');
    if (hero) hero.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('gdVars');
    if (!el) return;
    if (!step || (step.up === undefined && !step.cur)) {
      el.innerHTML = '';
      return;
    }
    var parts = [];
    if (step.cur) parts.push('(' + step.cur.r + ',' + step.cur.c + ')');
    if (step.up !== undefined) parts.push('↑=<span class="val ref-up">' + step.up + '</span>');
    if (step.left !== undefined) parts.push('←=<span class="val ref-left">' + step.left + '</span>');
    if (step.writeVal !== undefined && step.up === undefined) parts.push('=<span class="val">' + step.writeVal + '</span>');
    if (step.up !== undefined && step.left !== undefined && step.writeVal === undefined) {
      parts.push('sum=<span class="val">' + (step.up + step.left) + '</span>');
    }
    el.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  function applyStep(step) {
    setHeroExplain(step.explain);
    setLineHighlight(step.line);
    setVars(step);
    setStats(step);
    paintGrid(step);
    if (steps.length > 1) setProgress(stepIndex / (steps.length - 1));
    else setProgress(0);
  }

  function setupCanvas() {
    var canvas = document.getElementById('gdGrid');
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rw = canvas.clientWidth || canvas.offsetWidth;
    var rh = canvas.clientHeight || canvas.offsetHeight;
    if (rw < 8 || rh < 8) {
      var par = canvas.parentElement;
      if (par) {
        rw = Math.max(rw, par.clientWidth || 0);
        rh = Math.max(rh, par.clientHeight || 0);
      }
    }
    rw = Math.max(200, rw);
    rh = Math.max(240, rh);
    canvas.width = Math.round(rw * dpr);
    canvas.height = Math.round(rh * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: rw, h: rh };
  }

  function paintGrid(step) {
    step = step || {};
    if (!canvasInfo) canvasInfo = setupCanvas();
    if (!canvasInfo) return;
    var ctx = canvasInfo.ctx;
    var w = canvasInfo.w;
    var h = canvasInfo.h;
    var filled = step.filled || dpFull;
    var cur = step.cur;
    var refs = step.refs || [];

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(5, 4, 14, 0.35)';
    ctx.fillRect(0, 0, w, h);

    var pad = 14;
    var labelTop = 18;
    var gw = w - pad * 2;
    var gh = h - pad * 2 - labelTop;
    var gap = 6;
    var cellW = (gw - gap * (COLS - 1)) / COLS;
    var cellH = (gh - gap * (ROWS - 1)) / ROWS;

    function cellXY(r, c) {
      return {
        x: pad + c * (cellW + gap),
        y: pad + labelTop + r * (cellH + gap)
      };
    }

    var refSet = {};
    for (var i = 0; i < refs.length; i++) {
      refSet[refs[i].r + ',' + refs[i].c] = refs[i].kind;
    }

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var xy = cellXY(r, c);
        var val = filled[r][c];
        var hasVal = val >= 0;
        var isCur = cur && cur.r === r && cur.c === c;
        var refKind = refSet[r + ',' + c];
        var isStart = r === 0 && c === 0;
        var isGoal = r === ROWS - 1 && c === COLS - 1;

        var fill = 'rgba(40, 38, 58, 0.85)';
        var stroke = 'rgba(80, 78, 100, 0.5)';
        var glow = null;

        if (!hasVal) {
          fill = 'rgba(28, 26, 40, 0.7)';
        } else if (refKind === 'up') {
          fill = 'rgba(244, 114, 182, 0.35)';
          stroke = 'rgba(244, 114, 182, 0.85)';
          glow = 'rgba(244, 114, 182, 0.35)';
        } else if (refKind === 'left') {
          fill = 'rgba(167, 139, 250, 0.35)';
          stroke = 'rgba(167, 139, 250, 0.85)';
          glow = 'rgba(167, 139, 250, 0.35)';
        } else if (isCur) {
          fill = 'rgba(255, 255, 255, 0.95)';
          stroke = 'rgba(56, 189, 248, 1)';
          glow = 'rgba(56, 189, 248, 0.5)';
        } else if (hasVal) {
          fill = 'rgba(196, 210, 255, 0.55)';
          stroke = 'rgba(129, 140, 200, 0.45)';
        }

        if (isStart && hasVal) { stroke = 'rgba(74, 222, 128, 0.7)'; }
        if (isGoal && hasVal) { stroke = 'rgba(251, 191, 36, 0.85)'; }

        ctx.save();
        if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = isCur ? 18 : 12; }
        roundRect(ctx, xy.x, xy.y, cellW, cellH, 8);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = isCur ? 2.4 : 1.4;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        ctx.restore();

        if (hasVal) {
          ctx.font = '800 ' + Math.min(22, cellW * 0.38) + 'px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isCur ? '#0f172a' : 'rgba(248, 250, 255, 0.95)';
          ctx.fillText(String(val), xy.x + cellW / 2, xy.y + cellH / 2);
        } else {
          ctx.font = '600 ' + Math.min(14, cellW * 0.28) + 'px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(120, 118, 140, 0.5)';
          ctx.fillText('·', xy.x + cellW / 2, xy.y + cellH / 2);
        }
      }
    }

    if (cur && refs.length === 2) {
      var cxy = cellXY(cur.r, cur.c);
      var cx = cxy.x + cellW / 2;
      var cy = cxy.y + cellH / 2;
      for (var ri = 0; ri < refs.length; ri++) {
        var ref = refs[ri];
        var rxy = cellXY(ref.r, ref.c);
        var rx = rxy.x + cellW / 2;
        var ry = rxy.y + cellH / 2;
        ctx.save();
        ctx.strokeStyle = ref.kind === 'up' ? 'rgba(244, 114, 182, 0.75)' : 'rgba(167, 139, 250, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(200, 210, 235, 0.75)';
    ctx.textAlign = 'center';
    for (var cc = 0; cc < COLS; cc++) {
      var lx = pad + cc * (cellW + gap) + cellW / 2;
      ctx.fillText('c' + cc, lx, pad + 6);
    }
    ctx.textAlign = 'right';
    for (var rr = 0; rr < ROWS; rr++) {
      var ly = pad + labelTop + rr * (cellH + gap) + cellH / 2;
      ctx.fillText('r' + rr, pad - 4, ly);
    }

    ctx.textAlign = 'left';
    ctx.font = '800 12px Inter, sans-serif';
    var cap = ROWS + '×' + COLS + ' grid · robot → ↓→';
    ctx.fillStyle = 'rgba(248, 250, 255, 0.92)';
    ctx.fillText(cap, pad, 2);
  }

  function roundRect(ctx, x, y, w, h, rad) {
    rad = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  async function doPlay() {
    if (isAnimating) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.GdLineAudio) window.GdLineAudio.unlock();
    steps = buildSteps();
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.GdLineAudio) window.GdLineAudio.step(steps[0].line);
    await sleep(260);
    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.GdLineAudio) window.GdLineAudio.step(steps[stepIndex].line);
      await sleep(animationSpeed);
    }
    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.GdLineAudio) window.GdLineAudio.playComplete();
    await sleep(280);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    dpFull = buildDpTable(ROWS, COLS);
    steps = buildSteps();
    stepIndex = 0;
    renderCodeDOM();
    applyStep(steps[0]);
    setStats(steps[0]);
    var resEl = document.getElementById('gdResult');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    var hint = document.getElementById('gdChartHint');
    if (hint) hint.textContent = ROWS + '×' + COLS;
  }

  function scheduleResize() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function() {
      rafId = null;
      canvasInfo = setupCanvas();
      var cur = steps[stepIndex] || steps[0];
      if (cur) paintGrid(cur);
    });
  }

  function wirePlatform() {
    if (window.GdLineAudio) window.GdLineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) { animationSpeed = 850 - v; },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'grid-2d-dp-pattern-instagram-reel-1080x1920'
    });
    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        dpFull = buildDpTable(ROWS, COLS);
        if (window.GdLineAudio) window.GdLineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.gd-panels-row');
        if (host && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function() { scheduleResize(); });
          ro.observe(host);
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
