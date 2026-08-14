// ── Supabase (shared project — see event_recorder / My-Google-OAuth-login) ──
const SUPABASE_URL = 'https://nrwckhyegdkcbfbiitxz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yd2NraHllZ2RrY2JmYmlpdHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzYxMzcsImV4cCI6MjA4NzcxMjEzN30.j_4uCVEG2CoNv9n8tGJaPwZNqSuEqZUZUxxVLdGZcEo';
// Named supabaseClient (not `supabase`) to avoid colliding with the CDN's global `supabase` binding.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// In-memory data cache — single source of truth used by the render layer.
// Writes are queued (debounced) and pushed to the user's Supabase row.
const dbCache = { nodes: null, profile: null, goals: null, entries: [] };
let currentUserId = null;
let writeTimer = null;

const authScreen = document.getElementById('authScreen');
const appShell = document.getElementById('appShell');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const authNote = document.getElementById('authNote');
const adminBtn = document.getElementById('adminBtn');
const adminNote = document.getElementById('adminNote');

const ADMIN_EMAIL = 'azzamunza@gmail.com';
let currentUserEmail = null;
let adminMode = false;
let preAdminNodes = null;

const entryForm = document.getElementById('entryForm');
const entriesList = document.getElementById('entriesList');
const totalLogs = document.getElementById('totalLogs');
const latestDate = document.getElementById('latestDate');
const clearAll = document.getElementById('clearAll');
const chartTitle = document.getElementById('chartTitle');
const chartSubtitle = document.getElementById('chartSubtitle');
const chartDataNote = document.getElementById('chartDataNote');
const chartCanvas = document.getElementById('bodyChartCanvas');
const chartCtx = chartCanvas.getContext('2d');
const loadingOverlay = document.getElementById('loadingOverlay');
const appStartTime = performance.now();
const minOverlayVisibleMs = 8000;
const profileView = document.getElementById('profileView');
const profileGoalsView = document.getElementById('profileGoalsView');
const profileEditView = document.getElementById('profileEditView');
const profileEditBtn = document.getElementById('profileEditBtn');
const cancelProfileEditBtn = document.getElementById('cancelProfileEditBtn');
const goalsList = document.getElementById('goalsList');
const goalsEditor = document.getElementById('goalsEditor');
const bodyOutline = document.getElementById('bodyOutline');
const bodyOutlineCanvas = document.getElementById('bodyOutlineCanvas');
const chartCard = document.getElementById('chartCard');
const nodePropertyPanel = document.getElementById('nodePropertyPanel');
const bodyNodeButtons = document.getElementById('bodyNodeButtons');
const toggleBodyEdit = document.getElementById('toggleBodyEdit');
const saveBodyLayout = document.getElementById('saveBodyLayout');
const selectedNodeLabel = document.getElementById('selectedNodeLabel');
const nodeSymmetryToggle = document.getElementById('nodeSymmetryToggle');
const nodeColor = document.getElementById('nodeColor');
const nodeMirrorColor = document.getElementById('nodeMirrorColor');
const mirrorColorWrapper = document.getElementById('mirrorColorWrapper');
const addBodyNode = document.getElementById('addBodyNode');
const nodeSystemToggle = document.getElementById('nodeSystemToggle');
const nodeUnit = document.getElementById('nodeUnit');
const estimateBodyFatBtn = document.getElementById('estimateBodyFatBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let bodyEditMode = false;
let selectedNodeKey = 'all';

const unitOptions = [
  { value: '', label: '— none —' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'mg', label: 'Milligrams (mg)' },
  { value: 'µg', label: 'Micrograms (µg)' },
  { value: 'lb', label: 'Pounds (lb)' },
  { value: 'st', label: 'Stone (st)' },
  { value: 'cm', label: 'Centimetres (cm)' },
  { value: 'm', label: 'Metres (m)' },
  { value: 'mm', label: 'Millimetres (mm)' },
  { value: 'in', label: 'Inches (in)' },
  { value: 'ft', label: 'Feet (ft)' },
  { value: '%', label: 'Percent (%)' },
  { value: 'kg/m²', label: 'Body mass index (kg/m²)' },
  { value: 'bpm', label: 'Beats per minute (bpm)' },
  { value: 'rpm', label: 'Breaths per minute (rpm)' },
  { value: 'mmHg', label: 'Millimetres of mercury (mmHg)' },
  { value: 'kPa', label: 'Kilopascals (kPa)' },
  { value: 'cmH₂O', label: 'Centimetres of water (cmH₂O)' },
  { value: '°C', label: 'Celsius (°C)' },
  { value: '°F', label: 'Fahrenheit (°F)' },
  { value: 'mL', label: 'Millilitres (mL)' },
  { value: 'L', label: 'Litres (L)' },
  { value: 'L/min', label: 'Litres per minute (L/min)' },
  { value: 'mL/kg/min', label: 'VO₂ max (mL/kg/min)' },
  { value: 'mg/dL', label: 'Milligrams per decilitre (mg/dL)' },
  { value: 'g/dL', label: 'Grams per decilitre (g/dL)' },
  { value: 'mmol/L', label: 'Millimoles per litre (mmol/L)' },
  { value: 'µmol/L', label: 'Micromoles per litre (µmol/L)' },
  { value: 'nmol/L', label: 'Nanomoles per litre (nmol/L)' },
  { value: 'pmol/L', label: 'Picomoles per litre (pmol/L)' },
  { value: 'mEq/L', label: 'Milliequivalents per litre (mEq/L)' },
  { value: 'mmol/mol', label: 'Millimoles per mole (mmol/mol)' },
  { value: 'IU', label: 'International units (IU)' },
  { value: 'kcal', label: 'Kilocalories (kcal)' },
  { value: 'kJ', label: 'Kilojoules (kJ)' },
  { value: 'W', label: 'Watts (W)' },
  { value: 'MET', label: 'Metabolic equivalents (MET)' },
  { value: 'steps', label: 'Steps' },
  { value: 'km', label: 'Kilometres (km)' },
  { value: 'mi', label: 'Miles (mi)' },
  { value: 's', label: 'Seconds (s)' },
  { value: 'min', label: 'Minutes (min)' },
  { value: 'h', label: 'Hours (h)' },
  { value: 'score', label: 'Score (0–100)' },
  { value: 'count', label: 'Count' },
  { value: 'ratio', label: 'Ratio' }
];

const defaultBodyNodes = {
  all: { label: 'Full Body', system: true, active: true, showInForm: false, unit: '%', color: '#ec4899' },
  bmi: { label: 'BMI', system: true, active: true, showInForm: false, unit: 'kg/m²', color: '#a78bfa' },
  weight: { label: 'Weight', system: true, active: false, showInForm: true, unit: 'kg', color: '#22d3ee' },
  bodyFat: { label: 'ABI', system: true, active: false, showInForm: true, unit: 'kg/m²', color: '#f59e0b' },
  restingHR: { label: 'Resting Heart Rate', system: true, active: false, showInForm: true, unit: 'bpm', color: '#fb7185' },
  oxygen: { label: 'Oxygen (SpO₂)', system: true, active: false, showInForm: true, unit: '%', color: '#38bdf8' },
  bloodPressure: { label: 'Blood Pressure', system: true, active: false, showInForm: true, unit: 'mmHg', color: '#e11d48' },
  height: { label: 'Height', x: 16, y: 14, active: false, showInForm: true, unit: 'cm', color: '#818cf8' },
  chest: { label: 'Chest', x: 50, y: 31, active: false, showInForm: true, unit: 'cm', color: '#a855f7' },
  waist: { label: 'Waist', x: 50, y: 47, active: false, showInForm: true, unit: 'cm', color: '#34d399' },
  hips: { label: 'Hips', x: 50, y: 63, active: false, showInForm: true, unit: 'cm', color: '#fb7185' },
  arms: { label: 'Arm', x: 24, y: 37, active: false, showInForm: true, unit: 'cm', color: '#60a5fa', mirrorColor: '#38bdf8' },
  thighs: { label: 'Thigh', x: 38, y: 72, active: false, showInForm: true, unit: 'cm', color: '#f472b6', mirrorColor: '#fb7185' }
};

// The default node set can be overridden by the shared value in Supabase.
let effectiveDefaultNodes = defaultBodyNodes;

function getFallbackNodes() {
  return effectiveDefaultNodes || defaultBodyNodes;
}

// Debounce rapid local edits; push the whole per-user row to Supabase.
function queueDbWrite() {
  if (adminMode) return; // never persist shared-default edits into personal user_data
  if (!currentUserId) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    supabaseClient.from('user_data').upsert({
      user_id: currentUserId,
      nodes: dbCache.nodes,
      profile: dbCache.profile,
      goals: dbCache.goals,
      entries: dbCache.entries,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.warn('Supabase write failed (schema ready?)', error.message);
    }).catch((err) => console.warn('Supabase write error', err.message));
  }, 350);
}

function loadEntries() {
  return dbCache.entries || [];
}

function saveEntries(entries) {
  dbCache.entries = entries;
  queueDbWrite();
}

function normalizeEntries(entries) {
  return entries
    .map((entry) => {
      const normalized = Object.entries(entry).reduce((result, [key, value]) => {
        if (key === 'date') {
          result.date = value ? new Date(value) : null;
          return result;
        }
        if (key === 'notes' || key === 'createdAt') {
          result[key] = value;
          return result;
        }
        result[key] = value === '' || value === null || value === undefined ? null : Number(value);
        if (Number.isNaN(result[key])) result[key] = null;
        return result;
      }, {});
      return normalized;
    })
    .filter((entry) => entry.date instanceof Date && !Number.isNaN(entry.date.getTime()));
}

function loadGoals() {
  return dbCache.goals || {};
}

function saveGoals(goals) {
  dbCache.goals = goals;
  queueDbWrite();
}

function loadBodyNodes() {
  return dbCache.nodes || getFallbackNodes();
}

function saveBodyNodes(nodes) {
  dbCache.nodes = nodes;
  queueDbWrite();
}

function formatValue(label, value, suffix = '') {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return `${label}: ${numeric}${suffix}`;
}

function getMeasurementKeys() {
  const nodes = loadBodyNodes();
  return Object.entries(nodes)
    .filter(([, node]) => node.showInForm !== false)
    .map(([key]) => key);
}

function averageValues(entry) {
  const values = getMeasurementKeys()
    .map((key) => entry[key])
    .filter((value) => typeof value === 'number');
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getBMI(entry) {
  if (typeof entry.weight !== 'number' || typeof entry.height !== 'number' || entry.height <= 0) return null;
  return entry.weight / ((entry.height / 100) ** 2);
}

function getBMICategory(bmi) {
  if (!bmi) return 'Unknown';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

const capKey = (key) => key.charAt(0).toUpperCase() + key.slice(1);

// Possible goals are defined by the measurable (default) nodes.
function getGoalConfig() {
  const config = {};
  Object.entries(getFallbackNodes()).forEach(([key, node]) => {
    if (node.showInForm === false) return;
    config[key] = { label: node.label || key, suffix: node.unit || '' };
  });
  return config;
}

function buildGoalsEditor(goals) {
  const container = document.getElementById('goalsEditorRows');
  if (!container) return;
  container.innerHTML = '';
  Object.entries(getGoalConfig()).forEach(([key, conf]) => {
    const saved = (goals && goals[key]) || {};
    const row = document.createElement('div');
    row.className = 'goals-editor-row';
    const labelId = `goal${capKey(key)}Toggle`;
    const targetId = `goal${capKey(key)}Target`;
    row.innerHTML = `
      <label><input type="checkbox" id="${labelId}" ${saved.enabled !== false ? 'checked' : ''} /> ${conf.label}</label>
      <input type="number" id="${targetId}" placeholder="Target" ${saved.target != null ? `value="${saved.target}"` : ''} />
    `;
    container.appendChild(row);
  });
}

function gatherGoalsFromEditor() {
  const result = {};
  Object.entries(getGoalConfig()).forEach(([key]) => {
    const toggle = document.getElementById(`goal${capKey(key)}Toggle`);
    const target = document.getElementById(`goal${capKey(key)}Target`);
    if (!toggle || !target) return;
    result[key] = {
      enabled: !!toggle.checked,
      target: target.value ? Number(target.value) : null
    };
  });
  return result;
}

function computeGoalProgress(initialValue, currentValue, targetValue) {
  if (typeof initialValue !== 'number' || typeof currentValue !== 'number' || typeof targetValue !== 'number') return 0;
  if (initialValue === targetValue) return 1;
  const downward = targetValue < initialValue;
  const progress = downward
    ? (initialValue - currentValue) / (initialValue - targetValue)
    : (currentValue - initialValue) / (targetValue - initialValue);
  return Math.min(Math.max(progress, 0), 1);
}

function renderProfileView() {
  if (!profileView) return;
  const profile = loadProfile();
  const hasAny = Object.values(profile).some((v) => v !== undefined && v !== null && v !== '');

  if (!hasAny) {
    profileView.innerHTML = `
      <p class="profile-empty">Add your profile details to personalise your dashboard.</p>
      <p class="profile-hint">Tap the gear icon to add your name, age, sex, height, weight and sleep.</p>
    `;
    return;
  }

  const row = (label, value) => (value ? `<div class="pinfo"><span>${label}</span><strong>${value}</strong></div>` : '');

  profileView.innerHTML = `
    <div class="profile-avatar">${(profile.name || '?').charAt(0).toUpperCase()}</div>
    <h3 class="profile-name">${profile.name || 'My profile'}</h3>
    <div class="profile-info-grid">
      ${row('Age', profile.age ? `${profile.age} yrs` : '')}
      ${row('Sex', profile.sex ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1) : '')}
      ${row('Height', profile.height ? `${profile.height} cm` : '')}
      ${row('Weight', profile.weight ? `${profile.weight} kg` : '')}
      ${row('Avg sleep', profile.sleep ? `${profile.sleep} hrs` : '')}
    </div>
  `;
}

function renderGoals() {
  if (!goalsList) return;
  const goals = loadGoals();
  const entries = normalizeEntries(loadEntries()).sort((a, b) => a.date - b.date);
  if (!entries.length) {
    goalsList.innerHTML = '<p class="profile-empty">Set goals once you have metrics saved.</p>';
    return;
  }

  const initial = entries[0];
  const latest = entries[entries.length - 1];
  const config = getGoalConfig();
  goalsList.innerHTML = '';

  Object.entries(goals).forEach(([key, goal]) => {
    if (!goal.enabled || typeof goal.target !== 'number') return;
    const initialValue = initial[key];
    const currentValue = latest[key];
    if (typeof initialValue !== 'number' || typeof currentValue !== 'number') return;

    const progress = computeGoalProgress(initialValue, currentValue, goal.target);
    const label = config[key]?.label || key;
    const suffix = config[key]?.suffix || '';
    const percent = Math.round(progress * 100);

    const goalCard = document.createElement('div');
    goalCard.className = 'goals-bar';
    goalCard.innerHTML = `
      <div class="goal-label"><span>${label}</span><span>${currentValue}${suffix} / ${goal.target}${suffix}</span></div>
      <div class="goal-progress"><div class="goal-progress-inner" style="width:${percent}%"></div></div>
      <div class="goal-meta">${percent}% toward target</div>
    `;
    goalsList.appendChild(goalCard);
  });

  if (!goalsList.children.length) {
    goalsList.innerHTML = '<p class="profile-empty">No active goals found. Enable some in the goals editor.</p>';
  }
}

function setGoalsEditorVisible(visible) {
  if (!goalsEditor) return;
  goalsEditor.classList.toggle('hidden', !visible);
}

function getDuplicateEntryIndex(entries, date, excludeIndex = -1) {
  return entries.findIndex((entry, index) => entry.date === date && index !== excludeIndex);
}

function getEntryIndexByCreatedAt(entries, entry) {
  return entries.findIndex((current) => current.createdAt === entry.createdAt && current.date === entry.date);
}

function renderEntries() {
  const entries = normalizeEntries(loadEntries());
  entriesList.innerHTML = '';
  totalLogs.textContent = entries.length;
  renderProfileView();
  renderGoals();

  if (!entries.length) {
    latestDate.textContent = 'No entries yet';
    entriesList.innerHTML = '<p class="empty-state">Start by adding your first body measurement.</p>';
    return;
  }

  const sorted = entries.slice().sort((a, b) => b.date - a.date);
  latestDate.textContent = new Date(sorted[0].date).toLocaleDateString();

  sorted.forEach((entry) => {
    const actualIndex = getEntryIndexByCreatedAt(entries, entry);
    const card = document.createElement('article');
    card.className = 'entry-card collapsed';

    const header = document.createElement('div');
    header.className = 'entry-header';

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'entry-card-title';
    const title = document.createElement('h3');
    title.textContent = new Date(entry.date).toLocaleDateString();
    titleWrapper.appendChild(title);

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'entry-card-toggle';
    toggleButton.textContent = 'Show details';
    toggleButton.addEventListener('click', () => {
      card.classList.toggle('collapsed');
      toggleButton.textContent = card.classList.contains('collapsed') ? 'Show details' : 'Hide details';
    });
    titleWrapper.appendChild(toggleButton);
    header.appendChild(titleWrapper);

    const subtitle = document.createElement('span');
    subtitle.textContent = entry.notes || 'Measurement entry';
    header.appendChild(subtitle);

    card.appendChild(header);

    const metrics = document.createElement('div');
    metrics.className = 'entry-metrics';

    getFormFields().forEach((field) => {
      if (field.key === 'date' || field.key === 'notes') return;
      const value = entry[field.key];
      if (value === null || value === undefined || value === '') return;
      const metric = document.createElement('div');
      metric.className = 'metric';
      metric.innerHTML = `<span>${field.label}</span><span>${value}${field.unit ? ` ${field.unit}` : ''}</span>`;
      metrics.appendChild(metric);
    });

    card.appendChild(metrics);

    if (entry.notes) {
      const note = document.createElement('div');
      note.className = 'entry-note';
      note.textContent = entry.notes;
      card.appendChild(note);
    }

    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'entry-edit-btn';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => loadEntryForEdit(entry, actualIndex));
    actions.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'entry-delete-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      if (!confirm(`Delete the entry for ${new Date(entry.date).toLocaleDateString()}?`)) return;
      const updatedEntries = normalizeEntries(loadEntries());
      updatedEntries.splice(actualIndex, 1);
      saveEntries(updatedEntries);
      renderEntries();
      drawChart();
    });
    actions.appendChild(deleteButton);

    card.appendChild(actions);
    entriesList.appendChild(card);
  });
}

function getFormFields() {
  const nodes = loadBodyNodes();
  const fields = [
    { key: 'date', label: 'Date', type: 'date', required: true },
  ];

  Object.entries(nodes).forEach(([key, node]) => {
    if (node.showInForm === false) return;
    if (node.symmetry) {
      fields.push({ key: `${key}Left`, label: `${node.label} Left`, type: 'number', unit: node.unit || '' });
      fields.push({ key: `${key}Right`, label: `${node.label} Right`, type: 'number', unit: node.unit || '' });
    } else {
      fields.push({ key, label: node.label, type: 'number', unit: node.unit || '' });
    }
  });

  fields.push({ key: 'notes', label: 'Note', type: 'text' });
  return fields;
}

function mapEntryFields(entry) {
  const nodes = loadBodyNodes();
  const mapped = {};
  Object.entries(nodes).forEach(([key, node]) => {
    if (node.showInForm === false) return;
    if (node.symmetry) {
      mapped[`${key}Left`] = Number(entry[`${key}Left`]) || null;
      mapped[`${key}Right`] = Number(entry[`${key}Right`]) || null;
    } else {
      mapped[key] = Number(entry[key]) || null;
    }
  });
  return mapped;
}

function clearForm() {
  entryForm.reset();
  entryForm.classList.remove('form-saved');
  entryForm.removeAttribute('data-edit-index');
  const saveBtn = entryForm.querySelector('.form-submit-btn');
  if (saveBtn) {
    saveBtn.textContent = 'Save Entry';
    saveBtn.classList.remove('saved');
  }
  if (cancelEditBtn) {
    cancelEditBtn.classList.add('hidden');
  }
}

function setEditMode(editIndex) {
  const saveBtn = entryForm.querySelector('.form-submit-btn');
  if (saveBtn) {
    saveBtn.textContent = editIndex !== undefined ? 'Update Entry' : 'Save Entry';
  }
  if (cancelEditBtn) {
    cancelEditBtn.classList.toggle('hidden', editIndex === undefined);
  }
  if (editIndex !== undefined) {
    entryForm.dataset.editIndex = editIndex;
  }
}

function renderMeasurementFields() {
  const container = document.getElementById('measurementFields');
  if (!container) return;
  const fields = getFormFields();
  container.innerHTML = '';

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field.key === 'date' || field.key === 'notes') continue;

    const nextField = fields[index + 1];
    const isSymmetricPair = nextField
      && field.key.endsWith('Left')
      && nextField.key === field.key.replace(/Left$/, 'Right')
      && field.label.replace(/\s+Left$/, '') === nextField.label.replace(/\s+Right$/, '');

    if (isSymmetricPair) {
      const row = document.createElement('div');
      row.className = 'row symmetry-row';

      const pairLabel = document.createElement('div');
      pairLabel.className = 'symmetry-pair-label';
      pairLabel.textContent = field.label.replace(/\s+Left$/, '');
      row.appendChild(pairLabel);

      const leftWrapper = document.createElement('label');
      leftWrapper.className = 'symmetry-input';
      leftWrapper.innerHTML = `<span>Left</span>`;
      const leftInput = document.createElement('input');
      leftInput.type = field.type;
      leftInput.name = field.key;
      leftInput.id = field.key;
      leftInput.placeholder = field.unit ? `e.g. 82 ${field.unit}` : 'Enter value';
      leftInput.step = '0.1';
      leftInput.min = '0';
      leftWrapper.appendChild(leftInput);
      row.appendChild(leftWrapper);

      const rightWrapper = document.createElement('label');
      rightWrapper.className = 'symmetry-input';
      rightWrapper.innerHTML = `<span>Right</span>`;
      const rightInput = document.createElement('input');
      rightInput.type = nextField.type;
      rightInput.name = nextField.key;
      rightInput.id = nextField.key;
      rightInput.placeholder = nextField.unit ? `e.g. 82 ${nextField.unit}` : 'Enter value';
      rightInput.step = '0.1';
      rightInput.min = '0';
      rightWrapper.appendChild(rightInput);
      row.appendChild(rightWrapper);

      container.appendChild(row);
      index += 1;
      continue;
    }

    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('label');
    label.textContent = field.label;

    const input = document.createElement('input');
    input.type = field.type;
    input.name = field.key;
    input.id = field.key;
    input.placeholder = field.unit ? `e.g. 82 ${field.unit}` : 'Enter value';
    input.step = '0.1';
    input.min = '0';
    label.appendChild(input);
    row.appendChild(label);

    container.appendChild(row);
  }
}

function loadEntryForEdit(entry, index) {
  const fields = getFormFields();
  fields.forEach((field) => {
    const input = document.getElementById(field.key);
    if (!input) return;
    if (field.key === 'date') {
      input.value = entry.date.toISOString().slice(0, 10);
      return;
    }
    input.value = entry[field.key] != null ? entry[field.key] : '';
  });

  setEditMode(index);
  document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setFormSavedState() {
  entryForm.classList.add('form-saved');
  const saveBtn = entryForm.querySelector('.form-submit-btn');
  if (saveBtn) {
    saveBtn.textContent = 'Saved';
    saveBtn.classList.add('saved');
  }
}

function getAllOutlineButtons() {
  return Array.from(document.querySelectorAll('.body-node'));
}

function getNodeChartInfo(key) {
  const node = loadBodyNodes()[key] || {};
  return {
    label: node.label || key,
    unit: node.unit || '',
    color: node.color || '#ec4899',
    mirrorColor: node.mirrorColor || '#38bdf8'
  };
}

function getActiveNodeLabels() {
  const nodes = loadBodyNodes();
  return Object.entries(nodes)
    .filter(([, node]) => node.active)
    .map(([, node]) => node.label);
}

function updateChartTitle() {
  const labels = getActiveNodeLabels();
  chartTitle.textContent = 'Improvement Chart';
  if (!labels.length) {
    chartSubtitle.textContent = 'Toggle nodes below to add their measurement data.';
    chartDataNote.textContent = 'No nodes selected. Toggle a node to plot its data.';
    return;
  }
  chartSubtitle.textContent = `Plotted: ${labels.join(', ')}`;
  chartDataNote.textContent = 'Toggle nodes below to add or remove their data from the chart.';
}

function toggleNodeActive(key) {
  const nodes = loadBodyNodes();
  if (!nodes[key]) return;
  nodes[key].active = !nodes[key].active;
  saveBodyNodes(nodes);
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
  updateChartTitle();
  drawChart();
}

function getBodyNodeInstances(node, key) {
  const baseColor = node.color || '#38bdf8';
  const mirrorColor = node.mirrorColor || '#7c3aed';
  if (!node.symmetry) {
    return [{ key, label: node.label, x: node.x, y: node.y, selected: selectedNodeKey === key, color: baseColor }];
  }

  const primarySide = node.x <= 50 ? 'L' : 'R';
  const mirroredSide = primarySide === 'L' ? 'R' : 'L';
  const primaryX = node.x;
  const mirrorX = Math.min(Math.max(100 - primaryX, 5), 95);

  return [
    { key, label: `${node.label} ${primarySide}`, x: primaryX, y: node.y, selected: selectedNodeKey === key, color: baseColor },
    { key, label: `${node.label} ${mirroredSide}`, x: mirrorX, y: node.y, selected: selectedNodeKey === key, color: mirrorColor }
  ];
}

function renderBodyNodeButtons() {
  if (!bodyNodeButtons) return;
  const nodes = loadBodyNodes();
  bodyNodeButtons.innerHTML = '';

  Object.entries(nodes).forEach(([key, node]) => {
    if (node.system !== true) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `outline-dot${node.active ? ' toggled-on' : ''}${selectedNodeKey === key ? ' selected-edit' : ''}`;
    button.dataset.nodeKey = key;
    button.textContent = node.label;

    button.addEventListener('click', () => {
      if (bodyEditMode) {
        selectBodyNode(key);
      } else {
        toggleNodeActive(key);
      }
    });

    bodyNodeButtons.appendChild(button);
  });
}

function renderBodyNodeCanvas() {
  if (!bodyOutlineCanvas) return;
  const nodes = loadBodyNodes();
  bodyOutlineCanvas.innerHTML = '';

  Object.entries(nodes).forEach(([key, node]) => {
    if (node.system === true) return;
    const instances = getBodyNodeInstances(node, key);
    instances.forEach((instance) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `body-node${node.active ? ' toggled-on' : ''}${selectedNodeKey === key ? ' selected-edit' : ''}`;
      dot.dataset.nodeKey = instance.key;
      dot.setAttribute('aria-label', instance.label);
      dot.title = instance.label;
      dot.textContent = '';
      dot.style.left = `${instance.x}%`;
      dot.style.top = `${instance.y}%`;
      dot.style.transform = 'translate(-50%, -50%)';
      dot.style.background = instance.color;
      dot.style.borderColor = instance.color;
      dot.style.color = 'transparent';

      dot.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        if (bodyEditMode) {
          selectBodyNode(instance.key);
          startBodyNodeDrag(event, instance.key);
        } else {
          toggleNodeActive(instance.key);
        }
      });

      bodyOutlineCanvas.appendChild(dot);
    });
  });
}

let activeDrag = null;

function startBodyNodeDrag(event, key) {
  activeDrag = { key, originX: event.clientX, originY: event.clientY };
  document.addEventListener('pointermove', handleBodyNodeDrag);
  document.addEventListener('pointerup', stopBodyNodeDrag, { once: true });
}

function handleBodyNodeDrag(event) {
  if (!activeDrag || !bodyEditMode || !bodyOutlineCanvas) return;
  const rect = bodyOutlineCanvas.getBoundingClientRect();
  const x = Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 5), 95);
  const y = Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 5), 95);
  const nodes = loadBodyNodes();
  nodes[activeDrag.key].x = x;
  nodes[activeDrag.key].y = y;
  saveBodyNodes(nodes);
  renderBodyNodeCanvas();
}

function stopBodyNodeDrag() {
  activeDrag = null;
  document.removeEventListener('pointermove', handleBodyNodeDrag);
}

function populateUnitSelect() {
  if (!nodeUnit) return;
  const current = loadBodyNodes()[selectedNodeKey]?.unit || '';
  nodeUnit.innerHTML = '';
  unitOptions.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === current) opt.selected = true;
    nodeUnit.appendChild(opt);
  });
}

function selectBodyNode(key) {
  selectedNodeKey = key;
  const nodes = loadBodyNodes();
  const node = nodes[key];
  if (node) {
    if (selectedNodeLabel) selectedNodeLabel.value = node.label;
    if (nodeSystemToggle) nodeSystemToggle.checked = !!node.system;
    if (nodeSymmetryToggle) nodeSymmetryToggle.checked = !!node.symmetry;
    if (nodeColor) nodeColor.value = node.color || '#22d3ee';
    if (nodeMirrorColor) nodeMirrorColor.value = node.mirrorColor || '#38bdf8';
    if (mirrorColorWrapper) mirrorColorWrapper.classList.toggle('hidden', !node.symmetry);
    if (nodeSymmetryToggle) nodeSymmetryToggle.disabled = !!node.system;
  }
  populateUnitSelect();
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
}

function setBodyEditMode(enabled) {
  bodyEditMode = enabled;
  if (bodyOutline) bodyOutline.classList.toggle('body-outline-edit', enabled);
  if (chartCard) chartCard.classList.toggle('node-property', enabled);
  if (nodePropertyPanel) nodePropertyPanel.classList.toggle('hidden', !enabled);
  if (saveBodyLayout) saveBodyLayout.classList.toggle('hidden', !enabled);
  if (selectedNodeLabel) selectedNodeLabel.readOnly = !enabled;
  const node = loadBodyNodes()[selectedNodeKey] || {};
  if (nodeSystemToggle) nodeSystemToggle.disabled = !enabled;
  if (nodeSymmetryToggle) nodeSymmetryToggle.disabled = !enabled || !!node.system;
  if (nodeColor) nodeColor.disabled = !enabled;
  if (nodeMirrorColor) nodeMirrorColor.disabled = !enabled;
  if (nodeUnit) nodeUnit.disabled = !enabled;
  if (mirrorColorWrapper) mirrorColorWrapper.classList.toggle('hidden', !enabled || !node.symmetry);
  if (addBodyNode) addBodyNode.classList.toggle('hidden', !enabled);
  if (enabled) selectBodyNode(selectedNodeKey);
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
}

function updateBodyNodeLabel(value) {
  if (!selectedNodeKey) return;
  const nodes = loadBodyNodes();
  if (!nodes[selectedNodeKey]) return;
  nodes[selectedNodeKey].label = value || nodes[selectedNodeKey].label;
  saveBodyNodes(nodes);
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
}

function toggleSelectedNodeSymmetry(enabled) {
  if (!selectedNodeKey) return;
  const nodes = loadBodyNodes();
  if (!nodes[selectedNodeKey]) return;
  if (nodes[selectedNodeKey].system) return;
  nodes[selectedNodeKey].symmetry = enabled;
  if (!enabled) {
    delete nodes[selectedNodeKey].mirrorColor;
  } else if (!nodes[selectedNodeKey].mirrorColor) {
    nodes[selectedNodeKey].mirrorColor = '#38bdf8';
  }
  saveBodyNodes(nodes);
  selectBodyNode(selectedNodeKey);
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
  drawChart();
}

function toggleSelectedNodeSystem(enabled) {
  if (!selectedNodeKey) return;
  const nodes = loadBodyNodes();
  if (!nodes[selectedNodeKey]) return;
  nodes[selectedNodeKey].system = enabled;
  if (enabled) {
    nodes[selectedNodeKey].symmetry = false;
    delete nodes[selectedNodeKey].mirrorColor;
    delete nodes[selectedNodeKey].x;
    delete nodes[selectedNodeKey].y;
  }
  saveBodyNodes(nodes);
  selectBodyNode(selectedNodeKey);
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
  drawChart();
}

function updateSelectedNodeUnit(value) {
  if (!selectedNodeKey) return;
  const nodes = loadBodyNodes();
  if (!nodes[selectedNodeKey]) return;
  nodes[selectedNodeKey].unit = value;
  saveBodyNodes(nodes);
  renderMeasurementFields();
  drawChart();
}

function updateSelectedNodeColor(value) {
  if (!selectedNodeKey) return;
  const nodes = loadBodyNodes();
  if (!nodes[selectedNodeKey]) return;
  nodes[selectedNodeKey].color = value;
  saveBodyNodes(nodes);
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
}

function updateSelectedNodeMirrorColor(value) {
  if (!selectedNodeKey) return;
  const nodes = loadBodyNodes();
  if (!nodes[selectedNodeKey]) return;
  nodes[selectedNodeKey].mirrorColor = value;
  saveBodyNodes(nodes);
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
}

function addNewBodyNode() {
  const nodes = loadBodyNodes();
  const newKey = `custom${Date.now()}`;
  nodes[newKey] = {
    label: 'New zone',
    x: 50,
    y: 50,
    symmetry: false,
    system: false,
    active: true,
    showInForm: true,
    unit: '',
    color: '#22d3ee'
  };
  saveBodyNodes(nodes);
  renderBodyNodes();
  selectBodyNode(newKey);
}

function renderBodyNodes() {
  renderBodyNodeButtons();
  renderBodyNodeCanvas();
  renderMeasurementFields();
}

function computeChartData(entries) {
  const normalized = normalizeEntries(entries).sort((a, b) => a.date - b.date);
  if (!normalized.length) return { labels: [], datasets: [] };

  const labels = normalized.map((entry) => entry.date.toLocaleDateString());
  const nodes = loadBodyNodes();
  const datasets = [];

  Object.entries(nodes).forEach(([key, node]) => {
    if (!node.active) return;
    if (key === 'all') {
      datasets.push({
        label: 'Full Body (average)',
        values: normalized.map((e) => averageValues(e)),
        color: node.color || '#ec4899',
        unit: '%'
      });
    } else if (key === 'bmi') {
      datasets.push({
        label: 'BMI',
        values: normalized.map((e) => getBMI(e)),
        color: node.color || '#a78bfa',
        unit: 'kg/m²'
      });
    } else if (node.symmetry) {
      datasets.push({
        label: `${node.label} Left`,
        values: normalized.map((e) => (typeof e[`${key}Left`] === 'number' ? e[`${key}Left`] : null)),
        color: node.color || '#38bdf8',
        unit: node.unit || ''
      });
      datasets.push({
        label: `${node.label} Right`,
        values: normalized.map((e) => (typeof e[`${key}Right`] === 'number' ? e[`${key}Right`] : null)),
        color: node.mirrorColor || '#38bdf8',
        unit: node.unit || ''
      });
    } else {
      datasets.push({
        label: node.label,
        values: normalized.map((e) => (typeof e[key] === 'number' ? e[key] : null)),
        color: node.color || '#38bdf8',
        unit: node.unit || ''
      });
    }
  });

  const validDatasets = datasets.filter((dataset) => dataset.values.some((value) => value !== null));
  return { labels, datasets: validDatasets };
}

function getMaxRange(datasets) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  datasets.forEach((dataset) => {
    dataset.values.forEach((value) => {
      if (typeof value !== 'number') return;
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
  });
  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  return { min, max };
}

function drawChart() {
  const entries = normalizeEntries(loadEntries());
  const { labels, datasets } = computeChartData(entries);
  const width = chartCanvas.clientWidth;
  const height = chartCanvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  chartCanvas.width = width * ratio;
  chartCanvas.height = height * ratio;
  chartCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  chartCtx.clearRect(0, 0, width, height);
  chartCtx.fillStyle = 'rgba(15, 23, 42, 0.96)';
  chartCtx.fillRect(0, 0, width, height);

  if (!labels.length || !datasets.length) {
    chartCtx.fillStyle = '#cbd5e1';
    chartCtx.font = '600 16px Inter, system-ui, sans-serif';
    chartCtx.fillText('Add a measurement to view your chart.', 24, height / 2);
    return;
  }

  const padding = 48;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const { min, max } = getMaxRange(datasets);
  const range = max - min;
  const stepX = innerWidth / Math.max(labels.length - 1, 1);

  chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (innerHeight / 4) * i;
    chartCtx.moveTo(padding, y);
    chartCtx.lineTo(width - padding, y);
  }
  chartCtx.stroke();

  chartCtx.fillStyle = 'rgba(248, 250, 252, 0.6)';
  chartCtx.font = '500 12px Inter, system-ui, sans-serif';
  chartCtx.textAlign = 'right';
  chartCtx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i += 1) {
    const value = max - (range / 4) * i;
    const y = padding + (innerHeight / 4) * i;
    chartCtx.fillText(value.toFixed(1), width - 18, y);
  }

  chartCtx.textAlign = 'center';
  chartCtx.textBaseline = 'top';
  const labelStep = Math.max(1, Math.ceil(labels.length / 6));
  chartCtx.fillStyle = 'rgba(248, 250, 252, 0.6)';
  labels.forEach((label, index) => {
    if (index % labelStep !== 0 && index !== labels.length - 1) return;
    const x = padding + stepX * index;
    chartCtx.fillText(label, x, height - padding + 14);
  });

  datasets.forEach((dataset, datasetIndex) => {
    chartCtx.strokeStyle = dataset.color;
    chartCtx.lineWidth = datasetIndex === 0 ? 3 : 2;
    chartCtx.beginPath();
    dataset.values.forEach((rawValue, index) => {
      const value = typeof rawValue === 'number' ? rawValue : null;
      const x = padding + stepX * index;
      const y = value === null ? null : padding + ((max - value) / range) * innerHeight;
      if (y === null) return;
      if (index === 0 || dataset.values[index - 1] === null) {
        chartCtx.moveTo(x, y);
      } else {
        chartCtx.lineTo(x, y);
      }
    });
    chartCtx.stroke();
    chartCtx.fillStyle = dataset.color;
    dataset.values.forEach((rawValue, index) => {
      const value = typeof rawValue === 'number' ? rawValue : null;
      if (value === null) return;
      const x = padding + stepX * index;
      const y = padding + ((max - value) / range) * innerHeight;
      chartCtx.beginPath();
      chartCtx.arc(x, y, 4, 0, Math.PI * 2);
      chartCtx.fill();
    });
  });

  if (datasets.length > 1) {
    const legendX = padding;
    let legendY = padding - 14;
    chartCtx.textAlign = 'left';
    chartCtx.textBaseline = 'middle';
    chartCtx.font = '600 12px Inter, system-ui, sans-serif';
    datasets.forEach((dataset, index) => {
      const x = legendX + (index % 2) * 160;
      if (index && index % 2 === 0) legendY += 24;
      chartCtx.fillStyle = dataset.color;
      chartCtx.fillRect(x, legendY, 12, 12);
      chartCtx.fillStyle = '#f8fafc';
      chartCtx.fillText(dataset.label, x + 18, legendY + 6);
    });
  }
}

function resetLoadingOverlay() {
  if (!loadingOverlay) return;
  loadingOverlay.style.backgroundImage = 'none';
  loadingOverlay.style.background = 'rgba(12, 8, 18, 0.96)';
}

let overlayFadeStarted = false;

function startOverlayFade() {
  if (overlayFadeStarted || !loadingOverlay) return;
  overlayFadeStarted = true;
  loadingOverlay.classList.add('hidden');
  loadingOverlay.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'opacity') return;
    resetLoadingOverlay();
    if (loadingOverlay.parentNode) {
      loadingOverlay.parentNode.removeChild(loadingOverlay);
    }
  }, { once: true });
}

function completeAppLoading() {
  if (!loadingOverlay) return;
  const elapsed = performance.now() - appStartTime;
  const remaining = Math.max(0, minOverlayVisibleMs - elapsed);
  setTimeout(startOverlayFade, remaining);
}

if (loadingOverlay) {
  loadingOverlay.addEventListener('click', startOverlayFade);
}

entryForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const rawEntries = loadEntries();
  const entries = normalizeEntries(rawEntries);
  const editIndex = Number(entryForm.dataset.editIndex);
  const dateValue = document.getElementById('date').value;

  const entry = {
    date: dateValue,
    notes: document.getElementById('notes').value.trim(),
    createdAt: new Date().toISOString()
  };

  getFormFields().forEach((field) => {
    if (field.key === 'date' || field.key === 'notes') return;
    const input = document.getElementById(field.key);
    if (!input) return;
    entry[field.key] = input.value;
  });

  if (!dateValue) {
    alert('Please choose a date for this entry.');
    return;
  }

  if (!Number.isNaN(editIndex) && editIndex >= 0 && editIndex < entries.length) {
    entry.createdAt = rawEntries[editIndex]?.createdAt || entry.createdAt;
  }

  const duplicateIndex = getDuplicateEntryIndex(rawEntries, entry.date, Number.isNaN(editIndex) ? -1 : editIndex);
  if (duplicateIndex !== -1) {
    if (!confirm(`An entry already exists for ${entry.date}. Overwrite it?`)) {
      return;
    }
    rawEntries[duplicateIndex] = entry;
    if (!Number.isNaN(editIndex) && editIndex !== duplicateIndex && editIndex >= 0 && editIndex < rawEntries.length) {
      rawEntries.splice(editIndex, 1);
    }
  } else if (!Number.isNaN(editIndex) && editIndex >= 0 && editIndex < rawEntries.length) {
    rawEntries[editIndex] = entry;
  } else {
    rawEntries.push(entry);
  }

  saveEntries(rawEntries);
  renderEntries();
  drawChart();
  setFormSavedState();
  setTimeout(clearForm, 250);
});

if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    clearForm();
  });
}

function openProfileEdit() {
  renderProfileForm();
  buildGoalsEditor(loadGoals());
  if (profileGoalsView) profileGoalsView.classList.add('hidden');
  if (profileEditView) profileEditView.classList.remove('hidden');
  if (profileEditBtn) profileEditBtn.classList.add('active');
  const panel = document.querySelector('.profile-goals-panel');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeProfileEdit() {
  if (profileGoalsView) profileGoalsView.classList.remove('hidden');
  if (profileEditView) profileEditView.classList.add('hidden');
  if (profileEditBtn) profileEditBtn.classList.remove('active');
  renderProfileView();
  renderGoals();
}

function saveProfileAndGoals() {
  saveProfile(gatherProfile());
  saveGoals(gatherGoalsFromEditor());
  closeProfileEdit();
}

if (profileEditBtn) {
  profileEditBtn.addEventListener('click', () => {
    if (profileEditView.classList.contains('hidden')) {
      openProfileEdit();
    } else {
      closeProfileEdit();
    }
  });
}

if (saveProfileBtn) {
  saveProfileBtn.addEventListener('click', saveProfileAndGoals);
}

if (cancelProfileEditBtn) {
  cancelProfileEditBtn.addEventListener('click', closeProfileEdit);
}

const goalsEditorEl = document.getElementById('goalsEditor');
if (goalsEditorEl) {
  goalsEditorEl.addEventListener('input', (event) => {
    const target = event.target;
    if (target.matches && target.matches('input[type="number"]') && target.id.endsWith('Target')) {
      const toggle = document.getElementById(target.id.replace('Target', 'Toggle'));
      if (toggle) toggle.checked = true;
    }
  });
}

if (nodeSystemToggle) {
  nodeSystemToggle.addEventListener('change', (event) => {
    toggleSelectedNodeSystem(event.target.checked);
  });
}

if (nodeUnit) {
  nodeUnit.addEventListener('change', (event) => {
    updateSelectedNodeUnit(event.target.value);
  });
}

if (clearAll) {
  clearAll.addEventListener('click', () => {
    if (!confirm('Remove all saved entries?')) return;
    saveEntries([]);
    renderEntries();
    drawChart();
  });
}

if (toggleBodyEdit) {
  toggleBodyEdit.addEventListener('click', () => {
    setBodyEditMode(!bodyEditMode);
  });
}

// ── Admin: edit + save the shared default node layout ──
function isAdmin() {
  return (currentUserEmail || '').toLowerCase().trim() === ADMIN_EMAIL;
}

function enterAdminMode() {
  adminMode = true;
  if (adminNote) adminNote.classList.remove('hidden');
  if (adminBtn) adminBtn.classList.add('active');
  // Drop any pending personal write so admin edits can't bleed into user_data.
  clearTimeout(writeTimer);
  // Remember the admin's personal layout so we can restore it on exit.
  preAdminNodes = JSON.parse(JSON.stringify(dbCache.nodes || {}));
  selectedNodeKey = 'all';
  setBodyEditMode(true);
  loadSharedDefaultsIntoEditor();
}

// Load the published default layout (default_nodes id=1) into the editor.
async function loadSharedDefaultsIntoEditor() {
  try {
    const { data, error } = await supabaseClient
      .from('default_nodes')
      .select('nodes')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data && data.nodes && Object.keys(data.nodes).length) {
      dbCache.nodes = JSON.parse(JSON.stringify(data.nodes));
      selectedNodeKey = 'all';
      setBodyEditMode(true);
    } else if (error) {
      console.warn('Admin: could not load shared defaults', error.message);
    }
  } catch (e) {
    console.warn('Admin: could not load shared defaults', e.message);
  }
}

function exitAdminMode() {
  adminMode = false;
  if (preAdminNodes) {
    dbCache.nodes = preAdminNodes;
    preAdminNodes = null;
    selectedNodeKey = 'all';
  }
  if (adminNote) adminNote.classList.add('hidden');
  if (adminBtn) adminBtn.classList.remove('active');
  setBodyEditMode(false);
}

function updateAdminButton() {
  const admin = isAdmin();
  console.info('HealthTracker: signed in as', currentUserEmail, '| admin =', admin);
  if (adminBtn) adminBtn.classList.toggle('hidden', !admin);
  if (!admin && adminMode) exitAdminMode();
}

async function saveDefaultLayout() {
  const nodes = loadBodyNodes();
  try {
    const { error } = await supabaseClient.from('default_nodes').upsert(
      { id: 1, nodes, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (error) {
      alert('Could not save default layout: ' + error.message);
      return;
    }
  } catch (e) {
    alert('Could not save default layout: ' + e.message);
    return;
  }
  effectiveDefaultNodes = nodes;
  exitAdminMode();
  alert('Default node layout saved. New users will see these positions.');
}

if (saveBodyLayout) {
  saveBodyLayout.addEventListener('click', () => {
    if (adminMode) {
      saveDefaultLayout();
    } else {
      setBodyEditMode(false);
    }
  });
}

if (adminBtn) {
  adminBtn.addEventListener('click', () => {
    if (adminMode) {
      exitAdminMode();
    } else {
      enterAdminMode();
    }
  });
}

if (selectedNodeLabel) {
  selectedNodeLabel.addEventListener('input', (event) => {
    updateBodyNodeLabel(event.target.value);
  });
}

if (nodeSymmetryToggle) {
  nodeSymmetryToggle.addEventListener('change', (event) => {
    toggleSelectedNodeSymmetry(event.target.checked);
  });
}

if (nodeColor) {
  nodeColor.addEventListener('input', (event) => {
    updateSelectedNodeColor(event.target.value);
  });
}

if (nodeMirrorColor) {
  nodeMirrorColor.addEventListener('input', (event) => {
    updateSelectedNodeMirrorColor(event.target.value);
  });
}

if (addBodyNode) {
  addBodyNode.addEventListener('click', () => {
    addNewBodyNode();
  });
}

function loadProfile() {
  return dbCache.profile || {};
}

function saveProfile(profile) {
  dbCache.profile = profile;
  queueDbWrite();
}

function renderProfileForm() {
  const profile = loadProfile();
  const map = { profileName: 'name', profileAge: 'age', profileSex: 'sex', profileHeight: 'height', profileWeight: 'weight', profileSleep: 'sleep' };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && profile[key] !== undefined && profile[key] !== null && profile[key] !== '') {
      el.value = profile[key];
    }
  });
}

function gatherProfile() {
  return {
    name: document.getElementById('profileName').value.trim(),
    age: document.getElementById('profileAge').value ? Number(document.getElementById('profileAge').value) : null,
    sex: document.getElementById('profileSex').value,
    height: document.getElementById('profileHeight').value ? Number(document.getElementById('profileHeight').value) : null,
    weight: document.getElementById('profileWeight').value ? Number(document.getElementById('profileWeight').value) : null,
    sleep: document.getElementById('profileSleep').value ? Number(document.getElementById('profileSleep').value) : null
  };
}

function estimateBodyFat() {
  const profile = loadProfile();
  const { weight, height, age, sex } = profile;
  if (!weight || !height || !age || !sex) {
    alert('Please save your profile first (weight, height, age and sex are needed to estimate body fat).');
    return;
  }
  const bmi = weight / ((height / 100) ** 2);
  const sexFactor = sex === 'male' ? 1 : 0;
  const bf = 1.20 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
  const rounded = Math.max(0, Math.min(bf, 70)).toFixed(1);
  const input = document.getElementById('bodyFat');
  if (input) input.value = rounded;
  if (chartDataNote) chartDataNote.textContent = `Estimated body fat: ${rounded}% (Deurenberg formula). Save with your entry.`;
  alert(`Estimated body fat: ${rounded}%`);
}

if (estimateBodyFatBtn) {
  estimateBodyFatBtn.addEventListener('click', estimateBodyFat);
}

function setInitialAreaState() {
  updateChartTitle();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}

if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    if (authNote) authNote.textContent = 'Connecting…';
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) {
      if (authNote) authNote.textContent = error.message;
      loginBtn.disabled = false;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => supabaseClient.auth.signOut());
}

function showApp() {
  if (authScreen) authScreen.classList.add('hidden');
  if (appShell) appShell.classList.remove('hidden');
  if (loadingOverlay) loadingOverlay.style.display = '';
}

function showAuth() {
  if (appShell) appShell.classList.add('hidden');
  if (authScreen) authScreen.classList.remove('hidden');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// Pull the shared default nodes (single row, id = 1) from Supabase.
async function ensureDefaultNodes() {
  const { data, error } = await supabaseClient
    .from('default_nodes')
    .select('nodes')
    .eq('id', 1)
    .maybeSingle();
  if (!error && data && data.nodes) {
    effectiveDefaultNodes = data.nodes;
  }
  return getFallbackNodes();
}

// Build the initial set of goals from the default nodes — all active by default.
function buildDefaultGoals(nodes) {
  const goals = {};
  Object.entries(nodes || {}).forEach(([key, node]) => {
    if (node.showInForm === false) return;
    goals[key] = { enabled: true, target: null };
  });
  return goals;
}

// Load the signed-in user's row into the in-memory cache (falls back to defaults).
async function hydrateUserData(userId) {
  const fallback = await ensureDefaultNodes();
  dbCache.nodes = JSON.parse(JSON.stringify(fallback));
  dbCache.profile = {};
  dbCache.goals = buildDefaultGoals(fallback);
  dbCache.entries = [];

  const { data, error } = await supabaseClient
    .from('user_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && data) {
    dbCache.nodes = data.nodes || dbCache.nodes;
    dbCache.profile = data.profile || {};
    dbCache.goals = data.goals || dbCache.goals;
    dbCache.entries = data.entries || [];
  } else if (!error) {
    // First-time user: persist the initialised row (goals active by default).
    queueDbWrite();
  } else {
    console.warn('user_data load failed (have you run schema.sql?)', error.message);
  }
}

function runAppRender() {
  renderEntries();
  renderBodyNodes();
  renderMeasurementFields();
  renderProfileView();
  setBodyEditMode(false);
  setInitialAreaState();
  drawChart();
}

async function hydrateAndShow(session) {
  currentUserId = session.user.id;
  currentUserEmail = session.user.email || '';
  if (userEmail) userEmail.textContent = currentUserEmail;
  await hydrateUserData(session.user.id);
  updateAdminButton();
  showApp();
  runAppRender();
  if (!overlayFadeStarted) completeAppLoading();
}

async function initApp() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await hydrateAndShow(session);
  } else {
    showAuth();
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      if (window.location.hash || window.location.search.includes('code')) {
        history.replaceState({}, document.title, window.location.pathname);
      }
      await hydrateAndShow(session);
    } else if (event === 'SIGNED_OUT') {
      currentUserId = null;
      currentUserEmail = null;
      updateAdminButton();
      dbCache.nodes = null;
      dbCache.profile = null;
      dbCache.goals = null;
      dbCache.entries = [];
      showAuth();
    }
  });
}

window.addEventListener('load', () => {
  initApp();
});
