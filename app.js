// ── Supabase (shared project — see event_recorder / My-Google-OAuth-login) ──
const SUPABASE_URL = 'https://nrwckhyegdkcbfbiitxz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yd2NraHllZ2RrY2JmYmlpdHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzYxMzcsImV4cCI6MjA4NzcxMjEzN30.j_4uCVEG2CoNv9n8tGJaPwZNqSuEqZUZUxxVLdGZcEo';
// Named supabaseClient (not `supabase`) to avoid colliding with the CDN's global `supabase` binding.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Schema migration helper (HT_ prefixed tables with legacy fallback) ----
// After running Dev/HT_migration.sql the app reads/writes HT_user_data, HT_default_nodes
// and HT_exercise_library. Until then it transparently falls back to the legacy tables.
let HT_TABLES_READY = null; // null = unknown, true = HT_ tables exist, false = use legacy
async function detectHTTables() {
  try {
    const { error } = await supabaseClient.from('HT_user_data').select('user_id').limit(1);
    HT_TABLES_READY = !error;
  } catch (e) {
    HT_TABLES_READY = false;
  }
  return HT_TABLES_READY;
}
function DB(name) { return HT_TABLES_READY === false ? name : ('HT_' + name); }
// Shared/community tables always use the HT_ prefix (they only exist after migration).
function DB_SHARED(name) { return 'HT_' + name; }

// In-memory data cache — single source of truth used by the render layer.
// Writes are queued (debounced) and pushed to the user's Supabase row.
const dbCache = { nodes: null, profile: null, goals: null, entries: [], peptides: [], exercises: [], diet: {}, schedule: [] };
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
    supabaseClient.from(DB('user_data')).upsert({
      user_id: currentUserId,
      nodes: dbCache.nodes,
      profile: dbCache.profile,
      goals: dbCache.goals,
      entries: dbCache.entries,
      peptides: dbCache.peptides,
      exercises: dbCache.exercises,
      diet: dbCache.diet,
      schedule: dbCache.schedule,
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
      .from(DB('default_nodes'))
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
    const { error } = await supabaseClient.from(DB('default_nodes')).upsert(
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
  initNewPages();
}

function showAuth() {
  if (appShell) appShell.classList.add('hidden');
  if (authScreen) authScreen.classList.remove('hidden');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// Pull the shared default nodes (single row, id = 1) from Supabase.
async function ensureDefaultNodes() {
  const { data, error } = await supabaseClient
    .from(DB('default_nodes'))
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
  dbCache.peptides = [];
  dbCache.exercises = [];
  dbCache.diet = {};

  const { data, error } = await supabaseClient
    .from(DB('user_data'))
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && data) {
    dbCache.nodes = data.nodes || dbCache.nodes;
    dbCache.profile = data.profile || {};
    dbCache.goals = data.goals || dbCache.goals;
    dbCache.entries = data.entries || [];
    dbCache.peptides = Array.isArray(data.peptides) ? data.peptides : [];
    dbCache.exercises = Array.isArray(data.exercises) ? data.exercises : [];
    dbCache.diet = data.diet || {};
    dbCache.schedule = Array.isArray(data.schedule) ? data.schedule : [];
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
  await detectHTTables();
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
      dbCache.peptides = [];
      dbCache.exercises = [];
      dbCache.diet = {};
      dbCache.schedule = [];
      showAuth();
    }
  });
}

window.addEventListener('load', () => {
  initApp();
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HealthTracker Dev â€” Calendar / Diet / Peptides / Exercise pages
   Extends the existing single-row user_data schema
   (peptides / exercises / diet JSONB columns).
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â”€â”€ Curated compound list (from Dev/peptides-data.xlsx, Pantone swatch hex) â”€â”€
const PEPTIDE_LIBRARY = [
  { name: '5-Amino-1MQ', category: 'Metabolic', mechanism: 'NNMT inhibitor. Metabolic research.', clinic: 'Fat-loss & body-composition interest, cellular-energy research.', color: '#FFD000' },
  { name: 'AOD-9604', category: 'Metabolic', mechanism: 'C-terminal fragment of HGH. Fat-metabolism research. Lipid Breakdown.', clinic: 'Body-composition & stubborn-fat interest, Weight Support.', color: '#FF6900' },
  { name: 'BPC-157', category: 'Tissue Repair', mechanism: 'Upregulates angiogenic growth factors (VEGF). Angiogenesis.', clinic: 'Tendon, ligament, muscle & gut-healing interest. Nervous System Support.', color: '#298A3B' },
  { name: 'Cagrilintide', category: 'Metabolic', mechanism: 'Appetite & satiety.', clinic: 'Weight-management interest.', color: '#FFA300' },
  { name: 'Cerebrolysin', category: 'Cognitive', mechanism: 'Brain & neurological research.', clinic: 'Cognition, memory & neurorecovery interest.', color: '#009CA6' },
  { name: 'CJC-1295', category: 'GH Secretagogue', mechanism: 'GHRH analog with extended half-life. GH/IGF-1 support research.', clinic: 'Sustained GH release, fat loss, lean muscle retention. Body Composition.', color: '#93328E' },
  { name: 'Dihexa', category: 'Cognitive', mechanism: 'Angiotensin IV analog.', clinic: 'Synaptogenesis, memory consolidation, brain injury recovery.', color: '#001770' },
  { name: 'DSIP', category: 'Cognitive', mechanism: 'Sleep research.', clinic: 'Deeper/restorative sleep & stress-recovery interest.', color: '#7586C7' },
  { name: 'Epitalon', category: 'Longevity', mechanism: 'Telomerase activator. Longevity research.', clinic: 'Cellular aging, telomeres & circadian/sleep interest.', color: '#A2AAAC' },
  { name: 'GHK-Cu', category: 'Cosmetic / Healing', mechanism: 'Copper-binding peptide; stimulates fibroblasts. Anti-Aging.', clinic: 'Skin & hair favourite, collagen support, wound healing.', color: '#B95826' },
  { name: 'Glutathione', category: 'Antioxidant', mechanism: 'Powerful Antioxidant, Detoxification.', clinic: 'Oxidative Stress Support.', color: '#8B4699' },
  { name: 'Hexarelin', category: 'Recovery', mechanism: 'Potent GH-secretagogue research.', clinic: 'Recovery, lean-mass & performance interest.', color: '#582B82' },
  { name: 'IGF-1 LR3', category: 'Recovery', mechanism: 'Growth-signaling research.', clinic: 'Muscle growth, recovery & nutrient-partitioning interest.', color: '#005DB8' },
  { name: 'Ipamorelin', category: 'GH Secretagogue', mechanism: 'Selective GHRP (no cortisol/prolactin spike). GH-release research.', clinic: 'Clean GH pulse, improved sleep architecture, recovery.', color: '#675BC7' },
  { name: 'Kisspeptin-10', category: 'Endocrine', mechanism: 'GnRH stimulator.', clinic: 'Testosterone regulation, fertility support, libido.', color: '#D60070' },
  { name: 'KPV', category: 'Immune', mechanism: 'Anti-Inflammatory, Immune Modulation.', clinic: 'Gut & Skin Support.', color: '#FFCC00' },
  { name: 'Liraglutide', category: 'Metabolic', mechanism: 'GLP-1 therapy, appetite control, glucose management.', clinic: 'Weight management.', color: '#FF661F' },
  { name: 'LL-37', category: 'Immune', mechanism: 'Innate-immunity research, antimicrobial activity.', clinic: 'Immune defence & wound-healing interest.', color: '#83BD00' },
  { name: 'Melanotan II', category: 'Pigmentation', mechanism: 'Alpha-MSH analog.', clinic: 'Melanin production (tanning), appetite suppression, spontaneous arousal.', color: '#5D3821' },
  { name: 'MK-677 / Ibutamoren', category: 'Recovery', mechanism: 'GH/IGF-1 secretagogue, not a peptide.', clinic: 'Sleep, recovery, appetite & lean-mass interest.', color: '#7C868E' },
  { name: 'MOTS-c', category: 'Mitochondrial', mechanism: 'Mitochondrial-derived peptide (MDP).', clinic: 'Metabolic health, energy, exercise & healthy-aging interest.', color: '#EF3340' },
  { name: 'NAD+', category: 'Energy', mechanism: 'Cellular-energy & longevity interest, not a peptide. DNA Repair Support.', clinic: 'Mitochondrial function & metabolic support.', color: '#EC8B00' },
  { name: 'PT-141 (Bremelanotide)', category: 'Sexual Health', mechanism: 'Melanocortin receptor agonist.', clinic: 'Erectile dysfunction, female sexual arousal disorder.', color: '#FF585C' },
  { name: 'Retatrutide', category: 'Metabolic', mechanism: 'Triple-hormone metabolic drug. Triple Agonist.', clinic: 'Weight-loss, appetite & metabolic-health interest.', color: '#FA4516' },
  { name: 'Selank', category: 'Cognitive', mechanism: 'Tuftsin analog. Calm-focus research.', clinic: 'Anxiety/stress resilience, mood & cognition interest.', color: '#40B5E6' },
  { name: 'Semaglutide', category: 'Metabolic', mechanism: 'GLP-1 analogue, appetite control. Blood Sugar Support.', clinic: 'Weight management & metabolic/glucose health.', color: '#DF3C31' },
  { name: 'Semax', category: 'Cognitive', mechanism: 'ACTH (4-10) analog. Nootropic research.', clinic: 'Focus, mental energy, memory & neuroprotection interest.', color: '#0C2340' },
  { name: 'Sermorelin', category: 'GH Secretagogue', mechanism: 'GHRH analog (shorter half-life).', clinic: 'Baseline GH restoration, anti-aging, sleep improvement.', color: '#DF457B' },
  { name: 'TB-500', category: 'Tissue Repair', mechanism: 'Synthetic fraction of Thymosin Beta-4; actin upregulation.', clinic: 'Soft-tissue repair, flexibility, mobility & wound healing.', color: '#C1D82E' },
  { name: 'Tesamorelin', category: 'GH Secretagogue', mechanism: 'GHRH analog. GH Release.', clinic: 'Visceral-fat reduction, GH/IGF-1 & body-composition interest.', color: '#502967' },
  { name: 'Thymogen', category: 'Immune', mechanism: 'Immune-regulation research, immune signaling.', clinic: 'Immune-response interest.', color: '#009538' },
  { name: 'Thymosin Alpha-1', category: 'Immune Modulation', mechanism: 'T-cell maturation and stimulation. Immune-modulation research.', clinic: 'Immune resilience & infection-response interest.', color: '#00B1A8' },
  { name: 'Thymulin', category: 'Immune', mechanism: 'Immune-regulation research, T-cell signaling.', clinic: 'Inflammation & immune-balance interest.', color: '#009944' },
  { name: 'Tirzepatide', category: 'Metabolic', mechanism: 'GIP/GLP-1 analogue, appetite reduction. Dual Agonist.', clinic: 'Substantial weight management & metabolic/glucose health.', color: '#B90C2E' }
];

// â”€â”€ Curated home-exercise library (dumbbell / no-equipment) â”€â”€
const EXERCISE_LIBRARY = [
  { name: 'Push-ups', activity: 'strength', sets: 4, reps: 15, description: 'Foundational upper-body push movement. Builds chest, shoulders, triceps and core stability.', howto: 'Start in a high plank with hands shoulder-width apart. Lower your chest toward the floor keeping a straight line from head to heels, elbows at ~45°. Push back up to full arm extension. Scale down by supporting on knees if needed.' },
  { name: 'Squats (bodyweight)', activity: 'strength', sets: 4, reps: 20, description: 'Lower-body strength builder targeting the quads, glutes and hamstrings.', howto: 'Stand with feet shoulder-width, toes slightly out. Sit the hips back and down as if into a chair, keep the chest up, then drive through the heels to stand. Keep knees tracking over the toes.' },
  { name: 'Lunges', activity: 'strength', sets: 3, reps: 15, description: 'Unilateral leg exercise improving single-leg strength, balance and hip stability.', howto: 'Step forward into a lunge, lowering the back knee toward the floor while the front thigh ends roughly parallel. Push off the front foot to return. Alternate legs each rep.' },
  { name: 'Plank hold', activity: 'core', sets: 3, reps: 60, description: 'Isometric core hold building trunk stability and posture endurance.', howto: 'Assume a forearm plank with elbows under shoulders. Brace the core and glutes so the body forms a straight line from head to heels. Hold for the target time without letting the hips sag.' },
  { name: 'Glute bridge', activity: 'strength', sets: 4, reps: 15, description: 'Glute and hamstring activation while reinforcing posterior-chain strength.', howto: 'Lie on your back, feet flat and hip-width. Drive through the heels to lift the hips until the body forms a line from shoulders to knees, squeeze the glutes at the top, then lower slowly.' },
  { name: 'Burpees', activity: 'cardio', sets: 3, reps: 12, description: 'Full-body conditioning and heart-rate builder combining squat, plank and jump.', howto: 'From standing, squat to the floor, jump or step the feet back to a plank, drop to a push-up (optional), jump the feet back in and leap up with a small jump. Keep it continuous and controlled.' },
  { name: 'Mountain climbers', activity: 'cardio', sets: 4, reps: 30, description: 'Dynamic core and cardio move driven by quick alternating knee drives.', howto: 'From a high plank, drive one knee toward the chest, then switch legs rapidly as if running in place. Keep the hips level and the core braced for the whole set.' },
  { name: 'High knees', activity: 'cardio', sets: 3, reps: 45, description: 'Lower-intensity cardio that raises heart rate and improves rhythm.', howto: 'March or jog on the spot while driving each knee up to hip height. Keep an upright torso and pump the arms in time. Move faster as your form stays consistent.' },
  { name: 'Star jumps', activity: 'cardio', sets: 4, reps: 20, description: 'Explosive full-body jump for conditioning, power and mobility.', howto: 'Start with feet together and arms at your sides. Jump while spreading feet wide and raising both arms overhead to form an X, then land softly and return to the start.' },
  { name: 'Dumbbell goblet squat', activity: 'strength', sets: 4, reps: 12, description: 'Weighted squat variation strengthening the legs and upper back.', howto: 'Hold a dumbbell at your chest with both hands. Squat down with back straight and elbows inside the knees, then drive back up to standing. Keep the weight close to the chest.' },
  { name: 'Dumbbell shoulder press', activity: 'strength', sets: 4, reps: 10, description: 'Vertical press building shoulder and upper-arm strength.', howto: 'Sit or stand with a dumbbell in each hand at shoulder height. Press overhead until the arms are straight, keeping the core braced, then lower back with control.' },
  { name: 'Dumbbell bicep curl', activity: 'strength', sets: 4, reps: 12, description: 'Isolates the biceps for arm strength and size.', howto: 'Stand with a dumbbell in each hand, palms facing forward. Curl the weights toward your shoulders without swinging the elbows, then lower slowly under control.' },
  { name: 'Dumbbell row', activity: 'strength', sets: 4, reps: 12, description: 'Horizontal pulling for the back, rear shoulders and grip strength.', howto: 'Hinge forward with a flat back, holding a dumbbell in each hand. Pull the weights toward your hips, squeezing the shoulder blades, then lower under control.' },
  { name: 'Dumbbell deadlift', activity: 'strength', sets: 4, reps: 10, description: 'Hip-hinge strength targeting the posterior chain and grip.', howto: 'Stand with dumbbells at your thighs. Push the hips back and lower the weights toward the floor, keeping a flat back, then stand tall by driving the hips forward and squeezing glutes.' },
  { name: 'Dumbbell chest press', activity: 'strength', sets: 4, reps: 12, description: 'Horizontal press for chest, triceps and shoulder strength.', howto: 'Lie on a bench holding a dumbbell in each hand above your chest. Lower the weights to the sides of your chest, then press back up to full extension.' },
  { name: 'Dumbbell lateral raise', activity: 'strength', sets: 4, reps: 12, description: 'Isolation move for the side deltoids to widen the shoulder line.', howto: 'Stand with a dumbbell in each hand at your sides. Raise the arms out to the sides till shoulder height, leading with the elbows, then lower slowly without momentum.' },
  { name: 'Dumbbell reverse fly', activity: 'strength', sets: 3, reps: 12, description: 'Trains the rear deltoids and upper-back posture muscles.', howto: 'Hinge forward with a flat back, dumbbells hanging. Open the arms out to the sides keeping a slight elbow bend, then lower with control.' },
  { name: 'Dumbbell tricep extension', activity: 'strength', sets: 3, reps: 12, description: 'Extends the triceps straighten to build upper-arm mass.', howto: 'Hold one dumbbell overhead with both hands. Lower it behind your head by bending the elbows, keeping the elbows pointing up, then extend back overhead.' },
  { name: 'Dumbbell farmer carry', activity: 'cardio', sets: 4, reps: 60, description: 'Loaded walk for grip, core and posture endurance and conditioning.', howto: 'Hold a heavy dumbbell in each hand with shoulders pulled back. Walk upright in a straight line for the allotted time, swapping sides if you go far.' },
  { name: 'Dumbbell renegade row', activity: 'strength', sets: 3, reps: 10, description: 'Plank-based row combining core stability with back pulling.', howto: 'From a high plank with a dumbbell in each hand, row one weight to your ribs while the body stays level, then switch sides after the rep pattern.' },
  { name: 'Bulgarian split squat', activity: 'strength', sets: 3, reps: 10, description: 'Single-leg squat building lower-body strength and stability.', howto: 'Place your rear foot on a bench or surface. Lower straight up and increase the strength of the hips until the front thigh is about level, then drive back up through the front leg alone.' },
  { name: 'Side plank', activity: 'core', sets: 3, reps: 40, description: 'Lateral core stability for the obliques and the side body.', howto: 'Lie on your side propped on your forearm with feet stacked. Lift your hips so the body forms a straight line and hold. Keep the elbow under the shoulder.' },
  { name: 'Dead bug', activity: 'core', sets: 3, reps: 12, description: 'Anti-extension core move strengthening the deep core without hip posting.', howto: 'Lie on your back, arms to the ceiling and knees bent at 90°. Slowly lower the opposite arm and leg toward the floor while keeping the lower back pressed down, then return.' },
  { name: 'Russian twist (weighted)', activity: 'core', sets: 3, reps: 20, description: 'Rotational core work for the obliques.', howto: 'Sit with knees bent and feet hovering. Rotate the torso side to side while holding a weight, tapping the floor beside each hip while keeping the chest lifted.' },
  { name: 'Step-ups', activity: 'strength', sets: 4, reps: 12, description: 'Stair-style unilateral leg strength and balance exercise.', howto: 'Step one foot onto a sturdy surface, drive through that leg to bring the other foot up, then steps. alternate legs and keep the hips square.' },
  { name: 'Calf raises', activity: 'strength', sets: 4, reps: 20, description: 'Isolates the calf and soleus for ankle strength and definition.', howto: 'Stand tall and rise onto the balls of your feet as high as possible, hold briefly, then lower the heels, under control. Add weight in a goblet position to progress.' },
  { name: 'Band pull-apart', activity: 'mobility', sets: 3, reps: 15, description: 'Stretches and strengthens the upper back and rear delts for posture.', howto: 'Hold a light band at chest height with both hands this width. Keeping the arms straight, pull the band outward until the shoulder blades squeeze, then return slowly.' },
  { name: 'Cat-cow stretch', activity: 'mobility', sets: 2, reps: 12, description: 'Spinal mobility drill to warm up the back and core.', howto: 'On all fours, alternate arching the back (cow) and rounding it (cat) by timing the movement with breathing and moving the tailbone with the head.' }
];

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'alcohol'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', alcohol: 'Alcohol' };
const MEAL_CLASS = { breakfast: 'meal-breakfast', lunch: 'meal-lunch', dinner: 'meal-dinner', snack: 'meal-snack', alcohol: 'meal-alcohol' };
const MEAL_COLOR = { breakfast: '#ffd98a', lunch: '#8fd3ff', dinner: '#ff9db0', snack: '#b9a6ff', alcohol: '#ffbea6' };
const ACTIVITY_LABELS = { strength: 'Strength', cardio: 'Cardio', mobility: 'Mobility', core: 'Core', other: 'Other' };

// â”€â”€ date helpers â”€â”€
function pad2(n) { return String(n).padStart(2, '0'); }
function toDateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function keyToDate(key) {
  const p = String(key).split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}
function todayKey() { return toDateKey(new Date()); }
function shiftDate(d, days) { const c = new Date(d); c.setDate(c.getDate() + days); return c; }
function fmtDateLabel(d) { return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }

// â”€â”€ cache helpers â”€â”€
function loadPeptides() { return dbCache.peptides || (dbCache.peptides = []); }
function savePeptides(l) { dbCache.peptides = l; queueDbWrite(); }
function loadExercises() { return dbCache.exercises || (dbCache.exercises = []); }
function saveExercises(l) { dbCache.exercises = l; queueDbWrite(); }
function loadDiet() { return dbCache.diet || (dbCache.diet = {}); }
function saveDiet(d) { dbCache.diet = d; queueDbWrite(); }
function getPeptideMeta(name) {
  return PEPTIDE_LIBRARY.find((p) => p.name === name) || { name, category: 'Custom', mechanism: '', clinic: '', color: '#f2186b' };
}
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// â”€â”€ routing â”€â”€
let activeView = 'dashboard';
let currentDay = todayKey();
let dietCursor = todayKey();

function initNewPages() {
  document.querySelectorAll('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
  initSchedule();
}

function showView(view) {
  activeView = view;
  document.querySelectorAll('.view-page').forEach((page) => page.classList.toggle('hidden', page.id !== 'view-' + view));
  document.querySelectorAll('.nav-link').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  if (view === 'calendar') renderCalendar();
  else if (view === 'diet') renderDiet();
  else if (view === 'peptides') { renderPeptideProfile(); renderPeptideSchedule(); refreshPepDoseSelect(); }
  else if (view === 'exercise') { renderLibrary(); renderExerciseLog(); }
}

// â•â•â•â•â•â•â•â•â•â•â•â• PEPTIDES â•â•â•â•â•â•â•â•â•â•â•â•
function wirePeptideForm() {
  const add = document.getElementById('pepAddBtn'); if (add) add.addEventListener('click', addPeptideToProfile);
  const search = document.getElementById('pepSearch'); if (search) search.addEventListener('input', applyPeptideFilter);
  const form = document.getElementById('pepForm'); if (form) form.addEventListener('submit', schedulePeptide);
}
function populatePeptideSelect() {
  const sel = document.getElementById('pepSelect'); if (!sel) return;
  sel.innerHTML = '';
  PEPTIDE_LIBRARY.forEach((p) => {
    const o = document.createElement('option'); o.value = p.name; o.textContent = p.name; sel.appendChild(o);
  });
  refreshPepDoseSelect();
}
function refreshPepDoseSelect() {
  const sel = document.getElementById('pepDoseSelect'); if (!sel) return;
  sel.innerHTML = '';
  const profile = loadPeptides();
  if (!profile.length) {
    const o = document.createElement('option'); o.value = ''; o.textContent = 'Add a compound to your protocol first'; sel.appendChild(o);
  } else {
    profile.forEach((e) => { const o = document.createElement('option'); o.value = e.name; o.textContent = e.name; sel.appendChild(o); });
  }
}
function applyPeptideFilter() {
  const q = (document.getElementById('pepSearch').value || '').toLowerCase().trim();
  const sel = document.getElementById('pepSelect'); if (!sel) return;
  Array.from(sel.options).forEach((opt) => { opt.hidden = q ? !opt.textContent.toLowerCase().includes(q) : false; });
}
function addPeptideToProfile() {
  const sel = document.getElementById('pepSelect'); if (!sel || !sel.value) return;
  const name = sel.value;
  if (loadPeptides().some((p) => p.name === name)) { alert('That compound is already in your protocol.'); return; }
  loadPeptides().push({ name, addedAt: new Date().toISOString() });
  savePeptides(loadPeptides());
  renderPeptideProfile();
  refreshPepDoseSelect();
}
function removePeptideFromProfile(name) {
  if (!confirm('Remove ' + name + ' from your protocol?')) return;
  savePeptides(loadPeptides().filter((p) => p.name !== name));
  renderPeptideProfile();
  renderPeptideSchedule();
  refreshPepDoseSelect();
}
function renderPeptideProfile() {
  const el = document.getElementById('pepProfile'); if (!el) return;
  const profile = loadPeptides();
  const badge = document.getElementById('pepProtocolCount');
  if (badge) badge.textContent = profile.length + (profile.length === 1 ? ' compound' : ' compounds');
  if (!profile.length) { el.innerHTML = '<p class="dc-empty">No compounds added yet. Pick one above and press â€œAdd to protocolâ€.</p>'; return; }
  el.innerHTML = '';
  profile.forEach((entry) => {
    const meta = getPeptideMeta(entry.name);
    const chip = document.createElement('div');
    chip.className = 'pep-chip';
    chip.innerHTML = '<span class="pc-swatch" style="background:' + meta.color + '"></span>'
      + '<div class="pc-main"><b>' + escHtml(entry.name) + '</b><span>' + escHtml(meta.category || '')
      + (meta.mechanism ? ' Â· ' + escHtml(meta.mechanism) : '') + '</span></div>'
      + '<button type="button" class="pc-del" title="Remove" aria-label="Remove ' + escHtml(entry.name) + '">âœ•</button>';
    chip.querySelector('.pc-del').addEventListener('click', () => removePeptideFromProfile(entry.name));
    el.appendChild(chip);
  });
}
function schedulePeptide(event) {
  event.preventDefault();
  const nameSel = document.getElementById('pepDoseSelect');
  const dateInput = document.getElementById('pepDoseDate');
  if (!nameSel || !dateInput || !nameSel.value || !dateInput.value) return;
  const timeInput = document.getElementById('pepDoseTime');
  const doseInput = document.getElementById('pepDose');
  const noteInput = document.getElementById('pepNote');
  const meta = getPeptideMeta(nameSel.value);
  loadPeptides().push({
    name: nameSel.value, date: dateInput.value,
    time: timeInput ? timeInput.value || '' : '',
    dose: doseInput ? doseInput.value.trim() : '',
    note: noteInput ? noteInput.value.trim() : '',
    color: meta.color, complete: false, createdAt: new Date().toISOString()
  });
  savePeptides(loadPeptides());
  if (doseInput) doseInput.value = '';
  if (noteInput) noteInput.value = '';
  renderPeptideSchedule();
  alert('Dose scheduled.');
}
function togglePeptideComplete(createdAt) {
  const list = loadPeptides();
  const item = list.find((p) => p.createdAt === createdAt);
  if (item) item.complete = !item.complete;
  savePeptides(list); renderPeptideSchedule(); if (activeView === 'calendar') renderCalendar();
}
function deletePeptideEntry(createdAt) {
  if (!confirm('Delete this scheduled dose?')) return;
  savePeptides(loadPeptides().filter((p) => p.createdAt !== createdAt));
  renderPeptideSchedule(); if (activeView === 'calendar') renderCalendar();
}
function renderPeptideSchedule() {
  const el = document.getElementById('pepSchedule'); if (!el) return;
  const list = loadPeptides().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!list.length) { el.innerHTML = '<p class="cal-empty">No scheduled doses yet. Use the form to schedule one.</p>'; return; }
  el.innerHTML = '';
  list.forEach((entry) => {
    const meta = getPeptideMeta(entry.name);
    const card = document.createElement('div');
    card.className = 'pep-entry' + (entry.complete ? ' complete' : '');
    card.innerHTML = '<div class="pe-top">'
      + '<input type="checkbox" class="pe-check" ' + (entry.complete ? 'checked ' : '') + 'aria-label="Mark complete" />'
      + '<span class="pe-swatch" style="background:' + meta.color + '"></span>'
      + '<div class="pe-main"><b>' + escHtml(entry.name) + '</b><span>' + escHtml(entry.date || '')
      + (entry.time ? ' Â· ' + escHtml(entry.time) : '') + (entry.dose ? ' Â· ' + escHtml(entry.dose) : '')
      + (entry.complete ? ' Â· done' : '') + '</span></div>'
      + '<button type="button" class="pe-del" aria-label="Delete">Ã—</button></div>'
      + (entry.note ? '<div class="pe-note">' + escHtml(entry.note) + '</div>' : '');
    card.querySelector('.pe-check').addEventListener('change', () => togglePeptideComplete(entry.createdAt));
    card.querySelector('.pe-del').addEventListener('click', () => deletePeptideEntry(entry.createdAt));
    el.appendChild(card);
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â• EXERCISE â•â•â•â•â•â•â•â•â•â•â•â•
function wireExerciseForm() {
  const search = document.getElementById('exSearch'); if (search) search.addEventListener('input', renderLibraryFiltered);
  const shared = document.getElementById('exSharedOnly'); if (shared) shared.addEventListener('change', renderLibraryFiltered);
  const form = document.getElementById('exForm'); if (form) form.addEventListener('submit', addExerciseEntry);
}
function renderLibrary() {
  const total = exCommunity().length;
  const badge = document.getElementById('exLibraryCount');
  if (badge) badge.textContent = total + (total === 1 ? ' exercise' : ' exercises');
  renderLibraryFiltered();
}

// ---- Shared (community) + per-user library state ----
// Shared exercises live in HT_exercise_library (Supabase). The curated EXERCISE_LIBRARY
// acts as the offline seed/fallback. Never-shared user exercises live in exMy and are
// persisted to the user's own profile row so they survive reloads.
let exSharedCache = [];        // exercises loaded from HT_exercise_library
let exMy = [];                 // the signed-in user's own (non-shared) library
let exFavs = [];               // lowercased names of favourited exercises
let exFavUndo = {};            // name -> {timer, interval, left}
const exFavGraceSec = 5;       // countdown before an un-favourited card leaves Favourites

// Deduped union: curated seed + community rows + the user's own (non-shared) library.
function exCommunity() {
  const out = [];
  const seen = {};
  const sources = [].concat(EXERCISE_LIBRARY, exSharedCache, exMy);
  sources.forEach((e) => {
    if (!e || !e.name) return;
    const k = String(e.name).toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push(e);
  });
  return out;
}

function currentExScope() {
  const a = document.querySelector('#exScopeFilters .ex-filter-pill.active');
  return a ? a.dataset.scope : 'shared';
}
function currentExType() {
  const a = document.querySelector('#exTypeFilters .ex-filter-pill.active');
  return a ? a.dataset.type : 'all';
}

function renderLibraryFiltered() {
  const q = (document.getElementById('exSearch').value || '').toLowerCase().trim();
  const scope = currentExScope();
  const type = currentExType();
  const all = exCommunity();
  const sharedNames = {};
  [].concat(EXERCISE_LIBRARY, exSharedCache).forEach((e) => { if (e && e.name) sharedNames[String(e.name).toLowerCase()] = true; });
  const mineNames = {};
  exMy.forEach((m) => { if (m && m.name) mineNames[String(m.name).toLowerCase()] = true; });
  let src = all;
  if (scope === 'shared') src = src.filter((e) => sharedNames[String(e.name || '').toLowerCase()]);
  if (scope === 'mine') src = src.filter((e) => mineNames[String(e.name || '').toLowerCase()]);
  if (scope === 'favs') src = src.filter((e) => exFavs.indexOf(String(e.name || '').toLowerCase()) !== -1);
  if (type !== 'all') src = src.filter((e) => (e.activity || 'other') === type);
  if (q) src = src.filter((e) => (e.name || '').toLowerCase().includes(q));
  const badge = document.getElementById('exLibraryCount');
  if (badge) badge.textContent = all.length + (all.length === 1 ? ' exercise' : ' exercises');
  renderLibraryBase(src);
}

function renderLibraryBase(source) {
  // Favourites section pinned above the main grid (skipped when the filter is already Favourites).
  if (currentExScope() !== 'favs') renderFavs();
  const grid = document.getElementById('exLibrary');
  if (!grid) return;
  grid.innerHTML = '';
  if (!source.length) { grid.innerHTML = '<p class="ex-empty">No exercises match your filter.</p>'; return; }
  const frag = document.createDocumentFragment();
  source.forEach((entry) => frag.appendChild(buildExerciseCard(entry)));
  grid.appendChild(frag);
}

// Declarative card renderer. Rebuilding is cheap, so favourites/undo redraw cleanly.
function buildExerciseCard(entry) {
  const name = String(entry.name || 'Unnamed');
  const key = name.toLowerCase();
  const faved = exFavs.indexOf(key) !== -1;
  const undo = exFavUndo[key];
  const card = document.createElement('div');
  card.className = 'ex-card' + (faved ? ' faved' : '');
  card.setAttribute('data-ex-key', key);
  card.innerHTML =
    '<div class="ec-top"><h4>' + escHtml(name) + '</h4>'
    + '<button type="button" class="ex-fav-toggle' + (faved ? ' faved' : '') + '" data-key="' + escHtml(key) + '" aria-label="' + (faved ? 'Remove from favourites' : 'Add to favourites') + '">' + (faved ? '♥' : '♡') + '</button></div>'
    + '<div class="ec-meta"><span class="ec-tag">' + escHtml(ACTIVITY_LABELS[entry.activity] || entry.activity || 'Other') + '</span><span>Sets ' + (entry.sets || 0) + '</span><span>Reps ' + (entry.reps || 0) + '</span></div>'
    + (undo ? '<div class="ex-fav-undo">Removing in ' + undo.left + 's <button type="button" class="ex-undo-keep" data-key="' + escHtml(key) + '">Undo</button></div>' : '')
    + '<button type="button" class="ex-more-info" data-key="' + escHtml(key) + '">more info</button>'
    + '<div class="ex-day-row" data-key="' + escHtml(key) + '" aria-label="Days of the week"><span class="ex-day-label">Days</span>'
    + ['S','M','T','W','T','F','S'].map(function (lbl, i) { return '<button type="button" class="ex-day" data-day="' + i + '" aria-label="' + lbl + '">' + lbl + '</button>'; }).join('')
    + '</div>'
    + '<button type="button" class="ec-schedule" data-key="' + escHtml(key) + '">Schedule this workout</button>';

  card.querySelector('.ex-fav-toggle').addEventListener('click', (ev) => { ev.stopPropagation(); toggleFavourite(key); });
  const undoBtn = card.querySelector('.ex-undo-keep');
  if (undoBtn) undoBtn.addEventListener('click', (ev) => { ev.stopPropagation(); cancelFavUndo(key); });
  card.querySelector('.ex-more-info').addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); openExerciseInfo(entry); });
  card.querySelectorAll('.ex-day').forEach(function (b) { b.addEventListener('click', (ev) => { ev.stopPropagation(); b.classList.toggle('on'); }); });
  const schedBtn = card.querySelector('.ec-schedule');
  if (schedBtn) schedBtn.addEventListener('click', (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const sel = Array.prototype.map.call(card.querySelectorAll('.ex-day.on'), function (b) { return Number(b.getAttribute('data-day')); });
    if (!sel.length) { alert('Select at least one day, then click Schedule.'); return; }
    scheduleExerciseFromCard(entry, sel);
  });
  return card;
}

// "Schedule this workout": prefill the Exercise schedule form (title/activity/sets/reps
// + the chosen day checkboxes), then scroll the user to the form so they can finish and Add.
// `days` are 0..6 (Sun..Sat), matching Date.getDay().
function scheduleExerciseFromCard(entry, days) {
  setSchedVal('Title', 'Ex', entry.name || '');
  setSchedVal('ExActivity', 'Ex', entry.activity || 'other');
  setSchedVal('ExSets', 'Ex', entry.sets || 0);
  setSchedVal('ExReps', 'Ex', entry.reps || 0);
  const startEl = document.getElementById('schedStartEx');
  if (startEl && !startEl.value) startEl.value = fmtKey(weekStart(new Date()));
  document.querySelectorAll('.schedDayEx').forEach(function (cb) { cb.checked = days.indexOf(Number(cb.value)) !== -1; });
  const form = document.querySelector('#view-exercise .sched-form');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const titleEl = document.getElementById('schedTitleEx');
  if (titleEl) titleEl.focus();
}
function setSchedVal(name, sfx, val) {
  const el = document.getElementById('sched' + name + sfx);
  if (el) el.value = val;
}

// ---- Exercise info modal (purpose + how-to + up to 3 future image slots) ----
function openExerciseInfo(entry) {
  const bd = document.getElementById('exInfoBackdrop'); if (!bd) return;
  document.getElementById('exInfoTitle').textContent = entry.name || 'Exercise';
  const meta = document.getElementById('exInfoMeta');
  if (meta) {
    meta.innerHTML = '<span class="ec-tag">' + escHtml(ACTIVITY_LABELS[entry.activity] || entry.activity || 'Other') + '</span>'
      + '<span>Sets ' + (entry.sets || 0) + '</span><span>Reps ' + (entry.reps || 0) + '</span>';
  }
  const purpose = document.getElementById('exInfoPurpose'); if (purpose) purpose.textContent = entry.description || 'No description added yet.';
  const howto = document.getElementById('exInfoHowto'); if (howto) howto.textContent = entry.howto || 'No instructions added yet.';
  ['exImgSlot0', 'exImgSlot1', 'exImgSlot2'].forEach(function (id) { const el = document.getElementById(id); if (el) el.textContent = 'Image coming soon'; });
  bd.classList.remove('hidden');
}
function closeExerciseInfo() { const bd = document.getElementById('exInfoBackdrop'); if (bd) bd.classList.add('hidden'); }

// ---- Reusable confirm modal (used by schedule deletes) ----
let confirmCb = null;
function openConfirm(message, onOk) {
  const bd = document.getElementById('confirmBackdrop');
  if (!bd) { if (window.confirm(message)) onOk(); return; }
  const msg = document.getElementById('confirmMsg'); if (msg) msg.textContent = message;
  confirmCb = onOk;
  bd.classList.remove('hidden');
}
function closeConfirm() { const bd = document.getElementById('confirmBackdrop'); if (bd) bd.classList.add('hidden'); confirmCb = null; }
function wireConfirmModal() {
  const ok = document.getElementById('confirmOk');
  const cancel = document.getElementById('confirmCancel');
  const close = document.getElementById('confirmClose');
  const bd = document.getElementById('confirmBackdrop');
  if (ok) ok.addEventListener('click', function () { const cb = confirmCb; closeConfirm(); if (cb) cb(); });
  if (cancel) cancel.addEventListener('click', closeConfirm);
  if (close) close.addEventListener('click', closeConfirm);
  if (bd) bd.addEventListener('click', function (ev) { if (ev.target === bd) closeConfirm(); });
}
function wireInfoModal() {
  const close = document.getElementById('exInfoClose');
  const bd = document.getElementById('exInfoBackdrop');
  if (close) close.addEventListener('click', closeExerciseInfo);
  if (bd) bd.addEventListener('click', function (ev) { if (ev.target === bd) closeExerciseInfo(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { closeExerciseInfo(); closeConfirm(); } });
}

// Favourites section pinned above the list. Un-favouriting starts a per-card countdown;
// when it lapses, only that card is removed. Other pending countdowns are untouched.
function renderFavs() {
  const host = document.getElementById('exFavSection');
  if (!host) return;
  if (!exFavs.length) { host.innerHTML = ''; return; }
  const items = exCommunity().filter((e) => exFavs.indexOf(String(e.name || '').toLowerCase()) !== -1);
  if (!items.length) { host.innerHTML = ''; return; }
  const frag = document.createDocumentFragment();
  const title = document.createElement('div');
  title.className = 'ex-fav-title';
  title.textContent = 'Favourites';
  frag.appendChild(title);
  const grid = document.createElement('div');
  grid.className = 'ex-library';
  const gfrag = document.createDocumentFragment();
  items.forEach((entry) => gfrag.appendChild(buildExerciseCard(entry)));
  grid.appendChild(gfrag);
  frag.appendChild(grid);
  host.innerHTML = '';
  host.appendChild(frag);
}

function toggleFavourite(key) {
  key = String(key || '').toLowerCase();
  const item = exCommunity().find((e) => String(e.name || '').toLowerCase() === key);
  if (!item || !item.name) return;
  const idx = exFavs.indexOf(key);
  if (idx !== -1) {
    // Un-favourite: begin a per-card countdown before it leaves the Favourites section.
    if (!exFavUndo[key]) startFavUndo(key);
  } else {
    cancelFavUndo(key);
    exFavs.push(key);
    persistFavs();
    renderLibraryFiltered();
  }
}

function startFavUndo(key) {
  const u = { left: exFavGraceSec, timer: null, interval: null };
  exFavUndo[key] = u;
  u.interval = setInterval(() => {
    const state = exFavUndo[key];
    if (!state) return;
    state.left -= 1;
    if (state.left <= 0) {
      clearInterval(state.interval);
      clearTimeout(state.timer);
      removeFavAndReflow(key);
    } else {
      renderFavs();
    }
  }, 1000);
  u.timer = setTimeout(() => {
    const state = exFavUndo[key];
    if (state) clearInterval(state.interval);
    removeFavAndReflow(key);
  }, exFavGraceSec * 1000);
  renderFavs();
}

// Removes only this key from Favourites; other cards/countdowns are not disturbed.
function removeFavAndReflow(key) {
  const remIdx = exFavs.indexOf(key);
  if (remIdx !== -1) exFavs.splice(remIdx, 1);
  delete exFavUndo[key];
  persistFavs();
  renderFavs();
  renderLibraryFiltered();
}

function cancelFavUndo(key) {
  const u = exFavUndo[key];
  if (!u) return;
  clearInterval(u.interval);
  clearTimeout(u.timer);
  delete exFavUndo[key];
  renderFavs();
  renderLibraryFiltered();
}

// ---- Favourites + my-library persistence (per-user, stored in the profile row) ----
function persistFavs() {
  const p = loadProfile();
  p.exerciseFavs = exFavs.slice();
  saveProfile(p);
}
function loadExFavs() {
  const p = loadProfile();
  exFavs = Array.isArray(p.exerciseFavs) ? p.exerciseFavs.slice() : [];
}
function loadMyLibrary() {
  const p = loadProfile();
  exMy = Array.isArray(p.exerciseLibrary) ? p.exerciseLibrary.slice() : [];
}
function persistMyLibrary() {
  const p = loadProfile();
  p.exerciseLibrary = exMy.slice();
  saveProfile(p);
}

// Load shared/community exercises from HT_exercise_library (Supabase).
// Best-effort: the curated EXERCISE_LIBRARY const stays the offline fallback.
async function loadSharedExercises() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient.from(DB_SHARED('exercise_library')).select('*');
    if (!error && Array.isArray(data)) {
      // Merge curated text into any DB rows that lack a description/howto, and
      // upsert the curated set so existing exercises carry rich text in Supabase.
      const byName = {};
      data.forEach((r) => { byName[String(r.name || '').toLowerCase()] = r; });
      const toUpsert = [];
      EXERCISE_LIBRARY.forEach((cur) => {
        const k = String(cur.name || '').toLowerCase();
        const row = byName[k];
        if (row && row.description && row.howto) return; // already rich
        toUpsert.push({ name: cur.name, activity: cur.activity, sets: cur.sets, reps: cur.reps, description: cur.description || '', howto: cur.howto || '' });
      });
      if (toUpsert.length) {
        supabaseClient.from(DB_SHARED('exercise_library')).upsert(toUpsert, { onConflict: 'name' })
          .then(({ error: uErr }) => { if (uErr) console.warn('HT_exercise_library self-seed skipped', uErr.message); })
          .catch((err) => console.warn('HT_exercise_library self-seed error', err.message));
      }
      exSharedCache = data.map((r) => ({
        name: r.name,
        activity: r.activity || 'other',
        sets: r.sets || 0,
        reps: r.reps || 0,
        description: r.description || '',
        howto: r.howto || '',
        shared: true
      }));
      renderLibrary();
    }
  } catch (err) {
    console.warn('HT_exercise_library load failed (schema ready?)', err.message);
  }
}
function openExerciseModal() {
  const bd = document.getElementById('exModalBackdrop');
  if (bd) bd.classList.remove('hidden');
  const name = document.getElementById('exNewName');
  if (name) name.focus();
}
function closeExerciseModal() {
  const bd = document.getElementById('exModalBackdrop');
  if (bd) bd.classList.add('hidden');
}
function wireExerciseModal() {
  const openBtn = document.getElementById('exAddBtn');
  if (openBtn) openBtn.addEventListener('click', openExerciseModal);
  const closeBtn = document.getElementById('exModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeExerciseModal);
  const cancelBtn = document.getElementById('exModalCancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeExerciseModal);
  const bd = document.getElementById('exModalBackdrop');
  if (bd) bd.addEventListener('click', (ev) => { if (ev.target === bd) closeExerciseModal(); });
  const saveBtn = document.getElementById('exModalSave');
  if (saveBtn) saveBtn.addEventListener('click', saveNewExercise);
}
function saveNewExercise() {
  const name = (document.getElementById('exNewName').value || '').trim();
  if (!name) { alert('Please enter an exercise name.'); return; }
  const activity = (document.getElementById('exNewActivity').value || 'other');
  const sets = parseInt(document.getElementById('exNewSets').value, 10) || 0;
  const reps = parseInt(document.getElementById('exNewReps').value, 10) || 0;
  const description = (document.getElementById('exNewDescription').value || '').trim();
  const howto = (document.getElementById('exNewHowto').value || '').trim();
  const share = document.getElementById('exNewShare') ? document.getElementById('exNewShare').checked : false;
  const entry = { name, activity, sets, reps, description, howto, shared: share };
  const existing = exCommunity().find((e) => String(e.name || '').toLowerCase() === name.toLowerCase());
  if (existing) {
    // Update the existing entry's detail text in place.
    existing.description = description;
    existing.howto = howto;
    if (share) pushExerciseToCommunity(existing);
  } else if (share) {
    exSharedCache.push(entry);
    pushExerciseToCommunity(entry);
  } else {
    exMy.push(entry);
    persistMyLibrary();
  }
  closeExerciseModal();
  ['exNewName', 'exNewSets', 'exNewReps', 'exNewDescription', 'exNewHowto'].forEach((id) => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderLibrary();
}

// Push a shared exercise to HT_exercise_library; best-effort (offline seed still works).
function pushExerciseToCommunity(entry) {
  if (!currentUserId) return;
  supabaseClient.from(DB_SHARED('exercise_library')).insert({
    name: entry.name, activity: entry.activity, sets: entry.sets, reps: entry.reps,
    description: entry.description, howto: entry.howto, added_by: currentUserId
  }).then(({ error }) => { if (error) console.warn('HT_exercise_library insert failed', error.message); })
    .catch((err) => console.warn('HT_exercise_library insert error', err.message));
}

function logFromLibrary(libEntry) {
  loadExercises().push({
    name: libEntry.name, activity: libEntry.activity || 'strength',
    sets: libEntry.sets || 0, reps: libEntry.reps || 0,
    date: todayKey(), done: false, createdAt: new Date().toISOString()
  });
  saveExercises(loadExercises());
  renderExerciseLog();
  alert('Added to your exercise log for today.');
}
function addExerciseEntry(event) {
  event.preventDefault();
  const dateInput = document.getElementById('exDate');
  const nameInput = document.getElementById('exName');
  if (!dateInput || !nameInput) return;
  if (!dateInput.value) { alert('Please choose a date.'); return; }
  const name = nameInput.value.trim();
  if (!name) { alert('Please enter an exercise name.'); return; }
  const actInput = document.getElementById('exActivity');
  const setsInput = document.getElementById('exSets');
  const repsInput = document.getElementById('exReps');
  const sharedInput = document.getElementById('exShared');
  loadExercises().push({
    name, activity: actInput ? actInput.value : 'strength',
    sets: setsInput ? Number(setsInput.value) || 0 : 0,
    reps: repsInput ? Number(repsInput.value) || 0 : 0,
    date: dateInput.value, done: false,
    shared: !!(sharedInput && sharedInput.checked),
    createdAt: new Date().toISOString()
  });
  saveExercises(loadExercises());
  if (nameInput) nameInput.value = '';
  if (setsInput) setsInput.value = '';
  if (repsInput) repsInput.value = '';
  if (sharedInput) sharedInput.checked = false;
  renderExerciseLog();
  alert('Exercise logged.');
}
function toggleExerciseDone(createdAt) {
  const list = loadExercises();
  const item = list.find((e) => e.createdAt === createdAt);
  if (item) item.done = !item.done;
  saveExercises(list); renderExerciseLog(); if (activeView === 'calendar') renderCalendar();
}
function deleteExerciseEntry(createdAt) {
  if (!confirm('Delete this exercise entry?')) return;
  saveExercises(loadExercises().filter((e) => e.createdAt !== createdAt));
  renderExerciseLog(); if (activeView === 'calendar') renderCalendar();
}
function renderExerciseLog() {
  const el = document.getElementById('exLog'); if (!el) return;
  const list = loadExercises().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!list.length) { el.innerHTML = '<p class="ex-empty">No workouts logged yet. Add one above or log from the library.</p>'; return; }
  el.innerHTML = '';
  list.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'ex-entry' + (entry.done ? ' done' : '');
    row.innerHTML = '<div class="ee-top">'
      + '<input type="checkbox" class="ee-check" ' + (entry.done ? 'checked ' : '') + 'aria-label="Mark done" />'
      + '<div class="ee-main"><b>' + escHtml(entry.name) + '</b><span>' + escHtml(entry.date || '') + ' Â· '
      + escHtml(ACTIVITY_LABELS[entry.activity] || entry.activity || 'Other') + ' Â· ' + (entry.sets || 0) + ' sets Ã— '
      + (entry.reps || 0) + ' reps' + (entry.shared ? ' Â· shared' : '') + '</span></div>'
      + '<button type="button" class="ee-del" aria-label="Delete">Ã—</button></div>';
    row.querySelector('.ee-check').addEventListener('change', () => toggleExerciseDone(entry.createdAt));
    row.querySelector('.ee-del').addEventListener('click', () => deleteExerciseEntry(entry.createdAt));
    el.appendChild(row);
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â• DIET â•â•â•â•â•â•â•â•â•â•â•â•
function wireDietForm() {
  const form = document.getElementById('dietForm'); if (form) form.addEventListener('submit', addDietItem);
  const sel = document.getElementById('dietMeal');
  if (sel) sel.addEventListener('change', () => {
    const hint = document.getElementById('dietAlcoholHint'); if (hint) hint.hidden = sel.value !== 'alcohol';
  });
}
function addDietItem(event) {
  event.preventDefault();
  const dateInput = document.getElementById('dietDate');
  const itemInput = document.getElementById('dietItem');
  if (!dateInput || !itemInput || !dateInput.value) return;
  const item = (itemInput.value || '').trim();
  if (!item) { alert('Enter a food or drink item.'); return; }
  const meal = document.getElementById('dietMeal') ? document.getElementById('dietMeal').value : 'snack';
  const key = dateInput.value;
  const diet = loadDiet();
  if (!diet[key]) diet[key] = {};
  if (!Array.isArray(diet[key][meal])) diet[key][meal] = [];
  diet[key][meal].push({ text: item, addedAt: new Date().toISOString() });
  saveDiet(diet);
  itemInput.value = '';
  renderDiet();
  if (activeView === 'calendar') renderCalendar();
}
function deleteDietItem(dateKey, meal, index) {
  const diet = loadDiet();
  if (!diet[dateKey] || !Array.isArray(diet[dateKey][meal])) return;
  diet[dateKey][meal].splice(index, 1);
  if (!diet[dateKey][meal].length) delete diet[dateKey][meal];
  if (!Object.keys(diet[dateKey]).length) delete diet[dateKey];
  saveDiet(diet);
  renderDiet(); if (activeView === 'calendar') renderCalendar();
}
function renderDiet() {
  const label = document.getElementById('dietDateLabel'); if (label) label.textContent = fmtDateLabel(keyToDate(dietCursor));
  const dateInput = document.getElementById('dietDate'); if (dateInput) dateInput.value = dietCursor;
  const grid = document.getElementById('dietGrid'); if (!grid) return;
  grid.innerHTML = '';
  const day = loadDiet()[dietCursor] || {};
  MEAL_TYPES.forEach((meal) => {
    const items = day[meal] || [];
    const card = document.createElement('div');
    card.className = 'diet-card ' + MEAL_CLASS[meal];
    card.innerHTML = '<div class="dc-head"><span>' + MEAL_LABELS[meal] + '</span><span class="dc-count">' + items.length + '</span></div>'
      + '<div class="dc-body"></div>';
    const body = card.querySelector('.dc-body');
    if (!items.length) { body.innerHTML = '<span class="dc-empty">Nothing logged.</span>'; }
    else {
      items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'dc-item';
        row.innerHTML = '<span>' + escHtml(item.text) + '</span><button type="button" class="dc-del" aria-label="Remove">Ã—</button>';
        row.querySelector('.dc-del').addEventListener('click', () => deleteDietItem(dietCursor, meal, index));
        body.appendChild(row);
      });
    }
    grid.appendChild(card);
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â• CALENDAR â•â•â•â•â•â•â•â•â•â•â•â•
function measurementEntriesForDay(key) {
  return normalizeEntries(loadEntries()).filter((e) => e.date && toDateKey(new Date(e.date)) === key);
}
function renderCalGroup(title, tag) {
  const group = document.createElement('div');
  group.className = 'cal-group';
  group.innerHTML = '<div class="cg-head"><h3>' + title + '</h3><span class="cg-tag">' + (tag || '') + '</span></div><div class="cg-body"></div>';
  return group;
}
function renderCalItem(dot, inner) {
  const item = document.createElement('div');
  item.className = 'cal-item';
  item.innerHTML = '<span class="ci-dot" style="background:' + (dot || '#f2186b') + '"></span><div class="ci-main">' + inner + '</div>';
  return item;
}
function renderCalendar() {
  const label = document.getElementById('calDateLabel'); if (label) label.textContent = fmtDateLabel(keyToDate(currentDay));
  const container = document.getElementById('calendarDay'); if (!container) return;
  container.innerHTML = '';

  const peptides = loadPeptides().filter((p) => p.date === currentDay);
  const exercises = loadExercises().filter((e) => e.date === currentDay);
  const meals = loadDiet()[currentDay] || {};
  const meas = measurementEntriesForDay(currentDay);

  const pCount = document.getElementById('calPeptideCount'); if (pCount) pCount.textContent = peptides.length;
  const wCount = document.getElementById('calWorkoutCount'); if (wCount) wCount.textContent = exercises.length;
  const mCount = document.getElementById('calMealCount'); if (mCount) mCount.textContent = MEAL_TYPES.reduce((n, t) => n + (meals[t] ? meals[t].length : 0), 0);
  const dCount = document.getElementById('calMeasCount'); if (dCount) dCount.textContent = meas.length;

  if (!peptides.length && !exercises.length && !meas.length && !MEAL_TYPES.some((t) => meals[t] && meals[t].length)) {
    container.innerHTML = '<p class="cal-empty">Nothing logged for this day yet.</p>';
    return;
  }

  // Peptides
  if (peptides.length) {
    const g = renderCalGroup('Peptides', peptides.filter((p) => p.complete).length + '/' + peptides.length + ' done');
    const body = g.querySelector('.cg-body');
    peptides.forEach((p) => {
      const meta = getPeptideMeta(p.name);
      const item = renderCalItem(meta.color,
        '<b>' + escHtml(p.name) + (p.complete ? ' âœ“' : '') + '</b>'
        + '<span>' + (p.time ? escHtml(p.time) + ' Â· ' : '') + escHtml(p.dose || '') + (p.note ? ' Â· ' + escHtml(p.note) : '') + '</span>');
      body.appendChild(item);
    });
    container.appendChild(g);
  }

  // Workouts
  if (exercises.length) {
    const g = renderCalGroup('Exercise', exercises.filter((e) => e.done).length + '/' + exercises.length + ' done');
    const body = g.querySelector('.cg-body');
    exercises.forEach((e) => {
      const item = renderCalItem('#22d3ee',
        '<b>' + escHtml(e.name) + (e.done ? ' âœ“' : '') + '</b>'
        + '<span>' + escHtml(ACTIVITY_LABELS[e.activity] || e.activity || 'Other') + ' Â· ' + (e.sets || 0) + ' sets Ã— ' + (e.reps || 0) + ' reps</span>');
      body.appendChild(item);
    });
    container.appendChild(g);
  }

  // Meals
  MEAL_TYPES.forEach((meal) => {
    const items = meals[meal];
    if (!items || !items.length) return;
    const g = renderCalGroup(MEAL_LABELS[meal], items.length + ' item' + (items.length > 1 ? 's' : ''));
    const body = g.querySelector('.cg-body');
    items.forEach((item) => {
      body.appendChild(renderCalItem(MEAL_COLOR[meal], '<b>' + escHtml(item.text) + '</b><span>' + MEAL_LABELS[meal] + '</span>'));
    });
    container.appendChild(g);
  });

  // Measurements
  if (meas.length) {
    const g = renderCalGroup('Measurements', meas.length + ' log' + (meas.length > 1 ? 's' : ''));
    const body = g.querySelector('.cg-body');
    const nodes = loadBodyNodes();
    meas.forEach((entry) => {
      const parts = [];
      Object.entries(nodes).forEach(([key, node]) => {
        if (typeof entry[key] === 'number' && entry[key] !== null && entry[key] !== undefined) {
          parts.push(node.label + ': ' + entry[key] + (node.unit ? ' ' + node.unit : ''));
        }
      });
      const summary = parts.join(' Â· ');
      body.appendChild(renderCalItem('#a78bfa', '<b>' + entry.date.toLocaleDateString() + '</b><span>' + (summary || 'Measurement entry') + '</span>'));
    });
    container.appendChild(g);
  }
}



/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HealthTracker Dev â€” unified recurring schedule (v2)
   Replaces per-type dated entries with a single recurring model
   shared across Diet / Peptides / Exercise, a weekly grid view,
   a Calendar week view with type toggles, and a Dashboard "Today".
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KIND_LABEL = { diet: 'Diet', peptide: 'Peptide', exercise: 'Exercise' };
const KIND_COLOR = { diet: '#ff9d5c', peptide: '#f2186b', exercise: '#22d3ee' };

function loadSchedule() { return dbCache.schedule || (dbCache.schedule = []); }
function saveSchedule(l) { dbCache.schedule = l; queueDbWrite(); }

function dkeyFromInput(v) { return v; } // schedule stores dates as YYYY-MM-DD keys
function fmtKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function keyToDateObj(key) { const p = String(key).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2] || 1); }

function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function addMonths(d, n) { const c = new Date(d); c.setMonth(c.getMonth() + n); return c; }
function addYears(d, n) { const c = new Date(d); c.setFullYear(c.getFullYear() + n); return c; }

function weekStart(d) { const c = new Date(d); c.setDate(c.getDate() - c.getDay()); c.setHours(0, 0, 0, 0); return c; }
function weekEnd(d) { const s = weekStart(d); const e = addDays(s, 6); e.setHours(23, 59, 59, 999); return e; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function sameKey(a, b) { return fmtKey(a) === fmtKey(b); }

// Returns true if a candidate date passes the item's "On these days" filter.
function dayAllowed(rule, d) {
  const on = rule.onDays || [];
  if (on.length) return on.indexOf(d.getDay()) !== -1;
  return true;
}

// Normalise the unit freq values the form stores ("day','week'...) to the engine
// values ("daily'/'weekly'...), and also accept legacy values stored either way.
const FREQ_NORM = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };

// Shift a candidate date forward to its next allowed occurrence for the rule.
function nextOccurrence(rule, d) {
  const f = FREQ_NORM[rule.freq] || rule.freq;
  // Weekly with "On these days": walk day-by-day; occurrencesOf filters allowed days.
  if (f === 'weekly' && rule.onDays && rule.onDays.length) {
    return addDays(d, 1);
  }
  if (!dayAllowed(rule, d)) return null;
  if (f === 'once') return d;
  if (f === 'daily') return d;
  if (f === 'weekly') return addDays(d, 7 * (rule.interval || 1));
  if (f === 'monthly') return addMonths(d, rule.interval || 1);
  if (f === 'yearly') return addYears(d, rule.interval || 1);
  return null;
}

// Expand occurrences into [startDay, endDay]. Always returns at least the start
// day so one-time items render. `cap` guards runaway expansions.
function occurrencesOf(item, startDay, endDay) {
  const rule = item.r || {};
  const f = FREQ_NORM[rule.freq] || rule.freq;
  const dailyStep = (f === 'weekly' && rule.onDays && rule.onDays.length) ? 1 : 0;
  const end = rule.end || {};
  const out = [];
  const start = keyToDateObj(item.date);
  const horizon = new Date(Math.max(
    keyToDateObj(fmtKey(endDay)).getTime(),
    end.date ? keyToDateObj(end.date).getTime() : 0
  ));
  const dayMs = 86400000;
  // estimate iteration upper bound (in days) to guarantee we pass the horizon
  // for "never" rules without a hard end.
  let iterDays;
  if (end.type === 'never') {
    iterDays = Math.max((horizon.getTime() - start.getTime()) / dayMs + (rule.interval || 1) * 730, 3660);
  } else {
    iterDays = end.type === 'after'
      ? (end.count || 1) * (rule.interval || 1) * ((f === 'daily' || dailyStep) ? 1 : f === 'weekly' ? 7 : f === 'monthly' ? 31 : 366)
      : (end.date ? (keyToDateObj(end.date).getTime() - start.getTime()) / dayMs + 5 : 3660);
  }
  iterDays = Math.min(Math.max(iterDays, 1), 40000);

  if (f === 'once') {
    if (sameDay(start, startDay) || (start >= startDay && start <= endDay)) out.push(start);
    return out;
  }

  let occ = 0;
  const maxOcc = end.type === 'after' ? (end.count || 1) : 100000;
  let cur = new Date(start);
  const seen = {};
  let guard = 0;
  while (guard < 400000 && occ < maxOcc) {
    guard += 1;
    if (cur > horizon && end.type !== 'after' && end.type !== 'never') break;
    if (cur > horizon && end.type === 'never' && iterDays < 1) break;
    const key = fmtKey(cur);
    if (!seen[key] && dayAllowed(rule, cur)) {
      seen[key] = true;
      occ += 1;
      if (cur >= startDay && cur <= endDay) out.push(cur);
      if (end.type === 'after' && occ >= maxOcc) break;
    }
    const nx = nextOccurrence(rule, cur);
    if (!nx) break;
    if (fmtKey(nx) === key) { cur = addDays(cur, 1); continue; } // safety: never loop on same key
    cur = nx;
    iterDays -= (f === 'daily' || dailyStep) ? rule.interval : f === 'weekly' ? 7 * rule.interval : f === 'monthly' ? 31 * rule.interval : f === 'yearly' ? 366 * rule.interval : 1;
    if (iterDays <= 0 && end.type === 'never') break;
  }
  return out;
}

// Group schedule items by date key for a week.
function scheduleForWeek(rangeStart, rangeEnd, filterKind) {
  const items = loadSchedule();
  const byDay = {};
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(rangeStart, i);
    byDay[fmtKey(d)] = [];
  }
  items.forEach((item) => {
    const kind = item.kind || 'diet';
    if (filterKind && kind !== filterKind) return;
    const occs = occurrencesOf(item, rangeStart, rangeEnd);
    occs.forEach((d) => {
      const k = fmtKey(d);
      if (byDay[k]) byDay[k].push(item);
    });
  });
  return byDay;
}

function scheduleItemSub(item) {
  if (item.kind === 'diet') {
    const det = item.meta && item.meta.items && item.meta.items.length ? (item.meta.items[0].text) : (item.notes || '');
    return '<span class="ci-main"><b>' + escHtml(item.title) + '</b><span>' + escHtml(det || '') + ' Â· ' + escHtml((item.meta && item.meta.meal) || '') + '</span></span>';
  }
  if (item.kind === 'exercise') {
    const m = item.meta || {};
    const det = ((m.sets || '') + ' sets Ã— ' + (m.reps || '') + ' reps').replace(' Ã—  reps', '');
    return '<span class="ci-main"><b>' + escHtml(item.title) + '</b><span>' + escHtml(m.activity || '') + (det ? ' Â· ' + escHtml(det) : '') + '</span></span>';
  }
  if (item.kind === 'peptide') {
    const m = item.meta || {};
    const det = [(m.dose || ''), (m.note || '')].filter(Boolean).join(' Â· ');
    const meta = getPeptideMeta(m.name || item.title);
    return '<span class="ci-main"><b>' + escHtml(item.title) + '</b><span>' + escHtml(det) + '</span></span>' + '<span class="ci-meta" style="color:' + (meta.color || '#f2186b') + '">' + escHtml(m.name || '') + '</span>';
  }
  return '<span class="ci-main"><b>' + escHtml(item.title) + '</b></span>';
}

function renderWeekGrid(gridEl, filterKind, startDay) {
  if (!gridEl) return;
  const rangeStart = weekStart(startDay);
  const rangeEnd = weekEnd(startDay);
  const byDay = scheduleForWeek(rangeStart, rangeEnd, filterKind);
  const today = new Date();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(rangeStart, i);
    const k = fmtKey(d);
    const key = new Date(d);
    const isToday = sameDay(d, today);
    const col = document.createElement('div');
    col.className = 'wk-col' + (isToday ? ' today' : '');
    col.innerHTML = '<div class="wk-head"><span class="wk-dotw">' + DAY_NAMES[key.getDay()] + '</span><span class="wk-date">' + String(key.getDate()) + '</span><span class="wk-dot"></span></div><div class="wk-body"></div>';
    const body = col.querySelector('.wk-body');
    const items = byDay[k] || [];
    if (items.length) col.classList.add('has-items');
    if (!items.length) body.innerHTML = '<span class="wk-empty">â€”</span>';
    else items.forEach((item) => {
      const cell = document.createElement('div');
      cell.className = 'wk-item kind-' + (item.kind || 'diet');
      cell.innerHTML = scheduleItemSub(item) + '<button type="button" class="wk-del" data-id="' + escHtml(item.id) + '" aria-label="Remove">Ã—</button>';
      cell.querySelector('.wk-del').addEventListener('click', () => deleteScheduleItem(item.id));
      body.appendChild(cell);
    });
    frag.appendChild(col);
  }
  gridEl.innerHTML = '';
  gridEl.appendChild(frag);
}

function deleteScheduleItem(id) {
  openConfirm('Delete this scheduled item?', function () {
    saveSchedule(loadSchedule().filter((it) => it.id !== id));
    syncAllWeeks();
  });
}

function renderCalendarWeek() {
  const picker = document.getElementById('calDatePicker');
  if (picker && !picker.value) picker.value = weekCursorKey;
  const label = document.getElementById('calDateLabel');
  if (label) {
    const s = weekStart(keyToDateObj(weekCursorKey));
    const e = addDays(s, 6);
    label.textContent = fmtRangeHelper(s,e);
  }
  const grid = document.getElementById('calWeekGrid');
  if (!grid) return;
  const cfg = {
    diet: !!document.getElementById('calToggleDiet').checked,
    peptide: !!document.getElementById('calTogglePeptide').checked,
    exercise: !!document.getElementById('calToggleExercise').checked
  };
  const measOn = document.getElementById('calToggleMeas') ? document.getElementById('calToggleMeas').checked : false;
  const rangeStart = weekStart(keyToDateObj(weekCursorKey));
  const rangeEnd = weekEnd(rangeStart);
  const byDay = scheduleForWeek(rangeStart, rangeEnd, null);
  // measurements per day
  const meas = measurementEntriesForWeek(rangeStart, rangeEnd);
  const today = new Date();
  grid.innerHTML = '';
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(rangeStart, i);
    const k = fmtKey(d);
    const isToday = sameDay(d, today);
    const col = document.createElement('div');
    col.className = 'wk-col' + (isToday ? ' today' : '');
    col.innerHTML = '<div class="wk-head"><span class="wk-dotw">' + DAY_NAMES[d.getDay()] + '</span><span class="wk-date">' + String(d.getDate()) + (d.getMonth() !== rangeStart.getMonth() ? ' <small>' + (d.getMonth() + 1) + '/' + d.getFullYear() + '</small>' : '') + '</span><span class="wk-dot"></span></div><div class="wk-body"></div>';
    const body = col.querySelector('.wk-body');
    let count = 0;
    (byDay[k] || []).forEach((item) => {
      const kind = item.kind || 'diet';
      if (!cfg[kind]) return;
      count += 1;
      const cell = document.createElement('div');
      cell.className = 'wk-item kind-' + kind;
      cell.innerHTML = scheduleItemSub(item) + '<button type="button" class="wk-del" data-id="' + escHtml(item.id) + '" aria-label="Remove">×</button>';
      const delBtn = cell.querySelector('.wk-del');
      if (delBtn) delBtn.addEventListener('click', function () { deleteScheduleItem(item.id); });
      body.appendChild(cell);
    });
    if (measOn && meas[k] && meas[k].length) {
      count += 1;
      const cell = document.createElement('div');
      cell.className = 'wk-item kind-meas';
      cell.innerHTML = '<span class="ci-main"><b>Measurement</b><span>' + meas[k].length + ' log' + (meas[k].length > 1 ? 's' : '') + '</span></span>';
      body.appendChild(cell);
    }
    if (count) col.classList.add('has-items');
    if (!count) body.innerHTML = '<span class="wk-empty">â€”</span>';
    grid.appendChild(col);
  }
}

function measurementEntriesForWeek(rs, re) {
  const out = {};
  const entries = normalizeEntries(loadEntries());
  entries.forEach((en) => {
    if (en.date >= rs && en.date <= re) {
      const k = fmtKey(en.date);
      (out[k] = out[k] || []).push(en);
    }
  });
  return out;
}

function renderDashboardToday() {
  const el = document.getElementById('todaySchedule');
  if (!el) return;
  const today = new Date();
  const tKey = fmtKey(today);
  const byDay = scheduleForWeek(today, today, null);
  const items = byDay[tKey] || [];
  if (!items.length) { el.innerHTML = '<p class="ts-empty">Nothing scheduled for today. Head to the Diet, Peptides or Exercise pages to plan your day.</p>'; return; }
  el.innerHTML = '';
  items.forEach((item) => {
    const cell = document.createElement('div');
    cell.className = 'ts-item kind-' + (item.kind || 'diet');
    cell.innerHTML = '<span class="ts-chip"></span>' + scheduleItemSub(item);
    el.appendChild(cell);
  });
}

function syncAllWeeks() {
  syncFormStartDates();
  if (document.getElementById('calWeekGrid') && !document.getElementById('view-calendar').classList.contains('hidden')) renderCalendarWeek();
  if (document.getElementById('dietWeekGrid') && !document.getElementById('view-diet').classList.contains('hidden')) { renderScheduleWeek('diet'); renderWeekList('diet'); }
  if (document.getElementById('pepWeekGrid') && !document.getElementById('view-peptides').classList.contains('hidden')) { renderScheduleWeek('peptide'); renderWeekList('peptide'); }
  if (document.getElementById('exWeekGrid') && !document.getElementById('view-exercise').classList.contains('hidden')) { renderScheduleWeek('exercise'); renderWeekList('exercise'); }
  renderDashboardToday();
}

// Week cursors per page
let weekCursorKey = fmtKey(new Date());
function pageWeekCursor() {
  return { diet: weekCursorKey, peptide: weekCursorKey, exercise: weekCursorKey };
}

function setWeekCursor(newKey) {
  weekCursorKey = newKey;
  ['cal', 'diet', 'pep', 'ex'].forEach((p) => {
    const picker = document.getElementById(p + 'DatePicker');
    if (picker && !picker.value) picker.value = newKey;
    if (picker) picker.value = newKey;
  });
  ['diet', 'pep', 'ex', 'cal'].forEach((p) => {
    const label = document.getElementById(p + 'DateLabel');
    if (label) {
      const s = weekStart(keyToDateObj(weekCursorKey));
      const e = addDays(s, 6);
      label.textContent = fmtRangeHelper(s,e);
    }
  });
  syncAllWeeks();
}

function wireWeekNav(prefix) {
  const prev = document.getElementById(prefix + 'Prev');
  const next = document.getElementById(prefix + 'Next');
  const todayBtn = document.getElementById(prefix + 'Today');
  const picker = document.getElementById(prefix + 'DatePicker');
  const label = document.getElementById(prefix + 'DateLabel');
  if (prev) prev.addEventListener('click', () => setWeekCursor(fmtKey(addDays(keyToDateObj(weekCursorKey), -7))));
  if (next) next.addEventListener('click', () => setWeekCursor(fmtKey(addDays(keyToDateObj(weekCursorKey), 7))));
  if (todayBtn) todayBtn.addEventListener('click', () => setWeekCursor(fmtKey(new Date())));
  if (picker) picker.addEventListener('change', () => { if (picker.value) setWeekCursor(picker.value); });
  if (label) {
    const s = weekStart(keyToDateObj(weekCursorKey));
    const e = addDays(s, 6);
    label.textContent = fmtRangeHelper(s,e);
  }
}/* â•â•â•â•â•â•â•â•â•â•â•â• SCHEDULE FORM WIDGET â•â•â•â•â•â•â•â•â•â•â•â• */
// prefix âˆˆ { 'sched' (diet page), 'schedPep', 'schedEx' }
const SCHED_FIELD_SUFFIX = { sched: '', schedEx: 'Ex', schedPep: 'Pep' };
function field(prefix, name) {
  const sfx = SCHED_FIELD_SUFFIX[prefix] || '';
  return document.getElementById('sched' + name + sfx);
}

function populateSchedPeptideSelects() {
  const profile = loadPeptides();
  ['schedPepSelect', 'schedPepSelectPep', 'schedPepSelectEx'].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    if (!profile.length) {
      const o = document.createElement('option'); o.value = ''; o.textContent = 'Add a compound to your protocol first'; sel.appendChild(o);
    } else {
      profile.forEach((e) => { const o = document.createElement('option'); o.value = e.name; o.textContent = e.name; sel.appendChild(o); });
    }
  });
}

function readDays(prefix, cls) {
  const out = [];
  document.querySelectorAll('.' + (cls || 'schedDay') + (prefix === 'sched' ? '' : (prefix === 'schedPep' ? 'Pep' : 'Ex'))).forEach((cb) => { if (cb.checked) out.push(Number(cb.value)); });
  return out;
}

function setDaysChecked(prefix, value) {
  const cls = 'schedDay' + (prefix === 'schedPep' ? 'Pep' : prefix === 'schedEx' ? 'Ex' : '');
  document.querySelectorAll('.' + cls).forEach((cb) => { cb.checked = value; });
}

// Each page is bound to a single schedule kind (the "Item type" dropdown is removed).
const SCHED_KIND = { sched: 'diet', schedPep: 'peptide', schedEx: 'exercise' };
const SCHED_GRID = { diet: 'dietWeekGrid', peptide: 'pepWeekGrid', exercise: 'exWeekGrid' };
const SCHED_LABEL = { diet: 'dietDateLabel', peptide: 'pepDateLabel', exercise: 'exDateLabel' };
const SCHED_LIST = { diet: 'dietWeekList', peptide: 'pepWeekList', exercise: 'exWeekList' };
const SCHED_PREFIXES = ['sched', 'schedPep', 'schedEx'];

// Pin every page's "Start date" to the start (Sunday) of the selected week.
function syncFormStartDates() {
  const key = fmtKey(weekStart(keyToDateObj(weekCursorKey)));
  SCHED_PREFIXES.forEach((prefix) => { const el = field(prefix, 'Start'); if (el) el.value = key; });
}

// Peptide page: auto-fill the title from the chosen compound while the title is empty.
function wirePeptideAutofill(prefix) {
  const sel = field(prefix, 'PepSelect');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const title = field(prefix, 'Title');
    if (title && !title.value && sel.value) title.value = getPeptideMeta(sel.value).name;
  });
}

function wireScheduleForm(prefix) {
  const kind = SCHED_KIND[prefix];
  const start = field(prefix, 'Start');
  const addBtn = field(prefix, 'AddBtn');
  if (!start) return;

  if (kind === 'peptide') wirePeptideAutofill(prefix);

  // The "Start date" only picks the selected week; "On These Days" picks the days.
  syncFormStartDates();
  start.addEventListener('change', () => {
    if (start.value) { weekCursorKey = fmtKey(weekStart(keyToDateObj(start.value))); syncAllWeeks(); }
  });

  if (addBtn) addBtn.addEventListener('click', () => addScheduleItem(prefix));
}

function addScheduleItem(prefix) {
  const kind = SCHED_KIND[prefix];
  const titleEl = field(prefix, 'Title');
  const startEl = field(prefix, 'Start');
  const title = titleEl ? titleEl.value.trim() : '';
  const start = startEl ? startEl.value : '';
  if (!title) { alert('Please give this a title.'); return; }
  if (!start) { alert('Please choose a start date.'); return; }

  const unitEl = field(prefix, 'RepeatUnit');
  const unit = unitEl ? unitEl.value : 'week';
  const nEl = field(prefix, 'RepeatN');
  const n = nEl ? Math.max(1, parseInt(nEl.value, 10) || 1) : 1;

  const r = {
    freq: unit === 'once' ? 'once' : (FREQ_NORM[unit] || unit),
    interval: unit === 'once' ? 1 : n,
    onDays: readDays(prefix, null)
  };

  const endGroup = field(prefix, 'End');
  let endDone = false;
  if (endGroup) {
    const checked = endGroup.querySelector('input[name]:checked');
    if (checked) {
      const v = checked.value;
      if (v === 'after') {
        const c = field(prefix, 'EndAfter');
        r.end = { type: 'after', count: c ? Math.max(1, parseInt(c.value, 10) || 1) : 1 };
        endDone = true;
      } else if (v === 'date') {
        const d = field(prefix, 'EndDate');
        if (d && d.value) { r.end = { type: 'date', date: d.value }; endDone = true; }
        else { r.end = { type: 'never' }; endDone = true; }
      } else {
        r.end = { type: 'never' }; endDone = true;
      }
    }
  }
  if (!endDone) r.end = { type: 'never' };

  const meta = {};
  if (kind === 'diet') {
    meta.meal = field(prefix, 'Meal') ? field(prefix, 'Meal').value : 'breakfast';
    const items = field(prefix, 'DietItems') ? field(prefix, 'DietItems').value.trim() : '';
    meta.items = items ? [ { text: items } ] : [];
  } else if (kind === 'exercise') {
    meta.activity = field(prefix, 'ExActivity') ? field(prefix, 'ExActivity').value : 'other';
    meta.sets = field(prefix, 'ExSets') ? (parseInt(field(prefix, 'ExSets').value, 10) || 0) : 0;
    meta.reps = field(prefix, 'ExReps') ? (parseInt(field(prefix, 'ExReps').value, 10) || 0) : 0;
  } else if (kind === 'peptide') {
    meta.name = field(prefix, 'PepSelect') ? field(prefix, 'PepSelect').value : '';
    meta.dose = field(prefix, 'PepDose') ? field(prefix, 'PepDose').value.trim() : '';
    meta.note = field(prefix, 'PepNote') ? field(prefix, 'PepNote').value.trim() : '';
  }

  const item = {
    id: kind + '-' + Date.now(),
    kind,
    title,
    date: start,
    r,
    meta,
    createdAt: new Date().toISOString()
  };
  loadSchedule().push(item);
  saveSchedule(loadSchedule());
  // reset title + kind-specific fields
  if (titleEl) titleEl.value = '';
  if (field(prefix, 'DietItems')) field(prefix, 'DietItems').value = '';
  if (field(prefix, 'ExSets')) field(prefix, 'ExSets').value = '';
  if (field(prefix, 'ExReps')) field(prefix, 'ExReps').value = '';
  if (field(prefix, 'PepDose')) field(prefix, 'PepDose').value = '';
  if (field(prefix, 'PepNote')) field(prefix, 'PepNote').value = '';
  weekCursorKey = start;
  syncAllWeeks();
  alert('Added to schedule.');
}

// Convenience "log for today" from the exercise library.
function logLibraryToday(libEntry) {
  loadSchedule().push({
    id: 'exercise-' + Date.now(),
    kind: 'exercise',
    title: libEntry.name,
    date: fmtKey(new Date()),
    r: { freq: 'once', interval: 1, onDays: [], end: { type: 'never' } },
    meta: { activity: libEntry.activity || 'other', sets: libEntry.sets || 0, reps: libEntry.reps || 0, items: [] },
    createdAt: new Date().toISOString()
  });
  saveSchedule(loadSchedule());
  syncAllWeeks();
  alert("Added to today's schedule.");
}

/* â•â•â•â•â•â•â•â•â•â•â•â• PANEL RENDER + INIT â•â•â•â•â•â•â•â•â•â•â•â• */
function fmtRangeHelper(s,e){return fmtKey(s)+' - '+fmtKey(e);}

function renderScheduleWeek(kind) {
  const gridEl = document.getElementById(SCHED_GRID[kind]);
  if (gridEl) renderWeekGrid(gridEl, kind, keyToDateObj(weekCursorKey));
  const label = document.getElementById(SCHED_LABEL[kind]);
  if (label) { const s = weekStart(keyToDateObj(weekCursorKey)); const e = addDays(s, 6); label.textContent = fmtRangeHelper(s,e); }
}

// Reworked showView handle â€” overrides the earlier view render calls.
function showView(view) {
  activeView = view;
  document.querySelectorAll('.view-page').forEach((page) => page.classList.toggle('hidden', page.id !== 'view-' + view));
  document.querySelectorAll('.nav-link').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  if (view === 'calendar') renderCalendar();
  else if (view === 'diet') { renderScheduleWeek('diet'); renderWeekList('diet'); }
  else if (view === 'peptides') { renderPeptideProfile(); populateSchedPeptideSelects(); renderScheduleWeek('peptide'); renderWeekList('peptide'); }
  else if (view === 'exercise') { renderLibrary(); renderScheduleWeek('exercise'); renderWeekList('exercise'); }
  else if (view === 'dashboard') renderDashboardToday();
}

// Re-declared calendar render (picks up the redefined showView view id 'calendar').
function renderCalendar() { renderCalendarWeek(); }

// A compact list of this page's scheduled items for the selected week (each viewable/removable).
function renderWeekList(kind) {
  const el = document.getElementById(SCHED_LIST[kind]); if (!el) return;
  const rs = weekStart(keyToDateObj(weekCursorKey));
  const re = weekEnd(rs);
  const rows = [];
  loadSchedule().forEach((item) => {
    if ((item.kind || 'diet') !== kind) return;
    const occs = occurrencesOf(item, rs, re);
    if (!occs.length) return;
    const days = {};
    occs.forEach((d) => { days[d.getDay()] = true; });
    rows.push({ item, days: Object.keys(days).map(Number).sort((a, b) => a - b) });
  });
  if (!rows.length) {
    el.innerHTML = '<p class="wl-empty">Nothing scheduled for this week yet. Use the form above.</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach((row) => {
    const cell = document.createElement('div');
    cell.className = 'wl-item kind-' + (row.kind || 'diet');
    const main = document.createElement('span');
    main.className = 'wl-main';
    main.innerHTML = scheduleItemSub(row.item);
    const chips = document.createElement('span');
    chips.className = 'wl-chips';
    chips.innerHTML = row.days.map((d) => '<span class="wl-day">' + DAY_NAMES[d] + '</span>').join('');
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'wk-del';
    del.setAttribute('aria-label', 'Remove');
    del.textContent = '\u00D7';
    del.addEventListener('click', () => deleteScheduleItem(row.item.id));
    cell.appendChild(main);
    cell.appendChild(chips);
    cell.appendChild(del);
    frag.appendChild(cell);
  });
  el.innerHTML = '';
  el.appendChild(frag);
}

function initSchedule() {
  // wire week nav
  ['cal', 'diet', 'pep', 'ex'].forEach(wireWeekNav);
  // calendar type toggles
  ['calToggleDiet', 'calTogglePeptide', 'calToggleExercise', 'calToggleMeas'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { if (activeView === 'calendar' || activeView === 'cal') renderCalendar(); });
  });
  // schedule forms
  wireScheduleForm('sched');      // diet page
  wireScheduleForm('schedPep');   // peptides page
  wireScheduleForm('schedEx');    // exercise page
  populateSchedPeptideSelects();

  // Peptide protocol panel (search + add to protocol).
  populatePeptideSelect();
  const pepSearchInput = document.getElementById('pepSearch');
  if (pepSearchInput) pepSearchInput.addEventListener('input', applyPeptideFilter);
  const pepAddBtn = document.getElementById('pepAddBtn');
  if (pepAddBtn) pepAddBtn.addEventListener('click', () => { addPeptideToProfile(); populateSchedPeptideSelects(); });

  // Exercise library (search + type/scope filters + add-exercise modal).
  const exSearchInput = document.getElementById('exSearch');
  if (exSearchInput) exSearchInput.addEventListener('input', renderLibraryFiltered);
  document.querySelectorAll('#exTypeFilters .ex-filter-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#exTypeFilters .ex-filter-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderLibraryFiltered();
    });
  });
  document.querySelectorAll('#exScopeFilters .ex-filter-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#exScopeFilters .ex-filter-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderLibraryFiltered();
    });
  });
  wireExerciseModal();
  wireInfoModal();
  wireConfirmModal();
  loadExFavs();
  loadMyLibrary();
  loadSharedExercises();

  // Collapsible panels (protocol / library expanders).
  document.querySelectorAll('.collapsible .collapse-head').forEach((head) => {
    head.addEventListener('click', () => { const box = head.closest('.collapsible'); if (box) box.classList.toggle('collapsed'); });
  });

  syncFormStartDates();
  // set week cursors on pickers/labels
  ['cal', 'diet', 'pep', 'ex'].forEach((p) => {
    const picker = document.getElementById(p + 'DatePicker');
    if (picker && !picker.value) picker.value = weekCursorKey;
    const label = document.getElementById(p + 'DateLabel');
    if (label) { const s = weekStart(new Date()); const e = addDays(s, 6); label.textContent = fmtRangeHelper(s,e); }
  });
  syncAllWeeks();
  showView('dashboard');
}

