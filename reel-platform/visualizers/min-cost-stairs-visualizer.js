/**
 * Min Cost Climbing Stairs: metrics + f(i) bar viz + IDE code + Play + sound.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var DEFAULT_COST = [10, 15, 20, 5, 1, 10];
  var cost = DEFAULT_COST.slice();
  var CODE_LINES = [
    'const n = cost.length;',
    'let a = 0, b = 0;',
    'for (let i = 2; i <= n; i++) {',
    '  const next = Math.min(b + cost[i-1], a + cost[i-2]);',
    '  a = b; b = next;',
    '}',
    'return b;'
  ];

  var animationSpeed = 300;
  var isAnimating = false;
  var dpFull = [];
  var steps = [];
  var stepIndex = 0;
  var targetTop = 0;
  var canvasInfo = null;
  var rafId = null;

  function buildDpTable(costArr) {
    var n = costArr.length;
    var f = [];
    f[0] = 0;
    f[1] = 0;
    for (var i = 2; i <= n; i++) {
      f[i] = Math.min(f[i - 1] + costArr[i - 1], f[i - 2] + costArr[i - 2]);
    }
    return f;
  }

  function clampTop(top) {
    top = parseInt(top, 10);
    var maxTop = cost.length;
    if (isNaN(top)) return maxTop;
    return Math.max(0, Math.min(maxTop, top));
  }

  function costLabel() {
    return 'cost = [' + cost.join(', ') + ']';
  }

  function buildSteps(top) {
    var n = cost.length;
    var out = [];
    out.push({
      line: -1,
      explain: 'Same staircase — new goal. Each step has a cost; reach the top with minimum total. f(i) = min cost to stand on step i. Bars show f(i); orange ticks are step costs.',
      graphUpto: -1,
      pulse: -1,
      secondary: [],
      costHighlight: []
    });

    if (top <= 1) {
      out.push({
        line: 0,
        explain: 'Top is step ' + top + '. Bases f(0)=f(1)=0 — no loop needed. Answer 0.',
        graphUpto: top,
        pulse: top,
        secondary: [],
        costHighlight: [],
        result: 0
      });
      return out;
    }

    out.push({
      line: 0,
      explain: 'n = cost.length = ' + n + '. We will fill f(2)…f(' + top + ') and return f(' + top + ').',
      graphUpto: 1,
      pulse: 1,
      secondary: [0, 1],
      costHighlight: []
    });

    out.push({
      line: 1,
      explain: 'Bases: f(0)=0, f(1)=0 — you may start on step 0 or 1 for free.',
      graphUpto: 1,
      pulse: 1,
      secondary: [0, 1],
      a: 0,
      b: 0
    });

    var a = 0;
    var b = 0;
    for (var i = 2; i <= top; i++) {
      var c1 = cost[i - 1];
      var c2 = cost[i - 2];
      var from1 = b + c1;
      var from2 = a + c2;
      out.push({
        line: 2,
        explain: 'Loop i=' + i + ': compare arriving from step ' + (i - 1) + ' vs ' + (i - 2) + '.',
        graphUpto: i - 1,
        pulse: i,
        secondary: [i - 1, i - 2],
        costHighlight: [i - 1, i - 2],
        a: a,
        b: b,
        i: i
      });
      out.push({
        line: 3,
        explain: 'next = min(f(' + (i - 1) + ')+cost[' + (i - 1) + '], f(' + (i - 2) + ')+cost[' + (i - 2) + ']) = min(' + b + '+' + c1 + ', ' + a + '+' + c2 + ') = min(' + from1 + ', ' + from2 + ') = ' + Math.min(from1, from2) + '.',
        graphUpto: i - 1,
        pulse: i,
        secondary: [i - 1, i - 2],
        costHighlight: [i - 1, i - 2],
        a: a,
        b: b,
        i: i,
        from1: from1,
        from2: from2,
        next: Math.min(from1, from2),
        pick: from1 <= from2 ? 1 : 2
      });
      var next = Math.min(from1, from2);
      a = b;
      b = next;
      out.push({
        line: 4,
        explain: 'Slide window: (a,b) now hold f(' + (i - 1) + ') and f(' + i + ') = ' + b + '.',
        graphUpto: i,
        pulse: i,
        secondary: [i - 1, i - 2],
        costHighlight: [],
        a: a,
        b: b,
        i: i
      });
    }

    out.push({
      line: 5,
      explain: 'Loop done for top step ' + top + '. b stores f(' + top + ') = ' + b + '.',
      graphUpto: top,
      pulse: top,
      secondary: [],
      a: a,
      b: b
    });
    out.push({
      line: 6,
      explain: 'return b → minimum cost to reach the top = ' + b + '. Before: count ways. Now: minimize cost.',
      graphUpto: cost.length,
      pulse: top,
      secondary: [],
      a: a,
      b: b,
      result: b
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('mcsProgressFill');
    if (!el) return;
    el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('mcsCode');
    if (!pre) return;
    pre.innerHTML = '';
    for (var i = 0; i < CODE_LINES.length; i++) {
      var div = document.createElement('div');
      div.className = 'code-line';
      div.setAttribute('data-line-idx', String(i));
      div.textContent = CODE_LINES[i];
      pre.appendChild(div);
    }
  }

  function setLineHighlight(lineIdx) {
    var nodes = document.querySelectorAll('.mcs-code .code-line');
    for (var i = 0; i < nodes.length; i++) {
      var idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step, top) {
    var idxEl = document.getElementById('mcsStepIndex');
    var totEl = document.getElementById('mcsStepTotal');
    var goalEl = document.getElementById('mcsGoal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'f(' + top + ')';
    var resEl = document.getElementById('mcsResult');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else if (step && step.b !== undefined && step.line === 6) resEl.textContent = String(step.b);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var hero = document.getElementById('mcsHeroLine');
    if (hero) hero.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('mcsVars');
    if (!el) return;
    if (!step || step.a === undefined) {
      el.innerHTML = '';
      return;
    }
    var parts = [];
    parts.push('a=<span class="val">' + step.a + '</span>');
    parts.push('b=<span class="val">' + step.b + '</span>');
    if (step.i !== undefined) parts.push('i=<span class="val">' + step.i + '</span>');
    if (step.from1 !== undefined) {
      parts.push('via i−1=<span class="val">' + step.from1 + '</span>');
      parts.push('via i−2=<span class="val">' + step.from2 + '</span>');
    }
    if (step.next !== undefined) parts.push('next=<span class="val">' + step.next + '</span>');
    el.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  function setCostStrip() {
    var el = document.getElementById('mcsCostStrip');
    if (el) el.textContent = costLabel();
  }

  function chartHint(text) {
    var h = document.getElementById('mcsChartHint');
    if (h) h.textContent = text || ('0…' + cost.length);
  }

  function applyStep(step) {
    setHeroExplain(step.explain);
    setLineHighlight(step.line);
    setVars(step);
    setStats(step, targetTop);
    setCostStrip();
    paintChart({
      graphUpto: step.graphUpto,
      pulse: step.pulse != null ? step.pulse : step.graphUpto,
      secondary: step.secondary || [],
      costHighlight: step.costHighlight || [],
      playMode: true
    });
    if (steps.length > 1) setProgress(stepIndex / (steps.length - 1));
    else setProgress(0);
  }

  function setupCanvas() {
    var canvas = document.getElementById('mcsGraph');
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

  function paintChart(opts) {
    opts = opts || {};
    var graphUpto = opts.graphUpto != null ? opts.graphUpto : -1;
    var pulseIdx = opts.pulse != null ? opts.pulse : -1;
    var secondary = opts.secondary || [];
    var costHighlight = opts.costHighlight || [];
    var playMode = !!opts.playMode;

    if (!canvasInfo) canvasInfo = setupCanvas();
    if (!canvasInfo) return;
    var ctx = canvasInfo.ctx;
    var w = canvasInfo.w;
    var h = canvasInfo.h;
    ctx.clearRect(0, 0, w, h);

    var nTop = cost.length;
    var nBars = nTop + 1;
    var padL = 12;
    var padR = 12;
    var padT = 22;
    var padB = 36;
    var gw = w - padL - padR;
    var gh = h - padT - padB;

    var gap = Math.max(3, Math.round(gw / 80));
    var barW = (gw - gap * (nBars - 1)) / nBars;
    if (barW < 8) {
      gap = 2;
      barW = (gw - gap * (nBars - 1)) / nBars;
    }

    var yMax = 1;
    for (var yi = 0; yi <= nTop; yi++) yMax = Math.max(yMax, dpFull[yi] || 0);
    for (var ci = 0; ci < cost.length; ci++) yMax = Math.max(yMax, cost[ci]);

    function barX(k) {
      return padL + k * (barW + gap);
    }
    function barH(val) {
      if (yMax <= 0) return 0;
      return Math.max(4, (val / yMax) * (gh - 8));
    }
    function barY(val) {
      return padT + gh - barH(val);
    }

    ctx.fillStyle = 'rgba(5, 4, 14, 0.25)';
    ctx.fillRect(0, 0, w, h);

    var secSet = {};
    for (var s = 0; s < secondary.length; s++) secSet[secondary[s]] = true;
    var costSet = {};
    for (var ch = 0; ch < costHighlight.length; ch++) costSet[costHighlight[ch]] = true;

    for (var k = 0; k <= nTop; k++) {
      var bx = barX(k);
      var isPast = graphUpto < 0 ? true : k <= graphUpto;
      var isPulse = pulseIdx >= 0 && k === pulseIdx;
      var isSec = secSet[k];
      var fVal = dpFull[k] != null ? dpFull[k] : 0;
      var bh = barH(fVal);
      var by = barY(fVal);

      var fill;
      var stroke;
      var glow = null;
      var alpha = 1;

      if (!isPast && playMode && graphUpto >= 0) {
        fill = 'rgba(50, 48, 70, 0.55)';
        stroke = 'rgba(60, 58, 82, 0.35)';
        alpha = 0.85;
      } else if (isPulse) {
        fill = 'rgba(255, 255, 255, 0.92)';
        stroke = 'rgba(251, 191, 36, 1)';
        glow = 'rgba(251, 191, 36, 0.55)';
      } else if (isSec) {
        fill = 'rgba(56, 189, 248, 0.35)';
        stroke = 'rgba(125, 211, 252, 0.65)';
        glow = 'rgba(56, 189, 248, 0.35)';
      } else if (isPast || graphUpto < 0) {
        fill = 'rgba(196, 210, 255, 0.72)';
        stroke = 'rgba(129, 140, 200, 0.45)';
      } else {
        fill = 'rgba(72, 68, 92, 0.55)';
        stroke = 'rgba(80, 78, 100, 0.35)';
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      if (glow && (isPulse || isSec)) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = isPulse ? 16 : 9;
      }
      roundBarTop(ctx, bx, by, barW, bh, Math.min(6, barW * 0.35));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = isPulse ? 2.2 : 1.1;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();

      if (k < cost.length) {
        var costVal = cost[k];
        var ch = barH(costVal) * 0.42;
        var cy = padT + gh - ch - 2;
        var costHot = costSet[k];
        ctx.save();
        ctx.globalAlpha = isPast || graphUpto < 0 ? 0.9 : 0.45;
        roundBarTop(ctx, bx + barW * 0.12, cy, barW * 0.76, ch, 3);
        ctx.fillStyle = costHot ? 'rgba(251, 146, 60, 0.75)' : 'rgba(251, 146, 60, 0.28)';
        ctx.fill();
        ctx.strokeStyle = costHot ? 'rgba(253, 186, 116, 0.9)' : 'rgba(251, 146, 60, 0.35)';
        ctx.lineWidth = costHot ? 1.8 : 1;
        ctx.stroke();
        ctx.restore();

        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = costHot ? 'rgba(255, 237, 213, 0.98)' : 'rgba(251, 191, 36, 0.55)';
        ctx.fillText(String(costVal), bx + barW / 2, cy - 2);
      }

      if (isPast || graphUpto < 0) {
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = isPulse ? 'rgba(255, 255, 255, 0.98)' : 'rgba(220, 228, 255, 0.88)';
        ctx.fillText(String(fVal), bx + barW / 2, by - 4);
      }
    }

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var xi = 0; xi <= nTop; xi++) {
      var lx = barX(xi) + barW / 2;
      var ly = padT + gh + 6;
      var lab = xi === nTop ? 'top' : String(xi);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.58)';
      ctx.strokeText(lab, lx, ly);
      ctx.fillStyle = xi === nTop ? 'rgba(251, 191, 36, 0.95)' : 'rgba(235, 238, 255, 1)';
      ctx.fillText(lab, lx, ly);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '800 12px Inter, "Segoe UI", sans-serif';
    var cap = 'f(' + nTop + ') = ' + dpFull[nTop];
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeText(cap, padL, 4);
    ctx.fillStyle = 'rgba(248, 250, 255, 0.96)';
    ctx.fillText(cap, padL, 4);
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  async function doPlay() {
    if (isAnimating) return;
    var input = document.getElementById('mcsTopInput');
    if (input) targetTop = clampTop(input.value);

    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.McsLineAudio) window.McsLineAudio.unlock();
    steps = buildSteps(targetTop);
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.McsLineAudio) window.McsLineAudio.step(steps[0].line);
    chartHint('Play');
    await sleep(260);

    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.McsLineAudio) window.McsLineAudio.step(steps[stepIndex].line);
      await sleep(animationSpeed);
    }

    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.McsLineAudio) window.McsLineAudio.playComplete();
    await sleep(280);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    var input = document.getElementById('mcsTopInput');
    if (input) targetTop = clampTop(input.value);

    dpFull = buildDpTable(cost);
    steps = buildSteps(targetTop);
    stepIndex = 0;
    renderCodeDOM();
    applyStep(steps[0]);
    setStats(steps[0], targetTop);
    var resEl = document.getElementById('mcsResult');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    chartHint('0…' + cost.length);
  }

  function scheduleResize() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function() {
      rafId = null;
      canvasInfo = setupCanvas();
      var cur = steps[stepIndex] || steps[0];
      if (cur) {
        paintChart({
          graphUpto: cur.graphUpto,
          pulse: cur.pulse != null ? cur.pulse : cur.graphUpto,
          secondary: cur.secondary || [],
          costHighlight: cur.costHighlight || [],
          playMode: true
        });
      }
    });
  }

  function wirePlatform() {
    if (window.McsLineAudio) window.McsLineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) {
        animationSpeed = 850 - v;
      },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'min-cost-climbing-stairs-instagram-reel-1080x1920'
    });

    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        dpFull = buildDpTable(cost);
        if (window.McsLineAudio) window.McsLineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.mcs-panels-row');
        if (host && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function() { scheduleResize(); });
          ro.observe(host);
        }
        var input = document.getElementById('mcsTopInput');
        if (input) {
          input.addEventListener('change', function() { if (!isAnimating) doReset(); });
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
