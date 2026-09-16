/* Keep the screen awake only while starting or taking an exam. */
(function () {
  "use strict";
  let wanted = false;
  let sentinel = null;
  let pending = null;
  let retryTimer = 0;
  let generation = 0;

  function status(message) {
    const node = document.getElementById("screen-awake-status");
    if (node) node.textContent = message;
  }

  function acquire() {
    if (!wanted || document.visibilityState === "hidden") return Promise.resolve();
    if (sentinel && !sentinel.released) return Promise.resolve();
    if (pending) return pending;
    if (!navigator.wakeLock?.request) {
      status("Auto screen-on is unavailable. Increase your phone's screen timeout before the test.");
      return Promise.resolve();
    }
    const requestGeneration = generation;
    pending = (async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (!wanted || requestGeneration !== generation || document.visibilityState === "hidden") {
          await lock.release();
          return;
        }
        sentinel = lock;
        status("Screen will stay on during the test.");
        lock.addEventListener("release", () => {
          if (sentinel !== lock) return;
          sentinel = null;
          if (wanted) {
            status("Screen-on protection paused. Keep this page visible and check battery saver.");
            clearTimeout(retryTimer);
            retryTimer = setTimeout(acquire, 5000);
          }
        });
      } catch {
        status("Screen-on protection is unavailable. Check battery saver and screen timeout.");
      } finally {
        pending = null;
        if (wanted && requestGeneration !== generation) void acquire();
      }
    })();
    return pending;
  }

  function start() {
    wanted = true;
    return acquire();
  }

  function stop() {
    wanted = false;
    generation++;
    clearTimeout(retryTimer);
    const lock = sentinel;
    sentinel = null;
    status("");
    if (lock && !lock.released) void lock.release().catch(() => {});
  }

  document.addEventListener("visibilitychange", acquire);
  document.addEventListener("fullscreenchange", acquire);
  document.addEventListener("webkitfullscreenchange", acquire);
  window.addEventListener("focus", acquire);
  window.addEventListener("pagehide", stop);
  window.ExamScreenAwake = { start, stop };
})();
