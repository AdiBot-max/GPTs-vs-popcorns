const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;

const players = {};
const bullets = [];
const WORLD_SIZE = { w: 2000, h: 1500 };

io.on('connection', socket => {
  console.log('Player connected:', socket.id);

  const team = Object.keys(players).length % 2 === 0 ? 1 : 2;
  players[socket.id] = {
    id: socket.id,
    name: team === 1 ? '🍿 Popcorn' : '🤖 ChatGPT',
    x: Math.random() * WORLD_SIZE.w,
    y: Math.random() * WORLD_SIZE.h,
    rot: 0,
    health: 100,
    team,
    score: 0,
  };

  socket.emit('init', { id: socket.id, players, bullets });
  io.emit('players', players);

  socket.on('input', data => {
    const p = players[socket.id];
    if (!p) return;
    const speed = 4;
    if (data.up) p.y -= speed;
    if (data.down) p.y += speed;
    if (data.left) p.x -= speed;
    if (data.right) p.x += speed;
    p.rot = data.angle;
  });

  socket.on('shoot', ({ angle }) => {
    const p = players[socket.id];
    if (!p) return;
    bullets.push({
      id: uuidv4(),
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * 8,
      vy: Math.sin(angle) * 8,
      team: p.team,
      owner: socket.id,
    });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('players', players);
  });
});

setInterval(() => {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < 0 || b.x > WORLD_SIZE.w || b.y < 0 || b.y > WORLD_SIZE.h) {
      bullets.splice(i, 1);
      continue;
    }
    for (const pid in players) {
      const p = players[pid];
      if (p.team === b.team) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (dx * dx + dy * dy < 30 * 30) {
        p.health -= 40;
        bullets.splice(i, 1);
        if (p.health <= 0) {
          p.health = 100;
          p.x = Math.random() * WORLD_SIZE.w;
          p.y = Math.random() * WORLD_SIZE.h;
          players[b.owner].score++;
        }
        break;
      }
    }
  }

  io.emit('state', { players, bullets });
}, 1000 / 30);

server.listen(PORT, () => {
  console.log(`ChatGPT vs Popcorns running on http://localhost:${PORT}`);
});
