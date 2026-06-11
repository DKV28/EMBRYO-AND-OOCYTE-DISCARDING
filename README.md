# Discarding Audit Builder

Client-side web app: converts Tâm Anh `TA2.HSBA.267` / `266` destruction PDFs into
the `Monitoring_Discarding audit` Excel and a Word audit report. All parsing happens
in the browser — no upload (except the optional, encrypted cloud sync below).

## Workflow
- **Before audit day:** drop the PDFs, review the preview.
- **On audit day:** fill the compliance dropdowns (Storage / CF / Discarding /
  Signatures), then **Download Excel** and/or **Download Word report**.
- Work autosaves to this browser; use the **cloud sync** to continue on another device.

## Develop
    npm install
    npm run dev

## Test
    npm test    # golden-master e2e runs only when samples/ PDFs are present

## Build
    npm run build   # static output in dist/

## Optional cross-device sync (Supabase)
Lets you prepare data on one device and finish the audit on another. **Off by
default** — the app works fully without it.

1. Create a Supabase project; run `docs/supabase-schema.sql` in its SQL editor.
2. Copy `.env.example` → `.env` and set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. In the app, pick a **sync code** and use *Save to cloud* / *Load from cloud*
   (same code on every device).

**Security:** the project uses no login, so the cloud is treated as untrusted —
each session is **encrypted in the browser** (AES-GCM, key derived from your sync
code) and stored under a one-way hash of that code. The cloud only ever holds
ciphertext; without the sync code it cannot be decrypted. Still, keep the code
secret and the Supabase project private. The local autosave (this browser) holds
plaintext, same as the in-memory app.

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for design & plan.
Patient sample files live in `samples/` and are git-ignored (PHI).
