// main.js — clean version with camera follow logic

const socket = io({ forceNew: true });

// Canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = 1000;
canvas.height = 600;

// World size (must match server)
const ARENA = { w: 3000, h: 2000 };

// State
let myId = null;
let players = {};
let bullets = [];
let input = { up: false, down: false, left: false, right: false, angle: 0 };
const keys = {};

// Socket handlers
socket.on("init", data => {
  myId = data.id;
  players = data.players || {};
  bullets = Object.values(data.bullets || {});
});

socket.on("state", data => {
  players = data.players || {};
  bullets = Object.values(data.bullets || []);
});

socket.on("players", data => {
  players = data || {};
});

// Input handling
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const me = players[myId];
  if (me) {
    input.angle = Math.atan2(my - me.y, mx - me.x);
  }
});

canvas.addEventListener("click", () => {
  socket.emit("shoot", { angle: input.angle });
});

// Send input at fixed interval
setInterval(() => {
  input.up = !!(keys["w"] || keys["arrowup"]);
  input.down = !!(keys["s"] || keys["arrowdown"]);
  input.left = !!(keys["a"] || keys["arrowleft"]);
  input.right = !!(keys["d"] || keys["arrowright"]);
  socket.emit("input", input);
}, 1000 / 30);

// Draw loop
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Camera follow
  const me = players[myId];
  let camX = 0, camY = 0;
  if (me) {
    camX = me.x - canvas.width / 2;
    camY = me.y - canvas.height / 2;
    camX = Math.max(0, Math.min(camX, ARENA.w - canvas.width));
    camY = Math.max(0, Math.min(camY, ARENA.h - canvas.height));
  }

  ctx.save();
  ctx.translate(-camX, -camY);

  // Optional grid
  ctx.globalAlpha = 0.06;
  for (let x = 0; x < ARENA.w; x += 40) ctx.fillRect(x, 0, 1, ARENA.h);
  for (let y = 0; y < ARENA.h; y += 40) ctx.fillRect(0, y, ARENA.w, 1);
  ctx.globalAlpha = 1;

  // Draw bullets
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = b.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.fill();
  });

  // Draw players
  Object.values(players).forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = p.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.fill();

    // Name
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.name + (p.id === myId ? " (you)" : ""), 0, 30);
    ctx.restore();

    // Health bar
    const hp = p.health || 100;
    ctx.fillStyle = "#222";
    ctx.fillRect(p.x - 20, p.y - 30, 40, 6);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(p.x - 20, p.y - 30, (hp/100) * 40, 6);
  });

  ctx.restore();

  // Update scoreboard UI
  const t1 = Object.values(players).filter(p => p.team === 1).length;
  const t2 = Object.values(players).filter(p => p.team === 2).length;
  const scoreboard = document.getElementById("scoreboard");
  if (scoreboard) {
    scoreboard.innerText = `Popcorns: ${t1} | ChatGPTs: ${t2}`;
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
