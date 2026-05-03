let currentYear, currentMonth; // 0-indexed month
let records = {};
let config = null;
let holidays = {};
let dayOverrides = {};
let activePopup = null;

const elMonthTitle = document.getElementById('monthTitle');
const elCalendarGrid = document.getElementById('calendarGrid');
const elSumDays = document.getElementById('sumDays');
const elSumHours = document.getElementById('sumHours');
const elSumOvertime = document.getElementById('sumOvertime');
const elSumAvgHours = document.getElementById('sumAvgHours');

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dateStr(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function getNowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function getHolidayInfo(ds) {
  const year = ds.substring(0, 4);
  const yearHolidays = holidays[year];
  return yearHolidays ? yearHolidays[ds] : null;
}

function isEffectiveWorkday(ds, workDays, overrides) {
  if (overrides && overrides[ds] !== undefined) {
    return overrides[ds] === 'work';
  }
  const info = getHolidayInfo(ds);
  if (info) return info.type === 'workday';
  const jsDay = new Date(ds).getDay();
  const mapped = jsDay === 0 ? 7 : jsDay;
  return [1, 2, 3, 4, 5].includes(mapped);
}

function renderCalendar() {
  elMonthTitle.textContent = `${currentYear}年${currentMonth + 1}月`;

  const firstDay = new Date(currentYear, currentMonth, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = getTodayStr();

  let html = '';
  let totalDays = 0, totalHours = 0;

  for (let i = 0; i < startDay; i++) {
    html += '<div class="cal-cell empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(currentYear, currentMonth, d);
    const holidayInfo = getHolidayInfo(ds);
    const isWorkday = isEffectiveWorkday(ds, null, dayOverrides);
    const isToday = ds === today;
    const rec = records[ds];

    let cls = 'cal-cell';
    if (isToday) cls += ' today';

    if (holidayInfo && holidayInfo.type === 'holiday') {
      cls += ' holiday';
    } else if (holidayInfo && holidayInfo.type === 'workday') {
      cls += ' tiaoxiu';
    } else if (!isWorkday) {
      cls += ' weekend';
    }

    const override = dayOverrides[ds];
    if (override === 'work') cls += ' override-work';
    if (override === 'rest') cls += ' override-rest';

    let content = `<span class="cal-date">${d}</span>`;

    if (holidayInfo && holidayInfo.type === 'holiday') {
      content += `<span class="cal-holiday">${holidayInfo.name}</span>`;
    } else if (holidayInfo && holidayInfo.type === 'workday') {
      content += `<span class="cal-tiaoxiu">${holidayInfo.name}</span>`;
    }

    if (isWorkday && rec) {
      const wh = rec.workHours || 0;
      if (wh > 0) {
        const timeStr = `${rec.clockIn || ''}-${rec.clockOut || ''}`;
        content += `<span class="cal-time">${timeStr}</span>`;
        const hoursClass = wh > 8 ? 'cal-overtime' : (wh < 8 ? 'cal-undertime' : 'cal-hours');
        content += `<span class="${hoursClass}">${wh.toFixed(1)}h</span>`;
        totalDays++;
        totalHours += wh;
      } else if (rec.clockIn && !rec.clockOut) {
        content += `<span class="cal-time">${rec.clockIn}-</span>`;
        content += '<span class="cal-active">进行中</span>';
      }
    } else if (isWorkday && !rec) {
      if (ds < today) {
        cls += ' no-record';
      }
    }

    html += `<div class="${cls}" data-date="${ds}" data-is-workday="${isWorkday}">${content}</div>`;
  }

  elCalendarGrid.innerHTML = html;

  // bind events on calendar cells
  elCalendarGrid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    const ds = cell.dataset.date;

    // left-click popup only for workdays
    if (cell.dataset.isWorkday === 'true') {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        showClockPopup(ds, cell);
      });
    }

    // right-click context menu for all cells
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(ds, cell.dataset.isWorkday === 'true', e.clientX, e.clientY);
    });
  });

  const avgHours = totalDays > 0 ? totalHours / totalDays : 0;
  const donated = totalHours - totalDays * 8;
  elSumDays.textContent = `${totalDays} 天`;
  elSumHours.textContent = `${totalHours.toFixed(1)} 小时`;
  elSumOvertime.textContent = `${donated.toFixed(1)} 小时`;
  elSumAvgHours.textContent = `${avgHours.toFixed(1)} 小时`;
}

function closePopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}

function showClockPopup(ds, cellEl) {
  closePopup();

  const rec = records[ds] || {};
  const nowTime = getNowTimeStr();

  const popup = document.createElement('div');
  popup.className = 'clock-popup';
  popup.innerHTML = `
    <div class="clock-row">
      <span class="clock-label">上班</span>
      <input type="time" class="clock-input" id="popupClockIn" value="${rec.clockIn || nowTime}">
      <button class="clock-btn" data-field="clockIn">保存</button>
    </div>
    <div class="clock-row">
      <span class="clock-label">下班</span>
      <input type="time" class="clock-input" id="popupClockOut" value="${rec.clockOut || nowTime}">
      <button class="clock-btn" data-field="clockOut">保存</button>
    </div>
  `;

  // position popup near the cell
  const gridRect = elCalendarGrid.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.left = `${cellRect.left}px`;
  popup.style.top = `${cellRect.bottom + 4}px`;

  document.body.appendChild(popup);
  activePopup = popup;

  // adjust if popup goes off screen
  requestAnimationFrame(() => {
    const pr = popup.getBoundingClientRect();
    if (pr.right > window.innerWidth) {
      popup.style.left = `${window.innerWidth - pr.width - 8}px`;
    }
    if (pr.bottom > window.innerHeight) {
      popup.style.top = `${cellRect.top - pr.height - 4}px`;
    }
  });

  // save buttons
  popup.querySelectorAll('.clock-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const field = btn.dataset.field;
      const input = popup.querySelector(field === 'clockIn' ? '#popupClockIn' : '#popupClockOut');
      const timeVal = input.value;
      if (!timeVal) return;

      const existing = records[ds] || {};
      const updated = {
        clockIn: existing.clockIn || null,
        clockOut: existing.clockOut || null,
        multiplier: existing.multiplier || (config ? config.overtimeMultiplier : 1),
        breaks: existing.breaks || (config ? config.breaks : []),
        workHours: 0,
        earned: 0,
        ...existing
      };
      updated[field] = timeVal;

      // recalculate workHours
      if (updated.clockIn && updated.clockOut) {
        const [inH, inM] = updated.clockIn.split(':').map(Number);
        const [outH, outM] = updated.clockOut.split(':').map(Number);
        const inSec = inH * 3600 + inM * 60;
        const outSec = outH * 3600 + outM * 60;
        const breaks = updated.breaks || [];
        const breakTotal = breaks.reduce((sum, b) => {
          const bStart = Math.max(parseTime(b.start), inSec);
          const bEnd = Math.min(parseTime(b.end), outSec);
          return sum + Math.max(0, bEnd - bStart);
        }, 0);
        updated.workHours = Math.max(0, (outSec - inSec - breakTotal) / 3600);
      }

      await window.electronAPI.saveRecord(ds, updated);
      records[ds] = updated;
      closePopup();
      renderCalendar();
    });
  });

  // close on outside click
  setTimeout(() => {
    document.addEventListener('click', onDocClick);
  }, 0);
}

function onDocClick(e) {
  if (activePopup && !activePopup.contains(e.target)) {
    closePopup();
    document.removeEventListener('click', onDocClick);
  }
}

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60;
}

// --- Context Menu ---

let activeContextMenu = null;

function closeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

function createMenuItem(icon, label, onClick) {
  const item = document.createElement('div');
  item.className = 'context-menu-item';
  item.innerHTML = `<span>${icon}</span><span>${label}</span>`;
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
    closeContextMenu();
  });
  return item;
}

function showContextMenu(ds, isCurrentlyWorkday, x, y) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  if (isCurrentlyWorkday) {
    menu.appendChild(createMenuItem('🏖', '标记为休息日', () => saveOverride(ds, 'rest')));
  } else {
    menu.appendChild(createMenuItem('⛏', '标记为工作日', () => saveOverride(ds, 'work')));
  }

  if (dayOverrides[ds]) {
    const sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    menu.appendChild(sep);
    menu.appendChild(createMenuItem('↩', '恢复默认', () => saveOverride(ds, null)));
  }

  document.body.appendChild(menu);
  activeContextMenu = menu;

  requestAnimationFrame(() => {
    const mr = menu.getBoundingClientRect();
    if (mr.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - mr.width - 4}px`;
    }
    if (mr.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - mr.height - 4}px`;
    }
  });

  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true });
    document.addEventListener('contextmenu', closeContextMenu, { once: true });
  }, 0);
}

async function saveOverride(ds, type) {
  dayOverrides = await window.electronAPI.saveDayOverrides(ds, type);
  renderCalendar();
}

function navigateMonth(delta) {
  currentMonth += delta;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  closePopup();
  renderCalendar();
}

async function init() {
  config = await window.electronAPI.loadConfig();
  records = await window.electronAPI.loadRecords();
  holidays = await window.electronAPI.loadHolidays() || {};
  dayOverrides = await window.electronAPI.loadDayOverrides() || {};

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  renderCalendar();

  document.getElementById('btnPrevMonth').addEventListener('click', () => navigateMonth(-1));
  document.getElementById('btnNextMonth').addEventListener('click', () => navigateMonth(1));
  document.getElementById('btnClose').addEventListener('click', () => window.close());
}

init();
