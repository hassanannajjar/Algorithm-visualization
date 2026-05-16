/**
 * Tribonacci: metrics + bar viz (KREGGSCODE-style) + IDE code + Play + sound.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var MAX_N = 37;
  var CODE_LINES = [
    'if (n === 0) return 0;',
    'if (n === 1) return 1;',
    'if (n === 2) return 1;',
    'let a = 0, b = 1, c = 1;',
    'for (let i = 3; i <= n; i++) {',
    '  const next = a + b + c;',
    '  a = b; b = c; c = next;',
    '}',
    'return c;'
  ];

  var animationSpeed = 300;
  var isAnimating = false;
  var tribFull = [];
  var steps = [];
  var stepIndex = 0;
  var targetN = 12;
  var canvasInfo = null;
  var rafId = null;

  function buildTribTable(maxN) {
    var t = [];
    t[0] = 0;
    t[1] = 1;
    t[2] = 1;
    for (var i = 3; i <= maxN; i++) t[i] = t[i - 1] + t[i - 2] + t[i - 3];
    return t;
  }

  function clampN(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(MAX_N, n));
  }

  function buildSteps(n) {
    var out = [];
    out.push({
      line: -1,
      explain: 'T(0)=0, T(1)=T(2)=1, and T(k)=T(k-1)+T(k-2)+T(k-3). Watch the bars: height is T(k). The bright bar is the focus index at this step.',
      graphUpto: -1,
      pulse: -1,
      secondary: []
    });

    if (n === 0) {
      out.push({ line: 0, explain: 'n is 0 → first base case. Return 0.', graphUpto: 0, pulse: 0, secondary: [], result: 0 });
      return out;
    }
    out.push({ line: 0, explain: 'n ≠ 0: skip this return and test the next line.', graphUpto: 0, pulse: 0, secondary: [] });

    if (n === 1) {
      out.push({ line: 1, explain: 'n is 1 → return 1.', graphUpto: 1, pulse: 1, secondary: [], result: 1 });
      return out;
    }
    out.push({ line: 1, explain: 'n ≠ 1: keep going.', graphUpto: 1, pulse: 1, secondary: [] });

    if (n === 2) {
      out.push({ line: 2, explain: 'n is 2 → return 1.', graphUpto: 2, pulse: 2, secondary: [], result: 1 });
      return out;
    }
    out.push({
      line: 2,
      explain: 'n ≥ 3: no early return. Use the loop with three running variables.',
      graphUpto: 2,
      pulse: 2,
      secondary: []
    });

    out.push({
      line: 3,
      explain: 'Initialize a=T(0), b=T(1), c=T(2). The next value to derive is T(3).',
      graphUpto: 2,
      pulse: 2,
      secondary: [0, 1, 2],
      a: 0,
      b: 1,
      c: 1
    });

    var a = 0;
    var b = 1;
    var c = 1;
    for (var i = 3; i <= n; i++) {
      out.push({
        line: 4,
        explain: 'Loop: i = ' + i + '. Next iterations compute T(' + i + ') from the current window (a,b,c).',
        graphUpto: i - 1,
        pulse: i,
        secondary: [],
        a: a,
        b: b,
        c: c,
        i: i
      });
      var next = a + b + c;
      out.push({
        line: 5,
        explain: 'next = a + b + c = ' + a + '+' + b + '+' + c + ' = ' + next + ' (this is T(' + i + ')).',
        graphUpto: i - 1,
        pulse: i,
        secondary: [i - 3, i - 2, i - 1],
        a: a,
        b: b,
        c: c,
        i: i,
        next: next
      });
      a = b;
      b = c;
      c = next;
      out.push({
        line: 6,
        explain: 'Shift window: now (a,b,c) lines up with T(' + (i - 2) + '), T(' + (i - 1) + '), T(' + i + ')).',
        graphUpto: i,
        pulse: i,
        secondary: [i - 3, i - 2, i - 1],
        a: a,
        b: b,
        c: c,
        i: i
      });
    }

    out.push({
      line: 7,
      explain: 'Loop finished. c holds T(' + n + ').',
      graphUpto: n,
      pulse: n,
      secondary: [],
      a: a,
      b: b,
      c: c
    });
    out.push({
      line: 8,
      explain: 'return c → answer T(' + n + ') = ' + c + '. Full skyline shows every T(k) through k = ' + MAX_N + '.',
      graphUpto: MAX_N,
      pulse: n,
      secondary: [],
      a: a,
      b: b,
      c: c,
      result: c
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('tribProgressFill');
    if (!el) return;
    el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('tribCode');
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
    var nodes = document.querySelectorAll('.trib-code .code-line');
    for (var i = 0; i < nodes.length; i++) {
      var idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step, n) {
    var idxEl = document.getElementById('tribStepIndex');
    var totEl = document.getElementById('tribStepTotal');
    var goalEl = document.getElementById('tribGoal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'T(' + n + ')';
    var resEl = document.getElementById('tribResult');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else if (step && step.c !== undefined && step.line === 8) resEl.textContent = String(step.c);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var hero = document.getElementById('tribHeroLine');
    if (hero) hero.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('tribVars');
    if (!el) return;
    if (step === null || step === undefined || !step || step.a === undefined) {
      el.innerHTML = '';
      return;
    }
    var parts = [];
    parts.push('a=<span class="val">' + step.a + '</span>');
    parts.push('b=<span class="val">' + step.b + '</span>');
    parts.push('c=<span class="val">' + step.c + '</span>');
    if (step.i !== undefined) parts.push('i=<span class="val">' + step.i + '</span>');
    if (step.next !== undefined) parts.push('next=<span class="val">' + step.next + '</span>');
    el.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  function chartHint(text) {
    var h = document.getElementById('tribChartHint');
    if (h) h.textContent = text || '0…37';
  }

  function applyStep(step) {
    setHeroExplain(step.explain);
    setLineHighlight(step.line);
    setVars(step);
    setStats(step, targetN);
    paintChart({
      graphUpto: step.graphUpto,
      pulse: step.pulse != null ? step.pulse : (step.i != null ? step.i : step.graphUpto),
      secondary: step.secondary || [],
      playMode: true
    });
    if (steps.length > 1) setProgress(stepIndex / (steps.length - 1));
    else setProgress(0);
  }

  function setupCanvas() {
    var canvas = document.getElementById('tribGraph');
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
    var playMode = !!opts.playMode;

    if (!canvasInfo) canvasInfo = setupCanvas();
    if (!canvasInfo) return;
    var ctx = canvasInfo.ctx;
    var w = canvasInfo.w;
    var h = canvasInfo.h;
    ctx.clearRect(0, 0, w, h);

    var padL = 8;
    var padR = 8;
    var padT = 4;
    var padB = 30;
    var gw = w - padL - padR;
    var gh = h - padT - padB;

    var nBars = MAX_N + 1;
    var gap = Math.max(1, Math.round(gw / 520));
    var barW = (gw - gap * (nBars - 1)) / nBars;
    if (barW < 2) {
      gap = 1;
      barW = (gw - gap * (nBars - 1)) / nBars;
    }

    var yMax = tribFull[MAX_N];

    function barX(k) {
      return padL + k * (barW + gap);
    }
    function barH(val) {
      if (yMax <= 0) return 0;
      return Math.max(3, (val / yMax) * (gh - 4));
    }
    function barY(val) {
      return padT + gh - barH(val);
    }

    ctx.fillStyle = 'rgba(5, 4, 14, 0.25)';
    ctx.fillRect(0, 0, w, h);

    var secSet = {};
    for (var s = 0; s < secondary.length; s++) secSet[secondary[s]] = true;

    for (var k = 0; k <= MAX_N; k++) {
      var bx = barX(k);
      var bh = barH(tribFull[k]);
      var by = barY(tribFull[k]);
      var isPast = graphUpto < 0 ? true : k <= graphUpto;
      var isPulse = pulseIdx >= 0 && k === pulseIdx;
      var isSec = secSet[k];

      var fill;
      var stroke;
      var glow = null;
      var alpha = 1;

      if (!isPast && playMode && graphUpto >= 0) {
        fill = 'rgba(50, 48, 70, 0.55)';
        stroke = 'rgba(60, 58, 82, 0.35)';
        alpha = 0.85;
      } else if (isSec && !isPulse) {
        fill = 'rgba(56, 189, 248, 0.35)';
        stroke = 'rgba(125, 211, 252, 0.65)';
        glow = 'rgba(56, 189, 248, 0.35)';
      } else if (isPulse) {
        fill = 'rgba(255, 255, 255, 0.92)';
        stroke = 'rgba(125, 211, 252, 1)';
        glow = 'rgba(255, 255, 255, 0.65)';
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
      roundBarTop(ctx, bx, by, barW, bh, Math.min(5, barW * 0.35));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = isPulse ? 2.2 : 1.1;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();
    }

    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var stepX = MAX_N > 24 ? 6 : 5;
    for (var xi = 0; xi <= MAX_N; xi += stepX) {
      var lx = barX(xi) + barW / 2;
      var ly = padT + gh + 4;
      var lab = String(xi);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.58)';
      ctx.strokeText(lab, lx, ly);
      ctx.fillStyle = 'rgba(235, 238, 255, 1)';
      ctx.fillText(lab, lx, ly);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    var cap = 'max T(' + MAX_N + ') = ' + formatTick(tribFull[MAX_N]);
    ctx.font = '800 13px Inter, "Segoe UI", sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeText(cap, padL, 3);
    ctx.fillStyle = 'rgba(248, 250, 255, 0.96)';
    ctx.fillText(cap, padL, 3);
  }

  function formatTick(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    return String(Math.round(v));
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  async function doPlay() {
    if (isAnimating) return;
    var input = document.getElementById('tribNInput');
    if (input) targetN = clampN(input.value);

    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.TribLineAudio) window.TribLineAudio.unlock();
    steps = buildSteps(targetN);
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.TribLineAudio) window.TribLineAudio.step(steps[0].line);
    chartHint('Play');
    await sleep(260);

    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.TribLineAudio) window.TribLineAudio.step(steps[stepIndex].line);
      await sleep(animationSpeed);
    }

    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.TribLineAudio) window.TribLineAudio.playComplete();
    await sleep(280);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    var input = document.getElementById('tribNInput');
    if (input) targetN = clampN(input.value);

    tribFull = buildTribTable(MAX_N);
    steps = buildSteps(targetN);
    stepIndex = 0;
    renderCodeDOM();
    applyStep(steps[0]);
    setStats(steps[0], targetN);
    var resEl = document.getElementById('tribResult');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    chartHint('0…37');
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
          playMode: true
        });
      }
    });
  }

  function wirePlatform() {
    if (window.TribLineAudio) window.TribLineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) {
        animationSpeed = 850 - v;
      },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'tribonacci-line-by-line-instagram-reel-1080x1920'
    });

    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        tribFull = buildTribTable(MAX_N);
        if (window.TribLineAudio) window.TribLineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.trib-panels-row');
        if (host && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function() { scheduleResize(); });
          ro.observe(host);
        }
        var input = document.getElementById('tribNInput');
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
