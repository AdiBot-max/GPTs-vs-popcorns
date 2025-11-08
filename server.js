const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

const players = {};
const WORLD_SIZE = { w: 1000, h: 600 };

app.use(express.static(__dirname));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  console.log("Player joined:", socket.id);

  // Random but visible position
  const player = {
    id: socket.id,
    x: 400 + Math.random() * 200,
    y: 250 + Math.random() * 100,
    team: Math.random() > 0.5 ? "chatGPT" : "popcorn",
    angle: 0,
    alive: true
  };

  players[socket.id] = player;
  io.emit("updatePlayers", players);

  socket.on("move", (data) => {
    const p = players[socket.id];
    if (!p) return;
    const speed = 5;
    if (data.up) p.y -= speed;
    if (data.down) p.y += speed;
    if (data.left) p.x -= speed;
    if (data.right) p.x += speed;
    p.angle = data.angle;
    io.emit("updatePlayers", players);
  });

  socket.on("shoot", () => {
    // simple broadcast (can expand later)
    io.emit("shoot", { id: socket.id });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("updatePlayers", players);
    console.log("Player left:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Game server running on http://localhost:${PORT}`);
});
