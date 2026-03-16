const WIN_SCORE = 20;
const GAME_TIME = 30;
const SPAWN_RATE = 1500;
const NEXT_CAN_DELAY = 220;
const MILESTONE_STEP = 10;
const MOBILE_BREAKPOINT = 640;

const winningMessages = [
  "You win! Water Quest complete.",
  "Great run! You cleared the target.",
  "Nice work! You hit the goal in time."
];

const losingMessages = [
  "Missed it this round. Try again.",
  "Time's up. Run it back.",
  "Close one. Restart and go again."
];

let score = 0;
let timeLeft = GAME_TIME;
let bestScore = 0;
let level = 1;
let streak = 0;
let gameActive = false;
let gamePaused = false;
let soundOn = true;
let timerIntervalId = null;
let spawnTimeoutId = null;
let activeCan = null;
let gridSize = 16;

const grid = document.querySelector(".game-grid");
const scoreDisplay = document.getElementById("current-cans");
const timerDisplay = document.getElementById("timer");
const timerMainDisplay = document.getElementById("timer-main");
const levelDisplay = document.getElementById("level");
const bestScoreDisplay = document.getElementById("best-score");
const comboDisplay = document.getElementById("combo-text");
const messageDisplay = document.getElementById("achievements");
const statusDisplay = document.getElementById("status-text");
const milestoneLabel = document.getElementById("milestone-label");
const milestoneFill = document.getElementById("milestone-fill");
const startButton = document.getElementById("start-game");
const pauseButton = document.getElementById("pause-game");
const soundButton = document.getElementById("sound-toggle");
const resetButton = document.getElementById("reset-game");
const quitButton = document.getElementById("quit-game");
const confettiContainer = document.getElementById("confetti");

function createGrid() {
  grid.innerHTML = "";

  for (let i = 0; i < gridSize; i += 1) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    grid.appendChild(cell);
  }
}

function updateGridLayout() {
  gridSize = window.innerWidth <= MOBILE_BREAKPOINT ? 9 : 16;
  grid.classList.toggle("mobile-grid", gridSize === 9);
  grid.classList.toggle("desktop-grid", gridSize === 16);
  createGrid();
}

function currentMilestone() {
  return Math.floor(score / MILESTONE_STEP) * MILESTONE_STEP;
}

function nextMilestone() {
  return currentMilestone() + MILESTONE_STEP;
}

function updateMilestone() {
  const start = currentMilestone();
  const next = nextMilestone();
  const progress = ((score - start) / MILESTONE_STEP) * 100;
  milestoneLabel.textContent = `Next Milestone: ${next} points`;
  milestoneFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
}

function updateStats() {
  level = Math.floor(score / 10) + 1;
  scoreDisplay.textContent = score;
  timerDisplay.textContent = timeLeft;
  timerMainDisplay.textContent = timeLeft;
  levelDisplay.textContent = level;
  bestScoreDisplay.textContent = bestScore;
  updateMilestone();
}

function setFeedback(comboText, mainText, statusText) {
  comboDisplay.textContent = comboText;
  messageDisplay.textContent = mainText;
  statusDisplay.textContent = statusText;
}

function clearActiveCan() {
  if (activeCan) {
    activeCan.closest(".grid-cell").innerHTML = "";
    activeCan = null;
  }
}

function scheduleSpawn(delay = SPAWN_RATE, applyMissPenalty = true) {
  window.clearTimeout(spawnTimeoutId);
  spawnTimeoutId = window.setTimeout(() => {
    if (gameActive && !gamePaused) {
      spawnWaterCan(applyMissPenalty);
    }
  }, delay);
}

function handleCanClick() {
  if (!gameActive || gamePaused) {
    return;
  }

  score += 1;
  streak += 1;
  bestScore = Math.max(bestScore, score);
  updateStats();
  setFeedback(
    `+1 Point${streak > 1 ? ` | Combo x${streak}` : ""}`,
    "Nice catch!",
    `${Math.max(WIN_SCORE - score, 0)} points to the goal`
  );
  clearActiveCan();
  scheduleSpawn(NEXT_CAN_DELAY, false);
}

function penalizeMiss() {
  if (!gameActive || gamePaused || !activeCan) {
    return;
  }

  if (score > 0) {
    score -= 1;
  }

  streak = 0;
  updateStats();
  setFeedback("Miss!", "Penalty -1", "Stay sharp and grab the next can");
}

function spawnWaterCan(applyMissPenalty = true) {
  if (!gameActive || gamePaused) {
    return;
  }

  if (applyMissPenalty) {
    penalizeMiss();
  }

  clearActiveCan();

  const cells = document.querySelectorAll(".grid-cell");
  const randomCell = cells[Math.floor(Math.random() * cells.length)];
  const wrapper = document.createElement("div");
  const waterCan = document.createElement("button");

  wrapper.className = "water-can-wrapper";
  waterCan.className = "water-can";
  waterCan.type = "button";
  waterCan.setAttribute("aria-label", "Tap jerry can");
  waterCan.addEventListener("click", handleCanClick);

  wrapper.appendChild(waterCan);
  randomCell.appendChild(wrapper);
  activeCan = waterCan;
  scheduleSpawn(SPAWN_RATE, true);
}

function stopGameLoops() {
  window.clearInterval(timerIntervalId);
  window.clearTimeout(spawnTimeoutId);
  timerIntervalId = null;
  spawnTimeoutId = null;
}

function randomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function launchConfetti() {
  confettiContainer.innerHTML = "";
  const colors = ["#ffc907", "#2e9df7", "#f5402c", "#159a48"];

  for (let i = 0; i < 18; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    confettiContainer.appendChild(piece);
  }

  window.setTimeout(() => {
    confettiContainer.innerHTML = "";
  }, 1800);
}

function startLoops() {
  spawnWaterCan(false);
  timerIntervalId = window.setInterval(() => {
    timeLeft -= 1;
    updateStats();

    if (timeLeft <= 0) {
      timeLeft = 0;
      updateStats();
      endGame();
    }
  }, 1000);
}

function endGame() {
  gameActive = false;
  gamePaused = false;
  stopGameLoops();
  clearActiveCan();
  startButton.disabled = false;
  pauseButton.textContent = "Pause";

  if (score >= WIN_SCORE) {
    setFeedback("+10 Points!", randomMessage(winningMessages), "You beat the challenge");
    launchConfetti();
    return;
  }

  setFeedback("Time Up", randomMessage(losingMessages), "Press Start to try again");
}

function startGame() {
  if (gameActive && !gamePaused) {
    return;
  }

  if (!gameActive) {
    score = 0;
    timeLeft = GAME_TIME;
    streak = 0;
    updateGridLayout();
  }

  gameActive = true;
  gamePaused = false;
  startButton.disabled = true;
  pauseButton.textContent = "Pause";
  confettiContainer.innerHTML = "";
  updateStats();
  setFeedback("Ready", "Game on", "Tap every can you can catch");
  stopGameLoops();
  clearActiveCan();
  startLoops();
}

function pauseGame() {
  if (!gameActive) {
    return;
  }

  gamePaused = !gamePaused;
  pauseButton.textContent = gamePaused ? "Resume" : "Pause";

  if (gamePaused) {
    stopGameLoops();
    setFeedback("Paused", "Game paused", "Press Resume when you're ready");
    return;
  }

  setFeedback("Back in", "Game resumed", "Keep chasing the target");
  startLoops();
}

function toggleSound() {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? "Sound On" : "Sound Off";
}

function resetGame() {
  gameActive = false;
  gamePaused = false;
  score = 0;
  timeLeft = GAME_TIME;
  streak = 0;
  stopGameLoops();
  clearActiveCan();
  confettiContainer.innerHTML = "";
  updateGridLayout();
  updateStats();
  setFeedback("Ready to play", "Press Start to begin your run.", "Reach 20 points to win.");
  startButton.disabled = false;
  pauseButton.textContent = "Pause";
}

function quitGame() {
  resetGame();
  setFeedback("Quit", "Game closed", "Press Start when you want another round");
}

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
soundButton.addEventListener("click", toggleSound);
resetButton.addEventListener("click", resetGame);
quitButton.addEventListener("click", quitGame);
window.addEventListener("resize", () => {
  const nextSize = window.innerWidth <= MOBILE_BREAKPOINT ? 9 : 16;

  if (nextSize === gridSize) {
    return;
  }

  clearActiveCan();
  updateGridLayout();

  if (gameActive && !gamePaused) {
    spawnWaterCan(false);
  }
});

updateGridLayout();
updateStats();
setFeedback("Ready to play", "Press Start to begin your run.", "Reach 20 points to win.");
