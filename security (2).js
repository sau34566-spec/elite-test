/* Elite Test multi-signal browser security guard.
 * It never observes question element dimensions, so question size changes
 * cannot create a violation.
 */
(function () {
  "use strict";

  const config = {
    active: () => false,
    onViolation: () => {},
    questionSelector: ".question-text, #question-text",
    cooldownMs: 1400,
    verifyResizeMs: 800,
    longPressMs: 850,
    widthRatio: 0.78,
    heightRatio: 0.64
  };

  let armed = false;
  let baselineWidth = 0;
  let baselineHeight = 0;
  let fullscreenWasEntered = false;
  let lastViolationAt = 0;
  let resizeTimer = 0;
  let blurTimer = 0;
  let longPressTimer = 0;
  let multiTouchTimer = 0;
  let pointerStart = null;
  const activePointers = new Set();
  let maximumTouchPoints = 0;
  let listenersInstalled = false;

  function viewportSize() {
    return {
      width: window.visualViewport?.width || window.innerWidth,
      height: window.visualViewport?.height || window.innerHeight
    };
  }

  function isActive() {
    return armed && Boolean(config.active());
  }

  function report(reason, severity = "hard", details = {}) {
    if (!isActive()) return;
    const now = Date.now();
    if (now - lastViolationAt < config.cooldownMs) return;
    lastViolationAt = now;
    config.onViolation({ reason, severity, time: now, details });
  }

  function clearLongPress() {
    window.clearTimeout(longPressTimer);
    longPressTimer = 0;
  }

  function questionTarget(target) {
    return target instanceof Element
      ? target.closest(config.questionSelector)
      : null;
  }

  function checkViewport() {
    if (!isActive() || !baselineWidth || !baselineHeight) return;
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!isActive()) return;
      const size = viewportSize();
      const widthRatio = size.width / baselineWidth;
      const heightRatio = size.height / baselineHeight;
      if (widthRatio < config.widthRatio || heightRatio < config.heightRatio) {
        report("SUSPICIOUS_SPLIT_OR_FLOATING_WINDOW", "suspicious", {
          widthRatio: Number(widthRatio.toFixed(2)),
          heightRatio: Number(heightRatio.toFixed(2))
        });
      }
    }, config.verifyResizeMs);
  }

  function installListeners() {
    if (listenersInstalled) return;
    listenersInstalled = true;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) report("PAGE_HIDDEN_OR_APP_SWITCH");
    });

    window.addEventListener("blur", () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!document.hasFocus()) report("TEST_WINDOW_FOCUS_LOST");
      }, 300);
    });

    document.addEventListener("fullscreenchange", () => {
      if (fullscreenWasEntered && !document.fullscreenElement) report("FULLSCREEN_EXITED");
    });

    window.addEventListener("resize", checkViewport);
    window.visualViewport?.addEventListener("resize", checkViewport);

    document.addEventListener("selectionchange", () => {
      if (!isActive()) return;
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) return;
      const node = selection.anchorNode?.parentElement;
      if (questionTarget(node)) {
        selection.removeAllRanges();
        report("QUESTION_TEXT_SELECTION", "suspicious");
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (!isActive()) return;

      if (event.pointerType === "touch") {
        activePointers.add(event.pointerId);
        maximumTouchPoints = Math.max(maximumTouchPoints, activePointers.size);

        if (activePointers.size >= 2 && !multiTouchTimer) {
          multiTouchTimer = window.setTimeout(() => {
            const count = maximumTouchPoints;
            report(
              count >= 3 ? "THREE_FINGER_TOUCH_DETECTED" : "MULTI_TOUCH_DETECTED",
              "suspicious",
              { touchPoints: count }
            );
            multiTouchTimer = 0;
            maximumTouchPoints = activePointers.size;
          }, 140);
        }
      }

      if (event.isPrimary === false) return;
      if (!questionTarget(event.target)) return;
      pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
      clearLongPress();
      longPressTimer = window.setTimeout(() => {
        report("LONG_PRESS_ON_QUESTION", "suspicious");
        pointerStart = null;
      }, config.longPressMs);
    }, { passive: true });

    document.addEventListener("pointermove", (event) => {
      if (!pointerStart || event.pointerId !== pointerStart.id) return;
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      if (moved > 18) {
        clearLongPress();
        // A normal vertical scroll frequently ends with pointercancel on mobile.
        // Clearing this prevents scrolling being mistaken for abnormal touch.
        pointerStart = null;
      }
    }, { passive: true });

    document.addEventListener("pointerup", (event) => {
      activePointers.delete(event.pointerId);
      clearLongPress();
      pointerStart = null;
    }, { passive: true });

    document.addEventListener("pointercancel", (event) => {
      activePointers.delete(event.pointerId);
      const hadQuestionPointer = Boolean(pointerStart);
      clearLongPress();
      pointerStart = null;
      if (hadQuestionPointer) report("QUESTION_POINTER_CANCELLED", "suspicious");
    }, { passive: true });
  }

  async function requestFullscreen() {
    if (document.fullscreenElement) {
      fullscreenWasEntered = true;
      return true;
    }
    try {
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!request) return false;
      await request.call(root);
      fullscreenWasEntered = Boolean(document.fullscreenElement);
      return fullscreenWasEntered;
    } catch (_error) {
      return false;
    }
  }

  function start(options = {}) {
    Object.assign(config, options);
    installListeners();
    const size = viewportSize();
    baselineWidth = size.width;
    baselineHeight = size.height;
    fullscreenWasEntered = Boolean(document.fullscreenElement);
    lastViolationAt = 0;
    armed = true;
  }

  function stop() {
    armed = false;
    clearLongPress();
    window.clearTimeout(resizeTimer);
    window.clearTimeout(blurTimer);
    window.clearTimeout(multiTouchTimer);
    multiTouchTimer = 0;
    activePointers.clear();
    maximumTouchPoints = 0;
  }

  window.ExamSecurityGuard = { start, stop, requestFullscreen };
})();
