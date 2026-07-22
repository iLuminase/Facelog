import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  if (/^[a-f0-9]{40}$/i.test(storedHash)) {
    const legacy = createHash('sha1').update(password).digest();
    return timingSafeEqual(legacy, Buffer.from(storedHash, 'hex'));
  }
  const [algorithm, salt, encoded] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(encoded, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function isLegacyPasswordHash(storedHash: string) {
  return /^[a-f0-9]{40}$/i.test(storedHash);
}
