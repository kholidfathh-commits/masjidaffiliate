/**
 * AL-KAHFI — JEMBATAN GOOGLE CALENDAR TERPUSAT
 * ------------------------------------------------------------
 * Script ini membuat agenda di Google Calendar AKUN INI (akun yang men-deploy).
 * Tujuan: semua agenda dari aplikasi tim masuk ke SATU Google Calendar
 * (akun pusat = digitalalkahfi@gmail.com), tanpa anggota lain perlu login Google.
 *
 * Cara pakai singkat (detail ada di PANDUAN-GOOGLE-CALENDAR-PUSAT.md):
 *  1. Login script.google.com sebagai digitalalkahfi@gmail.com
 *  2. New project → paste SELURUH isi file ini
 *  3. Ganti SECRET di bawah dengan kode rahasia bebas
 *  4. Deploy → New deployment → Web app
 *       - Execute as: Me (digitalalkahfi@gmail.com)
 *       - Who has access: Anyone
 *  5. Copy URL Web app → isi VITE_GCAL_ENDPOINT di Vercel
 *     (VITE_GCAL_SECRET = kode rahasia yang sama)
 */

// ==== GANTI kode rahasia ini (samakan persis dengan VITE_GCAL_SECRET di Vercel) ====
var SECRET = 'GANTI-DENGAN-KODE-RAHASIA';

// Indonesia (WIB) tidak ada daylight saving → offset tetap +07:00
var WIB_OFFSET = '+07:00';

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Cek kode rahasia (biar tidak sembarang orang bisa bikin agenda)
    if (SECRET && data.secret !== SECRET) {
      return _json({ ok: false, error: 'Kode rahasia salah' });
    }
    if (!data.title || !data.date) {
      return _json({ ok: false, error: 'Judul atau tanggal kosong' });
    }

    var startStr = data.date + 'T' + (data.start || '09:00') + ':00' + WIB_OFFSET;
    var endStr   = data.date + 'T' + (data.end || data.start || '10:00') + ':00' + WIB_OFFSET;
    var start = new Date(startStr);
    var end = new Date(endStr);
    if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000); // minimal 1 jam

    var options = {
      description: data.description || '',
      location: data.location || ''
    };
    var guests = (data.attendees || []).filter(function (x) { return x && String(x).indexOf('@') > -1; });
    if (guests.length) {
      options.guests = guests.join(',');
      options.sendInvites = true;
    }

    CalendarApp.getDefaultCalendar().createEvent(data.title, start, end, options);
    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// Untuk tes cepat dari browser (buka URL-nya → harus muncul tulisan ini)
function doGet() {
  return ContentService.createTextOutput('Al-Kahfi Google Calendar bridge AKTIF.');
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
