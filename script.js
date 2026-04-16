const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusText = document.getElementById("statusText");
const clueText = document.getElementById("clueText");
const healthText = document.getElementById("healthText");
const scoreText = document.getElementById("scoreText");
const bestText = document.getElementById("bestText");
const distanceText = document.getElementById("distanceText");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const touchButtons = document.querySelectorAll(".touch-btn");
const startButton = document.getElementById("startButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const STREET_LEFT = 280;
const STREET_RIGHT = 820;
const GOAL_DISTANCE = 2550;
const REQUIRED_CLUES = 5;
const HIGH_SCORE_KEY = "last-light-run-high-score";

const keys = new Set();
let lastTime = 0;
let game = null;

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function loadBestScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

let bestScore = loadBestScore();

function saveBestScore(score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {}
}

function createMonster(type, x, y, segments, color) {
  const body = [];
  for (let i = 0; i < segments; i += 1) {
    body.push({ x, y: y + i * 24 });
  }
  return {
    type,
    body,
    color,
    speed: randomRange(128, 160),
    sway: Math.random() * Math.PI * 2,
    spitCooldown: randomRange(2.2, 4),
    stun: 0
  };
}

function createGame() {
  return {
    mode: "ready",
    distance: 0,
    cluesCollected: 0,
    clueFlash: 0,
    damageFlash: 0,
    healFlash: 0,
    maxHealth: 3,
    health: 3,
    invulnerable: 0,
    score: 0,
    player: { x: WIDTH / 2, y: HEIGHT - 135, radius: 17, speed: 280, sprint: 420 },
    debris: [],
    clues: [],
    boosts: [],
    acidPools: [],
    monsters: [
      createMonster("serpent", 430, HEIGHT + 120, 6, "#b8ff7d"),
      createMonster("serpent", 650, HEIGHT + 190, 7, "#f9e17d"),
      createMonster("spitter", 550, HEIGHT + 270, 5, "#84d8ff")
    ],
    skylineOffset: 0,
    collapseTimer: 1.4,
    clueTimer: 1.2,
    boostTimer: 4.2,
    screenShake: 0
  };
}

function setOverlay(title, text, visible) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.toggle("hidden", !visible);
}

function updateHud() {
  clueText.textContent = `${game.cluesCollected} / ${REQUIRED_CLUES}`;
  healthText.textContent = `${Math.max(0, game.health)} / ${game.maxHealth}`;
  scoreText.textContent = `${Math.round(game.score)}`;
  bestText.textContent = `${bestScore}`;
  distanceText.textContent = `${Math.max(0, Math.round(game.distance))} m`;

  if (game.mode === "running") {
    statusText.textContent = game.cluesCollected < REQUIRED_CLUES
      ? "Find clues"
      : game.distance < GOAL_DISTANCE
        ? "Reach lab"
        : "Enter facility";
  } else if (game.mode === "ready") {
    statusText.textContent = "Waiting";
  }
}

function resetGame(startImmediately = false) {
  game = createGame();
  if (startImmediately) {
    startRun();
  } else {
    startButton.textContent = "Start Run";
    setOverlay(
      "Press Space To Start",
      "Monsters are closing in from the shadows. Keep moving, collect the scattered clues, and reach the medical facility alive.",
      true
    );
    updateHud();
  }
}

function startRun() {
  game.mode = "running";
  setOverlay("", "", false);
  updateHud();
}

function finishRun() {
  const rounded = Math.max(0, Math.round(game.score));
  if (rounded > bestScore) {
    bestScore = rounded;
    saveBestScore(bestScore);
  }
  updateHud();
}

function loseGame(reason) {
  game.mode = "lost";
  finishRun();
  statusText.textContent = "Overrun";
  startButton.textContent = "Run Again";
  setOverlay("You Were Taken", `${reason} Press Space to try again.`, true);
}

function winGame() {
  game.mode = "won";
  game.score += 250;
  finishRun();
  statusText.textContent = "Escaped";
  startButton.textContent = "Run Again";
  setOverlay("Medical Facility Reached", "You delivered the clues and slipped into the lab alive. Press Space to run again.", true);
}

function spawnClue() {
  game.clues.push({
    x: randomRange(STREET_LEFT + 44, STREET_RIGHT - 44),
    y: -30,
    radius: 12,
    spin: Math.random() * Math.PI * 2
  });
}

function spawnBoost() {
  const type = Math.random() > 0.45 ? "medkit" : "flare";
  game.boosts.push({
    x: randomRange(STREET_LEFT + 52, STREET_RIGHT - 52),
    y: -40,
    radius: 15,
    type,
    spin: Math.random() * Math.PI * 2
  });
}

function spawnCollapse() {
  const side = Math.random() > 0.5 ? "left" : "right";
  const originX = side === "left" ? randomRange(80, STREET_LEFT - 25) : randomRange(STREET_RIGHT + 25, WIDTH - 80);
  const baseVelocity = side === "left" ? randomRange(110, 190) : randomRange(-190, -110);
  const count = 6 + Math.floor(Math.random() * 4);

  for (let i = 0; i < count; i += 1) {
    game.debris.push({
      x: originX + randomRange(-16, 16),
      y: randomRange(-120, -10),
      vx: baseVelocity + randomRange(-65, 65),
      vy: randomRange(240, 410),
      radius: randomRange(15, 28),
      rotation: Math.random() * Math.PI * 2,
      spin: randomRange(-2.4, 2.4),
      glow: Math.random() > 0.65
    });
  }
}

function spawnAcidPool(monster) {
  const head = monster.body[0];
  const radius = randomRange(24, 40);
  const bubbles = Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => ({
    angle: Math.random() * Math.PI * 2,
    orbit: randomRange(0.2, 0.82),
    size: randomRange(3, 7),
    speed: randomRange(1.2, 2.8),
    phase: Math.random() * Math.PI * 2
  }));
  const fumes = Array.from({ length: 4 + Math.floor(Math.random() * 3) }, () => ({
    angle: Math.random() * Math.PI * 2,
    drift: randomRange(10, 26),
    size: randomRange(10, 18),
    speed: randomRange(0.4, 1.1),
    phase: Math.random() * Math.PI * 2
  }));

  game.acidPools.push({
    x: clamp(head.x + randomRange(-55, 55), STREET_LEFT + 30, STREET_RIGHT - 30),
    y: clamp(head.y - randomRange(110, 180), 165, HEIGHT - 120),
    radius,
    ttl: randomRange(4.5, 6.8),
    life: 0,
    bubbles,
    fumes
  });
}

function applyDamage(reason) {
  if (game.invulnerable > 0 || game.mode !== "running") return;
  game.health -= 1;
  game.invulnerable = 1.3;
  game.damageFlash = 1;
  game.screenShake = 16;
  updateHud();
  if (game.health <= 0) loseGame(reason);
}

function handleInput(dt) {
  const player = game.player;
  const speed = keys.has("Shift") ? player.sprint : player.speed;
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) dy += 1;
  if (dx || dy) {
    const scale = speed * dt / Math.hypot(dx, dy);
    player.x += dx * scale;
    player.y += dy * scale;
  }
  player.x = clamp(player.x, STREET_LEFT + player.radius, STREET_RIGHT - player.radius);
  player.y = clamp(player.y, 250, HEIGHT - 80);
}

function updateMonster(monster, dt) {
  const player = game.player;
  const head = monster.body[0];
  monster.stun = Math.max(0, monster.stun - dt);
  monster.sway += dt * 4;
  const targetX = player.x + Math.sin(monster.sway) * 45;
  const targetY = player.y + 90;
  const angle = Math.atan2(targetY - head.y, targetX - head.x);
  let speedScale = monster.stun > 0 ? 0.15 : 1;
  if (monster.type === "spitter") {
    speedScale *= 0.9;
    monster.spitCooldown -= dt;
    if (monster.spitCooldown <= 0 && monster.stun <= 0) {
      spawnAcidPool(monster);
      monster.spitCooldown = randomRange(2.2, 4.4);
    }
  }
  head.x += Math.cos(angle) * monster.speed * dt * speedScale;
  head.y += Math.sin(angle) * monster.speed * dt * speedScale;
  for (let i = 1; i < monster.body.length; i += 1) {
    const prev = monster.body[i - 1];
    const part = monster.body[i];
    const followAngle = Math.atan2(prev.y - part.y, prev.x - part.x);
    const gap = Math.hypot(prev.x - part.x, prev.y - part.y);
    if (gap > 24) {
      part.x += Math.cos(followAngle) * (gap - 24) * 0.9;
      part.y += Math.sin(followAngle) * (gap - 24) * 0.9;
    }
  }
}

function updateRunning(dt) {
  const pace = 205;
  const player = game.player;
  handleInput(dt);
  game.distance = Math.min(GOAL_DISTANCE + 120, game.distance + pace * dt);
  game.score += dt * 18 + (keys.has("Shift") ? dt * 10 : 0);
  game.skylineOffset += pace * dt;
  game.clueFlash = Math.max(0, game.clueFlash - dt * 3.5);
  game.damageFlash = Math.max(0, game.damageFlash - dt * 2.4);
  game.healFlash = Math.max(0, game.healFlash - dt * 2.8);
  game.invulnerable = Math.max(0, game.invulnerable - dt);
  game.screenShake = Math.max(0, game.screenShake - dt * 22);

  game.collapseTimer -= dt;
  if (game.collapseTimer <= 0) {
    spawnCollapse();
    game.collapseTimer = randomRange(0.75, 1.55);
  }

  if (game.cluesCollected < REQUIRED_CLUES) {
    game.clueTimer -= dt;
    if (game.clueTimer <= 0 && game.clues.length < 2) {
      spawnClue();
      game.clueTimer = randomRange(1.4, 2.25);
    }
  }

  game.boostTimer -= dt;
  if (game.boostTimer <= 0 && game.boosts.length < 1) {
    spawnBoost();
    game.boostTimer = randomRange(6.5, 9.2);
  }

  game.clues = game.clues.filter((clue) => {
    clue.y += pace * dt;
    clue.spin += dt * 3;
    if (distance(clue, player) <= clue.radius + player.radius + 2) {
      game.cluesCollected += 1;
      game.clueFlash = 1;
      game.score += 120;
      updateHud();
      return false;
    }
    return clue.y < HEIGHT + 30;
  });

  game.boosts = game.boosts.filter((boost) => {
    boost.y += pace * dt;
    boost.spin += dt * 2.6;
    if (distance(boost, player) <= boost.radius + player.radius + 3) {
      if (boost.type === "medkit") {
        game.health = Math.min(game.maxHealth, game.health + 1);
        game.healFlash = 1;
        game.score += 60;
      } else {
        for (const monster of game.monsters) monster.stun = 2.8;
        game.healFlash = 0.8;
        game.score += 90;
      }
      updateHud();
      return false;
    }
    return boost.y < HEIGHT + 40;
  });

  game.debris = game.debris.filter((piece) => {
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.rotation += piece.spin * dt;
    piece.vy += 140 * dt;
    if (distance(piece, player) < piece.radius + player.radius - 3) {
      applyDamage("A collapsing building buried the street in debris.");
    }
    return piece.y < HEIGHT + 140 && piece.x > -120 && piece.x < WIDTH + 120 && game.mode === "running";
  });

  for (const monster of game.monsters) {
    updateMonster(monster, dt);
    if (distance(monster.body[0], player) < 28) {
      applyDamage("One of the serpent creatures caught up to you.");
    }
  }

  game.acidPools = game.acidPools.filter((pool) => {
    pool.ttl -= dt;
    pool.life += dt;
    if (distance(pool, player) < pool.radius + player.radius - 2) {
      applyDamage("Corrosive venom flooded the road beneath your feet.");
    }
    return pool.ttl > 0;
  });

  if (game.cluesCollected >= REQUIRED_CLUES && game.distance >= GOAL_DISTANCE && player.y < 158) {
    winGame();
  }
  updateHud();
}

function drawBuildings(startX, endX, baseColor, glowColor) {
  const cols = Math.floor((endX - startX) / 64);
  for (let i = 0; i <= cols; i += 1) {
    const x = startX + i * 64;
    const wobble = (game.skylineOffset * 0.28 + i * 23) % 220;
    const height = 180 + (wobble % 160);
    const y = HEIGHT - height;
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, 52, height);
    ctx.fillStyle = "rgba(255, 155, 88, 0.14)";
    for (let row = y + 16; row < HEIGHT - 24; row += 28) {
      ctx.fillRect(x + 10, row, 8, 10);
      ctx.fillRect(x + 28, row + 8, 8, 10);
    }
    ctx.fillStyle = glowColor;
    ctx.fillRect(x + 20, y - 8, 10, 8);
  }
}

function drawFacility() {
  const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.5;
  ctx.fillStyle = `rgba(185, 255, 122, ${0.18 + pulse * 0.2})`;
  ctx.fillRect(STREET_LEFT + 70, 18, STREET_RIGHT - STREET_LEFT - 140, 95);
  ctx.strokeStyle = "#d8ffd1";
  ctx.lineWidth = 4;
  ctx.strokeRect(STREET_LEFT + 70, 18, STREET_RIGHT - STREET_LEFT - 140, 95);
  ctx.fillStyle = "#ebffe5";
  ctx.font = '700 28px "Rajdhani", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("MEDICAL FACILITY", WIDTH / 2, 58);
}

function drawBackground() {
  const shakeX = game.screenShake > 0 ? randomRange(-game.screenShake, game.screenShake) : 0;
  const shakeY = game.screenShake > 0 ? randomRange(-game.screenShake, game.screenShake) : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#5c2d26");
  gradient.addColorStop(0.45, "#24171d");
  gradient.addColorStop(1, "#100f15");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawBuildings(0, STREET_LEFT - 10, "#2a1b21", "#61453f");
  drawBuildings(STREET_RIGHT + 10, WIDTH, "#22171d", "#5d453a");
  ctx.fillStyle = "#2a262d";
  ctx.fillRect(STREET_LEFT, 0, STREET_RIGHT - STREET_LEFT, HEIGHT);
  ctx.strokeStyle = "rgba(245, 214, 184, 0.25)";
  ctx.lineWidth = 6;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 0);
  ctx.lineTo(WIDTH / 2, HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);
  if (game.cluesCollected >= REQUIRED_CLUES) drawFacility();
}

function drawClues() {
  for (const clue of game.clues) {
    ctx.save();
    ctx.translate(clue.x, clue.y);
    ctx.rotate(clue.spin);
    ctx.fillStyle = "#ffefc2";
    ctx.fillRect(-11, -15, 22, 30);
    ctx.strokeStyle = "#8b3d2f";
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -15, 22, 30);
    ctx.restore();
  }
}

function drawBoosts() {
  for (const boost of game.boosts) {
    ctx.save();
    ctx.translate(boost.x, boost.y);
    ctx.rotate(boost.spin);
    if (boost.type === "medkit") {
      ctx.fillStyle = "#d8f7df";
      ctx.fillRect(-14, -14, 28, 28);
      ctx.fillStyle = "#ff5d5d";
      ctx.fillRect(-4, -10, 8, 20);
      ctx.fillRect(-10, -4, 20, 8);
    } else {
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawAcidPools() {
  for (const pool of game.acidPools) {
    const pulse = 0.88 + Math.sin(pool.life * 5.6) * 0.12;
    const coreRadius = pool.radius * pulse;
    const rimRadius = coreRadius + 8;
    const warningRadius = rimRadius + 10;

    ctx.save();

    ctx.beginPath();
    ctx.fillStyle = "rgba(132, 255, 110, 0.10)";
    ctx.arc(pool.x, pool.y, warningRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "rgba(92, 255, 113, 0.22)";
    ctx.arc(pool.x, pool.y, rimRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "rgba(60, 214, 84, 0.60)";
    ctx.arc(pool.x, pool.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(201, 255, 166, 0.65)";
    ctx.lineWidth = 2.5;
    ctx.arc(pool.x, pool.y, rimRadius - 2, 0, Math.PI * 2);
    ctx.stroke();

    for (const bubble of pool.bubbles) {
      const bubblePulse = 0.55 + 0.45 * Math.sin(pool.life * bubble.speed * 4 + bubble.phase);
      const distanceFromCenter = coreRadius * bubble.orbit;
      const bubbleX = pool.x + Math.cos(bubble.angle + pool.life * bubble.speed) * distanceFromCenter;
      const bubbleY = pool.y + Math.sin(bubble.angle + pool.life * bubble.speed * 0.8) * distanceFromCenter * 0.6;
      const bubbleSize = bubble.size * (0.75 + bubblePulse * 0.55);

      ctx.beginPath();
      ctx.fillStyle = `rgba(231, 255, 210, ${0.22 + bubblePulse * 0.28})`;
      ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = `rgba(172, 255, 122, ${0.16 + bubblePulse * 0.2})`;
      ctx.arc(bubbleX - bubbleSize * 0.22, bubbleY - bubbleSize * 0.22, bubbleSize * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const fume of pool.fumes) {
      const drift = fume.drift * (0.4 + 0.6 * Math.sin(pool.life * fume.speed + fume.phase));
      const smokeX = pool.x + Math.cos(fume.angle + pool.life * 0.45) * (pool.radius * 0.35);
      const smokeY = pool.y - pool.radius * 0.55 - drift;
      const smokeSize = fume.size * (0.8 + 0.25 * Math.sin(pool.life * fume.speed * 1.8 + fume.phase));

      ctx.beginPath();
      ctx.fillStyle = "rgba(158, 188, 145, 0.14)";
      ctx.arc(smokeX, smokeY, smokeSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "rgba(203, 235, 182, 0.08)";
      ctx.arc(smokeX + smokeSize * 0.28, smokeY - smokeSize * 0.2, smokeSize * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawDebris() {
  for (const piece of game.debris) {
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.fillStyle = piece.glow ? "#ff8c55" : "#7d6a66";
    ctx.fillRect(-piece.radius, -piece.radius * 0.75, piece.radius * 2, piece.radius * 1.5);
    ctx.restore();
  }
}

function drawMonsters() {
  for (const monster of game.monsters) {
    for (let i = monster.body.length - 1; i >= 0; i -= 1) {
      const part = monster.body[i];
      const t = i / monster.body.length;
      ctx.beginPath();
      ctx.fillStyle = monster.stun > 0 ? "#fff4bf" : i === 0 ? "#ecffd1" : monster.color;
      ctx.globalAlpha = monster.stun > 0 ? 0.78 - t * 0.25 : 0.92 - t * 0.4;
      ctx.arc(part.x, part.y, 16 - t * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    const head = monster.body[0];
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#24181f";
    ctx.beginPath();
    ctx.arc(head.x - 5, head.y - 3, 2.5, 0, Math.PI * 2);
    ctx.arc(head.x + 5, head.y - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const player = game.player;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (game.clueFlash > 0) {
    ctx.fillStyle = `rgba(255, 243, 199, ${game.clueFlash * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f3c1ab";
  ctx.beginPath();
  ctx.arc(0, -18, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1d1017";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(0, 26);
  ctx.moveTo(0, 4);
  ctx.lineTo(-16, 18);
  ctx.moveTo(0, 4);
  ctx.lineTo(16, 18);
  ctx.moveTo(0, 26);
  ctx.lineTo(-12, 48);
  ctx.moveTo(0, 26);
  ctx.lineTo(12, 48);
  ctx.stroke();
  ctx.strokeStyle = "#ff7b5c";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-9, -31);
  ctx.quadraticCurveTo(0, -48, 12, -28);
  ctx.stroke();
  ctx.restore();
}

function drawProgressHints() {
  ctx.textAlign = "left";
  ctx.font = '700 22px "Rajdhani", sans-serif';
  ctx.fillStyle = "rgba(255, 236, 218, 0.88)";
  if (game.cluesCollected < REQUIRED_CLUES) {
    ctx.fillText("Search the road for research clues", 28, 40);
  } else if (game.distance < GOAL_DISTANCE) {
    ctx.fillText("All clues secured. Run to the medical facility.", 28, 40);
  } else {
    ctx.fillText("Move to the glowing entrance at the top of the street", 28, 40);
  }
}

function drawTitleTreatment() {
  if (game.mode !== "ready") return;
  ctx.textAlign = "center";
  ctx.font = '700 56px "Cinzel", serif';
  ctx.fillStyle = "rgba(255, 221, 197, 0.16)";
  ctx.fillText("LAST LIGHT RUN", WIDTH / 2, HEIGHT * 0.22);
}

function draw() {
  drawBackground();
  drawAcidPools();
  drawClues();
  drawBoosts();
  drawDebris();
  drawMonsters();
  drawPlayer();
  drawProgressHints();
  drawTitleTreatment();
  if (game.damageFlash > 0) {
    ctx.fillStyle = `rgba(255, 64, 64, ${game.damageFlash * 0.16})`;
    ctx.fillRect(-40, -40, WIDTH + 80, HEIGHT + 80);
  }
  ctx.restore();
}

function tick(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
  lastTime = timestamp;
  if (game.mode === "running") updateRunning(dt);
  draw();
  requestAnimationFrame(tick);
}

document.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.code === "Space") {
    event.preventDefault();
    if (game.mode === "ready") startRun();
    else if (game.mode === "lost" || game.mode === "won") resetGame(true);
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

overlay.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".overlay-card")) {
    if (game.mode === "ready") startRun();
    else if (game.mode === "lost" || game.mode === "won") resetGame(true);
  }
});

for (const button of touchButtons) {
  const touchKey = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    keys.add(touchKey);
    if (touchKey !== "Shift" && game.mode === "ready") startRun();
  };
  const release = (event) => {
    event.preventDefault();
    keys.delete(touchKey);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

startButton.addEventListener("click", () => {
  if (game.mode === "ready") startRun();
  else if (game.mode === "lost" || game.mode === "won") resetGame(true);
});

resetGame(false);
requestAnimationFrame(tick);
