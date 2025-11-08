// server.js
// Authoritative game server for "ChatGPT vs Popcorns"
// Uses Express + socket.io. Keeps authoritative player & bullet state,
// simulates movement & collisions, broadcasts 'state' regularly.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingTimeout: 30000 });

const PORT = process.env.PORT || 3000;

// static serve everything from root (index.html, main.js, style.css)
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- Game configuration ---
const ARENA = { w: 1000, h: 600 };
const PLAYER_RADIUS = 18;
const BULLET_RADIUS = 6;
const PLAYER_SPEED = 220; // pixels per second (server sim)
const BULLET_SPEED = 600; // pixels per second
const BULLET_LIFETIME = 2500; // ms
const TICK_RATE = 60; // server ticks per second
const FIRE_COOLDOWN = 250; // ms between shots per player

// --- Authoritative state ---
const players = {}; // socketId -> player object
const bullets = []; // {id, x,y,vx,vy,owner,team,created}
let nextBulletId = 1;

// --- Helpers ---
function randomSpawn() {
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

// --- Socket handlers ---
io.on('connection', socket => {
  console.log('CONNECT', socket.id);

  // Choose team to balance counts (1 = Popcorns, 2 = ChatGPTs)
  const t1 = Object.values(players).filter(p => p.team === 1).length;
  const t2 = Object.values(players).filter(p => p.team === 2).length;
  const team = t1 <= t2 ? 1 : 2;

  const spawn = randomSpawn();
  players[socket.id] = {
    id: socket.id,
    name: `P_${socket.id.slice(0,4)}`,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    angle: 0,
    team,
    health: 100,
    score: 0,
    lastShot: 0,
    input: { up:false,down:false,left:false,right:false,angle:0 }
  };

  // send init
  socket.emit('init', { id: socket.id, players, bullets });
  // announce to others
  socket.broadcast.emit('players', players);

  // receive input snapshot from client
  socket.on('input', data => {
    const p = players[socket.id];
    if (!p) return;
    // we accept last-known input object (simple)
    p.input = data;
    // store angle for authoritative visuals
    if (typeof data.angle === 'number') p.angle = data.angle;
  });

  // receive shoot request
  socket.on('shoot', data => {
    const p = players[socket.id];
    if (!p) return;
    const nowTs = now();
    if (nowTs - p.lastShot < FIRE_COOLDOWN) return; // rate limit
    p.lastShot = nowTs;

    const angle = (data && typeof data.angle === 'number') ? data.angle : p.angle || 0;
    const bx = p.x + Math.cos(angle) * (PLAYER_RADIUS + 8);
    const by = p.y + Math.sin(angle) * (PLAYER_RADIUS + 8);
    const vx = Math.cos(angle) * BULLET_SPEED;
    const vy = Math.sin(angle) * BULLET_SPEED;
    bullets.push({
      id: nextBulletId++,
      x: bx, y: by, vx, vy,
      owner: socket.id,
      team: p.team,
      created: nowTs
    });
  });

  socket.on('disconnect', () => {
    console.log('DISCONNECT', socket.id);
    delete players[socket.id];
    io.emit('players', players);
  });
});

// --- Server tick: authoritative physics & collisions ---
const MS_PER_TICK = 1000 / TICK_RATE;
setInterval(() => {
  const dt = MS_PER_TICK / 1000; // seconds

  // simulate players from their input (simple acceleration->velocity->pos)
  for (const id in players) {
    const p = players[id];
    const inpt = p.input || {};
    let dx = 0, dy = 0;
    if (inpt.up) dy -= 1;
    if (inpt.down) dy += 1;
    if (inpt.left) dx -= 1;
    if (inpt.right) dx += 1;
    const len = Math.hypot(dx, dy) || 1;
    p.vx = (dx / len) * PLAYER_SPEED;
    p.vy = (dy / len) * PLAYER_SPEED;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // keep angle as stored (clients update it frequently)
    clampToArena(p);
  }

  // update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // lifetime / out of arena removal
    if (now() - b.created > BULLET_LIFETIME || b.x < -50 || b.x > ARENA.w + 50 || b.y < -50 || b.y > ARENA.h + 50) {
      bullets.splice(i, 1);
      continue;
    }
    // collision with players (simple circle)
    for (const pid in players) {
      const p = players[pid];
      if (!p) continue;
      if (p.team === b.team) continue; // no friendly fire
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dist2 = dx*dx + dy*dy;
      const minDist = PLAYER_RADIUS + BULLET_RADIUS;
      if (dist2 < minDist * minDist) {
        // hit
        p.health -= 25;
        // credit score
        const owner = players[b.owner];
        if (owner) owner.score = (owner.score || 0) + 1;
        // remove bullet
        bullets.splice(i, 1);
        // death & respawn
        if (p.health <= 0) {
          p.health = 100;
          const sp = randomSpawn();
          p.x = sp.x; p.y = sp.y;
          p.vx = p.vy = 0;
        }
        break;
      }
    }
  }

  // broadcast authoritative state snapshots
  io.emit('state', { players, bullets });
}, MS_PER_TICK);

// --- start server ---
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (arena ${ARENA.w}x${ARENA.h})`);
});
