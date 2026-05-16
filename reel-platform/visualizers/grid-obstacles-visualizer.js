/**
 * Unique Paths II — grid with obstacles: same robot, one extra condition.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var ROWS = 3;
  var COLS = 4;
  var OBSTACLE = [
    [0, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 0]
  ];
  var CODE_LINES = [
    'for (let i = 0; i < m; i++) {',
    '  for (let j = 0; j < n; j++) {',
    '    if (grid[i][j] === 1) { dp[i][j] = 0; continue; }',
    '    if (i === 0 && j === 0) dp[i][j] = 1;',
    '    else if (i === 0) dp[i][j] = dp[i][j-1];',
    '    else if (j === 0) dp[i][j] = dp[i-1][j];',
    '    else dp[i][j] = dp[i-1][j] + dp[i][j-1];',
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

  function isObstacle(r, c) {
    return OBSTACLE[r][c] === 1;
  }

  function buildDpTable() {
    var dp = [];
    for (var r = 0; r < ROWS; r++) {
      dp[r] = [];
      for (var c = 0; c < COLS; c++) {
        if (isObstacle(r, c)) dp[r][c] = 0;
        else if (r === 0 && c === 0) dp[r][c] = 1;
        else if (r === 0) dp[r][c] = dp[r][c - 1];
        else if (c === 0) dp[r][c] = dp[r - 1][c];
        else dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
      }
    }
    return dp;
  }

  function cloneDp(dp) {
    return JSON.parse(JSON.stringify(dp));
  }

  function emptyDp() {
    var dp = [];
    for (var r = 0; r < ROWS; r++) {
      dp[r] = [];
      for (var c = 0; c < COLS; c++) dp[r][c] = -1;
    }
    return dp;
  }

  function buildSteps() {
    var out = [];
    var dp = emptyDp();

    out.push({
      line: -1,
      explain: 'Same grid. Same robot. Some cells are blocked — obstacle → 0 paths. No obstacle → ↑ + ← like before.',
      filled: cloneDp(dp),
      cur: null,
      refs: [],
      blocked: false
    });

    out.push({
      line: 0,
      explain: 'Double loop over every cell. One extra check: if grid[i][j] is an obstacle, skip the sum.',
      filled: cloneDp(dp),
      cur: null,
      refs: [],
      blocked: false
    });

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (isObstacle(r, c)) {
          dp[r][c] = 0;
          out.push({
            line: 2,
            explain: 'Cell (' + r + ',' + c + ') is blocked → dp[' + r + '][' + c + '] = 0. No paths through an obstacle.',
            filled: cloneDp(dp),
            cur: { r: r, c: c },
            refs: [],
            blocked: true,
            writeVal: 0
          });
          continue;
        }

        if (r === 0 && c === 0) {
          dp[r][c] = 1;
          out.push({
            line: 3,
            explain: 'Start cell (0,0) is clear → dp[0][0] = 1.',
            filled: cloneDp(dp),
            cur: { r: r, c: c },
            refs: [],
            blocked: false,
            writeVal: 1
          });
          continue;
        }

        var up = c > 0 || r > 0 ? (r > 0 ? dp[r - 1][c] : 0) : 0;
        var left = r > 0 || c > 0 ? (c > 0 ? dp[r][c - 1] : 0) : 0;
        var refs = [];
        if (r > 0) refs.push({ r: r - 1, c: c, kind: 'up' });
        if (c > 0) refs.push({ r: r, c: c - 1, kind: 'left' });

        if (r === 0) {
          out.push({
            line: 4,
            explain: 'First row: only from ← → dp[0][' + c + '] = dp[0][' + (c - 1) + '] = ' + left + '.',
            filled: cloneDp(dp),
            cur: { r: r, c: c },
            refs: refs,
            blocked: false,
            left: left
          });
          dp[r][c] = left;
          out.push({
            line: 4,
            explain: 'dp[0][' + c + '] = ' + left + '.',
            filled: cloneDp(dp),
            cur: { r: r, c: c },
            refs: refs,
            blocked: false,
            writeVal: left,
            left: left
          });
          continue;
        }

        if (c === 0) {
          out.push({
            line: 5,
            explain: 'First column: only from ↑ → dp[' + r + '][0] = dp[' + (r - 1) + '][0] = ' + up + '.',
            filled: cloneDp(dp),
            cur: { r: r, c: c },
            refs: refs,
            blocked: false,
            up: up
          });
          dp[r][c] = up;
          out.push({
            line: 5,
            explain: 'dp[' + r + '][0] = ' + up + '.',
            filled: cloneDp(dp),
            cur: { r: r, c: c },
            refs: refs,
            blocked: false,
            writeVal: up,
            up: up
          });
          continue;
        }

        out.push({
          line: 6,
          explain: 'Clear cell (' + r + ',' + c + '): ↑=' + up + ' + ←=' + left + '.',
          filled: cloneDp(dp),
          cur: { r: r, c: c },
          refs: refs,
          blocked: false,
          up: up,
          left: left
        });
        var sum = up + left;
        dp[r][c] = sum;
        out.push({
          line: 6,
          explain: 'dp[' + r + '][' + c + '] = ' + up + ' + ' + left + ' = ' + sum + '.',
          filled: cloneDp(dp),
          cur: { r: r, c: c },
          refs: refs,
          blocked: false,
          writeVal: sum,
          up: up,
          left: left
        });
      }
    }

    out.push({
      line: 7,
      explain: 'return dp[m-1][n-1] → ' + dp[ROWS - 1][COLS - 1] + ' paths. Constraints don\'t break DP — one more condition to check.',
      filled: cloneDp(dp),
      cur: { r: ROWS - 1, c: COLS - 1 },
      refs: [],
      blocked: false,
      result: dp[ROWS - 1][COLS - 1]
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('up2ProgressFill');
    if (el) el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('up2Code');
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
    var nodes = document.querySelectorAll('.up2-code .code-line');
    for (var i = 0; i < nodes.length; i++) {
      var idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step) {
    var idxEl = document.getElementById('up2StepIndex');
    var totEl = document.getElementById('up2StepTotal');
    var goalEl = document.getElementById('up2Goal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'dp[' + (ROWS - 1) + '][' + (COLS - 1) + ']';
    var resEl = document.getElementById('up2Result');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var hero = document.getElementById('up2HeroLine');
    if (hero) hero.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('up2Vars');
    if (!el) return;
    if (!step || (!step.cur && step.blocked !== true)) {
      el.innerHTML = '';
      return;
    }
    if (step.blocked) {
      el.innerHTML = '<span class="chip-block">BLOCKED → 0</span>';
      return;
    }
    var parts = [];
    if (step.cur) parts.push('(' + step.cur.r + ',' + step.cur.c + ')');
    if (step.up !== undefined) parts.push('↑=<span class="val ref-up">' + step.up + '</span>');
    if (step.left !== undefined) parts.push('←=<span class="val ref-left">' + step.left + '</span>');
    if (step.writeVal !== undefined && step.up === undefined) parts.push('=<span class="val">' + step.writeVal + '</span>');
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
    var canvas = document.getElementById('up2Grid');
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
      return { x: pad + c * (cellW + gap), y: pad + labelTop + r * (cellH + gap) };
    }

    var refSet = {};
    for (var i = 0; i < refs.length; i++) refSet[refs[i].r + ',' + refs[i].c] = refs[i].kind;

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var xy = cellXY(r, c);
        var blocked = isObstacle(r, c);
        var val = filled[r][c];
        var hasVal = val >= 0;
        var isCur = cur && cur.r === r && cur.c === c;
        var refKind = refSet[r + ',' + c];
        var isStart = r === 0 && c === 0;
        var isGoal = r === ROWS - 1 && c === COLS - 1;

        var fill = 'rgba(40, 38, 58, 0.85)';
        var stroke = 'rgba(80, 78, 100, 0.5)';
        var glow = null;

        if (blocked) {
          fill = 'rgba(28, 14, 18, 0.95)';
          stroke = 'rgba(248, 113, 113, 0.85)';
          if (isCur) glow = 'rgba(248, 113, 113, 0.55)';
        } else if (!hasVal) {
          fill = 'rgba(28, 26, 40, 0.7)';
        } else if (refKind === 'up') {
          fill = 'rgba(244, 114, 182, 0.35)';
          stroke = 'rgba(244, 114, 182, 0.85)';
          glow = 'rgba(244, 114, 182, 0.35)';
        } else if (refKind === 'left') {
          fill = 'rgba(167, 139, 250, 0.35)';
          stroke = 'rgba(167, 139, 250, 0.85)';
        } else if (isCur) {
          fill = 'rgba(255, 255, 255, 0.95)';
          stroke = 'rgba(56, 189, 248, 1)';
          glow = 'rgba(56, 189, 248, 0.5)';
        } else if (hasVal) {
          fill = 'rgba(196, 210, 255, 0.55)';
          stroke = 'rgba(129, 140, 200, 0.45)';
        }

        if (isStart && !blocked && hasVal) stroke = 'rgba(74, 222, 128, 0.7)';
        if (isGoal && !blocked && hasVal) stroke = 'rgba(251, 191, 36, 0.85)';

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

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (blocked) {
          ctx.font = '800 ' + Math.min(20, cellW * 0.35) + 'px "JetBrains Mono", monospace';
          ctx.fillStyle = isCur ? '#fecaca' : 'rgba(248, 113, 113, 0.75)';
          ctx.fillText('✕', xy.x + cellW / 2, xy.y + cellH / 2);
        } else if (hasVal) {
          ctx.font = '800 ' + Math.min(22, cellW * 0.38) + 'px "JetBrains Mono", monospace';
          ctx.fillStyle = isCur ? '#0f172a' : 'rgba(248, 250, 255, 0.95)';
          ctx.fillText(String(val), xy.x + cellW / 2, xy.y + cellH / 2);
        } else {
          ctx.font = '600 14px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(120, 118, 140, 0.5)';
          ctx.fillText('·', xy.x + cellW / 2, xy.y + cellH / 2);
        }
      }
    }

    if (cur && refs.length > 0 && !isObstacle(cur.r, cur.c)) {
      var cxy = cellXY(cur.r, cur.c);
      var cx = cxy.x + cellW / 2;
      var cy = cxy.y + cellH / 2;
      for (var ri = 0; ri < refs.length; ri++) {
        var ref = refs[ri];
        if (isObstacle(ref.r, ref.c)) continue;
        var rxy = cellXY(ref.r, ref.c);
        ctx.save();
        ctx.strokeStyle = ref.kind === 'up' ? 'rgba(244, 114, 182, 0.75)' : 'rgba(167, 139, 250, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(rxy.x + cellW / 2, rxy.y + cellH / 2);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(200, 210, 235, 0.75)';
    ctx.textAlign = 'center';
    for (var cc = 0; cc < COLS; cc++) {
      ctx.fillText('c' + cc, pad + cc * (cellW + gap) + cellW / 2, pad + 6);
    }
    ctx.textAlign = 'left';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(248, 250, 255, 0.92)';
    ctx.fillText(ROWS + '×' + COLS + ' · obstacle at (1,1)', pad, 2);
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
    if (window.Up2LineAudio) window.Up2LineAudio.unlock();
    steps = buildSteps();
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.Up2LineAudio) window.Up2LineAudio.step(steps[0].line, steps[0].blocked);
    await sleep(260);
    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.Up2LineAudio) window.Up2LineAudio.step(steps[stepIndex].line, steps[stepIndex].blocked);
      await sleep(animationSpeed);
    }
    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.Up2LineAudio) window.Up2LineAudio.playComplete();
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
    var resEl = document.getElementById('up2Result');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    var hint = document.getElementById('up2ChartHint');
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
    if (window.Up2LineAudio) window.Up2LineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) { animationSpeed = 850 - v; },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'unique-paths-ii-obstacles-instagram-reel-1080x1920'
    });
    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        dpFull = buildDpTable();
        if (window.Up2LineAudio) window.Up2LineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.up2-panels-row');
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
