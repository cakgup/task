var SHEET_NAME = 'tasks';
var BILL_SHEET_NAME = 'bills';
var REDEMPTION_SHEET_NAME = 'point_redemptions';
var SPREADSHEET_ID = '';

function doGet(e) {
  try {
    e = e || { parameter: {} };
    var action = e.parameter.action || 'getTasks';

    if (action === 'getTasks' || action === 'list') {
      return getTasks(e.parameter || {});
    }
    if (action === 'getTaskSummary') {
      return getTaskSummary(e.parameter || {});
    }
    if (action === 'getBills') {
      return getBills();
    }
    if (action === 'getPointRedemptions') {
      return getPointRedemptions();
    }
    if (action === 'setup') {
      return setupSheet();
    }

    return jsonResponse({ success: false, message: 'Action GET tidak dikenali', action: action });
  } catch (err) {
    return jsonResponse({ success: false, message: err.message, stack: err.stack || '' });
  }
}

function doPost(e) {
  try {
    e = e || {};
    var body = '{}';
    if (e.postData && e.postData.contents) {
      body = e.postData.contents;
    }
    var data = JSON.parse(body);
    var action = data.action;

    if (action === 'addTask' || action === 'create') return addTask(data.task || data);
    if (action === 'updateTask' || action === 'update') return updateTask(data.task || data);
    if (action === 'updateStatus' || action === 'status') return updateStatus(data);
    if (action === 'deleteTask' || action === 'delete') return deleteTask(data.id);
    if (action === 'ensureDailyTasks') return ensureDailyTasks(data);
    if (action === 'addBill') return addBill(data.bill || data);
    if (action === 'updateBill') return updateBill(data.bill || data);
    if (action === 'updateBillStatus') return updateBillStatus(data);
    if (action === 'deleteBill') return deleteBill(data.id);
    if (action === 'redeemPoints') return redeemPoints(data);

    return jsonResponse({ success: false, message: 'Action POST tidak dikenali', action: action });
  } catch (err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function testRun() {
  Logger.log('Code.gs berhasil dijalankan.');
  return 'Code.gs berhasil dijalankan.';
}

function ping() {
  Logger.log('ping ok');
  return 'ping ok';
}

function setupAllSheets() {
  try {
    getTaskSheet();
    getBillSheet();
    getRedemptionSheet();
    Logger.log('Setup sheet berhasil.');
    return 'Setup sheet berhasil.';
  } catch (err) {
    Logger.log('ERROR setupAllSheets: ' + err.message);
    return 'ERROR: ' + err.message;
  }
}

function getSpreadsheet() {
  var ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    throw new Error('Spreadsheet tidak ditemukan. Buka Apps Script dari Google Sheet, atau isi SPREADSHEET_ID.');
  }
  return ss;
}

function setupSheet() {
  getTaskSheet();
  return jsonResponse({ success: true, message: 'Sheet tasks berhasil disiapkan.' });
}

function getHeaders() {
  return [
    'id', 'tanggalInput', 'namaAnak', 'judul', 'deskripsi', 'kategori',
    'tanggalTugas', 'jamTarget', 'prioritas', 'status', 'waktuSelesai', 'catatan', 'beban'
  ];
}

function getBillHeaders() {
  return [
    'id', 'tanggalInput', 'nama', 'jumlah', 'bulan', 'jatuhTempo',
    'status', 'waktuBayar', 'catatan'
  ];
}

function getRedemptionHeaders() {
  return ['id', 'tanggal', 'namaAnak', 'points', 'catatan'];
}

function ensureSheet(sheetName, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  var existingHeaders;
  var isEmpty;
  var i;

  if (!sheet) sheet = ss.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  isEmpty = true;
  for (i = 0; i < existingHeaders.length; i++) {
    if (String(existingHeaders[i] || '').trim() !== '') {
      isEmpty = false;
      break;
    }
  }

  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  for (i = 0; i < headers.length; i++) {
    if (arrayIndexOf(existingHeaders, headers[i]) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(headers[i]);
    }
  }

  return sheet;
}

function arrayIndexOf(arr, value) {
  for (var i = 0; i < arr.length; i++) {
    if (String(arr[i]) === String(value)) return i;
  }
  return -1;
}

function getTaskSheet() {
  return ensureSheet(SHEET_NAME, getHeaders());
}

function getSheet() {
  return getTaskSheet();
}

function getBillSheet() {
  return ensureSheet(BILL_SHEET_NAME, getBillHeaders());
}

function getRedemptionSheet() {
  return ensureSheet(REDEMPTION_SHEET_NAME, getRedemptionHeaders());
}

function normalizeDateOnly(value, timezone) {
  var text;
  var match;
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  text = String(value).trim();
  match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  return text;
}

function normalizeTaskTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function duplicateTaskKey(date, child, title) {
  return [
    normalizeDateOnly(date, Session.getScriptTimeZone()),
    String(child || '').trim().toLowerCase(),
    normalizeTaskTitle(title)
  ].join('|');
}

function dateForTask(value) {
  if (value) return normalizeDateOnly(value, Session.getScriptTimeZone());
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function dateValue(value, timezone) {
  if (value instanceof Date) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd HH:mm:ss');
  return value;
}

function isRowFilled(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || '').trim() !== '') return true;
  }
  return false;
}

function rowToObject(headers, row, timezone) {
  var obj = {};
  var header;
  for (var i = 0; i < headers.length; i++) {
    header = headers[i];
    if (header) obj[header] = dateValue(row[i], timezone);
  }
  return obj;
}

function headerMap(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) map[headers[i]] = i;
  }
  return map;
}

function sheetValues(sheet) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) return [];
  return sheet.getRange(1, 1, lastRow, lastColumn).getValues();
}

function getTaskObjects() {
  var sheet = getTaskSheet();
  var values = sheetValues(sheet);
  var headers;
  var timezone;
  var data = [];
  var obj;
  var i;

  if (values.length <= 1) return data;

  headers = values.shift();
  timezone = Session.getScriptTimeZone();

  for (i = 0; i < values.length; i++) {
    if (!isRowFilled(values[i])) continue;
    obj = rowToObject(headers, values[i], timezone);
    obj.tanggalTugas = normalizeDateOnly(obj.tanggalTugas, timezone);
    data.push(obj);
  }

  return data;
}

function getTaskRowsForSummary() {
  var sheet = getTaskSheet();
  var values = sheetValues(sheet);
  var headers;
  var map;
  var timezone;
  var rows = [];
  var row;
  var obj;
  var seen = {};
  var key;
  var i;

  if (values.length <= 1) return rows;

  headers = values.shift();
  map = headerMap(headers);
  timezone = Session.getScriptTimeZone();

  for (i = 0; i < values.length; i++) {
    row = values[i];
    if (!isRowFilled(row)) continue;
    obj = {
      namaAnak: row[map.namaAnak] || '',
      status: row[map.status] || '',
      tanggalTugas: normalizeDateOnly(row[map.tanggalTugas], timezone),
      beban: row[map.beban] || '',
      catatan: row[map.catatan] || '',
      deskripsi: row[map.deskripsi] || ''
    };
    key = duplicateTaskKey(obj.tanggalTugas, obj.namaAnak, row[map.judul]);
    if (seen[key]) continue;
    seen[key] = true;
    rows.push(obj);
  }

  return rows;
}

function getTasks(params) {
  params = params || {};
  var date = params.date || '';
  var child = params.child || '';
  var status = params.status || '';
  var rows = getTaskObjects();
  var data = [];
  var seen = {};
  var task;
  var key;
  var i;

  for (i = 0; i < rows.length; i++) {
    task = rows[i];
    if (date && task.tanggalTugas !== date) continue;
    if (child && child !== 'all' && task.namaAnak !== child) continue;
    if (status && status !== 'all' && task.status !== status) continue;
    key = duplicateTaskKey(task.tanggalTugas, task.namaAnak, task.judul);
    if (seen[key]) continue;
    seen[key] = true;
    data.push(task);
  }

  return jsonResponse({ success: true, data: data });
}

function legacyTaskLoad(task) {
  var text = String(task.catatan || task.deskripsi || '');
  var match = text.match(/beban\s*:\s*(\d+)/i);
  if (match) return Number(match[1]);
  return 1;
}

function taskLoad(task) {
  var load = Number(task.beban || task.load || 0);
  if (load > 0) return load;
  return legacyTaskLoad(task);
}

function taskPoints(task) {
  return taskLoad(task) * 200;
}

function getTaskSummary(params) {
  params = params || {};
  var date = params.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var data = getTaskRowsForSummary();
  var redeemed = getRedeemedPointTotals();
  var children = {};
  var stats = { total: 0, done: 0, pending: 0 };
  var task;
  var name;
  var child;
  var i;

  for (i = 0; i < data.length; i++) {
    task = data[i];
    name = task.namaAnak || '';
    if (!name) continue;

    if (!children[name]) children[name] = { total: 0, done: 0, points: 0 };
    child = children[name];
    child.total += 1;

    if (task.status === 'Selesai') {
      child.done += 1;
      child.points += taskPoints(task);
    }

    if (task.tanggalTugas === date) {
      stats.total += 1;
      if (task.status === 'Selesai') stats.done += 1;
      if (task.status === 'Belum' || task.status === 'Dikerjakan') stats.pending += 1;
    }
  }

  for (name in children) {
    if (children.hasOwnProperty(name)) {
      children[name].earnedPoints = children[name].points;
      children[name].redeemedPoints = redeemed[name] || 0;
      children[name].points = Math.max(0, children[name].earnedPoints - children[name].redeemedPoints);
    }
  }

  return jsonResponse({
    success: true,
    date: date,
    redemptionsIncluded: true,
    stats: stats,
    children: children
  });
}

function findRowById(sheet, id) {
  var lastRow = sheet.getLastRow();
  var ids;
  var found;
  var i;
  if (lastRow < 2) return -1;

  if (sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder) {
    found = sheet.getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(String(id))
      .matchEntireCell(true)
      .findNext();
    if (found) return found.getRow();
  }

  ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function findDuplicateDailyTaskRow(sheet, task, ignoreId) {
  var values = sheetValues(sheet);
  var headers;
  var map;
  var timezone;
  var targetKey;
  var row;
  var rowId;
  var rowKey;
  var i;

  if (values.length <= 1) return -1;

  headers = values.shift();
  map = headerMap(headers);
  timezone = Session.getScriptTimeZone();
  targetKey = duplicateTaskKey(task.tanggalTugas, task.namaAnak, task.judul);

  for (i = 0; i < values.length; i++) {
    row = values[i];
    if (!isRowFilled(row)) continue;
    rowId = String(row[map.id] || '');
    if (ignoreId && rowId === String(ignoreId)) continue;
    rowKey = duplicateTaskKey(row[map.tanggalTugas], row[map.namaAnak], row[map.judul]);
    if (rowKey === targetKey) return i + 2;
  }

  return -1;
}

function createDailyTaskFromTemplate(template, date, index) {
  return [
    'tsk-' + new Date().getTime() + '-' + index,
    new Date(),
    template.child || '',
    template.title || '',
    template.description || '',
    template.category || 'Pekerjaan Rumah',
    date,
    template.time || '',
    template.priority || 'Normal',
    'Belum',
    '',
    '',
    Number(template.load || 1)
  ];
}

function getExistingDailyTaskKeys(sheet) {
  var values = sheetValues(sheet);
  var headers;
  var map;
  var keys = {};
  var row;
  var key;
  var i;

  if (values.length <= 1) return keys;

  headers = values.shift();
  map = headerMap(headers);

  for (i = 0; i < values.length; i++) {
    row = values[i];
    if (!isRowFilled(row)) continue;
    key = duplicateTaskKey(row[map.tanggalTugas], row[map.namaAnak], row[map.judul]);
    keys[key] = true;
  }

  return keys;
}

function ensureDailyTasks(data) {
  var sheet = getTaskSheet();
  var date = dateForTask(data.date);
  var templates = data.templates || [];
  var existing = getExistingDailyTaskKeys(sheet);
  var rows = [];
  var key;
  var template;
  var i;

  for (i = 0; i < templates.length; i++) {
    template = templates[i];
    key = duplicateTaskKey(date, template.child, template.title);
    if (existing[key]) continue;
    existing[key] = true;
    rows.push(createDailyTaskFromTemplate(template, date, i));
  }

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 13).setValues(rows);
  }

  return jsonResponse({
    success: true,
    created: rows.length,
    message: rows.length + ' tugas harian dibuat otomatis.'
  });
}

function addTask(task) {
  var sheet = getTaskSheet();
  var duplicateRow = findDuplicateDailyTaskRow(sheet, task, task.id);
  var id = task.id || ('tsk-' + new Date().getTime());

  if (duplicateRow > 0) {
    return jsonResponse({
      success: true,
      duplicate: true,
      message: 'Tugas harian sudah ada, tidak dibuat ulang.',
      id: sheet.getRange(duplicateRow, 1).getValue()
    });
  }

  sheet.appendRow([
    id,
    task.tanggalInput || new Date(),
    task.namaAnak || '',
    task.judul || '',
    task.deskripsi || '',
    task.kategori || '',
    task.tanggalTugas || '',
    task.jamTarget || '',
    task.prioritas || 'Normal',
    task.status || 'Belum',
    task.waktuSelesai || '',
    task.catatan || '',
    Number(task.beban || 1)
  ]);

  return jsonResponse({ success: true, message: 'Tugas berhasil ditambahkan.', id: id });
}

function updateTask(task) {
  var sheet = getTaskSheet();
  var row = findRowById(sheet, task.id);
  var tanggalInput = task.tanggalInput || new Date();
  var duplicateRow;

  if (row < 0) return addTask(task);

  duplicateRow = findDuplicateDailyTaskRow(sheet, task, task.id);
  if (duplicateRow > 0) {
    return jsonResponse({
      success: false,
      duplicate: true,
      message: 'Tugas harian dengan nama yang sama sudah ada untuk anak dan tanggal tersebut.'
    });
  }

  sheet.getRange(row, 1, 1, 13).setValues([[
    task.id,
    tanggalInput,
    task.namaAnak || '',
    task.judul || '',
    task.deskripsi || '',
    task.kategori || '',
    task.tanggalTugas || '',
    task.jamTarget || '',
    task.prioritas || 'Normal',
    task.status || 'Belum',
    task.waktuSelesai || '',
    task.catatan || '',
    Number(task.beban || 1)
  ]]);

  return jsonResponse({ success: true, message: 'Tugas berhasil diperbarui.' });
}

function updateStatus(data) {
  var sheet = getTaskSheet();
  var row = findRowById(sheet, data.id);
  var waktuSelesai = '';

  if (row < 0) return jsonResponse({ success: false, message: 'Tugas tidak ditemukan.' });

  if (data.status === 'Selesai') {
    waktuSelesai = data.waktuSelesai || new Date();
  }
  sheet.getRange(row, 10, 1, 2).setValues([[data.status || 'Belum', waktuSelesai]]);

  return jsonResponse({ success: true, message: 'Status tugas berhasil diperbarui.' });
}

function deleteTask(id) {
  var sheet = getTaskSheet();
  var row = findRowById(sheet, id);

  if (row < 0) return jsonResponse({ success: false, message: 'Tugas tidak ditemukan.' });

  sheet.deleteRow(row);
  return jsonResponse({ success: true, message: 'Tugas berhasil dihapus.' });
}

function getPointRedemptionObjects() {
  var sheet = getRedemptionSheet();
  var values = sheetValues(sheet);
  var headers;
  var timezone;
  var data = [];
  var obj;
  var i;

  if (values.length <= 1) return data;

  headers = values.shift();
  timezone = Session.getScriptTimeZone();

  for (i = 0; i < values.length; i++) {
    if (!isRowFilled(values[i])) continue;
    obj = rowToObject(headers, values[i], timezone);
    obj.points = Number(obj.points || 0);
    data.push(obj);
  }

  return data;
}

function getRedeemedPointTotals() {
  var rows = getPointRedemptionObjects();
  var totals = {};
  var name;
  var i;

  for (i = 0; i < rows.length; i++) {
    name = rows[i].namaAnak || '';
    if (!name) continue;
    totals[name] = (totals[name] || 0) + Number(rows[i].points || 0);
  }

  return totals;
}

function getPointRedemptions() {
  return jsonResponse({ success: true, data: getPointRedemptionObjects() });
}

function redeemPoints(data) {
  var sheet = getRedemptionSheet();
  var namaAnak = data.namaAnak || data.child || '';
  var points = Number(data.points || 0);
  var id;

  if (!namaAnak || points <= 0) {
    return jsonResponse({ success: false, message: 'Data pencairan poin tidak lengkap.' });
  }

  id = data.id || ('rdm-' + new Date().getTime());
  sheet.appendRow([
    id,
    data.tanggal || new Date(),
    namaAnak,
    points,
    data.catatan || 'Poin dicairkan'
  ]);

  return jsonResponse({ success: true, message: 'Poin berhasil dicairkan.', id: id });
}

function getBills() {
  var sheet = getBillSheet();
  var values = sheetValues(sheet);
  var headers;
  var timezone;
  var data = [];
  var obj;
  var i;

  if (values.length <= 1) return jsonResponse({ success: true, data: data });

  headers = values.shift();
  timezone = Session.getScriptTimeZone();

  for (i = 0; i < values.length; i++) {
    if (!isRowFilled(values[i])) continue;
    obj = rowToObject(headers, values[i], timezone);
    data.push(obj);
  }

  return jsonResponse({ success: true, data: data });
}

function addBill(bill) {
  var sheet = getBillSheet();
  var id = bill.id || ('bil-' + new Date().getTime());

  sheet.appendRow([
    id,
    bill.tanggalInput || new Date(),
    bill.nama || '',
    Number(bill.jumlah || 0),
    bill.bulan || '',
    bill.jatuhTempo || '',
    bill.status || 'Belum Dibayar',
    bill.waktuBayar || '',
    bill.catatan || ''
  ]);

  return jsonResponse({ success: true, message: 'Tagihan berhasil ditambahkan.', id: id });
}

function duplicateBillKey(month, name) {
  return [
    String(month || '').slice(0, 7),
    normalizeTaskTitle(name)
  ].join('|');
}

function findDuplicateBillRow(sheet, bill, ignoreId) {
  var values = sheetValues(sheet);
  var headers;
  var map;
  var targetKey;
  var row;
  var rowId;
  var rowKey;
  var i;

  if (values.length <= 1) return -1;

  headers = values.shift();
  map = headerMap(headers);
  targetKey = duplicateBillKey(bill.bulan || bill.month, bill.nama || bill.name);

  for (i = 0; i < values.length; i++) {
    row = values[i];
    if (!isRowFilled(row)) continue;
    rowId = String(row[map.id] || '');
    if (ignoreId && rowId === String(ignoreId)) continue;
    rowKey = duplicateBillKey(row[map.bulan], row[map.nama]);
    if (rowKey === targetKey) return i + 2;
  }

  return -1;
}

function updateBill(bill) {
  var sheet = getBillSheet();
  var row = findRowById(sheet, bill.id);
  var tanggalInput = bill.tanggalInput || new Date();

  if (row < 0) {
    row = findDuplicateBillRow(sheet, bill, bill.id);
  }
  if (row < 0) return addBill(bill);

  sheet.getRange(row, 1, 1, 9).setValues([[
    bill.id || sheet.getRange(row, 1).getValue(),
    tanggalInput,
    bill.nama || '',
    Number(bill.jumlah || 0),
    bill.bulan || '',
    bill.jatuhTempo || '',
    bill.status || 'Belum Dibayar',
    bill.waktuBayar || '',
    bill.catatan || ''
  ]]);

  return jsonResponse({ success: true, message: 'Tagihan berhasil diperbarui.' });
}

function updateBillStatus(data) {
  var sheet;
  var row;
  var status;
  var waktuBayar = '';

  data = data || {};
  if (!data.id) {
    return jsonResponse({ success: false, message: 'ID tagihan wajib diisi.' });
  }

  sheet = getBillSheet();
  row = findRowById(sheet, data.id);

  if (row < 0) return jsonResponse({ success: false, message: 'Tagihan tidak ditemukan.' });

  status = data.status || 'Belum Dibayar';
  if (status === 'Sudah Dibayar') {
    waktuBayar = data.waktuBayar || new Date();
  }

  sheet.getRange(row, 7, 1, 2).setValues([[status, waktuBayar]]);

  return jsonResponse({ success: true, message: 'Status tagihan berhasil diperbarui.' });
}

function deleteBill(id) {
  var sheet = getBillSheet();
  var row = findRowById(sheet, id);

  if (row < 0) return jsonResponse({ success: false, message: 'Tagihan tidak ditemukan.' });

  sheet.deleteRow(row);
  return jsonResponse({ success: true, message: 'Tagihan berhasil dihapus.' });
}
