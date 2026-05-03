let config = null;

const elInputSalary = document.getElementById('inputSalary');
const elInputWorkStart = document.getElementById('inputWorkStart');
const elInputWorkEnd = document.getElementById('inputWorkEnd');
const elWorkDaysCheckboxes = document.getElementById('workDaysCheckboxes');
const elEquivList = document.getElementById('equivList');
const elInputEqName = document.getElementById('inputEqName');
const elInputEqIcon = document.getElementById('inputEqIcon');
const elInputEqPrice = document.getElementById('inputEqPrice');
const elBtnAddEquiv = document.getElementById('btnAddEquiv');
const elBtnSave = document.getElementById('btnSave');
const elBtnClose = document.getElementById('btnClose');
const elInputReminder = document.getElementById('inputReminder');
const elBtnTestReminder = document.getElementById('btnTestReminder');

async function loadConfig() {
  try {
    config = await window.electronAPI.loadConfig();
    if (!config) {
      return;
    }
    elInputSalary.value = config.monthlySalary || 25000;
    elInputWorkStart.value = config.workStart || '09:00';
    elInputWorkEnd.value = config.workEnd || '17:30';

    const workDays = config.workDays || [1,2,3,4,5];
    const checkboxes = elWorkDaysCheckboxes.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = workDays.includes(Number(cb.value));
    });

    elInputReminder.checked = config.reminderEnabled !== false;

    renderEquivalents();
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

elBtnSave.addEventListener('click', () => { doSave(); });
elBtnClose.addEventListener('click', () => { window.close(); });
elBtnTestReminder.addEventListener('click', () => { window.electronAPI.testReminder(); });

async function doSave() {
  try {
    config.monthlySalary = Number(elInputSalary.value) || config.monthlySalary;
    config.workStart = elInputWorkStart.value || config.workStart;
    config.workEnd = elInputWorkEnd.value || config.workEnd;

    const checkboxes = elWorkDaysCheckboxes.querySelectorAll('input[type="checkbox"]');
    config.workDays = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => Number(cb.value))
      .sort();

    config.reminderEnabled = elInputReminder.checked;

    await window.electronAPI.saveConfig(config);
    window.close();
  } catch (e) {
    // save failed — stay open
  }
}

window.__saveSettings = doSave;

loadConfig();
