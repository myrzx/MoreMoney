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

function getBreakTotal(config, workStart, workEnd) {
  const breaks = config.breaks || [];
  return breaks.reduce((sum, b) => {
    const bStart = Math.max(parseTime(b.start), workStart);
    const bEnd = Math.min(parseTime(b.end), workEnd);
    return sum + Math.max(0, bEnd - bStart);
  }, 0);
}

function getElapsedBreakSeconds(config, currentSeconds, workStart, workEnd) {
  const breaks = config.breaks || [];
  let total = 0;
  for (const b of breaks) {
    const bStart = Math.max(parseTime(b.start), workStart);
    const bEnd = Math.min(parseTime(b.end), workEnd);
    if (currentSeconds >= bEnd) {
      total += bEnd - bStart;
    } else if (currentSeconds > bStart) {
      total += currentSeconds - bStart;
    }
  }
  return total;
}

function getCurrentBreak(config, currentSeconds) {
  const breaks = config.breaks || [];
  for (const b of breaks) {
    const bStart = parseTime(b.start);
    const bEnd = parseTime(b.end);
    if (currentSeconds >= bStart && currentSeconds < bEnd) {
      return b;
    }
  }
  return null;
}

function getTodayWorkSeconds(config) {
  const now = new Date();
  const workStart = parseTime(config.workStart);
  const workEnd = parseTime(config.workEnd);
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const breakTotal = getBreakTotal(config, workStart, workEnd);
  const totalWork = workEnd - workStart - breakTotal;

  if (!isWorkday(now, config.workDays)) {
    return { status: 'holiday', elapsed: 0, total: totalWork };
  }

  if (currentSeconds < workStart) {
    return { status: 'before', elapsed: 0, total: totalWork };
  }

  if (currentSeconds >= workEnd) {
    return { status: 'after', elapsed: totalWork, total: totalWork };
  }

  const brk = getCurrentBreak(config, currentSeconds);
  if (brk) {
    const elapsed = currentSeconds - workStart - getElapsedBreakSeconds(config, currentSeconds, workStart, workEnd);
    return { status: 'break', elapsed, total: totalWork, breakName: brk.name || '休息' };
  }

  const elapsed = currentSeconds - workStart - getElapsedBreakSeconds(config, currentSeconds, workStart, workEnd);
  return { status: 'working', elapsed, total: totalWork };
}

function calcPerSecondRate(config) {
  const workDaysPerMonth = 21.75;
  const workHoursPerDay = 8;
  const multiplier = config.overtimeMultiplier || 1;
  return config.monthlySalary / workDaysPerMonth / workHoursPerDay / 3600 * multiplier;
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function updateMultiplierDisplay() {
  const m = config.overtimeMultiplier || 1;
  elMultiplierTag.textContent = m + 'x';
  elMultiplierTag.className = 'multiplier-tag x' + m;
}

// --- UI State ---

let config = null;
let perSecondRate = 0;
let currentAmount = 0;
let equivalentIndex = 0;
let displayAmount = 0;
let lastTick = Date.now();
let particles = [];

const MAX_PARTICLES = 200;

// --- DOM Elements ---

const elAmount = document.getElementById('amountValue');
const elUnit = document.getElementById('amountUnit');
const elIcon = document.getElementById('eqIcon');
const elEqName = document.getElementById('eqName');
const elStatusDot = document.getElementById('statusDot');
const elStatusText = document.getElementById('statusText');
const elMultiplierTag = document.getElementById('multiplierTag');
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
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

function spawnParticle() {
  return {
    x: Math.random() * 320,
    y: 220 + Math.random() * 20,
    size: Math.floor(Math.random() * 2) + 2,
    speed: Math.random() * 0.6 + 0.2,
    opacity: Math.random() * 0.5 + 0.2,
    drift: (Math.random() - 0.5) * 0.3
  };
}

function updateParticles(workState, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.y -= p.speed;
    p.x += p.drift;
    p.opacity -= 0.002;
    if (p.y < -10 || p.opacity <= 0) {
      particles.splice(i, 1);
    }
  }
  // skip spawning after long pause (sleep/wake) to prevent burst
  if (dt < 1 && particles.length < MAX_PARTICLES) {
    const spawnRate = workState.status === 'working' ? 0.5 : 0.05;
    if (Math.random() < spawnRate) {
      particles.push(spawnParticle());
    }
  }
}

function drawParticles(workState) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const baseColor = workState.status === 'working' ? '230, 184, 0' : '138, 138, 154';
  for (const p of particles) {
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = `rgb(${baseColor})`;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// --- Amount Display ---

function updateDisplay() {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // update accumulation
  const workState = getTodayWorkSeconds(config);
  if (workState.status === 'working' && dt > 0 && dt < 10) {
    currentAmount += perSecondRate * dt;
  }

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
    elAmount.style.textShadow = `2px 2px 0 #000, 0 0 8px rgba(230, 184, 0, 0.8)`;
    setTimeout(() => {
      elAmount.style.textShadow = `2px 2px 0 #000`;
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
    case 'break':
      elStatusText.textContent = '🍵 ' + (workState.breakName || '休息中');
      elStatusTime.textContent = secondsToHMS(workState.elapsed);
      break;
  }

  updateParticles(workState, dt);
  drawParticles(workState);
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

  // Reset overtime multiplier to 1x on new day
  const today = getTodayStr();
  if (config.overtimeMultiplierDate !== today) {
    config.overtimeMultiplier = 1;
    config.overtimeMultiplierDate = today;
    window.electronAPI.saveConfig(config);
  }

  perSecondRate = calcPerSecondRate(config);
  equivalentIndex = config.selectedEquivalent || 0;
  updateMultiplierDisplay();
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

  // Cycle overtime multiplier on click
  elMultiplierTag.addEventListener('click', () => {
    const m = config.overtimeMultiplier || 1;
    config.overtimeMultiplier = m >= 3 ? 1 : m + 1;
    config.overtimeMultiplierDate = getTodayStr();
    window.electronAPI.saveConfig(config);
    perSecondRate = calcPerSecondRate(config);
    resetAccumulation();
    updateMultiplierDisplay();
  });

  elBtnSettings.addEventListener('click', () => window.electronAPI.openSettings());
  elBtnHide.addEventListener('click', () => window.electronAPI.hideWindow());

  lastTick = Date.now();
  setInterval(updateDisplay, 100);
  setInterval(resetAccumulation, 60000); // recalculate every minute to stay accurate

  // Pause CSS animations when window is hidden
  document.addEventListener('visibilitychange', () => {
    document.getElementById('app').classList.toggle('paused', document.hidden);
  });
}

async function reloadConfig() {
  const newConfig = await window.electronAPI.loadConfig();
  if (!newConfig) return;
  config = newConfig;
  perSecondRate = calcPerSecondRate(config);
  equivalentIndex = config.selectedEquivalent || 0;
  updateMultiplierDisplay();
  resetAccumulation();
}

// Reload config when focus returns (settings might have changed)
window.addEventListener('focus', () => reloadConfig());

init();
