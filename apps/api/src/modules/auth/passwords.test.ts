import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.ts';

describe('passwords', () => {
  it('hashes with Argon2id and a random salt', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');

    expect(first).toMatch(/^\$argon2id\$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('correct horse');
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'Correct horse battery staple')).resolves.toBe(false);
  });

  it('treats a missing or malformed hash as a wrong password', async () => {
    await expect(verifyPassword(null, 'anything')).resolves.toBe(false);
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
  });
});
