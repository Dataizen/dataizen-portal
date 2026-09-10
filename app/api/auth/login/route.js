import crypto from 'crypto';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const state = crypto.randomBytes(16).toString('base64url');
  const url = new URL(`${process.env.OIDC_ISSUER}/protocol/openid-connect/auth`);
  url.searchParams.set('client_id', process.env.OIDC_CLIENT_ID || 'portal');
  url.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  const res = NextResponse.redirect(url);
  res.cookies.set('dtz_state', state, { httpOnly: true, secure: true, maxAge: 600, path: '/' });
  // retour après connexion (chemin local uniquement) : sert p.ex. à revenir sur
  // /outils/ia depuis l'iframe Directus (SSO silencieux si session Keycloak présente).
  const returnTo = new URL(request.url).searchParams.get('returnTo') || '';
  if (/^\/[a-zA-Z0-9/_-]{0,200}$/.test(returnTo)) {
    res.cookies.set('dtz_return', returnTo, { httpOnly: true, secure: true, maxAge: 600, path: '/' });
  }
  return res;
}
