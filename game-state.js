const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BOARD_GRAVITY_STEP_MS = 60;
const LINE_CLEAR_POINTS = [0, 100, 300, 500, 800];
const PIECE_SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};
const PIECE_TYPES = Object.keys(PIECE_SHAPES);

let board = [];
let currentPiece = null;
let nextPieceType = null;
let score = 0;
let gameOver = false;
let isPaused = false;
let isHardDropping = false;
let isClearingLines = false;
let hardDropTimer = null;
let lineClearTimer = null;
let gravityTimer = null;
let pendingClearRows = [];
let lineClearRemaining = 0;
let lineClearStartedAt = 0;
let gravityRemaining = 0;
let gravityStartedAt = 0;

const gameBoard = document.querySelector("#game-board");
const nextPiecePreview = document.querySelector("#next-piece");
const scoreDisplay = document.querySelector(".score-value");
const finalScoreDisplay = document.querySelector("#final-score");

function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function advanceBoardGravity() {
  const nextBoard = board.map((row) => [...row]);
  let hasMoved = false;

  for (let column = 0; column < BOARD_WIDTH; column += 1) {
    for (let row = BOARD_HEIGHT - 2; row >= 0; row -= 1) {
      if (board[row][column] !== null && board[row + 1][column] === null) {
        nextBoard[row + 1][column] = board[row][column];
        nextBoard[row][column] = null;
        hasMoved = true;
      }
    }
  }

  board = nextBoard;
  return hasMoved;
}

function findFullRows() {
  return board
    .map((row, index) => row.every((cell) => cell !== null) ? index : -1)
    .filter((index) => index !== -1);
}

function scoreClearedRows(rowCount) {
  score += LINE_CLEAR_POINTS[Math.min(rowCount, LINE_CLEAR_POINTS.length - 1)];
}

function createPiece(type) {
  const shape = PIECE_SHAPES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    y: 0,
  };
}

function choosePieceType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

function canPlace(piece, x = piece.x, y = piece.y, shape = piece.shape) {
  return shape.every((row, rowIndex) => row.every((cell, columnIndex) => {
    if (!cell) {
      return true;
    }

    const boardX = x + columnIndex;
    const boardY = y + rowIndex;

    return boardX >= 0
      && boardX < BOARD_WIDTH
      && boardY < BOARD_HEIGHT
      && (boardY < 0 || board[boardY][boardX] === null);
  }));
}

function getVisibleBoard() {
  const visible = board.map((row) => [...row]);

  if (currentPiece) {
    currentPiece.shape.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        const x = currentPiece.x + columnIndex;
        const y = currentPiece.y + rowIndex;

        if (cell && y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
          visible[y][x] = currentPiece.type;
        }
      });
    });
  }

  return visible;
}

function renderBoard() {
  const fragment = document.createDocumentFragment();

  for (const [rowIndex, row] of getVisibleBoard().entries()) {
    for (const type of row) {
      const cell = document.createElement("div");
      cell.className = "board-cell";
      cell.setAttribute("role", "gridcell");

      if (pendingClearRows.includes(rowIndex)) {
        cell.classList.add("line-clearing");
      }

      if (type) {
        cell.dataset.kind = type;
        cell.textContent = "🐱";
        cell.setAttribute("aria-label", `${type} 貓咪方塊`);
      } else {
        cell.setAttribute("aria-label", "空格");
      }

      fragment.append(cell);
    }
  }

  gameBoard.replaceChildren(fragment);
}

function renderNextPiece() {
  const shape = PIECE_SHAPES[nextPieceType];
  const fragment = document.createDocumentFragment();
  nextPiecePreview.style.gridTemplateColumns = `repeat(${shape[0].length}, 12px)`;

  for (const row of shape) {
    for (const isFilled of row) {
      const cell = document.createElement("span");
      cell.className = "next-piece-cell";

      if (isFilled) {
        cell.dataset.kind = nextPieceType;
        cell.textContent = "🐱";
      } else {
        cell.setAttribute("aria-hidden", "true");
      }

      fragment.append(cell);
    }
  }

  nextPiecePreview.replaceChildren(fragment);
  nextPiecePreview.setAttribute("aria-label", `下一個方塊：${nextPieceType}`);
}

function renderGameState() {
  renderBoard();
  renderNextPiece();
  scoreDisplay.textContent = String(score).padStart(6, "0");
  finalScoreDisplay.textContent = String(score).padStart(6, "0");
  document.dispatchEvent(new CustomEvent("game-state-updated", {
    detail: { score, gameOver },
  }));
}

function spawnNextPiece() {
  currentPiece = createPiece(nextPieceType);
  nextPieceType = choosePieceType();

  if (!canPlace(currentPiece)) {
    gameOver = true;
  }
}

function lockPiece() {
  currentPiece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (cell) {
        const x = currentPiece.x + columnIndex;
        const y = currentPiece.y + rowIndex;

        if (y >= 0) {
          board[y][x] = currentPiece.type;
        }
      }
    });
  });
  currentPiece = null;

  pendingClearRows = findFullRows();

  if (pendingClearRows.length > 0) {
    scoreClearedRows(pendingClearRows.length);
    isClearingLines = true;
    renderGameState();
    resumeLineClear();
    return;
  }

  finishLock();
}

function finishLock() {
  spawnNextPiece();

  if (gameOver) {
    finishGame();
    return;
  }

  renderGameState();
}

function resumeLineClear() {
  if (!isClearingLines || isPaused || lineClearTimer !== null) {
    return;
  }

  lineClearRemaining ||= 560;
  lineClearStartedAt = Date.now();
  lineClearTimer = window.setTimeout(() => {
    lineClearTimer = null;
    board = board.filter((_, index) => !pendingClearRows.includes(index));
    board.unshift(...Array.from(
      { length: pendingClearRows.length },
      () => Array(BOARD_WIDTH).fill(null),
    ));
    pendingClearRows = [];
    lineClearRemaining = 0;
    gravityRemaining = BOARD_GRAVITY_STEP_MS;
    renderGameState();
    resumeBoardGravity();
  }, lineClearRemaining || 560);
}

function resumeBoardGravity() {
  if (!isClearingLines || isPaused || gravityTimer !== null || lineClearTimer !== null) {
    return;
  }

  gravityRemaining ||= BOARD_GRAVITY_STEP_MS;
  gravityStartedAt = Date.now();
  gravityTimer = window.setTimeout(() => {
    gravityTimer = null;

    if (advanceBoardGravity()) {
      renderGameState();
      gravityRemaining = BOARD_GRAVITY_STEP_MS;
      resumeBoardGravity();
      return;
    }

    pendingClearRows = findFullRows();
    if (pendingClearRows.length > 0) {
      scoreClearedRows(pendingClearRows.length);
      lineClearRemaining = 560;
      renderGameState();
      resumeLineClear();
      return;
    }

    isClearingLines = false;
    gravityRemaining = 0;
    finishLock();
  }, gravityRemaining || BOARD_GRAVITY_STEP_MS);
}

function pauseAnimations() {
  if (hardDropTimer !== null) {
    window.clearInterval(hardDropTimer);
    hardDropTimer = null;
  }

  if (lineClearTimer !== null) {
    window.clearTimeout(lineClearTimer);
    lineClearTimer = null;
    lineClearRemaining = Math.max(0, lineClearRemaining - (Date.now() - lineClearStartedAt));
  }

  if (gravityTimer !== null) {
    window.clearTimeout(gravityTimer);
    gravityTimer = null;
    gravityRemaining = Math.max(0, gravityRemaining - (Date.now() - gravityStartedAt));
  }
}

function resumeHardDrop() {
  if (!isHardDropping || isPaused || hardDropTimer !== null) {
    return;
  }

  hardDropTimer = window.setInterval(() => {
    if (!canPlace(currentPiece, currentPiece.x, currentPiece.y + 1)) {
      window.clearInterval(hardDropTimer);
      hardDropTimer = null;
      isHardDropping = false;
      lockPiece();
      return;
    }

    currentPiece.y += 1;
    renderGameState();
  }, 30);
}

function finishGame() {
  renderGameState();
  document.dispatchEvent(new CustomEvent("game-screen-request", {
    detail: { screenId: "end-screen" },
  }));
}

function advancePiece() {
  if (gameOver || isPaused || isHardDropping || isClearingLines) {
    return;
  }

  if (canPlace(currentPiece, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y += 1;
  } else {
    lockPiece();
  }

  if (gameOver) {
    finishGame();
    return;
  }

  if (!isClearingLines) {
    renderGameState();
  }
}

function rotatePiece() {
  const rotatedShape = currentPiece.shape[0].map((_, columnIndex) =>
    currentPiece.shape.map((row) => row[columnIndex]).reverse());

  for (const offset of [0, -1, 1, -2, 2]) {
    const x = currentPiece.x + offset;
    if (canPlace(currentPiece, x, currentPiece.y, rotatedShape)) {
      currentPiece.x = x;
      currentPiece.shape = rotatedShape;
      return;
    }
  }
}

function handleGameAction(event) {
  if (
    !currentPiece
    || gameOver
    || isPaused
    || isHardDropping
    || isClearingLines
    || document.querySelector("#game-screen").hidden
  ) {
    return;
  }

  const { action } = event.detail;

  if (action === "move-left" && canPlace(currentPiece, currentPiece.x - 1)) {
    currentPiece.x -= 1;
  } else if (action === "move-right" && canPlace(currentPiece, currentPiece.x + 1)) {
    currentPiece.x += 1;
  } else if (action === "rotate") {
    rotatePiece();
  } else if (action === "soft-drop") {
    advancePiece();
    return;
  } else if (action === "hard-drop") {
    isHardDropping = true;
    resumeHardDrop();
    return;
  } else {
    return;
  }

  renderGameState();
}

function startNewGame() {
  pauseAnimations();
  isHardDropping = false;
  isClearingLines = false;
  pendingClearRows = [];
  lineClearRemaining = 0;
  gravityRemaining = 0;
  isPaused = false;
  board = createEmptyBoard();
  score = 0;
  gameOver = false;
  nextPieceType = choosePieceType();
  spawnNextPiece();
  renderGameState();
}

document.addEventListener("game-screen-change", (event) => {
  isPaused = event.detail.screenId !== "game-screen";

  if (isPaused) {
    pauseAnimations();
    return;
  }

  if (event.detail.screenId === "game-screen" && event.detail.previousScreen !== "pause-screen") {
    startNewGame();
    return;
  }

  if (event.detail.screenId === "game-screen") {
    resumeHardDrop();
    resumeLineClear();
    resumeBoardGravity();
  }
});

document.addEventListener("game-screen-request", (event) => {
  showScreen(event.detail.screenId);
});

document.addEventListener("game-tick", advancePiece);
document.addEventListener("game-action", handleGameAction);
