# Panduan Aktifkan Google Calendar Otomatis

Fitur "Tambahkan otomatis ke Google Calendar" sudah ada di aplikasi, tapi perlu **1x setup** akun Google Cloud supaya aktif. Tanpa setup ini, aplikasi otomatis pakai mode lama (tombol "Buka di Google Calendar" → klik Simpan).

Ikuti langkah berikut sekali saja.

## 1. Buat Project & OAuth Client ID di Google Cloud

1. Buka https://console.cloud.google.com → login pakai akun Google **Al-Kahfi / pemilik** (akun ini jadi pemilik integrasi).
2. Buat project baru, misal namanya **Al-Kahfi Team App**.
3. Di menu cari **"Google Calendar API"** → klik **Enable**.
4. Buka menu **APIs & Services → OAuth consent screen**:
   - Pilih **External** → Create.
   - Isi nama app (mis. "Al-Kahfi Team App"), email support, dan email developer. Simpan.
   - Di bagian **Scopes**, tidak wajib menambah apa-apa (app minta scope saat dipakai).
   - Di bagian **Test users**, tambahkan **semua email Gmail anggota tim** yang akan memakai fitur ini (selama app masih "Testing"). Atau, kalau mau dipakai semua orang tanpa daftar, nanti app perlu "Publish" (lihat catatan di bawah).
5. Buka menu **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins** → tambahkan:
     - `https://alkahficorp.vercel.app`
     - (opsional untuk uji lokal) `http://localhost:5173`
   - Klik **Create**. Salin **Client ID** yang muncul (bentuknya seperti `xxxxxxx.apps.googleusercontent.com`).

## 2. Masukkan Client ID ke Vercel

1. Buka project di https://vercel.com → **Settings → Environment Variables**.
2. Tambahkan variabel baru:
   - **Name:** `VITE_GOOGLE_CLIENT_ID`
   - **Value:** Client ID yang tadi disalin.
   - Environment: centang **Production** (dan Preview/Development bila perlu).
3. **Redeploy** aplikasi (Deployments → menu titik tiga deploy terakhir → Redeploy). Wajib redeploy supaya nilai env terbaca.

Selesai. Setelah redeploy, di form "Agenda Baru" akan muncul centang **"Tambahkan otomatis ke Google Calendar saya"**.

## Cara pakai (anggota tim)

- Saat buat agenda dan centang aktif → klik **Simpan Agenda**.
- Pertama kali, muncul jendela login Google → pilih akun & izinkan akses kalender.
- Agenda langsung masuk ke Google Calendar akun yang dipilih. Peserta yang sudah mengisi Gmail di **Profil** otomatis diundang via email.

## Catatan penting

- **Akun penambah = akun Google yang login saat menyimpan.** Jadi siapa pun yang membuat agenda, agenda masuk ke kalender akun Google miliknya sendiri.
- Selama OAuth consent screen masih status **"Testing"**, hanya email yang terdaftar di **Test users** yang bisa pakai. Untuk dipakai bebas oleh siapa saja, tekan **Publish App** di OAuth consent screen. Karena scope kalender termasuk "sensitive", Google mungkin meminta verifikasi untuk penggunaan publik luas — untuk tim internal, cara paling mudah tetap pakai daftar Test users.
- Client ID **aman ditaruh di front-end** (memang dirancang publik). Tidak ada secret yang bocor.
- Kalau env belum diisi, aplikasi tetap jalan normal pakai tombol "Buka di Google Calendar".
