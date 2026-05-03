let currentYear, currentMonth; // 0-indexed month
let records = {};
let config = null;

const elMonthTitle = document.getElementById('monthTitle');
const elCalendarGrid = document.getElementById('calendarGrid');
const elSumDays = document.getElementById('sumDays');
const elSumHours = document.getElementById('sumHours');
const elSumEarned = document.getElementById('sumEarned');
const elSumAvg = document.getElementById('sumAvg');

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dateStr(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function renderCalendar() {
  elMonthTitle.textContent = `${currentYear}年${currentMonth + 1}月`;

  const firstDay = new Date(currentYear, currentMonth, 1);
  // JS getDay(): 0=Sun, 1=Mon, ... 6=Sat
  // We want Mon=0, Tue=1, ... Sun=6
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = getTodayStr();

  // config workDays: 1=Mon, ..., 7=Sun
  const workDays = config ? config.workDays : [1, 2, 3, 4, 5];

  let html = '';
  let totalDays = 0, totalHours = 0, totalEarned = 0;

  // fill blanks before first day
  for (let i = 0; i < startDay; i++) {
    html += '<div class="cal-cell empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(currentYear, currentMonth, d);
    const jsDay = new Date(currentYear, currentMonth, d).getDay();
    const mapped = jsDay === 0 ? 7 : jsDay;
    const isWorkday = workDays.includes(mapped);
    const isToday = ds === today;
    const rec = records[ds];

    let cls = 'cal-cell';
    if (isToday) cls += ' today';
    if (!isWorkday) cls += ' weekend';

    let content = `<span class="cal-date">${d}</span>`;

    if (isWorkday && rec) {
      const wh = rec.workHours || 0;
      const earned = rec.earned || 0;
      if (wh > 0) {
        content += `<span class="cal-hours">${wh.toFixed(1)}h</span>`;
        content += `<span class="cal-earned">￥${earned.toFixed(0)}</span>`;
        totalDays++;
        totalHours += wh;
        totalEarned += earned;
      } else if (rec.clockIn && !rec.clockOut) {
        content += '<span class="cal-active">进行中</span>';
      }
    } else if (isWorkday && !rec) {
      // future workday or no record
      if (ds < today) {
        cls += ' no-record';
      }
    }

    html += `<div class="${cls}">${content}</div>`;
  }

  elCalendarGrid.innerHTML = html;

  const avg = totalDays > 0 ? totalEarned / totalDays : 0;
  elSumDays.textContent = `${totalDays} 天`;
  elSumHours.textContent = `${totalHours.toFixed(1)} 小时`;
  elSumEarned.textContent = `￥${totalEarned.toFixed(0)}`;
  elSumAvg.textContent = `￥${avg.toFixed(0)}`;
}

function navigateMonth(delta) {
  currentMonth += delta;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
}

async function init() {
  config = await window.electronAPI.loadConfig();
  records = await window.electronAPI.loadRecords();

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  renderCalendar();

  document.getElementById('btnPrevMonth').addEventListener('click', () => navigateMonth(-1));
  document.getElementById('btnNextMonth').addEventListener('click', () => navigateMonth(1));
  document.getElementById('btnClose').addEventListener('click', () => window.close());
}

init();
