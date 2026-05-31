INSTALASI CEPAT - TASK FAMILY MULTI-TENANT CLOUDFARE D1

1. Masuk folder backend:
   cd task-api

2. Terapkan skema database D1:
   npx wrangler d1 execute task-db --file=./schema.sql --remote

3. Opsional: migrasikan data lama akun default cakgup:
   npx wrangler d1 execute task-db --file=./migrasi_data_lama.sql --remote

4. Deploy Cloudflare Worker:
   npx wrangler deploy

5. Pastikan file task/config.js mengarah ke endpoint Worker yang benar:
   window.CAKGUP_CONFIG = {
     API_URL: 'https://task-api.cakgup.workers.dev',
     DEFAULT_PARENT_EMAIL: 'cakgup'
   };

6. Upload folder task ke GitHub Pages atau hosting statis lain.

AKUN DEFAULT CAKGUP
- Login Orang Tua:
  Email keluarga: cakgup
  Password: cakgup
- Login Anak default:
  Email keluarga: cakgup
  Nama anak: Fatiyyah / Alifah / Fatih
  PIN awal: 1234

CATATAN PENTING
- Semua data utama sudah memakai family_id agar terisolasi per keluarga.
- Captcha matematika dibuat dan divalidasi di server Cloudflare Worker.
- Akun anak tidak bisa membuka modul Tagihan, Tambah, dan Master.
- Cron Worker diset pada 17:00 UTC, setara 00:00 WIB, untuk reset/seeding harian.

UPDATE 31 Mei 2026:
Jika database D1 sudah pernah dibuat dengan schema multi-tenant versi awal, jalankan file:
  task-api/migration_update_2026_05_31.sql

Jika deploy dari awal, cukup jalankan schema.sql terbaru.

HOTFIX FOREIGN KEY 31 Mei 2026:
Jika saat login muncul error:
  D1_ERROR: FOREIGN KEY constraint failed
maka deploy ulang Worker dari paket ini. Jika database lama masih bermasalah, jalankan:
  npx wrangler d1 execute task-db --file=./migration_hotfix_fk_2026_05_31.sql --remote
