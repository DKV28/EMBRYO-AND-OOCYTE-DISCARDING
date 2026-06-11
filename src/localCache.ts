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
