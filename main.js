const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;
let reminderTimer = null;

const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultConfigPath = path.join(__dirname, 'config.json');

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
    width: 460,
    height: 560,
    x: Math.round((sw - 460) / 2),
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
  tray.setToolTip('MoreMoney - 正在计算薪资...');

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

// --- Clock-out Reminder ---

function isWorkday(date, workDays) {
  const jsDay = date.getDay();
  const mapped = jsDay === 0 ? 7 : jsDay;
  return workDays.includes(mapped);
}

function showNotification() {
  const config = loadConfig();
  if (!config) return;
  const eq = config.equivalents[config.selectedEquivalent || 0];
  new Notification({
    title: '下班啦！',
    body: `到点了，该收工了 🏁 今天已赚 ${eq.icon} ${eq.name}`
  }).show();
}

function scheduleReminder() {
  if (reminderTimer) clearTimeout(reminderTimer);
  const config = loadConfig();
  if (!config) return;

  const [endH, endM] = config.workEnd.split(':').map(Number);
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);

  while (target <= now || !isWorkday(target, config.workDays)) {
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
ipcMain.handle('save-config', (_e, config) => { saveConfig(config); scheduleReminder(); return true; });
ipcMain.handle('open-settings', () => { createSettingsWindow(); });
ipcMain.handle('hide-window', () => { mainWindow.hide(); });

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  scheduleReminder();
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => { /* don't quit on window close */ });
