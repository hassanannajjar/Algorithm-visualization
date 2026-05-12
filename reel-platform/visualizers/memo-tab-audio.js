/**
 * Procedural SFX for the Memoization-vs-Tabulation reel (Web Audio API).
 *   memoEnter   — soft violet blip on a recursive call
 *   memoCache   — golden chime on a cache hit (skipping recursion)
 *   memoResolve — rounded tone when a memo entry is stored
 *   tabLook     — mid tap when reading f[i-1] / f[i-2]
 *   tabFill     — bright green tone on table write (brighter for base cases)
 *   playComplete — short major chord on finish
 */
(function(global) {
  'use strict';

  var STORAGE_KEY = 'memTabReelSoundEnabled';

  var ctx = null;
  var masterGain = null;
  var enabled = true;
  var lastBlipTs = 0;
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

  function memoEnter() {
    blip(280, 0.04, 0.05, 'triangle', false);
  }

  function memoCache() {
    if (!enabled) return;
    blip(720, 0.05, 0.07, 'sine', true);
    try {
      if (ctx && masterGain) {
        var t0 = ctx.currentTime + 0.014;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1080, t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.06, t0 + 0.008);
        g.gain.linearRampToValueAtTime(0.001, t0 + 0.045);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + 0.06);
      }
    } catch (e) {}
  }

  function memoResolve(depthN) {
    if (typeof depthN === 'number' && depthN <= 2) {
      blip(540, 0.035, 0.055, 'sine', false);
      return;
    }
    blip(420, 0.03, 0.04, 'sine', false);
  }

  function tabLook() {
    blip(610, 0.034, 0.05, 'sine', false);
  }

  function tabFill(isBase) {
    if (!enabled) return;
    var base = isBase ? 960 : 760;
    blip(base, 0.07, 0.11, 'sine', true);
    try {
      if (ctx && masterGain) {
        var t0 = ctx.currentTime + 0.012;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isBase ? 1320 : 1140, t0);
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

  function playComplete() {
    unlock();
    if (!enabled || !ctx || !masterGain) return;
    var base = ctx.currentTime + 0.02;
    [523.25, 659.25, 783.99, 987.77].forEach(function(hz, i) {
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

  global.MemTabAudio = {
    syncEnabledFromDom: syncEnabledFromDom,
    unlock: unlock,
    memoEnter: memoEnter,
    memoCache: memoCache,
    memoResolve: memoResolve,
    tabLook: tabLook,
    tabFill: tabFill,
    playComplete: playComplete
  };
})(typeof window !== 'undefined' ? window : globalThis);
