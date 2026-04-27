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

async function loadConfig() {
  config = await window.electronAPI.loadConfig();
  if (!config) return;

  elInputSalary.value = config.monthlySalary;
  elInputWorkStart.value = config.workStart;
  elInputWorkEnd.value = config.workEnd;

  // work days
  const checkboxes = elWorkDaysCheckboxes.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = config.workDays.includes(Number(cb.value));
  });

  renderEquivalents();
}

function renderEquivalents() {
  elEquivList.innerHTML = '';
  config.equivalents.forEach((eq, i) => {
    const div = document.createElement('div');
    div.className = 'equiv-item' + (i === config.selectedEquivalent ? ' selected' : '');
    div.innerHTML = `
      <span class="selected-mark">▶</span>
      <span>${eq.icon || '📦'}</span>
      <span class="name">${eq.name}</span>
      <span class="price">¥${eq.price}</span>
      <button class="btn-danger" data-action="delete" data-index="${i}">删</button>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.dataset.action === 'delete') return;
      config.selectedEquivalent = i;
      renderEquivalents();
    });
    div.querySelector('[data-action="delete"]').addEventListener('click', () => {
      if (config.equivalents.length <= 1) return;
      config.equivalents.splice(i, 1);
      if (config.selectedEquivalent >= config.equivalents.length) {
        config.selectedEquivalent = config.equivalents.length - 1;
      }
      renderEquivalents();
    });
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

elBtnSave.addEventListener('click', async () => {
  config.monthlySalary = Number(elInputSalary.value) || config.monthlySalary;
  config.workStart = elInputWorkStart.value || config.workStart;
  config.workEnd = elInputWorkEnd.value || config.workEnd;

  const checkboxes = elWorkDaysCheckboxes.querySelectorAll('input[type="checkbox"]');
  config.workDays = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => Number(cb.value))
    .sort();

  await window.electronAPI.saveConfig(config);
  window.close();
});

elBtnClose.addEventListener('click', () => window.close());

loadConfig();
