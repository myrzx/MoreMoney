const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  loadHolidays: () => ipcRenderer.invoke('load-holidays'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  openCalendar: () => ipcRenderer.invoke('open-calendar'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  testReminder: () => ipcRenderer.invoke('test-reminder'),
  loadRecords: () => ipcRenderer.invoke('load-records'),
  saveRecord: (date, record) => ipcRenderer.invoke('save-record', date, record),
  loadDayOverrides: () => ipcRenderer.invoke('load-day-overrides'),
  saveDayOverrides: (date, type) => ipcRenderer.invoke('save-day-overrides', date, type)
});
