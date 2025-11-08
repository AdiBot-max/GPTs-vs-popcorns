const socket = io("https://gpts-vs-popcorns-1.onrender.com");
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreboard = document.getElementById('scoreboard');
const fullBtn = document.getElementById('fullscreenBtn');

let myId = null;
let players = {};
let bullets = [];

let inputState = { up:false, down:false, left:false, right:false, angle:0 };
const keys = {};

function sendInput() { socket.emit('input', inputState); }

// Fullscreen
function toggleFullscreen() {
  if (!document.fullscreenElement) canvas.requestFullscreen().catch(()=>{});
  else document.exitFullscreen().catch(()=>{});
}
fullBtn.onclick = toggleFullscreen;
window.addEventListener('keydown', e => {
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
});

// Controls
window.addEventListener('keydown', e => {
  if (['w','a','s','d','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','g','G'].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
  if (e.key === 'g' || e.key === 'G') shoot();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const me = players[myId];
  if (me) inputState.angle = Math.atan2(my - me.y, mx - me.x);
});

canvas.addEventListener('click', shoot);

function shoot() {
  const me = players[myId];
  if (!me) return;
  socket.emit('shoot', { angle: inputState.angle });
}

socket.on('init', data => {
  myId = data.id;
  players = data.players || {};
  bullets = data.bullets || [];
});

socket.on('players', data => { players = data; });
socket.on('state', data => { players = data.players; bullets = data.bullets; });

function updateInputFromKeys() {
  inputState.up = keys['w'] || keys['ArrowUp'];
  inputState.down = keys['s'] || keys['ArrowDown'];
  inputState.left = keys['a'] || keys['ArrowLeft'];
  inputState.right = keys['d'] || keys['ArrowRight'];
}

function draw() {
  updateInputFromKeys();
  sendInput();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background grid
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let x=0;x<canvas.width;x+=40) ctx.fillRect(x,0,1,canvas.height);
  for (let y=0;y<canvas.height;y+=40) ctx.fillRect(0,y,canvas.width,1);
  ctx.restore();

  // bullets
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI*2);
    ctx.fillStyle = b.team===1 ? 'rgba(246,195,90,0.95)' : 'rgba(110,231,183,0.95)';
    ctx.fill();
  });

  // players
  Object.values(players).forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI*2);
    ctx.fillStyle = p.team===1 ? '#f6c35a' : '#6ee7b7';
    ctx.fill();

    // eyes
    ctx.fillStyle = '#111827';
    ctx.fillRect(-6,-6,4,4);
    ctx.fillRect(4,-6,4,4);

    // sword
    ctx.beginPath();
    ctx.rect(14, -3, 16, 6);
    ctx.fillStyle = '#d9d9e0';
    ctx.fill();

    ctx.restore();

    // health bar
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x - 20, p.y - 30, 40, 6);
    ctx.fillStyle = 'lime';
    ctx.fillRect(p.x - 20, p.y - 30, 40 * (p.health/100), 6);

    // name
    ctx.fillStyle = '#e6eef8';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name + (p.id===myId ? ' (you)' : ''), p.x, p.y + 28);
  });

  const t1Score = Object.values(players).filter(p=>p.team===1).reduce((s,p)=>s+p.score,0);
  const t2Score = Object.values(players).filter(p=>p.team===2).reduce((s,p)=>s+p.score,0);
  scoreboard.innerHTML = `Popcorns: ${t1Score} | ChatGPTs: ${t2Score}`;

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function resizeCanvas() {
  const scale = Math.min(window.innerWidth / 1100, window.innerHeight / 700, 1);
  canvas.style.width = (canvas.width * scale) + 'px';
  canvas.style.height = (canvas.height * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
