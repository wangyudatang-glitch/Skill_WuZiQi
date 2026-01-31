const canvas = document.getElementById("board");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");
const difficultySelect = document.getElementById("difficulty");
const playerHpEl = document.getElementById("player-hp");
const aiHpEl = document.getElementById("ai-hp");
const skillButtons = Array.from(document.querySelectorAll(".skill-card"));

const ctx = canvas.getContext("2d");
const boardSize = 15;
const padding = 30;
const cellSize = (canvas.width - padding * 2) / (boardSize - 1);
const queenValue = 3;
const queenImage = new Image();
queenImage.src = "icon/queen.jpg";
queenImage.onload = () => {
  drawBoard();
};

let board = [];
let isPlayerTurn = true;
let gameOver = false;
const maxHp = 3;
let playerHp = maxHp;
let aiHp = maxHp;
let moveHistory = [];
let turnCount = 0;
let currentSkill = null;
let selectedSkillStone = null;
let aiTimeoutId = null;
let queenReady = false;
let selectedQueen = null;

const skills = {
  timeRewind: { maxUses: 3, usesLeft: 3, cooldown: 0, lastUsedTurn: null },
  sandShift: { maxUses: 5, usesLeft: 5, cooldown: 10, lastUsedTurn: null },
  mountainLift: { maxUses: 2, usesLeft: 2, cooldown: 25, lastUsedTurn: null },
  boardBlast: { maxUses: 2, usesLeft: 2, cooldown: 50, lastUsedTurn: null },
  starDevour: { maxUses: Infinity, usesLeft: Infinity, cooldown: 500, lastUsedTurn: null },
  colorFlip: { maxUses: 1, usesLeft: 1, cooldown: 0, lastUsedTurn: null },
  summonQueen: { maxUses: 1, usesLeft: 1, cooldown: 0, lastUsedTurn: null },
};

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
  playerHp = maxHp;
  aiHp = maxHp;
  moveHistory = [];
  turnCount = 0;
  currentSkill = null;
  selectedSkillStone = null;
  queenReady = false;
  selectedQueen = null;
  if (aiTimeoutId) {
    window.clearTimeout(aiTimeoutId);
    aiTimeoutId = null;
  }
  resetSkills();
  updateStatus("玩家先手");
  updateHpDisplay();
  updateSkillUI();
  drawBoard();
}

function updateStatus(text) {
  statusEl.textContent = text;
}

function updateHpDisplay() {
  playerHpEl.textContent = `${playerHp}/${maxHp}`;
  aiHpEl.textContent = `${aiHp}/${maxHp}`;
}

function resetSkills() {
  Object.keys(skills).forEach((key) => {
    skills[key].usesLeft = skills[key].maxUses;
    skills[key].lastUsedTurn = null;
  });
}

function getCooldownRemaining(skill) {
  if (skill.cooldown === 0 || skill.lastUsedTurn === null) {
    return 0;
  }
  return Math.max(0, skill.cooldown - (turnCount - skill.lastUsedTurn));
}

function isSkillAvailable(skillId) {
  const skill = skills[skillId];
  if (!skill) {
    return false;
  }
  if (gameOver && skillId !== "timeRewind") {
    return false;
  }
  if (!isPlayerTurn && skillId !== "timeRewind") {
    return false;
  }
  if (skillId === "timeRewind" && moveHistory.length < 2) {
    return false;
  }
  if (skillId === "summonQueen" && queenReady) {
    return false;
  }
  return skill.usesLeft > 0 && getCooldownRemaining(skill) === 0;
}

function updateSkillUI() {
  skillButtons.forEach((button) => {
    const skillId = button.dataset.skill;
    const skill = skills[skillId];
    if (!skill) {
      return;
    }
    const usesEl = button.querySelector("[data-skill-uses]");
    const cdEl = button.querySelector("[data-skill-cd]");
    if (usesEl) {
      usesEl.textContent = Number.isFinite(skill.usesLeft) ? skill.usesLeft : "∞";
    }
    if (cdEl) {
      cdEl.textContent = getCooldownRemaining(skill);
    }
    button.disabled = !isSkillAvailable(skillId);
    button.classList.toggle("active", currentSkill === skillId);
  });
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
  if (player === queenValue) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    if (queenImage.complete && queenImage.naturalWidth > 0) {
      ctx.drawImage(queenImage, x - radius, y - radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = "#f0d8a3";
      ctx.fill();
    }
    ctx.restore();
    return;
  }
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

function matchesPlayer(value, player) {
  if (player === 1) {
    return value === 1 || value === queenValue;
  }
  return value === 2;
}

function getLineThroughMove(row, col, player, dx, dy) {
  const cells = [{ r: row, c: col }];
  let r = row - dy;
  let c = col - dx;
  while (r >= 0 && c >= 0 && r < boardSize && c < boardSize && matchesPlayer(board[r][c], player)) {
    cells.unshift({ r, c });
    r -= dy;
    c -= dx;
  }
  r = row + dy;
  c = col + dx;
  while (r >= 0 && c >= 0 && r < boardSize && c < boardSize && matchesPlayer(board[r][c], player)) {
    cells.push({ r, c });
    r += dy;
    c += dx;
  }
  return cells;
}

function getFiveSegmentThroughMove(cells, row, col) {
  const moveIndex = cells.findIndex((cell) => cell.r === row && cell.c === col);
  if (moveIndex === -1 || cells.length < 5) {
    return [];
  }
  const start = Math.min(Math.max(moveIndex - 2, 0), cells.length - 5);
  return cells.slice(start, start + 5);
}

function applyLineDamageFromMove(row, col, player) {
  const removeSet = new Set();
  let damage = 0;
  for (const [dx, dy] of directions) {
    const lineCells = getLineThroughMove(row, col, player, dx, dy);
    if (lineCells.length >= 5) {
      const segment = getFiveSegmentThroughMove(lineCells, row, col);
      if (segment.length === 5) {
        damage += 1;
        for (const cell of segment) {
          removeSet.add(`${cell.r},${cell.c}`);
        }
      }
    }
  }
  const removedCells = [];
  for (const key of removeSet) {
    const [r, c] = key.split(",").map(Number);
    if (player === 1 && board[r][c] === queenValue) {
      continue;
    }
    const removedValue = board[r][c];
    board[r][c] = 0;
    removedCells.push({ row: r, col: c, value: removedValue });
  }
  return { damage, removedCells };
}

function handlePlayerMove(cell) {
  const { row, col } = cell;
  if (board[row][col] !== 0) {
    return;
  }
  const placedValue = queenReady ? queenValue : 1;
  board[row][col] = placedValue;
  if (queenReady) {
    queenReady = false;
  }
  const { damage, removedCells } = applyLineDamageFromMove(row, col, 1);
  applyDamageToOpponent(1, damage);
  finishPlayerAction({
    type: "place",
    player: 1,
    row,
    col,
    damage,
    removedCells,
  });
}

function aiMove() {
  if (gameOver) {
    return;
  }
  if (aiTimeoutId) {
    aiTimeoutId = null;
  }
  const difficulty = difficultySelect.value;
  const move = selectAiMove(difficulty);
  if (!move) {
    gameOver = true;
    updateStatus("平局！");
    updateSkillUI();
    return;
  }
  board[move.row][move.col] = 2;
  const { damage, removedCells } = applyLineDamageFromMove(move.row, move.col, 2);
  applyDamageToOpponent(2, damage);
  moveHistory.push({
    type: "place",
    player: 2,
    row: move.row,
    col: move.col,
    damage,
    removedCells,
    turnIndex: turnCount + 1,
  });
  turnCount += 1;
  drawBoard();
  if (playerHp <= 0) {
    gameOver = true;
    updateStatus("AI 获胜！");
    updateSkillUI();
    return;
  }
  isPlayerTurn = true;
  updateStatus("轮到玩家");
  updateSkillUI();
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
      if (!matchesPlayer(board[row][col], player)) {
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
  while (r >= 0 && c >= 0 && r < boardSize && c < boardSize && matchesPlayer(board[r][c], player)) {
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

function applyDamageToOpponent(player, damage) {
  if (damage <= 0) {
    return;
  }
  if (player === 1) {
    aiHp = Math.max(0, aiHp - damage);
  } else {
    playerHp = Math.max(0, playerHp - damage);
  }
  updateHpDisplay();
}

function restoreDamageToOpponent(player, damage) {
  if (damage <= 0) {
    return;
  }
  if (player === 1) {
    aiHp = Math.min(maxHp, aiHp + damage);
  } else {
    playerHp = Math.min(maxHp, playerHp + damage);
  }
  updateHpDisplay();
}

function finishPlayerAction(entry, { endTurn = true } = {}) {
  const actionTurnIndex = endTurn ? turnCount + 1 : turnCount;
  moveHistory.push({ ...entry, turnIndex: actionTurnIndex });
  if (endTurn) {
    turnCount += 1;
  }
  if (entry.skillId) {
    const skill = skills[entry.skillId];
    if (Number.isFinite(skill.usesLeft)) {
      skill.usesLeft = Math.max(0, skill.usesLeft - 1);
    }
    skill.lastUsedTurn = actionTurnIndex;
  }
  updateSkillUI();
  drawBoard();
  if (aiHp <= 0) {
    gameOver = true;
    updateStatus("玩家获胜！");
    updateSkillUI();
    return;
  }
  if (!endTurn) {
    currentSkill = null;
    selectedSkillStone = null;
    selectedQueen = null;
    updateStatus("技能已使用，请落子。");
    updateSkillUI();
    return;
  }
  isPlayerTurn = false;
  currentSkill = null;
  selectedSkillStone = null;
  selectedQueen = null;
  updateStatus("AI 思考中...");
  updateSkillUI();
  if (aiTimeoutId) {
    window.clearTimeout(aiTimeoutId);
  }
  aiTimeoutId = window.setTimeout(aiMove, 250);
}

function rebuildSkillState() {
  Object.keys(skills).forEach((key) => {
    if (key === "timeRewind") {
      return;
    }
    skills[key].usesLeft = skills[key].maxUses;
    skills[key].lastUsedTurn = null;
  });
  moveHistory.forEach((entry) => {
    if (entry.skillId && skills[entry.skillId]) {
      if (Number.isFinite(skills[entry.skillId].usesLeft)) {
        skills[entry.skillId].usesLeft = Math.max(0, skills[entry.skillId].usesLeft - 1);
      }
      skills[entry.skillId].lastUsedTurn = entry.turnIndex;
    }
  });
}

function undoMove(entry) {
  if (entry.type === "place") {
    board[entry.row][entry.col] = 0;
    entry.removedCells.forEach((cell) => {
      board[cell.row][cell.col] = cell.value;
    });
    restoreDamageToOpponent(entry.player, entry.damage);
    return;
  }
  if (entry.type === "move") {
    board[entry.toRow][entry.toCol] = entry.capturedValue;
    board[entry.fromRow][entry.fromCol] = entry.movedValue;
    entry.removedCells.forEach((cell) => {
      board[cell.row][cell.col] = cell.value;
    });
    restoreDamageToOpponent(entry.player, entry.damage);
    return;
  }
  if (entry.type === "remove") {
    board[entry.targetRow][entry.targetCol] = 2;
    return;
  }
  if (entry.type === "area" || entry.type === "clear") {
    entry.removedCells.forEach((cell) => {
      board[cell.row][cell.col] = cell.value;
    });
    return;
  }
  if (entry.type === "flip") {
    entry.changedCells.forEach((cell) => {
      board[cell.row][cell.col] = cell.value;
    });
    return;
  }
  if (entry.type === "summon") {
    queenReady = false;
  }
}

function useTimeRewind() {
  if (!isSkillAvailable("timeRewind")) {
    return;
  }
  if (moveHistory.length < 2) {
    updateStatus("没有可以撤回的回合。");
    return;
  }
  skills.timeRewind.usesLeft = Math.max(0, skills.timeRewind.usesLeft - 1);
  const lastMoves = [moveHistory.pop(), moveHistory.pop()];
  lastMoves.forEach(undoMove);
  turnCount = Math.max(0, turnCount - lastMoves.length);
  rebuildSkillState();
  gameOver = false;
  isPlayerTurn = true;
  currentSkill = null;
  selectedSkillStone = null;
  selectedQueen = null;
  if (aiTimeoutId) {
    window.clearTimeout(aiTimeoutId);
    aiTimeoutId = null;
  }
  updateStatus("已回到上一步，轮到玩家。");
  updateSkillUI();
  drawBoard();
}

function handleSandShift(cell) {
  const { row, col } = cell;
  if (!selectedSkillStone) {
    if (board[row][col] !== 1) {
      updateStatus("请选择己方棋子使用飞沙走石。");
      return;
    }
    selectedSkillStone = { row, col };
    updateStatus("选择目标格（上下左右一格）。");
    return;
  }
  if (board[row][col] === 1) {
    selectedSkillStone = { row, col };
    updateStatus("已更换棋子，选择目标格。");
    return;
  }
  const dr = Math.abs(row - selectedSkillStone.row);
  const dc = Math.abs(col - selectedSkillStone.col);
  if (dr + dc !== 1 || board[row][col] !== 0) {
    updateStatus("目标需为空且与棋子相邻。");
    return;
  }
  board[selectedSkillStone.row][selectedSkillStone.col] = 0;
  board[row][col] = 1;
  const { damage, removedCells } = applyLineDamageFromMove(row, col, 1);
  applyDamageToOpponent(1, damage);
  finishPlayerAction({
    type: "move",
    player: 1,
    fromRow: selectedSkillStone.row,
    fromCol: selectedSkillStone.col,
    toRow: row,
    toCol: col,
    movedValue: 1,
    capturedValue: 0,
    damage,
    removedCells,
    skillId: "sandShift",
  }, { endTurn: false });
}

function handleMountainLift(cell) {
  const { row, col } = cell;
  if (board[row][col] !== 2) {
    updateStatus("请选择一个 AI 棋子移除。");
    return;
  }
  board[row][col] = 0;
  finishPlayerAction({
    type: "remove",
    player: 1,
    targetRow: row,
    targetCol: col,
    damage: 0,
    removedCells: [],
    skillId: "mountainLift",
  }, { endTurn: false });
}

function handleBoardBlast(cell) {
  const removedCells = [];
  for (let r = cell.row - 1; r <= cell.row + 1; r++) {
    for (let c = cell.col - 1; c <= cell.col + 1; c++) {
      if (r < 0 || c < 0 || r >= boardSize || c >= boardSize) {
        continue;
      }
      if (board[r][c] === 0) {
        continue;
      }
      removedCells.push({ row: r, col: c, value: board[r][c] });
      board[r][c] = 0;
    }
  }
  finishPlayerAction({
    type: "area",
    player: 1,
    removedCells,
    damage: 0,
    skillId: "boardBlast",
  }, { endTurn: false });
}

function handleStarDevour() {
  if (!isSkillAvailable("starDevour")) {
    return;
  }
  const removedCells = [];
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] !== 0) {
        removedCells.push({ row, col, value: board[row][col] });
        board[row][col] = 0;
      }
    }
  }
  finishPlayerAction({
    type: "clear",
    player: 1,
    removedCells,
    damage: 0,
    skillId: "starDevour",
  }, { endTurn: false });
}

function handleColorFlip() {
  if (!isSkillAvailable("colorFlip")) {
    return;
  }
  const changedCells = [];
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const value = board[row][col];
      if (value === 0) {
        continue;
      }
      changedCells.push({ row, col, value });
      if (value === queenValue) {
        board[row][col] = 2;
      } else if (value === 1) {
        board[row][col] = 2;
      } else if (value === 2) {
        board[row][col] = 1;
      }
    }
  }
  finishPlayerAction({
    type: "flip",
    player: 1,
    changedCells,
    damage: 0,
    skillId: "colorFlip",
  }, { endTurn: false });
}

function handleSummonQueen() {
  if (!isSkillAvailable("summonQueen")) {
    return;
  }
  queenReady = true;
  finishPlayerAction({
    type: "summon",
    player: 1,
    damage: 0,
    skillId: "summonQueen",
  }, { endTurn: false });
  updateStatus("黑皇后已就绪，请落子。");
}

function handleQueenMove(cell) {
  if (!selectedQueen) {
    return false;
  }
  const { row, col } = cell;
  const startRow = selectedQueen.row;
  const startCol = selectedQueen.col;
  if (row === startRow && col === startCol) {
    selectedQueen = null;
    updateStatus("轮到玩家");
    return true;
  }
  const dr = row - startRow;
  const dc = col - startCol;
  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);
  if (!(dr === 0 || dc === 0 || absDr === absDc)) {
    updateStatus("黑皇后只能直线或斜线移动。");
    return true;
  }
  const stepR = dr === 0 ? 0 : dr / absDr;
  const stepC = dc === 0 ? 0 : dc / absDc;
  let r = startRow + stepR;
  let c = startCol + stepC;
  while (r !== row || c !== col) {
    if (board[r][c] !== 0) {
      updateStatus("路径上有棋子阻挡。");
      return true;
    }
    r += stepR;
    c += stepC;
  }
  if (board[row][col] === 1 || board[row][col] === queenValue) {
    updateStatus("不能移动到己方棋子上。");
    return true;
  }
  const capturedValue = board[row][col];
  board[startRow][startCol] = 0;
  board[row][col] = queenValue;
  selectedQueen = null;
  const { damage, removedCells } = applyLineDamageFromMove(row, col, 1);
  applyDamageToOpponent(1, damage);
  finishPlayerAction({
    type: "move",
    player: 1,
    fromRow: startRow,
    fromCol: startCol,
    toRow: row,
    toCol: col,
    movedValue: queenValue,
    capturedValue,
    damage,
    removedCells,
  });
  return true;
}

function handleSkillButtonClick(event) {
  const skillId = event.currentTarget.dataset.skill;
  if (skillId === "timeRewind") {
    useTimeRewind();
    return;
  }
  if (skillId === "starDevour") {
    handleStarDevour();
    return;
  }
  if (skillId === "colorFlip") {
    handleColorFlip();
    return;
  }
  if (skillId === "summonQueen") {
    handleSummonQueen();
    return;
  }
  if (!isSkillAvailable(skillId)) {
    return;
  }
  if (currentSkill === skillId) {
    currentSkill = null;
    selectedSkillStone = null;
    selectedQueen = null;
    updateStatus("轮到玩家");
  } else {
    currentSkill = skillId;
    selectedSkillStone = null;
    selectedQueen = null;
    if (skillId === "sandShift") {
      updateStatus("选择要移动的己方棋子。");
    } else if (skillId === "mountainLift") {
      updateStatus("选择要提走的 AI 棋子。");
    } else if (skillId === "boardBlast") {
      updateStatus("选择爆破中心格。");
    }
  }
  updateSkillUI();
}

function handleCanvasClick(event) {
  if (gameOver || !isPlayerTurn) {
    return;
  }
  const cell = getCellFromEvent(event);
  if (!cell) {
    return;
  }
  if (currentSkill === "sandShift") {
    handleSandShift(cell);
    return;
  }
  if (currentSkill === "mountainLift") {
    handleMountainLift(cell);
    return;
  }
  if (currentSkill === "boardBlast") {
    handleBoardBlast(cell);
    return;
  }
  if (selectedQueen && handleQueenMove(cell)) {
    return;
  }
  if (board[cell.row][cell.col] === queenValue) {
    selectedQueen = { row: cell.row, col: cell.col };
    updateStatus("选择黑皇后要移动的位置。");
    return;
  }
  handlePlayerMove(cell);
}

restartBtn.addEventListener("click", initBoard);
canvas.addEventListener("click", handleCanvasClick);
skillButtons.forEach((button) => {
  button.addEventListener("click", handleSkillButtonClick);
});

initBoard();
