const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let settingsWindow = null;
let calendarWindow = null;
let gameWindow = null;
let tray = null;
let isQuitting = false;
let reminderTimer = null;

const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultConfigPath = path.join(__dirname, 'config.json');
const recordsPath = path.join(app.getPath('userData'), 'records.json');
const holidaysPath = path.join(__dirname, 'data', 'holidays.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  if (fs.existsSync(defaultConfigPath)) {
    const cfg = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    return cfg;
  }
  return null;
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getTrayIcon() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  }
  return nativeImage.createEmpty();
}

function createMainWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 320;
  const winH = 220;

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: screenWidth - winW - 20,
    y: screenHeight - winH - 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setIgnoreMouseEvents(false);

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 560,
    x: Math.round((sw - 520) / 2),
    y: Math.round((sh - 560) / 2),
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'src', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip('MoreMoney - 正在获取大米');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏面板', click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    },
    {
      label: '设置', click: () => { createSettingsWindow(); }
    },
    { type: 'separator' },
    {
      label: '退出', click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// --- Records ---

function loadRecords() {
  try {
    if (fs.existsSync(recordsPath)) {
      return JSON.parse(fs.readFileSync(recordsPath, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveRecords(records) {
  fs.writeFileSync(recordsPath, JSON.stringify(records, null, 2));
}

function loadHolidays() {
  try {
    if (fs.existsSync(holidaysPath)) {
      return JSON.parse(fs.readFileSync(holidaysPath, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function calcWorkHours(config) {
  const workStart = parseTime(config.workStart);
  const workEnd = parseTime(config.workEnd);
  const breaks = config.breaks || [];
  const breakTotal = breaks.reduce((sum, b) => {
    const bStart = Math.max(parseTime(b.start), workStart);
    const bEnd = Math.min(parseTime(b.end), workEnd);
    return sum + Math.max(0, bEnd - bStart);
  }, 0);
  return (workEnd - workStart - breakTotal) / 3600;
}

function calcEarned(config, workHours, multiplier) {
  const perHour = config.monthlySalary / 21.75 / 8;
  return perHour * workHours * (multiplier || 1);
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function autoRecord() {
  const config = loadConfig();
  if (!config) return;

  const records = loadRecords();
  const today = getTodayStr();
  const holidays = loadHolidays();
  const dayOverrides = records.dayOverrides || {};

  // skip creating records for holidays
  const now = new Date();
  if (!isWorkday(now, config.workDays, holidays, dayOverrides)) return;

  if (!records[today]) {
    records[today] = {
      clockIn: config.workStart,
      clockOut: null,
      multiplier: config.overtimeMultiplier || 1,
      breaks: config.breaks || [],
      workHours: 0,
      earned: 0
    };
    saveRecords(records);
  }

  // auto-fill clockOut for past days
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const workEnd = parseTime(config.workEnd);

  for (const dateStr of Object.keys(records)) {
    const rec = records[dateStr];
    if (dateStr < today && rec.clockOut === null) {
      rec.clockOut = config.workEnd;
      const wh = calcWorkHours(config);
      rec.workHours = wh;
      rec.earned = calcEarned(config, wh, rec.multiplier);
    }
  }

  // update today's record if past workEnd
  const todayRec = records[today];
  if (todayRec && todayRec.clockOut === null && currentSeconds >= workEnd) {
    todayRec.clockOut = config.workEnd;
    const wh = calcWorkHours(config);
    todayRec.workHours = wh;
    todayRec.earned = calcEarned(config, wh, todayRec.multiplier);
  }

  saveRecords(records);
}

// --- Calendar Window ---

function createCalendarWindow() {
  if (calendarWindow) {
    calendarWindow.focus();
    return;
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  calendarWindow = new BrowserWindow({
    width: 520,
    height: 640,
    x: Math.round((sw - 520) / 2),
    y: Math.round((sh - 640) / 2),
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  calendarWindow.loadFile(path.join(__dirname, 'src', 'calendar.html'));
  calendarWindow.on('closed', () => { calendarWindow = null; });
}

// --- Game Window ---

function createGameWindow() {
  if (gameWindow) {
    gameWindow.focus();
    return;
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  gameWindow = new BrowserWindow({
    width: 480,
    height: 560,
    x: Math.round((sw - 480) / 2),
    y: Math.round((sh - 560) / 2),
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  gameWindow.loadFile(path.join(__dirname, 'src', 'game', 'game.html'));
  gameWindow.on('closed', () => { gameWindow = null; });
}

// --- Clock-out Reminder ---

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function isWorkday(date, workDays, holidays, dayOverrides) {
  const ds = formatDate(date);
  if (dayOverrides && dayOverrides[ds] !== undefined) {
    return dayOverrides[ds] === 'work';
  }
  const year = ds.substring(0, 4);
  const yearHolidays = holidays[year];
  if (yearHolidays && yearHolidays[ds]) {
    return yearHolidays[ds].type === 'workday';
  }
  const jsDay = date.getDay();
  const mapped = jsDay === 0 ? 7 : jsDay;
  return [1, 2, 3, 4, 5].includes(mapped);
}

function showNotification() {
  const config = loadConfig();
  if (!config) return;

  const eq = config.equivalents[config.selectedEquivalent || 0];
  const workStart = parseTime(config.workStart);
  const workEnd = parseTime(config.workEnd);
  const breaks = config.breaks || [];
  const breakTotal = breaks.reduce((sum, b) => {
    const bStart = Math.max(parseTime(b.start), workStart);
    const bEnd = Math.min(parseTime(b.end), workEnd);
    return sum + Math.max(0, bEnd - bStart);
  }, 0);
  const workSeconds = workEnd - workStart - breakTotal;
  const multiplier = config.overtimeMultiplier || 1;
  const perSecond = config.monthlySalary / 21.75 / 8 / 3600 * multiplier;
  const earned = perSecond * workSeconds;
  const count = (earned / eq.price).toFixed(2);

  new Notification({
    title: '下班啦！',
    body: `今天已赚 ${count} ${eq.icon} ${eq.name}，该收工了 🎉`
  }).show();
}

function scheduleReminder() {
  if (reminderTimer) clearTimeout(reminderTimer);
  const config = loadConfig();
  if (!config || !config.reminderEnabled) return;

  const holidays = loadHolidays();
  const records = loadRecords();
  const dayOverrides = records.dayOverrides || {};
  const [endH, endM] = config.workEnd.split(':').map(Number);
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);

  while (target <= now || !isWorkday(target, config.workDays, holidays, dayOverrides)) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target - now;
  reminderTimer = setTimeout(() => {
    showNotification();
    scheduleReminder();
  }, delay);
}

// IPC handlers
ipcMain.handle('load-config', () => loadConfig());
ipcMain.handle('load-holidays', () => loadHolidays());
ipcMain.handle('save-config', (_e, config) => { saveConfig(config); scheduleReminder(); return true; });
ipcMain.handle('open-settings', () => { createSettingsWindow(); });
ipcMain.handle('open-calendar', () => { createCalendarWindow(); });
ipcMain.handle('open-game', () => { createGameWindow(); });
ipcMain.handle('hide-window', () => { mainWindow.hide(); });
ipcMain.handle('test-reminder', () => { showNotification(); return true; });
ipcMain.handle('load-records', () => loadRecords());
ipcMain.handle('save-record', (_e, date, record) => {
  const records = loadRecords();
  records[date] = record;
  saveRecords(records);
  return true;
});
ipcMain.handle('load-day-overrides', () => {
  const records = loadRecords();
  return records.dayOverrides || {};
});
ipcMain.handle('save-day-overrides', (_e, date, type) => {
  const records = loadRecords();
  if (!records.dayOverrides) records.dayOverrides = {};
  if (type === null) {
    delete records.dayOverrides[date];
  } else {
    records.dayOverrides[date] = type;
  }
  saveRecords(records);
  return records.dayOverrides;
});

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  autoRecord();
  setInterval(autoRecord, 60000); // update today's record every minute
  scheduleReminder();
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => { /* don't quit on window close */ });
