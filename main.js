const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreboard = document.getElementById("scoreboard");
const fullBtn = document.getElementById("fullscreenBtn");

let myId = null;
let players = {};
let bullets = [];
const keys = {};
let inputState = { up: false, down: false, left: false, right: false, angle: 0 };

// Resize on load
window.addEventListener("load", resizeCanvas);
window.addEventListener("resize", resizeCanvas);
function resizeCanvas() {
  canvas.width = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.8;
}

// Controls
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === "g" || e.key === "G") shoot();
  if (e.key === "f" || e.key === "F") toggleFullscreen();
});
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

function updateInput() {
  inputState.up = keys["w"] || keys["arrowup"];
  inputState.down = keys["s"] || keys["arrowdown"];
  inputState.left = keys["a"] || keys["arrowleft"];
  inputState.right = keys["d"] || keys["arrowright"];
}

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const me = players[myId];
  if (me) inputState.angle = Math.atan2(my - me.y, mx - me.x);
});
canvas.addEventListener("click", shoot);

function shoot() {
  if (!myId || !players[myId]) return;
  socket.emit("shoot", { angle: inputState.angle });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) canvas.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
}
fullBtn.onclick = toggleFullscreen;

// Socket events
socket.on("init", (data) => {
  myId = data.id;
  players = data.players;
});
socket.on("players", (data) => (players = data));
socket.on("state", (data) => {
  players = data.players;
  bullets = data.bullets;
});

// Draw loop
function draw() {
  updateInput();
  socket.emit("input", inputState);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background grid
  ctx.save();
  ctx.strokeStyle = "rgba(0,255,255,0.1)";
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();

  // bullets
  bullets.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = b.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.fill();
  });

  // players
  Object.values(players).forEach((p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = p.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.shadowColor = p.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();

    // name & health
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.name, p.x, p.y + 30);

    ctx.fillStyle = "#222";
    ctx.fillRect(p.x - 20, p.y - 30, 40, 5);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(p.x - 20, p.y - 30, 40 * (p.health / 100), 5);
  });

  // scoreboard
  const team1 = Object.values(players).filter((p) => p.team === 1);
  const team2 = Object.values(players).filter((p) => p.team === 2);
  scoreboard.innerText = `🍿 Popcorns: ${team1.length} | 🤖 ChatGPTs: ${team2.length}`;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
