(function() {
  'use strict';

  if (!window.ReelPlatform) {
    console.error('ReelPlatform missing — load reel-platform/reel-platform.js before this file.');
    return;
  }

  var isAnimating = false;
  var delayMs = 300;
  var step = 0;

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  async function doPlay() {
    if (isAnimating) return;
    isAnimating = true;
    ReelPlatform.setPlayControlsBusy(true);
    step = 0;
    var el = document.getElementById('stubMeter');
    var hint = document.getElementById('stubHint');
    if (el) el.textContent = '0';
    if (hint) hint.textContent = 'Running stub loop…';
    await sleep(200);
    for (var i = 1; i <= 12; i++) {
      step = i;
      if (el) el.textContent = String(i);
      await sleep(delayMs);
    }
    if (hint) hint.textContent = 'Done. Reset or Play again.';
    isAnimating = false;
    ReelPlatform.setPlayControlsBusy(false);
  }

  function doReset() {
    if (isAnimating) return;
    step = 0;
    var el = document.getElementById('stubMeter');
    var hint = document.getElementById('stubHint');
    if (el) el.textContent = '0';
    if (hint) hint.textContent = 'Same sidebar as other reels: Play · Reset · Speed · Reel-only.';
  }

  function wirePlatform() {
    ReelPlatform.bootControls({
      getIsAnimating: function() { return isAnimating; },
      onPlay: doPlay,
      onReset: doReset,
      onSpeedInput: function(v) {
        delayMs = 850 - v;
      },
      onLayoutRefresh: function() {},
      recordDownloadBasename: 'stub-instagram-reel-1080x1920'
    });

    ReelPlatform.bootApp({
      onVisualizerReady: function() {
        doReset();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wirePlatform);
  } else {
    wirePlatform();
  }
})();
