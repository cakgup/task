const SHEET_NAME = 'tasks';

function doGet(e) {
  e = e || { parameter: {} };
  const action = e.parameter.action || 'getTasks';

  if (action === 'getTasks') {
    return getTasks();
  }

  return jsonResponse({success:false});
}

function jsonResponse(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if(!sheet){
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id','namaAnak','judul','status']);
  }

  return sheet;
}

function getTasks(){
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  if(data.length <= 1){
    return jsonResponse({success:true,data:[]});
  }

  const rows = data.slice(1).map(r=>({
    id:r[0],
    namaAnak:r[1],
    judul:r[2],
    status:r[3]
  }));

  return jsonResponse({success:true,data:rows});
}
