const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 3000;

// === Game State ===
const players = {};
const swords = {};
const WORLD_SIZE = { w: 2000, h: 1500 };

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  const team =
    Object.values(players).filter((p) => p.team === 1).length <=
    Object.values(players).filter((p) => p.team === 2).length
      ? 1
      : 2;

  players[socket.id] = {
    id: socket.id,
    name: `Player-${socket.id.slice(0, 4)}`,
    x: Math.random() * WORLD_SIZE.w,
    y: Math.random() * WORLD_SIZE.h,
    rot: 0,
    team,
    health: 100,
    score: 0,
  };

  socket.emit("init", { id: socket.id, players, bullets: [] });
  io.emit("players", players);

  socket.on("input", (data) => {
    const p = players[socket.id];
    if (!p) return;
    const speed = 5;
    if (data.up) p.y -= speed;
    if (data.down) p.y += speed;
    if (data.left) p.x -= speed;
    if (data.right) p.x += speed;
    p.rot = data.angle;
  });

  socket.on("shoot", ({ angle }) => {
    const p = players[socket.id];
    if (!p) return;
    const bid = uuidv4();
    swords[bid] = {
      id: bid,
      x: p.x + Math.cos(angle) * 30,
      y: p.y + Math.sin(angle) * 30,
      vx: Math.cos(angle) * 10,
      vy: Math.sin(angle) * 10,
      team: p.team,
      life: 90,
    };
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

setInterval(() => {
  // Update sword movement and collisions
  for (const id in swords) {
    const s = swords[id];
    s.x += s.vx;
    s.y += s.vy;
    s.life--;
    if (s.life <= 0) delete swords[id];
  }
  io.emit("state", { players, bullets: Object.values(swords) });
}, 1000 / 60);

server.listen(PORT, () => {
  console.log(`🔥 ChatGPT vs Popcorns running on http://localhost:${PORT}`);
});
