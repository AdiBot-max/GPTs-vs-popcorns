// === server.js ===
// Multiplayer Game Server — GPTs vs Popcorns
// Express + Socket.IO + UUID
// By Adi

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// === Static Files ===
app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === Game State ===
const players = {};
const bullets = {};
const WORLD = { width: 2000, height: 1500 };

// === Utility ===
function randomSpawn() {
  return {
    x: Math.random() * WORLD.width,
    y: Math.random() * WORLD.height,
  };
}

// === Connection Handler ===
io.on("connection", (socket) => {
  const id = socket.id;
  const team =
    Object.values(players).filter((p) => p.team === "ChatGPT").length <=
    Object.values(players).filter((p) => p.team === "Popcorn").length
      ? "ChatGPT"
      : "Popcorn";

  const spawn = randomSpawn();
  players[id] = {
    id,
    team,
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    health: 100,
    kills: 0,
    deaths: 0,
    lastActive: Date.now(),
  };

  console.log(`🟢 Player joined: ${id} (${team})`);
  socket.emit("init", { id, players });
  io.emit("players", players);

  // === Movement Update ===
  socket.on("move", (data) => {
    const p = players[id];
    if (!p) return;
    p.x = data.x;
    p.y = data.y;
    p.angle = data.angle;
    p.lastActive = Date.now();
    io.emit("players", players);
  });

  // === Shooting ===
  socket.on("shoot", (data) => {
    const p = players[id];
    if (!p) return;
    const bid = uuidv4();
    const speed = 8;
    bullets[bid] = {
      id: bid,
      x: p.x,
      y: p.y,
      vx: Math.cos(data.angle) * speed,
      vy: Math.sin(data.angle) * speed,
      team: p.team,
      life: 80,
    };
    io.emit("bullets", bullets);
  });

  // === Disconnect ===
  socket.on("disconnect", () => {
    console.log(`🔴 Player left: ${id}`);
    delete players[id];
    io.emit("players", players);
  });
});

// === Game Loop ===
setInterval(() => {
  const now = Date.now();

  // Move bullets
  for (const bid in bullets) {
    const b = bullets[bid];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.life <= 0) delete bullets[bid];
  }

  // Bullet collisions
  for (const bid in bullets) {
    const b = bullets[bid];
    for (const pid in players) {
      const p = players[pid];
      if (p.team === b.team) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (Math.hypot(dx, dy) < 22) {
        p.health -= 30;
        if (p.health <= 0) {
          p.health = 100;
          p.deaths++;
          players[b.owner]?.kills++;
          const sp = randomSpawn();
          p.x = sp.x;
          p.y = sp.y;
          io.emit("playerDied", { id: pid });
        }
        delete bullets[bid];
      }
    }
  }

  // Idle cleanup (60s inactivity)
  for (const id in players) {
    if (now - players[id].lastActive > 60000) {
      console.log(`💤 Idle player removed: ${id}`);
      delete players[id];
    }
  }

  io.emit("state", { players, bullets });
}, 1000 / 60);

// === Start Server ===
server.listen(PORT, () => {
  console.log(`🚀 GPTs vs Popcorns running on http://localhost:${PORT}`);
});
