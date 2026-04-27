// --- Salary Engine ---

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60;
}

function secondsToHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isWorkday(date, workDays) {
  // workDays: [1,2,3,4,5] = Mon-Fri
  // JS: 0=Sun, 1=Mon, ... -> map: Mon=1 -> JS 1
  const jsDay = date.getDay();
  const mapped = jsDay === 0 ? 7 : jsDay; // Sun=7, Mon=1, ..., Sat=6
  return workDays.includes(mapped);
}

function getTodayWorkSeconds(config) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const workStart = parseTime(config.workStart);
  const workEnd = parseTime(config.workEnd);
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  if (!isWorkday(now, config.workDays)) {
    return { status: 'holiday', elapsed: 0, total: workEnd - workStart };
  }

  if (currentSeconds < workStart) {
    return { status: 'before', elapsed: 0, total: workEnd - workStart };
  }

  if (currentSeconds >= workEnd) {
    return { status: 'after', elapsed: workEnd - workStart, total: workEnd - workStart };
  }

  return { status: 'working', elapsed: currentSeconds - workStart, total: workEnd - workStart };
}

function calcPerSecondRate(config) {
  const workDaysPerMonth = 21.75;
  const workHoursPerDay = 8;
  return config.monthlySalary / workDaysPerMonth / workHoursPerDay / 3600;
}

// --- UI State ---

let config = null;
let perSecondRate = 0;
let currentAmount = 0;
let equivalentIndex = 0;
let displayAmount = 0;
let lastTick = Date.now();
let particles = [];

// --- DOM Elements ---

const elAmount = document.getElementById('amountValue');
const elUnit = document.getElementById('amountUnit');
const elIcon = document.getElementById('eqIcon');
const elEqName = document.getElementById('eqName');
const elStatusDot = document.getElementById('statusDot');
const elStatusText = document.getElementById('statusText');
const elStatusTime = document.getElementById('statusTime');
const elProgressFill = document.getElementById('progressFill');
const elProgressPercent = document.getElementById('progressPercent');
const elProgressStart = document.getElementById('progressStart');
const elProgressEnd = document.getElementById('progressEnd');
const elDragBar = document.getElementById('dragBar');
const elBtnSettings = document.getElementById('btnSettings');
const elBtnHide = document.getElementById('btnHide');
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

// --- Particle System ---

function resizeCanvas() {
  canvas.width = 320;
  canvas.height = 220;
}

function spawnParticle() {
  return {
    x: Math.random() * 320,
    y: 220 + Math.random() * 20,
    size: Math.random() * 1.8 + 0.4,
    speed: Math.random() * 0.6 + 0.2,
    opacity: Math.random() * 0.5 + 0.2,
    drift: (Math.random() - 0.5) * 0.3
  };
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.y -= p.speed;
    p.x += p.drift;
    p.opacity -= 0.002;
    if (p.y < -10 || p.opacity <= 0) {
      particles.splice(i, 1);
    }
  }
  // spawn new particles based on status
  const workState = getTodayWorkSeconds(config);
  const spawnRate = workState.status === 'working' ? 0.5 : 0.05;
  if (Math.random() < spawnRate) {
    particles.push(spawnParticle());
  }
}

function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    ctx.beginPath();
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
    const baseColor = config && getTodayWorkSeconds(config).status === 'working'
      ? '34, 211, 238' : '107, 114, 128';
    gradient.addColorStop(0, `rgba(${baseColor}, ${p.opacity})`);
    gradient.addColorStop(1, `rgba(${baseColor}, 0)`);
    ctx.fillStyle = gradient;
    ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Amount Display ---

function updateDisplay() {
  const now = Date.now();

  // update accumulation
  const workState = getTodayWorkSeconds(config);
  if (workState.status === 'working') {
    const dt = (now - lastTick) / 1000;
    if (dt > 0 && dt < 10) {
      currentAmount += perSecondRate * dt;
    }
  }
  lastTick = now;

  // smoothly animate to currentAmount
  const lerpSpeed = 0.08;
  displayAmount += (currentAmount - displayAmount) * lerpSpeed;

  // avoid tiny jitter
  if (Math.abs(currentAmount - displayAmount) < 0.0001) {
    displayAmount = currentAmount;
  }

  const eq = config.equivalents[equivalentIndex];
  const eqValue = displayAmount / eq.price;

  // flash effect when digits change
  const oldStr = elAmount.textContent;
  const newStr = eqValue.toFixed(6);
  if (oldStr !== newStr && oldStr !== '0.000000') {
    elAmount.style.textShadow = `0 0 30px rgba(251, 191, 36, 0.9), 0 0 60px rgba(251, 191, 36, 0.5), 0 2px 4px rgba(0,0,0,0.5)`;
    setTimeout(() => {
      elAmount.style.textShadow = `0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.3), 0 2px 4px rgba(0,0,0,0.5)`;
    }, 100);
  }

  elAmount.textContent = newStr;
  elIcon.textContent = eq.icon;
  elEqName.textContent = eq.name;

  // progress bar
  const pct = workState.total > 0 ? (workState.elapsed / workState.total * 100) : 0;
  elProgressFill.style.width = `${Math.min(pct, 100)}%`;
  elProgressPercent.textContent = `${Math.round(pct)}%`;

  // status
  elStatusDot.className = 'status-dot ' + workState.status;
  elProgressStart.textContent = config.workStart;
  elProgressEnd.textContent = config.workEnd;

  switch (workState.status) {
    case 'working':
      elStatusText.textContent = '⛏ 挖矿中';
      elStatusTime.textContent = secondsToHMS(workState.elapsed);
      break;
    case 'before':
      elStatusText.textContent = '⏳ 等待开工';
      elStatusTime.textContent = config.workStart;
      break;
    case 'after':
      elStatusText.textContent = '🏁 收工';
      const eqAfter = config.equivalents[equivalentIndex];
      elStatusTime.textContent = `已赚 ${(currentAmount / eqAfter.price).toFixed(2)} ${eqAfter.name}`;
      break;
    case 'holiday':
      elStatusText.textContent = '🌴 休息日';
      elStatusTime.textContent = '今天不赚钱';
      break;
  }

  updateParticles();
  drawParticles();
}

// --- Init ---

function resetAccumulation() {
  const workState = getTodayWorkSeconds(config);
  currentAmount = perSecondRate * workState.elapsed;
  displayAmount = currentAmount;
  lastTick = Date.now();
}

async function init() {
  config = await window.electronAPI.loadConfig();
  if (!config) return;

  perSecondRate = calcPerSecondRate(config);
  equivalentIndex = config.selectedEquivalent || 0;
  resetAccumulation();

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Cycle equivalents on icon click
  elIcon.addEventListener('click', () => {
    equivalentIndex = (equivalentIndex + 1) % config.equivalents.length;
    config.selectedEquivalent = equivalentIndex;
    window.electronAPI.saveConfig(config);
    elIcon.style.transform = 'scale(1.4) rotate(15deg)';
    setTimeout(() => { elIcon.style.transform = ''; }, 200);
  });
  elIcon.style.cursor = 'pointer';
  elIcon.title = '点击切换等价物';

  elBtnSettings.addEventListener('click', () => window.electronAPI.openSettings());
  elBtnHide.addEventListener('click', () => window.electronAPI.hideWindow());

  setInterval(updateDisplay, 100);
  setInterval(resetAccumulation, 60000); // recalculate every minute to stay accurate

  // Listen for config updates from settings window
  window.addEventListener('storage', async () => {
    config = await window.electronAPI.loadConfig();
    perSecondRate = calcPerSecondRate(config);
    equivalentIndex = config.selectedEquivalent || 0;
    resetAccumulation();
  });
}

// Reload config when focus returns (settings might have changed)
window.addEventListener('focus', async () => {
  const newConfig = await window.electronAPI.loadConfig();
  if (JSON.stringify(newConfig) !== JSON.stringify(config)) {
    config = newConfig;
    perSecondRate = calcPerSecondRate(config);
    equivalentIndex = config.selectedEquivalent || 0;
    resetAccumulation();
  }
});

init();
