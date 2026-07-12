(function () {
  var CLICK_SRC = '/audio/click.mp3';
  var VOLUME = 0.85;

  // Web Audio gives near-zero playback latency (audio is decoded to a raw
  // buffer up front, so play() has no per-click network/decode work left).
  var AudioContextClass = window.AudioContext || window.webkitAudioContext;
  var ctx = AudioContextClass ? new AudioContextClass() : null;
  var gainNode = null;
  var buffer = null;

  if (ctx) {
    gainNode = ctx.createGain();
    gainNode.gain.value = VOLUME;
    gainNode.connect(ctx.destination);

    fetch(CLICK_SRC)
      .then(function (res) {
        return res.arrayBuffer();
      })
      .then(function (data) {
        return ctx.decodeAudioData(data);
      })
      .then(function (decoded) {
        buffer = decoded;
      })
      .catch(function () {});

    // Resume as early as possible on the first user gesture (mousedown
    // fires before click) so the context is already running by the time
    // the click itself needs to play.
    var resumeCtx = function () {
      if (ctx.state === 'suspended') ctx.resume();
    };
    document.addEventListener('pointerdown', resumeCtx, true);
    document.addEventListener('keydown', resumeCtx, true);
  }

  // Fallback for browsers without Web Audio support.
  var fallbackAudio = new Audio(CLICK_SRC);
  fallbackAudio.preload = 'auto';
  fallbackAudio.load();

  function playClick() {
    if (ctx && buffer) {
      if (ctx.state === 'suspended') ctx.resume();
      var source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(0);
      return;
    }
    try {
      var node = fallbackAudio.cloneNode(true);
      node.volume = VOLUME;
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  document.addEventListener('click', playClick, true);
})();
