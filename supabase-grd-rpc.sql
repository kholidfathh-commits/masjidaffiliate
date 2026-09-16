-- ============================================================
-- GRD (Goal Roll Down) — JALUR RPC untuk tulis goal
-- Cara pakai: Supabase dashboard -> SQL Editor -> New Query -> paste -> RUN.
-- Aman dijalankan berkali-kali (idempoten).
-- ============================================================
--
-- ⚠️ BACA DULU — JANGAN DIJALANKAN KALAU BELUM PAHAM AKIBATNYA
--
-- Aplikasi ini BELUM memakai Supabase Auth. Artinya setiap permintaan datang
-- dengan kunci `anon` yang sama, dan `auth.uid()` di bawah bernilai NULL untuk
-- SEMUA pengguna. Selama itu masih terjadi, fungsi di sini TIDAK BISA
-- membedakan siapa yang memanggil, jadi ia TIDAK menambah keamanan apa pun.
--
-- Lalu kenapa dibuat sekarang? Supaya JALURNYA sudah ada. Aplikasi menulis goal
-- lewat `grd_simpan_goal` bila fungsi ini terpasang, dan menulis langsung ke
-- kv_store bila belum. Begitu Supabase Auth diaktifkan nanti, aturan akses
-- cukup diketatkan DI SINI — tampilan dan kode aplikasi tidak perlu disentuh
-- sama sekali. Itu yang disepakati di PRD sebagai "Opsi B".
--
-- Ringkasnya:
--   · Belum menjalankan file ini  -> aplikasi jalan normal (tulis langsung).
--   · Sudah menjalankan file ini  -> aplikasi lewat sini, hasilnya sama persis.
--   · Nanti setelah Auth aktif    -> ketatkan bagian bertanda "PAGAR SESUNGGUHNYA".
--
-- Pagar yang BERLAKU SEKARANG hanya di aplikasi (src/grd/data.js +
-- src/peran/hierarki.js). Itu pagar PRODUK, bukan pagar kriptografis — sama
-- seperti seluruh modul lain di app ini.
-- ============================================================

-- ============================================================
-- HELPER: boleh menulis data milik siapa?
-- ============================================================
-- Salinan aturan `bolehTulisMilik()` dari src/grd/data.js, dalam SQL.
--
-- Menyalin logika memang tidak ideal, tapi RLS menuntutnya: server tidak bisa
-- memanggil JavaScript. Yang bisa dilakukan adalah membuat salinannya SEKECIL
-- mungkin dan menaruhnya di SATU tempat — helper ini dipakai bersama oleh semua
-- fungsi tulis, bukan diulang di masing-masing.
--
-- JAGA TETAP SINKRON dengan bolehTulisMilik() di src/grd/data.js.
-- Aturannya: pemilik sendiri, ATAU Owner/Manajer, ATAU siapa pun di atasnya
-- dalam rantai `leaderId` (berjenjang, bukan satu lapis).
--
-- Mengembalikan TRUE bila auth.uid() NULL — artinya Supabase Auth belum aktif,
-- dan pada keadaan itu wewenang masih ditegakkan aplikasi. Begitu Auth hidup,
-- fungsi ini langsung menggigit tanpa perlu mengubah satu baris pun di aplikasi.
create or replace function public.grd_boleh_tulis(p_owner_id text)
returns boolean
language plpgsql
stable
security invoker
as $$
declare
  v_me text;
  v_role text;
begin
  v_me := auth.uid()::text;
  if v_me is null then
    return true;   -- Auth belum aktif: aplikasi yang menjaga
  end if;
  if p_owner_id is null or p_owner_id = '' then
    return false;  -- data rusak: tidak ada yang boleh menulisinya
  end if;
  if v_me = p_owner_id then
    return true;
  end if;

  select u->>'role' into v_role
  from (
    select jsonb_array_elements(value) as u
    from public.kv_store where key = 'users:list'
  ) a
  where u->>'id' = v_me;

  if v_role in ('owner', 'manajer') then
    return true;
  end if;

  return exists (
    with recursive anggota as (
      select jsonb_array_elements(value) as u
      from public.kv_store where key = 'users:list'
    ),
    bawahan as (
      select (u->>'id') as id from anggota where u->>'leaderId' = v_me
      union
      select (a.u->>'id') from anggota a join bawahan b on a.u->>'leaderId' = b.id
    )
    select 1 from bawahan where id = p_owner_id
  );
end;
$$;

grant execute on function public.grd_boleh_tulis(text) to anon, authenticated;

-- 1. Simpan (buat/ubah) satu goal.
create or replace function public.grd_simpan_goal(p_goal jsonb)
returns jsonb
language plpgsql
security invoker            -- sengaja INVOKER, bukan DEFINER: jangan beri hak
                            -- lebih besar daripada pemanggilnya selama Auth belum aktif.
as $$
declare
  v_id text;
begin
  -- Bentuk data diperiksa di server juga, bukan hanya di formulir.
  v_id := p_goal->>'id';
  if v_id is null or v_id = '' then
    raise exception 'Goal harus punya id.';
  end if;
  if coalesce(p_goal->>'ownerId', '') = '' then
    raise exception 'Goal harus punya pemilik.';
  end if;
  if coalesce(p_goal->>'description', '') = '' then
    raise exception 'Deskripsi goal wajib diisi.';
  end if;
  if coalesce(p_goal->>'uom', '') = '' then
    raise exception 'Satuan (uom) wajib diisi.';
  end if;
  if (p_goal->>'base')::numeric = (p_goal->>'target')::numeric then
    raise exception 'Target tidak boleh sama dengan base.';
  end if;
  if p_goal->>'periode' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     and p_goal->>'periode' !~ '^[0-9]{4}-Q[1-4]$' then
    raise exception 'Periode wajib berupa bulan (YYYY-MM) atau kuartal (YYYY-Qn).';
  end if;

  -- === PAGAR SESUNGGUHNYA (aktifkan setelah Supabase Auth hidup) =============
  -- Selama auth.uid() masih NULL, blok ini sengaja dilewati — kalau tidak,
  -- SEMUA penyimpanan akan ditolak dan fitur goal mati total.
  -- Setelah Auth aktif, ganti `if auth.uid() is not null then` di bawah dengan
  -- pemeriksaan penuh: pemanggil harus pemilik goal ATAU atasannya (berjenjang,
  -- dibaca dari baris 'users:list' di kv_store).
  if not public.grd_boleh_tulis(p_goal->>'ownerId') then
    raise exception 'Anda tidak berwenang mengubah goal milik orang itu.';
  end if;
  -- ==========================================================================

  insert into public.kv_store (key, value, updated_at)
  values ('grdgoal:rec:' || v_id, p_goal, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return p_goal;
end;
$$;

-- 2. Hapus satu goal. Turunannya TIDAK ikut terhapus — hanya rantainya terputus,
--    persis seperti yang dijelaskan pada konfirmasi hapus di aplikasi.
create or replace function public.grd_hapus_goal(p_id text)
returns boolean
language plpgsql
security invoker
as $$
begin
  if p_id is null or p_id = '' then
    raise exception 'Id goal kosong.';
  end if;

  -- === PAGAR SESUNGGUHNYA (aktifkan setelah Supabase Auth hidup) =============
  -- Pemiliknya dibaca dari baris goalnya SENDIRI, bukan dari argumen — kalau
  -- dari argumen, pemanggil tinggal mengaku sebagai pemilik mana pun.
  if not public.grd_boleh_tulis((
    select value->>'ownerId' from public.kv_store where key = 'grdgoal:rec:' || p_id
  )) then
    raise exception 'Anda tidak berwenang menghapus goal itu.';
  end if;
  -- ==========================================================================

  delete from public.kv_store where key = 'grdgoal:rec:' || p_id;
  return true;
end;
$$;

-- 3. Izinkan pemanggilan dari aplikasi.
grant execute on function public.grd_simpan_goal(jsonb) to anon, authenticated;
grant execute on function public.grd_hapus_goal(text)  to anon, authenticated;

-- ============================================================
-- LEAD MEASURE & SCOREBOARD
-- Ditambahkan supaya JALUR-nya lengkap: aplikasi memakai fungsi ini bila
-- terpasang, dan menulis langsung ke kv_store bila belum. Batasan yang sama
-- berlaku — sebelum Supabase Auth aktif, auth.uid() NULL dan blok "PAGAR
-- SESUNGGUHNYA" di bawah sengaja dilewati.
-- ============================================================

-- 4. Simpan (usul/nilai) satu lead measure.
create or replace function public.grd_simpan_lead(p_lead jsonb)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_id text;
  v_goal text;
begin
  v_id := p_lead->>'id';
  v_goal := p_lead->>'goalId';
  if coalesce(v_id, '') = '' then
    raise exception 'Lead measure harus punya id.';
  end if;
  if coalesce(v_goal, '') = '' then
    raise exception 'Lead measure harus menempel pada sebuah goal.';
  end if;
  if coalesce(p_lead->>'ownerId', '') = '' then
    raise exception 'Lead measure harus punya pemilik.';
  end if;
  if coalesce(p_lead->>'description', '') = '' then
    raise exception 'Tulis tindakan mingguannya.';
  end if;
  if coalesce((p_lead->>'targetMingguan')::numeric, 0) <= 0 then
    raise exception 'Target mingguan harus lebih dari nol.';
  end if;
  if coalesce(p_lead->>'status', '') not in ('usul', 'aktif', 'perbaiki', 'ditolak') then
    raise exception 'Status lead measure tidak dikenal.';
  end if;

  -- Batas 1-3 AKTIF per goal ditegakkan di server juga, bukan hanya di aplikasi:
  -- dua atasan bisa menyetujui hampir bersamaan, dan hanya server yang melihat
  -- keduanya.
  if p_lead->>'status' = 'aktif' then
    if (
      select count(*) from public.kv_store
      where key like 'grdlead:rec:' || v_goal || ':%'
        and value->>'status' = 'aktif'
        and value->>'id' <> v_id
    ) >= 3 then
      raise exception 'Goal ini sudah punya 3 lead measure aktif — batasnya 3.';
    end if;
  end if;

  -- === PAGAR SESUNGGUHNYA (aktifkan setelah Supabase Auth hidup) =============
  if not public.grd_boleh_tulis(p_lead->>'ownerId') then
    raise exception 'Anda tidak berwenang mengubah lead measure milik orang itu.';
  end if;
  -- MENILAI beda dari mengubah: pengusul tidak boleh menilai usulannya sendiri.
  if auth.uid() is not null
     and p_lead->>'status' in ('aktif', 'ditolak', 'perbaiki')
     and auth.uid()::text = p_lead->>'ownerId' then
    raise exception 'Anda tidak bisa menilai usulan Anda sendiri.';
  end if;
  -- ==========================================================================

  insert into public.kv_store (key, value, updated_at)
  values ('grdlead:rec:' || v_goal || ':' || v_id, p_lead, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return p_lead;
end;
$$;

-- 5. Simpan satu skor mingguan.
create or replace function public.grd_simpan_skor(p_skor jsonb)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_id text;
begin
  v_id := p_skor->>'id';
  if coalesce(v_id, '') = '' then
    raise exception 'Skor harus punya id.';
  end if;
  if coalesce(p_skor->>'leadId', '') = '' then
    raise exception 'Skor harus menempel pada sebuah lead measure.';
  end if;
  -- Kunci minggu wajib tanggal Senin (YYYY-MM-DD); bentuknya diperiksa di sini
  -- supaya baris dengan minggu ngawur tidak pernah masuk.
  if p_skor->>'minggu' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Minggu tidak sah.';
  end if;
  if extract(isodow from (p_skor->>'minggu')::date) <> 1 then
    raise exception 'Kunci minggu harus tanggal Senin.';
  end if;
  if coalesce((p_skor->>'nilai')::numeric, 0) < 0 then
    raise exception 'Angka tidak boleh minus.';
  end if;
  if coalesce((p_skor->>'target')::numeric, 0) <= 0 then
    raise exception 'Target mingguan tidak sah.';
  end if;

  -- === PAGAR SESUNGGUHNYA (aktifkan setelah Supabase Auth hidup) =============
  if not public.grd_boleh_tulis(p_skor->>'ownerId') then
    raise exception 'Anda tidak berwenang mengisi skor milik orang itu.';
  end if;
  -- ==========================================================================

  insert into public.kv_store (key, value, updated_at)
  values ('grdskor:rec:' || v_id, p_skor, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return p_skor;
end;
$$;

grant execute on function public.grd_simpan_lead(jsonb) to anon, authenticated;
grant execute on function public.grd_simpan_skor(jsonb) to anon, authenticated;

-- ============================================================
-- BACA GOAL (opsional, untuk menghemat data terkirim)
-- ============================================================
-- Kenapa ada, padahal aplikasi sudah bisa membaca kv_store langsung:
--   Membaca prefix `grdgoal:rec:` menarik SELURUH goal seluruh tim, lalu
--   aplikasi menyaringnya di memori. Fungsi ini menyaring PERIODE di server,
--   jadi yang terkirim hanya baris yang memang dipakai. Egress project ini
--   pernah kehabisan kuota, jadi itu bukan penghematan yang sepele.
--
-- Penyaringan PER PERAN sengaja BELUM dipasang di sini. Selama auth.uid()
-- masih NULL, server tidak tahu siapa yang memanggil — menyaring berdasarkan
-- id yang dikirim klien bukan pengamanan, karena klien bisa mengirim id siapa
-- saja. Jadi hak lihat tetap ditegakkan aplikasi (src/grd/data.js), dan
-- kerangkanya disiapkan di bawah untuk diisi setelah Auth aktif.
create or replace function public.grd_baca_goal(p_periode text default null)
returns setof jsonb
language plpgsql
stable
security invoker
as $$
begin
  -- === PAGAR SESUNGGUHNYA (aktifkan setelah Supabase Auth hidup) =============
  -- Setelah Auth aktif, tambahkan di sini: batasi hasil ke goal milik auth.uid(),
  -- goal bawahannya (rekursif lewat leaderId di baris 'users:list'), dan goal
  -- atasannya ke atas. Aturannya harus SAMA dengan bisaLihatGoal() di
  -- src/grd/data.js — kalau berbeda, layar dan server akan saling membantah.
  if auth.uid() is not null then
    null;
  end if;
  -- ==========================================================================

  return query
  select value
  from public.kv_store
  where key like 'grdgoal:rec:%'
    and (
      p_periode is null
      or value->>'periode' = p_periode
      -- Goal bulanan ikut tertarik oleh kuartal yang memuatnya, sama seperti
      -- periodeSepadan() di aplikasi.
      or (
        p_periode ~ '^[0-9]{4}-Q[1-4]$'
        and value->>'periode' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
        and left(value->>'periode', 4) = left(p_periode, 4)
        and ceil(substring(value->>'periode' from 6 for 2)::numeric / 3) = substring(p_periode from 7 for 1)::numeric
      )
    )
  order by key;
end;
$$;

grant execute on function public.grd_baca_goal(text) to anon, authenticated;
