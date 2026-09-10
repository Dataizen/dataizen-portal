// Sessions signées HMAC (cookie httpOnly), sans dépendance.
// L'identité vient de Keycloak (voir app/api/auth) ; le rôle admin est décidé
// par la liste PORTAL_ADMINS de l'instance.
import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.PORTAL_SECRET || 'dev-secret';
export const COOKIE = 'dtz_session';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verify(value) {
  if (!value || !value.includes('.')) return null;
  const [body, mac] = value.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const jar = await cookies();
  return verify(jar.get(COOKIE)?.value);
}

export function isAdmin(session) {
  const admins = (process.env.PORTAL_ADMINS || '').split(',').map((s) => s.trim());
  return !!session && admins.includes(session.email);
}
