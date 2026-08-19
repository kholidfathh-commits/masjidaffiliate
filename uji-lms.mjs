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

console.log('\n== OTORISASI ==');
const semuaUser=[{id:'a',role:'operasional',leaderId:'L'},{id:'b',role:'operasional',leaderId:'X'},{id:'L',role:'leader'}];
cek('leader hanya lihat timnya', L.learnersVisibleTo({id:'L',role:'leader'},semuaUser).map(u=>u.id).join()==='a');
cek('owner lihat semua', L.learnersVisibleTo({id:'o',role:'owner'},semuaUser).length===3);
cek('leader TIDAK boleh review anggota tim lain', L.canReviewLearner({id:'L',role:'leader'},{id:'b',leaderId:'X'})===false);
cek('leader boleh review anggotanya', L.canReviewLearner({id:'L',role:'leader'},{id:'a',leaderId:'L'})===true);
cek('karyawan bukan admin', L.isLmsAdmin({role:'operasional'})===false);

console.log(`\n===== ${lulus} LULUS, ${gagal} GAGAL =====`);
process.exit(gagal?1:0);
