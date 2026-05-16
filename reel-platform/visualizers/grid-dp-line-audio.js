/**
 * SFX for Grid 2D DP pattern reel (Web Audio API).
 */
(function(global) {
  'use strict';

  var STORAGE_KEY = 'gdLineReelSoundEnabled';
  var ctx = null;
  var masterGain = null;
  var enabled = true;
  var lastTs = 0;
  var MIN_GAP_MS = 14;

  function syncEnabledFromDom() {
    var el = document.getElementById('soundToggle');
    if (!el) {
      try { enabled = global.localStorage.getItem(STORAGE_KEY) !== '0'; } catch (e) { enabled = true; }
      return;
    }
    try {
      var stored = global.localStorage.getItem(STORAGE_KEY);
      if (stored === '0') el.checked = false;
      else if (stored === '1') el.checked = true;
    } catch (e2) {}
    enabled = el.checked;
    el.addEventListener('change', function() {
      enabled = el.checked;
      try { global.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch (e3) {}
    });
  }

  function unlock() {
    if (!global.AudioContext && !global.webkitAudioContext) return;
    try {
      if (!ctx) {
        var AC = global.AudioContext || global.webkitAudioContext;
        ctx = new AC();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.34;
        masterGain.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  }

  function gate() {
    if (!enabled) return false;
    unlock();
    if (!ctx || !masterGain) return false;
    var now = global.performance.now();
    if (now - lastTs < MIN_GAP_MS) return false;
    lastTs = now;
    return true;
  }

  function blip(freq, dur, peak, type) {
    if (!gate()) return;
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    var p = Math.min(peak * 0.9, 0.2);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(p, t0 + 0.006);
    g.gain.linearRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function step(lineIdx) {
    if (!enabled) return;
    if (lineIdx < 0) { blip(240, 0.035, 0.05, 'triangle'); return; }
    if (lineIdx <= 2) { blip(360 + lineIdx * 70, 0.045, 0.08, 'sine'); return; }
    if (lineIdx <= 5) { blip(560 + (lineIdx - 3) * 45, 0.042, 0.075, 'sine'); return; }
    blip(780, 0.055, 0.09, 'sine');
  }

  function playComplete() {
    unlock();
    if (!enabled || !ctx || !masterGain) return;
    var base = ctx.currentTime + 0.02;
    [392, 494, 587, 740].forEach(function(hz, i) {
      try {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(hz, base + i * 0.048);
        g.gain.setValueAtTime(0.001, base + i * 0.048);
        g.gain.linearRampToValueAtTime(0.05 / (i + 1), base + i * 0.048 + 0.018);
        g.gain.linearRampToValueAtTime(0.001, base + i * 0.048 + 0.32);
        o.connect(g);
        g.connect(masterGain);
        o.start(base + i * 0.048);
        o.stop(base + i * 0.048 + 0.36);
      } catch (e) {}
    });
  }

  global.GdLineAudio = {
    syncEnabledFromDom: syncEnabledFromDom,
    unlock: unlock,
    step: step,
    playComplete: playComplete
  };
})(typeof window !== 'undefined' ? window : globalThis);
