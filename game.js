"use strict";

const WIDTH = 480;
const HEIGHT = 270;
const STEP = 1 / 60;
const LEVEL_WIDTH = 2600;
const GROUND_Y = 230;
const FALL_Y = 300;
const START_X = 108;
const CHECKPOINT_X = 979;
const MAX_HEARTS = 3;
const HURT_TIME = 0.75;
const HERO_WIDTH = 14;
const HERO_HEIGHT = 32;
const HERO_SCALE = 0.42;
const GRAVITY = 900;
const JUMP_SPEED = -330;
const JUMP_CUT = 0.45;
const RUN_SPEED = 110;
const ACCELERATION = 1200;
const DECELERATION = 1500;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.1;
const GLIDE_FALL = 38;
const WIND_LIFT = 900;
const WIND_RISE = 120;
const WIND_FALL = 105;
const WIND_SCROLL = 40;
const CAMERA_LERP = 0.12;
const LOOK_AHEAD = 40;
const BOB_AMPLITUDE = 14;
const BOB_RATE = 2.1;
const FAR_ORIGIN = -75;
const NEAR_DUNES_Y = 208;
const COMPLETION_DELAY = 0.5;

const WIND = { x: 1260, y: 40, width: 70 };
const GATE_X = 40;
const SAVE_X = 1950;
const WALL = { x: 2044, width: 82, visibleHeight: 158, overlap: 14, radius: 90 };
const WALL_TOP = GROUND_Y - WALL.visibleHeight * 2 + WALL.overlap;
const WALL_LEFT = WALL.x + 3;
const WALL_RIGHT = WALL.x + WALL.width - 3;

// Ground tile widths exclude the two transparent columns on each side.
const GROUND_RUNS = [
  { x: -44, tiles: 5 },
  { x: 560, tiles: 1 },
  { x: 800, tiles: 1 },
  { x: 1700, tiles: 5 },
].map(run => ({
  ...run,
  width: 54 + run.tiles * 92 + 50,
  left: Math.max(0, run.x + 13),
  right: run.x + 54 + run.tiles * 92 + 50 - 10,
  y: GROUND_Y,
}));

const LEDGES = [
  { art: "ledge_s", x: 846, y: 204, width: 39 },
  { art: "ledge_m", x: 946, y: 183, width: 65 },
];

const GEARS = [
  { x: 1114, baseY: 190, phase: 0.4 },
  { x: 1420, baseY: 170, phase: 2.5 },
  { x: 1560, baseY: 200, phase: 4.4 },
].map(gear => ({ ...gear, art: "gear_platform", width: 64, y: 0, previousY: 0 }));

const SURFACES = [
  ...GROUND_RUNS,
  ...LEDGES.map(ledge => ({ ...ledge, left: ledge.x + 4, right: ledge.x + ledge.width - 4 })),
  ...GEARS.map(gear => Object.assign(gear, { left: gear.x + 5, right: gear.x + 60 })),
];

const TUFTS = [
  [20, 3], [180, 2], [331, 1],
  [599, 2], [719, 1], [811, 3], [884, 1],
  [1744, 2], [1848, 3], [2015, 1], [2192, 2],
];
const SPIRES = [
  [8, 229], [287, 230], [463, 232], [631, 231], [779, 231], [928, 231],
  [1788, 233], [1994, 232], [2179, 230],
];

const COIN_POSITIONS = [
  [524, 174], [544, 156], [567, 173],
  [769, 174], [793, 158], [833, 179],
  [995, 145], [1052, 128], [1128, 153], [1190, 145],
  [1290, 128], [1304, 94], [1311, 61],
  [1366, 62], [1441, 134], [1515, 110],
  [1602, 156], [1665, 137], [1725, 151],
];

const ASSET_NAMES = [
  "bg_far", "bg_sky", "hero", "ground_left", "ground_mid", "ground_right",
  "ledge_s", "ledge_m", "gear_platform", "tuft1", "tuft2", "tuft3",
  "spire", "coin1", "coin2", "coin3", "gate", "shell_wall", "save", "wind",
];

const KEY_ACTIONS = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  Space: "jump", ArrowUp: "jump", KeyW: "jump", KeyZ: "jump",
};

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;
const viewport = document.querySelector("#viewport");
const scene = document.querySelector("#scene");
const titleScreen = document.querySelector("#title-screen");
const controls = document.querySelector("#touch-controls");
const touchButtons = [...controls.querySelectorAll("button")];
const completion = document.querySelector("#completion");
const replay = document.querySelector("#replay");
const moveHint = document.querySelector("#move-hint");
const glideHint = document.querySelector("#glide-hint");
const wallHint = document.querySelector("#wall-hint");

const art = {};
const keys = new Set();
const pointers = new Map();
const touchDevice = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
const hero = {};
const coins = COIN_POSITIONS.map(([x, y]) => ({ x, y, taken: false }));
const particles = [];

let mode = "loading";
let startRequested = false;
let inputDevice = "";
let jumpPressed = false;
let jumpReleased = false;
let worldTime = 0;
let cameraX = 0;
let hearts = MAX_HEARTS;
let collected = 0;
let checkpoint = GROUND_RUNS[0];
let checkpointX = START_X;
let startTravel = 0;
let finishedAt = 0;
let lastFrame;
let elapsed = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrap = (value, size) => ((value % size) + size) % size;

function fit() {
  const fitScale = Math.min(viewport.clientWidth / WIDTH, viewport.clientHeight / HEIGHT);
  scene.style.setProperty("--scale", Math.floor(fitScale) || fitScale);
}

function loadImage(name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      art[name] = image;
      resolve();
    };
    image.onerror = () => reject(new Error(`Unable to load assets/${name}.png`));
    image.src = `assets/${name}.png`;
  });
}

function actionHeld(action) {
  for (const code of keys) {
    if (KEY_ACTIONS[code] === action) return true;
  }
  for (const held of pointers.values()) {
    if (held === action) return true;
  }
  return false;
}

function updateJumpEdges(wasHeld) {
  const held = actionHeld("jump");
  if (held && !wasHeld) jumpPressed = true;
  if (!held && wasHeld) jumpReleased = true;
}

function refreshControls() {
  controls.hidden = mode !== "playing" || !touchDevice || inputDevice === "keyboard";
  for (const button of touchButtons) {
    const pressed = [...pointers.values()].includes(button.dataset.action);
    button.classList.toggle("pressed", pressed);
  }
}

function clearInput() {
  const wasHeld = actionHeld("jump");
  keys.clear();
  pointers.clear();
  jumpPressed = false;
  updateJumpEdges(wasHeld);
  refreshControls();
}

function requestStart() {
  if (mode === "loading") startRequested = true;
  if (mode === "title") begin();
}

window.addEventListener("keydown", event => {
  if (mode === "complete" || event.metaKey || event.ctrlKey || event.altKey) return;
  const action = KEY_ACTIONS[event.code];
  if (action) event.preventDefault();
  if (event.repeat) return;
  if (!inputDevice || action) inputDevice = "keyboard";
  const wasHeld = actionHeld("jump");
  if (action) {
    pointers.clear();
    keys.add(event.code);
  }
  updateJumpEdges(wasHeld);
  requestStart();
  refreshControls();
});

window.addEventListener("keyup", event => {
  if (!KEY_ACTIONS[event.code]) return;
  if (mode === "playing") event.preventDefault();
  const wasHeld = actionHeld("jump");
  keys.delete(event.code);
  updateJumpEdges(wasHeld);
});

window.addEventListener("pointerdown", event => {
  if (mode === "playing" && touchDevice && event.pointerType === "touch") {
    inputDevice = "touch";
    refreshControls();
  }
  if (mode !== "loading" && mode !== "title") return;
  if (event.pointerType !== "mouse") inputDevice = "touch";
  requestStart();
});

document.querySelector("#start").addEventListener("click", requestStart);
replay.addEventListener("click", begin);

for (const button of touchButtons) {
  button.addEventListener("pointerdown", event => {
    if (mode !== "playing" || event.pointerType === "mouse") return;
    event.preventDefault();
    const wasHeld = actionHeld("jump");
    inputDevice = "touch";
    pointers.set(event.pointerId, button.dataset.action);
    button.setPointerCapture(event.pointerId);
    updateJumpEdges(wasHeld);
    refreshControls();
  });
  button.addEventListener("lostpointercapture", releasePointer);
}

function releasePointer(event) {
  if (!pointers.has(event.pointerId)) return;
  const wasHeld = actionHeld("jump");
  pointers.delete(event.pointerId);
  updateJumpEdges(wasHeld);
  refreshControls();
}

window.addEventListener("pointerup", releasePointer);
window.addEventListener("pointercancel", releasePointer);
window.addEventListener("blur", clearInput);
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInput();
});
document.addEventListener("gesturestart", event => event.preventDefault(), { passive: false });

function placeHero(x, ground, hurt = 0) {
  Object.assign(hero, {
    x, y: ground.y, vx: 0, vy: 0, facing: 1, ground,
    coyote: 0, buffer: 0, glide: false, windGlide: false, cuttable: false,
    hurt, wall: false, pose: "idle", poseTime: 0, puffTime: 0,
  });
}

function moveGears(reset = false) {
  for (const gear of GEARS) {
    const y = gear.baseY + BOB_AMPLITUDE * Math.sin(worldTime * BOB_RATE + gear.phase);
    gear.previousY = reset ? y : gear.y;
    gear.y = y;
  }
}

function resetLevel() {
  worldTime = 0;
  cameraX = 0;
  hearts = MAX_HEARTS;
  collected = 0;
  checkpoint = GROUND_RUNS[0];
  checkpointX = START_X;
  startTravel = 0;
  particles.length = 0;
  for (const coin of coins) coin.taken = false;
  moveGears(true);
  placeHero(START_X, checkpoint);
}

function begin() {
  if (mode === "complete") {
    clearInput();
    jumpReleased = false;
  }
  resetLevel();
  titleScreen.hidden = true;
  completion.hidden = true;
  mode = "playing";
  refreshControls();
}

function loseHeart() {
  hearts = Math.max(0, hearts - 1);
  placeHero(checkpointX, checkpoint, HURT_TIME);
  jumpPressed = false;
  jumpReleased = false;
  cameraX = clamp(hero.x - WIDTH / 2 + LOOK_AHEAD, 0, LEVEL_WIDTH - WIDTH);
}

function finish() {
  burst(SAVE_X + 23, GROUND_Y - 39, "spark", 22);
  mode = "complete";
  finishedAt = worldTime;
  clearInput();
  document.querySelector("#result").textContent = `齿轮 ${collected} / ${coins.length}`;
}

function showResult() {
  completion.hidden = false;
  if (inputDevice === "keyboard") replay.focus({ preventScroll: true });
}

function emit(x, y, vx, vy, life, kind) {
  particles.push({ x, y, vx, vy, life, duration: life, kind });
}

function burst(x, y, kind, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 14 + Math.random() * (kind === "spark" ? 72 : 30);
    const vy = kind === "spark" ? Math.sin(angle) * speed : -8 - Math.random() * 26;
    emit(x, y, Math.cos(angle) * speed, vy, 0.25 + Math.random() * 0.55, kind);
  }
}

function moveParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.kind === "dust" ? 60 : 14) * dt;
  }
}

function moveSideways(dt, direction) {
  if (direction) {
    hero.facing = direction;
    hero.vx = clamp(hero.vx + direction * ACCELERATION * dt, -RUN_SPEED, RUN_SPEED);
  } else {
    hero.vx = Math.sign(hero.vx) * Math.max(0, Math.abs(hero.vx) - DECELERATION * dt);
  }

  const half = HERO_WIDTH / 2;
  const oldX = hero.x;
  hero.x = clamp(oldX + hero.vx * dt, half, LEVEL_WIDTH - half);
  hero.wall = false;

  function collideSides(left, right) {
    if (oldX + half <= left && hero.x + half > left) {
      hero.x = left - half;
    } else if (oldX - half >= right && hero.x - half < right) {
      hero.x = right + half;
    } else {
      return false;
    }
    hero.vx = 0;
    return true;
  }

  if (hero.y > WALL_TOP && hero.y - HERO_HEIGHT < GROUND_Y) {
    hero.wall = collideSides(WALL_LEFT, WALL_RIGHT);
  }

  if (hero.y > GROUND_Y && hero.y - HERO_HEIGHT < FALL_Y) {
    for (const run of GROUND_RUNS) collideSides(run.left, run.right);
  }
}

function moveVertically(dt, holdingJump) {
  const previousGround = hero.ground;
  if (previousGround?.previousY !== undefined) {
    hero.y += previousGround.y - previousGround.previousY;
  }

  hero.buffer = jumpPressed ? JUMP_BUFFER : Math.max(0, hero.buffer - dt);
  hero.coyote = previousGround ? COYOTE_TIME : Math.max(0, hero.coyote - dt);
  if (hero.buffer > 0 && hero.coyote > 0) {
    hero.vy = JUMP_SPEED;
    hero.coyote = 0;
    hero.buffer = 0;
    hero.cuttable = true;
  }
  if (hero.cuttable && (jumpReleased || !holdingJump)) {
    if (hero.vy < 0) hero.vy *= JUMP_CUT;
    hero.cuttable = false;
  }
  jumpPressed = false;
  jumpReleased = false;

  const centerY = hero.y - HERO_HEIGHT / 2;
  const insideWind = hero.x >= WIND.x && hero.x < WIND.x + WIND.width
    && centerY >= WIND.y && centerY < FALL_Y;
  hero.windGlide = holdingJump && insideWind && (hero.windGlide || hero.vy >= 0);
  if (hero.windGlide) {
    hero.vy = Math.max(hero.vy - WIND_LIFT * dt, -WIND_RISE);
    hero.cuttable = false;
  } else {
    hero.vy += GRAVITY * dt;
    if (hero.vy >= 0) {
      hero.cuttable = false;
      if (holdingJump) hero.vy = Math.min(hero.vy, GLIDE_FALL);
      else if (insideWind) hero.vy = Math.min(hero.vy, WIND_FALL);
    }
  }

  const oldY = hero.y;
  const nextY = oldY + hero.vy * dt;
  const half = HERO_WIDTH / 2;
  let landed = null;
  if (hero.vy >= 0) {
    for (const surface of SURFACES) {
      const lastY = surface === previousGround ? surface.y : surface.previousY ?? surface.y;
      if (hero.x + half <= surface.left || hero.x - half >= surface.right) continue;
      if (oldY <= lastY + 0.001 && nextY >= surface.y && (!landed || surface.y < landed.y)) {
        landed = surface;
      }
    }
  }

  hero.ground = landed;
  if (landed) {
    if (!previousGround && hero.vy > 22) burst(hero.x, landed.y - 1, "dust", 5);
    hero.y = landed.y;
    hero.vy = 0;
    hero.glide = false;
    hero.windGlide = false;
    hero.cuttable = false;
  } else {
    hero.y = nextY;
    hero.glide = hero.windGlide || (holdingJump && hero.vy > 0);
  }
}

function updatePose(dt) {
  let pose = "idle";
  if (hero.hurt > 0 && Math.floor(hero.hurt * 16) % 2) pose = "hurt";
  else if (hero.wall && !hero.ground) pose = "wall";
  else if (hero.glide) pose = "glide";
  else if (!hero.ground) pose = hero.vy < 0 ? "jump" : "fall";
  else if (Math.abs(hero.vx) > 6) pose = "run";

  if (hero.pose === pose) {
    hero.poseTime += dt;
  } else {
    hero.pose = pose;
    hero.poseTime = 0;
  }
}

function update(dt) {
  worldTime += dt;
  if (mode === "title") {
    hero.poseTime += dt;
    return;
  }

  moveParticles(dt);
  if (mode === "complete" && completion.hidden && worldTime - finishedAt >= COMPLETION_DELAY) {
    showResult();
  }
  if (mode !== "playing") return;

  moveGears();
  const direction = Number(actionHeld("right")) - Number(actionHeld("left"));
  moveSideways(dt, direction);
  moveVertically(dt, actionHeld("jump"));

  if (hero.y > FALL_Y) {
    loseHeart();
    return;
  }

  startTravel = Math.max(startTravel, Math.abs(hero.x - START_X));
  if (checkpointX === START_X && hero.x >= CHECKPOINT_X - 9 && hero.x < 1012) {
    checkpointX = CHECKPOINT_X;
    checkpoint = GROUND_RUNS[2];
    burst(checkpointX, GROUND_Y - 4, "spark", 7);
  }

  for (const coin of coins) {
    if (!coin.taken && Math.abs(coin.x - hero.x) <= 14
      && coin.y + 7 >= hero.y - HERO_HEIGHT && coin.y - 7 <= hero.y) {
      coin.taken = true;
      collected += 1;
      burst(coin.x, coin.y, "spark", 6);
    }
  }

  hero.puffTime -= dt;
  if (hero.glide && hero.puffTime <= 0) {
    hero.puffTime = 0.08;
    emit(hero.x - hero.facing * 12, hero.y - 13, -hero.facing * 24, 6, 0.4, "glide");
  }
  hero.hurt = Math.max(0, hero.hurt - dt);
  if (hearts === 0 && hero.hurt <= HURT_TIME / 2) hearts = MAX_HEARTS;
  updatePose(dt);

  const target = clamp(hero.x - WIDTH / 2 + LOOK_AHEAD * hero.facing, 0, LEVEL_WIDTH - WIDTH);
  cameraX += (target - cameraX) * CAMERA_LERP;

  if (Math.abs(hero.x - (SAVE_X + 23)) < 13 && hero.y >= GROUND_Y - 49
    && hero.y - HERO_HEIGHT <= GROUND_Y) {
    finish();
  }
}

function drawSprite(name, x, y) {
  const sprite = art[name];
  if (x > -sprite.width && x < WIDTH && y > -sprite.height && y < HEIGHT) {
    ctx.drawImage(sprite, Math.round(x), Math.round(y));
  }
}

function drawParallax(sourceY, sourceHeight, width, height, y, factor, origin = 0) {
  const offset = Math.round(cameraX * factor) + origin;
  let tile = Math.floor(offset / width);
  for (let x = tile * width - offset; x < WIDTH; x += width, tile += 1) {
    ctx.save();
    if (tile % 2) {
      ctx.translate(x + width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(x, 0);
    }
    ctx.drawImage(art.bg_far, 0, sourceY, 540, sourceHeight, 0, y, width, height);
    ctx.restore();
  }
}

function drawGround(run) {
  const left = Math.round(run.x - cameraX);
  if (left >= WIDTH || left + run.width <= 0) return;

  const y = run.y - 6;
  const middle = art.ground_mid;
  ctx.drawImage(art.ground_left, 2, 0, 54, 49, left, y, 54, 49);
  for (let i = 0; i < run.tiles; i += 1) {
    ctx.drawImage(middle, 2, 0, 92, 49, left + 54 + i * 92, y, 92, 49);
  }
  ctx.drawImage(art.ground_right, 2, 0, 50, 49, left + run.width - 50, y, 50, 49);

  for (let row = y + 47; row < HEIGHT; row += 30) {
    for (let col = 0; col < run.width; col += 92) {
      const width = Math.min(92, run.width - col);
      ctx.drawImage(middle, 2, 17, width, 30, left + col, row, width, 30);
    }
  }
}

function drawWind() {
  const x = Math.round(WIND.x - cameraX);
  if (x >= WIDTH || x + WIND.width <= 0) return;
  const height = art.wind.height;
  const offset = Math.floor(wrap(-worldTime * WIND_SCROLL, height));

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, WIND.y, WIND.width, HEIGHT - WIND.y);
  ctx.clip();
  ctx.globalAlpha = 0.85;
  for (let y = WIND.y + offset - height; y < HEIGHT; y += height) {
    ctx.drawImage(art.wind, x, y);
  }
  ctx.restore();
}

function drawSave() {
  const x = Math.round(SAVE_X - cameraX);
  if (x < -70 || x > WIDTH + 23) return;
  const centerX = x + 23;
  const centerY = GROUND_Y - 39;
  const radius = 22 + Math.round(4 * Math.sin(worldTime * 3));
  const glow = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, radius);
  glow.addColorStop(0, "rgba(255, 247, 204, .56)");
  glow.addColorStop(0.5, "rgba(164, 255, 244, .23)");
  glow.addColorStop(1, "rgba(164, 255, 244, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(centerX - radius, centerY - radius, 2 * radius, 2 * radius);
  drawSprite("save", x, GROUND_Y - 60);
}

function drawCoins() {
  const frames = ["coin1", "coin2", "coin3", "coin2"];
  for (let i = 0; i < coins.length; i += 1) {
    const coin = coins[i];
    if (coin.taken) continue;
    const frame = frames[(Math.floor(worldTime * 8) + i) % frames.length];
    drawSprite(frame, coin.x - cameraX - 7, coin.y - 7);
  }
}

function drawHero() {
  const frames = {
    idle: 4 + Math.floor(hero.poseTime * 2) % 2,
    run: Math.floor(hero.poseTime * 12) % 4,
    jump: 6,
    fall: 7,
    glide: 8 + Math.floor(hero.poseTime * 10) % 2,
    wall: 10,
    hurt: 11,
  };
  const width = Math.round(91 * HERO_SCALE);
  const height = Math.round(98 * HERO_SCALE);
  const x = Math.round(hero.x - cameraX - width / 2);
  const y = Math.round(hero.y - height);
  ctx.save();
  ctx.translate(hero.facing === 1 ? x : x + width, y);
  ctx.scale(hero.facing, 1);
  ctx.drawImage(art.hero, frames[hero.pose] * 91, 0, 91, 98, 0, 0, width, height);
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const x = Math.round(p.x - cameraX);
    const y = Math.round(p.y);
    ctx.globalAlpha = Math.min(1, 2 * p.life / p.duration);
    if (p.kind === "spark") {
      ctx.fillStyle = "#ffd69f";
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = "#fff8ef";
      ctx.fillRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = p.kind === "dust" ? "#edb9ff" : "#a8faf6";
      ctx.fillRect(x - 1, y, 3, 2);
      ctx.fillStyle = p.kind === "dust" ? "#fff0ff" : "#e4ffff";
      ctx.fillRect(x, y - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

const HEART_PIXELS = [
  ".##...##.",
  "#hh#.#hh#",
  "#hpp#ppp#",
  "#ppppppp#",
  ".#ppppp#.",
  "..#ppp#..",
  "...#p#...",
  "....#....",
];
const DIGITS = [
  "111101101101111", "010110010010111", "111001111100111",
  "111001111001111", "101101111001001", "111100111001111",
  "111100111101111", "111001010010010", "111101111101111",
  "111101111001111",
];

function drawHud() {
  for (let heart = 0; heart < MAX_HEARTS; heart += 1) {
    for (let y = 0; y < HEART_PIXELS.length; y += 1) {
      for (let x = 0; x < HEART_PIXELS[y].length; x += 1) {
        const pixel = HEART_PIXELS[y][x];
        if (pixel === ".") continue;
        if (pixel === "#") ctx.fillStyle = "#21184f";
        else if (heart >= hearts) ctx.fillStyle = "#6d5f91";
        else ctx.fillStyle = pixel === "h" ? "#ffded9" : "#ff878e";
        ctx.fillRect(8 + heart * 12 + x, 8 + y, 1, 1);
      }
    }
  }

  const count = String(collected);
  const textX = WIDTH - 8 - (count.length * 8 - 2);
  drawSprite("coin1", textX - 19, 5);
  for (let i = 0; i < count.length; i += 1) {
    const glyph = DIGITS[Number(count[i])];
    for (let p = 0; p < 15; p += 1) {
      if (glyph[p] === "0") continue;
      const x = textX + i * 8 + (p % 3) * 2;
      const y = 8 + Math.floor(p / 3) * 2;
      ctx.fillStyle = "#2a2055";
      ctx.fillRect(x - 1, y - 1, 4, 4);
    }
    for (let p = 0; p < 15; p += 1) {
      if (glyph[p] === "0") continue;
      ctx.fillStyle = "#fff8f2";
      ctx.fillRect(textX + i * 8 + (p % 3) * 2, 8 + Math.floor(p / 3) * 2, 2, 2);
    }
  }
}

function setHint(element, visible, worldX, y, opacity = 1) {
  element.hidden = !visible;
  if (!visible) return;
  const width = element.offsetWidth;
  const x = clamp(Math.round(worldX - cameraX - width / 2), 6, WIDTH - width - 6);
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.style.opacity = opacity;
}

function render() {
  ctx.drawImage(art.bg_sky, -Math.round(cameraX * 0.06), 0);
  drawParallax(270, 90, 527, 88, NEAR_DUNES_Y, 0.4);

  for (const [x, bottom] of SPIRES) {
    drawSprite("spire", x - cameraX * 0.96, bottom - 28);
  }
  drawWind();
  drawSprite("gate", GATE_X - cameraX, GROUND_Y - 75);
  for (const run of GROUND_RUNS) drawGround(run);
  for (const [x, kind] of TUFTS) {
    const name = `tuft${kind}`;
    drawSprite(name, x - cameraX, GROUND_Y - art[name].height + 3);
  }

  for (const surface of [...LEDGES, ...GEARS]) {
    drawSprite(surface.art, surface.x - cameraX, surface.y - 4);
  }
  drawSprite("shell_wall", WALL.x - cameraX, WALL_TOP - 3);
  drawSprite("shell_wall", WALL.x - cameraX, GROUND_Y - WALL.visibleHeight - 3);
  drawSave();
  drawCoins();
  drawParticles();
  drawHero();

  if (mode !== "title") drawHud();
  const playing = mode === "playing";
  setHint(moveHint, playing && startTravel < 80, 108, 131, clamp((80 - startTravel) / 24, 0, 1));
  setHint(glideHint, playing && hero.x >= 904 && hero.x <= 1130, 969, 103);
  const nearWall = hero.x + HERO_WIDTH / 2 >= WALL_LEFT - WALL.radius
    && hero.x - HERO_WIDTH / 2 <= WALL_RIGHT + WALL.radius;
  setHint(wallHint, nearWall && (playing || (mode === "complete" && completion.hidden)), WALL.x, 99);
}

function frame(now) {
  if (lastFrame !== undefined) elapsed += Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  while (elapsed >= STEP) {
    update(STEP);
    elapsed -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

fit();
Promise.all(ASSET_NAMES.map(loadImage)).then(() => {
  resetLevel();
  mode = "title";
  titleScreen.hidden = false;
  if (startRequested) begin();
  requestAnimationFrame(frame);
}).catch(error => {
  mode = "error";
  document.querySelector("#load-error").hidden = false;
  console.error(error);
});

// QA hook: ?qa=x teleports hero (for screenshots only)
window.__qa = (x, y) => { hero.x = x; hero.y = y ?? 150; hero.vy = 0; cameraX = clamp(hero.x - WIDTH / 2 + LOOK_AHEAD, 0, LEVEL_WIDTH - WIDTH); };
