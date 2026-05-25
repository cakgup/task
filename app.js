const $ = (id) => document.getElementById(id);

function getConfig() {
  return window.CAKGUP_CONFIG || { APP_PASSWORD: '', GAS_URL: '', CHILDREN: [] };
}

const cfg = getConfig();
let tasks = [];
let activeTab = 'dashboard';

const today = () => new Date().toISOString().slice(0, 10);

function normalizeDateOnly(value) {
  if (!value) return today();
  const text = String(value).trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? today() : date.toISOString().slice(0, 10);
}
const uid = () => `tsk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const childNameAliases = {
  'Anak Pertama': 'Fatiyyah',
  'Anak Kedua': 'Alifah',
  'Anak Ketiga': 'Fatih'
};

function normalizeChildName(name) {
  return childNameAliases[name] || name || '';
}

function normalizeStatus(status) {
  return status === 'Proses' ? 'Dikerjakan' : (status || 'Belum');
}

const fallbackPrayerTimes = [
  { name: 'Imsak', time: '04:15' },
  { name: 'Subuh', time: '04:25' },
  { name: 'Terbit', time: '05:42' },
  { name: 'Dzuhur', time: '11:41' },
  { name: 'Ashar', time: '15:02' },
  { name: 'Maghrib', time: '17:47' },
  { name: 'Isya', time: '18:59' }
];

function minutesFromTime(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function nextPrayerIndex(times) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const index = times.findIndex((item) => minutesFromTime(item.time) > nowMinutes);
  return index >= 0 ? index : 1;
}

function renderPrayerTimes(times, sourceLabel = 'fallback lokal') {
  const container = $('loginPrayerTimes');
  if (!container) return;

  const nextIndex = nextPrayerIndex(times);
  container.innerHTML = times.map((item, index) => `
    <div class="prayer-time-item${index === nextIndex ? ' next' : ''}" title="${sourceLabel}">
      <span>${escapeHtml(item.name)}</span>
      <strong>${escapeHtml(item.time || '--:--')}</strong>
    </div>
  `).join('');
}

async function fetchPrayerTimes() {
  renderPrayerTimes(fallbackPrayerTimes, 'Jadwal fallback lokal');

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const response = await fetch(`https://api.myquran.com/v2/sholat/jadwal/1301/${year}/${month}/${day}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    const jadwal = result?.data?.jadwal;
    if (!jadwal) throw new Error('Format jadwal tidak sesuai');

    renderPrayerTimes([
      { name: 'Imsak', time: jadwal.imsak },
      { name: 'Subuh', time: jadwal.subuh },
      { name: 'Terbit', time: jadwal.terbit },
      { name: 'Dzuhur', time: jadwal.dzuhur },
      { name: 'Ashar', time: jadwal.ashar },
      { name: 'Maghrib', time: jadwal.maghrib },
      { name: 'Isya', time: jadwal.isya }
    ], 'API jadwal shalat DKI Jakarta');
  } catch (error) {
    console.warn('Gagal mengambil jadwal shalat; menggunakan fallback lokal.', error);
  }
}

function initPrayerTimes() {
  fetchPrayerTimes();
  setInterval(fetchPrayerTimes, 60 * 60 * 1000);
}
function init() {
  if (!window.CAKGUP_CONFIG) {
    const error = $('loginError');
    error.textContent = 'Konfigurasi belum terbaca. Pastikan config.js ikut terupload dan dimuat sebelum app.js.';
    error.hidden = false;
    return;
  }
  initPrayerTimes();

  $('todayLabel').textContent = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date());

  fillChildren();
  bindEvents();

  if (localStorage.getItem('cakgupLoggedIn') === 'yes') {
    showApp();
  }
}

function bindEvents() {
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const kode = $('password').value.trim();
    const error = $('loginError');
    const submitButton = e.submitter || $('loginForm').querySelector('button[type="submit"]');

    error.hidden = true;

    if (kode === cfg.APP_PASSWORD) {
      localStorage.setItem('cakgupLoggedIn', 'yes');
      submitButton.disabled = true;
      submitButton.textContent = 'Masuk...';

      try {
        await showApp();
      } catch (error) {
        console.error('Gagal membuka aplikasi:', error);
        localStorage.removeItem('cakgupLoggedIn');
        $('loginError').textContent = 'Kode benar, tetapi aplikasi gagal dibuka. Cek console browser untuk detail.';
        $('loginError').hidden = false;
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Masuk';
      }
    } else {
      error.textContent = 'Kode belum tepat.';
      error.hidden = false;
    }
  });

  $('logoutBtn').onclick = () => {
    localStorage.removeItem('cakgupLoggedIn');
    location.reload();
  };

  document.querySelectorAll('.tabs button').forEach((button) => {
    button.onclick = () => openTab(button.dataset.tab);
  });

  $('taskForm').addEventListener('submit', saveTask);
  $('resetForm').onclick = resetForm;
  $('refreshBtn').onclick = loadTasks;
  $('filterChild').onchange = render;
  $('filterStatus').onchange = render;
}

function fillChildren() {
  ['child', 'filterChild'].forEach((id) => {
    const el = $(id);
    cfg.CHILDREN.forEach((child) => {
      const option = document.createElement('option');
      option.value = child.name;
      option.textContent = `${child.name} - ${child.school}`;
      el.appendChild(option);
    });
  });
}

function showApp() {
  $('loginPage').hidden = true;
  $('app').hidden = false;
  $('taskDate').value = today();
  loadTasks();
}

function openTab(id) {
  activeTab = id;

  document.querySelectorAll('.tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === id);
  });

  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === id);
  });

  render();
}

function setStatus(message) {
  $('syncStatus').textContent = message;
}

function normalizeTask(task) {
  return {
    id: String(task.id || uid()),
    tanggalInput: task.tanggalInput || new Date().toISOString(),
    namaAnak: normalizeChildName(task.namaAnak),
    judul: task.judul || '',
    deskripsi: task.deskripsi || '',
    kategori: task.kategori || 'Lainnya',
    tanggalTugas: normalizeDateOnly(task.tanggalTugas),
    jamTarget: task.jamTarget || '',
    prioritas: task.prioritas || 'Normal',
    status: normalizeStatus(task.status),
    waktuSelesai: task.waktuSelesai || '',
    catatan: task.catatan || ''
  };
}

function dailyTaskKey(task) {
  return [
    normalizeDateOnly(task.tanggalTugas),
    normalizeChildName(task.namaAnak || task.child),
    task.judul || task.title,
    task.catatan || (task.load ? `Beban: ${task.load}` : '')
  ].join('|').toLowerCase();
}

function createDailyTask(template) {
  return normalizeTask({
    id: uid(),
    tanggalInput: new Date().toISOString(),
    namaAnak: template.child,
    judul: template.title,
    deskripsi: template.description || `Beban: ${template.load}`,
    kategori: template.category || 'Pekerjaan Rumah',
    tanggalTugas: today(),
    jamTarget: template.time || '',
    prioritas: template.priority || 'Normal',
    status: 'Belum',
    waktuSelesai: '',
    catatan: `Beban: ${template.load}`
  });
}

async function ensureDailyTasks() {
  const templates = Array.isArray(cfg.DAILY_TASKS) ? cfg.DAILY_TASKS : [];
  if (!templates.length) return;

  const existingKeys = new Set(tasks.map(dailyTaskKey));
  const missingTasks = templates
    .map(createDailyTask)
    .filter((task) => !existingKeys.has(dailyTaskKey(task)));

  if (!missingTasks.length) return;

  tasks = [...missingTasks, ...tasks];
  localStorage.setItem('cakgupTasks', JSON.stringify(tasks));

  await Promise.all(missingTasks.map((task) => sendToGas('addTask', { task })));
  setStatus(`${missingTasks.length} tugas harian dibuat otomatis untuk hari ini.`);
}
async function loadTasks() {
  setStatus('Mengambil data dari Google Sheet...');

  try {
    if (cfg.GAS_URL) {
      const response = await fetch(`${cfg.GAS_URL}?action=getTasks&ts=${Date.now()}`);
      const json = await response.json();
      const rows = Array.isArray(json) ? json : (json.data || []);
      tasks = rows.map(normalizeTask).filter((task) => task.id && task.judul);
      localStorage.setItem('cakgupTasks', JSON.stringify(tasks));
      await ensureDailyTasks();
      setStatus('Data tersinkron dengan Google Sheet.');
    } else {
      tasks = JSON.parse(localStorage.getItem('cakgupTasks') || '[]').map(normalizeTask);
      await ensureDailyTasks();
      setStatus('Mode lokal aktif. Sinkronisasi belum diatur.');
    }
  } catch (error) {
    tasks = JSON.parse(localStorage.getItem('cakgupTasks') || '[]').map(normalizeTask);
    await ensureDailyTasks();
    setStatus('Gagal membaca GAS. Sementara memakai data lokal di HP ini.');
  }

  refreshLate();
  render();
}

async function sendToGas(action, payload) {
  if (!cfg.GAS_URL) return;

  try {
    await fetch(cfg.GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
  } catch (error) {
    console.warn('Gagal mengirim ke GAS:', error);
  }
}

async function persist(action, payload) {
  localStorage.setItem('cakgupTasks', JSON.stringify(tasks));
  await sendToGas(action, payload);
}

async function saveTask(e) {
  e.preventDefault();

  const id = $('taskId').value || uid();
  const old = tasks.find((task) => task.id === id);

  const task = normalizeTask({
    id,
    tanggalInput: old?.tanggalInput || new Date().toISOString(),
    namaAnak: $('child').value,
    judul: $('title').value,
    deskripsi: $('description').value,
    kategori: $('category').value,
    tanggalTugas: $('taskDate').value,
    jamTarget: $('targetTime').value,
    prioritas: $('priority').value,
    status: old?.status || 'Belum',
    waktuSelesai: old?.waktuSelesai || '',
    catatan: $('note').value
  });

  tasks = old
    ? tasks.map((item) => item.id === id ? task : item)
    : [task, ...tasks];

  await persist(old ? 'updateTask' : 'addTask', { task });
  resetForm();
  openTab('tasks');
  render();
  setStatus('Tugas tersimpan. Tekan Muat ulang untuk memastikan data dari Google Sheet sudah terbaru.');
}

function refreshLate() {
  const now = new Date();

  tasks = tasks.map((task) => {
    if (task.status !== 'Selesai' && task.tanggalTugas && task.jamTarget) {
      const due = new Date(`${task.tanggalTugas}T${task.jamTarget}`);
      if (now > due) {
        return { ...task, status: 'Terlambat' };
      }
    }

    return task;
  });
}

async function setTaskStatus(id, status) {
  const waktuSelesai = status === 'Selesai' ? new Date().toISOString() : '';

  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    return {
      ...task,
      status,
      waktuSelesai: status === 'Selesai' ? waktuSelesai : task.waktuSelesai
    };
  });

  await persist('updateStatus', { id, status, waktuSelesai });
  render();
  setStatus('Status tugas diperbarui.');
}

function editTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  $('taskId').value = task.id;
  $('title').value = task.judul;
  $('child').value = task.namaAnak;
  $('category').value = task.kategori;
  $('taskDate').value = task.tanggalTugas;
  $('targetTime').value = task.jamTarget;
  $('priority').value = task.prioritas;
  $('description').value = task.deskripsi;
  $('note').value = task.catatan;

  openTab('add');
}

async function delTask(id) {
  if (!confirm('Hapus tugas ini?')) return;

  tasks = tasks.filter((task) => task.id !== id);
  await persist('deleteTask', { id });
  render();
  setStatus('Tugas dihapus.');
}

function resetForm() {
  $('taskForm').reset();
  $('taskId').value = '';
  $('taskDate').value = today();
}

function render() {
  renderDashboard();

  if (activeTab === 'tasks') {
    renderTasks();
  }

  if (activeTab === 'history') {
    renderHistory();
  }
}

function renderDashboard() {
  const todays = tasks.filter((task) => task.tanggalTugas === today());

  $('statTotal').textContent = todays.length;
  $('statDone').textContent = todays.filter((task) => task.status === 'Selesai').length;
  $('statPending').textContent = todays.filter((task) => ['Belum', 'Dikerjakan'].includes(task.status)).length;
  $('statLate').textContent = todays.filter((task) => task.status === 'Terlambat').length;

  $('childrenSummary').innerHTML = cfg.CHILDREN.map((child) => {
    const arr = todays.filter((task) => task.namaAnak === child.name);
    const done = arr.filter((task) => task.status === 'Selesai').length;
    const pct = arr.length ? Math.round(done / arr.length * 100) : 0;

    return `<article class="child-card">
      <h3>${escapeHtml(child.name)}</h3>
      <p>${escapeHtml(child.school)} · ${done}/${arr.length} selesai</p>
      <div class="progress"><span style="width:${pct}%"></span></div>
    </article>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function card(task) {
  const safeId = escapeHtml(task.id);

  return `<article class="task-card">
    <h3>${escapeHtml(task.judul)}</h3>
    <p>${escapeHtml(task.deskripsi || 'Tidak ada deskripsi.')}</p>
    <div class="meta">
      <span class="pill">${escapeHtml(task.namaAnak)}</span>
      <span class="pill">${escapeHtml(task.kategori)}</span>
      <span class="pill">${escapeHtml(task.tanggalTugas)} ${escapeHtml(task.jamTarget || '')}</span>
      <span class="pill status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
      <span class="pill">${escapeHtml(task.prioritas)}</span>
    </div>
    ${task.catatan ? `<p><b>Catatan:</b> ${escapeHtml(task.catatan)}</p>` : ''}
    <div class="actions">
      <button onclick="setTaskStatus('${safeId}','Dikerjakan')">Dikerjakan</button>
      <button onclick="setTaskStatus('${safeId}','Selesai')">Selesai</button>
      <button onclick="editTask('${safeId}')">Edit</button>
      <button class="danger" onclick="delTask('${safeId}')">Hapus</button>
    </div>
  </article>`;
}

function renderTasks() {
  const fc = $('filterChild').value;
  const fs = $('filterStatus').value;

  const list = tasks
    .filter((task) => (fc === 'all' || task.namaAnak === fc) && (fs === 'all' || task.status === fs))
    .sort((a, b) => `${a.tanggalTugas || ''}${a.jamTarget || ''}`.localeCompare(`${b.tanggalTugas || ''}${b.jamTarget || ''}`));

  $('taskList').innerHTML = list.length
    ? list.map(card).join('')
    : '<article class="task-card">Belum ada tugas.</article>';
}

function renderHistory() {
  const done = [...tasks]
    .sort((a, b) => `${b.tanggalTugas || ''}${b.jamTarget || ''}`.localeCompare(`${a.tanggalTugas || ''}${a.jamTarget || ''}`))
    .slice(0, 80);

  $('historyList').innerHTML = done.length
    ? done.map(card).join('')
    : '<article class="task-card">Riwayat masih kosong.</article>';
}

init();

