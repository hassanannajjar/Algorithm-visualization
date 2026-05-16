/**
 * Partition Array for Maximum Sum — dp[i] = best sum for nums[0..i].
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var NUMS = [1, 5, 2, 8];
  var K = 3;
  var nums = NUMS.slice();

  var CODE_LINES = [
    'for (let i = 0; i < n; i++) {',
    '  for (let j = Math.max(0, i-k+1); j <= i; j++) {',
    '    let mx = max(nums[j..i]);',
    '    let seg = mx * (i - j + 1);',
    '    dp[i] = Math.max(dp[i], dp[j-1] + seg);',
    '  }',
    '}',
    'return dp[n-1];'
  ];

  var animationSpeed = 300;
  var isAnimating = false;
  var dpFull = [];
  var steps = [];
  var stepIndex = 0;
  var canvasInfo = null;
  var rafId = null;

  function windowMax(j, i) {
    var m = nums[j];
    var t;
    for (t = j + 1; t <= i; t++) m = Math.max(m, nums[t]);
    return m;
  }

  function segmentSum(j, i) {
    return windowMax(j, i) * (i - j + 1);
  }

  function prevDp(dp, j) {
    return j > 0 ? dp[j - 1] : 0;
  }

  function buildDpTable() {
    var n = nums.length;
    var dp = [];
    var i, j, cand, best;
    for (i = 0; i < n; i++) {
      best = -1;
      for (j = Math.max(0, i - K + 1); j <= i; j++) {
        cand = prevDp(dp, j) + segmentSum(j, i);
        if (cand > best) best = cand;
      }
      dp[i] = best;
    }
    return dp;
  }

  function cloneDp(d) { return d ? d.slice() : []; }

  function emptyDp() {
    var out = [];
    var t;
    for (t = 0; t < nums.length; t++) out.push(null);
    return out;
  }

  function stripLabel() {
    return 'nums = [' + nums.join(', ') + '] · k = ' + K;
  }

  function buildSteps() {
    var n = nums.length;
    var out = [];
    var dp = emptyDp();
    var i, j, jStart, mx, seg, prev, cand, best, bestJ;

    out.push({
      line: -1,
      explain: 'Partition into subarrays of max size k. Replace each element with the subarray max — maximize total sum.',
      dpSnap: cloneDp(dp),
      graphUpto: -1,
      pulse: -1,
      winLo: -1,
      winHi: -1,
      bestJ: -1,
      matched: false
    });

    out.push({
      line: 0,
      explain: 'Same non-constant pattern: dp[i] = max over every valid partition ending at i. Track the max in each window.',
      dpSnap: cloneDp(dp),
      graphUpto: -1,
      pulse: -1,
      winLo: -1,
      winHi: -1,
      bestJ: -1,
      matched: false
    });

    for (i = 0; i < n; i++) {
      jStart = Math.max(0, i - K + 1);
      out.push({
        line: 1,
        explain: 'i = ' + i + ' — try partitions nums[j..i] with j from ' + jStart + ' to ' + i + ' (length ≤ k=' + K + ').',
        dpSnap: cloneDp(dp),
        graphUpto: i - 1,
        pulse: i,
        winLo: -1,
        winHi: -1,
        bestJ: -1,
        i: i
      });

      best = -1;
      bestJ = -1;
      var partial = cloneDp(dp);

      for (j = jStart; j <= i; j++) {
        mx = windowMax(j, i);
        seg = mx * (i - j + 1);
        prev = j > 0 ? dp[j - 1] : 0;
        cand = prev + seg;
        var prevLabel = j > 0 ? 'dp[' + (j - 1) + ']' : '0';

        out.push({
          line: 3,
          explain: 'j = ' + j + ': window [' + j + '..' + i + '] max=' + mx + ', len=' + (i - j + 1) +
            ' → seg=' + mx + '×' + (i - j + 1) + '=' + seg + '. ' + prevLabel + '+seg = ' + prev + '+' + seg + '=' + cand + '.',
          dpSnap: cloneDp(partial),
          graphUpto: i - 1,
          pulse: i,
          winLo: j,
          winHi: i,
          bestJ: bestJ,
          j: j,
          i: i,
          mx: mx,
          seg: seg,
          prev: prev,
          cand: cand,
          matched: true
        });

        if (cand > best) {
          best = cand;
          bestJ = j;
        }
      }

      dp[i] = best;
      partial[i] = best;
      out.push({
        line: 4,
        explain: 'dp[' + i + '] = ' + best + ' — best partition ends at j=' + bestJ + ' (window [' + bestJ + '..' + i + ']).',
        dpSnap: cloneDp(partial),
        graphUpto: i,
        pulse: i,
        winLo: bestJ,
        winHi: i,
        bestJ: bestJ,
        dpVal: best,
        i: i,
        matched: true
      });
    }

    var ans = dp[n - 1];
    out.push({
      line: 6,
      explain: 'return dp[n-1] → ' + ans + '. Recognizing the pattern matters more than memorizing the solution.',
      dpSnap: dp.slice(),
      graphUpto: n - 1,
      pulse: n - 1,
      winLo: -1,
      winHi: -1,
      bestJ: -1,
      result: ans,
      matched: false
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('pamProgressFill');
    if (el) el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('pamCode');
    if (!pre) return;
    pre.innerHTML = '';
    var idx, row;
    for (idx = 0; idx < CODE_LINES.length; idx++) {
      row = document.createElement('div');
      row.className = 'code-line';
      row.setAttribute('data-line-idx', String(idx));
      row.textContent = CODE_LINES[idx];
      pre.appendChild(row);
    }
  }

  function setLineHighlight(lineIdx) {
    var nodes = document.querySelectorAll('.pam-code .code-line');
    var i, idx;
    for (i = 0; i < nodes.length; i++) {
      idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step) {
    var idxEl = document.getElementById('pamStepIndex');
    var totEl = document.getElementById('pamStepTotal');
    var goalEl = document.getElementById('pamGoal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'dp[n-1]';
    var resEl = document.getElementById('pamResult');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var el = document.getElementById('pamHeroLine');
    if (el) el.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('pamVars');
    if (!el) return;
    if (!step || (step.i === undefined && step.winLo < 0)) { el.innerHTML = ''; return; }
    var parts = [];
    if (step.i !== undefined) parts.push('i=<span class="val">' + step.i + '</span>');
    if (step.j !== undefined) parts.push('j=<span class="val">' + step.j + '</span>');
    if (step.mx !== undefined) parts.push('max=<span class="val">' + step.mx + '</span>');
    if (step.seg !== undefined) parts.push('seg=<span class="val">' + step.seg + '</span>');
    if (step.cand !== undefined) parts.push('cand=<span class="val pick">' + step.cand + '</span>');
    if (step.dpVal !== undefined) parts.push('dp[i]=<span class="val">' + step.dpVal + '</span>');
    el.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  function setStrip() {
    var el = document.getElementById('pamNumsStrip');
    if (el) el.textContent = stripLabel();
  }

  function applyStep(step) {
    setHeroExplain(step.explain);
    setLineHighlight(step.line);
    setVars(step);
    setStats(step);
    setStrip();
    paintChart(step);
    if (steps.length > 1) setProgress(stepIndex / (steps.length - 1));
    else setProgress(0);
  }

  function setupCanvas() {
    var canvas = document.getElementById('pamGraph');
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
    var winLo = step.winLo != null ? step.winLo : -1;
    var winHi = step.winHi != null ? step.winHi : -1;
    var bestJ = step.bestJ != null ? step.bestJ : -1;

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

    if (winLo >= 0 && winHi >= winLo) {
      var wx0 = barX(winLo) - 2;
      var wx1 = barX(winHi) + barW + 2;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
      ctx.fillRect(wx0, padT, wx1 - wx0, gh);
    }

    for (k = 0; k < n; k++) {
      var bx = barX(k);
      var inWin = winLo >= 0 && k >= winLo && k <= winHi;
      var isPast = graphUpto < 0 ? false : k <= graphUpto;
      var isPulse = pulse === k;
      var isBestEnd = bestJ === k && pulse === k;

      var fVal = dpSnap[k];
      if (fVal == null && isPast) fVal = dpFull[k];
      var showDp = fVal != null;
      var bh = showDp ? barH(fVal) : barH(0.25);
      var by = barY(showDp ? fVal : 0.25);

      var fill = 'rgba(50, 48, 70, 0.55)';
      var stroke = 'rgba(60, 58, 82, 0.35)';
      var glow = null;

      if (showDp && isPulse) {
        fill = 'rgba(255, 255, 255, 0.92)';
        stroke = 'rgba(167, 139, 250, 1)';
        glow = 'rgba(167, 139, 250, 0.5)';
      } else if (inWin) {
        fill = 'rgba(251, 191, 36, 0.42)';
        stroke = 'rgba(251, 191, 36, 0.9)';
        glow = 'rgba(251, 191, 36, 0.3)';
      } else if (showDp && isPast) {
        fill = 'rgba(196, 210, 255, 0.72)';
        stroke = 'rgba(129, 140, 200, 0.45)';
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
      var nh = barH(nv) * 0.36;
      var ny = padT + gh - nh - 2;
      ctx.save();
      roundBarTop(ctx, bx + barW * 0.1, ny, barW * 0.8, nh, 3);
      ctx.fillStyle = inWin ? 'rgba(167, 139, 250, 0.8)' : 'rgba(167, 139, 250, 0.22)';
      ctx.fill();
      ctx.strokeStyle = inWin ? 'rgba(196, 181, 253, 0.95)' : 'rgba(167, 139, 250, 0.35)';
      ctx.lineWidth = inWin ? 1.8 : 1;
      ctx.stroke();
      ctx.restore();

      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = inWin ? '#ede9fe' : 'rgba(167, 139, 250, 0.55)';
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
      ctx.fillStyle = k === pulse ? 'rgba(167, 139, 250, 0.98)' : 'rgba(235, 238, 255, 1)';
      ctx.fillText(String(k), barX(k) + barW / 2, padT + gh + 6);
    }

    ctx.textAlign = 'left';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(248, 250, 255, 0.96)';
    ctx.fillText('Partition max sum · k=' + K, padL, 4);
  }

  function sleep(ms) { return new Promise(function(res) { setTimeout(res, ms); }); }

  async function doPlay() {
    if (isAnimating) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.PamLineAudio) window.PamLineAudio.unlock();
    steps = buildSteps();
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.PamLineAudio) window.PamLineAudio.step(steps[0].line, steps[0].matched);
    await sleep(260);
    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.PamLineAudio) window.PamLineAudio.step(steps[stepIndex].line, steps[stepIndex].matched);
      await sleep(animationSpeed);
    }
    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.PamLineAudio) window.PamLineAudio.playComplete();
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
    var resEl = document.getElementById('pamResult');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    var hint = document.getElementById('pamChartHint');
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
    if (window.PamLineAudio) window.PamLineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) { animationSpeed = 850 - v; },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'partition-max-sum-instagram-reel-1080x1920'
    });
    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        dpFull = buildDpTable();
        if (window.PamLineAudio) window.PamLineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.pam-panels-row');
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
