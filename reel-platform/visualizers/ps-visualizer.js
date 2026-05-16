/**
 * Palindromic Substrings — expand outward on upper-triangle DP.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var S = 'aaa';
  var N = S.length;

  var CODE_LINES = [
    'let count = 0;',
    'for (let L = 0; L < n; L++) {',
    '  for (let i = 0; i < n - L; i++) {',
    '    let j = i + L;',
    '    if (s[i] === s[j] && (L < 2 || dp[i+1][j-1])) {',
    '      dp[i][j] = true; count++;',
    '    }',
    '  }',
    '}',
    'return count;'
  ];

  var animationSpeed = 280;
  var isAnimating = false;
  var dpFull = [];
  var countFull = 0;
  var steps = [];
  var stepIndex = 0;
  var canvasInfo = null;
  var rafId = null;

  function buildDpTable() {
    var dp = [];
    var i, j, L;
    for (i = 0; i < N; i++) {
      dp[i] = [];
      for (j = 0; j < N; j++) dp[i][j] = false;
    }
    var count = 0;
    for (L = 0; L < N; L++) {
      for (i = 0; i < N - L; i++) {
        j = i + L;
        if (S[i] === S[j] && (L < 2 || dp[i + 1][j - 1])) {
          dp[i][j] = true;
          count++;
        }
      }
    }
    return { dp: dp, count: count };
  }

  function cloneGrid(g) {
    return JSON.parse(JSON.stringify(g));
  }

  function emptyGrid() {
    var g = [];
    var i, j;
    for (i = 0; i < N; i++) {
      g[i] = [];
      for (j = 0; j < N; j++) g[i][j] = null;
    }
    return g;
  }

  function buildSteps() {
    var out = [];
    var grid = emptyGrid();
    var runCount = 0;
    var i, j, L, c1, c2, innerOk, ok, len;

    out.push({
      line: -1,
      explain: 'Count all palindromic substrings. Different from subsequence — substring must be contiguous.',
      filled: cloneGrid(grid),
      cur: null,
      refs: [],
      count: 0,
      matched: false
    });

    out.push({
      line: 0,
      explain: 'Expand outward: fill dp[i][j] by substring length L = j − i. Short lengths first.',
      filled: cloneGrid(grid),
      cur: null,
      refs: [],
      count: 0,
      matched: false
    });

    for (L = 0; L < N; L++) {
      len = L + 1;
      out.push({
        line: 1,
        explain: 'Length L = ' + L + ' (substrings of ' + len + ' char' + (len > 1 ? 's' : '') + ').',
        filled: cloneGrid(grid),
        cur: null,
        refs: [],
        count: runCount,
        matched: false,
        spanLen: L
      });

      for (i = 0; i < N - L; i++) {
        j = i + L;
        c1 = S[i];
        c2 = S[j];
        innerOk = L < 2 ? true : grid[i + 1][j - 1] === true;
        var refs = [];
        if (L > 2) refs.push({ r: i + 1, c: j - 1, kind: 'inner' });

        out.push({
          line: 3,
          explain: 'Cell [' + i + '][' + j + '] → s[' + i + ']="' + c1 + '", s[' + j + ']="' + c2 + '"' + (L > 2 ? ' · check inner [' + (i + 1) + '][' + (j - 1) + ']' : '') + '.',
          filled: cloneGrid(grid),
          cur: { r: i, c: j },
          refs: refs,
          c1: c1,
          c2: c2,
          len: L,
          innerOk: innerOk,
          count: runCount,
          matched: c1 === c2
        });

        ok = c1 === c2 && innerOk;
        if (ok) {
          grid[i][j] = true;
          runCount++;
          out.push({
            line: 4,
            explain: 'Match' + (L > 2 ? ' + inner palindrome' : '') + ' → "' + S.substring(i, j + 1) + '" is a palindrome. count = ' + runCount + '.',
            filled: cloneGrid(grid),
            cur: { r: i, c: j },
            refs: refs,
            writeVal: true,
            substr: S.substring(i, j + 1),
            count: runCount,
            matched: true
          });
        } else {
          grid[i][j] = false;
          var why = c1 !== c2 ? 'ends differ' : 'inner not palindrome';
          out.push({
            line: 4,
            explain: 'Not a palindrome (' + why + '). count stays ' + runCount + '.',
            filled: cloneGrid(grid),
            cur: { r: i, c: j },
            refs: refs,
            writeVal: false,
            count: runCount,
            matched: false
          });
        }
      }
    }

    out.push({
      line: 7,
      explain: 'return count → ' + runCount + ' palindromic substrings in "' + S + '". Every confirmed cell unlocks bigger spans.',
      filled: cloneGrid(grid),
      cur: null,
      refs: [],
      result: runCount,
      count: runCount,
      matched: false
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('psProgressFill');
    if (el) el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('psCode');
    if (!pre) return;
    pre.innerHTML = '';
    var i, row;
    for (i = 0; i < CODE_LINES.length; i++) {
      row = document.createElement('div');
      row.className = 'code-line';
      row.setAttribute('data-line-idx', String(i));
      row.textContent = CODE_LINES[i];
      pre.appendChild(row);
    }
  }

  function setLineHighlight(lineIdx) {
    var nodes = document.querySelectorAll('.ps-code .code-line');
    var i, idx;
    for (i = 0; i < nodes.length; i++) {
      idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step) {
    var idxEl = document.getElementById('psStepIndex');
    var totEl = document.getElementById('psStepTotal');
    var goalEl = document.getElementById('psGoal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'count';
    var resEl = document.getElementById('psResult');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else if (step && step.count !== undefined) resEl.textContent = String(step.count);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var el = document.getElementById('psHeroLine');
    if (el) el.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('psVars');
    if (!el) return;
    if (!step || !step.cur) { el.innerHTML = ''; return; }
    var parts = [];
    if (step.c1 !== undefined) {
      parts.push('s[i]=<span class="val">' + step.c1 + '</span>');
      parts.push('s[j]=<span class="val">' + step.c2 + '</span>');
    }
    if (step.len !== undefined) parts.push('L=<span class="val">' + step.len + '</span>');
    if (step.innerOk !== undefined && step.len > 2) {
      parts.push(step.innerOk ? '<span class="chip-inner">INNER ✓</span>' : '<span class="chip-nope">INNER ✗</span>');
    }
    if (step.writeVal === true) parts.push('<span class="chip-yes">PAL ✓</span>');
    if (step.writeVal === false) parts.push('<span class="chip-no">—</span>');
    if (step.count !== undefined) parts.push('count=<span class="val">' + step.count + '</span>');
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
    var canvas = document.getElementById('psGrid');
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
    var cellMin = 44;
    var gridMinH = 12 + 22 + N * cellMin + (N - 1) * 4 + 14;
    rh = Math.max(260, rh, gridMinH);
    canvas.style.minHeight = gridMinH + 'px';
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
    var i, j, r, c;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(5, 4, 14, 0.35)';
    ctx.fillRect(0, 0, w, h);

    var pad = 12;
    var headerH = 22;
    var labelW = 22;
    var gw = w - pad * 2 - labelW;
    var gh = h - pad * 2 - headerH;
    var gap = 4;
    var cellW = (gw - gap * (N - 1)) / N;
    var cellH = (gh - gap * (N - 1)) / N;

    function cellXY(row, col) {
      return {
        x: pad + labelW + col * (cellW + gap),
        y: pad + headerH + row * (cellH + gap)
      };
    }

    var refSet = {};
    for (i = 0; i < refs.length; i++) refSet[refs[i].r + ',' + refs[i].c] = refs[i].kind;

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (c = 0; c < N; c++) {
      ctx.fillStyle = 'rgba(244, 114, 182, 0.95)';
      ctx.fillText(S[c], cellXY(0, c).x + cellW / 2, pad + headerH / 2);
    }
    ctx.textAlign = 'right';
    for (r = 0; r < N; r++) {
      ctx.fillStyle = 'rgba(244, 114, 182, 0.95)';
      ctx.fillText(S[r], pad + labelW - 4, cellXY(r, 0).y + cellH / 2);
    }

    for (r = 0; r < N; r++) {
      for (c = 0; c < N; c++) {
        var xy = cellXY(r, c);
        var val = filled[r][c];
        var inTri = r <= c;
        var hasVal = val !== null && inTri;
        var isCur = cur && cur.r === r && cur.c === c;
        var kind = refSet[r + ',' + c];

        var fill = 'rgba(22, 20, 32, 0.55)';
        var stroke = 'rgba(60, 58, 78, 0.35)';
        var glow = null;

        if (!inTri) {
          fill = 'rgba(12, 10, 20, 0.25)';
          stroke = 'rgba(40, 38, 55, 0.2)';
        } else if (!hasVal) {
          fill = 'rgba(28, 26, 40, 0.7)';
        } else if (kind === 'inner') {
          fill = 'rgba(251, 191, 36, 0.45)';
          stroke = 'rgba(251, 191, 36, 0.9)';
          glow = 'rgba(251, 191, 36, 0.35)';
        } else if (val === true) {
          fill = isCur ? 'rgba(74, 222, 128, 0.65)' : 'rgba(74, 222, 128, 0.38)';
          stroke = 'rgba(134, 239, 172, 0.9)';
          if (isCur) glow = 'rgba(74, 222, 128, 0.45)';
        } else if (val === false) {
          fill = isCur ? 'rgba(80, 70, 90, 0.9)' : 'rgba(40, 38, 52, 0.75)';
          stroke = 'rgba(120, 110, 140, 0.5)';
        } else if (isCur) {
          fill = 'rgba(255, 255, 255, 0.95)';
          stroke = 'rgba(244, 114, 182, 1)';
          glow = 'rgba(244, 114, 182, 0.5)';
        }

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
          ctx.font = '800 ' + Math.min(18, cellW * 0.38) + 'px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isCur && val === true ? '#0f172a' : 'rgba(248, 250, 255, 0.92)';
          ctx.fillText(val ? '✓' : '·', xy.x + cellW / 2, xy.y + cellH / 2);
        } else if (inTri && !hasVal) {
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(120, 118, 140, 0.35)';
          ctx.fillText('?', xy.x + cellW / 2, xy.y + cellH / 2);
        }
      }
    }

    if (cur && refs.length > 0) {
      var cxy = cellXY(cur.r, cur.c);
      var cx = cxy.x + cellW / 2;
      var cy = cxy.y + cellH / 2;
      for (i = 0; i < refs.length; i++) {
        var ref = refs[i];
        var rxy = cellXY(ref.r, ref.c);
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(rxy.x + cellW / 2, rxy.y + cellH / 2);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.textAlign = 'left';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(248, 250, 255, 0.9)';
    ctx.fillText('Palindromic substrings · "' + S + '" · expand by length', pad, 2);
  }

  function roundRect(ctx, x, y, rw, rh, rad) {
    rad = Math.min(rad, rw / 2, rh / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + rw - rad, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + rad);
    ctx.lineTo(x + rw, y + rh - rad);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - rad, y + rh);
    ctx.lineTo(x + rad, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function sleep(ms) { return new Promise(function(res) { setTimeout(res, ms); }); }

  async function doPlay() {
    if (isAnimating) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.PsLineAudio) window.PsLineAudio.unlock();
    steps = buildSteps();
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.PsLineAudio) window.PsLineAudio.step(steps[0].line, steps[0].matched);
    await sleep(260);
    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.PsLineAudio) window.PsLineAudio.step(steps[stepIndex].line, steps[stepIndex].matched);
      await sleep(animationSpeed);
    }
    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.PsLineAudio) window.PsLineAudio.playComplete();
    await sleep(280);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    var built = buildDpTable();
    dpFull = built.dp;
    countFull = built.count;
    steps = buildSteps();
    stepIndex = 0;
    renderCodeDOM();
    applyStep(steps[0]);
    setStats(steps[0]);
    var resEl = document.getElementById('psResult');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    var hint = document.getElementById('psChartHint');
    if (hint) hint.textContent = N + '×' + N;
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
    if (window.PsLineAudio) window.PsLineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) { animationSpeed = 850 - v; },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'palindromic-substrings-instagram-reel-1080x1920'
    });
    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        var built = buildDpTable();
        dpFull = built.dp;
        countFull = built.count;
        if (window.PsLineAudio) window.PsLineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.ps-panels-row');
        if (host && typeof ResizeObserver !== 'undefined') {
          new ResizeObserver(scheduleResize).observe(host);
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
