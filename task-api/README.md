## Push Notification And Presence Scaffold

Folder ini menyiapkan fondasi backend untuk dua fitur baru:

- push notification untuk chat baru
- status online sederhana berbasis heartbeat

Repo frontend ini belum menyertakan source Worker API utama, jadi scaffold ini belum terhubung ke router produksi. Saat source Worker utama sudah tersedia, sambungkan helper di `src/push-presence.js` ke action berikut:

- `savePushSubscription`
- `deletePushSubscription`
- payload WebSocket `presence_heartbeat`
- broadcast `presence_snapshot` atau `presence_update`

### Tabel D1 baru

Jalankan:

```bash
npx wrangler d1 execute task-db --file=./task-api/schema_push_presence.sql --remote
```

### Kontrak frontend yang sudah aktif

Frontend sekarang akan mencoba:

- `apiPost('savePushSubscription', { subscription })`
- `apiPost('deletePushSubscription', { endpoint })`
- mengirim payload WebSocket:

```json
{
  "type": "presence_heartbeat",
  "visible": true,
  "sentAt": "2026-06-02T10:00:00.000Z"
}
```

Frontend juga siap menerima payload:

```json
{
  "type": "presence_snapshot",
  "onlineCount": 2,
  "members": [
    { "displayName": "Ayah" },
    { "displayName": "Fatih" }
  ],
  "updatedAt": "2026-06-02T10:00:00.000Z"
}
```

### Catatan implementasi

- Push Web perlu `PUSH_PUBLIC_KEY` VAPID public key di `config.js`.
- Pengiriman push server-side belum dimasukkan di scaffold ini karena source router produksi dan secret VAPID private key belum ada di repo.
- Presence sebaiknya dianggap online jika heartbeat terakhir masih dalam 60-90 detik.
