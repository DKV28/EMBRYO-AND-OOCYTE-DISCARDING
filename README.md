# Discarding Audit Builder

Client-side web app: converts Tâm Anh `TA2.HSBA.267` embryo-destruction PDFs into
the discarding-audit Excel. All parsing happens in the browser — no upload.

## Develop
    npm install
    npm run dev

## Test
    npm test    # golden-master e2e runs only when samples/ PDFs are present

## Build
    npm run build   # static output in dist/

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for design & plan.
Patient sample files live in `samples/` and are git-ignored (PHI).
