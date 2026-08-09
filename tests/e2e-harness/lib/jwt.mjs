/**
 * Minimal HS256 JWT sign/verify, built on node:crypto so the harness adds no
 * dependency. Token shape mirrors the claims GoTrue issues, because
 * `@supabase/supabase-js` decodes `exp` off the access token to decide when
 * to refresh a session.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const JWT_SECRET =
  process.env.HARNESS_JWT_SECRET ?? 'volt-e2e-harness-super-secret-jwt-token-with-at-least-32-characters';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function sign(payload, { expiresIn = 3600, issuedAt: fixedIat } = {}) {
  const issuedAt = fixedIat ?? Math.floor(Date.now() / 1000);
  const body = { iat: issuedAt, exp: issuedAt + expiresIn, ...payload };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify(body));
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${claims}`).digest('base64url');
  return { token: `${header}.${claims}.${signature}`, payload: body };
}

export function verify(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/**
 * The "anon key" the browser bundle ships, a real JWT the same way Supabase's
 * is. Minted with a FIXED `iat` so the value is byte-identical across restarts
 * — `.env` records it, and a key that rotated on every boot would leave the
 * committed env file pointing at a token the server no longer recognises.
 */
export const ANON_KEY = sign(
  { iss: 'volt-e2e-harness', role: 'anon' },
  { expiresIn: 60 * 60 * 24 * 3650, issuedAt: 1_780_000_000 },
).token;
