const screens = document.querySelectorAll(".screen");

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function arrangeConfetti() {
  const confetti = document.querySelectorAll(".confetti span");
  const delays = shuffle(Array.from({ length: confetti.length }, (_, index) => index));
  const slotWidth = 92 / confetti.length;

  confetti.forEach((piece, index) => {
    const left = 2 + index * slotWidth + (Math.random() - 0.5) * slotWidth * 0.5;
    const delay = delays[index] * 0.22;
    const duration = 5.5 + Math.random() * 2;
    piece.style.setProperty("--confetti-left", `${left}%`);
    piece.style.setProperty("--confetti-delay", `${delay}s`);
    piece.style.setProperty("--confetti-duration", `${duration}s`);
  });
}

function showScreen(screenId) {
  const previousScreen = document.querySelector(".screen:not([hidden])")?.id ?? null;

  if (screenId === "end-screen") {
    arrangeConfetti();
  }

  for (const screen of screens) {
    screen.hidden = screen.id !== screenId;
  }

  document.dispatchEvent(new CustomEvent("game-screen-change", {
    detail: { screenId, previousScreen },
  }));
}

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-screen]");
  if (!control) {
    return;
  }

  event.preventDefault();
  showScreen(control.dataset.screen);
});
