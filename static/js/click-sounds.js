(function () {
  var CLICK_SRC = '/audio/click.mp3';
  var ERROR_SRC = '/audio/error.mp3';

  var CLICKABLE_SELECTOR =
    'a, button, input, select, textarea, label, summary, ' +
    '[role="button"], [role="link"], [role="menuitem"], [role="tab"], ' +
    '[tabindex]:not([tabindex="-1"]), [onclick], ' +
    '#mask, .menu-toggle, .code-header .copy, .code-header .ellipses, ' +
    '.code-header .code-title, [id^="search-toggle-"], [id^="search-clear-"], ' +
    '[id^="search-cancel-"]';

  // Catches other JS-bound controls (theme UI toggles, switches, etc.) that
  // don't expose any semantic markup for the selector above to match.
  var CLICKABLE_HINT_RE = /toggle|switch|clear|cancel|copy|ellipses|mask|menu|toc/i;

  function classNameOf(el) {
    if (!el.classList) return '';
    return Array.prototype.join.call(el.classList, ' ');
  }

  function looksClickable(el) {
    if (el.matches && el.matches(CLICKABLE_SELECTOR)) return true;
    var hint = (el.id || '') + ' ' + classNameOf(el);
    if (CLICKABLE_HINT_RE.test(hint)) return true;
    var style = window.getComputedStyle(el);
    return !!style && style.cursor === 'pointer';
  }

  function isClickable(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (looksClickable(el)) return true;
      el = el.parentElement;
    }
    return false;
  }

  // Web Audio gives near-zero playback latency (audio is decoded to a raw
  // buffer up front, so play() has no per-click network/decode work left).
  var AudioContextClass = window.AudioContext || window.webkitAudioContext;
  var ctx = AudioContextClass ? new AudioContextClass() : null;
  var gainNode = null;
  var buffers = {};

  if (ctx) {
    gainNode = ctx.createGain();
    gainNode.gain.value = 0.5;
    gainNode.connect(ctx.destination);

    var loadBuffer = function (key, url) {
      fetch(url)
        .then(function (res) {
          return res.arrayBuffer();
        })
        .then(function (data) {
          return ctx.decodeAudioData(data);
        })
        .then(function (buffer) {
          buffers[key] = buffer;
        })
        .catch(function () {});
    };
    loadBuffer('click', CLICK_SRC);
    loadBuffer('error', ERROR_SRC);
  }

  // Fallback for browsers without Web Audio support.
  var fallback = {
    click: preloadAudio(CLICK_SRC),
    error: preloadAudio(ERROR_SRC),
  };

  function preloadAudio(src) {
    var audio = new Audio(src);
    audio.preload = 'auto';
    audio.load();
    return audio;
  }

  function play(key) {
    if (ctx && buffers[key]) {
      if (ctx.state === 'suspended') ctx.resume();
      var source = ctx.createBufferSource();
      source.buffer = buffers[key];
      source.connect(gainNode);
      source.start(0);
      return;
    }
    try {
      var node = fallback[key].cloneNode(true);
      node.volume = 0.5;
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  document.addEventListener(
    'click',
    function (event) {
      play(isClickable(event.target) ? 'click' : 'error');
    },
    true
  );
})();
