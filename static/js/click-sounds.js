(function () {
  var CLICK_SRC = '/audio/click.mp3';
  var ERROR_SRC = '/audio/error.mp3';
  var CLICKABLE_SELECTOR =
    'a, button, input, select, textarea, label, summary, ' +
    '[role="button"], [role="link"], [role="menuitem"], [role="tab"], ' +
    '[tabindex]:not([tabindex="-1"]), [onclick]';

  function preload(src) {
    var audio = new Audio(src);
    audio.preload = 'auto';
    audio.load();
    return audio;
  }

  var clickAudio = preload(CLICK_SRC);
  var errorAudio = preload(ERROR_SRC);

  function isClickable(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.matches && el.matches(CLICKABLE_SELECTOR)) return true;
      var style = window.getComputedStyle(el);
      if (style && style.cursor === 'pointer') return true;
      el = el.parentElement;
    }
    return false;
  }

  function playSound(base) {
    try {
      var node = base.cloneNode(true);
      node.volume = 0.5;
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  document.addEventListener(
    'click',
    function (event) {
      playSound(isClickable(event.target) ? clickAudio : errorAudio);
    },
    true
  );
})();
