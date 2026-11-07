const GAME_TICK_MS = 800;
let gameLoopTimer = null;

function stopGameLoop() {
  if (gameLoopTimer !== null) {
    window.clearInterval(gameLoopTimer);
    gameLoopTimer = null;
  }
}

document.addEventListener("game-screen-change", (event) => {
  stopGameLoop();

  if (event.detail.screenId !== "game-screen") {
    return;
  }

  gameLoopTimer = window.setInterval(() => {
    document.dispatchEvent(new Event("game-tick"));
  }, GAME_TICK_MS);
});
