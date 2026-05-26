const SHEET_NAME = 'tasks';
const BILL_SHEET_NAME = 'bills';
const REDEMPTION_SHEET_NAME = 'point_redemptions';

function doGet(e) {
  e = e || { parameter: {} };
  const action = e.parameter.action || 'getTasks';

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

  return jsonResponse({ success: false, message: 'Action GET tidak dikenali', action });
}

function doPost(e) {
  try {
    e = e || {};
    const body = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(body);
    const action = data.action;

    if (action === 'addTask' || action === 'create') return addTask(data.task || data);
    if (action === 'updateTask' || action === 'update') return updateTask(data.task || data);
    if (action === 'updateStatus' || action === 'status') return updateStatus(data);
    if (action === 'deleteTask' || action === 'delete') return deleteTask(data.id);
    if (action === 'addBill') return addBill(data.bill || data);
    if (action === 'updateBill') return updateBill(data.bill || data);
    if (action === 'updateBillStatus') return updateBillStatus(data);
    if (action === 'deleteBill') return deleteBill(data.id);
    if (action === 'redeemPoints') return redeemPoints(data);

    return jsonResponse({ success: false, message: 'Action POST tidak dikenali', action });
  } catch (err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHeaders() {
  return [
    'id', 'tanggalInput', 'namaAnak', 'judul', 'deskripsi', 'kategori',
    'tanggalTugas', 'jamTarget', 'prioritas', 'status', 'waktuSelesai', 'catatan', 'beban'
  ];
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const headers = getHeaders();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    const isHeaderEmpty = existingHeaders.every(v => String(v || '').trim() === '');
    if (isHeaderEmpty) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      headers.forEach(header => {
        if (!existingHeaders.includes(header)) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        }
      });
    }
  }

  return sheet;
}

function setupSheet() {
  getSheet();
  return jsonResponse({ success: true, message: 'Sheet tasks berhasil disiapkan.' });
}

function normalizeDateOnly(value, timezone) {
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  const text = String(value).trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text;
}

function legacyTaskLoad(task) {
  const text = String(task.catatan || task.deskripsi || '');
  const match = text.match(/beban\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : 1;
}

function taskLoad(task) {
  const load = Number(task.beban || task.load || 0);
  return load > 0 ? load : legacyTaskLoad(task);
}

function taskPoints(task) {
  return taskLoad(task) * 200;
}

function getTaskObjects() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return [];

  const headers = values.shift();
  const timezone = Session.getScriptTimeZone();

  return values
    .filter(row => row.some(cell => String(cell || '').trim() !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        if (!header) return;
        let value = row[index];
        if (value instanceof Date) {
          value = Utilities.formatDate(value, timezone, 'yyyy-MM-dd HH:mm:ss');
        }
        obj[header] = value;
      });
      obj.tanggalTugas = normalizeDateOnly(obj.tanggalTugas, timezone);
      return obj;
    });
}

function getTasks(params) {
  params = params || {};
  const date = params.date || '';
  const child = params.child || '';
  const status = params.status || '';

  const data = getTaskObjects()
    .filter(task => !date || task.tanggalTugas === date)
    .filter(task => !child || child === 'all' || task.namaAnak === child)
    .filter(task => !status || status === 'all' || task.status === status);

  return jsonResponse({ success: true, data });
}

function getTaskSummary(params) {
  params = params || {};
  const date = params.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const data = getTaskObjects();
  const redeemed = getRedeemedPointTotals();
  const daily = data.filter(task => task.tanggalTugas === date);
  const children = {};

  data.forEach(task => {
    const name = task.namaAnak || '';
    if (!name) return;
    if (!children[name]) children[name] = { total: 0, done: 0, points: 0 };

    children[name].total += 1;
    if (task.status === 'Selesai') {
      children[name].done += 1;
      children[name].points += taskPoints(task);
    }
  });

  Object.keys(children).forEach(name => {
    children[name].earnedPoints = children[name].points;
    children[name].redeemedPoints = redeemed[name] || 0;
    children[name].points = Math.max(0, children[name].points - children[name].redeemedPoints);
  });

  return jsonResponse({
    success: true,
    date,
    redemptionsIncluded: true,
    stats: {
      total: daily.length,
      done: daily.filter(task => task.status === 'Selesai').length,
      pending: daily.filter(task => ['Belum', 'Dikerjakan'].includes(task.status)).length
    },
    children
  });
}

function getRedemptionHeaders() {
  return ['id', 'tanggal', 'namaAnak', 'points', 'catatan'];
}

function getRedemptionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(REDEMPTION_SHEET_NAME);

  if (!sheet) sheet = ss.insertSheet(REDEMPTION_SHEET_NAME);

  const headers = getRedemptionHeaders();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    const isHeaderEmpty = existingHeaders.every(v => String(v || '').trim() === '');
    if (isHeaderEmpty) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function getPointRedemptionObjects() {
  const sheet = getRedemptionSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return [];

  const headers = values.shift();
  const timezone = Session.getScriptTimeZone();

  return values
    .filter(row => row.some(cell => String(cell || '').trim() !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        if (!header) return;
        let value = row[index];
        if (value instanceof Date) {
          value = Utilities.formatDate(value, timezone, 'yyyy-MM-dd HH:mm:ss');
        }
        obj[header] = value;
      });
      obj.points = Number(obj.points || 0);
      return obj;
    });
}

function getRedeemedPointTotals() {
  return getPointRedemptionObjects().reduce((totals, item) => {
    const name = item.namaAnak || '';
    if (!name) return totals;
    totals[name] = (totals[name] || 0) + Number(item.points || 0);
    return totals;
  }, {});
}

function getPointRedemptions() {
  return jsonResponse({ success: true, data: getPointRedemptionObjects() });
}

function redeemPoints(data) {
  const sheet = getRedemptionSheet();
  const namaAnak = data.namaAnak || data.child || '';
  const points = Number(data.points || 0);

  if (!namaAnak || points <= 0) {
    return jsonResponse({ success: false, message: 'Data pencairan poin tidak lengkap.' });
  }

  const id = data.id || ('rdm-' + Date.now());
  sheet.appendRow([
    id,
    data.tanggal || new Date(),
    namaAnak,
    points,
    data.catatan || 'Poin dicairkan'
  ]);

  return jsonResponse({ success: true, message: 'Poin berhasil dicairkan.', id });
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function addTask(task) {
  const sheet = getSheet();
  const id = task.id || ('tsk-' + Date.now());

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

  return jsonResponse({ success: true, message: 'Tugas berhasil ditambahkan.', id });
}

function updateTask(task) {
  const sheet = getSheet();
  const row = findRowById(sheet, task.id);

  if (row < 0) return addTask(task);

  sheet.getRange(row, 1, 1, 13).setValues([[
    task.id,
    task.tanggalInput || sheet.getRange(row, 2).getValue() || new Date(),
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
  const sheet = getSheet();
  const row = findRowById(sheet, data.id);

  if (row < 0) return jsonResponse({ success: false, message: 'Tugas tidak ditemukan.' });

  sheet.getRange(row, 10).setValue(data.status || 'Belum');

  if (data.status === 'Selesai') {
    sheet.getRange(row, 11).setValue(data.waktuSelesai || new Date());
  }

  return jsonResponse({ success: true, message: 'Status tugas berhasil diperbarui.' });
}

function deleteTask(id) {
  const sheet = getSheet();
  const row = findRowById(sheet, id);

  if (row < 0) return jsonResponse({ success: false, message: 'Tugas tidak ditemukan.' });

  sheet.deleteRow(row);
  return jsonResponse({ success: true, message: 'Tugas berhasil dihapus.' });
}

function testRun() {
  return setupSheet();
}

function getBillHeaders() {
  return [
    'id', 'tanggalInput', 'nama', 'jumlah', 'bulan', 'jatuhTempo',
    'status', 'waktuBayar', 'catatan'
  ];
}

function getBillSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BILL_SHEET_NAME);

  if (!sheet) sheet = ss.insertSheet(BILL_SHEET_NAME);

  const headers = getBillHeaders();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    const isHeaderEmpty = existingHeaders.every(v => String(v || '').trim() === '');
    if (isHeaderEmpty) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function getBills() {
  const sheet = getBillSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return jsonResponse({ success: true, data: [] });

  const headers = values.shift();
  const timezone = Session.getScriptTimeZone();

  const data = values
    .filter(row => row.some(cell => String(cell || '').trim() !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        if (!header) return;
        let value = row[index];
        if (value instanceof Date) {
          value = Utilities.formatDate(value, timezone, 'yyyy-MM-dd HH:mm:ss');
        }
        obj[header] = value;
      });
      return obj;
    });

  return jsonResponse({ success: true, data });
}

function addBill(bill) {
  const sheet = getBillSheet();
  const id = bill.id || ('bil-' + Date.now());

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

  return jsonResponse({ success: true, message: 'Tagihan berhasil ditambahkan.', id });
}

function updateBill(bill) {
  const sheet = getBillSheet();
  const row = findRowById(sheet, bill.id);

  if (row < 0) return addBill(bill);

  sheet.getRange(row, 1, 1, 9).setValues([[
    bill.id,
    bill.tanggalInput || sheet.getRange(row, 2).getValue() || new Date(),
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
  const sheet = getBillSheet();
  const row = findRowById(sheet, data.id);

  if (row < 0) return jsonResponse({ success: false, message: 'Tagihan tidak ditemukan.' });

  sheet.getRange(row, 7).setValue(data.status || 'Belum Dibayar');
  sheet.getRange(row, 8).setValue(data.status === 'Sudah Dibayar' ? (data.waktuBayar || new Date()) : '');

  return jsonResponse({ success: true, message: 'Status tagihan berhasil diperbarui.' });
}

function deleteBill(id) {
  const sheet = getBillSheet();
  const row = findRowById(sheet, id);

  if (row < 0) return jsonResponse({ success: false, message: 'Tagihan tidak ditemukan.' });

  sheet.deleteRow(row);
  return jsonResponse({ success: true, message: 'Tagihan berhasil dihapus.' });
}
