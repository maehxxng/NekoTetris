const KEY_ACTIONS = new Map([
  ["ArrowLeft", "move-left"],
  ["ArrowRight", "move-right"],
  ["ArrowUp", "rotate"],
  ["ArrowDown", "soft-drop"],
  [" ", "hard-drop"],
]);

function isGameVisible() {
  return !document.querySelector("#game-screen").hidden;
}

function sendGameAction(action) {
  document.dispatchEvent(new CustomEvent("game-action", {
    detail: { action },
  }));
}

function togglePause() {
  if (isGameVisible()) {
    showScreen("pause-screen");
  } else if (!document.querySelector("#pause-screen").hidden) {
    showScreen("game-screen");
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p") {
    if (!document.querySelector("#game-screen").hidden || !document.querySelector("#pause-screen").hidden) {
      event.preventDefault();
      togglePause();
    }
    return;
  }

  if (!isGameVisible()) {
    return;
  }

  const action = KEY_ACTIONS.get(event.key);
  if (!action) {
    return;
  }

  event.preventDefault();
  if (!event.repeat || action === "move-left" || action === "move-right" || action === "soft-drop") {
    sendGameAction(action);
  }
});

document.querySelector(".touch-controls").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !isGameVisible()) {
    return;
  }

  sendGameAction(button.dataset.action);
});
