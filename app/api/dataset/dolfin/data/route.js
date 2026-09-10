import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../../lib/session';

// Données d'harmonisation DOLFIN (modèles + colonnes + mapping courant) pour un jeu.
// Réservé aux admins de l'instance et au déposant. Proxifie l'endpoint CKAN
// /dataset/<id>/dolfin/data (autorisé côté CKAN via le token de service).
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function authorize(name, session) {
  if (!/^[a-z0-9_-]{2,100}$/.test(name || '')) return { status: 400, error: 'requête invalide' };
  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`, {
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return { status: 404, error: 'dataset introuvable' };
  const pkg = (await shown.json()).result;
  const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!isAdmin(session) && deposant !== session.email) return { status: 403, error: 'non autorisé' };
  return { ok: true };
}

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  const name = new URL(request.url).searchParams.get('name') || '';
  const auth = await authorize(name, session);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const r = await fetch(`${CKAN}/dataset/${encodeURIComponent(name)}/dolfin/data`, {
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store',
  });
  const body = await r.json().catch(() => ({ error: 'réponse CKAN illisible' }));
  return NextResponse.json(body, { status: r.ok ? 200 : 502 });
}
