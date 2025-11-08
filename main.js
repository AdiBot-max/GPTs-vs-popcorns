// main.js (client)
// Connects to same origin socket.io served by the server
const socket = io(); // expects /socket.io/socket.io.js already included in index.html
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// fixed logical canvas size matching server arena
const ARENA = { w: 1000, h: 600 };
canvas.width = ARENA.w;
canvas.height = ARENA.h;

const scoreboard = document.getElementById('scoreboard');
const fullBtn = document.getElementById('fullscreenBtn');

// client-side state
let myId = null;
let players = {};
let bullets = [];
let keys = {};
let inputState = { up:false,down:false,left:false,right:false,angle:0 };

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// --- input handling ---
window.addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','g','G','f','F'].includes(k)) e.preventDefault();
  keys[k.toLowerCase()] = true;
  if (k === 'g' || k === 'G') doShoot();
  if (k === 'f' || k === 'F') toggleFullscreen();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// mouse aim
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const me = players[myId];
  if (me) {
    inputState.angle = Math.atan2(my - me.y, mx - me.x);
  } else {
    // fallback aim relative to center
    inputState.angle = Math.atan2(my - (canvas.height/2), mx - (canvas.width/2));
  }
});
canvas.addEventListener('click', doShoot);

// fullscreen helper
function toggleFullscreen() {
  if (!document.fullscreenElement) canvas.requestFullscreen().catch(()=>{});
  else document.exitFullscreen().catch(()=>{});
}

// --- network events ---
socket.on('init', data => {
  myId = data.id;
  players = data.players || {};
  bullets = data.bullets || [];
});

socket.on('state', data => {
  players = data.players || {};
  bullets = data.bullets || [];
});

socket.on('players', data => { players = data; });

// --- shooting ---
function doShoot() {
  // send angle to server, server enforces cooldown
  socket.emit('shoot', { angle: inputState.angle });
}

// --- send inputs at regular frequency (client -> server) ---
setInterval(() => {
  // map keys to movement booleans
  inputState.up = keys['w'] || keys['arrowup'] || false;
  inputState.down = keys['s'] || keys['arrowdown'] || false;
  inputState.left = keys['a'] || keys['arrowleft'] || false;
  inputState.right = keys['d'] || keys['arrowright'] || false;
  socket.emit('input', inputState);
}, 1000/30);

// --- drawing ---
function drawGrid() {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#ffffff';
  for (let x=0;x<canvas.width;x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
  for (let y=0;y<canvas.height;y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // background
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  drawGrid();

  // bullets
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI*2);
    ctx.fillStyle = b.team === 1 ? 'rgba(246,195,90,0.95)' : 'rgba(110,231,183,0.95)';
    ctx.fill();
  });

  // players
  Object.values(players).forEach(p => {
    // clamp defensive draw in case server sent slightly out-of-bounds
    const px = clamp(p.x, PLAYER_CLAMP_MIN(), ARENA.w - PLAYER_CLAMP_MIN());
    const py = clamp(p.y, PLAYER_CLAMP_MIN(), ARENA.h - PLAYER_CLAMP_MIN());

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.angle || 0);
    // body
    ctx.beginPath();
    ctx.arc(0,0,18,0,Math.PI*2);
    ctx.fillStyle = p.team === 1 ? '#f6c35a' : '#6ee7b7';
    ctx.shadowColor = p.team === 1 ? '#f6c35a' : '#6ee7b7';
    ctx.shadowBlur = 12;
    ctx.fill();
    // sword
    ctx.fillStyle = '#d9d9e0';
    ctx.fillRect(14, -3, 16, 6);
    ctx.restore();

    // health bar
    ctx.fillStyle = '#222';
    ctx.fillRect(px - 20, py - 30, 40, 6);
    ctx.fillStyle = '#00ff66';
    const healthWidth = Math.max(0, (p.health || 100) / 100) * 40;
    ctx.fillRect(px - 20, py - 30, healthWidth, 6);

    // name
    ctx.fillStyle = '#e6eef8';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || p.id, px, py + 28);
  });

  // scoreboard
  const t1Score = Object.values(players).filter(p => p.team === 1).reduce((s,p)=>s+(p.score||0),0);
  const t2Score = Object.values(players).filter(p => p.team === 2).reduce((s,p)=>s+(p.score||0),0);
  if (scoreboard) scoreboard.innerHTML = `Popcorns: ${t1Score} | ChatGPTs: ${t2Score}`;

  requestAnimationFrame(draw);
}
function PLAYER_CLAMP_MIN() { return 20; }

requestAnimationFrame(draw);

// expose a small debug helper to console if needed
window.__game_debug = {
  playersRef: () => players,
  bulletsRef: () => bullets,
};
