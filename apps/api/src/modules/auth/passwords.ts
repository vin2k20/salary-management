import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 defaults to Argon2id with 19 MiB of memory, two passes and one thread, the
// OWASP recommendation. The tests check the $argon2id$ prefix, so a change of default is caught.

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** True when the password matches the hash. A missing or malformed hash never matches. */
export async function verifyPassword(passwordHash: string | null, password: string) {
  if (passwordHash === null) return false;
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
