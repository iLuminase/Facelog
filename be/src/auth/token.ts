import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export type AuthRole = 'SUPER_ADMIN' | 'HR_MANAGER' | 'HR_STAFF' | 'SECURITY' | 'EMPLOYEE';
export type AuthPayload = { userId: number; username: string; role: AuthRole; exp: number };

function encode(value: string) {
  return Buffer.from(value).toString('base64url');
}

function signature(content: string) {
  return createHmac('sha256', env.AUTH_SECRET).update(content).digest('base64url');
}

export function createAuthToken(payload: Omit<AuthPayload, 'exp'>) {
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + env.AUTH_TOKEN_TTL_SECONDS }));
  const content = `${header}.${body}`;
  return `${content}.${signature(content)}`;
}

export function verifyAuthToken(token: string): AuthPayload | null {
  const [header, body, suppliedSignature] = token.split('.');
  if (!header || !body || !suppliedSignature) return null;
  const expected = Buffer.from(signature(`${header}.${body}`));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as AuthPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
}
