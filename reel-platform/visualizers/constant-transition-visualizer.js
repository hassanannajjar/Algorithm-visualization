/**
 * Constant transition pattern: full table O(n) vs two variables O(1).
 * Climbing-stairs count: f(0)=1, f(1)=1, f(i)=f(i-1)+f(i-2).
 */
(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var N = 8;
  var animationSpeed = 300;
  var isAnimating = false;
  var events = [];
  var idx = 0;
  var tblVis = null;
  var varVis = null;

  function buildEvents(n) {
    var out = [];
    var table = [1, 1];
    var a = 1;
    var b = 1;
    out.push({ type: 'intro' });
    out.push({ type: 'base', i: 0, val: 1, a: 1, b: 1 });
    out.push({ type: 'base', i: 1, val: 1, a: 1, b: 1 });
    for (var i = 2; i <= n; i++) {
      var va = table[i - 1];
      var vb = table[i - 2];
      var sum = va + vb;
      out.push({ type: 'peek', i: i, aIdx: i - 1, bIdx: i - 2, va: va, vb: vb, a: a, b: b });
      out.push({ type: 'calc', i: i, va: va, vb: vb, a: a, b: b, sum: sum });
      table[i] = sum;
      var next = a + b;
      out.push({ type: 'commit', i: i, val: sum, a: b, b: next });
      a = b;
      b = next;
    }
    return out;
  }

  function makeDots(id, count) {
    var c = document.getElementById(id);
    if (!c) return;
    c.innerHTML = '';
    var total = Math.min(count, 34);
    for (var j = 0; j < total; j++) {
      var el = document.createElement('div');
      el.className = 'progress-dot';
      el.style.height = (3 + Math.random() * 7) + 'px';
      c.appendChild(el);
    }
    return total;
  }

  function TableSpaceVis() {
    this.cellEls = {};
    this.readA = null;
    this.readB = null;
    this.writeI = null;
    this.filled = 0;
    this.buildGrid();
    this.totalDots = makeDots('tblProgress', events.length);
    this.setFormula('Full array · every f(i) stored');
  }

  TableSpaceVis.prototype.buildGrid = function() {
    var grid = document.getElementById('ctoGrid');
    if (!grid) return;
    grid.innerHTML = '';
    this.cellEls = {};
    for (var i = 0; i <= N; i++) {
      var row = document.createElement('div');
      row.className = 'cto-cell empty';
      row.setAttribute('data-i', String(i));
      var idxEl = document.createElement('span');
      idxEl.className = 'idx';
      idxEl.textContent = 'f(' + i + ')';
      var valEl = document.createElement('span');
      valEl.className = 'val';
      valEl.textContent = '';
      row.appendChild(idxEl);
      row.appendChild(valEl);
      grid.appendChild(row);
      this.cellEls[i] = row;
    }
  };

  TableSpaceVis.prototype.setFormula = function(html) {
    var el = document.getElementById('ctoTableFormula');
    if (el) el.innerHTML = html;
  };

  TableSpaceVis.prototype.paintCells = function() {
    for (var k = 0; k <= N; k++) {
      var cell = this.cellEls[k];
      if (!cell) continue;
      cell.className = 'cto-cell';
      var valSpan = cell.querySelector('.val');
      var stored = cell.getAttribute('data-val');
      if (!stored) {
        cell.classList.add('empty');
        if (valSpan) valSpan.textContent = '';
      } else {
        cell.classList.add('filled');
        if (valSpan) valSpan.textContent = stored;
      }
      if (k === 0 || k === 1) {
        if (stored) cell.classList.add('base');
      }
      if (this.readA === k || this.readB === k) cell.classList.add('reading');
      if (this.writeI === k) cell.classList.add('writing');
    }
  };

  TableSpaceVis.prototype.apply = function(ev) {
    if (ev.type === 'intro') {
      this.readA = null;
      this.readB = null;
      this.writeI = null;
      this.setFormula('Constant transition: <span class="hi-eq">always 2 back</span>');
    } else if (ev.type === 'base') {
      this.readA = null;
      this.readB = null;
      this.writeI = ev.i;
      var cell = this.cellEls[ev.i];
      if (cell) {
        cell.setAttribute('data-val', String(ev.val));
        this.filled++;
      }
      if (window.CtoAudio) window.CtoAudio.tableFill(true);
      this.setFormula('<span class="hi-eq">base</span>  f[' + ev.i + '] = ' + ev.val);
    } else if (ev.type === 'peek') {
      this.readA = ev.aIdx;
      this.readB = ev.bIdx;
      this.writeI = ev.i;
      if (window.CtoAudio) window.CtoAudio.tablePeek();
      this.setFormula(
        'f[<span class="hi-i">' + ev.i + '</span>] needs ' +
        'f[<span class="hi-a">' + ev.aIdx + '</span>] + f[<span class="hi-b">' + ev.bIdx + '</span>]'
      );
    } else if (ev.type === 'calc') {
      if (window.CtoAudio) window.CtoAudio.tablePeek();
      this.setFormula(
        'f[<span class="hi-i">' + ev.i + '</span>] = ' +
        '<span class="hi-a">' + ev.va + '</span> + <span class="hi-b">' + ev.vb + '</span>'
      );
    } else if (ev.type === 'commit') {
      this.readA = null;
      this.readB = null;
      this.writeI = ev.i;
      var c = this.cellEls[ev.i];
      if (c) {
        c.setAttribute('data-val', String(ev.val));
        this.filled++;
      }
      if (window.CtoAudio) window.CtoAudio.tableFill(false);
      this.setFormula(
        'f[<span class="hi-i">' + ev.i + '</span>] = <span class="hi-eq">' + ev.val + '</span>  → stored'
      );
      var lbl = document.getElementById('ctoTblLabel');
      var val = document.getElementById('ctoTblVal');
      if (lbl) lbl.textContent = 'f(' + ev.i + ')=';
      if (val) val.textContent = String(ev.val);
    }
    this.paintCells();
    var cellsEl = document.getElementById('ctoCellsUsed');
    if (cellsEl) cellsEl.textContent = String(this.filled);
  };

  TableSpaceVis.prototype.reset = function() {
    this.readA = null;
    this.readB = null;
    this.writeI = null;
    this.filled = 0;
    for (var k = 0; k <= N; k++) {
      var cell = this.cellEls[k];
      if (cell) cell.removeAttribute('data-val');
    }
    this.paintCells();
    this.setFormula('Full array · every f(i) stored');
    var cellsEl = document.getElementById('ctoCellsUsed');
    var lbl = document.getElementById('ctoTblLabel');
    var val = document.getElementById('ctoTblVal');
    if (cellsEl) cellsEl.textContent = '0';
    if (lbl) lbl.textContent = 'f(' + N + ')=';
    if (val) val.textContent = '?';
    var dots = document.querySelectorAll('#tblProgress .progress-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.remove('active');
  };

  function VarsSpaceVis() {
    this.a = null;
    this.b = null;
    this.highlight = null;
    this.totalDots = makeDots('varProgress', events.length);
    this.setFormula('Only the sliding window');
    this.setSlots('a', '·', 'b', '·', false);
  }

  VarsSpaceVis.prototype.setFormula = function(html) {
    var el = document.getElementById('ctoVarFormula');
    if (el) el.innerHTML = html;
  };

  VarsSpaceVis.prototype.setSlots = function(aLab, aVal, bLab, bVal, showNext, nextText) {
    var slotA = document.getElementById('ctoSlotA');
    var slotB = document.getElementById('ctoSlotB');
    var pill = document.getElementById('ctoNextPill');
    if (slotA) {
      slotA.querySelector('.slot-label').textContent = aLab;
      slotA.querySelector('.slot-val').textContent = aVal;
      slotA.classList.toggle('active', this.highlight === 'a' || this.highlight === 'both');
      slotA.classList.toggle('live', this.a !== null && this.highlight !== 'a' && this.highlight !== 'both');
    }
    if (slotB) {
      slotB.querySelector('.slot-label').textContent = bLab;
      slotB.querySelector('.slot-val').textContent = bVal;
      slotB.classList.toggle('active', this.highlight === 'b' || this.highlight === 'both');
      slotB.classList.toggle('live', this.b !== null && this.highlight !== 'b' && this.highlight !== 'both');
    }
    if (pill) {
      pill.classList.toggle('show', !!showNext);
      pill.textContent = nextText || '';
    }
  };

  VarsSpaceVis.prototype.apply = function(ev) {
    if (ev.type === 'intro') {
      this.a = null;
      this.b = null;
      this.highlight = null;
      this.setSlots('a', '·', 'b', '·', false);
      this.setFormula('Two variables · <span class="hi-eq">O(1) space</span>');
    } else if (ev.type === 'base') {
      this.a = ev.a;
      this.b = ev.b;
      this.highlight = null;
      if (window.CtoAudio) window.CtoAudio.varShift();
      this.setSlots('a', String(ev.a), 'b', String(ev.b), false);
      this.setFormula(ev.i === 0 ? 'a = f(0)' : 'b = f(1) — window ready');
    } else if (ev.type === 'peek') {
      this.highlight = 'both';
      if (window.CtoAudio) window.CtoAudio.varPeek();
      this.setSlots('a', String(ev.a), 'b', String(ev.b), false);
      this.setFormula(
        'i=' + ev.i + ': read <span class="hi-a">a</span> + <span class="hi-b">b</span> (no array)'
      );
    } else if (ev.type === 'calc') {
      this.highlight = null;
      if (window.CtoAudio) window.CtoAudio.varPeek();
      this.setSlots('a', String(ev.a), 'b', String(ev.b), true, 'next = ' + ev.sum);
      this.setFormula(
        'next = <span class="hi-a">' + ev.a + '</span> + <span class="hi-b">' + ev.b + '</span> = <span class="hi-eq">' + ev.sum + '</span>'
      );
    } else if (ev.type === 'commit') {
      this.a = ev.a;
      this.b = ev.b;
      this.highlight = null;
      if (window.CtoAudio) window.CtoAudio.varShift();
      this.setSlots('a', String(ev.a), 'b', String(ev.b), false);
      this.setFormula(
        'shift → a=f(' + (ev.i - 1) + '), b=f(' + ev.i + ')=' + ev.val
      );
      var lbl = document.getElementById('ctoVarLabel');
      var val = document.getElementById('ctoVarVal');
      if (lbl) lbl.textContent = 'f(' + ev.i + ')=';
      if (val) val.textContent = String(ev.val);
    }
  };

  VarsSpaceVis.prototype.reset = function() {
    this.a = null;
    this.b = null;
    this.highlight = null;
    this.setSlots('a', '·', 'b', '·', false);
    this.setFormula('Only the sliding window');
    var lbl = document.getElementById('ctoVarLabel');
    var val = document.getElementById('ctoVarVal');
    if (lbl) lbl.textContent = 'f(' + N + ')=';
    if (val) val.textContent = '?';
    var dots = document.querySelectorAll('#varProgress .progress-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.remove('active');
  };

  function updateProgress() {
    var len = events.length;
    if (len === 0) return;
    var p = (idx + 1) / len;
    var dotsT = document.querySelectorAll('#tblProgress .progress-dot');
    var dotsV = document.querySelectorAll('#varProgress .progress-dot');
    var activeT = Math.floor(p * dotsT.length);
    var activeV = Math.floor(p * dotsV.length);
    for (var i = 0; i < dotsT.length; i++) dotsT[i].classList.toggle('active', i < activeT);
    for (var j = 0; j < dotsV.length; j++) dotsV[j].classList.toggle('active', j < activeV);
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  async function doPlay() {
    if (isAnimating || !tblVis || !varVis) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    if (window.CtoAudio) window.CtoAudio.unlock();

    tblVis.reset();
    varVis.reset();
    idx = 0;
    await sleep(280);

    for (idx = 0; idx < events.length; idx++) {
      var ev = events[idx];
      tblVis.apply(ev);
      varVis.apply(ev);
      updateProgress();
      await sleep(animationSpeed);
    }

    if (window.CtoAudio) window.CtoAudio.playComplete();
    await sleep(400);
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    idx = 0;
    if (tblVis) tblVis.reset();
    if (varVis) varVis.reset();
    updateProgress();
  }

  function init() {
    events = buildEvents(N);
    tblVis = new TableSpaceVis();
    varVis = new VarsSpaceVis();
    tblVis.totalDots = makeDots('tblProgress', events.length);
    varVis.totalDots = makeDots('varProgress', events.length);
  }

  function wirePlatform() {
    if (window.CtoAudio) window.CtoAudio.syncEnabledFromDom();
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) { animationSpeed = 850 - v; },
      onLayoutRefresh: function() { if (!isAnimating) init(); },
      recordDownloadBasename: 'constant-transition-space-opt-instagram-reel-1080x1920'
    });
    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        init();
        var pr = document.querySelector('.reel-viz-visualizer');
        if (pr && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function() { if (!isAnimating) init(); });
          ro.observe(pr);
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
