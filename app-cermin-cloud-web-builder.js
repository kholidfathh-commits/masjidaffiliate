// Al-Kahfi Team App — CERMIN langsung dari alkahficorp.vercel.app
// Tempel seluruh isi file ini ke app.js di Web Builder IDE, lalu Run App.
// Tampilan & update otomatis mengikuti versi Vercel. Data tetap di Supabase yang sama.
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const SUMBER = 'alkahficorp.vercel.app';

http.createServer((req, res) => {
  const opsi = {
    hostname: SUMBER,
    port: 443,
    path: req.url,
    method: req.method,
    headers: Object.assign({}, req.headers, { host: SUMBER })
  };
  delete opsi.headers['connection'];

  const teruskan = https.request(opsi, (jawab) => {
    const h = Object.assign({}, jawab.headers);
    delete h['transfer-encoding'];
    delete h['connection'];
    delete h['content-length'];
    res.writeHead(jawab.statusCode || 200, h);
    jawab.pipe(res);
  });

  teruskan.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Gagal menghubungi server sumber. Coba refresh halaman.');
  });

  req.pipe(teruskan);
}).listen(PORT, () => console.log('Al-Kahfi Team App (cermin) jalan di port ' + PORT));
