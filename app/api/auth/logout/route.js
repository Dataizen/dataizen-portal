import { NextResponse } from 'next/server';
import { COOKIE } from '../../../../lib/session';

// Déconnexion RÉELLE : on efface la session du portail ET on termine la session SSO
// (Keycloak), sinon un nouveau clic sur « Connexion » reconnecte silencieusement le même
// compte. Keycloak met ensuite fin à la session unique partagée par toutes les applis
// (portail, catalogue, Directus…) puis renvoie à l'accueil.
export async function GET() {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  let dest = base || '/';
  if (process.env.OIDC_ISSUER) {
    const url = new URL(`${process.env.OIDC_ISSUER}/protocol/openid-connect/logout`);
    url.searchParams.set('client_id', process.env.OIDC_CLIENT_ID || 'portal');
    // URI de retour : doit correspondre aux « redirect URIs » du client (motif /*),
    // on ajoute donc la barre finale.
    url.searchParams.set('post_logout_redirect_uri', `${base}/`);
    dest = url.toString();
  }
  const res = NextResponse.redirect(dest);
  res.cookies.set(COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
