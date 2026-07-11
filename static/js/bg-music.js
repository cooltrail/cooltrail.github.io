(function () {
  var audio = document.getElementById('bg-music');
  if (!audio) return;

  var STORAGE_KEY = 'bg-music-state';
  var pausedForVideo = false;
  var pausedByUser = false;

  function saveState() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          time: audio.currentTime,
          playing: !audio.paused && !pausedByUser,
        })
      );
    } catch (e) {}
  }

  function readSavedState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  var saved = readSavedState();
  if (saved && typeof saved.time === 'number') {
    var applyTime = function () {
      try {
        audio.currentTime = saved.time;
      } catch (e) {}
    };
    if (audio.readyState >= 1) {
      applyTime();
    } else {
      audio.addEventListener('loadedmetadata', applyTime, { once: true });
    }
  }

  function startAudio() {
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        var resume = function () {
          audio.play().catch(function () {});
        };
        document.addEventListener('click', resume, { once: true });
        document.addEventListener('keydown', resume, { once: true });
        document.addEventListener('touchstart', resume, { once: true });
      });
    }
  }

  function pauseForVideo() {
    if (!audio.paused) {
      pausedForVideo = true;
      audio.pause();
    }
  }

  function resumeAfterVideo() {
    if (pausedForVideo) {
      pausedForVideo = false;
      if (!pausedByUser) audio.play().catch(function () {});
    }
  }

  document.querySelectorAll('video').forEach(function (video) {
    video.addEventListener('play', pauseForVideo);
    video.addEventListener('pause', resumeAfterVideo);
    video.addEventListener('ended', resumeAfterVideo);
  });

  var ytIframes = document.querySelectorAll('iframe.bg-music-aware-video');
  if (ytIframes.length) {
    var attachPlayers = function () {
      ytIframes.forEach(function (iframe) {
        new YT.Player(iframe.id, {
          events: {
            onStateChange: function (event) {
              if (event.data === YT.PlayerState.PLAYING) {
                pauseForVideo();
              } else if (
                event.data === YT.PlayerState.PAUSED ||
                event.data === YT.PlayerState.ENDED
              ) {
                resumeAfterVideo();
              }
            },
          },
        });
      });
    };

    if (window.YT && window.YT.Player) {
      attachPlayers();
    } else {
      var existingApiScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (!existingApiScript) {
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      var previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previousReady === 'function') previousReady();
        attachPlayers();
      };
    }
  }

  window.addEventListener('pagehide', saveState);
  window.addEventListener('beforeunload', saveState);
  setInterval(saveState, 1000);

  if (!saved || saved.playing !== false) {
    startAudio();
  }
})();
