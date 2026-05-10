/**
 * Shared 1080×1920 reel shell: scaling, reel-only hash, sidebar record/export, play UI sync.
 * Visualizers pass play/reset/speed + layout refresh hooks.
 */
(function(global) {
  'use strict';

  var IG_REEL_W = 1080;
  var IG_REEL_H = 1920;

  var mediaRecorder = null;
  var recordedChunks = [];
  var recordStream = null;
  var recordComposeVideo = null;
  var recordComposeCanvas = null;
  var recordComposeCtx = null;
  var recordComposeRaf = null;
  /** true when capture used CropTarget.fromElement(tab region = frame only) */
  var recordUsedElementCrop = false;

  var recordDownloadBasename = 'instagram-reel-1080x1920.webm';

  function setRecordStatus(msg) {
    var el = document.getElementById('recordStatus');
    if (el) el.textContent = msg;
  }

  function stopRecordComposeLoop() {
    if (recordComposeRaf != null) {
      cancelAnimationFrame(recordComposeRaf);
      recordComposeRaf = null;
    }
  }

  function cleanupRecordCompose() {
    stopRecordComposeLoop();
    recordUsedElementCrop = false;
    if (recordComposeVideo) {
      try {
        recordComposeVideo.pause();
        recordComposeVideo.srcObject = null;
        if (recordComposeVideo.parentNode) {
          recordComposeVideo.parentNode.removeChild(recordComposeVideo);
        }
      } catch (eV) {}
      recordComposeVideo = null;
    }
    recordComposeCanvas = null;
    recordComposeCtx = null;
  }

  function cleanupRecordStream() {
    cleanupRecordCompose();
    if (recordStream) {
      recordStream.getTracks().forEach(function(t) { t.stop(); });
      recordStream = null;
    }
    mediaRecorder = null;
    var rb = document.getElementById('recordScreenBtn');
    var sb = document.getElementById('stopRecordBtn');
    if (rb) {
      rb.disabled = false;
      rb.classList.remove('recording');
    }
    if (sb) sb.disabled = true;
  }

  function applyReelOnlyFromHash() {
    var reel = global.location.hash === '#reel' || global.location.hash === '#reel-only';
    document.documentElement.classList.toggle('reel-only', reel);
  }

  function updateReelScale() {
    var padX = 32;
    var padY = 28;
    var sideReserved = document.documentElement.classList.contains('reel-only') ? 0 : 148;
    var wAvail = global.innerWidth - padX - sideReserved;
    var hAvail = global.innerHeight - padY;
    if (wAvail < 1) wAvail = 1;
    if (hAvail < 1) hAvail = 1;
    var sw = wAvail / 1080;
    var sh = hAvail / 1920;
    var s = Math.min(sw, sh, 1);
    document.documentElement.style.setProperty('--reel-scale', String(s));
  }

  function setPlayControlsBusy(busy) {
    var btn = document.getElementById('playBtn');
    var footerBtn = document.getElementById('reelFooterPlay');
    if (btn) {
      btn.disabled = busy;
      btn.textContent = busy ? '⏸ …' : '▶ Play';
    }
    if (footerBtn) {
      footerBtn.disabled = busy;
      footerBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
  }

  function pickMimeType() {
    var types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (var i = 0; i < types.length; i++) {
      if (global.MediaRecorder && MediaRecorder.isTypeSupported(types[i])) {
        return types[i];
      }
    }
    return '';
  }

  async function startScreenRecord() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setRecordStatus('This browser cannot record from the page. Film the gradient frame with your phone or use QuickTime / OBS.');
      return;
    }

    var targetEl = document.getElementById('recordFrameTarget');
    recordUsedElementCrop = false;

    var cropConstraints = null;
    if (global.CropTarget && targetEl && typeof CropTarget.fromElement === 'function') {
      try {
        var ct = await CropTarget.fromElement(targetEl);
        cropConstraints = {
          audio: false,
          video: { cropTarget: ct }
        };
      } catch (e1) {
        cropConstraints = null;
      }
    }

    var stream;
    var attempts = [];
    if (cropConstraints) {
      var cropVid = cropConstraints.video;
      attempts.push({ run: function() {
        return navigator.mediaDevices.getDisplayMedia({
          video: cropVid,
          audio: false,
          preferCurrentTab: true
        });
      }, crop: true });
      attempts.push({ run: function() {
        return navigator.mediaDevices.getDisplayMedia({
          video: cropVid,
          audio: false
        });
      }, crop: true });
    }
    attempts.push({ run: function() {
      return navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
        preferCurrentTab: true
      });
    }, crop: false });
    attempts.push({ run: function() {
      return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    }, crop: false });

    for (var ai = 0; ai < attempts.length; ai++) {
      try {
        stream = await attempts[ai].run();
        recordUsedElementCrop = attempts[ai].crop === true;
        break;
      } catch (e2) { /* try next capture strategy */ }
    }
    if (!stream) {
      setRecordStatus('Recording cancelled or not allowed. Use Reel-only view (#reel) and share this tab, or record the neon frame in QuickTime / OBS.');
      return;
    }

    recordStream = stream;
    recordedChunks = [];

    var vt = stream.getVideoTracks()[0];
    if (vt) {
      vt.addEventListener('ended', function onEnded() {
        stopRecordComposeLoop();
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      });
    }

    var composeVideo = document.createElement('video');
    composeVideo.playsInline = true;
    composeVideo.setAttribute('playsinline', '');
    composeVideo.muted = true;
    composeVideo.srcObject = stream;
    composeVideo.setAttribute('aria-hidden', 'true');
    composeVideo.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0;overflow:hidden';
    document.body.appendChild(composeVideo);
    recordComposeVideo = composeVideo;

    try {
      await composeVideo.play();
    } catch (ePlay) {
      setRecordStatus('Could not attach to screen capture preview. Allow autoplay / try Chrome.');
      cleanupRecordStream();
      return;
    }

    await new Promise(function(res) {
      if (composeVideo.readyState >= 2 && composeVideo.videoWidth > 2) res();
      else {
        composeVideo.addEventListener('loadeddata', function onLd() {
          composeVideo.removeEventListener('loadeddata', onLd);
          res();
        });
        composeVideo.addEventListener('error', function onErr() {
          composeVideo.removeEventListener('error', onErr);
          res();
        });
        setTimeout(res, 400);
      }
    });

    var canvas = document.createElement('canvas');
    canvas.width = IG_REEL_W;
    canvas.height = IG_REEL_H;
    var ctx = canvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    }
    recordComposeCanvas = canvas;
    recordComposeCtx = ctx;

    /* Hard 30 fps avoids oversized files; dimension is always 1080×1920. */
    var outStream = canvas.captureStream(30);
    if (!outStream || !outStream.getVideoTracks().length) {
      setRecordStatus('Canvas.captureStream unsupported here — update your browser.');
      cleanupRecordStream();
      return;
    }

    function drawInstagramFrame() {
      if (!recordComposeCtx || !recordComposeVideo || !mediaRecorder || mediaRecorder.state !== 'recording') {
        return;
      }
      var video = recordComposeVideo;
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      if (vw < 2 || vh < 2) return;

      if (recordUsedElementCrop) {
        recordComposeCtx.drawImage(video, 0, 0, vw, vh, 0, 0, IG_REEL_W, IG_REEL_H);
      } else {
        var el = document.getElementById('recordFrameTarget');
        var rect = el ? el.getBoundingClientRect() : null;
        var winW = global.innerWidth || document.documentElement.clientWidth || vw;
        var winH = global.innerHeight || document.documentElement.clientHeight || vh;
        if (!rect || rect.width < 2 || rect.height < 2 || winW < 2 || winH < 2) {
          recordComposeCtx.drawImage(video, 0, 0, vw, vh, 0, 0, IG_REEL_W, IG_REEL_H);
        } else {
          var sx = (rect.left / winW) * vw;
          var sy = (rect.top / winH) * vh;
          var sw = (rect.width / winW) * vw;
          var sh = (rect.height / winH) * vh;
          sx = Math.max(0, Math.min(sx, vw - 1));
          sy = Math.max(0, Math.min(sy, vh - 1));
          sw = Math.max(1, Math.min(sw, vw - sx));
          sh = Math.max(1, Math.min(sh, vh - sy));
          recordComposeCtx.drawImage(video, sx, sy, sw, sh, 0, 0, IG_REEL_W, IG_REEL_H);
        }
      }
    }

    function composeLoop() {
      drawInstagramFrame();
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        recordComposeRaf = requestAnimationFrame(composeLoop);
      } else {
        recordComposeRaf = null;
      }
    }

    var mime = pickMimeType();
    var recOpts = { videoBitsPerSecond: 9000000 };
    if (mime) recOpts.mimeType = mime;
    try {
      mediaRecorder = new MediaRecorder(outStream, recOpts);
    } catch (e4) {
      try {
        mediaRecorder = mime ? new MediaRecorder(outStream, { mimeType: mime }) : new MediaRecorder(outStream);
      } catch (e5) {
        setRecordStatus('Could not start MediaRecorder on this device.');
        cleanupRecordStream();
        return;
      }
    }

    mediaRecorder.ondataavailable = function(ev) {
      if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data);
    };
    mediaRecorder.onstop = function() {
      if (!recordedChunks.length) {
        setRecordStatus('No frames captured. Share your screen until you tap Stop & save.');
        cleanupRecordStream();
        return;
      }
      var blobType = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : 'video/webm';
      var blob = new Blob(recordedChunks, { type: blobType });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = recordDownloadBasename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setRecordStatus('Saved ' + IG_REEL_W + '×' + IG_REEL_H + ' WebM (9:16) — upload to Instagram Reels without cropping.');
      cleanupRecordStream();
    };

    var rs = document.getElementById('recordScreenBtn');
    var st = document.getElementById('stopRecordBtn');
    if (rs) {
      rs.disabled = true;
      rs.classList.add('recording');
    }
    if (st) st.disabled = false;
    setRecordStatus('Recording → export is exactly ' + IG_REEL_W + '×' + IG_REEL_H + '. Pick this tab; gradient frame fills the clip.');

    try {
      drawInstagramFrame();
      mediaRecorder.start(200);
      recordComposeRaf = requestAnimationFrame(composeLoop);
    } catch (e6) {
      setRecordStatus('Could not begin recording chunk capture.');
      cleanupRecordStream();
    }
  }

  function stopScreenRecord() {
    stopRecordComposeLoop();
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      cleanupRecordStream();
    }
  }

  /**
   * @param {object} opts
   * @param {() => boolean} opts.getIsAnimating
   * @param {() => (void|Promise<void>)} opts.onPlay
   * @param {() => void} opts.onReset
   * @param {(sliderRaw: number) => void} opts.onSpeedInput — raw value from #speedSlider
   * @param {() => void} [opts.onLayoutRefresh] — resize / reel-mode; skip when animating
   * @param {string} [opts.recordDownloadBasename]
   */
  function bootControls(opts) {
    if (!opts || typeof opts.getIsAnimating !== 'function') {
      throw new Error('ReelPlatform.bootControls: getIsAnimating required');
    }
    if (typeof opts.onPlay !== 'function' || typeof opts.onReset !== 'function' || typeof opts.onSpeedInput !== 'function') {
      throw new Error('ReelPlatform.bootControls: onPlay, onReset, onSpeedInput required');
    }

    if (opts.recordDownloadBasename) {
      recordDownloadBasename = opts.recordDownloadBasename;
    }

    var onLayoutRefresh = typeof opts.onLayoutRefresh === 'function' ? opts.onLayoutRefresh : function() {};

    var playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.addEventListener('click', function() { opts.onPlay(); });
    var reelFooterPlay = document.getElementById('reelFooterPlay');
    if (reelFooterPlay) reelFooterPlay.addEventListener('click', function() { opts.onPlay(); });

    var resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', function() { opts.onReset(); });

    var speedSlider = document.getElementById('speedSlider');
    if (speedSlider) {
      speedSlider.addEventListener('input', function(e) {
        opts.onSpeedInput(parseInt(e.target.value, 10));
      });
    }

    var rb = document.getElementById('recordScreenBtn');
    var stb = document.getElementById('stopRecordBtn');
    var reelBtn = document.getElementById('reelOnlyBtn');
    if (rb) rb.addEventListener('click', function() { startScreenRecord(); });
    if (stb) stb.addEventListener('click', function() { stopScreenRecord(); });
    if (reelBtn) {
      reelBtn.addEventListener('click', function() {
        if (global.location.hash === '#reel' || global.location.hash === '#reel-only') {
          history.replaceState(null, '', global.location.pathname + global.location.search);
        } else {
          history.replaceState(null, '', global.location.pathname + global.location.search + '#reel');
        }
        applyReelOnlyFromHash();
        updateReelScale();
        if (!opts.getIsAnimating()) onLayoutRefresh();
        setRecordStatus(document.documentElement.classList.contains('reel-only')
          ? 'Reel-only: record this tab — saved file is exactly 1080×1920 (no crop).'
          : 'Record → WebM is 1080×1920. Pick this tab; controls stay off the frame.');
      });
    }

    global.addEventListener('hashchange', function() {
      applyReelOnlyFromHash();
      updateReelScale();
      if (!opts.getIsAnimating()) onLayoutRefresh();
    });

    global.addEventListener('resize', function() {
      updateReelScale();
      if (!opts.getIsAnimating()) onLayoutRefresh();
    });
  }

  /**
   * Apply hash / scale / status, then defer one frame pair so layout is stable for canvas sizing.
   * Attach ResizeObserver inside onVisualizerReady if the visualizer needs layout refresh.
   */
  function bootApp(opts) {
    applyReelOnlyFromHash();
    updateReelScale();
    if (document.documentElement.classList.contains('reel-only')) {
      setRecordStatus('Reel-only: choose this tab when recording — download is 1080×1920 WebM.');
    }
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (opts && typeof opts.onVisualizerReady === 'function') opts.onVisualizerReady();
      });
    });
  }

  global.ReelPlatform = {
    applyReelOnlyFromHash: applyReelOnlyFromHash,
    updateReelScale: updateReelScale,
    setRecordStatus: setRecordStatus,
    setPlayControlsBusy: setPlayControlsBusy,
    bootControls: bootControls,
    bootApp: bootApp
  };
})(typeof window !== 'undefined' ? window : globalThis);
