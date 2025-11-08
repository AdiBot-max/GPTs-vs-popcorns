// Clear old local data + force a fresh socket connection each load
localStorage.clear();
const socket = io({ forceNew: true });

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let myId = null;
let players = {};
let bullets = [];
let input = { up: false, down: false, left: false, right: false, angle: 0 };
const keys = {};

// Handle key events
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

// Mouse rotation
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const me = players[myId];
  if (me) input.angle = Math.atan2(my - me.y, mx - me.x);
});

// Shooting
canvas.addEventListener("click", () => {
  socket.emit("shoot", { angle: input.angle });
});

// Socket event listeners
socket.on("init", (data) => {
  myId = data.id;
  players = data.players;
  bullets = Object.values(data.bullets || {});
});

socket.on("players", (data) => (players = data));

socket.on("state", (data) => {
  players = data.players;
  bullets = Object.values(data.bullets);
});

// Player movement & input
function updateInput() {
  input.up = keys["w"] || keys["ArrowUp"];
  input.down = keys["s"] || keys["ArrowDown"];
  input.left = keys["a"] || keys["ArrowLeft"];
  input.right = keys["d"] || keys["ArrowRight"];
  socket.emit("input", input);
}

// Draw game
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateInput();

  // Draw bullets
  bullets.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = b.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.fill();
  });

  // Draw players
  Object.values(players).forEach((p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = p.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.fill();

    // Player name
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.name + (p.id === myId ? " (you)" : ""), 0, 30);
    ctx.restore();
  });

  requestAnimationFrame(draw);
}

draw();
