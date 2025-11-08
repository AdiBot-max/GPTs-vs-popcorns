// server.js — fixed authoritative server
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingTimeout: 30000 });

const PORT = process.env.PORT || 3000;

// serve static files from root
app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// === GAME CONFIG (match client) ===
const ARENA = { w: 1000, h: 600 };
const PLAYER_RADIUS = 18;
const BULLET_SPEED = 9;
const BULLET_LIFE = 80;

const players = {};       // socketId -> player
const bullets = {};       // bulletId -> bullet
let nextBulletId = 1;

function randomSpawnInside() {
  const margin = 40;
  return {
    x: Math.random() * (ARENA.w - margin * 2) + margin,
    y: Math.random() * (ARENA.h - margin * 2) + margin,
  };
}
function clampToArena(p) {
  p.x = Math.max(PLAYER_RADIUS, Math.min(ARENA.w - PLAYER_RADIUS, p.x));
  p.y = Math.max(PLAYER_RADIUS, Math.min(ARENA.h - PLAYER_RADIUS, p.y));
}
function now() { return Date.now(); }

// --- Connection handling ---
io.on("connection", socket => {
  const id = socket.id;

  // Balanced team assignment (1 = Popcorns, 2 = ChatGPTs)
  const t1 = Object.values(players).filter(p => p.team === 1).length;
  const t2 = Object.values(players).filter(p => p.team === 2).length;
  const team = t1 <= t2 ? 1 : 2;

  const spawn = randomSpawnInside();
  players[id] = {
    id,
    name: `P_${id.slice(-4)}`,
    team,
    x: spawn.x,
    y: spawn.y,
    rot: 0,
    health: 100,
    score: 0,
    lastActive: now()
  };

  console.log("🟢 Player connected:", id, "team", team);

  // Immediately send authoritative state to the connecting client and broadcast players
  socket.emit("init", { id, players, bullets });
  io.emit("players", players);
  // Also send full 'state' so clients that rely on state get everything
  io.emit("state", { players, bullets });

  // Accept input from client (non-authoritative movement hints)
  socket.on("input", data => {
    const p = players[id];
    if (!p) return;
    p.lastActive = now();
    // apply simple speed move on server side for authoritative effect
    const speed = 4;
    if (data.up) p.y -= speed;
    if (data.down) p.y += speed;
    if (data.left) p.x -= speed;
    if (data.right) p.x += speed;
    if (typeof data.angle === "number") p.rot = data.angle;
    clampToArena(p);
  });

  // Shooting - server creates bullet (server enforces cooldown if you want)
  socket.on("shoot", d => {
    const p = players[id];
    if (!p) return;
    const bid = `b${nextBulletId++}`;
    const angle = (d && typeof d.angle === "number") ? d.angle : (p.rot || 0);
    bullets[bid] = {
      id: bid,
      x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 6),
      y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 6),
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      team: p.team,
      owner: id,
      life: BULLET_LIFE,
      created: now()
    };
    // immediately broadcast new bullet so clients see it right away
    io.emit("bulletsAdd", bullets[bid]);
  });

  socket.on("disconnect", reason => {
    // remove player from authoritative state
    console.log("🔴 Player disconnected:", id, "reason:", reason);
    delete players[id];
    io.emit("players", players);
  });

  // network error logging for debugging
  socket.on("error", err => {
    console.warn("Socket error", id, err);
  });
});

// === Game loop — authoritative update & collisions ===
const TICK_MS = Math.round(1000 / 60);
setInterval(() => {
  // move bullets & collisions
  for (const bid in bullets) {
    const b = bullets[bid];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    // remove when life or out of arena
    if (b.life <= 0 || b.x < -50 || b.x > ARENA.w + 50 || b.y < -50 || b.y > ARENA.h + 50) {
      delete bullets[bid];
      continue;
    }
    // collision with players
    for (const pid in players) {
      const p = players[pid];
      if (!p) continue;
      if (p.team === b.team) continue; // no friendly fire
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if ((dx*dx + dy*dy) < (PLAYER_RADIUS + 6) * (PLAYER_RADIUS + 6)) {
        // hit
        p.health -= 25;
        // award owner score safely
        if (players[b.owner]) players[b.owner].score = (players[b.owner].score || 0) + 1;
        // respawn if dead
        if (p.health <= 0) {
          p.health = 100;
          const sp = randomSpawnInside();
          p.x = sp.x; p.y = sp.y;
        }
        // remove bullet
        delete bullets[bid];
        break;
      }
    }
  }

  // idle-cleanup (optional) — remove players inactive > 5 minutes
  const nowTs = now();
  for (const pid in players) {
    if (nowTs - players[pid].lastActive > 1000 * 60 * 5) {
      console.log("💤 Removing idle player:", pid);
      delete players[pid];
    }
  }

  // broadcast authoritative state snapshot
  io.emit("state", { players, bullets });
}, TICK_MS);

// start server
server.listen(PORT, () => {
  console.log(`🚀 GPTs vs Popcorns server running on port ${PORT} — arena ${ARENA.w}x${ARENA.h}`);
});
