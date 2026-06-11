// Client-side encryption for the optional Supabase sync. Because the Supabase
// project has no login, the cloud must never see plaintext PHI: we encrypt with a
// key derived from the user's "sync code" (a passphrase) and store only ciphertext.
// The lookup id is a one-way hash of the code, so the code itself is never sent.

const PBKDF2_ITERS = 150_000;

// WebCrypto wants BufferSource; TS 5.7's stricter typed-array generics reject a
// plain Uint8Array view. These byte arrays are always ArrayBuffer-backed.
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;
const enc = (s: string) => bs(new TextEncoder().encode(s));

function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bs(salt), iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

// Returns base64 of salt(16) | iv(12) | ciphertext.
export async function encryptString(plaintext: string, code: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, key, enc(plaintext)));
  const out = new Uint8Array(salt.length + iv.length + ct.length);
  out.set(salt, 0); out.set(iv, salt.length); out.set(ct, salt.length + iv.length);
  return toB64(out);
}

export async function decryptString(payload: string, code: string): Promise<string> {
  const bytes = fromB64(payload);
  const salt = bytes.slice(0, 16), iv = bytes.slice(16, 28), ct = bytes.slice(28);
  const key = await deriveKey(code, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(iv) }, key, bs(ct));
  return new TextDecoder().decode(pt);
}

// One-way row key for Supabase lookup — never reveals the code.
export async function rowId(code: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc('audit-session:' + code));
  return toHex(new Uint8Array(h));
}
