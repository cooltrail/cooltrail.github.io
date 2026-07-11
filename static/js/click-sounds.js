(function () {
  var CLICK_SRC = '/audio/click.mp3';
  var ERROR_SRC = '/audio/error.mp3';
  var CLICKABLE_SELECTOR =
    'a, button, input, select, textarea, label, summary, ' +
    '[role="button"], [role="link"], [role="menuitem"], [role="tab"], ' +
    '[tabindex]:not([tabindex="-1"]), [onclick]';

  function isClickable(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.matches && el.matches(CLICKABLE_SELECTOR)) return true;
      var style = window.getComputedStyle(el);
      if (style && style.cursor === 'pointer') return true;
      el = el.parentElement;
    }
    return false;
  }

  function playSound(src) {
    try {
      var audio = new Audio(src);
      audio.volume = 0.5;
      audio.play().catch(function () {});
    } catch (e) {}
  }

  document.addEventListener(
    'click',
    function (event) {
      playSound(isClickable(event.target) ? CLICK_SRC : ERROR_SRC);
    },
    true
  );
})();
