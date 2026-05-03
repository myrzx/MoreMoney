let config = null;

const elInputSalary = document.getElementById('inputSalary');
const elInputWorkStart = document.getElementById('inputWorkStart');
const elInputWorkEnd = document.getElementById('inputWorkEnd');
const elEquivList = document.getElementById('equivList');
const elInputEqName = document.getElementById('inputEqName');
const elInputEqIcon = document.getElementById('inputEqIcon');
const elInputEqPrice = document.getElementById('inputEqPrice');
const elBtnAddEquiv = document.getElementById('btnAddEquiv');
const elBtnSave = document.getElementById('btnSave');
const elBtnClose = document.getElementById('btnClose');
const elInputReminder = document.getElementById('inputReminder');
const elBtnTestReminder = document.getElementById('btnTestReminder');
const elBtnEye = document.getElementById('btnEye');
const elBreakList = document.getElementById('breakList');
const elInputBreakStart = document.getElementById('inputBreakStart');
const elInputBreakEnd = document.getElementById('inputBreakEnd');
const elBtnAddBreak = document.getElementById('btnAddBreak');

async function loadConfig() {
  try {
    config = await window.electronAPI.loadConfig();
    if (!config) {
      return;
    }
    elInputSalary.value = config.monthlySalary || 25000;
    elInputWorkStart.value = config.workStart || '09:00';
    elInputWorkEnd.value = config.workEnd || '17:30';

    elInputReminder.checked = config.reminderEnabled !== false;

    renderEquivalents();
    renderBreaks();
  } catch (e) {
    // config load failed — use nothing
  }
}

function renderEquivalents() {
  elEquivList.innerHTML = '';

  config.equivalents.forEach((eq, i) => {
    const div = document.createElement('div');
    div.className = 'equiv-item' + (i === config.selectedEquivalent ? ' selected' : '');

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'equiv';
    radio.value = i;
    radio.checked = i === config.selectedEquivalent;
    radio.addEventListener('change', () => {
      config.selectedEquivalent = i;
      renderEquivalents();
    });

    const icon = document.createElement('span');
    icon.textContent = eq.icon || '📦';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = eq.name;

    const priceSpan = document.createElement('span');
    priceSpan.className = 'price';
    priceSpan.textContent = '¥' + eq.price;

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '删';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (config.equivalents.length <= 1) return;
      config.equivalents.splice(i, 1);
      if (config.selectedEquivalent >= config.equivalents.length) {
        config.selectedEquivalent = config.equivalents.length - 1;
      }
      renderEquivalents();
    });

    div.addEventListener('click', (e) => {
      if (e.target === delBtn) return;
      config.selectedEquivalent = i;
      renderEquivalents();
    });

    div.appendChild(radio);
    div.appendChild(icon);
    div.appendChild(nameSpan);
    div.appendChild(priceSpan);
    div.appendChild(delBtn);
    elEquivList.appendChild(div);
  });
}

elBtnAddEquiv.addEventListener('click', () => {
  const name = elInputEqName.value.trim();
  const icon = elInputEqIcon.value.trim() || '📦';
  const price = Number(elInputEqPrice.value);
  if (!name || !price || price <= 0) return;
  config.equivalents.push({ name, icon, price });
  elInputEqName.value = '';
  elInputEqIcon.value = '';
  elInputEqPrice.value = '';
  renderEquivalents();
});

function renderBreaks() {
  elBreakList.innerHTML = '';
  const breaks = config.breaks || [];
  breaks.forEach((brk, i) => {
    const div = document.createElement('div');
    div.className = 'break-item';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'break-time';
    timeSpan.textContent = `${brk.start} - ${brk.end}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '删';
    delBtn.addEventListener('click', () => {
      breaks.splice(i, 1);
      renderBreaks();
    });

    div.appendChild(timeSpan);
    div.appendChild(delBtn);
    elBreakList.appendChild(div);
  });
}

elBtnAddBreak.addEventListener('click', () => {
  const start = elInputBreakStart.value;
  const end = elInputBreakEnd.value;
  if (!start || !end || start >= end) return;
  if (!config.breaks) config.breaks = [];
  config.breaks.push({ start, end });
  elInputBreakStart.value = '';
  elInputBreakEnd.value = '';
  renderBreaks();
});

elBtnSave.addEventListener('click', () => { doSave(); });
elBtnClose.addEventListener('click', () => { window.close(); });
elBtnTestReminder.addEventListener('click', () => { window.electronAPI.testReminder(); });
elBtnEye.addEventListener('click', () => {
  const visible = elInputSalary.type === 'text';
  elInputSalary.type = visible ? 'password' : 'text';
  elBtnEye.textContent = visible ? '👁' : '🙈';
});

async function doSave() {
  try {
    config.monthlySalary = Number(elInputSalary.value) || config.monthlySalary;
    config.workStart = elInputWorkStart.value || config.workStart;
    config.workEnd = elInputWorkEnd.value || config.workEnd;

    config.reminderEnabled = elInputReminder.checked;

    await window.electronAPI.saveConfig(config);
    window.close();
  } catch (e) {
    // save failed — stay open
  }
}

window.__saveSettings = doSave;

loadConfig();
