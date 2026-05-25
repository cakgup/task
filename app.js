const cfg = window.CAKGUP_CONFIG;
const $ = (id) => document.getElementById(id);
let tasks = [];

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => `tsk-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function init() {
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
  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const kode = $('password').value.trim();

    if (kode === cfg.APP_PASSWORD) {
      localStorage.setItem('cakgupLoggedIn', 'yes');
      showApp();
    } else {
      $('loginError').hidden = false;
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
      option.textContent = `${child.name} — ${child.school}`;
      el.appendChild(option);
    });
  });
}

async function showApp() {
  $('loginPage').hidden = true;
  $('app').hidden = false;
  $('taskDate').value = today();
  await loadTasks();
}

function openTab(id) {
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === id);
  });

  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === id);
  });
}

function setStatus(message) {
  $('syncStatus').textContent = message;
}

function normalizeTask(task) {
  return {
    id: String(task.id || uid()),
    tanggalInput: task.tanggalInput || new Date().toISOString(),
    namaAnak: task.namaAnak || '',
    judul: task.judul || '',
    deskripsi: task.deskripsi || '',
    kategori: task.kategori || 'Lainnya',
    tanggalTugas: task.tanggalTugas || today(),
    jamTarget: task.jamTarget || '',
    prioritas: task.prioritas || 'Normal',
    status: task.status || 'Belum',
    waktuSelesai: task.waktuSelesai || '',
    catatan: task.catatan || ''
  };
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
      setStatus('Data tersinkron dengan Google Sheet.');
    } else {
      tasks = JSON.parse(localStorage.getItem('cakgupTasks') || '[]').map(normalizeTask);
      setStatus('Mode lokal aktif. GAS_URL belum diisi.');
    }
  } catch (error) {
    tasks = JSON.parse(localStorage.getItem('cakgupTasks') || '[]').map(normalizeTask);
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
  setStatus('Tugas tersimpan. Tekan Refresh untuk memastikan data dari Google Sheet sudah terbaru.');
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
  renderTasks();
  renderHistory();
}

function renderDashboard() {
  const todays = tasks.filter((task) => task.tanggalTugas === today());

  $('statTotal').textContent = todays.length;
  $('statDone').textContent = todays.filter((task) => task.status === 'Selesai').length;
  $('statPending').textContent = todays.filter((task) => ['Belum', 'Proses'].includes(task.status)).length;
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
      <button onclick="setTaskStatus('${safeId}','Proses')">Proses</button>
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
  const done = [...tasks].sort((a, b) => `${b.tanggalTugas || ''}${b.jamTarget || ''}`.localeCompare(`${a.tanggalTugas || ''}${a.jamTarget || ''}`));

  $('historyList').innerHTML = done.length
    ? done.map(card).join('')
    : '<article class="task-card">Riwayat masih kosong.</article>';
}

init();
