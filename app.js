const $ = (id) => document.getElementById(id);

const cfg = window.CAKGUP_CONFIG || { API_URL: '', DEFAULT_PARENT_EMAIL: 'cakgup' };
const POINT_MULTIPLIER = 200;
const DEFAULT_PRAYER_LOCATION = { cityId: '1301', label: 'DKI Jakarta' };
const PRAYER_LOCATION_KEY = 'cakgupPrayerLocation';
const PRAYER_SCHEDULE_CACHE_KEY = 'cakgupPrayerScheduleCache';

let session = readSession();
let activeTab = 'dashboard';
let tasks = [];
let bills = [];
let children = [];
let taskSummary = { stats: { total: 0, done: 0, pending: 0 }, children: {} };
let taskTemplates = [];
let billTemplates = [];
let redemptions = [];
let account = null;
let captchas = {};
let dailyRefreshTimer = null;
let prayerRefreshTimer = null;
let deferredInstallPrompt = null;

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isParent = () => session?.user?.role === 'parent';
const isChild = () => session?.user?.role === 'child';
const apiBase = () => (cfg.API_URL || cfg.GAS_URL || '').replace(/\/$/, '');

const fallbackPrayerTimes = [
  { name: 'Imsak', time: '04:15' },
  { name: 'Subuh', time: '04:25' },
  { name: 'Dzuhur', time: '11:41' },
  { name: 'Ashar', time: '15:02' },
  { name: 'Maghrib', time: '17:47' },
  { name: 'Isya', time: '18:59' }
];

function readSession() {
  try {
    return JSON.parse(localStorage.getItem('cakgupSession') || 'null');
  } catch (error) {
    return null;
  }
}

function saveSession(nextSession) {
  session = nextSession;
  localStorage.setItem('cakgupSession', JSON.stringify(nextSession));
}

function clearSession() {
  session = null;
  localStorage.removeItem('cakgupSession');
}

function authHeaders() {
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

async function apiGet(action, params = {}, requireAuth = true) {
  const base = apiBase();
  if (!base) throw new Error('API_URL belum diatur pada config.js');

  const url = new URL(base);
  url.searchParams.set('action', action);
  url.searchParams.set('ts', Date.now().toString());
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: requireAuth ? authHeaders() : undefined,
    cache: 'no-store'
  });
  return handleApiResponse(response);
}

async function apiPost(action, payload = {}, requireAuth = true) {
  const base = apiBase();
  if (!base) throw new Error('API_URL belum diatur pada config.js');

  const response = await fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(requireAuth ? authHeaders() : {})
    },
    body: JSON.stringify({ action, ...payload })
  });
  return handleApiResponse(response);
}

async function handleApiResponse(response) {
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (!response.ok || json.success === false) {
    if (response.status === 401) {
      clearSession();
      showLogin();
    }
    throw new Error(json.message || `HTTP ${response.status}`);
  }
  return json;
}

function init() {
  if (!apiBase()) {
    showAuthError('parentLoginError', 'Konfigurasi API_URL belum diatur pada config.js.');
    return;
  }

  $('todayLabel').textContent = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date());

  initPrayerTimes();
  initInstallPrompt();
  bindEvents();
  loadAllCaptchas();

  $('parentEmail').value = cfg.DEFAULT_PARENT_EMAIL || 'cakgup';
  $('childFamilyEmail').value = cfg.DEFAULT_PARENT_EMAIL || 'cakgup';

  if (session?.token) {
    showApp().catch((error) => {
      console.error(error);
      clearSession();
      showLogin();
    });
  }
}

function bindEvents() {
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => switchAuthTab(button.dataset.authTab));
  });

  $('parentLoginForm').addEventListener('submit', loginParent);
  $('childLoginForm').addEventListener('submit', loginChild);
  $('registerForm').addEventListener('submit', registerFamily);

  $('logoutBtn').addEventListener('click', logout);
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.addEventListener('click', () => openTab(button.dataset.tab));
  });

  $('refreshBtn').addEventListener('click', loadTasks);
  $('filterChild').addEventListener('change', renderTasks);
  $('filterTaskDate').addEventListener('change', loadTasks);
  $('filterStatus').addEventListener('change', renderTasks);

  $('taskForm').addEventListener('submit', saveTask);
  $('resetForm').addEventListener('click', resetTaskForm);

  $('refreshBillsBtn').addEventListener('click', loadBills);
  $('filterBillMonth').addEventListener('change', loadBills);
  $('filterBillStatus').addEventListener('change', renderBills);
  document.querySelectorAll('[data-bill-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      $('filterBillStatus').value = button.dataset.billFilter || 'all';
      renderBills();
    });
  });
  $('billForm').addEventListener('submit', saveBill);
  $('resetBillForm').addEventListener('click', resetBillForm);

  $('childForm').addEventListener('submit', saveChild);
  $('taskTemplateForm').addEventListener('submit', saveTaskTemplate);
  $('resetTaskTemplateForm').addEventListener('click', resetTaskTemplateForm);
  $('billTemplateForm').addEventListener('submit', saveBillTemplate);
  $('resetBillTemplateForm').addEventListener('click', resetBillTemplateForm);

  $('refreshRedemptionsBtn').addEventListener('click', loadRedemptions);
  $('requestRedeemBtn').addEventListener('click', openRedeemDialog);
  $('redeemForm').addEventListener('submit', submitRedeem);
  $('cancelRedeemBtn').addEventListener('click', closeRedeemDialog);

  $('refreshAccountBtn').addEventListener('click', loadAccount);
  $('prayerLocationBtn')?.addEventListener('click', detectPrayerLocation);
  $('installAppBtn')?.addEventListener('click', handleInstallClick);
  $('closeInstallHelpBtn')?.addEventListener('click', closeInstallGuide);
  $('accountProfileForm').addEventListener('submit', saveAccountProfile);
  $('accountEmailForm').addEventListener('submit', saveAccountEmail);
  $('accountPasswordForm').addEventListener('submit', saveAccountPassword);
  $('logoutAllBtn').addEventListener('click', logoutAllSessions);

  $('childrenSummary').addEventListener('click', (event) => {
    if (event.target.closest('[data-redeem]')) return;
    const card = event.target.closest('[data-child-name]');
    if (!card) return;
    showChildTasks(card.dataset.childName);
  });
}

function switchAuthTab(panelName) {
  $('authCard')?.classList.remove('compact-auth');
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === panelName);
  });
  document.querySelectorAll('.auth-panel').forEach((panel) => {
    const active = panel.dataset.panel === panelName;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
}

async function loadAllCaptchas() {
  await Promise.all([
    loadCaptcha('parent'),
    loadCaptcha('child'),
    loadCaptcha('register')
  ]);
}

async function loadCaptcha(scope) {
  try {
    const data = await apiGet('getCaptcha', {}, false);
    captchas[scope] = data;
    const questionId = scope === 'register' ? 'registerCaptchaQuestion' : `${scope}CaptchaQuestion`;
    const answerId = scope === 'register' ? 'registerCaptchaAnswer' : `${scope}CaptchaAnswer`;
    $(questionId).textContent = data.question;
    $(answerId).value = '';
  } catch (error) {
    const questionId = scope === 'register' ? 'registerCaptchaQuestion' : `${scope}CaptchaQuestion`;
    $(questionId).textContent = 'Captcha gagal dimuat';
  }
}

async function loginParent(event) {
  event.preventDefault();
  hideAuthError('parentLoginError');
  const button = event.submitter;
  setLoading(button, true);

  try {
    const data = await apiPost('loginParent', {
      email: $('parentEmail').value.trim() || cfg.DEFAULT_PARENT_EMAIL || 'cakgup',
      password: $('parentPassword').value,
      captchaId: captchas.parent?.captchaId,
      captchaAnswer: $('parentCaptchaAnswer').value
    }, false);
    saveSession({ token: data.token, user: data.user });
    await showApp();
  } catch (error) {
    showAuthError('parentLoginError', error.message);
    await loadCaptcha('parent');
  } finally {
    setLoading(button, false, 'Masuk Orang Tua');
  }
}

async function loginChild(event) {
  event.preventDefault();
  hideAuthError('childLoginError');
  const button = event.submitter;
  setLoading(button, true);

  try {
    const data = await apiPost('loginChild', {
      email: $('childFamilyEmail').value.trim() || cfg.DEFAULT_PARENT_EMAIL || 'cakgup',
      childName: $('childLoginName').value.trim(),
      pin: $('childPin').value,
      captchaId: captchas.child?.captchaId,
      captchaAnswer: $('childCaptchaAnswer').value
    }, false);
    saveSession({ token: data.token, user: data.user });
    await showApp();
  } catch (error) {
    showAuthError('childLoginError', error.message);
    await loadCaptcha('child');
  } finally {
    setLoading(button, false, 'Masuk Anak');
  }
}

async function registerFamily(event) {
  event.preventDefault();
  hideAuthError('registerError');
  const button = event.submitter;
  setLoading(button, true);

  try {
    const data = await apiPost('registerFamily', {
      headOfFamily: $('regHeadOfFamily').value.trim(),
      email: $('regEmail').value.trim(),
      password: $('regPassword').value,
      captchaId: captchas.register?.captchaId,
      captchaAnswer: $('registerCaptchaAnswer').value
    }, false);
    saveSession({ token: data.token, user: data.user });
    await showApp();
  } catch (error) {
    showAuthError('registerError', error.message);
    await loadCaptcha('register');
  } finally {
    setLoading(button, false, 'Daftar Keluarga Baru');
  }
}

function setLoading(button, loading, label) {
  if (!button) return;
  button.disabled = loading;
  if (loading) {
    button.dataset.label = button.textContent;
    button.textContent = 'Memproses...';
  } else {
    button.textContent = label || button.dataset.label || button.textContent;
  }
}

function showAuthError(id, message) {
  const el = $(id);
  el.textContent = message;
  el.hidden = false;
}

function hideAuthError(id) {
  const el = $(id);
  el.textContent = '';
  el.hidden = true;
}

async function logout() {
  try {
    await apiPost('logout', {});
  } catch (error) {
    console.warn(error);
  }
  clearSession();
  location.reload();
}

function showLogin() {
  $('loginPage').hidden = false;
  $('app').hidden = true;
  $('authCard')?.classList.add('compact-auth');
}

async function showApp() {
  $('loginPage').hidden = true;
  $('app').hidden = false;

  $('filterTaskDate').value = today();
  $('taskDate').value = today();
  $('filterBillMonth').value = currentMonth();
  resetTaskForm();
  resetBillForm();
  resetTaskTemplateForm();
  resetBillTemplateForm();

  applyRoleUi();
  await loadBootstrap();
  startDailyRefresh();
}

function applyRoleUi() {
  const user = session.user;
  const roleText = isParent() ? 'Orang Tua' : `Anak · ${user.childName}`;
  $('roleLabel').textContent = `${roleText} · ${user.email}`;
  $('heroTitle').textContent = isParent() ? `Halo, ${user.headOfFamily || 'Kepala Keluarga'}!` : `Halo, ${user.childName}!`;
  $('heroSubtitle').textContent = isParent()
    ? 'Kelola tugas, tagihan, anak, template, dan persetujuan pencairan poin.'
    : '"Disiplin kecil hari ini di halaman tugasmu adalah kunci kesuksesan besar di masa depanmu."';
  $('heroSubtitle').classList.toggle('quote-text', isChild());

  document.querySelectorAll('[data-parent-only]').forEach((el) => {
    el.hidden = !isParent();
  });

  const filterChildWrap = $('filterChildWrap');
  if (filterChildWrap) filterChildWrap.hidden = isChild();

  $('childRedeemAction').hidden = !isChild();
  if (isChild() && ['bills', 'add', 'manage', 'account'].includes(activeTab)) openTab('dashboard');
}

async function loadBootstrap() {
  setStatus('Mengambil data keluarga...');
  await loadChildren();
  fillChildrenOptions();
  await Promise.all([
    loadTasks(),
    loadTaskSummary(),
    loadRedemptions(),
    isParent() ? loadBills() : Promise.resolve(),
    isParent() ? loadTemplates() : Promise.resolve(),
    isParent() ? loadAccount() : Promise.resolve()
  ]);
  render();
  setStatus('Data tersinkron dari Cloudflare D1.');
}

async function loadChildren() {
  const data = await apiGet('getChildren');
  children = data.data || [];
  if (isChild() && !children.length) {
    children = [{ name: session.user.childName, schoolLevel: session.user.schoolLevel || '' }];
  }
}

function fillChildrenOptions() {
  const selects = [$('child'), $('filterChild'), $('templateChild')];
  selects.forEach((select) => {
    const selected = select.value;
    select.innerHTML = '';
    if (select.id === 'filterChild' && isParent()) {
      select.insertAdjacentHTML('beforeend', '<option value="all">Semua Anak</option>');
    }
    children.forEach((child) => {
      const option = document.createElement('option');
      option.value = child.name;
      option.textContent = child.schoolLevel ? `${child.name} - ${child.schoolLevel}` : child.name;
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === selected)) {
      select.value = selected;
    }
  });

  if (isChild()) $('filterChild').value = session.user.childName;
}

async function loadTaskSummary() {
  const date = $('filterTaskDate').value || today();
  const data = await apiGet('getTaskSummary', { date });
  taskSummary = {
    stats: data.stats || { total: 0, done: 0, pending: 0 },
    children: data.children || {}
  };
  renderDashboard();
}

async function loadTasks() {
  const date = $('filterTaskDate').value || today();
  setStatus('Mengambil tugas...');
  const data = await apiGet('getTasks', { date });
  tasks = (data.data || []).map(normalizeTask);
  await loadTaskSummary();
  renderTasks();
  renderDashboard();
  setStatus('Tugas sudah dimuat.');
}

async function loadBills() {
  if (!isParent()) return;
  const month = $('filterBillMonth').value || currentMonth();
  const data = await apiGet('getBills', { month });
  bills = (data.data || []).map(normalizeBill);
  renderBills();
  renderDashboard();
}

async function loadTemplates() {
  if (!isParent()) return;
  const [taskData, billData] = await Promise.all([
    apiGet('getTaskTemplates'),
    apiGet('getBillTemplates')
  ]);
  taskTemplates = taskData.data || [];
  billTemplates = billData.data || [];
  renderManage();
}

async function loadRedemptions() {
  const data = await apiGet('getRedemptions');
  redemptions = data.data || [];
  renderRedemptions();
}

async function loadAccount() {
  if (!isParent()) return;
  const data = await apiGet('getAccount');
  account = data.data || null;
  renderAccount();
}

function openTab(id) {
  if (!isParent() && ['bills', 'add', 'manage', 'account'].includes(id)) id = 'dashboard';
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
  loadTasks().catch(showStatusError);
}

function render() {
  renderDashboard();
  if (activeTab === 'tasks') renderTasks();
  if (activeTab === 'bills') renderBills();
  if (activeTab === 'manage') renderManage();
  if (activeTab === 'account') renderAccount();
  if (activeTab === 'redemptions') renderRedemptions();
}

function renderDashboard() {
  const stats = taskSummary.stats || { total: 0, done: 0, pending: 0 };
  $('statTotal').textContent = stats.total || 0;
  $('statDone').textContent = stats.done || 0;
  $('statPending').textContent = stats.pending || 0;

  renderBillAlerts();

  const visibleChildren = isChild()
    ? children.filter((child) => child.name === session.user.childName)
    : children;

  $('dashboardSubheading').textContent = isChild()
    ? '"Lihat hebatnya progresmu hari ini! Cairkan poin impianmu, lalu ajak saudaramu buat seru-seruan bareng!"'
    : 'Klik nama anak untuk melihat penugasan harian.';

  $('childrenSummary').innerHTML = visibleChildren.length
    ? visibleChildren.map((child) => {
      const summary = taskSummary.children?.[child.name] || { total: 0, done: 0, points: 0, balancePoints: 0, earnedPoints: 0, pendingRedemptionPoints: 0 };
      const pct = summary.total ? Math.round((summary.done || 0) / summary.total * 100) : 0;
      const action = isChild()
        ? `<button class="redeem-btn" data-redeem onclick="openRedeemDialog()">Ajukan</button>`
        : '';
      return `<article class="child-card child-card-button" data-child-name="${escapeHtml(child.name)}" tabindex="0">
        <div class="child-card-head">
          <h3>${escapeHtml(child.name)}</h3>
          <div class="child-point-actions">
            <strong class="points-badge">${summary.points || 0} poin tersedia</strong>
            ${action}
          </div>
        </div>
        <p>${escapeHtml(child.schoolLevel || '-')} · ${summary.done || 0}/${summary.total || 0} tugas selesai · saldo ${summary.balancePoints ?? summary.points ?? 0} · pending cair ${summary.pendingRedemptionPoints || 0}</p>
        <div class="progress"><span style="width:${pct}%"></span></div>
      </article>`;
    }).join('')
    : '<article class="task-card">Belum ada anak. Tambahkan akun anak pada menu Master Data.</article>';

  renderFamilyScoreboard();
}

function renderBillAlerts() {
  const box = $('billAlertBox');
  if (!box) return;
  if (!isParent()) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const alertBills = bills
    .filter((bill) => bill.status !== 'Sudah Dibayar' && ['overdue', 'today', 'soon'].includes(bill.dueStatus))
    .sort((a, b) => (a.daysToDue ?? 99) - (b.daysToDue ?? 99));
  box.hidden = alertBills.length === 0;
  box.innerHTML = alertBills.length
    ? `<h3>Alarm Tagihan</h3>${alertBills.slice(0, 5).map((bill) => `<p><strong>${escapeHtml(bill.nama)}</strong> · ${escapeHtml(bill.dueMessage)} · ${escapeHtml(bill.jatuhTempo || '-')}</p>`).join('')}`
    : '';
}

function renderFamilyScoreboard() {
  const box = $('familyScoreboard');
  if (!box) return;
  if (!isChild()) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const rows = Object.entries(taskSummary.children || {})
    .map(([name, summary]) => ({ name, ...summary }))
    .sort((a, b) => (b.points || 0) - (a.points || 0));
  box.hidden = rows.length <= 1;
  box.innerHTML = rows.length > 1
    ? `<h2>Papan Semangat Keluarga</h2><p>Ringkasan poin saudara hanya untuk motivasi. Detail tugas tetap pribadi.</p>
       <div class="scoreboard-list">${rows.map((row, index) => {
         const pct = row.total ? Math.round((row.done || 0) / row.total * 100) : 0;
         const self = row.name === session.user.childName;
         return `<article class="score-card ${self ? 'self' : ''}">
           <span class="rank">#${index + 1}</span>
           <strong>${escapeHtml(row.name)}${self ? ' · Kamu' : ''}</strong>
           <small>${row.points || 0} poin tersedia · ${row.done || 0}/${row.total || 0} tugas</small>
           <div class="progress"><span style="width:${pct}%"></span></div>
         </article>`;
       }).join('')}</div>`
    : '';
}

function renderTasks() {
  const childFilter = $('filterChild').value || (isChild() ? session.user.childName : 'all');
  const statusFilter = $('filterStatus').value || 'all';
  const list = tasks
    .filter((task) => (childFilter === 'all' || task.namaAnak === childFilter) && (statusFilter === 'all' || task.status === statusFilter))
    .sort((a, b) => `${a.namaAnak}${a.status}${a.judul}`.localeCompare(`${b.namaAnak}${b.status}${b.judul}`));

  $('taskList').innerHTML = list.length
    ? list.map(taskCard).join('')
    : '<article class="task-card">Belum ada tugas untuk filter ini.</article>';
}

function taskCard(task) {
  const isDone = task.status === 'Selesai';
  const nextStatus = isDone ? 'Belum' : 'Selesai';
  const editButtons = isParent()
    ? `<button class="icon-btn" onclick="editTask('${escapeJs(task.id)}')" title="Edit">&#9998;</button>
       <button class="icon-btn danger" onclick="deleteTask('${escapeJs(task.id)}')" title="Hapus">&#10005;</button>`
    : '';

  const parentMeta = `<div class="meta">
      <span class="pill">${escapeHtml(task.namaAnak)}</span>
      <span class="pill">${escapeHtml(task.tanggalTugas)}</span>
      <span class="pill status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
      <div class="actions chore-actions">
        <button onclick="setTaskStatus('${escapeJs(task.id)}','${nextStatus}')">${isDone ? 'Batalkan' : 'Selesai'}</button>
        ${editButtons}
      </div>
    </div>`;

  const childMeta = `<div class="task-child-meta compact-child-meta">
      <div class="task-compact-row task-compact-row-info">
        <span class="task-inline-text">Beban: ${task.beban}</span>
        <strong class="task-points">${task.beban * POINT_MULTIPLIER} poin jika selesai</strong>
        ${task.deskripsi ? `<span class="task-inline-text">${escapeHtml(task.deskripsi)}</span>` : ''}
      </div>
      <div class="task-compact-row task-compact-row-date">
        <span class="task-inline-text">Penugasan tanggal ${escapeHtml(formatShortDate(task.tanggalTugas))}</span>
      </div>
      <div class="task-compact-row task-compact-row-action">
        <span class="task-inline-text">Status <span class="pill status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span></span>
        <div class="actions chore-actions child-task-actions">
          <button onclick="setTaskStatus('${escapeJs(task.id)}','${nextStatus}')">${isDone ? 'Batalkan' : 'Selesai'}</button>
        </div>
      </div>
    </div>`;

  return `<article class="task-card chore-card ${isChild() ? 'child-compact-card' : ''}">
    <h3>${escapeHtml(task.judul)}</h3>
    ${isChild() ? childMeta : `<p class="task-description">
      <span>Beban: ${task.beban}</span>
      <strong class="task-points">${task.beban * POINT_MULTIPLIER} poin jika selesai</strong>
      ${task.deskripsi ? `<span>${escapeHtml(task.deskripsi)}</span>` : ''}
    </p>${parentMeta}`}
  </article>`;
}

async function saveTask(event) {
  event.preventDefault();
  if (!isParent()) return;

  const id = $('taskId').value || uid('tsk');
  const task = {
    id,
    tanggalTugas: $('taskDate').value,
    namaAnak: $('child').value,
    judul: $('title').value.trim(),
    deskripsi: $('description').value.trim(),
    kategori: $('category').value,
    beban: Number($('load').value || 1),
    status: tasks.find((item) => item.id === id)?.status || 'Belum'
  };

  await apiPost(tasks.some((item) => item.id === id) ? 'updateTask' : 'addTask', { task });
  resetTaskForm();
  await loadTasks();
  openTab('tasks');
  setStatus('Tugas tersimpan.');
}

function editTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task || !isParent()) return;
  $('taskId').value = task.id;
  $('title').value = task.judul;
  $('child').value = task.namaAnak;
  $('category').value = task.kategori;
  $('taskDate').value = task.tanggalTugas;
  $('load').value = task.beban;
  $('description').value = task.deskripsi || '';
  openTab('add');
}

async function setTaskStatus(id, status) {
  await apiPost('updateStatus', { id, status });
  await loadTasks();
  setStatus('Status tugas diperbarui.');
}

async function deleteTask(id) {
  if (!isParent() || !confirm('Hapus tugas ini?')) return;
  await apiPost('deleteTask', { id });
  await loadTasks();
  setStatus('Tugas dihapus.');
}

function resetTaskForm() {
  $('taskForm').reset();
  $('taskId').value = '';
  $('taskDate').value = today();
  $('load').value = 1;
}

function renderBills() {
  if (!isParent()) return;
  const status = $('filterBillStatus').value || 'all';
  const list = bills
    .filter((bill) => status === 'all' || bill.status === status)
    .sort((a, b) => `${a.status}${a.jatuhTempo}${a.nama}`.localeCompare(`${b.status}${b.jatuhTempo}${b.nama}`));

  const paid = bills.filter((bill) => bill.status === 'Sudah Dibayar');
  const unpaid = bills.filter((bill) => bill.status !== 'Sudah Dibayar');
  $('billTotal').textContent = bills.length;
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
  const isPaid = bill.status === 'Sudah Dibayar';
  const nextStatus = isPaid ? 'Belum Dibayar' : 'Sudah Dibayar';
  const dueBadge = bill.dueMessage ? `<span class="pill due-${escapeHtml(bill.dueStatus)}">${escapeHtml(bill.dueMessage)}</span>` : '';
  return `<article class="task-card bill-card ${bill.dueStatus ? `due-card-${escapeHtml(bill.dueStatus)}` : ''}">
    <div class="bill-main">
      <label class="bill-check">
        <input type="checkbox" ${isPaid ? 'checked' : ''} onchange="setBillStatus('${escapeJs(bill.id)}','${nextStatus}')" />
        <span aria-hidden="true"></span>
        <strong>${escapeHtml(bill.nama)}</strong>
      </label>
      ${bill.catatan ? `<small>${escapeHtml(bill.catatan)}</small>` : ''}
    </div>
    <div class="bill-row">
      <div class="meta bill-meta">
        <span class="pill">${escapeHtml(bill.bulan)}</span>
        <span class="pill">Jatuh tempo: ${escapeHtml(bill.jatuhTempo || '-')}</span>
        <span class="pill">${bill.isRecurring ? 'Rutin bulanan' : 'Sekali saja'}</span>
        ${bill.reminderEnabled ? `<span class="pill">Alarm H-${bill.reminderDaysBefore || 0}</span>` : '<span class="pill">Alarm off</span>'}
        ${dueBadge}
        <span class="pill status-${escapeHtml(bill.status.replace(/\s+/g, '-'))}">${escapeHtml(bill.status)}</span>
      </div>
      <div class="actions bill-actions">
        <button class="icon-btn" onclick="editBill('${escapeJs(bill.id)}')" title="Edit">&#9998;</button>
        <button class="icon-btn danger" onclick="deleteBill('${escapeJs(bill.id)}')" title="Hapus">&#10005;</button>
      </div>
    </div>
  </article>`;
}

async function saveBill(event) {
  event.preventDefault();
  if (!isParent()) return;
  const id = $('billId').value || uid('bil');
  const existing = bills.find((item) => item.id === id);
  const kind = document.querySelector('input[name="billKind"]:checked')?.value || 'one_time';
  const bill = {
    id,
    nama: $('billName').value.trim(),
    bulan: $('billMonth').value,
    jatuhTempo: $('billDueDate').value,
    status: existing?.status || 'Belum Dibayar',
    catatan: $('billNote').value.trim(),
    waktuBayar: existing?.waktuBayar || '',
    isRecurring: kind === 'recurring',
    reminderEnabled: $('billReminderEnabled').checked,
    reminderDaysBefore: Number($('billReminderDaysBefore').value || 0),
    createdFromTemplateId: existing?.createdFromTemplateId || ''
  };
  await apiPost(existing ? 'updateBill' : 'addBill', { bill });
  resetBillForm();
  await Promise.all([loadBills(), loadTemplates()]);
  openTab('bills');
  setStatus(bill.isRecurring ? 'Tagihan rutin tersimpan dan template bulanan diperbarui.' : 'Tagihan sekali saja tersimpan.');
}

function editBill(id) {
  const bill = bills.find((item) => item.id === id);
  if (!bill || !isParent()) return;
  $('billId').value = bill.id;
  $('billName').value = bill.nama;
  $('billMonth').value = bill.bulan;
  $('billDueDate').value = bill.jatuhTempo || today();
  $('billNote').value = bill.catatan || '';
  const kind = bill.isRecurring ? 'recurring' : 'one_time';
  document.querySelectorAll('input[name="billKind"]').forEach((input) => { input.checked = input.value === kind; });
  $('billReminderEnabled').checked = bill.reminderEnabled !== false;
  $('billReminderDaysBefore').value = String(bill.reminderDaysBefore ?? 1);
  openTab('add');
}

async function setBillStatus(id, status) {
  const bill = bills.find((item) => item.id === id);
  if (!bill) return;
  await apiPost('updateBill', {
    bill: {
      ...bill,
      status,
      waktuBayar: status === 'Sudah Dibayar' ? new Date().toISOString() : ''
    }
  });
  await loadBills();
  renderDashboard();
  setStatus('Status tagihan diperbarui.');
}

async function deleteBill(id) {
  if (!isParent() || !confirm('Hapus tagihan ini?')) return;
  await apiPost('deleteBill', { id });
  await loadBills();
  renderDashboard();
  setStatus('Tagihan dihapus.');
}

function resetBillForm() {
  $('billForm').reset();
  $('billId').value = '';
  $('billMonth').value = currentMonth();
  $('billDueDate').value = today();
  $('billReminderEnabled').checked = true;
  $('billReminderDaysBefore').value = '1';
  document.querySelectorAll('input[name="billKind"]').forEach((input) => { input.checked = input.value === 'one_time'; });
}

async function saveChild(event) {
  event.preventDefault();
  if (!isParent()) return;
  await apiPost('addChild', {
    name: $('newChildName').value.trim(),
    schoolLevel: $('newChildSchool').value.trim(),
    pin: $('newChildPin').value
  });
  $('childForm').reset();
  await loadChildren();
  fillChildrenOptions();
  renderManage();
  setStatus('Akun anak tersimpan.');
}

async function deleteChild(childId) {
  if (!isParent() || !confirm('Hapus anak ini? Data historis tugas tidak ikut dihapus.')) return;
  await apiPost('deleteChild', { childId });
  await loadChildren();
  fillChildrenOptions();
  renderManage();
}

async function saveTaskTemplate(event) {
  event.preventDefault();
  if (!isParent()) return;
  await apiPost('upsertTaskTemplate', {
    template: {
      templateId: $('taskTemplateId').value,
      childName: $('templateChild').value,
      title: $('templateTitle').value.trim(),
      load: Number($('templateLoad').value || 1),
      category: $('templateCategory').value.trim(),
      description: $('templateDescription').value.trim()
    }
  });
  resetTaskTemplateForm();
  await loadTemplates();
  setStatus('Template tugas tersimpan.');
}

function editTaskTemplate(id) {
  const item = taskTemplates.find((template) => template.templateId === id);
  if (!item) return;
  $('taskTemplateId').value = item.templateId;
  $('templateChild').value = item.childName;
  $('templateTitle').value = item.title;
  $('templateLoad').value = item.load;
  $('templateCategory').value = item.category;
  $('templateDescription').value = item.description || '';
}

async function deleteTaskTemplate(id) {
  if (!confirm('Hapus template tugas ini?')) return;
  await apiPost('deleteTaskTemplate', { templateId: id });
  await loadTemplates();
}

function resetTaskTemplateForm() {
  $('taskTemplateForm').reset();
  $('taskTemplateId').value = '';
  $('templateLoad').value = 1;
  $('templateCategory').value = 'Pekerjaan Rumah';
}

async function saveBillTemplate(event) {
  event.preventDefault();
  if (!isParent()) return;
  await apiPost('upsertBillTemplate', {
    template: {
      templateId: $('billTemplateId').value,
      name: $('billTemplateName').value.trim(),
      note: $('billTemplateNote').value.trim(),
      dueDay: Number($('billTemplateDueDay').value || 28),
      reminderEnabled: $('billTemplateReminderEnabled').checked,
      reminderDaysBefore: Number($('billTemplateReminderDaysBefore').value || 1),
      isActive: $('billTemplateIsActive').checked
    }
  });
  resetBillTemplateForm();
  await loadTemplates();
  setStatus('Template tagihan tersimpan.');
}

function editBillTemplate(id) {
  const item = billTemplates.find((template) => template.templateId === id);
  if (!item) return;
  $('billTemplateId').value = item.templateId;
  $('billTemplateName').value = item.name;
  $('billTemplateNote').value = item.note || '';
  $('billTemplateDueDay').value = item.dueDay || 28;
  $('billTemplateReminderEnabled').checked = item.reminderEnabled !== false;
  $('billTemplateReminderDaysBefore').value = String(item.reminderDaysBefore ?? 1);
  $('billTemplateIsActive').checked = item.isActive !== false;
}

async function deleteBillTemplate(id) {
  if (!confirm('Hapus template tagihan ini?')) return;
  await apiPost('deleteBillTemplate', { templateId: id });
  await loadTemplates();
}

function resetBillTemplateForm() {
  $('billTemplateForm').reset();
  $('billTemplateId').value = '';
  $('billTemplateDueDay').value = 28;
  $('billTemplateReminderEnabled').checked = true;
  $('billTemplateReminderDaysBefore').value = '1';
  $('billTemplateIsActive').checked = true;
}

function renderManage() {
  if (!isParent()) return;
  const isDefault = session.user.isDefaultFamily;

  $('childrenList').innerHTML = children.length
    ? children.map((child) => `<article class="mini-card">
        <strong>${escapeHtml(child.name)}</strong>
        <span>${escapeHtml(child.schoolLevel || '-')}</span>
        <button class="icon-btn danger" onclick="deleteChild('${escapeJs(child.childId)}')">Hapus</button>
      </article>`).join('')
    : '<article class="mini-card">Belum ada anak.</article>';

  $('taskTemplateList').innerHTML = isDefault
    ? '<article class="mini-card">Akun cakgup memakai template tugas lama yang dikunci di backend agar struktur Fatiyyah, Alifah, dan Fatih tetap sama.</article>'
    : (taskTemplates.length ? taskTemplates.map((item) => `<article class="mini-card">
        <strong>${escapeHtml(item.childName)} · ${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.category)} · Beban ${item.load}</span>
        <div class="actions"><button onclick="editTaskTemplate('${escapeJs(item.templateId)}')">Edit</button><button class="danger" onclick="deleteTaskTemplate('${escapeJs(item.templateId)}')">Hapus</button></div>
      </article>`).join('') : '<article class="mini-card">Belum ada template tugas.</article>');

  $('billTemplateList').innerHTML = isDefault
    ? '<article class="mini-card">Akun cakgup memakai 15 template tagihan lama yang dikunci di backend.</article>'
    : (billTemplates.length ? billTemplates.map((item) => `<article class="mini-card">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.note || '-')} · tanggal ${item.dueDay || 28} · ${item.reminderEnabled ? `alarm H-${item.reminderDaysBefore || 0}` : 'alarm off'} · ${item.isActive ? 'aktif' : 'nonaktif'}</span>
        <div class="actions"><button onclick="editBillTemplate('${escapeJs(item.templateId)}')">Edit</button><button class="danger" onclick="deleteBillTemplate('${escapeJs(item.templateId)}')">Hapus</button></div>
      </article>`).join('') : '<article class="mini-card">Belum ada template tagihan.</article>');
}

function getCurrentChildAvailablePoints() {
  const summary = taskSummary.children?.[session.user.childName] || { points: 0 };
  return Number(summary.points || 0);
}

function openRedeemDialog() {
  if (!isChild()) return;
  const points = getCurrentChildAvailablePoints();
  if (points <= 0) {
    setStatus('Belum ada poin yang dapat diajukan. Selesaikan tugas dulu, ya.');
    return;
  }
  $('redeemAvailableText').textContent = `Poin tersedia: ${points}`;
  $('redeemPointsInput').max = String(points);
  $('redeemPointsInput').value = String(Math.floor(points / 1000) * 1000 || points);
  $('redeemNoteInput').value = '';
  if ($('redeemDialog').showModal) $('redeemDialog').showModal();
  else $('redeemDialog').setAttribute('open', 'open');
}

function closeRedeemDialog() {
  if ($('redeemDialog').close) $('redeemDialog').close();
  else $('redeemDialog').removeAttribute('open');
}

async function submitRedeem(event) {
  event.preventDefault();
  if (!isChild()) return;
  const available = getCurrentChildAvailablePoints();
  const points = Number($('redeemPointsInput').value || 0);
  if (!Number.isInteger(points) || points <= 0) {
    setStatus('Nominal poin harus angka bulat lebih dari 0.');
    return;
  }
  if (points > available) {
    setStatus(`Poin tersedia hanya ${available}.`);
    return;
  }
  await apiPost('requestRedeem', { points, note: $('redeemNoteInput').value.trim() });
  closeRedeemDialog();
  await Promise.all([loadTaskSummary(), loadRedemptions()]);
  setStatus(`Pengajuan pencairan ${points} poin dikirim. Menunggu persetujuan orang tua.`);
  openTab('redemptions');
}

async function decideRedeem(id, status) {
  if (!isParent()) return;
  await apiPost('decideRedeem', { id, status });
  await Promise.all([loadTaskSummary(), loadRedemptions()]);
  setStatus(status === 'APPROVED' ? 'Pencairan disetujui.' : 'Pencairan ditolak.');
}

function renderRedemptions() {
  $('childRedeemAction').hidden = !isChild();
  $('redemptionList').innerHTML = redemptions.length
    ? redemptions.map((item) => {
      const actions = isParent() && item.status === 'PENDING'
        ? `<div class="actions"><button onclick="decideRedeem('${escapeJs(item.id)}','APPROVED')">Setujui</button><button class="danger" onclick="decideRedeem('${escapeJs(item.id)}','REJECTED')">Tolak</button></div>`
        : '';
      return `<article class="task-card">
        <h3>${escapeHtml(item.childName)} · ${item.points} poin</h3>
        <p class="task-description"><span>Status: ${escapeHtml(labelRedemption(item.status))}</span><span>Diajukan: ${formatDateTime(item.requestedAt)}</span></p>
        ${item.decidedAt ? `<p class="task-description"><span>Diputuskan: ${formatDateTime(item.decidedAt)}</span></p>` : ''}
        ${actions}
      </article>`;
    }).join('')
    : '<article class="task-card">Belum ada pengajuan pencairan.</article>';
}

function renderAccount() {
  if (!isParent() || !account) return;
  $('accountHeadOfFamily').value = account.head_of_family || session.user.headOfFamily || '';
  $('accountFamilyId').value = account.family_id || session.user.familyId || '';
  $('accountEmail').value = account.email || session.user.email || '';
  $('accountCreatedAt').value = formatDateTime(account.created_at || '');
}

async function saveAccountProfile(event) {
  event.preventDefault();
  if (!isParent()) return;
  const data = await apiPost('updateAccountProfile', { headOfFamily: $('accountHeadOfFamily').value.trim() });
  if (data.user) {
    saveSession({ ...session, user: { ...session.user, ...data.user } });
    applyRoleUi();
  }
  await loadAccount();
  setStatus('Profil keluarga diperbarui.');
}

async function saveAccountEmail(event) {
  event.preventDefault();
  if (!isParent()) return;
  const data = await apiPost('updateAccountEmail', {
    email: $('accountEmail').value.trim(),
    currentPassword: $('accountEmailPassword').value
  });
  if (data.user) saveSession({ ...session, user: { ...session.user, ...data.user } });
  $('accountEmailPassword').value = '';
  applyRoleUi();
  await loadAccount();
  setStatus('Email login diperbarui. Sesi lain telah dikeluarkan.');
}

async function saveAccountPassword(event) {
  event.preventDefault();
  if (!isParent()) return;
  await apiPost('updateAccountPassword', {
    currentPassword: $('accountCurrentPassword').value,
    newPassword: $('accountNewPassword').value,
    confirmPassword: $('accountConfirmPassword').value
  });
  $('accountPasswordForm').reset();
  setStatus('Password diperbarui. Sesi lain telah dikeluarkan.');
}

async function logoutAllSessions() {
  if (!isParent() || !confirm('Logout dari semua perangkat? Anda juga perlu login kembali di perangkat ini.')) return;
  await apiPost('logoutAll');
  clearSession();
  showLogin();
}

function labelRedemption(status) {
  return ({ PENDING: 'Menunggu Persetujuan', APPROVED: 'Disetujui', REJECTED: 'Ditolak' })[status] || status;
}

function normalizeTask(row) {
  return {
    id: String(row.id || uid('tsk')),
    tanggalTugas: String(row.tanggalTugas || row.date || today()).slice(0, 10),
    namaAnak: row.namaAnak || row.child_name || row.child || '',
    judul: row.judul || row.title || '',
    beban: Number(row.beban || row.load || 1),
    kategori: row.kategori || row.category || 'Lainnya',
    status: row.status === 'Selesai' || row.is_completed === 1 ? 'Selesai' : 'Belum',
    deskripsi: row.deskripsi || row.description || '',
    waktuSelesai: row.waktuSelesai || row.waktu_selesai || ''
  };
}

function normalizeBill(row) {
  return {
    id: String(row.id || uid('bil')),
    nama: row.nama || row.name || '',
    bulan: String(row.bulan || row.month || currentMonth()).slice(0, 7),
    status: row.status === 'Sudah Dibayar' ? 'Sudah Dibayar' : 'Belum Dibayar',
    catatan: row.catatan || row.note || '',
    waktuBayar: row.waktuBayar || row.waktu_bayar || '',
    jatuhTempo: row.jatuhTempo || row.jatuh_tempo || '',
    isRecurring: row.isRecurring === true || row.is_recurring === 1,
    reminderEnabled: row.reminderEnabled !== false && row.reminder_enabled !== 0,
    reminderDaysBefore: Number(row.reminderDaysBefore ?? row.reminder_days_before ?? 0),
    reminderSentAt: row.reminderSentAt || row.reminder_sent_at || '',
    createdFromTemplateId: row.createdFromTemplateId || row.created_from_template_id || '',
    dueStatus: row.dueStatus || 'normal',
    dueMessage: row.dueMessage || '',
    daysToDue: row.daysToDue ?? null
  };
}

function setStatus(message) {
  $('syncStatus').textContent = message;
}

function showStatusError(error) {
  console.error(error);
  setStatus(`Gagal: ${error.message}`);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatShortDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
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

function escapeJs(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

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

function readJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Gagal menyimpan localStorage', error);
  }
}

function getStoredPrayerLocation() {
  return readJsonStorage(PRAYER_LOCATION_KEY, DEFAULT_PRAYER_LOCATION) || DEFAULT_PRAYER_LOCATION;
}

function setPrayerCaption(label) {
  const cityLabel = label || DEFAULT_PRAYER_LOCATION.label;
  $('prayerCaption').textContent = `Waktu Shalat ${cityLabel} dan Sekitarnya`;
}

function setPrayerHelperText(message) {
  const helper = $('prayerHelperText');
  if (helper) helper.textContent = message;
}

function setPrayerLocationButtonLabel(label) {
  const el = $('prayerLocationBtnText');
  const button = $('prayerLocationBtn');
  const safeLabel = label || 'Lokasi';
  if (el) el.textContent = safeLabel;
  if (button) {
    button.title = `Deteksi lokasi untuk jadwal shalat${safeLabel === 'Lokasi' ? '' : `: ${safeLabel}`}`;
    button.setAttribute('aria-label', button.title);
  }
}

function getPrayerScheduleCache() {
  return readJsonStorage(PRAYER_SCHEDULE_CACHE_KEY, {}) || {};
}

function setPrayerScheduleCache(cache) {
  writeJsonStorage(PRAYER_SCHEDULE_CACHE_KEY, cache);
}

function renderPrayerTimes(times, sourceLabel = 'fallback lokal') {
  const container = $('loginPrayerTimes');
  if (!container) return;
  const nextIndex = nextPrayerIndex(times);
  container.innerHTML = times.map((item, index) => `
    <div class="prayer-time-item${index === nextIndex ? ' next' : ''}" title="${escapeHtml(sourceLabel)}">
      <span>${escapeHtml(item.name)}</span>
      <strong>${escapeHtml(item.time || '--:--')}</strong>
    </div>
  `).join('');
}

function prayerTimesFromSchedule(jadwal) {
  return [
    { name: 'Imsak', time: jadwal.imsak },
    { name: 'Subuh', time: jadwal.subuh },
    { name: 'Dzuhur', time: jadwal.dzuhur },
    { name: 'Ashar', time: jadwal.ashar },
    { name: 'Maghrib', time: jadwal.maghrib },
    { name: 'Isya', time: jadwal.isya }
  ];
}

async function fetchPrayerTimesForLocation(locationInfo = DEFAULT_PRAYER_LOCATION) {
  const location = { ...DEFAULT_PRAYER_LOCATION, ...(locationInfo || {}) };
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const cacheKey = `${location.cityId}-${year}-${month}-${day}`;

  setPrayerCaption(location.label);
  setPrayerLocationButtonLabel(location.label);

  const cache = getPrayerScheduleCache();
  if (cache[cacheKey]?.times) {
    renderPrayerTimes(cache[cacheKey].times, `Cache jadwal shalat ${location.label}`);
    setPrayerHelperText(`Jadwal shalat menyesuaikan lokasi ${location.label}.`);
    return cache[cacheKey].times;
  }

  renderPrayerTimes(fallbackPrayerTimes, 'Jadwal fallback lokal');
  try {
    const response = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${encodeURIComponent(location.cityId)}/${year}/${month}/${day}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const jadwal = result?.data?.jadwal;
    if (!jadwal) throw new Error('Jadwal tidak ditemukan');
    const times = prayerTimesFromSchedule(jadwal);
    cache[cacheKey] = { times, cachedAt: new Date().toISOString(), label: location.label };
    setPrayerScheduleCache(cache);
    renderPrayerTimes(times, `API jadwal shalat ${location.label}`);
    setPrayerHelperText(`Jadwal shalat menyesuaikan lokasi ${location.label}.`);
    return times;
  } catch (error) {
    console.warn('Gagal mengambil jadwal shalat; menggunakan fallback lokal.', error);
    setPrayerHelperText(`Gagal memuat jadwal ${location.label}. Menampilkan jadwal cadangan sementara.`);
    renderPrayerTimes(fallbackPrayerTimes, `Fallback ${location.label}`);
    return fallbackPrayerTimes;
  }
}

async function reverseGeocode(lat, lon) {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accept-language=id`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function searchPrayerCity(query) {
  if (!query) return null;
  const response = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(query)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  const rows = result?.data || result?.results || [];
  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first) return null;
  return {
    cityId: String(first.id || first.id_kota || first.city_id || first.kode || ''),
    label: first.lokasi || first.nama || first.city || query
  };
}

async function resolvePrayerLocationFromGps(position) {
  const { latitude, longitude } = position.coords;
  const geo = await reverseGeocode(latitude, longitude);
  const address = geo?.address || {};
  const candidates = [
    address.city_district,
    address.city,
    address.town,
    address.county,
    address.municipality,
    address.state,
    geo?.name
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const city = await searchPrayerCity(candidate);
      if (city?.cityId) return city;
    } catch (error) {
      console.warn('Pencarian kota shalat gagal untuk kandidat:', candidate, error);
    }
  }

  throw new Error('Wilayah jadwal shalat tidak ditemukan dari lokasi GPS.');
}

async function detectPrayerLocation() {
  if (!navigator.geolocation) {
    setPrayerHelperText('Browser ini belum mendukung deteksi lokasi.');
    return;
  }

  const button = $('prayerLocationBtn');
  const originalText = $('prayerLocationBtnText')?.textContent || 'Lokasi';
  if (button) button.disabled = true;
  setPrayerLocationButtonLabel('Mencari...');
  setPrayerHelperText('Mengambil koordinat GPS Anda...');

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      });
    });
    const location = await resolvePrayerLocationFromGps(position);
    writeJsonStorage(PRAYER_LOCATION_KEY, location);
    await fetchPrayerTimesForLocation(location);
  } catch (error) {
    console.warn('Deteksi lokasi gagal:', error);
    setPrayerHelperText('Izin lokasi ditolak atau lokasi belum dapat dibaca. Jadwal default tetap digunakan.');
    setPrayerLocationButtonLabel(originalText);
  } finally {
    if (button) button.disabled = false;
  }
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallButton() {
  const button = $('installAppBtn');
  if (!button) return;
  button.hidden = isStandaloneMode();
  button.classList.toggle('install-ready', Boolean(deferredInstallPrompt));
}

function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButton();
    setPrayerHelperText('Aplikasi berhasil dipasang. Anda bisa membukanya langsung dari layar utama.');
  });

  updateInstallButton();
}

async function handleInstallClick() {
  if (!deferredInstallPrompt) {
    showInstallGuide();
    return;
  }
  deferredInstallPrompt.prompt();
  try {
    await deferredInstallPrompt.userChoice;
  } catch (error) {
    console.warn('Prompt install gagal dibuka', error);
    showInstallGuide();
  }
  deferredInstallPrompt = null;
  updateInstallButton();
}

function showInstallGuide() {
  const dialog = $('installHelpDialog');
  if (dialog?.showModal) dialog.showModal();
  else alert('Untuk install aplikasi: buka menu browser, lalu pilih Install app atau Tambahkan ke layar utama.');
}

function closeInstallGuide() {
  const dialog = $('installHelpDialog');
  if (dialog?.close) dialog.close();
}

function initPrayerTimes() {
  const location = getStoredPrayerLocation();
  fetchPrayerTimesForLocation(location);
  if (prayerRefreshTimer) clearInterval(prayerRefreshTimer);
  prayerRefreshTimer = setInterval(() => fetchPrayerTimesForLocation(getStoredPrayerLocation()), 60 * 60 * 1000);
}

function startDailyRefresh() {
  if (dailyRefreshTimer) return;
  dailyRefreshTimer = setInterval(async () => {
    if (($('filterTaskDate').value || today()) === today()) {
      await loadTasks();
    }
    if (isParent() && ($('filterBillMonth').value || currentMonth()) === currentMonth()) {
      await loadBills();
    }
  }, 60000);
}

window.editTask = editTask;
window.deleteTask = deleteTask;
window.setTaskStatus = setTaskStatus;
window.editBill = editBill;
window.deleteBill = deleteBill;
window.setBillStatus = setBillStatus;
window.deleteChild = deleteChild;
window.editTaskTemplate = editTaskTemplate;
window.deleteTaskTemplate = deleteTaskTemplate;
window.editBillTemplate = editBillTemplate;
window.deleteBillTemplate = deleteBillTemplate;
window.openRedeemDialog = openRedeemDialog;
window.decideRedeem = decideRedeem;

init();
