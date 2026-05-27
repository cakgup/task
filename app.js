const $ = (id) => document.getElementById(id);

function getConfig() {
  return window.CAKGUP_CONFIG || { APP_PASSWORD: '', GAS_URL: '', CHILDREN: [] };
}

const cfg = getConfig();
let tasks = [];
let bills = [];
let activeTab = 'dashboard';
let activeDate = null;
let dailyRefreshTimer = null;
let taskSummary = { stats: { total: 0, done: 0, pending: 0 }, children: {} };
let pointRedemptions = [];

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);

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

function readCachedTasks() {
  return JSON.parse(localStorage.getItem('cakgupTasks') || '[]').map(normalizeTask);
}

function cacheTaskRows(rows) {
  const map = new Map(readCachedTasks().map((task) => [task.id, task]));
  rows.map(normalizeTask).forEach((task) => {
    if (task.id) map.set(task.id, task);
  });
  const cached = Array.from(map.values());
  localStorage.setItem('cakgupTasks', JSON.stringify(cached));
  return cached;
}

function tasksForDate(date) {
  return readCachedTasks().filter((task) => task.tanggalTugas === date);
}

function readPointRedemptions() {
  return JSON.parse(localStorage.getItem('cakgupPointRedemptions') || '[]');
}

function savePointRedemptions() {
  localStorage.setItem('cakgupPointRedemptions', JSON.stringify(pointRedemptions));
}

function redeemedPointsByChild() {
  return pointRedemptions.reduce((totals, item) => {
    const name = item.namaAnak || '';
    if (!name) return totals;
    totals[name] = (totals[name] || 0) + Number(item.points || 0);
    return totals;
  }, {});
}

function applyLocalRedemptions(summary) {
  pointRedemptions = readPointRedemptions();
  const redeemed = redeemedPointsByChild();
  const next = {
    stats: summary.stats || { total: 0, done: 0, pending: 0 },
    children: { ...(summary.children || {}) }
  };

  Object.keys(next.children).forEach((name) => {
    const child = { ...next.children[name] };
    child.earnedPoints = child.earnedPoints ?? child.points ?? 0;
    child.redeemedPoints = child.redeemedPoints ?? redeemed[name] ?? 0;
    child.points = Math.max(0, child.earnedPoints - child.redeemedPoints);
    next.children[name] = child;
  });

  return next;
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
  $('refreshBillsBtn').onclick = loadBills;
  $('filterChild').onchange = render;
  $('filterTaskDate').onchange = () => loadTasks();
  $('filterStatus').onchange = render;
  $('filterBillMonth').onchange = renderBills;
  $('filterBillStatus').onchange = renderBills;
  document.querySelectorAll('[data-bill-filter]').forEach((button) => {
    button.onclick = () => filterBillsByStatus(button.dataset.billFilter);
  });
  $('billForm').addEventListener('submit', saveBill);
  $('resetBillForm').onclick = resetBillForm;
  $('childrenSummary').onclick = (event) => {
    if (event.target.closest('[data-redeem-child]')) return;
    const card = event.target.closest('[data-child-name]');
    if (!card) return;
    showChildTasks(card.dataset.childName);
  };
  $('childrenSummary').onkeydown = (event) => {
    if (event.target.closest('[data-redeem-child]')) return;
    if (!['Enter', ' '].includes(event.key)) return;
    const card = event.target.closest('[data-child-name]');
    if (!card) return;
    event.preventDefault();
    showChildTasks(card.dataset.childName);
  };
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
  activeDate = today();
  $('taskDate').value = today();
  $('filterTaskDate').value = today();
  resetBillForm();
  loadTasks();
  loadBills();
  startDailyTaskRefresh();
}

function startDailyTaskRefresh() {
  if (dailyRefreshTimer) return;

  dailyRefreshTimer = setInterval(async () => {
    const currentDate = today();
    if (currentDate === activeDate) return;

    const previousMonth = activeDate?.slice(0, 7);
    activeDate = currentDate;
    $('taskDate').value = currentDate;
    $('filterTaskDate').value = currentDate;

    await loadTasks();
    if (currentDate.slice(0, 7) !== previousMonth) {
      await loadBills();
    }
  }, 60000);
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

function showChildTasks(childName) {
  $('filterChild').value = childName;
  $('filterTaskDate').value = today();
  $('filterStatus').value = 'all';
  openTab('tasks');
  loadTasks();
}

async function redeemChildPoints(childName) {
  const summary = taskSummary.children?.[childName] || { points: 0 };
  const points = Number(summary.points || 0);

  if (points <= 0) {
    setStatus(`${childName} belum punya poin yang bisa dicairkan.`);
    return;
  }

  if (!confirm(`Cairkan ${points} poin milik ${childName}?`)) return;

  const redemption = {
    id: `rdm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tanggal: new Date().toISOString(),
    namaAnak: childName,
    points,
    catatan: 'Poin dicairkan'
  };

  pointRedemptions = [redemption, ...readPointRedemptions()];
  savePointRedemptions();

  if (!taskSummary.children) taskSummary.children = {};
  const current = taskSummary.children[childName] || {};
  taskSummary.children[childName] = {
    ...current,
    earnedPoints: current.earnedPoints ?? current.points ?? points,
    redeemedPoints: Number(current.redeemedPoints || 0) + points,
    points: 0
  };

  renderDashboard();
  await sendToGas('redeemPoints', redemption);
  setStatus(`${points} poin ${childName} sudah dicairkan.`);
}

function setStatus(message) {
  $('syncStatus').textContent = message;
}

function filterBillsByStatus(status) {
  $('filterBillStatus').value = status || 'all';
  renderBills();
}

function normalizeTask(task) {
  const legacyLoad = legacyTaskLoad(task);
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
    catatan: task.catatan || '',
    beban: Number(task.beban || task.load || legacyLoad || 1)
  };
}

function legacyTaskLoad(task) {
  const match = String(task.catatan || task.deskripsi || '').match(/beban\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : 1;
}

function taskLoad(task) {
  const load = Number(task.beban || task.load || 0);
  return load > 0 ? load : legacyTaskLoad(task);
}

function isLegacyLoadText(text) {
  return /^beban\s*:\s*\d+$/i.test(String(text || '').trim());
}

function taskPoints(task) {
  return taskLoad(task) * 200;
}

function dailyTaskKey(task) {
  return [
    normalizeDateOnly(task.tanggalTugas),
    normalizeChildName(task.namaAnak || task.child),
    String(task.judul || task.title || '').trim().replace(/\s+/g, ' ')
  ].join('|').toLowerCase();
}

function uniqueDailyTasks(rows) {
  const seen = new Set();
  const unique = [];

  rows.forEach((task) => {
    const key = dailyTaskKey(task);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(task);
  });

  return unique;
}

function createDailyTask(template) {
  return normalizeTask({
    id: uid(),
    tanggalInput: new Date().toISOString(),
    namaAnak: template.child,
    judul: template.title,
    deskripsi: template.description || '',
    kategori: template.category || 'Pekerjaan Rumah',
    tanggalTugas: today(),
    jamTarget: template.time || '',
    prioritas: template.priority || 'Normal',
    status: 'Belum',
    waktuSelesai: '',
    catatan: '',
    beban: Number(template.load || 1)
  });
}

async function ensureDailyTasks() {
  const templates = Array.isArray(cfg.DAILY_TASKS) ? cfg.DAILY_TASKS : [];
  if (!templates.length) return;
  if (($('filterTaskDate')?.value || today()) !== today()) return;

  if (cfg.GAS_URL) {
    await sendToGas('ensureDailyTasks', {
      date: today(),
      templates
    });
    return;
  }

  const existingKeys = new Set(tasks.map(dailyTaskKey));
  const missingTasks = [];

  templates.map(createDailyTask).forEach((task) => {
    const key = dailyTaskKey(task);
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    missingTasks.push(task);
  });

  if (!missingTasks.length) return;

  tasks = uniqueDailyTasks([...missingTasks, ...tasks]);
  cacheTaskRows(tasks);

  await Promise.all(missingTasks.map((task) => sendToGas('addTask', { task })));
  setStatus(`${missingTasks.length} tugas harian dibuat otomatis untuk hari ini.`);
}

function computeTaskSummaryFromCache(date = today()) {
  const cached = readCachedTasks();
  const daily = cached.filter((task) => task.tanggalTugas === date);
  const children = {};

  cached.forEach((task) => {
    const name = task.namaAnak || '';
    if (!name) return;
    if (!children[name]) children[name] = { total: 0, done: 0, points: 0 };

    children[name].total += 1;
    if (task.status === 'Selesai') {
      children[name].done += 1;
      children[name].points += taskPoints(task);
    }
  });

  return {
    stats: {
      total: daily.length,
      done: daily.filter((task) => task.status === 'Selesai').length,
      pending: daily.filter((task) => ['Belum', 'Dikerjakan'].includes(task.status)).length
    },
    children
  };
}

async function loadTaskSummary() {
  const date = today();
  pointRedemptions = readPointRedemptions();

  try {
    if (cfg.GAS_URL) {
      const response = await fetch(`${cfg.GAS_URL}?action=getTaskSummary&date=${encodeURIComponent(date)}&ts=${Date.now()}`);
      const json = await response.json();
      if (json.success === false) throw new Error(json.message || 'Gagal membaca ringkasan tugas');
      const summary = {
        stats: json.stats || { total: 0, done: 0, pending: 0 },
        children: json.children || {}
      };
      taskSummary = json.redemptionsIncluded ? summary : applyLocalRedemptions(summary);
      return;
    }
  } catch (error) {
    console.warn('Gagal membaca ringkasan tugas:', error);
  }

  taskSummary = applyLocalRedemptions(computeTaskSummaryFromCache(date));
}

async function loadTasks() {
  setStatus('Mengambil data dari Google Sheet...');
  const filterDate = $('filterTaskDate')?.value || today();

  try {
    if (cfg.GAS_URL) {
      const response = await fetch(`${cfg.GAS_URL}?action=getTasks&date=${encodeURIComponent(filterDate)}&ts=${Date.now()}`);
      const json = await response.json();
      const rows = Array.isArray(json) ? json : (json.data || []);
      tasks = uniqueDailyTasks(rows.map(normalizeTask).filter((task) => task.id && task.judul));
      cacheTaskRows(tasks);
      await ensureDailyTasks();
      if (filterDate === today()) {
        const refreshed = await fetch(`${cfg.GAS_URL}?action=getTasks&date=${encodeURIComponent(filterDate)}&ts=${Date.now()}`);
        const refreshedJson = await refreshed.json();
        const refreshedRows = Array.isArray(refreshedJson) ? refreshedJson : (refreshedJson.data || []);
        tasks = uniqueDailyTasks(refreshedRows.map(normalizeTask).filter((task) => task.id && task.judul));
        cacheTaskRows(tasks);
      }
      await loadTaskSummary();
      setStatus('Data tersinkron dengan Google Sheet.');
    } else {
      tasks = tasksForDate(filterDate);
      await ensureDailyTasks();
      taskSummary = applyLocalRedemptions(computeTaskSummaryFromCache());
      setStatus('Mode lokal aktif. Sinkronisasi belum diatur.');
    }
  } catch (error) {
    tasks = tasksForDate(filterDate);
    await ensureDailyTasks();
    taskSummary = applyLocalRedemptions(computeTaskSummaryFromCache());
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
  cacheTaskRows(tasks);
  taskSummary = applyLocalRedemptions(computeTaskSummaryFromCache());
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
    jamTarget: old?.jamTarget || '',
    prioritas: old?.prioritas || 'Normal',
    status: old?.status || 'Belum',
    waktuSelesai: old?.waktuSelesai || '',
    catatan: old?.catatan || '',
    beban: Number($('load').value || 1)
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
  $('load').value = taskLoad(task);
  $('description').value = task.deskripsi;

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
  $('load').value = 1;
}

function render() {
  renderDashboard();

  if (activeTab === 'tasks') {
    renderTasks();
  }

  if (activeTab === 'bills') {
    renderBills();
  }
}

function normalizeBill(bill) {
  return {
    id: String(bill.id || `bil-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    tanggalInput: bill.tanggalInput || new Date().toISOString(),
    nama: bill.nama || bill.name || '',
    jumlah: Number(bill.jumlah || bill.amount || 0),
    bulan: String(bill.bulan || bill.month || currentMonth()).slice(0, 7),
    jatuhTempo: normalizeDateOnly(bill.jatuhTempo || bill.dueDate || today()),
    status: bill.status === 'Sudah Dibayar' ? 'Sudah Dibayar' : 'Belum Dibayar',
    waktuBayar: bill.waktuBayar || '',
    catatan: bill.catatan || bill.note || ''
  };
}

function billSeedKey(bill) {
  return [
    bill.bulan || bill.month,
    bill.nama || bill.name
  ].join('|').toLowerCase();
}

function createSeedBill(template) {
  const month = template.month || currentMonth();
  return normalizeBill({
    id: `seed-${month}-${String(template.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    tanggalInput: new Date().toISOString(),
    nama: template.name,
    jumlah: template.amount || 0,
    bulan: month,
    jatuhTempo: template.dueDate || `${month}-28`,
    status: template.status || 'Belum Dibayar',
    waktuBayar: template.status === 'Sudah Dibayar' ? new Date().toISOString() : '',
    catatan: template.note || ''
  });
}

function ensureSeedBills() {
  const templates = Array.isArray(cfg.MONTHLY_BILLS) ? cfg.MONTHLY_BILLS : [];
  if (!templates.length) return;

  const existingKeys = new Set(bills.map(billSeedKey));
  const missingBills = templates
    .map(createSeedBill)
    .filter((bill) => !existingKeys.has(billSeedKey(bill)));

  if (!missingBills.length) return;

  bills = [...missingBills, ...bills];
  localStorage.setItem('cakgupBills', JSON.stringify(bills));
}

function resetBillForm() {
  $('billForm').reset();
  $('billId').value = '';
  $('billMonth').value = currentMonth();
  $('billDueDate').value = today();
  updateBillMonthFilter();
}

function updateBillMonthFilter() {
  const filter = $('filterBillMonth');
  const selected = filter.value || currentMonth();
  const months = Array.from(new Set([currentMonth(), ...bills.map((bill) => bill.bulan)])).sort().reverse();

  filter.innerHTML = months
    .map((month) => `<option value="${escapeHtml(month)}">${escapeHtml(month)}</option>`)
    .join('');
  filter.value = months.includes(selected) ? selected : currentMonth();
}

async function loadBills() {
  try {
    if (cfg.GAS_URL) {
      const response = await fetch(`${cfg.GAS_URL}?action=getBills&ts=${Date.now()}`);
      const json = await response.json();
      if (json.success === false) throw new Error(json.message || 'Gagal membaca tagihan');
      const rows = Array.isArray(json) ? json : (json.data || []);
      bills = rows.map(normalizeBill).filter((bill) => bill.id && bill.nama);
    } else {
      bills = JSON.parse(localStorage.getItem('cakgupBills') || '[]').map(normalizeBill);
    }
  } catch (error) {
    bills = JSON.parse(localStorage.getItem('cakgupBills') || '[]').map(normalizeBill);
  }

  ensureSeedBills();
  localStorage.setItem('cakgupBills', JSON.stringify(bills));
  updateBillMonthFilter();
  renderBills();
}

async function persistBill(action, payload) {
  localStorage.setItem('cakgupBills', JSON.stringify(bills));
  await sendToGas(action, payload);
}

async function saveBill(event) {
  event.preventDefault();

  const id = $('billId').value || `bil-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const old = bills.find((bill) => bill.id === id);
  const bill = normalizeBill({
    id,
    tanggalInput: old?.tanggalInput || new Date().toISOString(),
    nama: $('billName').value,
    jumlah: old?.jumlah || 0,
    bulan: $('billMonth').value,
    jatuhTempo: $('billDueDate').value,
    status: old?.status || 'Belum Dibayar',
    waktuBayar: old?.waktuBayar || '',
    catatan: $('billNote').value
  });

  bills = old
    ? bills.map((item) => item.id === id ? bill : item)
    : [bill, ...bills];

  await persistBill(old ? 'updateBill' : 'addBill', { bill });
  resetBillForm();
  renderBills();
  setStatus('Tagihan tersimpan.');
}

function editBill(id) {
  const bill = bills.find((item) => item.id === id);
  if (!bill) return;

  $('billId').value = bill.id;
  $('billName').value = bill.nama;
  $('billMonth').value = bill.bulan;
  $('billDueDate').value = bill.jatuhTempo;
  $('billNote').value = bill.catatan;
  openTab('add');
}

async function setBillStatus(id, status) {
  const waktuBayar = status === 'Sudah Dibayar' ? new Date().toISOString() : '';
  let updatedBill = null;

  bills = bills.map((bill) => {
    if (bill.id !== id) return bill;
    updatedBill = {
      ...bill,
      status,
      waktuBayar: status === 'Sudah Dibayar' ? waktuBayar : ''
    };
    return updatedBill;
  });

  if (updatedBill) {
    await persistBill('updateBill', { bill: updatedBill });
  }
  renderBills();
  setStatus('Status tagihan diperbarui.');
}

async function deleteBill(id) {
  if (!confirm('Hapus tagihan ini?')) return;

  bills = bills.filter((bill) => bill.id !== id);
  await persistBill('deleteBill', { id });
  updateBillMonthFilter();
  renderBills();
  setStatus('Tagihan dihapus.');
}

function renderBills() {
  if (!$('billList')) return;

  updateBillMonthFilter();
  const month = $('filterBillMonth').value || currentMonth();
  const status = $('filterBillStatus').value || 'all';
  const list = bills
    .filter((bill) => bill.bulan === month && (status === 'all' || bill.status === status))
    .sort((a, b) => `${a.jatuhTempo}${a.nama}`.localeCompare(`${b.jatuhTempo}${b.nama}`));
  const monthBills = bills.filter((bill) => bill.bulan === month);
  const paid = monthBills.filter((bill) => bill.status === 'Sudah Dibayar');
  const unpaid = monthBills.filter((bill) => bill.status !== 'Sudah Dibayar');

  $('billTotal').textContent = monthBills.length;
  $('billPaid').textContent = paid.length;
  $('billUnpaid').textContent = unpaid.length;
  document.querySelectorAll('[data-bill-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.billFilter === status);
  });

  $('billList').innerHTML = list.length
    ? list.map(billCard).join('')
    : '<article class="task-card">Belum ada tagihan untuk bulan ini.</article>';
}

function billCard(bill) {
  const safeId = escapeHtml(bill.id);
  const isPaid = bill.status === 'Sudah Dibayar';
  const nextStatus = isPaid ? 'Belum Dibayar' : 'Sudah Dibayar';
  const note = bill.catatan ? `<small>${escapeHtml(bill.catatan)}</small>` : '';

  return `<article class="task-card bill-card">
    <div class="bill-main">
      <label class="bill-check">
        <input type="checkbox" ${isPaid ? 'checked' : ''} onchange="setBillStatus('${safeId}','${nextStatus}')" />
        <span aria-hidden="true"></span>
        <strong>${escapeHtml(bill.nama)}</strong>
      </label>
      ${note}
    </div>
    <div class="bill-row">
      <div class="meta bill-meta">
        <span class="pill">${escapeHtml(bill.bulan)}</span>
        <span class="pill">Jatuh tempo: ${escapeHtml(bill.jatuhTempo)}</span>
        <span class="pill status-${escapeHtml(bill.status.replace(/\s+/g, '-'))}">${escapeHtml(bill.status)}</span>
      </div>
      <div class="actions bill-actions">
        <button class="icon-btn" onclick="editBill('${safeId}')" aria-label="Edit tagihan" title="Edit">&#9998;</button>
        <button class="icon-btn" onclick="deleteBill('${safeId}')" aria-label="Hapus tagihan" title="Hapus">&#10005;</button>
      </div>
    </div>
  </article>`;
}

function renderDashboard() {
  const stats = taskSummary.stats || { total: 0, done: 0, pending: 0 };
  const summaries = taskSummary.children || {};

  $('statTotal').textContent = stats.total || 0;
  $('statDone').textContent = stats.done || 0;
  $('statPending').textContent = stats.pending || 0;

  $('childrenSummary').innerHTML = cfg.CHILDREN.map((child) => {
    const summary = summaries[child.name] || { total: 0, done: 0, points: 0 };
    const pct = summary.total ? Math.round(summary.done / summary.total * 100) : 0;

    return `<article class="child-card child-card-button" data-child-name="${escapeHtml(child.name)}" tabindex="0" role="button" aria-label="Lihat tugas ${escapeHtml(child.name)}">
      <div class="child-card-head">
        <h3>${escapeHtml(child.name)}</h3>
        <div class="child-point-actions">
          <strong class="points-badge">Total ${summary.points || 0} poin</strong>
          <button class="redeem-btn" data-redeem-child="${escapeHtml(child.name)}" onclick="redeemChildPoints('${escapeHtml(child.name)}')">Cairkan</button>
        </div>
      </div>
      <p>${escapeHtml(child.school)} · Semua tugas: ${summary.done || 0}/${summary.total || 0} selesai</p>
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
  const load = taskLoad(task);
  const points = taskPoints(task);
  const description = task.deskripsi && !isLegacyLoadText(task.deskripsi)
    ? `<span>${escapeHtml(task.deskripsi)}</span>`
    : '';
  const isDone = task.status === 'Selesai';
  const actionStatus = isDone ? 'Belum' : 'Selesai';
  const actionLabel = isDone ? 'Cancel' : 'Selesai';

  return `<article class="task-card chore-card">
    <h3>${escapeHtml(task.judul)}</h3>
    <p class="task-description">
      <span>Beban: ${load}</span>
      <strong class="task-points">${points} poin jika selesai</strong>
      ${description}
    </p>
    <div class="meta">
      <span class="pill">${escapeHtml(task.namaAnak)}</span>
      <span class="pill">${escapeHtml(task.tanggalTugas)} ${escapeHtml(task.jamTarget || '')}</span>
      <span class="pill status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
      <div class="actions chore-actions">
        <button onclick="setTaskStatus('${safeId}','${actionStatus}')">${actionLabel}</button>
        <button class="icon-btn" onclick="editTask('${safeId}')" aria-label="Edit tugas" title="Edit">&#9998;</button>
        <button class="icon-btn danger" onclick="delTask('${safeId}')" aria-label="Hapus tugas" title="Hapus">&#10005;</button>
      </div>
    </div>
  </article>`;
}

function renderTasks() {
  const fc = $('filterChild').value;
  const fd = $('filterTaskDate').value || today();
  const fs = $('filterStatus').value;

  const list = tasks
    .filter((task) => {
      const childMatches = fc === 'all' || task.namaAnak === fc;
      const dateMatches = task.tanggalTugas === fd;
      const statusMatches = fs === 'all' || task.status === fs;
      return childMatches && dateMatches && statusMatches;
    })
    .sort((a, b) => `${a.tanggalTugas || ''}${a.jamTarget || ''}`.localeCompare(`${b.tanggalTugas || ''}${b.jamTarget || ''}`));

  $('taskList').innerHTML = list.length
    ? list.map(card).join('')
    : '<article class="task-card">Belum ada tugas.</article>';
}

init();

