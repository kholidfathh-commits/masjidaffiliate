import fs from 'fs';
const src = fs.readFileSync('/Users/kholidfath_/Documents/GitHub/masjidaffiliate/src/App.jsx','utf8');

// Ambil fungsi canSeeTask APA ADANYA dari file (bukan salinan manual).
const mSee = src.match(/canSeeTask:\s*(\(viewer, task\)\s*=>\s*\{[\s\S]*?\n  \}),/);
if (!mSee) throw new Error('canSeeTask tidak ketemu');
const canSeeTask = eval('(' + mSee[1] + ')');

// Ambil badan assignableUsers APA ADANYA.
const mAssign = src.match(/const assignableUsers = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[user, allUsers\]\);/);
if (!mAssign) throw new Error('assignableUsers tidak ketemu');
const assignableUsers = new Function('user','allUsers', mAssign[1]);

// Ambil canAccessFeature + DIVISION_FEATURES.
const mDF = src.match(/const DIVISION_FEATURES = \{[\s\S]*?\n\};/);
const mCAF = src.match(/function canAccessFeature\(user, feature\) \{[\s\S]*?\n\}/);
const canAccessFeature = new Function(mDF[0] + '\n' + mCAF[0] + '\nreturn canAccessFeature;')();

let ok=0, bad=0;
const cek=(n,c)=>{ if(c){ok++;console.log('  LULUS  ',n);} else {bad++;console.log('  GAGAL  ',n);} };

const CEO   = { id:'ceo', role:'owner',       division:'manajemen' };
const MGR   = { id:'mgr', role:'manajer',     division:'manajemen' };
const LMCN  = { id:'lmcn',role:'leader',      division:'mcn' };
const LTAP  = { id:'ltap',role:'leader',      division:'tap' };
const SMCN  = { id:'smcn',role:'operasional', division:'mcn',      leaderId:'lmcn' };
const SMCN2 = { id:'smcn2',role:'operasional',division:'mcn',      leaderId:'lmcn' };
const SAFF  = { id:'saff',role:'operasional', division:'internal', leaderId:'ltap' };
const SEMUA = [CEO,MGR,LMCN,LTAP,SMCN,SMCN2,SAFF];

console.log('\n== 1. MENU KEPUASAN MITRA ==');
cek('MCN staf: BOLEH',            canAccessFeature(SMCN,'partner-feedback')===true);
cek('TAP leader: BOLEH',          canAccessFeature(LTAP,'partner-feedback')===true);
cek('CEO: BOLEH',                 canAccessFeature(CEO,'partner-feedback')===true);
cek('Manajer: BOLEH',             canAccessFeature(MGR,'partner-feedback')===true);
cek('Affiliator internal: TIDAK', canAccessFeature(SAFF,'partner-feedback')===false);
cek('Divisi Mabit: TIDAK',        canAccessFeature({role:'leader',division:'mabit'},'partner-feedback')===false);
cek('Divisi MMC/event: TIDAK',    canAccessFeature({role:'operasional',division:'event'},'partner-feedback')===false);
cek('fitur lama tak berubah (TAP tetap punya sellers)', canAccessFeature(LTAP,'sellers')===true);
cek('fitur lama tak berubah (MCN tetap TANPA sellers)', canAccessFeature(SMCN,'sellers')===false);

console.log('\n== 2. VISIBILITAS TIKET ==');
const tiketMgrKeSmcn = { createdById:'mgr', assigneeId:'smcn' };
cek('PIC melihat tiketnya',                 canSeeTask(SMCN,  tiketMgrKeSmcn)===true);
cek('pemberi tugas melihat tiketnya',       canSeeTask(MGR,   tiketMgrKeSmcn)===true);
cek('CEO melihat semua',                    canSeeTask(CEO,   tiketMgrKeSmcn)===true);
cek('rekan sedivisi TIDAK melihat',         canSeeTask(SMCN2, tiketMgrKeSmcn)===false);
cek('LEADER-nya PIC TIDAK melihat (aturan baru)', canSeeTask(LMCN, tiketMgrKeSmcn)===false);
cek('leader divisi lain TIDAK melihat',     canSeeTask(LTAP,  tiketMgrKeSmcn)===false);
const tiketLmcnKeSmcn = { createdById:'lmcn', assigneeId:'smcn' };
cek('leader melihat tiket yang DIA berikan', canSeeTask(LMCN, tiketLmcnKeSmcn)===true);
cek('tiket lama tanpa pemberi tugas: PIC tetap lihat', canSeeTask(SMCN,{assigneeId:'smcn'})===true);
cek('tiket lama tanpa pemberi tugas: orang lain tidak', canSeeTask(SMCN2,{assigneeId:'smcn'})===false);

console.log('\n== 3. SIAPA BOLEH DITUGASI ==');
const id = (arr)=>arr.map(u=>u.id).sort().join(',');
cek('CEO -> semua orang',        id(assignableUsers(CEO,SEMUA))===id(SEMUA));
cek('Manajer -> semua orang',    id(assignableUsers(MGR,SEMUA))===id(SEMUA));
cek('Leader MCN -> diri + bawahannya saja', id(assignableUsers(LMCN,SEMUA))==='lmcn,smcn,smcn2');
cek('Leader MCN TIDAK bisa ke staf leader lain', !assignableUsers(LMCN,SEMUA).some(u=>u.id==='saff'));
cek('Leader MCN TIDAK bisa ke leader lain',      !assignableUsers(LMCN,SEMUA).some(u=>u.id==='ltap'));
cek('Leader TAP -> diri + bawahannya (saff)',    id(assignableUsers(LTAP,SEMUA))==='ltap,saff');
cek('Karyawan -> hanya dirinya',                 id(assignableUsers(SMCN,SEMUA))==='smcn');

console.log(`\n===== ${ok} LULUS, ${bad} GAGAL =====`);
process.exit(bad?1:0);
