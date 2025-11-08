// === server.js ===
// ChatGPT vs Popcorns — Multiplayer Arena
// Express + Socket.IO

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// serve static files
app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// === Game State ===
const players = {};
const bullets = {};
const WORLD = { w: 2000, h: 1500 };

function randomSpawn() {
  return { x: Math.random() * WORLD.w, y: Math.random() * WORLD.h };
}

// === Socket Handling ===
io.on("connection", (socket) => {
  const id = socket.id;
  const team =
    Object.values(players).filter((p) => p.team === 1).length <=
    Object.values(players).filter((p) => p.team === 2).length
      ? 1
      : 2;

  const spawn = randomSpawn();
  players[id] = {
    id,
    team,
    name: team === 1 ? "Popcorn" : "ChatGPT",
    x: spawn.x,
    y: spawn.y,
    rot: 0,
    health: 100,
    score: 0,
  };

  console.log(`🟢 Player connected: ${id} (${players[id].name})`);

  // send initial data
  socket.emit("init", { id, players, bullets });
  io.emit("players", players);

  // movement + rotation
  socket.on("input", (data) => {
    const p = players[id];
    if (!p) return;

    const speed = 4;
    if (data.up) p.y -= speed;
    if (data.down) p.y += speed;
    if (data.left) p.x -= speed;
    if (data.right) p.x += speed;

    p.rot = data.angle;
    p.x = Math.max(0, Math.min(WORLD.w, p.x));
    p.y = Math.max(0, Math.min(WORLD.h, p.y));
  });

  // shooting
  socket.on("shoot", (data) => {
    const p = players[id];
    if (!p) return;
    const bid = uuidv4();
    const speed = 9;

    bullets[bid] = {
      id: bid,
      x: p.x,
      y: p.y,
      vx: Math.cos(data.angle) * speed,
      vy: Math.sin(data.angle) * speed,
      team: p.team,
      owner: id,
      life: 70,
    };
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Player left: ${id}`);
    delete players[id];
    io.emit("players", players);
  });
});

// === Game Loop ===
setInterval(() => {
  const toRemove = [];

  for (const bid in bullets) {
    const b = bullets[bid];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.life <= 0) {
      toRemove.push(bid);
      continue;
    }

    for (const pid in players) {
      const p = players[pid];
      if (p.team === b.team) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (Math.hypot(dx, dy) < 25) {
        p.health -= 30;
        toRemove.push(bid);

        if (p.health <= 0) {
          p.health = 100;
          p.x = Math.random() * WORLD.w;
          p.y = Math.random() * WORLD.h;
          p.score -= 1;
          if (players[b.owner]) players[b.owner].score += 1;
        }
      }
    }
  }

  toRemove.forEach((id) => delete bullets[id]);
  io.emit("state", { players, bullets });
}, 1000 / 60);

// === Start ===
server.listen(PORT, () =>
  console.log(`🚀 GPTs vs Popcorns running on http://localhost:${PORT}`)
);
