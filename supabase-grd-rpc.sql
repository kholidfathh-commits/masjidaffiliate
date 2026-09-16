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
  if auth.uid() is not null then
    -- TODO(setelah Auth): tegakkan "pemilik atau atasannya" di sini.
    null;
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
  if auth.uid() is not null then
    -- TODO(setelah Auth): tegakkan "pemilik atau atasannya" di sini.
    null;
  end if;
  -- ==========================================================================

  delete from public.kv_store where key = 'grdgoal:rec:' || p_id;
  return true;
end;
$$;

-- 3. Izinkan pemanggilan dari aplikasi.
grant execute on function public.grd_simpan_goal(jsonb) to anon, authenticated;
grant execute on function public.grd_hapus_goal(text)  to anon, authenticated;
