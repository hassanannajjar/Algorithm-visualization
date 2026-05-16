/**
 * Longest Common Subsequence — two strings, 2D DP table.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var S1 = 'AB';
  var S2 = 'ACB';
  var M = S1.length;
  var N = S2.length;
  var ROWS = M + 1;
  var COLS = N + 1;

  var CODE_LINES = [
    'for (let i = 1; i <= m; i++) {',
    '  for (let j = 1; j <= n; j++) {',
    '    if (text1[i-1] === text2[j-1])',
    '      dp[i][j] = dp[i-1][j-1] + 1;',
    '    else',
    '      dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);',
    '  }',
    '}',
    'return dp[m][n];'
  ];

  var animationSpeed = 280;
  var isAnimating = false;
  var dpFull = [];
  var steps = [];
  var stepIndex = 0;
  var canvasInfo = null;
  var rafId = null;

  function buildDpTable() {
    var dp = [];
    for (var i = 0; i < ROWS; i++) {
      dp[i] = [];
      for (var j = 0; j < COLS; j++) dp[i][j] = 0;
    }
    for (var i = 1; i < ROWS; i++) {
      for (var j = 1; j < COLS; j++) {
        if (S1[i - 1] === S2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp;
  }

  function cloneDp(d) { return JSON.parse(JSON.stringify(d)); }

  function emptyDp() {
    var dp = [];
    for (var i = 0; i < ROWS; i++) {
      dp[i] = [];
      for (var j = 0; j < COLS; j++) dp[i][j] = -1;
    }
    return dp;
  }

  function buildSteps() {
    var out = [];
    var dp = emptyDp();

    out.push({
      line: -1,
      explain: 'Two strings — longest common subsequence. Not substring: order matters, gaps allowed. Rows = text1, cols = text2.',
      filled: cloneDp(dp),
      cur: null,
      refs: [],
      matched: false
    });

    out.push({
      line: 0,
      explain: 'Build dp[i][j] = LCS length for text1[0..i-1] and text2[0..j-1]. Only lengths — no path needed.',
      filled: cloneDp(dp),
      cur: null,
      refs: [],
      matched: false
    });

    for (var i = 0; i < ROWS; i++) {
      for (var j = 0; j < COLS; j++) {
        if (i === 0 && j === 0) {
          dp[i][j] = 0;
          out.push({
            line: 0,
            explain: 'dp[0][0] = 0 — empty prefixes.',
            filled: cloneDp(dp),
            cur: { r: i, c: j },
            refs: [],
            writeVal: 0,
            matched: false
          });
          continue;
        }
        if (i === 0) {
          dp[i][j] = 0;
          out.push({
            line: 0,
            explain: 'First row: no chars from text1 → dp[0][' + j + '] = 0.',
            filled: cloneDp(dp),
            cur: { r: i, c: j },
            refs: [],
            writeVal: 0
          });
          continue;
        }
        if (j === 0) {
          dp[i][j] = 0;
          out.push({
            line: 0,
            explain: 'First column: no chars from text2 → dp[' + i + '][0] = 0.',
            filled: cloneDp(dp),
            cur: { r: i, c: j },
            refs: [],
            writeVal: 0
          });
          continue;
        }

        var c1 = S1[i - 1];
        var c2 = S2[j - 1];
        var match = c1 === c2;

        if (match) {
          var diag = dp[i - 1][j - 1];
          out.push({
            line: 2,
            explain: 'Compare text1[' + (i - 1) + ']="' + c1 + '" vs text2[' + (j - 1) + ']="' + c2 + '" — MATCH.',
            filled: cloneDp(dp),
            cur: { r: i, c: j },
            refs: [{ r: i - 1, c: j - 1, kind: 'diag' }],
            c1: c1,
            c2: c2,
            matched: true
          });
          var val = diag + 1;
          dp[i][j] = val;
          out.push({
            line: 3,
            explain: 'Diagonal +1 → dp[' + i + '][' + j + '] = dp[' + (i - 1) + '][' + (j - 1) + ']+1 = ' + diag + '+1 = ' + val + '.',
            filled: cloneDp(dp),
            cur: { r: i, c: j },
            refs: [{ r: i - 1, c: j - 1, kind: 'diag' }],
            writeVal: val,
            diag: diag,
            matched: true
          });
        } else {
          var up = dp[i - 1][j];
          var left = dp[i][j - 1];
          var pick = up >= left ? 'up' : 'left';
          out.push({
            line: 4,
            explain: '"' + c1 + '" ≠ "' + c2 + '" — no match. Take max(↑, ←).',
            filled: cloneDp(dp),
            cur: { r: i, c: j },
            refs: [{ r: i - 1, c: j, kind: 'up' }, { r: i, c: j - 1, kind: 'left' }],
            c1: c1,
            c2: c2,
            up: up,
            left: left,
            matched: false
          });
          var val = Math.max(up, left);
          dp[i][j] = val;
          out.push({
            line: 5,
            explain: 'dp[' + i + '][' + j + '] = max(' + up + ', ' + left + ') = ' + val + ' (from ' + pick + ').',
            filled: cloneDp(dp),
            cur: { r: i, c: j },
            refs: [{ r: i - 1, c: j, kind: 'up' }, { r: i, c: j - 1, kind: 'left' }],
            writeVal: val,
            up: up,
            left: left,
            pick: pick,
            matched: false
          });
        }
      }
    }

    out.push({
      line: 7,
      explain: 'return dp[m][n] → LCS length = ' + dp[M][N] + '. The table built the answer cell by cell — no path tracking needed.',
      filled: cloneDp(dp),
      cur: { r: M, c: N },
      refs: [],
      result: dp[M][N],
      matched: false
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('lcsProgressFill');
    if (el) el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('lcsCode');
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
    var nodes = document.querySelectorAll('.lcs-code .code-line');
    for (var i = 0; i < nodes.length; i++) {
      var idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step) {
    var idxEl = document.getElementById('lcsStepIndex');
    var totEl = document.getElementById('lcsStepTotal');
    var goalEl = document.getElementById('lcsGoal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'dp[' + M + '][' + N + ']';
    var resEl = document.getElementById('lcsResult');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var el = document.getElementById('lcsHeroLine');
    if (el) el.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('lcsVars');
    if (!el) return;
    if (!step || !step.cur) { el.innerHTML = ''; return; }
    var parts = [];
    if (step.c1 !== undefined) parts.push('t1=<span class="val">' + step.c1 + '</span>');
    if (step.c2 !== undefined) parts.push('t2=<span class="val">' + step.c2 + '</span>');
    if (step.matched) parts.push('<span class="chip-match">MATCH ↘</span>');
    if (step.diag !== undefined) parts.push('↘=<span class="val ref-diag">' + step.diag + '</span>');
    if (step.up !== undefined) parts.push('↑=<span class="val ref-up">' + step.up + '</span>');
    if (step.left !== undefined) parts.push('←=<span class="val ref-left">' + step.left + '</span>');
    if (step.writeVal !== undefined) parts.push('=<span class="val">' + step.writeVal + '</span>');
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
    var canvas = document.getElementById('lcsGrid');
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

    var pad = 12;
    var headerH = 22;
    var labelW = 22;
    var gw = w - pad * 2 - labelW;
    var gh = h - pad * 2 - headerH;
    var gap = 5;
    var cellW = (gw - gap * (COLS - 1)) / COLS;
    var cellH = (gh - gap * (ROWS - 1)) / ROWS;

    function cellXY(r, c) {
      return {
        x: pad + labelW + c * (cellW + gap),
        y: pad + headerH + r * (cellH + gap)
      };
    }

    var refSet = {};
    for (var ri = 0; ri < refs.length; ri++) refSet[refs[ri].r + ',' + refs[ri].c] = refs[ri].kind;

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var c = 0; c < COLS; c++) {
      var hx = cellXY(0, c).x + cellW / 2;
      var hy = pad + headerH / 2;
      var ch = c === 0 ? '∅' : S2[c - 1];
      ctx.fillStyle = c === 0 ? 'rgba(150,150,170,0.7)' : 'rgba(167, 139, 250, 0.95)';
      ctx.fillText(ch, hx, hy);
    }
    ctx.textAlign = 'right';
    for (var r = 0; r < ROWS; r++) {
      var ly = cellXY(r, 0).y + cellH / 2;
      var ch = r === 0 ? '∅' : S1[r - 1];
      ctx.fillStyle = r === 0 ? 'rgba(150,150,170,0.7)' : 'rgba(244, 114, 182, 0.95)';
      ctx.fillText(ch, pad + labelW - 4, ly);
    }

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var xy = cellXY(r, c);
        var val = filled[r][c];
        var hasVal = val >= 0;
        var isCur = cur && cur.r === r && cur.c === c;
        var kind = refSet[r + ',' + c];
        var isGoal = r === M && c === N;

        var fill = 'rgba(40, 38, 58, 0.85)';
        var stroke = 'rgba(80, 78, 100, 0.5)';
        var glow = null;

        if (!hasVal) fill = 'rgba(28, 26, 40, 0.7)';
        else if (kind === 'diag') {
          fill = 'rgba(74, 222, 128, 0.4)';
          stroke = 'rgba(134, 239, 172, 0.9)';
          glow = 'rgba(74, 222, 128, 0.35)';
        } else if (kind === 'up') {
          fill = 'rgba(244, 114, 182, 0.35)';
          stroke = 'rgba(244, 114, 182, 0.85)';
        } else if (kind === 'left') {
          fill = 'rgba(167, 139, 250, 0.35)';
          stroke = 'rgba(167, 139, 250, 0.85)';
        } else if (isCur) {
          fill = 'rgba(255, 255, 255, 0.95)';
          stroke = 'rgba(45, 212, 191, 1)';
          glow = 'rgba(45, 212, 191, 0.5)';
        } else if (hasVal) {
          fill = 'rgba(196, 210, 255, 0.5)';
          stroke = 'rgba(129, 140, 200, 0.4)';
        }
        if (isGoal && hasVal) stroke = 'rgba(251, 191, 36, 0.9)';

        ctx.save();
        if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = isCur ? 16 : 10; }
        roundRect(ctx, xy.x, xy.y, cellW, cellH, 6);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = isCur ? 2.2 : 1.2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        ctx.restore();

        if (hasVal) {
          ctx.font = '800 ' + Math.min(20, cellW * 0.42) + 'px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isCur ? '#0f172a' : 'rgba(248, 250, 255, 0.95)';
          ctx.fillText(String(val), xy.x + cellW / 2, xy.y + cellH / 2);
        }
      }
    }

    if (cur && refs.length > 0) {
      var cxy = cellXY(cur.r, cur.c);
      var cx = cxy.x + cellW / 2;
      var cy = cxy.y + cellH / 2;
      for (var k = 0; k < refs.length; k++) {
        var ref = refs[k];
        var rxy = cellXY(ref.r, ref.c);
        var rx = rxy.x + cellW / 2;
        var ry = rxy.y + cellH / 2;
        ctx.save();
        if (ref.kind === 'diag') ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
        else if (ref.kind === 'up') ctx.strokeStyle = 'rgba(244, 114, 182, 0.75)';
        else ctx.strokeStyle = 'rgba(167, 139, 250, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash(ref.kind === 'diag' ? [] : [4, 3]);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.textAlign = 'left';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(248, 250, 255, 0.9)';
    ctx.fillText('LCS table · ' + M + '×' + N, pad, 2);
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
    if (window.LcsLineAudio) window.LcsLineAudio.unlock();
    steps = buildSteps();
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.LcsLineAudio) window.LcsLineAudio.step(steps[0].line, steps[0].matched);
    await sleep(260);
    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.LcsLineAudio) window.LcsLineAudio.step(steps[stepIndex].line, steps[stepIndex].matched);
      await sleep(animationSpeed);
    }
    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.LcsLineAudio) window.LcsLineAudio.playComplete();
    await sleep(280);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    dpFull = buildDpTable();
    steps = buildSteps();
    stepIndex = 0;
    renderCodeDOM();
    applyStep(steps[0]);
    setStats(steps[0]);
    var resEl = document.getElementById('lcsResult');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    var hint = document.getElementById('lcsChartHint');
    if (hint) hint.textContent = M + '×' + N;
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
    if (window.LcsLineAudio) window.LcsLineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) { animationSpeed = 850 - v; },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'lcs-longest-common-subsequence-instagram-reel-1080x1920'
    });
    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        dpFull = buildDpTable();
        if (window.LcsLineAudio) window.LcsLineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.lcs-panels-row');
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
