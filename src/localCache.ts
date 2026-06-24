// Local autosave so a half-finished audit survives an accidental tab close.
// Stays on the user's own device (same trust level as the in-memory app), so it
// holds plaintext JSON; the cloud copy (supabaseSync) is encrypted instead.
const KEY = 'discarding-audit-session';

export function saveLocal(json: string): void {
  try { localStorage.setItem(KEY, json); } catch { /* storage full / disabled */ }
}
export function loadLocal(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function clearLocal(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Remember the sync code on this device so auto cloud-sync keeps working after a
// reload (it's the encryption passphrase — same on-device trust as the cache above).
const CODE_KEY = 'discarding-audit-sync-code';
export function saveCode(code: string): void {
  try { localStorage.setItem(CODE_KEY, code); } catch { /* ignore */ }
}
export function loadCode(): string {
  try { return localStorage.getItem(CODE_KEY) ?? ''; } catch { return ''; }
}
