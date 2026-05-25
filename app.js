const cfg = window.CAKGUP_CONFIG || {};

function $(id){
  return document.getElementById(id);
}

function login(){
  const kode = $('password').value.trim().toLowerCase();
  const password = (cfg.APP_PASSWORD || 'cakgup').trim().toLowerCase();

  if(kode === password){
    localStorage.setItem('cakgupLoggedIn','yes');
    showApp();
  } else {
    $('loginError').hidden = false;
  }
}

function showApp(){
  $('loginBox').hidden = true;
  $('app').hidden = false;
  loadTasks();
}

async function loadTasks(){
  try{
    const res = await fetch(cfg.GAS_URL + '?action=getTasks');
    const data = await res.json();

    const container = $('taskList');
    container.innerHTML = '';

    if(!data.data || data.data.length === 0){
      container.innerHTML = '<p>Belum ada tugas</p>';
      return;
    }

    data.data.forEach(task=>{
      const div = document.createElement('div');
      div.className = 'task';
      div.innerHTML = `<b>${task.judul}</b><br>${task.namaAnak} - ${task.status}`;
      container.appendChild(div);
    });

  }catch(err){
    $('taskList').innerHTML = 'Gagal mengambil data';
    console.error(err);
  }
}

window.onload = function(){
  if(localStorage.getItem('cakgupLoggedIn') === 'yes'){
    showApp();
  }
}
