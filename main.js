// main.js (client) — robust, logs useful info
// Note: include <script src="/socket.io/socket.io.js"></script> before this file in index.html

// Do NOT clear localStorage globally (can interfere with other pages).
// But force a fresh socket instance to avoid stale connection reuse.
const socket = io({ forceNew: true, transports: ["websocket", "polling"] });

// Canvas — match server arena
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = 1000;
canvas.height = 600;

let myId = null;
let players = {};
let bullets = []; // array for easy iteration
let input = { up:false, down:false, left:false, right:false, angle:0 };
const keys = {};

// Debug helper
function dbg(...args) { console.log("[game]", ...args); }

socket.on("connect", () => {
  dbg("socket connected", socket.id);
});
socket.on("connect_error", (err) => {
  console.error("connect_error", err);
});
socket.on("disconnect", (reason) => {
  dbg("socket disconnected:", reason);
});

// socket events — keep logs so we can see what arrives
socket.on("init", (data) => {
  dbg("init received", data && { id: data.id, playersCount: Object.keys(data.players || {}).length });
  myId = data.id;
  players = data.players || {};
  bullets = Object.values(data.bullets || {});
});

socket.on("players", (data) => {
  players = data || {};
  dbg("players update, count:", Object.keys(players).length);
});

socket.on("state", (data) => {
  players = data.players || {};
  bullets = Object.values(data.bullets || {});
});

socket.on("bulletsAdd", (b) => {
  // optionally handle transient bullet adds
  bullets.push(b);
});

// Input handling
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Mouse aim
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const me = players[myId];
  if (me) input.angle = Math.atan2(my - me.y, mx - me.x);
  else input.angle = Math.atan2(my - canvas.height/2, mx - canvas.width/2);
});

// click to shoot
canvas.addEventListener("click", () => {
  socket.emit("shoot", { angle: input.angle });
});

// Send input at 30Hz
setInterval(() => {
  input.up = !!(keys["w"] || keys["arrowup"]);
  input.down = !!(keys["s"] || keys["arrowdown"]);
  input.left = !!(keys["a"] || keys["arrowleft"]);
  input.right = !!(keys["d"] || keys["arrowright"]);
  socket.emit("input", input);
}, 1000/30);

// Defensive draw: don't crash if data missing
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background grid (faint)
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let x=0;x<canvas.width;x+=40){ ctx.fillRect(x,0,1,canvas.height); }
  for (let y=0;y<canvas.height;y+=40){ ctx.fillRect(0,y,canvas.width,1); }
  ctx.restore();

  // bullets
  bullets.forEach(b => {
    if (!b) return;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI*2);
    ctx.fillStyle = b.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.fill();
  });

  // players
  Object.values(players).forEach(p => {
    if (!p) return;
    // defensive clamp before draw (in case server gave slightly out-of-range)
    const px = Math.max(0, Math.min(canvas.width, p.x || 0));
    const py = Math.max(0, Math.min(canvas.height, p.y || 0));

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(typeof p.rot === "number" ? p.rot : 0);
    ctx.beginPath();
    ctx.arc(0,0,18,0,Math.PI*2);
    ctx.fillStyle = p.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.fill();

    // sword
    ctx.fillStyle = "#d9d9e0";
    ctx.fillRect(14, -3, 16, 6);

    ctx.restore();

    // health
    ctx.fillStyle = "#222";
    ctx.fillRect(px - 20, py - 30, 40, 6);
    ctx.fillStyle = "#0f0";
    const hp = Math.max(0, Math.min(100, p.health || 100));
    ctx.fillRect(px - 20, py - 30, (hp/100) * 40, 6);

    // name
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText((p.name || p.id) + (p.id === myId ? " (you)" : ""), px, py + 30);
  });

  // scoreboard quick
  const t1 = Object.values(players).filter(p => p.team === 1).length;
  const t2 = Object.values(players).filter(p => p.team === 2).length;
  const scoreboardEl = document.getElementById("scoreboard");
  if (scoreboardEl) scoreboardEl.innerText = `🍿 Popcorns: ${t1} | 🤖 ChatGPTs: ${t2}`;

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

// expose debug helpers
window.__game_debug = { playersRef: () => players, bulletsRef: () => bullets };
