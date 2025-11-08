localStorage.clear(); // clear any leftover game state
const socket = io({ forceNew: true }); // always get a fresh socket
const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let myId = null;
let players = {};
let bullets = [];
let input = { up: false, down: false, left: false, right: false, angle: 0 };
const keys = {};

window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const me = players[myId];
  if (me) input.angle = Math.atan2(my - me.y, mx - me.x);
});
canvas.addEventListener("click", () => {
  socket.emit("shoot", { angle: input.angle });
});

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

function updateInput() {
  input.up = keys["w"] || keys["ArrowUp"];
  input.down = keys["s"] || keys["ArrowDown"];
  input.left = keys["a"] || keys["ArrowLeft"];
  input.right = keys["d"] || keys["ArrowRight"];
  socket.emit("input", input);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateInput();

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
    ctx.rotate(p.rot);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = p.team === 1 ? "#f6c35a" : "#6ee7b7";
    ctx.fill();

    // name
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.name + (p.id === myId ? " (you)" : ""), 0, 30);
    ctx.restore();
  });

  requestAnimationFrame(draw);
}

draw();

