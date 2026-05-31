const $ = (id) => document.getElementById(id);

const cfg = window.CAKGUP_CONFIG || { API_URL: '', DEFAULT_PARENT_EMAIL: 'cakgup' };
const POINT_MULTIPLIER = 200;

let session = readSession();
let activeTab = 'dashboard';
let tasks = [];
let bills = [];
let children = [];
let taskSummary = { stats: { total: 0, done: 0, pending: 0 }, children: {} };
let taskTemplates = [];
let billTemplates = [];
let redemptions = [];
let captchas = {};
let dailyRefreshTimer = null;

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isParent = () => session?.user?.role === 'parent';
const isChild = () => session?.user?.role === 'child';
const apiBase = () => (cfg.API_URL || cfg.GAS_URL || '').replace(/\/$/, '');

const fallbackPrayerTimes = [
  { name: 'Imsak', time: '04:15' },
  { name: 'Subuh', time: '04:25' },
  { name: 'Terbit', time: '05:42' },
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
  $('requestRedeemBtn').addEventListener('click', requestRedeem);

  $('childrenSummary').addEventListener('click', (event) => {
    if (event.target.closest('[data-redeem]')) return;
    const card = event.target.closest('[data-child-name]');
    if (!card) return;
    showChildTasks(card.dataset.childName);
  });
}

function switchAuthTab(panelName) {
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
    : 'Kamu hanya dapat melihat tugasmu sendiri dan mengajukan pencairan poin.';

  document.querySelectorAll('[data-parent-only]').forEach((el) => {
    el.hidden = !isParent();
  });

  $('childRedeemAction').hidden = !isChild();
  if (isChild() && ['bills', 'add', 'manage'].includes(activeTab)) openTab('dashboard');
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
    isParent() ? loadTemplates() : Promise.resolve()
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

function openTab(id) {
  if (!isParent() && ['bills', 'add', 'manage'].includes(id)) id = 'dashboard';
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
  if (activeTab === 'redemptions') renderRedemptions();
}

function renderDashboard() {
  const stats = taskSummary.stats || { total: 0, done: 0, pending: 0 };
  $('statTotal').textContent = stats.total || 0;
  $('statDone').textContent = stats.done || 0;
  $('statPending').textContent = stats.pending || 0;

  const visibleChildren = isChild()
    ? children.filter((child) => child.name === session.user.childName)
    : children;

  $('childrenSummary').innerHTML = visibleChildren.length
    ? visibleChildren.map((child) => {
      const summary = taskSummary.children?.[child.name] || { total: 0, done: 0, points: 0, earnedPoints: 0, pendingRedemptionPoints: 0 };
      const pct = summary.total ? Math.round((summary.done || 0) / summary.total * 100) : 0;
      const action = isChild()
        ? `<button class="redeem-btn" data-redeem onclick="requestRedeem()">Ajukan</button>`
        : '';
      return `<article class="child-card child-card-button" data-child-name="${escapeHtml(child.name)}" tabindex="0">
        <div class="child-card-head">
          <h3>${escapeHtml(child.name)}</h3>
          <div class="child-point-actions">
            <strong class="points-badge">${summary.points || 0} poin</strong>
            ${action}
          </div>
        </div>
        <p>${escapeHtml(child.schoolLevel || '-')} · ${summary.done || 0}/${summary.total || 0} tugas selesai · pending cair ${summary.pendingRedemptionPoints || 0}</p>
        <div class="progress"><span style="width:${pct}%"></span></div>
      </article>`;
    }).join('')
    : '<article class="task-card">Belum ada anak. Tambahkan akun anak pada menu Master.</article>';
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

  return `<article class="task-card chore-card">
    <h3>${escapeHtml(task.judul)}</h3>
    <p class="task-description">
      <span>Beban: ${task.beban}</span>
      <strong class="task-points">${task.beban * POINT_MULTIPLIER} poin jika selesai</strong>
      ${task.deskripsi ? `<span>${escapeHtml(task.deskripsi)}</span>` : ''}
    </p>
    <div class="meta">
      <span class="pill">${escapeHtml(task.namaAnak)}</span>
      <span class="pill">${escapeHtml(task.tanggalTugas)}</span>
      <span class="pill status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
      <div class="actions chore-actions">
        <button onclick="setTaskStatus('${escapeJs(task.id)}','${nextStatus}')">${isDone ? 'Batalkan' : 'Selesai'}</button>
        ${editButtons}
      </div>
    </div>
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
  return `<article class="task-card bill-card">
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
  const bill = {
    id,
    nama: $('billName').value.trim(),
    bulan: $('billMonth').value,
    jatuhTempo: $('billDueDate').value,
    status: existing?.status || 'Belum Dibayar',
    catatan: $('billNote').value.trim(),
    waktuBayar: existing?.waktuBayar || ''
  };
  await apiPost(existing ? 'updateBill' : 'addBill', { bill });
  resetBillForm();
  await loadBills();
  openTab('bills');
  setStatus('Tagihan tersimpan.');
}

function editBill(id) {
  const bill = bills.find((item) => item.id === id);
  if (!bill || !isParent()) return;
  $('billId').value = bill.id;
  $('billName').value = bill.nama;
  $('billMonth').value = bill.bulan;
  $('billDueDate').value = bill.jatuhTempo || today();
  $('billNote').value = bill.catatan || '';
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
  setStatus('Status tagihan diperbarui.');
}

async function deleteBill(id) {
  if (!isParent() || !confirm('Hapus tagihan ini?')) return;
  await apiPost('deleteBill', { id });
  await loadBills();
  setStatus('Tagihan dihapus.');
}

function resetBillForm() {
  $('billForm').reset();
  $('billId').value = '';
  $('billMonth').value = currentMonth();
  $('billDueDate').value = today();
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
      note: $('billTemplateNote').value.trim()
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
}

async function deleteBillTemplate(id) {
  if (!confirm('Hapus template tagihan ini?')) return;
  await apiPost('deleteBillTemplate', { templateId: id });
  await loadTemplates();
}

function resetBillTemplateForm() {
  $('billTemplateForm').reset();
  $('billTemplateId').value = '';
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
        <span>${escapeHtml(item.note || '-')}</span>
        <div class="actions"><button onclick="editBillTemplate('${escapeJs(item.templateId)}')">Edit</button><button class="danger" onclick="deleteBillTemplate('${escapeJs(item.templateId)}')">Hapus</button></div>
      </article>`).join('') : '<article class="mini-card">Belum ada template tagihan.</article>');
}

async function requestRedeem() {
  if (!isChild()) return;
  const summary = taskSummary.children?.[session.user.childName] || { points: 0 };
  const points = Number(summary.points || 0);
  if (points <= 0) {
    setStatus('Belum ada poin yang dapat diajukan.');
    return;
  }
  if (!confirm(`Ajukan pencairan ${points} poin kepada orang tua?`)) return;
  await apiPost('requestRedeem', { points, note: 'Pengajuan dari akun anak' });
  await Promise.all([loadTaskSummary(), loadRedemptions()]);
  setStatus('Pengajuan pencairan dikirim. Menunggu persetujuan orang tua.');
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
    jatuhTempo: row.jatuhTempo || row.jatuh_tempo || ''
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
    if (!jadwal) return;
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
window.requestRedeem = requestRedeem;
window.decideRedeem = decideRedeem;

init();
