const MOBILE_BREAKPOINT = 640;
const NEXT_CAN_DELAY = 220;
const MILESTONE_STEP = 5;

const difficultySettings = {
  easy: {
    label: "Easy",
    winScore: 15,
    gameTime: 35,
    spawnRate: 1700,
    missPenalty: 0
  },
  normal: {
    label: "Normal",
    winScore: 20,
    gameTime: 30,
    spawnRate: 1300,
    missPenalty: 1
  },
  hard: {
    label: "Hard",
    winScore: 26,
    gameTime: 24,
    spawnRate: 850,
    missPenalty: 2
  }
};

const milestoneMessages = [
  { score: 5, text: "5 points: one step closer to funding clean water awareness." },
  { score: 10, text: "10 points: halfway to the standard goal." },
  { score: 15, text: "15 points: strong pace, keep moving." },
  { score: 20, text: "20 points: big league pace unlocked." },
  { score: 25, text: "25 points: expert pace unlocked." }
];

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
let timeLeft = difficultySettings.normal.gameTime;
let bestScore = 0;
let level = 1;
let streak = 0;
let gameActive = false;
let gamePaused = false;
let soundOn = true;
let currentDifficulty = "normal";
let timerIntervalId = null;
let spawnTimeoutId = null;
let activeCan = null;
let gridSize = 16;
let unlockedMilestones = [];
let audioContext = null;

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
const milestoneMessage = document.getElementById("milestone-message");
const milestoneFill = document.getElementById("milestone-fill");
const difficultySummary = document.getElementById("difficulty-summary");
const difficultyButtons = document.querySelectorAll(".difficulty-button");
const startButton = document.getElementById("start-game");
const pauseButton = document.getElementById("pause-game");
const soundButton = document.getElementById("sound-toggle");
const resetButton = document.getElementById("reset-game");
const quitButton = document.getElementById("quit-game");
const confettiContainer = document.getElementById("confetti");

function currentSettings() {
  return difficultySettings[currentDifficulty];
}

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

function updateDifficultySummary() {
  const settings = currentSettings();
  difficultySummary.textContent = `${settings.label} mode: score ${settings.winScore} points in ${settings.gameTime} seconds. Missed cans cost ${settings.missPenalty} point${settings.missPenalty === 1 ? "" : "s"}.`;
}

function updateDifficultyButtons() {
  difficultyButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === currentDifficulty);
  });
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
    const cell = activeCan.closest(".grid-cell");

    if (cell) {
      cell.innerHTML = "";
    }

    activeCan = null;
  }
}

function stopGameLoops() {
  window.clearInterval(timerIntervalId);
  window.clearTimeout(spawnTimeoutId);
  timerIntervalId = null;
  spawnTimeoutId = null;
}

function scheduleSpawn(delay = currentSettings().spawnRate, applyMissPenalty = true) {
  window.clearTimeout(spawnTimeoutId);
  spawnTimeoutId = window.setTimeout(() => {
    if (gameActive && !gamePaused) {
      spawnWaterCan(applyMissPenalty);
    }
  }, delay);
}

function randomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(type) {
  if (!soundOn) {
    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  const soundMap = {
    collect: { frequency: 720, duration: 0.08, gain: 0.06, wave: "triangle" },
    miss: { frequency: 220, duration: 0.12, gain: 0.05, wave: "sawtooth" },
    win: { frequency: 880, duration: 0.18, gain: 0.07, wave: "square" },
    lose: { frequency: 180, duration: 0.18, gain: 0.05, wave: "sine" }
  };
  const sound = soundMap[type];

  if (!sound) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime;

  oscillator.type = sound.wave;
  oscillator.frequency.setValueAtTime(sound.frequency, startTime);
  gainNode.gain.setValueAtTime(sound.gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + sound.duration);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + sound.duration);
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

function updateMilestoneMessage() {
  const reachedMilestone = milestoneMessages.find(
    (milestone) => score >= milestone.score && !unlockedMilestones.includes(milestone.score)
  );

  if (!reachedMilestone) {
    return;
  }

  unlockedMilestones.push(reachedMilestone.score);
  milestoneMessage.textContent = reachedMilestone.text;
  setFeedback(
    "Milestone!",
    reachedMilestone.text,
    `${Math.max(currentSettings().winScore - score, 0)} points to the goal`
  );
}

function handleCanClick() {
  if (!gameActive || gamePaused || !activeCan) {
    return;
  }

  const clickedCan = activeCan;
  clickedCan.classList.add("collected");
  score += 1;
  streak += 1;
  bestScore = Math.max(bestScore, score);
  updateStats();
  setFeedback(
    `+1 Point${streak > 1 ? ` | Combo x${streak}` : ""}`,
    "Nice catch!",
    `${Math.max(currentSettings().winScore - score, 0)} points to the goal`
  );
  updateMilestoneMessage();
  playTone("collect");
  activeCan = null;

  window.setTimeout(() => {
    const cell = clickedCan.closest(".grid-cell");

    if (cell) {
      cell.innerHTML = "";
    }
  }, 180);

  if (score >= currentSettings().winScore) {
    window.setTimeout(() => {
      if (gameActive) {
        endGame();
      }
    }, 180);
    return;
  }

  scheduleSpawn(NEXT_CAN_DELAY, false);
}

function penalizeMiss() {
  if (!gameActive || gamePaused || !activeCan) {
    return;
  }

  score = Math.max(0, score - currentSettings().missPenalty);
  streak = 0;
  updateStats();
  milestoneMessage.textContent = "Missed that one. Stay sharp for the next drop.";
  setFeedback("Miss!", `Penalty -${currentSettings().missPenalty}`, "Stay sharp and grab the next can");
  playTone("miss");
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
  scheduleSpawn(currentSettings().spawnRate, true);
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

  if (score >= currentSettings().winScore) {
    setFeedback(
      "Goal Reached!",
      randomMessage(winningMessages),
      `${currentSettings().label} mode cleared`
    );
    milestoneMessage.textContent = "Victory milestone unlocked. Clean water awareness win.";
    playTone("win");
    launchConfetti();
    return;
  }

  setFeedback(
    "Time Up",
    randomMessage(losingMessages),
    `You needed ${currentSettings().winScore} points in ${currentSettings().gameTime} seconds`
  );
  milestoneMessage.textContent = "Try another run or switch difficulty for a new challenge.";
  playTone("lose");
}

function startGame() {
  if (gameActive && !gamePaused) {
    return;
  }

  if (!gameActive) {
    score = 0;
    streak = 0;
    unlockedMilestones = [];
    timeLeft = currentSettings().gameTime;
    updateGridLayout();
    milestoneMessage.textContent = "First milestone arrives at 5 points.";
  }

  gameActive = true;
  gamePaused = false;
  startButton.disabled = true;
  pauseButton.textContent = "Pause";
  confettiContainer.innerHTML = "";
  updateStats();
  setFeedback("Ready", "Game on", `Reach ${currentSettings().winScore} points before time runs out`);
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
  timeLeft = currentSettings().gameTime;
  streak = 0;
  unlockedMilestones = [];
  stopGameLoops();
  clearActiveCan();
  confettiContainer.innerHTML = "";
  updateGridLayout();
  updateStats();
  milestoneMessage.textContent = "Start your run to unlock milestone messages.";
  setFeedback(
    "Ready to play",
    "Press Start to begin your run.",
    `Reach ${currentSettings().winScore} points to win on ${currentSettings().label}`
  );
  startButton.disabled = false;
  pauseButton.textContent = "Pause";
}

function quitGame() {
  resetGame();
  setFeedback("Quit", "Game closed", "Press Start when you want another round");
}

function setDifficulty(nextDifficulty) {
  if (!difficultySettings[nextDifficulty]) {
    return;
  }

  currentDifficulty = nextDifficulty;
  updateDifficultyButtons();
  updateDifficultySummary();
  resetGame();
}

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
soundButton.addEventListener("click", toggleSound);
resetButton.addEventListener("click", resetGame);
quitButton.addEventListener("click", quitGame);
difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDifficulty(button.dataset.difficulty);
  });
});
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
updateDifficultyButtons();
updateDifficultySummary();
updateStats();
milestoneMessage.textContent = "Start your run to unlock milestone messages.";
setFeedback("Ready to play", "Press Start to begin your run.", `Reach ${currentSettings().winScore} points to win.`);
