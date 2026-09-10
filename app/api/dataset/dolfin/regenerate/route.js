import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../../lib/session';

// Régénère les fichiers harmonisés d'un jeu après changement du modèle DOLFIN.
// Réservé aux admins de l'instance et au déposant. Écriture via le token de service ;
// autorisation refaite ici (le portail n'a pas la session CKAN de l'utilisateur).
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function ckan(action, payload) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.CKAN_EDIT_TOKEN },
    body: JSON.stringify(payload),
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  const { name } = await request.json();
  if (!/^[a-z0-9_-]{2,100}$/.test(name || '')) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }

  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`, {
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return NextResponse.json({ error: 'dataset introuvable' }, { status: 404 });
  const pkg = (await shown.json()).result;
  const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!isAdmin(session) && deposant !== session.email) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
  }

  const r = await ckan('dolfin_regenerate', { id: pkg.id });
  if (!r.ok) return NextResponse.json({ error: 'échec de la régénération' }, { status: 502 });
  return NextResponse.json({ ok: true, regenerated: r.body.result?.regenerated || 0 });
}
