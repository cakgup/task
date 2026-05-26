# Manajemen Tugas Keluarga

Paket ini sudah dikompilasi ulang untuk GitHub Pages + Google Apps Script.

## API GAS yang dipakai

```javascript
https://script.google.com/macros/s/SCRIPT_ID/exec
```

URL tersebut sudah dimasukkan ke `config.js`.

## Isi file

- `index.html` — halaman utama aplikasi
- `style.css` — tema modern mobile-first
- `app.js` — logika aplikasi
- `config.js` — password statis dan URL GAS
- `gas/Code.gs` — backend Google Apps Script
- `README.md` — panduan singkat

## Cara pasang ke GitHub Pages

1. Upload semua file di root repo GitHub Pages:
   - `index.html`
   - `style.css`
   - `app.js`
   - `config.js`
2. Folder `gas` tidak wajib diupload ke GitHub Pages, tetapi boleh disimpan sebagai dokumentasi.
3. Aktifkan GitHub Pages dari branch utama.

## Cara pasang GAS

1. Buka Google Spreadsheet yang dipakai sebagai database.
2. Klik Extensions → Apps Script.
3. Paste isi `gas/Code.gs`.
4. Jalankan fungsi `testRun`, bukan `doGet`.
5. Lakukan Authorize.
6. Deploy → New deployment → Web app.
7. Execute as: Me.
8. Who has access: Anyone.
9. Deploy.
10. Pastikan URL hasil deploy sama dengan URL API di atas.

