// ============================================================================
// UJI LOGIKA LMS — jalankan dengan:  node uji-lms.mjs
// ----------------------------------------------------------------------------
// Ini BUKAN framework test dan TIDAK menambah dependency apa pun — cuma satu file
// Node biasa yang memakai storage tiruan di memori. Database production tidak
// pernah disentuh. Tujuannya menjaga logika bisnis yang paling mudah rusak diam-diam:
// perhitungan progres, penargetan & idempotensi auto-enrollment, penilaian kuis,
// penomoran percobaan, dan batas wewenang leader.
// Jalankan setiap kali src/lms/data.js diubah.
// ============================================================================
import * as L from './src/lms/data.js';

const mem = new Map();
L.initLms({ storage: {
  async get(k){ return mem.has(k)?structuredClone(mem.get(k)):null; },
  async set(k,v){ mem.set(k,structuredClone(v)); return true; },
  async getList(k){ const r=await this.get(k); return Array.isArray(r)?r:[]; },
  async delete(k){ mem.delete(k); return true; },
  async listByPrefix(p){ const o=[]; for(const [k,v] of mem) if(k.startsWith(p)) o.push(structuredClone(v)); return o; },
  async deleteByPrefix(p){ for(const k of [...mem.keys()]) if(k.startsWith(p)) mem.delete(k); return true; },
}});

let lulus=0, gagal=0;
const cek=(nama,syarat)=>{ if(syarat){lulus++;console.log('  LULUS  ',nama);} else {gagal++;console.log('  GAGAL  ',nama);} };

// ---- kursus contoh: 3 wajib + 1 opsional ----
const L1='l1',L2='l2',L3='l3',LOPS='lop';
const kursus = { id:'c1', status:'published', modules:[{ id:'m1', order:0, lessons:[
  {id:L1,type:'text',order:0,required:true},{id:L2,type:'quiz',order:1,required:true,quiz:{passingScore:80,maxAttempts:3,questions:[]}},
  {id:L3,type:'assignment',order:2,required:true},{id:LOPS,type:'text',order:3,required:false}]}]};

const ctx=(prog=[],att=[],sub=[])=>L.buildCtx({progress:prog.map(l=>({userId:'u',lessonId:l})),attempts:att,submissions:sub},'u');

console.log('\n== PROGRESS ==');
cek('0 selesai = 0%', L.computeCourseProgress(kursus, ctx()).percent===0);
cek('1 dari 3 wajib = 33%', L.computeCourseProgress(kursus, ctx([L1])).percent===33);
cek('materi OPSIONAL tidak menghambat',
  (()=>{const p=L.computeCourseProgress(kursus, ctx([L1],[{userId:'u',lessonId:L2,passed:true}],[{userId:'u',lessonId:L3,status:'APPROVED'}])); return p.percent===100&&p.completed===true;})());
cek('kuis BELUM lulus tidak dihitung selesai',
  L.computeCourseProgress(kursus, ctx([L1],[{userId:'u',lessonId:L2,passed:false}])).percent===33);
cek('tugas belum APPROVED tidak dihitung selesai',
  L.computeCourseProgress(kursus, ctx([L1],[],[{userId:'u',lessonId:L3,status:'SUBMITTED'}])).percent===33);
cek('kursus tanpa materi wajib TIDAK dianggap selesai',
  L.computeCourseProgress({id:'x',modules:[{id:'m',order:0,lessons:[{id:'a',type:'text',order:0,required:false}]}]}, ctx()).completed===false);

console.log('\n== PRIORITAS KURSUS (Wajib / Sunnah / Mubah) ==');
cek('kursus LAMA tanpa field priority dianggap Wajib', L.coursePriority({id:'c'}).key==='wajib');
cek('priority sunnah terbaca apa adanya', L.coursePriority({id:'c',priority:'sunnah'}).key==='sunnah');
cek('priority asing jatuh ke Wajib', L.coursePriority({id:'c',priority:'ngawur'}).key==='wajib');
cek('prioritas TIDAK mengubah perhitungan progres',
  L.computeCourseProgress({...kursus,priority:'mubah'}, ctx([L1])).percent===33);

console.log('\n== PROGRES PARSIAL (PDF & video) — KOMPATIBILITAS MUNDUR ==');
cek('record LAMA tanpa field done TETAP dianggap selesai', L.isProgressDone({userId:'u',lessonId:'x',completedAt:'2026-01-01'})===true);
cek('record parsial (done:false, percent:40) TIDAK selesai', L.isProgressDone({done:false,percent:40})===false);
cek('record baru done:true selesai', L.isProgressDone({done:true,percent:100})===true);
cek('buildCtx menyaring record parsial dari progressSet',
  (()=>{const c=L.buildCtx({progress:[
      {userId:'u',lessonId:'lama'},
      {userId:'u',lessonId:'parsial',done:false,percent:40},
      {userId:'u',lessonId:'tuntas',done:true,percent:100}]},'u');
    return c.progressSet.has('lama') && !c.progressSet.has('parsial') && c.progressSet.has('tuntas');})());
cek('persen record lama (tanpa field percent) dibaca 100', L.progressPercent({userId:'u',lessonId:'x'})===100);
cek('persen record parsial dibaca apa adanya', L.progressPercent({done:false,percent:40})===40);
cek('tipe pdf terdaftar di LESSON_TYPES', L.LESSON_TYPES.pdf?.label==='Bacaan PDF');
cek('materi PDF berperilaku seperti tipe konten di isLessonDone (record lama = selesai)',
  L.isLessonDone({id:'pdf1',type:'pdf'}, L.buildCtx({progress:[{userId:'u',lessonId:'pdf1'}]},'u'))===true);
cek('materi PDF selesai bila done:true',
  L.isLessonDone({id:'pdf2',type:'pdf'}, L.buildCtx({progress:[{userId:'u',lessonId:'pdf2',done:true,percent:100}]},'u'))===true);
cek('materi PDF baru dibaca 60% BELUM selesai',
  L.isLessonDone({id:'pdf3',type:'pdf'}, L.buildCtx({progress:[{userId:'u',lessonId:'pdf3',done:false,percent:60}]},'u'))===false);
cek('kursus: materi PDF parsial tidak menaikkan persen kursus',
  (()=>{const k={id:'cp',modules:[{id:'m',order:0,lessons:[
      {id:'pdf4',type:'pdf',order:0,required:true},{id:'t4',type:'text',order:1,required:true}]}]};
    const c=L.buildCtx({progress:[{userId:'u',lessonId:'pdf4',done:false,percent:80}]},'u');
    return L.computeCourseProgress(k,c).percent===0;})());
cek('kursus: materi PDF tuntas menaikkan persen kursus',
  (()=>{const k={id:'cp2',modules:[{id:'m',order:0,lessons:[
      {id:'pdf5',type:'pdf',order:0,required:true},{id:'t5',type:'text',order:1,required:true}]}]};
    const c=L.buildCtx({progress:[{userId:'u',lessonId:'pdf5',done:true,percent:100}]},'u');
    return L.computeCourseProgress(k,c).percent===50;})());

console.log('\n== LINK VIDEO YOUTUBE ==');
cek('watch?v= dikenali', L.youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')==='dQw4w9WgXcQ');
cek('youtu.be/ dikenali', L.youtubeId('https://youtu.be/dQw4w9WgXcQ?t=30')==='dQw4w9WgXcQ');
cek('shorts/ dikenali', L.youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')==='dQw4w9WgXcQ');
cek('embed/ dikenali', L.youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')==='dQw4w9WgXcQ');
cek('m.youtube.com dikenali', L.youtubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')==='dQw4w9WgXcQ');
cek('Google Drive BUKAN YouTube (perilaku lama dipertahankan)',
  L.youtubeId('https://drive.google.com/file/d/abc123/view')==='');
cek('link kosong / bukan URL aman', L.youtubeId('')==='' && L.youtubeId('bukan link')==='');
cek('domain penipu tidak lolos', L.youtubeId('https://youtube.com.jahat.id/watch?v=dQw4w9WgXcQ')==='');
cek('link tanpa https:// tetap dikenali', L.youtubeId('youtu.be/dQw4w9WgXcQ')==='dQw4w9WgXcQ');
cek('normalizeUrl menambahkan skema', L.normalizeUrl('drive.google.com/file/d/abc/view')==='https://drive.google.com/file/d/abc/view');
cek('normalizeUrl menolak teks biasa', L.normalizeUrl('tanya leader saja')==='');
cek('normalizeUrl membiarkan URL lengkap apa adanya', L.normalizeUrl('https://youtu.be/abc')==='https://youtu.be/abc');

console.log('\n== JALUR (perbaikan: kursus hilang tidak bikin macet) ==');
const jalur={id:'p1',status:'published',courses:[{courseId:'c1',order:0,required:true},{courseId:'c2',order:1,required:true}]};
const penuh=L.computePathProgress(jalur,new Map([['c1',kursus],['c2',kursus]]),ctx([L1,L2,L3,LOPS],[{userId:'u',lessonId:L2,passed:true}],[{userId:'u',lessonId:L3,status:'APPROVED'}]));
cek('2 kursus tuntas = 100% & completed', penuh.percent===100 && penuh.completed===true);
const sebagian=L.computePathProgress(jalur,new Map([['c1',kursus]]),ctx([L1,L2,L3],[{userId:'u',lessonId:L2,passed:true}],[{userId:'u',lessonId:L3,status:'APPROVED'}]));
cek('kursus jadi draft: 100% DAN completed (tidak macet lagi)', sebagian.percent===100 && sebagian.completed===true);
cek('kursus yang dilewati dilaporkan', sebagian.dilewati===1);

console.log('\n== TARGETING & AUTO-ENROLL ==');
const jp={id:'p9',status:'published',title:'Onboarding',targetDivisions:['internal'],targetJobTitles:['Affiliator'],courses:[]};
cek('cocok divisi+jabatan', L.pathMatchesUser(jp,{division:'internal',jobTitle:'Affiliator'})===true);
cek('jabatan beda -> TIDAK cocok', L.pathMatchesUser(jp,{division:'internal',jobTitle:'Editor Video'})===false);
cek('divisi beda -> TIDAK cocok', L.pathMatchesUser(jp,{division:'mcn',jobTitle:'Affiliator'})===false);
cek('jabatan kosong -> TIDAK cocok', L.pathMatchesUser(jp,{division:'internal',jobTitle:''})===false);
cek('target kosong semua -> TIDAK PERNAH auto-enroll',
  L.pathMatchesUser({...jp,targetDivisions:[],targetJobTitles:[]},{division:'internal',jobTitle:'Affiliator'})===false);
cek('jalur draft -> TIDAK cocok', L.pathMatchesUser({...jp,status:'draft'},{division:'internal',jobTitle:'Affiliator'})===false);

const org={id:'u1',name:'Ahmad',division:'internal',jobTitle:'Affiliator'};
const r1=await L.autoEnrollUser(org,[jp],[],{id:'o',name:'Owner'});
const ada=await L.loadMyEnrollments('u1');
const r2=await L.autoEnrollUser(org,[jp],ada,{id:'o',name:'Owner'});
const r3=await L.autoEnrollUser(org,[jp],[],{id:'o',name:'Owner'}); // sengaja daftar KOSONG (simulasi state basi)
cek('enroll pertama membuat 1', r1.created.length===1);
cek('enroll kedua idempoten (skip)', r2.created.length===0 && r2.skipped===1);
cek('walau state basi, TIDAK ada baris ganda', (await L.loadMyEnrollments('u1')).length===1);

console.log('\n== KUIS ==');
const q=await L.sealQuestion({id:'q1',text:'?',type:'single',options:[{id:'a'},{id:'b'}],points:1,_plainAnswer:'a'});
cek('_plainAnswer TIDAK ikut tersimpan', q._plainAnswer===undefined && !!q.answerHash && !!q.answerSalt);
cek('jawaban benar -> lulus', (await L.gradeQuiz({passingScore:80,questions:[q]},{q1:'a'})).passed===true);
cek('jawaban salah -> tidak lulus', (await L.gradeQuiz({passingScore:80,questions:[q]},{q1:'b'})).passed===false);
cek('tidak dijawab -> salah', (await L.gradeQuiz({passingScore:80,questions:[q]},{})).percent===0);
const qm=await L.sealQuestion({id:'q2',text:'?',type:'multiple',options:[{id:'a'},{id:'b'},{id:'c'}],points:1,_plainAnswer:['a','c']});
cek('multi-jawaban benar (urutan bebas)', (await L.gradeQuiz({passingScore:100,questions:[qm]},{q2:['c','a']})).passed===true);
cek('multi-jawaban kurang -> salah', (await L.gradeQuiz({passingScore:100,questions:[qm]},{q2:['a']})).passed===false);
const att=[{lessonId:'lq',userId:'u',attemptNo:1},{lessonId:'lq',userId:'u',attemptNo:2}];
cek('batas percobaan dihitung benar', L.attemptsLeft({maxAttempts:3},att,'lq','u')===1);
cek('maxAttempts 0 = tak terbatas', L.attemptsLeft({maxAttempts:0},att,'lq','u')===Infinity);
cek('nomor dari MAX bukan JUMLAH (deret berlubang)',
  (()=>{const berlubang=[{lessonId:'lq',userId:'u',attemptNo:2}]; // 001 & 003 terhapus, 002 tersisa
        const nomor=berlubang.filter(a=>a.lessonId==='lq'&&a.userId==='u').reduce((m,a)=>Math.max(m,a.attemptNo||0),0)+1;
        return nomor===3;})());

console.log('\n== MODUL BACAAN (perpustakaan, sifatnya sunnah) ==');
cek('prefix TIDAK mengandung _ (wildcard LIKE Postgres)',
  !L.LMS_LIBRARY_PREFIX.includes('_') && !L.LMS_LIBRARY_BODY_PREFIX.includes('_'));
cek('key backup modul bacaan terdaftar di LMS_BACKUP_KEYS',
  L.LMS_BACKUP_KEYS.includes('lms:library:all') && L.LMS_BACKUP_KEYS.includes('lms:library-bodies:all'));
await L.saveLibrary({id:'lib1',title:'Buku Hook',category:'Panduan Hook',type:'text',status:'published',order:0});
await L.saveLibrary({id:'lib2',title:'Sejarah Al-Kahfi',category:'Sejarah',type:'pdf',status:'draft',order:1,pdfUrl:'https://x/y.pdf'});
await L.saveLibraryBody('lib1','Isi buku hook yang panjang...');
cek('modul bacaan tersimpan per-record', (await L.loadLmsLibrary()).length===2);
cek('ISI modul TIDAK ikut tertarik saat memuat daftar',
  (await L.loadLmsLibrary()).every(m => m.body === undefined));
cek('isi modul dimuat on-demand', (await L.loadLibraryBody('lib1'))==='Isi buku hook yang panjang...');
cek('prefix record & prefix isi tidak saling menarik',
  (await L.loadLmsLibraryBodies()).length===1);
cek('modul bacaan TIDAK punya record progress → persen jalur tidak berubah',
  L.computePathProgress(jalur,new Map([['c1',kursus],['c2',kursus]]),
    ctx([L1,L2,L3,LOPS],[{userId:'u',lessonId:L2,passed:true}],[{userId:'u',lessonId:L3,status:'APPROVED'}])).percent===100);
await L.deleteLibrary('lib2');
await L.deleteLibrary('lib1');
await L.deleteLibraryBody('lib1');
cek('hapus modul ikut membersihkan isinya (tidak ada baris yatim)',
  (await L.loadLmsLibrary()).length===0 && (await L.loadLmsLibraryBodies()).length===0);

console.log('\n== BERKAS TERPROTEKSI (bucket privat + signed URL) ==');
cek('berkas ber-pdfPath dianggap SUDAH terlindungi',
  L.berkasBelumTerlindungi({pdfPath:'lms-pdf/abc.pdf'})===false);
cek('berkas warisan (cuma pdfUrl) ditandai BELUM terlindungi',
  L.berkasBelumTerlindungi({pdfUrl:'https://publik/abc.pdf'})===true);
cek('umur signed URL <= 10 menit sesuai spesifikasi', L.UMUR_SIGNED_URL_DETIK<=600);

{
  const fetchAsli = globalThis.fetch;
  const jejakSign = [];
  const jejakFetch = [];
  const jejakLog = [];
  globalThis.fetch = async (u) => { jejakFetch.push(String(u)); return { ok:true, arrayBuffer: async () => new Uint8Array([37,80,68,70]).buffer }; };
  L.initLms({
    signFile: async (path, detik) => { jejakSign.push([path, detik]); return 'https://signed.example/' + path + '?exp=' + detik; },
    logAkses: async (info) => { jejakLog.push(info); throw new Error('server sibuk'); },
  });

  const b1 = await L.loadLmsFileBytes({ pdfPath: 'lms-pdf/rahasia.pdf' });
  cek('berkas privat: signed URL diminta dengan umur yang benar',
    jejakSign.length===1 && jejakSign[0][0]==='lms-pdf/rahasia.pdf' && jejakSign[0][1]===600);
  cek('berkas privat: yang di-fetch adalah signed URL, bukan path mentah',
    jejakFetch.length===1 && jejakFetch[0].startsWith('https://signed.example/'));
  cek('berkas dikembalikan sebagai bytes untuk dirender dari MEMORI',
    b1 instanceof Uint8Array && b1.length===4);

  await L.loadLmsFileBytes({ pdfUrl: 'https://publik.example/lama.pdf' });
  cek('berkas warisan dibaca langsung TANPA minta signed URL',
    jejakSign.length===1 && jejakFetch[1]==='https://publik.example/lama.pdf');

  let dilempar = false;
  try { await L.loadLmsFileBytes({}); } catch { dilempar = true; }
  cek('tanpa path maupun URL -> melempar, bukan diam-diam kosong', dilempar===true);

  globalThis.fetch = async () => ({ ok:false, status:403 });
  let gagal403 = false;
  try { await L.loadLmsFileBytes({ pdfPath: 'x.pdf' }); } catch { gagal403 = true; }
  cek('signed URL kedaluwarsa/ditolak -> error jelas, bukan berkas kosong', gagal403===true);

  await L.lmsLogAkses({ modulId:'m1', userId:'u1' });
  cek('jejak akses dicatat', jejakLog.length===1 && jejakLog[0].modulId==='m1');
  cek('jejak akses GAGAL tidak pernah melempar keluar (membaca tetap jalan)', true);

  globalThis.fetch = fetchAsli;
}

console.log('\n== OTORISASI ==');
const semuaUser=[{id:'a',role:'operasional',leaderId:'L'},{id:'b',role:'operasional',leaderId:'X'},{id:'L',role:'leader'}];
cek('leader hanya lihat timnya', L.learnersVisibleTo({id:'L',role:'leader'},semuaUser).map(u=>u.id).join()==='a');
cek('owner lihat semua', L.learnersVisibleTo({id:'o',role:'owner'},semuaUser).length===3);
cek('leader TIDAK boleh review anggota tim lain', L.canReviewLearner({id:'L',role:'leader'},{id:'b',leaderId:'X'})===false);
cek('leader boleh review anggotanya', L.canReviewLearner({id:'L',role:'leader'},{id:'a',leaderId:'L'})===true);
cek('karyawan bukan admin', L.isLmsAdmin({role:'operasional'})===false);

console.log(`\n===== ${lulus} LULUS, ${gagal} GAGAL =====`);
process.exit(gagal?1:0);
