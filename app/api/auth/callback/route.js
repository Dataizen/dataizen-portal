import { NextResponse } from 'next/server';
import { sign, COOKIE } from '../../../../lib/session';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = request.cookies.get('dtz_state')?.value;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(`${base}/?erreur=connexion`);
  }

  const tokenRes = await fetch(`${process.env.OIDC_ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${base}/api/auth/callback`,
      client_id: process.env.OIDC_CLIENT_ID || 'portal',
      client_secret: process.env.OIDC_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${base}/?erreur=jeton`);
  const tokens = await tokenRes.json();

  const infoRes = await fetch(`${process.env.OIDC_ISSUER}/protocol/openid-connect/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) return NextResponse.redirect(`${base}/?erreur=profil`);
  const me = await infoRes.json();

  // retour après connexion : chemin local mémorisé par /api/auth/login (sinon accueil)
  const ret = request.cookies.get('dtz_return')?.value || '';
  const dest = /^\/[a-zA-Z0-9/_-]{0,200}$/.test(ret) ? `${base}${ret}` : base;
  const res = NextResponse.redirect(dest);
  res.cookies.set(COOKIE, sign({
    email: me.email,
    name: me.name || me.preferred_username,
    exp: Math.floor(Date.now() / 1000) + 8 * 3600,
  }), { httpOnly: true, secure: true, maxAge: 8 * 3600, path: '/' });
  res.cookies.set('dtz_state', '', { maxAge: 0, path: '/' });
  res.cookies.set('dtz_return', '', { maxAge: 0, path: '/' });
  return res;
}
