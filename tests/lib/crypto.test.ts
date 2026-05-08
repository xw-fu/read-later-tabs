import { describe, it, expect } from 'vitest';
import { encryptString, decryptString, generateInstallKey } from '../../src/lib/crypto';

describe('crypto', () => {
  it('roundtrips a plaintext string', async () => {
    const key = await generateInstallKey();
    const cipher = await encryptString('sk-test-1234', key);
    expect(cipher).not.toContain('sk-test-1234');
    const plain = await decryptString(cipher, key);
    expect(plain).toBe('sk-test-1234');
  });

  it('different keys produce different ciphertexts', async () => {
    const k1 = await generateInstallKey();
    const k2 = await generateInstallKey();
    const c1 = await encryptString('hello', k1);
    const c2 = await encryptString('hello', k2);
    expect(c1).not.toBe(c2);
  });

  it('decrypt with wrong key throws', async () => {
    const k1 = await generateInstallKey();
    const k2 = await generateInstallKey();
    const cipher = await encryptString('hi', k1);
    await expect(decryptString(cipher, k2)).rejects.toThrow();
  });
});
