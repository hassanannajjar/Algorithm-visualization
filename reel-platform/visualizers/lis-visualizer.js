/**
 * Longest Increasing Subsequence — dp[i] = max(dp[j]+1) for nums[j] < nums[i].
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var NUMS = [1, 3, 2, 4];
  var nums = NUMS.slice();

  var CODE_LINES = [
    'for (let i = 0; i < n; i++) {',
    '  dp[i] = 1;',
    '  for (let j = 0; j < i; j++) {',
    '    if (nums[j] < nums[i])',
    '      dp[i] = Math.max(dp[i], dp[j] + 1);',
    '  }',
    '}',
    'return Math.max(...dp);'
  ];

  var animationSpeed = 300;
  var isAnimating = false;
  var dpFull = [];
  var steps = [];
  var stepIndex = 0;
  var canvasInfo = null;
  var rafId = null;

  function buildDpTable(arr) {
    var n = arr.length;
    var dp = [];
    var i, j;
    for (i = 0; i < n; i++) {
      dp[i] = 1;
      for (j = 0; j < i; j++) {
        if (arr[j] < arr[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
      }
    }
    return dp;
  }

  function maxDp(dp) {
    var m = 0;
    var k;
    for (k = 0; k < dp.length; k++) m = Math.max(m, dp[k]);
    return m;
  }

  function cloneDp(d) { return d ? d.slice() : []; }

  function emptyDp() {
    var out = [];
    var k;
    for (k = 0; k < nums.length; k++) out.push(null);
    return out;
  }

  function numsLabel() {
    return 'nums = [' + nums.join(', ') + ']';
  }

  function buildSteps() {
    var n = nums.length;
    var out = [];
    var dp = emptyDp();
    var i, j, cand, best, bestJ;

    out.push({
      line: -1,
      explain: 'Longest increasing subsequence — every element larger than the previous. Subsequence, not substring: gaps allowed.',
      dpSnap: cloneDp(dp),
      graphUpto: -1,
      pulse: -1,
      checkJ: -1,
      numsHi: [],
      extendJs: [],
      bestJ: -1
    });

    out.push({
      line: 0,
      explain: 'Non-constant transition: at each i, check every j before it. dp[i] = max(dp[j]+1) when nums[j] < nums[i].',
      dpSnap: cloneDp(dp),
      graphUpto: -1,
      pulse: -1,
      checkJ: -1,
      numsHi: [],
      extendJs: [],
      bestJ: -1
    });

    for (i = 0; i < n; i++) {
      out.push({
        line: 1,
        explain: 'i = ' + i + ' · nums[' + i + '] = ' + nums[i] + '. Start dp[' + i + '] = 1 (subsequence of length 1).',
        dpSnap: cloneDp(dp),
        graphUpto: i - 1,
        pulse: i,
        checkJ: -1,
        numsHi: [i],
        extendJs: [],
        bestJ: -1,
        i: i,
        dpVal: 1
      });

      dp[i] = 1;
      best = 1;
      bestJ = -1;
      var partial = cloneDp(dp);
      partial[i] = 1;

      for (j = 0; j < i; j++) {
        var ok = nums[j] < nums[i];
        cand = ok ? dp[j] + 1 : null;
        out.push({
          line: 3,
          explain: 'j = ' + j + ': nums[' + j + ']=' + nums[j] + (ok ? ' < ' : ' ≥ ') + 'nums[' + i + ']=' + nums[i] +
            (ok ? ' → candidate dp[' + j + ']+1 = ' + dp[j] + '+1 = ' + cand : ' → cannot extend.'),
          dpSnap: cloneDp(partial),
          graphUpto: i - 1,
          pulse: i,
          checkJ: j,
          numsHi: [i, j],
          extendJs: ok ? [j] : [],
          bestJ: bestJ,
          i: i,
          j: j,
          ok: ok,
          cand: cand,
          matched: ok
        });
        if (ok && cand > best) {
          best = cand;
          bestJ = j;
        }
      }

      dp[i] = best;
      partial[i] = best;
      out.push({
        line: 4,
        explain: 'dp[' + i + '] = ' + best + (bestJ >= 0 ? ' (extend from j=' + bestJ + ')' : ' (only itself)') + '.',
        dpSnap: cloneDp(partial),
        graphUpto: i,
        pulse: i,
        checkJ: bestJ,
        numsHi: [i],
        extendJs: bestJ >= 0 ? [bestJ] : [],
        bestJ: bestJ,
        i: i,
        dpVal: best,
        matched: bestJ >= 0
      });
    }

    var ans = maxDp(dp);
    out.push({
      line: 6,
      explain: 'return max(dp) → ' + ans + ' for ' + numsLabel() + '. Brute force is obvious; the DP insight is where learning happens.',
      dpSnap: dp.slice(),
      graphUpto: n - 1,
      pulse: n - 1,
      checkJ: -1,
      numsHi: [],
      extendJs: [],
      bestJ: -1,
      result: ans
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('lisProgressFill');
    if (el) el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('lisCode');
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
    var nodes = document.querySelectorAll('.lis-code .code-line');
    var i, idx;
    for (i = 0; i < nodes.length; i++) {
      idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step) {
    var idxEl = document.getElementById('lisStepIndex');
    var totEl = document.getElementById('lisStepTotal');
    var goalEl = document.getElementById('lisGoal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'max(dp)';
    var resEl = document.getElementById('lisResult');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var el = document.getElementById('lisHeroLine');
    if (el) el.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('lisVars');
    if (!el) return;
    if (!step || step.i === undefined && step.checkJ < 0) { el.innerHTML = ''; return; }
    var parts = [];
    if (step.i !== undefined) parts.push('i=<span class="val">' + step.i + '</span>');
    if (step.j !== undefined) parts.push('j=<span class="val">' + step.j + '</span>');
    if (step.cand !== undefined && step.cand !== null) parts.push('cand=<span class="val pick-extend">' + step.cand + '</span>');
    if (step.dpVal !== undefined) parts.push('dp[i]=<span class="val">' + step.dpVal + '</span>');
    if (step.ok === true) parts.push('<span class="lis-chip extend">EXTEND</span>');
    if (step.ok === false) parts.push('<span class="lis-chip skip">skip</span>');
    el.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  function setNumsStrip() {
    var el = document.getElementById('lisNumsStrip');
    if (el) el.textContent = numsLabel();
  }

  function applyStep(step) {
    setHeroExplain(step.explain);
    setLineHighlight(step.line);
    setVars(step);
    setStats(step);
    setNumsStrip();
    paintChart(step);
    if (steps.length > 1) setProgress(stepIndex / (steps.length - 1));
    else setProgress(0);
  }

  function setupCanvas() {
    var canvas = document.getElementById('lisGraph');
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
    rw = Math.max(120, rw);
    rh = Math.max(252, rh);
    canvas.width = Math.round(rw * dpr);
    canvas.height = Math.round(rh * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: rw, h: rh };
  }

  function roundBarTop(ctx, x, y, bw, bh, rad) {
    rad = Math.min(rad, bw / 2, bh);
    ctx.beginPath();
    ctx.moveTo(x, y + bh);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.lineTo(x + bw - rad, y);
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + rad);
    ctx.lineTo(x + bw, y + bh);
    ctx.closePath();
  }

  function paintChart(step) {
    step = step || {};
    if (!canvasInfo) canvasInfo = setupCanvas();
    if (!canvasInfo) return;
    var ctx = canvasInfo.ctx;
    var w = canvasInfo.w;
    var h = canvasInfo.h;
    var dpSnap = step.dpSnap || dpFull;
    var graphUpto = step.graphUpto != null ? step.graphUpto : -1;
    var pulse = step.pulse != null ? step.pulse : -1;
    var checkJ = step.checkJ != null ? step.checkJ : -1;
    var extendJs = step.extendJs || [];
    var bestJ = step.bestJ != null ? step.bestJ : -1;
    var numsHi = step.numsHi || [];

    var n = nums.length;
    var padL = 12;
    var padR = 12;
    var padT = 24;
    var padB = 38;
    var gw = w - padL - padR;
    var gh = h - padT - padB;
    var gap = Math.max(4, Math.round(gw / 70));
    var barW = n > 0 ? (gw - gap * (n - 1)) / n : gw;

    var yMax = 1;
    var k;
    for (k = 0; k < n; k++) {
      yMax = Math.max(yMax, dpFull[k] || 0, dpSnap[k] || 0, nums[k]);
    }

    function barX(idx) { return padL + idx * (barW + gap); }
    function barH(val) { return yMax <= 0 ? 0 : Math.max(4, (val / yMax) * (gh - 12)); }
    function barY(val) { return padT + gh - barH(val); }

    ctx.fillStyle = 'rgba(5, 4, 14, 0.25)';
    ctx.fillRect(0, 0, w, h);

    var hiSet = {};
    for (k = 0; k < numsHi.length; k++) hiSet[numsHi[k]] = true;
    var extSet = {};
    for (k = 0; k < extendJs.length; k++) extSet[extendJs[k]] = true;

    if (bestJ >= 0 && pulse >= 0) {
      var x0 = barX(bestJ) + barW / 2;
      var y0 = barY(dpSnap[bestJ] != null ? dpSnap[bestJ] : dpFull[bestJ] || 1) - 4;
      var x1 = barX(pulse) + barW / 2;
      var y1 = barY(dpSnap[pulse] != null ? dpSnap[pulse] : 1) - 4;
      ctx.save();
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.restore();
    }

    for (k = 0; k < n; k++) {
      var bx = barX(k);
      var isPast = graphUpto < 0 ? false : k <= graphUpto;
      var isPulse = pulse === k;
      var isCheck = checkJ === k;
      var isExt = extSet[k];
      var isBest = bestJ === k && pulse >= 0;

      var fVal = dpSnap[k];
      if (fVal == null && isPast) fVal = dpFull[k];
      var showDp = fVal != null;
      var bh = showDp ? barH(fVal) : barH(0.3);
      var by = barY(showDp ? fVal : 0.3);

      var fill = 'rgba(50, 48, 70, 0.55)';
      var stroke = 'rgba(60, 58, 82, 0.35)';
      var glow = null;

      if (showDp && isPulse) {
        fill = 'rgba(255, 255, 255, 0.92)';
        stroke = 'rgba(56, 189, 248, 1)';
        glow = 'rgba(56, 189, 248, 0.5)';
      } else if (isBest || isExt) {
        fill = 'rgba(74, 222, 128, 0.45)';
        stroke = 'rgba(134, 239, 172, 0.9)';
        glow = 'rgba(74, 222, 128, 0.35)';
      } else if (isCheck) {
        fill = 'rgba(251, 191, 36, 0.4)';
        stroke = 'rgba(251, 191, 36, 0.85)';
      } else if (showDp && isPast) {
        fill = 'rgba(196, 210, 255, 0.72)';
        stroke = 'rgba(129, 140, 200, 0.45)';
      } else if (hiSet[k]) {
        fill = 'rgba(56, 189, 248, 0.25)';
        stroke = 'rgba(125, 211, 252, 0.6)';
      }

      ctx.save();
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = isPulse ? 16 : 10; }
      roundBarTop(ctx, bx, by, barW, bh, Math.min(6, barW * 0.35));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = isPulse ? 2.2 : 1.1;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();

      var nv = nums[k];
      var nh = barH(nv) * 0.38;
      var ny = padT + gh - nh - 2;
      var numHot = hiSet[k] || isCheck;
      ctx.save();
      roundBarTop(ctx, bx + barW * 0.1, ny, barW * 0.8, nh, 3);
      ctx.fillStyle = numHot ? 'rgba(56, 189, 248, 0.75)' : 'rgba(56, 189, 248, 0.22)';
      ctx.fill();
      ctx.strokeStyle = numHot ? 'rgba(186, 230, 253, 0.9)' : 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = numHot ? 1.6 : 1;
      ctx.stroke();
      ctx.restore();

      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = numHot ? '#e0f2fe' : 'rgba(56, 189, 248, 0.55)';
      ctx.fillText(String(nv), bx + barW / 2, ny - 2);

      if (showDp) {
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillStyle = isPulse ? '#0f172a' : 'rgba(220, 228, 255, 0.88)';
        ctx.fillText(String(fVal), bx + barW / 2, by - 4);
      }
    }

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (k = 0; k < n; k++) {
      var lx = barX(k) + barW / 2;
      var ly = padT + gh + 6;
      ctx.fillStyle = k === pulse ? 'rgba(56, 189, 248, 0.98)' : 'rgba(235, 238, 255, 1)';
      ctx.fillText(String(k), lx, ly);
    }

    ctx.textAlign = 'left';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(248, 250, 255, 0.96)';
    ctx.fillText('LIS · dp[i] bars · nums[i] teal', padL, 4);
  }

  function sleep(ms) { return new Promise(function(res) { setTimeout(res, ms); }); }

  async function doPlay() {
    if (isAnimating) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.LisLineAudio) window.LisLineAudio.unlock();
    steps = buildSteps();
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.LisLineAudio) window.LisLineAudio.step(steps[0].line, steps[0].matched);
    await sleep(260);
    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.LisLineAudio) window.LisLineAudio.step(steps[stepIndex].line, steps[stepIndex].matched);
      await sleep(animationSpeed);
    }
    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.LisLineAudio) window.LisLineAudio.playComplete();
    await sleep(280);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    dpFull = buildDpTable(nums);
    steps = buildSteps();
    stepIndex = 0;
    renderCodeDOM();
    applyStep(steps[0]);
    setStats(steps[0]);
    var resEl = document.getElementById('lisResult');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    var hint = document.getElementById('lisChartHint');
    if (hint) hint.textContent = '0…' + (nums.length - 1);
  }

  function scheduleResize() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function() {
      rafId = null;
      canvasInfo = setupCanvas();
      var cur = steps[stepIndex] || steps[0];
      if (cur) paintChart(cur);
    });
  }

  function wirePlatform() {
    if (window.LisLineAudio) window.LisLineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) { animationSpeed = 850 - v; },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'longest-increasing-subsequence-instagram-reel-1080x1920'
    });
    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        dpFull = buildDpTable(nums);
        if (window.LisLineAudio) window.LisLineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.lis-panels-row');
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
