/**
 * Shared 1080×1920 reel shell: scaling, reel-only hash, playback + export at exact frame size.
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
  var recordUsedElementCrop = false;
  var recordFileStem = 'instagram-reel-1080x1920';

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

  function stripRecordStem(name) {
    if (!name || typeof name !== 'string') return 'instagram-reel-1080x1920';
    return name.replace(/\.(webm|mp4|mpeg)$/i, '');
  }

  function extensionForMime(mime) {
    var m = (mime || '').toLowerCase();
    if (m.indexOf('mp4') !== -1) return 'mp4';
    return 'webm';
  }

  function pickMimeType() {
    if (!global.MediaRecorder) return '';
    var types = [
      'video/mp4; codecs=avc1.42E01E',
      'video/mp4; codecs=avc1.424028DE',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return '';
  }

  async function startScreenRecord() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setRecordStatus('Use Chrome/Edge for tab capture, or film the neon frame with your phone.');
      return;
    }

    var targetEl = document.getElementById('recordFrameTarget');
    recordUsedElementCrop = false;

    var cropConstraints = null;
    if (global.CropTarget && targetEl && typeof CropTarget.fromElement === 'function') {
      try {
        var ct = await CropTarget.fromElement(targetEl);
        cropConstraints = { audio: false, video: { cropTarget: ct } };
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
        return navigator.mediaDevices.getDisplayMedia({ video: cropVid, audio: false });
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
      } catch (e2) {}
    }
    if (!stream) {
      setRecordStatus('Capture cancelled. Try Reel-only (#reel) and share this tab.');
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
      setRecordStatus('Could not start capture preview.');
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

    var outStream = canvas.captureStream(30);
    if (!outStream || !outStream.getVideoTracks().length) {
      setRecordStatus('Browser cannot capture canvas stream.');
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
    var isMp4Out = mime && mime.indexOf('mp4') !== -1;
    var recOpts = { videoBitsPerSecond: isMp4Out ? 12000000 : 9000000 };
    if (mime) recOpts.mimeType = mime;
    try {
      mediaRecorder = new MediaRecorder(outStream, recOpts);
    } catch (e4) {
      try {
        mediaRecorder = mime ? new MediaRecorder(outStream, { mimeType: mime }) : new MediaRecorder(outStream);
      } catch (e5) {
        setRecordStatus('MediaRecorder unavailable on this device.');
        cleanupRecordStream();
        return;
      }
    }

    mediaRecorder.ondataavailable = function(ev) {
      if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data);
    };
    mediaRecorder.onstop = function() {
      if (!recordedChunks.length) {
        setRecordStatus('No video data — keep sharing until you press Stop.');
        cleanupRecordStream();
        return;
      }
      var blobType = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : 'video/webm';
      var blob = new Blob(recordedChunks, { type: blobType });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var ext = extensionForMime(blobType);
      a.download = recordFileStem + '.' + ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setRecordStatus('Saved exactly ' + IG_REEL_W + '×' + IG_REEL_H + ' · Post as Instagram Reel (not Feed — Feed only allows 4:5–16:9).');
      cleanupRecordStream();
    };

    var rs = document.getElementById('recordScreenBtn');
    var st = document.getElementById('stopRecordBtn');
    if (rs) {
      rs.disabled = true;
      rs.classList.add('recording');
    }
    if (st) st.disabled = false;

    setRecordStatus('Recording… Choose this tab. File will be ' + IG_REEL_W + '×' + IG_REEL_H + ' (' + (isMp4Out ? 'MP4' : 'WebM') + ').');

    try {
      drawInstagramFrame();
      mediaRecorder.start(200);
      recordComposeRaf = requestAnimationFrame(composeLoop);
    } catch (e6) {
      setRecordStatus('Could not start recording.');
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
   * @param {(sliderRaw: number) => void} opts.onSpeedInput
   * @param {() => void} [opts.onLayoutRefresh]
   * @param {string} [opts.recordDownloadBasename] filename stem (.mp4/.webm appended)
   */
  function bootControls(opts) {
    if (!opts || typeof opts.getIsAnimating !== 'function') {
      throw new Error('ReelPlatform.bootControls: getIsAnimating required');
    }
    if (typeof opts.onPlay !== 'function' || typeof opts.onReset !== 'function' || typeof opts.onSpeedInput !== 'function') {
      throw new Error('ReelPlatform.bootControls: onPlay, onReset, onSpeedInput required');
    }

    if (opts.recordDownloadBasename) {
      recordFileStem = stripRecordStem(opts.recordDownloadBasename);
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
    if (rb) rb.addEventListener('click', function() { startScreenRecord(); });
    if (stb) stb.addEventListener('click', function() { stopScreenRecord(); });

    var reelBtn = document.getElementById('reelOnlyBtn');
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

  function bootApp(opts) {
    applyReelOnlyFromHash();
    updateReelScale();
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (opts && typeof opts.onVisualizerReady === 'function') opts.onVisualizerReady();
      });
    });
  }

  global.ReelPlatform = {
    applyReelOnlyFromHash: applyReelOnlyFromHash,
    updateReelScale: updateReelScale,
    setPlayControlsBusy: setPlayControlsBusy,
    setRecordStatus: setRecordStatus,
    bootControls: bootControls,
    bootApp: bootApp
  };
})(typeof window !== 'undefined' ? window : globalThis);
