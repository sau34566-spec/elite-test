/* Accidental-navigation protection. Browser toolbar reload uses native wording. */
(function () {
  "use strict";
  let config = { active: () => false, unsaved: () => false, exit: async () => {} };
  let historyAdded = false;
  let unloadListening = false;
  let allowReload = false;
  let promptKind = null;
  let nativePromptUntil = 0;
  const marker = "__bookeshExamGuard";
  const dialog = () => document.getElementById("exam-navigation-dialog");

  function beforeUnload(event) {
    if (allowReload) { allowReload = false; return; }
    if (!config.active() && !config.unsaved()) return;
    // No score, refresh counter or submission changes until navigation occurs.
    nativePromptUntil = Date.now() + 2000;
    setTimeout(() => { nativePromptUntil = Date.now() + 250; }, 0);
    event.preventDefault();
    event.returnValue = true;
  }

  function update() {
    const needed = config.active() || config.unsaved();
    if (needed && !unloadListening) window.addEventListener("beforeunload", beforeUnload);
    if (!needed && unloadListening) window.removeEventListener("beforeunload", beforeUnload);
    unloadListening = needed;
  }

  function close() {
    promptKind = null;
    if (dialog()?.open) dialog().close();
  }

  function show(kind) {
    if (!config.active() || !dialog()) return false;
    promptKind = kind;
    const refresh = kind === "refresh";
    document.getElementById("navigation-title").textContent = refresh ? "Refresh this page?" : "Exit this test?";
    document.getElementById("navigation-description").textContent = refresh
      ? "Refreshing may interrupt your exam and lose your current answers. Your timer will not pause. Are you sure you want to refresh?"
      : "Your current answers will be submitted and this attempt will end. You will not be able to continue this test. Are you sure you want to exit?";
    document.getElementById("navigation-yes").textContent = refresh ? "Yes, refresh" : "Yes, submit & exit";
    if (!dialog().open) dialog().showModal();
    document.getElementById("navigation-no").focus();
    return true;
  }

  function start(options) {
    if (options) config = { ...config, ...options };
    if (!historyAdded) {
      history.pushState({ ...history.state, [marker]: true }, "", location.href);
      historyAdded = true;
    }
    update();
  }

  function stop() {
    close();
    update();
  }

  window.addEventListener("popstate", () => {
    if (!historyAdded) return;
    if (!config.active()) {
      historyAdded = false;
      // Skip our one duplicate entry when leaving the completed test.
      if (!config.unsaved()) history.back();
      return;
    }
    history.pushState({ ...history.state, [marker]: true }, "", location.href);
    show("exit");
  });

  document.addEventListener("keydown", event => {
    if (config.active() && (event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r"))) {
      event.preventDefault();
      show("refresh");
    }
  });

  document.getElementById("navigation-no")?.addEventListener("click", () => {
    close();
    if (config.active()) {
      void window.ExamSecurityGuard?.requestFullscreen();
      void window.ExamScreenAwake?.start();
    }
  });
  dialog()?.addEventListener("cancel", event => {
    event.preventDefault();
    document.getElementById("navigation-no").click();
  });
  document.getElementById("navigation-yes")?.addEventListener("click", async () => {
    const kind = promptKind;
    if (!kind || !config.active()) { close(); return; }
    close();
    if (kind === "refresh") { allowReload = true; location.reload(); return; }
    // Exit ends the exam and displays its completion/save status, so a failed
    // network request cannot silently lose the submission while navigating away.
    await config.exit();
  });

  window.ExamNavigationGuard = {
    start, stop, update,
    handleFullscreenExit: () => !document.hidden && show("exit"),
    isNativePromptPending: () => !document.hidden && Date.now() < nativePromptUntil
  };
})();
