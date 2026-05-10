/**
 * Lightweight procedural SFX for the Fibonacci reel (Web Audio API).
 */
(function(global) {
  'use strict';

  var STORAGE_KEY = 'fibReelSoundEnabled';

  var ctx = null;
  var masterGain = null;
  var enabled = true;
  var lastBlipTs = 0;
  /** Minimum spacing for layered calls (memo cache bypasses via force). */
  var MIN_GAP_MS = 14;

  function syncEnabledFromDom() {
    var el = document.getElementById('soundToggle');
    if (!el) {
      try {
        var s = global.localStorage.getItem(STORAGE_KEY);
        enabled = s !== '0';
      } catch (e) {
        enabled = true;
      }
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
      try {
        global.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
      } catch (e3) {}
    });
  }

  function unlock() {
    if (!global.AudioContext && !global.webkitAudioContext) return;
    try {
      if (!ctx) {
        var AC = global.AudioContext || global.webkitAudioContext;
        ctx = new AC();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.38;
        masterGain.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  }

  function passedGate(force) {
    if (!enabled) return false;
    unlock();
    if (!ctx || !masterGain) return false;
    if (!force) {
      var now = global.performance.now();
      if (now - lastBlipTs < MIN_GAP_MS) return false;
      lastBlipTs = now;
    }
    return true;
  }

  /** Short sine blip routed through masterGain. Linear ramps for Safari-safe automation. */
  function blip(freq, durationSec, peakGain, type, force) {
    if (!passedGate(force)) return;
    var t0 = ctx.currentTime;
    var d = Math.max(0.012, durationSec);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);

    var p = Math.min(peakGain * 0.92, 0.22);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(p, t0 + 0.006);
    g.gain.linearRampToValueAtTime(0.001, t0 + d);

    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + d + 0.03);
  }

  function recEnter(isRedundantDepth) {
    if (isRedundantDepth) {
      blip(330, 0.045, 0.065, 'triangle', false);
      return;
    }
    blip(245, 0.038, 0.048, 'sine', false);
  }

  function recResolve(depthN) {
    if (typeof depthN === 'number' && depthN <= 1) {
      blip(520, 0.034, 0.055, 'sine', false);
      return;
    }
    blip(400, 0.028, 0.035, 'sine', false);
  }

  /** Cache hit — brighter, always audible vs gate backlog. */
  function memoCache() {
    if (!enabled) return;
    blip(880, 0.065, 0.11, 'sine', true);
    try {
      if (ctx && masterGain) {
        var t0 = ctx.currentTime + 0.012;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1180, t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.07, t0 + 0.008);
        g.gain.linearRampToValueAtTime(0.001, t0 + 0.04);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + 0.055);
      }
    } catch (e) {}
  }

  function memoEnter() {
    blip(360, 0.032, 0.045, 'sine', false);
  }

  function memoResolve(nodeN) {
    if (typeof nodeN === 'number' && nodeN <= 1) {
      blip(495, 0.036, 0.058, 'sine', false);
      return;
    }
    blip(420, 0.026, 0.032, 'sine', false);
  }

  /** When both timelines finish animating */
  function playComplete() {
    unlock();
    if (!enabled || !ctx || !masterGain) return;
    var base = ctx.currentTime + 0.02;
    [523.25, 659.25, 783.99].forEach(function(hz, i) {
      try {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(hz, base + i * 0.05);
        g.gain.setValueAtTime(0.001, base + i * 0.05);
        g.gain.linearRampToValueAtTime(0.06 / (i + 1), base + i * 0.05 + 0.02);
        g.gain.linearRampToValueAtTime(0.001, base + i * 0.05 + 0.38);
        o.connect(g);
        g.connect(masterGain);
        o.start(base + i * 0.05);
        o.stop(base + i * 0.05 + 0.42);
      } catch (e) {}
    });
  }

  global.FibReelAudio = {
    syncEnabledFromDom: syncEnabledFromDom,
    unlock: unlock,
    recEnter: recEnter,
    recResolve: recResolve,
    memoEnter: memoEnter,
    memoCache: memoCache,
    memoResolve: memoResolve,
    playComplete: playComplete
  };
})(typeof window !== 'undefined' ? window : globalThis);
