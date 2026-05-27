<div align="center">

# 🏡 CakGup Task — Manajemen Tugas Keluarga

### Aplikasi ringan untuk membantu keluarga membangun kebiasaan baik, amanah, disiplin, dan tanggung jawab sejak dari rumah.

![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-24292F?style=for-the-badge&logo=github)
![Google Apps Script](https://img.shields.io/badge/Backend-Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google)
![Google Sheets](https://img.shields.io/badge/Database-Google%20Sheets-34A853?style=for-the-badge&logo=googlesheets)
![Mobile First](https://img.shields.io/badge/UI-Mobile%20First-1A3A6B?style=for-the-badge)
![License GPLv3](https://img.shields.io/badge/License-GPL--3.0-green?style=for-the-badge)

**Didedikasikan untuk ummat.**  
Silakan digunakan, dipelajari, dimodifikasi, dan diduplikasi agar semakin banyak keluarga terbantu dalam membangun budaya tanggung jawab di rumah.

</div>

---

## ✨ Tentang Aplikasi

**CakGup Task** adalah aplikasi manajemen tugas keluarga berbasis web yang dibuat untuk membantu orang tua mengatur, memantau, dan mengevaluasi tugas harian anak-anak secara sederhana.

Aplikasi ini cocok digunakan untuk:

- membagi pekerjaan rumah kepada anak-anak;
- membiasakan ibadah dan kedisiplinan harian;
- mencatat progres tugas anak;
- memberi poin apresiasi berdasarkan beban tugas;
- memantau tagihan keluarga bulanan;
- menyimpan data secara sederhana menggunakan Google Sheets.

Aplikasi ini dibangun menggunakan **HTML, CSS, JavaScript, GitHub Pages, Google Apps Script, dan Google Sheets** sehingga dapat dijalankan tanpa server berbayar.

---

## 🌱 Filosofi

> Rumah adalah madrasah pertama.  
> Tugas kecil yang dilakukan dengan ikhlas dapat menjadi latihan amanah, disiplin, dan tanggung jawab.

Aplikasi ini tidak hanya dibuat untuk mencatat pekerjaan rumah, tetapi juga untuk membantu keluarga menanamkan nilai:

- **amanah**, karena setiap tugas adalah tanggung jawab;
- **disiplin**, karena tugas dilakukan secara rutin;
- **ta'awun**, karena anggota keluarga saling membantu;
- **ibadah**, karena pekerjaan baik di rumah dapat bernilai kebaikan;
- **kemandirian**, karena anak belajar mengelola kewajibannya sendiri.

---

## 🚀 Fitur Utama

### 1. Dashboard Keluarga

Menampilkan ringkasan tugas harian keluarga, antara lain:

- jumlah tugas hari ini;
- jumlah tugas selesai;
- jumlah tugas belum selesai;
- progres masing-masing anak;
- total poin yang diperoleh anak.

### 2. Manajemen Tugas Anak

Orang tua dapat menambahkan dan mengatur tugas berdasarkan:

- nama anak;
- judul tugas;
- kategori tugas;
- tanggal tugas;
- beban tugas;
- deskripsi/catatan tambahan.

Setiap tugas dapat diperbarui statusnya menjadi **Selesai** atau dikembalikan menjadi **Belum**.

### 3. Sistem Poin Apresiasi

Setiap tugas memiliki nilai beban. Ketika tugas selesai, aplikasi menghitung poin sebagai bentuk apresiasi.

Secara bawaan, rumus poin yang digunakan adalah:

```text
Poin = Beban Tugas x 200
```

Contoh:

| Beban | Poin |
|------:|-----:|
| 1 | 200 |
| 2 | 400 |
| 3 | 600 |
| 4 | 800 |

Poin dapat digunakan sebagai sarana motivasi keluarga, misalnya untuk apresiasi mingguan, hadiah edukatif, atau evaluasi kedisiplinan.

### 4. Pencairan Poin

Aplikasi menyediakan fitur **Cairkan Poin** untuk mencatat poin yang sudah digunakan/diberikan kepada anak. Dengan demikian, orang tua dapat membedakan antara:

- poin yang sudah diperoleh;
- poin yang sudah dicairkan;
- sisa poin aktif.

### 5. Tugas Harian Otomatis

Daftar tugas rutin dapat dikonfigurasi melalui `config.js`. Aplikasi akan membantu memastikan tugas harian tersedia sesuai daftar template yang ditentukan.

Contoh tugas rutin:

- mencuci piring;
- menyapu dan mengepel;
- menyiram tanaman;
- membaca Al-Qur'an;
- hafalan;
- shalat dhuha;
- belajar atau latihan soal.

### 6. Manajemen Tagihan Bulanan

Selain tugas anak, aplikasi juga memiliki fitur pencatatan tagihan keluarga, seperti:

- SPP sekolah;
- listrik;
- internet;
- iuran lingkungan;
- tagihan rumah tangga lainnya.

Setiap tagihan dapat diberi status **Belum Dibayar** atau **Sudah Dibayar**.

### 7. Jadwal Shalat

Pada halaman login, aplikasi menampilkan jadwal shalat sebagai pengingat suasana ibadah keluarga. Jika API jadwal shalat tidak dapat diakses, aplikasi tetap menyediakan jadwal fallback lokal.

### 8. Mode Sinkronisasi Google Sheets

Data dapat disinkronkan ke Google Sheets melalui Google Apps Script. Jika koneksi ke Google Apps Script belum tersedia, aplikasi tetap dapat berjalan sementara menggunakan penyimpanan lokal pada perangkat pengguna.

---

## 🧩 Teknologi yang Digunakan

| Komponen | Teknologi |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Hosting | GitHub Pages |
| Backend ringan | Google Apps Script |
| Database | Google Sheets |
| Penyimpanan lokal | Browser `localStorage` |
| Integrasi tambahan | API jadwal shalat |

---

## 📁 Struktur Folder

```text
cakgup-task/
├── index.html        # Halaman utama aplikasi
├── style.css         # Tampilan dan desain aplikasi
├── app.js            # Logika frontend aplikasi
├── config.js         # Konfigurasi keluarga, password, GAS, tugas, dan tagihan
├── gas/
│   └── Code.gs       # Backend Google Apps Script
├── LICENSE           # Lisensi GPL-3.0
└── README.md         # Dokumentasi aplikasi
```

---

## 🖥️ Cara Menggunakan Aplikasi

### 1. Masuk ke Aplikasi

1. Buka URL aplikasi GitHub Pages.
2. Masukkan kode/password keluarga.
3. Klik tombol **Masuk**.
4. Setelah berhasil masuk, aplikasi akan menampilkan dashboard keluarga.

> Catatan: password berada di `config.js`. Untuk penggunaan pribadi/keluarga, ubah password bawaan sebelum aplikasi dipublikasikan.

### 2. Melihat Dashboard

Pada dashboard, pengguna dapat melihat:

- total tugas hari ini;
- tugas selesai;
- tugas tertunda;
- progres masing-masing anak;
- poin yang diperoleh setiap anak.

Klik kartu anak untuk melihat daftar tugas anak tersebut.

### 3. Menambah Tugas Baru

1. Buka menu tambah tugas.
2. Pilih nama anak.
3. Isi judul tugas.
4. Pilih kategori.
5. Tentukan tanggal tugas.
6. Tentukan beban tugas.
7. Tambahkan deskripsi bila diperlukan.
8. Klik **Simpan**.

### 4. Menyelesaikan Tugas

1. Buka daftar tugas.
2. Cari tugas yang ingin diperbarui.
3. Klik tombol **Selesai**.
4. Poin anak akan bertambah sesuai beban tugas.

### 5. Mengedit atau Menghapus Tugas

Pada setiap kartu tugas tersedia tombol:

- **Edit** untuk mengubah data tugas;
- **Hapus** untuk menghapus tugas;
- **Selesai/Cancel** untuk mengubah status penyelesaian.

### 6. Mencairkan Poin

1. Buka dashboard.
2. Pilih anak yang memiliki poin.
3. Klik tombol **Cairkan**.
4. Konfirmasi pencairan poin.
5. Aplikasi akan mencatat riwayat pencairan poin.

### 7. Mengelola Tagihan

1. Buka menu tagihan.
2. Tambahkan nama tagihan.
3. Pilih bulan dan jatuh tempo.
4. Tambahkan catatan bila diperlukan.
5. Ubah status tagihan menjadi **Sudah Dibayar** setelah selesai dibayar.

---

## ⚙️ Cara Instalasi / Duplikasi

### Opsi A — Fork Repository

1. Buka repository GitHub aplikasi.
2. Klik **Fork**.
3. Masuk ke repository hasil fork milik Anda.
4. Ubah isi `config.js` sesuai kebutuhan keluarga/komunitas Anda.
5. Aktifkan GitHub Pages.
6. Aplikasi siap digunakan.

### Opsi B — Download ZIP

1. Klik tombol **Code** di GitHub.
2. Pilih **Download ZIP**.
3. Ekstrak file ke komputer.
4. Edit `config.js`.
5. Upload ke repository GitHub baru.
6. Aktifkan GitHub Pages.

---

## 🔧 Konfigurasi `config.js`

File `config.js` adalah pusat pengaturan aplikasi.

Contoh struktur konfigurasi:

```javascript
window.CAKGUP_CONFIG = {
  APP_PASSWORD: 'ganti-password-anda',
  GAS_URL: 'https://script.google.com/macros/s/ID_DEPLOYMENT/exec',

  CHILDREN: [
    { id: 'anak1', name: 'Anak Pertama', school: 'SMA' },
    { id: 'anak2', name: 'Anak Kedua', school: 'SMP' }
  ],

  DAILY_TASKS: [
    { child: 'Anak Pertama', title: 'Membaca Quran', load: 2, category: 'Ibadah/Kedisiplinan' },
    { child: 'Anak Kedua', title: 'Merapikan kamar', load: 1, category: 'Pekerjaan Rumah' }
  ],

  MONTHLY_BILLS: [
    { name: 'SPP Sekolah', month: '2026-05', status: 'Belum Dibayar', note: 'Pendidikan' }
  ]
};
```

Yang perlu disesuaikan:

| Bagian | Fungsi |
|---|---|
| `APP_PASSWORD` | Kode masuk aplikasi |
| `GAS_URL` | URL deployment Google Apps Script |
| `CHILDREN` | Daftar anak/anggota keluarga |
| `DAILY_TASKS` | Template tugas harian otomatis |
| `MONTHLY_BILLS` | Template tagihan bulanan |

---

## 🧾 Cara Menyiapkan Google Sheets dan Google Apps Script

### 1. Buat Google Spreadsheet

Buat satu file Google Sheets baru sebagai database aplikasi.

Google Apps Script akan menggunakan beberapa sheet, antara lain:

- `tasks` untuk data tugas;
- `bills` untuk data tagihan;
- `point_redemptions` untuk riwayat pencairan poin.

### 2. Pasang Backend Google Apps Script

1. Buka Google Sheets.
2. Pilih **Extensions** → **Apps Script**.
3. Hapus kode bawaan.
4. Salin isi file `gas/Code.gs`.
5. Tempelkan ke editor Apps Script.
6. Simpan project.

### 3. Jalankan Setup Awal

1. Pilih fungsi setup/test yang tersedia di Apps Script.
2. Klik **Run**.
3. Lakukan proses **Authorize**.
4. Pastikan Apps Script dapat mengakses Google Sheets.

### 4. Deploy sebagai Web App

1. Klik **Deploy** → **New deployment**.
2. Pilih tipe **Web app**.
3. Isi pengaturan:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Klik **Deploy**.
5. Salin URL deployment.
6. Tempel URL tersebut ke bagian `GAS_URL` pada `config.js`.

---

## 🌐 Cara Mengaktifkan GitHub Pages

1. Buka repository GitHub.
2. Masuk ke menu **Settings**.
3. Pilih **Pages**.
4. Pada bagian **Build and deployment**, pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Klik **Save**.
6. Tunggu beberapa saat hingga URL GitHub Pages aktif.

---

## 🔐 Catatan Keamanan

Aplikasi ini dirancang sederhana untuk kebutuhan keluarga/komunitas kecil. Namun, karena berjalan di frontend statis, beberapa hal perlu diperhatikan:

1. **Jangan gunakan password penting** pada `APP_PASSWORD`.
2. **Jangan menyimpan data sangat sensitif** di aplikasi ini.
3. Jika repository dibuat publik, isi `config.js` juga dapat dilihat orang lain.
4. Untuk penggunaan lebih serius, pertimbangkan mekanisme autentikasi yang lebih kuat.
5. Batasi data pribadi anak atau keluarga yang tidak perlu ditampilkan.
6. Buat salinan pribadi repository jika ingin menggunakan data keluarga yang tidak boleh dibuka publik.

---

## 🛠️ Ide Pengembangan Lanjutan

Beberapa fitur yang dapat dikembangkan ke depan:

- login berbasis akun Google;
- halaman admin orang tua;
- riwayat poin per anak;
- laporan mingguan dan bulanan;
- grafik progres kedisiplinan;
- notifikasi WhatsApp/Telegram;
- mode komunitas untuk halaqah, sekolah, atau kelompok belajar;
- ekspor laporan ke PDF;
- template tugas ibadah Ramadhan;
- leaderboard keluarga yang tetap sehat dan tidak berlebihan.

---

## 🤲 Dedikasi untuk Ummat

Aplikasi ini didedikasikan untuk ummat sebagai ikhtiar kecil dalam membangun keluarga yang lebih tertata, anak-anak yang lebih bertanggung jawab, dan rumah yang lebih hidup dengan nilai kebaikan.

Semoga aplikasi ini dapat menjadi amal jariyah digital: sederhana bentuknya, tetapi luas manfaatnya.

Silakan gunakan, duplikasi, sesuaikan, dan sebarkan untuk keluarga, komunitas, sekolah, masjid, TPA, halaqah, atau lingkungan pendidikan lain yang membutuhkan.

---

## 📜 Lisensi

Repository ini menggunakan lisensi **GPL-3.0**. Artinya, aplikasi boleh digunakan, dipelajari, dimodifikasi, dan didistribusikan kembali dengan tetap memperhatikan ketentuan lisensi yang berlaku.

---

<div align="center">

### CakGup Task

**Dari rumah, untuk keluarga. Dari keluarga, untuk ummat.**

</div>
