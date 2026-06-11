-- Schema for the optional cross-device sync of the Discarding Audit Builder.
-- Run this once in your Supabase project (SQL editor).
--
-- SECURITY NOTE: this project is used WITHOUT login. The `data` column only ever
-- holds CLIENT-SIDE-ENCRYPTED ciphertext (AES-GCM, key derived from the user's
-- sync code), and `id` is a one-way hash of that code — so a leak of the anon key
-- exposes only ciphertext, not patient data. Do NOT store plaintext PHI here.

create table if not exists public.audit_sessions (
  id          text primary key,           -- hash(sync code)
  data        text not null,              -- base64 ciphertext (salt|iv|cipher)
  updated_at  timestamptz not null default now()
);

alter table public.audit_sessions enable row level security;

-- No-auth access: the anon role may read/write rows. Knowledge of the (hashed)
-- id is required to fetch a specific row; contents stay encrypted regardless.
drop policy if exists "anon read"   on public.audit_sessions;
drop policy if exists "anon write"  on public.audit_sessions;
drop policy if exists "anon update" on public.audit_sessions;
create policy "anon read"   on public.audit_sessions for select using (true);
create policy "anon write"  on public.audit_sessions for insert with check (true);
create policy "anon update" on public.audit_sessions for update using (true) with check (true);
