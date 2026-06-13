# Tugas Keluarga - Pengingat Kebaikan Harian

<p align="center">
  <strong>Aplikasi keluarga untuk mengelola amanah harian, tagihan, poin, dan komunikasi ringan dalam satu alur yang ramah mobile.</strong><br>
  Frontend statis siap PWA, dengan integrasi API backend dan dukungan multi-tenant per keluarga.
</p>

<p align="center">
  <a href="https://cakgup.github.io/task/">
    <img src="https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?logo=github" alt="GitHub Pages">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg" alt="License GPL-3.0">
  </a>
  <img src="https://img.shields.io/badge/PWA-Installable-1E88E5" alt="PWA Installable">
  <img src="https://img.shields.io/badge/Multi%20Tenant-Family%20Scoped-166534" alt="Multi Tenant">
</p>

---

## Bismillahirrahmanirrahim

Repository ini dibuat sebagai ikhtiar agar rumah menjadi ruang tumbuh yang lebih tertib, lebih hangat, dan lebih mudah saling mengingatkan dalam kebaikan.

README ini diperbarui agar:

- dokumentasi mengikuti fitur repo yang sekarang;
- orang lain lebih mudah melakukan clone, fork, dan penyesuaian;
- perbedaan antara frontend publik dan scaffold backend lebih jelas;
- nilai sensitif seperti email bawaan, endpoint, dan kredensial tidak tersebar mentah.

---

## Tentang Aplikasi

**Tugas Keluarga** adalah aplikasi keluarga berbasis **frontend statis + API backend** dengan pemisahan data per keluarga (`family_id`).

Saat ini frontend sudah mendukung:

- login orang tua;
- login anak;
- registrasi keluarga baru;
- pengelolaan tugas harian;
- pengelolaan tagihan keluarga;
- template tugas dan template tagihan;
- pengajuan pencairan poin;
- usulan tugas dari anak ke orang tua;
- widget jadwal shalat;
- family chat dan indikator presence;
- web push notification scaffolding;
- PWA installable.

---

## Fitur Terkini

| Fitur | Keterangan |
|---|---|
| Multi-tenant family | Data dipisah berdasarkan akun keluarga |
| Login per peran | Orang tua dan anak memiliki alur login berbeda |
| Registrasi keluarga | Pendaftaran akun keluarga langsung dari aplikasi |
| Captcha aritmatika | Dipakai pada login dan registrasi |
| Tugas harian | Tambah, edit, hapus, filter, dan tandai selesai |
| Template tugas | Tugas berulang lebih mudah dibuat ulang |
| Tagihan keluarga | Tagihan sekali pakai atau rutin dengan reminder |
| Template tagihan | Pola tagihan bulanan dapat disimpan sebagai template |
| Poin dan pencairan | Anak mengajukan pencairan, orang tua memutuskan |
| Usulan tugas anak | Anak dapat mengajukan ide tugas ke orang tua |
| Dashboard keluarga | Ringkasan total tugas, progres, saldo poin, dan alarm tagihan |
| Family scoreboard | Tampilan poin/progres per anak |
| Family chat | Komunikasi ringan dalam keluarga pada frontend |
| Presence + push scaffold | Frontend siap untuk status online dan push notification |
| Jadwal shalat | Widget dengan lokasi default, cache, dan opsi GPS |
| PWA | Install ke homescreen dan dukungan service worker |

---

## Struktur Repository

```text
task/
|-- index.html
|-- style.css
|-- app.js
|-- config.js
|-- sw.js
|-- manifest.webmanifest
|-- assets/
|-- gas/
|-- task-api/
|   |-- README.md
|   |-- schema_push_presence.sql
|   `-- src/
|-- LICENSE
|-- README_INSTALL.txt
`-- README.md
```

Keterangan singkat:

| File/Folder | Fungsi |
|---|---|
| `index.html` | Struktur antarmuka login dan panel aplikasi |
| `style.css` | Tampilan visual dan layout responsif |
| `app.js` | Seluruh logika frontend |
| `config.js` | Konfigurasi endpoint API dan push public key |
| `sw.js` | Service worker untuk PWA |
| `gas/` | Arsip/utilitas integrasi tambahan |
| `task-api/` | Scaffold backend tambahan untuk push notification dan presence |

---

## Catatan Penting Tentang Backend

Repo ini **bukan** source lengkap backend produksi.

Yang ada di repo:

- frontend utama;
- file konfigurasi frontend menuju API;
- scaffold `task-api/` untuk fitur push notification dan presence.

Artinya, saat menduplikasi project:

- Anda perlu menyiapkan API backend Anda sendiri;
- Anda perlu membuat database dan autentikasi backend Anda sendiri;
- folder `task-api/` hanya membantu fondasi integrasi fitur tertentu, bukan seluruh API utama.

---

## Konfigurasi Frontend

Konfigurasi ada di:

```text
config.js
```

Contoh aman untuk duplikasi:

```js
window.CAKGUP_CONFIG = {
  API_URL: "https://api-anda.workers.dev",
  DEFAULT_PARENT_EMAIL: "keluarga@example.com",
  PUSH_PUBLIC_KEY: ""
};
```

Yang perlu diperhatikan:

- ganti `API_URL` ke backend Anda sendiri;
- ganti `DEFAULT_PARENT_EMAIL` ke placeholder netral atau kosong;
- isi `PUSH_PUBLIC_KEY` hanya jika backend push notification Anda sudah siap;
- jangan commit token, password, secret, atau email pribadi ke dokumentasi.

---

## Menjalankan Frontend Secara Lokal

Jangan buka lewat `file://`. Gunakan local server.

### Opsi 1 - Python

```bash
python -m http.server 5500 --directory .
```

Lalu buka:

```text
http://localhost:5500
```

### Opsi 2 - Node.js

```bash
npx -y serve .
```

Lalu buka:

```text
http://localhost:3000
```

---

## Panduan Duplikasi Project

### 1. Clone repository

```bash
git clone <url-repository-anda>
cd task
```

### 2. Ganti identitas aplikasi

Periksa dan sesuaikan:

- judul dan meta di `index.html`;
- teks sambutan, deskripsi, dan label UI;
- ikon aplikasi di folder `assets/`;
- warna dan tema di `style.css`.

### 3. Siapkan backend baru

Karena backend produksi tidak disertakan penuh di repo ini, Anda perlu:

- membuat API sendiri;
- membuat database sendiri;
- menyiapkan autentikasi parent/child;
- menyesuaikan kontrak endpoint sesuai kebutuhan frontend.

### 4. Audit nilai default

Saat menduplikasi, cek dan ubah:

- `DEFAULT_PARENT_EMAIL` di `config.js`;
- lokasi default jadwal shalat;
- teks nama brand atau keluarga contoh;
- kontrak endpoint notifikasi/presence jika akan dipakai.

### 5. Jika ingin push notification dan presence

Baca isi:

```text
task-api/README.md
```

Scaffold itu sudah menyiapkan acuan untuk:

- menyimpan subscription push;
- menghapus subscription push;
- heartbeat presence via WebSocket;
- snapshot/update presence.

Namun Anda tetap perlu menyambungkannya ke Worker/API utama Anda.

---

## Deploy

Frontend bisa dipublikasikan ke:

- GitHub Pages
- Cloudflare Pages
- Vercel
- Netlify

Sebelum deploy:

- pastikan `config.js` mengarah ke API baru;
- pastikan data contoh atau identitas pribadi sudah diganti;
- pastikan push public key hanya diisi jika backend benar-benar siap;
- uji login parent, login child, dan registrasi pada environment target.

---

## Checklist Sebelum Dibagikan

- [ ] Login orang tua berjalan normal
- [ ] Login anak berjalan normal
- [ ] Registrasi keluarga baru berhasil
- [ ] CRUD tugas dan tagihan berfungsi
- [ ] Template tugas dan tagihan dapat dipakai
- [ ] Pencairan poin dan usulan tugas berjalan
- [ ] Chat keluarga tidak error bila backend mendukung
- [ ] Widget jadwal shalat tampil normal
- [ ] `config.js` tidak berisi data pribadi atau endpoint sensitif lama
- [ ] Tidak ada kredensial contoh yang tertinggal di dokumentasi

---

## Troubleshooting

### Tidak bisa login atau registrasi

- cek `API_URL` di `config.js`;
- cek backend aktif dan dapat diakses;
- cek captcha terisi dengan benar.

### Data tidak muncul setelah login

- cek respons API di tab Network browser;
- cek apakah `family_id` pada backend sudah benar;
- cek apakah token sesi dikirim dan diterima dengan benar.

### Chat atau presence tidak berjalan

- cek apakah backend sudah mendukung endpoint/payload yang diharapkan frontend;
- cek apakah scaffold `task-api/` sudah disambungkan ke Worker utama.

### Push notification tidak aktif

- cek `PUSH_PUBLIC_KEY`;
- cek izin notifikasi browser;
- cek backend sudah menyimpan subscription dan mengirim push.

### PWA tidak bisa di-install

- akses melalui `https://` atau `http://localhost`;
- cek `manifest.webmanifest` dan `sw.js`;
- sebagian browser membutuhkan interaksi pengguna sebelum prompt install muncul.

---

## Catatan Keamanan

- Jangan commit email keluarga asli, password, PIN, token, atau secret backend.
- Password dan PIN sebaiknya selalu di-hash di backend.
- Aktifkan rate limiting pada layer API/WAF.
- Data keluarga bersifat sensitif; audit payload API dan log sebelum dipakai produksi.
- Jika membagikan hasil fork, gunakan placeholder netral untuk akun contoh.

---

## Teknologi

| Teknologi | Fungsi |
|---|---|
| HTML | Struktur antarmuka |
| CSS | Tampilan visual |
| JavaScript | Logika frontend dan integrasi API |
| PWA | Instalasi aplikasi dan cache dasar |
| Cloudflare Workers + D1 | Backend yang dituju oleh frontend |
| Web Push + Presence Scaffold | Fondasi notifikasi dan status online |

---

## Lisensi

Repository ini menggunakan lisensi **GNU General Public License v3.0 (GPL-3.0)**.  
Lihat detail pada file [LICENSE](LICENSE).

---

<p align="center">
  <strong>Dibangun dengan niat baik, dirawat dengan amanah, dan dipakai untuk menumbuhkan kebiasaan baik keluarga.</strong>
</p>

<p align="center">
  <sub>developed with &#10084;&#65039; by <a href="https://cakgup.codeberg.page">cakgup</a></sub>
</p>
