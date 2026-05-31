# Tugas Keluarga - Multi-Tenant SaaS Family Management Platform

Versi ini sudah disesuaikan dengan UR terbaru: aplikasi tidak lagi hanya single-tenant berbasis file statis, tetapi memakai frontend statis + Cloudflare Workers + Cloudflare D1 sebagai backend multi-tenant.

## Fitur Utama

- Registrasi keluarga baru dengan `family_id` otomatis.
- Login Orang Tua menggunakan email keluarga dan kata sandi utama.
- Login Anak menggunakan email keluarga, nama anak, dan PIN 4–6 digit.
- Math captcha untuk login dan registrasi, divalidasi di sisi server.
- Isolasi data seluruh modul berdasarkan `family_id`.
- Role-Based Access Control:
  - Orang tua dapat mengelola tugas, tagihan, anak, template, dan persetujuan pencairan poin.
  - Anak hanya melihat tugas miliknya sendiri dan tidak dapat membuka modul tagihan bulanan.
- Daily seeding tugas harian dan monthly seeding tagihan bulanan.
- Perlakuan hibrida:
  - Akun default `cakgup` memakai template lama Fatiyyah, Alifah, Fatih dan 15 tagihan default.
  - Keluarga baru memakai template yang dibuat sendiri melalui menu Master.

## Struktur Folder

```text
task/        Frontend statis untuk GitHub Pages/hosting statis
task-api/    Cloudflare Worker API + schema D1
```

## Konfigurasi Frontend

Edit `task/config.js`:

```js
window.CAKGUP_CONFIG = {
  API_URL: 'https://task-api.cakgup.workers.dev',
  DEFAULT_PARENT_EMAIL: 'cakgup'
};
```

## Setup Backend Cloudflare D1

```bash
cd task-api
npx wrangler d1 execute task-db --file=./schema.sql --remote
npx wrangler d1 execute task-db --file=./migrasi_data_lama.sql --remote   # opsional
npx wrangler deploy
```

## Akun Default Cakgup

Orang tua:

```text
Email keluarga: cakgup
Password: cakgup
```

Anak:

```text
Email keluarga: cakgup
Nama anak: Fatiyyah / Alifah / Fatih
PIN awal: 1234
```

## Catatan Keamanan

Password, PIN, token sesi, dan captcha tidak disimpan dalam bentuk polos. Backend menyimpan hash SHA-256 bersalt untuk password/PIN dan hash token untuk sesi. Untuk produksi besar, disarankan menambahkan rate limiting berbasis IP/user-agent di Cloudflare WAF atau Durable Object.

## Update 31 Mei 2026

Versi ini menambahkan UI mobile login ringkas, menu Akun, tagihan rutin/non-rutin, alarm jatuh tempo, pencairan poin sebagian, papan semangat keluarga untuk akun anak, dan navigasi yang lebih rapi. Untuk database existing, jalankan migration tambahan di `task-api/migration_update_2026_05_31.sql` sebelum deploy Worker terbaru.

## Hotfix Foreign Key 31 Mei 2026

Paket ini memperbaiki error saat login:

```text
D1_ERROR: FOREIGN KEY constraint failed
```

Penyebabnya adalah seeding tagihan bulanan default `cakgup` mengisi `monthly_bills.created_from_template_id`, tetapi template default belum tersedia di `bill_templates`. Backend sekarang otomatis melakukan bootstrap 15 template tagihan default sebelum seeding bulanan. Jika database D1 sudah terlanjur dibuat dan masih error, jalankan:

```bash
cd task-api
npx wrangler d1 execute task-db --file=./migration_hotfix_fk_2026_05_31.sql --remote
npx wrangler deploy
```
