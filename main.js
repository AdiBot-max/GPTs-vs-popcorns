const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = 1000;
canvas.height = 600;

let keys = {};
let players = {};
let myId = null;
let mouseAngle = 0;

// Listen for server updates
socket.on("updatePlayers", (data) => {
  players = data;
  if (!myId && socket.id in data) myId = socket.id;
});

// Handle shoot event (basic visual flash)
socket.on("shoot", ({ id }) => {
  if (players[id]) {
    const p = players[id];
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
});

// Movement & aiming
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));
window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + canvas.width / 2;
  const cy = rect.top + canvas.height / 2;
  mouseAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
});
window.addEventListener("keypress", (e) => {
  if (e.key.toLowerCase() === "g") socket.emit("shoot");
});

function loop() {
  socket.emit("move", {
    up: keys["w"],
    down: keys["s"],
    left: keys["a"],
    right: keys["d"],
    angle: mouseAngle
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let id in players) {
    const p = players[id];
    if (!p.alive) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.team === "chatGPT" ? "#00aaff" : "#ffcc00";
    ctx.fillRect(-15, -15, 30, 30);
    ctx.restore();
  }

  requestAnimationFrame(loop);
}
loop();
