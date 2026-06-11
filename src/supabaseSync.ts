import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { encryptString, decryptString, rowId } from './crypto';

// Optional cross-device sync via the user's own Supabase project (no login).
// Only ciphertext leaves the browser; the row id is a one-way hash of the sync
// code. Configure VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const syncConfigured = Boolean(URL && ANON);
const client: SupabaseClient | null = syncConfigured ? createClient(URL!, ANON!) : null;

const TABLE = 'audit_sessions';

// Encrypt `json` under `code` and upsert it keyed by hash(code).
export async function saveSession(code: string, json: string): Promise<void> {
  if (!client) throw new Error('Sync is not configured (missing Supabase env vars).');
  const id = await rowId(code);
  const data = await encryptString(json, code);
  const { error } = await client.from(TABLE).upsert({ id, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// Fetch and decrypt the session for `code`, or null if none exists.
export async function loadSession(code: string): Promise<string | null> {
  if (!client) throw new Error('Sync is not configured (missing Supabase env vars).');
  const id = await rowId(code);
  const { data, error } = await client.from(TABLE).select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return decryptString(data.data as string, code);  // throws on wrong code (auth tag mismatch)
}
