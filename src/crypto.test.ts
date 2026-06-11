// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { encryptString, decryptString, rowId } from './crypto';

describe('client-side encryption', () => {
  it('round-trips plaintext with the correct code', async () => {
    const payload = JSON.stringify({ pid: 'M: 123', secret: 'PHI ąé' });
    const ct = await encryptString(payload, 'my-sync-code');
    expect(ct).not.toContain('PHI');                 // ciphertext, not plaintext
    expect(await decryptString(ct, 'my-sync-code')).toBe(payload);
  });

  it('fails to decrypt with the wrong code', async () => {
    const ct = await encryptString('hello', 'code-A');
    await expect(decryptString(ct, 'code-B')).rejects.toBeTruthy();
  });

  it('rowId is deterministic and code-specific', async () => {
    expect(await rowId('abc')).toBe(await rowId('abc'));
    expect(await rowId('abc')).not.toBe(await rowId('abd'));
  });
});
