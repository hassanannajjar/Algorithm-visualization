/**
 * House Robber: metrics + f(i) bar viz + rob/skip decisions + IDE + Play + sound.
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var DEFAULT_NUMS = [2, 7, 9, 3, 1];
  var nums = DEFAULT_NUMS.slice();
  var CODE_LINES = [
    'const n = nums.length;',
    'let a = nums[0];',
    'let b = Math.max(nums[0], nums[1]);',
    'for (let i = 2; i < n; i++) {',
    '  const next = Math.max(b, a + nums[i]);',
    '  a = b; b = next;',
    '}',
    'return b;'
  ];

  var animationSpeed = 300;
  var isAnimating = false;
  var dpFull = [];
  var steps = [];
  var stepIndex = 0;
  var targetHouse = 0;
  var canvasInfo = null;
  var rafId = null;

  function buildDpTable(arr) {
    var n = arr.length;
    if (n === 0) return [];
    var f = [];
    f[0] = arr[0];
    if (n === 1) return f;
    f[1] = Math.max(arr[0], arr[1]);
    for (var i = 2; i < n; i++) {
      f[i] = Math.max(f[i - 1], f[i - 2] + arr[i]);
    }
    return f;
  }

  function clampHouse(h) {
    h = parseInt(h, 10);
    var maxH = nums.length - 1;
    if (isNaN(h)) return maxH;
    return Math.max(0, Math.min(maxH, h));
  }

  function numsLabel() {
    return 'nums = [' + nums.join(', ') + ']';
  }

  function buildSteps(last) {
    var n = nums.length;
    var out = [];
    out.push({
      line: -1,
      explain: 'Rob houses for max money — but never two adjacent. At each house: rob it (+ best from two back) or skip it (+ best from one back). Bars show f(i); violet is nums[i].',
      graphUpto: -1,
      pulse: -1,
      secondary: [],
      lootHighlight: [],
      winner: null
    });

    if (n === 0) {
      out.push({ line: 6, explain: 'Empty street — return 0.', graphUpto: -1, pulse: -1, secondary: [], lootHighlight: [], winner: null, result: 0 });
      return out;
    }

    if (last === 0 && n === 1) {
      out.push({
        line: 6,
        explain: 'One house — rob it. f(0) = nums[0] = ' + nums[0] + '.',
        graphUpto: 0,
        pulse: 0,
        secondary: [],
        lootHighlight: [0],
        winner: 'rob',
        result: nums[0]
      });
      return out;
    }

    out.push({
      line: 0,
      explain: 'n = nums.length = ' + n + '. Fill best loot through house ' + last + '.',
      graphUpto: 0,
      pulse: 0,
      secondary: [],
      lootHighlight: []
    });

    out.push({
      line: 1,
      explain: 'a = nums[0] = ' + nums[0] + ' — best if we end at house 0.',
      graphUpto: 0,
      pulse: 0,
      secondary: [0],
      lootHighlight: [0],
      a: nums[0],
      b: null
    });

    if (n === 1) {
      out.push({ line: 6, explain: 'return a → ' + nums[0], graphUpto: 0, pulse: 0, secondary: [], lootHighlight: [0], winner: 'rob', result: nums[0] });
      return out;
    }

    var b0 = Math.max(nums[0], nums[1]);
    out.push({
      line: 2,
      explain: 'b = max(nums[0], nums[1]) = max(' + nums[0] + ', ' + nums[1] + ') = ' + b0 + ' — best through house 1.',
      graphUpto: 1,
      pulse: 1,
      secondary: [0, 1],
      lootHighlight: [1],
      a: nums[0],
      b: b0
    });

    if (last <= 1) {
      out.push({
        line: 6,
        explain: 'Target is house ' + last + '. return b = ' + (last === 0 ? nums[0] : b0) + '.',
        graphUpto: last,
        pulse: last,
        secondary: [],
        lootHighlight: [last],
        winner: last === 0 ? 'rob' : (b0 === nums[1] ? 'rob' : 'skip'),
        result: last === 0 ? nums[0] : b0
      });
      return out;
    }

    var a = nums[0];
    var b = b0;
    for (var i = 2; i <= last; i++) {
      var robVal = a + nums[i];
      var skipVal = b;
      var pick = robVal > skipVal ? 'rob' : (robVal < skipVal ? 'skip' : 'skip');
      out.push({
        line: 3,
        explain: 'House ' + i + ' (nums[' + i + ']=' + nums[i] + '): choose rob vs skip.',
        graphUpto: i - 1,
        pulse: i,
        secondary: [i - 1, i - 2],
        lootHighlight: [i],
        a: a,
        b: b,
        i: i
      });
      out.push({
        line: 4,
        explain: 'Rob → f(' + (i - 2) + ')+nums[' + i + '] = ' + a + '+' + nums[i] + ' = ' + robVal + '.  Skip → f(' + (i - 1) + ') = ' + skipVal + '.',
        graphUpto: i - 1,
        pulse: i,
        secondary: [i - 1, i - 2],
        lootHighlight: [i],
        robVal: robVal,
        skipVal: skipVal,
        a: a,
        b: b,
        i: i,
        winner: null
      });
      var next = Math.max(b, robVal);
      out.push({
        line: 4,
        explain: 'Pick ' + (pick === 'rob' ? 'ROB' : 'SKIP') + ': next = max(' + skipVal + ', ' + robVal + ') = ' + next + '. ' +
          (pick === 'rob' ? 'Take this house + best two steps back.' : 'Skip this house — keep prior best.'),
        graphUpto: i - 1,
        pulse: i,
        secondary: [i - 1, i - 2],
        lootHighlight: [i],
        robVal: robVal,
        skipVal: skipVal,
        a: a,
        b: b,
        i: i,
        winner: pick,
        next: next
      });
      a = b;
      b = next;
      out.push({
        line: 5,
        explain: 'Shift window: (a,b) = (f(' + (i - 1) + '), f(' + i + ')) = (' + a + ', ' + b + ').',
        graphUpto: i,
        pulse: i,
        secondary: [i - 1],
        lootHighlight: [],
        a: a,
        b: b,
        i: i,
        winner: pick
      });
    }

    out.push({
      line: 6,
      explain: 'return b → max money robbing houses 0…' + last + ' = ' + b + '. Logic isn\'t just math — it\'s a decision at every step.',
      graphUpto: last,
      pulse: last,
      secondary: [],
      lootHighlight: [],
      a: a,
      b: b,
      winner: null,
      result: b
    });
    return out;
  }

  function setProgress(p) {
    var el = document.getElementById('hrProgressFill');
    if (!el) return;
    el.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  function renderCodeDOM() {
    var pre = document.getElementById('hrCode');
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
    var nodes = document.querySelectorAll('.hr-code .code-line');
    for (var i = 0; i < nodes.length; i++) {
      var idx = parseInt(nodes[i].getAttribute('data-line-idx'), 10);
      nodes[i].classList.toggle('active', lineIdx >= 0 && idx === lineIdx);
    }
  }

  function setStats(step, last) {
    var idxEl = document.getElementById('hrStepIndex');
    var totEl = document.getElementById('hrStepTotal');
    var goalEl = document.getElementById('hrGoal');
    if (idxEl) idxEl.textContent = stepIndex >= 0 ? String(stepIndex + 1) : '–';
    if (totEl) totEl.textContent = String(steps.length);
    if (goalEl) goalEl.textContent = 'f(' + last + ')';
    var resEl = document.getElementById('hrResult');
    if (resEl) {
      if (step && step.result !== undefined) resEl.textContent = String(step.result);
      else if (step && step.b !== undefined && step.line === 6) resEl.textContent = String(step.b);
      else resEl.textContent = '…';
    }
  }

  function setHeroExplain(text) {
    var hero = document.getElementById('hrHeroLine');
    if (hero) hero.textContent = text;
  }

  function setVars(step) {
    var el = document.getElementById('hrVars');
    if (!el) return;
    if (!step) {
      el.innerHTML = '';
      return;
    }
    var hasCore = step.a !== undefined || step.b !== undefined;
    var hasCompare = step.robVal !== undefined;
    if (!hasCore && !hasCompare) {
      el.innerHTML = '';
      return;
    }
    var parts = [];
    if (step.a !== undefined && step.a !== null) parts.push('a=<span class="val">' + step.a + '</span>');
    if (step.b !== undefined && step.b !== null) parts.push('b=<span class="val">' + step.b + '</span>');
    if (step.i !== undefined) parts.push('i=<span class="val">' + step.i + '</span>');
    if (step.robVal !== undefined) {
      parts.push('rob=<span class="val pick-rob">' + step.robVal + '</span>');
      parts.push('skip=<span class="val pick-skip">' + step.skipVal + '</span>');
    }
    if (step.next !== undefined) parts.push('next=<span class="val">' + step.next + '</span>');
    var inner = parts.join(' &nbsp;·&nbsp; ');
    if (step.winner) {
      inner += ' <span class="hr-decision-chip ' + step.winner + '">' + step.winner.toUpperCase() + '</span>';
    }
    el.innerHTML = inner;
  }

  function setNumsStrip() {
    var el = document.getElementById('hrNumsStrip');
    if (el) el.textContent = numsLabel();
  }

  function chartHint(text) {
    var h = document.getElementById('hrChartHint');
    if (h) h.textContent = text || ('0…' + (nums.length - 1));
  }

  function applyStep(step) {
    setHeroExplain(step.explain);
    setLineHighlight(step.line);
    setVars(step);
    setStats(step, targetHouse);
    setNumsStrip();
    paintChart({
      graphUpto: step.graphUpto,
      pulse: step.pulse != null ? step.pulse : step.graphUpto,
      secondary: step.secondary || [],
      lootHighlight: step.lootHighlight || [],
      winner: step.winner || null,
      playMode: true
    });
    if (steps.length > 1) setProgress(stepIndex / (steps.length - 1));
    else setProgress(0);
  }

  function setupCanvas() {
    var canvas = document.getElementById('hrGraph');
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
    var lootHighlight = opts.lootHighlight || [];
    var winner = opts.winner;
    var playMode = !!opts.playMode;

    if (!canvasInfo) canvasInfo = setupCanvas();
    if (!canvasInfo) return;
    var ctx = canvasInfo.ctx;
    var w = canvasInfo.w;
    var h = canvasInfo.h;
    ctx.clearRect(0, 0, w, h);

    var n = nums.length;
    var nBars = n;
    var padL = 12;
    var padR = 12;
    var padT = 22;
    var padB = 36;
    var gw = w - padL - padR;
    var gh = h - padT - padB;
    var gap = Math.max(4, Math.round(gw / 70));
    var barW = nBars > 0 ? (gw - gap * (nBars - 1)) / nBars : gw;

    var yMax = 1;
    for (var yi = 0; yi < n; yi++) yMax = Math.max(yMax, dpFull[yi] || 0, nums[yi]);

    function barX(k) { return padL + k * (barW + gap); }
    function barH(val) { return yMax <= 0 ? 0 : Math.max(4, (val / yMax) * (gh - 8)); }
    function barY(val) { return padT + gh - barH(val); }

    ctx.fillStyle = 'rgba(5, 4, 14, 0.25)';
    ctx.fillRect(0, 0, w, h);

    var secSet = {};
    for (var s = 0; s < secondary.length; s++) secSet[secondary[s]] = true;
    var lootSet = {};
    for (var lh = 0; lh < lootHighlight.length; lh++) lootSet[lootHighlight[lh]] = true;

    for (var k = 0; k < n; k++) {
      var bx = barX(k);
      var isPast = graphUpto < 0 ? true : k <= graphUpto;
      var isPulse = pulseIdx >= 0 && k === pulseIdx;
      var isSec = secSet[k];
      var fVal = dpFull[k] != null ? dpFull[k] : 0;
      var bh = barH(fVal);
      var by = barY(fVal);

      var isRobWin = winner === 'rob' && isSec && k === pulseIdx - 2;
      var isSkipWin = winner === 'skip' && isSec && k === pulseIdx - 1;
      var isRobPath = winner === 'rob' && isSec && k === pulseIdx - 2;
      var isSkipPath = winner === 'skip' && isSec && k === pulseIdx - 1;

      var fill, stroke, glow = null, alpha = 1;
      if (!isPast && playMode && graphUpto >= 0) {
        fill = 'rgba(50, 48, 70, 0.55)';
        stroke = 'rgba(60, 58, 82, 0.35)';
        alpha = 0.85;
      } else if (isPulse) {
        fill = 'rgba(255, 255, 255, 0.92)';
        stroke = 'rgba(167, 139, 250, 1)';
        glow = 'rgba(167, 139, 250, 0.55)';
      } else if (isRobWin || (isSec && isRobPath)) {
        fill = 'rgba(74, 222, 128, 0.45)';
        stroke = 'rgba(134, 239, 172, 0.9)';
        glow = 'rgba(74, 222, 128, 0.35)';
      } else if (isSkipWin || (isSec && isSkipPath)) {
        fill = 'rgba(96, 165, 250, 0.4)';
        stroke = 'rgba(147, 197, 253, 0.85)';
        glow = 'rgba(96, 165, 250, 0.3)';
      } else if (isSec) {
        fill = 'rgba(56, 189, 248, 0.3)';
        stroke = 'rgba(125, 211, 252, 0.6)';
      } else if (isPast || graphUpto < 0) {
        fill = 'rgba(196, 210, 255, 0.72)';
        stroke = 'rgba(129, 140, 200, 0.45)';
      } else {
        fill = 'rgba(72, 68, 92, 0.55)';
        stroke = 'rgba(80, 78, 100, 0.35)';
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = isPulse ? 16 : 10; }
      roundBarTop(ctx, bx, by, barW, bh, Math.min(6, barW * 0.35));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = isPulse ? 2.2 : 1.1;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();

      var lootVal = nums[k];
      var lh = barH(lootVal) * 0.42;
      var ly = padT + gh - lh - 2;
      var lootHot = lootSet[k];
      ctx.save();
      ctx.globalAlpha = isPast || graphUpto < 0 ? 0.92 : 0.45;
      roundBarTop(ctx, bx + barW * 0.12, ly, barW * 0.76, lh, 3);
      ctx.fillStyle = lootHot ? 'rgba(167, 139, 250, 0.8)' : 'rgba(167, 139, 250, 0.28)';
      ctx.fill();
      ctx.strokeStyle = lootHot ? 'rgba(196, 181, 253, 0.95)' : 'rgba(167, 139, 250, 0.35)';
      ctx.lineWidth = lootHot ? 1.8 : 1;
      ctx.stroke();
      ctx.restore();
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = lootHot ? 'rgba(237, 233, 254, 0.98)' : 'rgba(167, 139, 250, 0.55)';
      ctx.fillText(String(lootVal), bx + barW / 2, ly - 2);

      if (isPast || graphUpto < 0) {
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = isPulse ? '#fff' : 'rgba(220, 228, 255, 0.88)';
        ctx.fillText(String(fVal), bx + barW / 2, by - 4);
      }
    }

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var xi = 0; xi < n; xi++) {
      var lx = barX(xi) + barW / 2;
      var ly2 = padT + gh + 6;
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(0,0,0,0.58)';
      ctx.strokeText(String(xi), lx, ly2);
      ctx.fillStyle = xi === pulseIdx ? 'rgba(167, 139, 250, 0.98)' : 'rgba(235, 238, 255, 1)';
      ctx.fillText(String(xi), lx, ly2);
    }

    if (n > 0 && graphUpto >= 0) {
      ctx.textAlign = 'left';
      ctx.font = '800 12px Inter, sans-serif';
      var cap = 'f(' + Math.min(graphUpto, n - 1) + ') = ' + (dpFull[Math.min(graphUpto, n - 1)] || 0);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeText(cap, padL, 4);
      ctx.fillStyle = 'rgba(248, 250, 255, 0.96)';
      ctx.fillText(cap, padL, 4);
    }
  }

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  async function doPlay() {
    if (isAnimating) return;
    var input = document.getElementById('hrHouseInput');
    if (input) targetHouse = clampHouse(input.value);
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.HrLineAudio) window.HrLineAudio.unlock();
    steps = buildSteps(targetHouse);
    stepIndex = 0;
    applyStep(steps[0]);
    if (window.HrLineAudio) window.HrLineAudio.step(steps[0].line, steps[0].winner);
    chartHint('Play');
    await sleep(260);
    for (stepIndex = 1; stepIndex < steps.length; stepIndex++) {
      applyStep(steps[stepIndex]);
      if (window.HrLineAudio) window.HrLineAudio.step(steps[stepIndex].line, steps[stepIndex].winner);
      await sleep(animationSpeed);
    }
    stepIndex = steps.length - 1;
    setProgress(1);
    if (window.HrLineAudio) window.HrLineAudio.playComplete();
    await sleep(280);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    var input = document.getElementById('hrHouseInput');
    if (input) targetHouse = clampHouse(input.value);
    dpFull = buildDpTable(nums);
    steps = buildSteps(targetHouse);
    stepIndex = 0;
    renderCodeDOM();
    applyStep(steps[0]);
    setStats(steps[0], targetHouse);
    var resEl = document.getElementById('hrResult');
    if (resEl) resEl.textContent = '…';
    setProgress(0);
    chartHint('0…' + (nums.length - 1));
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
          lootHighlight: cur.lootHighlight || [],
          winner: cur.winner || null,
          playMode: true
        });
      }
    });
  }

  function wirePlatform() {
    if (window.HrLineAudio) window.HrLineAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) { animationSpeed = 850 - v; },
      onLayoutRefresh: scheduleResize,
      recordDownloadBasename: 'house-robber-instagram-reel-1080x1920'
    });
    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        dpFull = buildDpTable(nums);
        if (window.HrLineAudio) window.HrLineAudio.syncEnabledFromDom();
        renderCodeDOM();
        doReset();
        var host = document.querySelector('.hr-panels-row');
        if (host && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function() { scheduleResize(); });
          ro.observe(host);
        }
        var input = document.getElementById('hrHouseInput');
        if (input) input.addEventListener('change', function() { if (!isAnimating) doReset(); });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wirePlatform);
  } else {
    wirePlatform();
  }
})();
