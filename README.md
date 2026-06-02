# 🌙 Tugas Keluarga — Pengingat Kebaikan Harian

<p align="center">
  <strong>Aplikasi keluarga untuk membangun amanah harian, ibadah, dan kebiasaan baik di rumah</strong><br>
  Multi-tenant, mobile-friendly, dan siap dipasang sebagai PWA.
</p>

<p align="center">
  <a href="https://cakgup.github.io/task/">
    <img src="https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?logo=github" alt="GitHub Pages">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg" alt="License GPL-3.0">
  </a>
  <img src="https://img.shields.io/badge/PWA-Installable-1E88E5" alt="PWA Installable">
  <img src="https://img.shields.io/badge/Cloudflare-D1%20%2B%20Workers-F38020" alt="Cloudflare Stack">
</p>

---

## ✦ Bismillahirrahmanirrahim

Aplikasi ini dibuat sebagai ikhtiar agar rumah menjadi ruang tumbuh yang saling mengingatkan dalam kebaikan.  
Orang tua lebih mudah mengelola amanah harian, anak lebih semangat menunaikan tugas, dan seluruh keluarga punya ritme ibadah yang lebih terjaga.

> _“Wata'awanu 'alal birri wat taqwa.”_  
> Saling tolong-menolonglah dalam kebaikan dan ketakwaan.

---

## 📌 Tentang Aplikasi

**Tugas Keluarga** adalah aplikasi web keluarga berbasis **frontend statis + API backend** untuk manajemen tugas anak, tagihan bulanan, dan pencairan poin secara terstruktur.

Cocok digunakan untuk:

- pengelolaan amanah harian anak di rumah;
- pembiasaan disiplin dengan sistem poin;
- pemantauan tagihan keluarga bulanan;
- komunikasi orang tua-anak lewat alur usulan dan persetujuan.

---

## ✨ Fitur Utama

| Fitur | Keterangan |
|---|---|
| 👨‍👩‍👧‍👦 Multi-Tenant Family | Tiap keluarga punya data terisolasi berdasarkan `family_id` |
| 🔐 Login Orang Tua & Anak | Role terpisah: orang tua (manajemen), anak (eksekusi tugas) |
| ➕ Registrasi Keluarga Baru | Pendaftaran akun keluarga langsung dari aplikasi |
| 🧠 Captcha Aritmatika | Validasi login/registrasi dengan soal hitung sederhana |
| ✅ Tugas Harian | Buat, pantau, dan selesaikan tugas dengan status progres |
| 💰 Tagihan Bulanan | Kelola tagihan rutin/non-rutin + pengingat jatuh tempo |
| 🎯 Pencairan Poin | Anak ajukan, orang tua review dan setujui |
| 🙋 Usulan Tugas Anak | Anak bisa mengajukan ide tugas baru ke orang tua |
| 🕌 Widget Jadwal Shalat | Menampilkan jadwal shalat dengan dukungan deteksi lokasi |
| 📱 PWA Installable | Bisa dipasang ke homescreen Android/iOS/Desktop |

---

## 🧭 Alur Peran

| Peran | Akses Utama |
|---|---|
| Orang Tua | Kelola tugas, tagihan, anak, template, persetujuan pencairan, pengaturan akun |
| Anak | Lihat & kerjakan tugas sendiri, ajukan tugas baru, ajukan pencairan poin |

---

## 🗂️ Struktur Repository

```text
task/
├── index.html
├── style.css
├── app.js
├── config.js
├── sw.js
├── manifest.webmanifest
├── assets/
├── gas/
└── README.md
```

Keterangan singkat:

| File/Folder | Fungsi |
|---|---|
| `index.html` | Struktur halaman login, panel aplikasi, dan dialog interaksi |
| `style.css` | Tema visual dan layout responsif |
| `app.js` | Seluruh logika aplikasi frontend |
| `config.js` | Konfigurasi endpoint API |
| `sw.js` | Service worker untuk dukungan PWA/offline dasar |
| `assets/` | Ikon dan aset visual |
| `gas/` | Utilitas/arsip terkait integrasi tambahan |

---

## ⚙️ Konfigurasi API

Atur endpoint API di file `config.js`:

```js
window.CAKGUP_CONFIG = {
  API_URL: 'https://folder-api.akun.workers.dev',
  DEFAULT_PARENT_EMAIL: 'akun@email.com'
};
```

Jika memakai API sendiri, ganti `API_URL` sesuai domain backend Anda.

---

## 🚀 Menjalankan Secara Lokal

Jangan buka file langsung via `file://`. Gunakan local server.

### Opsi 1 — Python

```bash
python -m http.server 5500 --directory .
```

Lalu buka:

```text
http://localhost:5500
```

### Opsi 2 — Node.js

```bash
npx -y serve .
```

Lalu buka:

```text
http://localhost:3000
```

---

## 🌐 Deploy Frontend

Frontend ini bisa dideploy ke:

- GitHub Pages
- Cloudflare Pages
- Vercel
- Netlify

Untuk GitHub Pages:

1. Push ke branch `main`.
2. Buka `Settings` → `Pages`.
3. Pilih source `Deploy from a branch`.
4. Pilih branch `main`, folder `/root`.
5. Simpan dan tunggu URL aktif.

---

## 🧪 Checklist Sebelum Publish

- [ ] Login orang tua dan anak berjalan normal
- [ ] Registrasi keluarga baru berhasil
- [ ] CRUD tugas dan tagihan berfungsi
- [ ] Alur usulan tugas dan pencairan poin berjalan
- [ ] Widget jadwal shalat tampil normal
- [ ] Tidak ada error penting di browser console
- [ ] `config.js` mengarah ke API yang benar

---

## 🧩 Troubleshooting

### Tidak bisa login / registrasi

- pastikan `API_URL` di `config.js` benar;
- cek backend aktif dan dapat diakses;
- cek captcha terisi benar.

### Data tidak muncul setelah login

- periksa koneksi internet;
- cek respons API di tab Network browser;
- pastikan akun memiliki data pada `family_id` yang sesuai.

### PWA tidak muncul tombol install

- akses via `https://` atau `http://localhost`;
- pastikan `manifest.webmanifest` dan `sw.js` termuat;
- beberapa browser butuh interaksi dulu sebelum prompt install muncul.

---

## 🔐 Catatan Keamanan

- Password/PIN/token sesi sebaiknya selalu di-hash di backend.
- Aktifkan rate limiting di layer API/WAF untuk mencegah brute force.
- Hindari menyimpan data sensitif keluarga di sisi frontend.

---

## 🛠️ Teknologi

| Teknologi | Fungsi |
|---|---|
| HTML | Struktur antarmuka |
| CSS | Tampilan visual |
| JavaScript | Logika interaksi frontend |
| PWA (Manifest + Service Worker) | Instalasi aplikasi dan dukungan offline |
| Cloudflare Workers + D1 | API backend dan database multi-tenant |

---

## 📜 Lisensi

Repository ini menggunakan lisensi **GNU General Public License v3.0 (GPL-3.0)**.  
Lihat detail pada file [LICENSE](LICENSE).

---

<p align="center">
  <strong>Dibangun dengan niat baik, dirawat dengan amanah, dan dipakai untuk menumbuhkan kebiasaan baik keluarga.</strong>
</p>
