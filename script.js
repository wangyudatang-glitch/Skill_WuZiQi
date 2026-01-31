const canvas = document.getElementById("board");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");
const difficultySelect = document.getElementById("difficulty");

const ctx = canvas.getContext("2d");
const boardSize = 15;
const padding = 30;
const cellSize = (canvas.width - padding * 2) / (boardSize - 1);

let board = [];
let isPlayerTurn = true;
let gameOver = false;

const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

function initBoard() {
  board = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
  isPlayerTurn = true;
  gameOver = false;
  updateStatus("玩家先手");
  drawBoard();
}

function updateStatus(text) {
  statusEl.textContent = text;
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#4f3b24";
  ctx.lineWidth = 1;
  for (let i = 0; i < boardSize; i++) {
    const position = padding + cellSize * i;
    ctx.beginPath();
    ctx.moveTo(padding, position);
    ctx.lineTo(canvas.width - padding, position);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(position, padding);
    ctx.lineTo(position, canvas.height - padding);
    ctx.stroke();
  }

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] !== 0) {
        drawStone(row, col, board[row][col]);
      }
    }
  }
}

function drawStone(row, col, player) {
  const x = padding + col * cellSize;
  const y = padding + row * cellSize;
  const radius = cellSize * 0.45;
  const gradient = ctx.createRadialGradient(x - radius / 3, y - radius / 3, radius / 5, x, y, radius);
  if (player === 1) {
    gradient.addColorStop(0, "#555");
    gradient.addColorStop(1, "#111");
  } else {
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(1, "#d1c7b8");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function getCellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.round((x - padding) / cellSize);
  const row = Math.round((y - padding) / cellSize);
  if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) {
    return null;
  }
  return { row, col };
}

function isWinningMove(row, col, player) {
  for (const [dx, dy] of directions) {
    let count = 1;
    count += countDirection(row, col, player, dx, dy);
    count += countDirection(row, col, player, -dx, -dy);
    if (count >= 5) {
      return true;
    }
  }
  return false;
}

function countDirection(row, col, player, dx, dy) {
  let count = 0;
  let r = row + dy;
  let c = col + dx;
  while (r >= 0 && c >= 0 && r < boardSize && c < boardSize && board[r][c] === player) {
    count += 1;
    r += dy;
    c += dx;
  }
  return count;
}

function handlePlayerMove(event) {
  if (gameOver || !isPlayerTurn) {
    return;
  }
  const cell = getCellFromEvent(event);
  if (!cell) {
    return;
  }
  const { row, col } = cell;
  if (board[row][col] !== 0) {
    return;
  }
  board[row][col] = 1;
  drawBoard();
  if (isWinningMove(row, col, 1)) {
    gameOver = true;
    updateStatus("玩家获胜！");
    return;
  }
  isPlayerTurn = false;
  updateStatus("AI 思考中...");
  window.setTimeout(aiMove, 250);
}

function aiMove() {
  if (gameOver) {
    return;
  }
  const difficulty = difficultySelect.value;
  const move = selectAiMove(difficulty);
  if (!move) {
    gameOver = true;
    updateStatus("平局！");
    return;
  }
  board[move.row][move.col] = 2;
  drawBoard();
  if (isWinningMove(move.row, move.col, 2)) {
    gameOver = true;
    updateStatus("AI 获胜！");
    return;
  }
  isPlayerTurn = true;
  updateStatus("轮到玩家");
}

function selectAiMove(difficulty) {
  const candidates = getCandidateMoves();
  if (candidates.length === 0) {
    return null;
  }
  if (difficulty === "easy") {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  if (difficulty === "medium") {
    let bestMove = candidates[0];
    let bestScore = -Infinity;
    for (const move of candidates) {
      const score = evaluateMove(move, 2) + evaluateMove(move, 1) * 0.8;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }
  return minimaxMove(candidates, 2, 2);
}

function minimaxMove(candidates, depth, player) {
  let bestMove = candidates[0];
  let bestScore = -Infinity;
  for (const move of candidates) {
    board[move.row][move.col] = player;
    const score = minimax(depth - 1, false, -Infinity, Infinity);
    board[move.row][move.col] = 0;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

function minimax(depth, isMaximizing, alpha, beta) {
  if (depth === 0) {
    return evaluateBoard();
  }
  const candidates = getCandidateMoves();
  if (candidates.length === 0) {
    return 0;
  }
  if (isMaximizing) {
    let bestScore = -Infinity;
    for (const move of candidates) {
      board[move.row][move.col] = 2;
      if (isWinningMove(move.row, move.col, 2)) {
        board[move.row][move.col] = 0;
        return 100000;
      }
      const score = minimax(depth - 1, false, alpha, beta);
      board[move.row][move.col] = 0;
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) {
        break;
      }
    }
    return bestScore;
  }
  let bestScore = Infinity;
  for (const move of candidates) {
    board[move.row][move.col] = 1;
    if (isWinningMove(move.row, move.col, 1)) {
      board[move.row][move.col] = 0;
      return -100000;
    }
    const score = minimax(depth - 1, true, alpha, beta);
    board[move.row][move.col] = 0;
    bestScore = Math.min(bestScore, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) {
      break;
    }
  }
  return bestScore;
}

function getCandidateMoves() {
  const candidates = [];
  const radius = 2;
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] !== 0) {
        continue;
      }
      let nearStone = false;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r >= 0 && c >= 0 && r < boardSize && c < boardSize && board[r][c] !== 0) {
            nearStone = true;
            break;
          }
        }
        if (nearStone) {
          break;
        }
      }
      if (nearStone) {
        candidates.push({ row, col });
      }
    }
  }
  if (candidates.length === 0) {
    const center = Math.floor(boardSize / 2);
    return [{ row: center, col: center }];
  }
  return candidates;
}

function evaluateMove(move, player) {
  board[move.row][move.col] = player;
  const score = evaluateBoardFor(player);
  board[move.row][move.col] = 0;
  return score;
}

function evaluateBoard() {
  return evaluateBoardFor(2) - evaluateBoardFor(1) * 1.1;
}

function evaluateBoardFor(player) {
  let score = 0;
  const visited = new Set();
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] !== player) {
        continue;
      }
      for (const [dx, dy] of directions) {
        const key = `${row},${col},${dx},${dy}`;
        if (visited.has(key)) {
          continue;
        }
        const chain = getChain(row, col, player, dx, dy);
        chain.cells.forEach(({ r, c }) => visited.add(`${r},${c},${dx},${dy}`));
        score += scoreChain(chain.length, chain.openEnds);
      }
    }
  }
  return score;
}

function getChain(row, col, player, dx, dy) {
  let length = 0;
  const cells = [];
  let r = row;
  let c = col;
  while (r >= 0 && c >= 0 && r < boardSize && c < boardSize && board[r][c] === player) {
    cells.push({ r, c });
    length += 1;
    r += dy;
    c += dx;
  }
  let openEnds = 0;
  if (r >= 0 && c >= 0 && r < boardSize && c < boardSize && board[r][c] === 0) {
    openEnds += 1;
  }
  r = row - dy;
  c = col - dx;
  if (r >= 0 && c >= 0 && r < boardSize && c < boardSize && board[r][c] === 0) {
    openEnds += 1;
  }
  return { length, openEnds, cells };
}

function scoreChain(length, openEnds) {
  if (length >= 5) {
    return 100000;
  }
  if (openEnds === 0) {
    return 0;
  }
  if (length === 4) {
    return openEnds === 2 ? 10000 : 4000;
  }
  if (length === 3) {
    return openEnds === 2 ? 1200 : 300;
  }
  if (length === 2) {
    return openEnds === 2 ? 200 : 80;
  }
  return 10;
}

restartBtn.addEventListener("click", initBoard);
canvas.addEventListener("click", handlePlayerMove);

initBoard();