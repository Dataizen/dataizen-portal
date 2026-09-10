import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';

// Re-traitement cartographique IDEMPOTENT d'un jeu (géométrisation d'une colonne géo ->
// carte WMS/WFS). Réservé à un administrateur ou au déposant du jeu. Enfile le job côté
// CKAN (action dtz_geo_reprocess) ; `force` refait tout.
export const runtime = 'nodejs';

const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function ckan(action, payload) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.CKAN_EDIT_TOKEN },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });

  const { name, force } = await request.json().catch(() => ({}));
  if (!/^[a-z0-9][a-z0-9_-]{0,110}$/.test(name || '')) {
    return NextResponse.json({ error: 'nom invalide' }, { status: 400 });
  }

  // Autorisation portail (le jeton CKAN est sysadmin, donc on gate ici) : admin OU déposant.
  const show = await ckan('package_show', { id: name });
  if (!show.ok || !show.body.success) {
    return NextResponse.json({ error: 'jeu introuvable' }, { status: 404 });
  }
  const extras = show.body.result.extras || [];
  const deposePar = (extras.find((e) => e.key === 'depose_par') || {}).value;
  const owner = deposePar && session.email && deposePar.toLowerCase() === session.email.toLowerCase();
  if (!isAdmin(session) && !owner) {
    return NextResponse.json({ error: 'réservé à un administrateur ou au déposant' }, { status: 403 });
  }

  const res = await ckan('dtz_geo_reprocess', { name, force: !!force });
  if (!res.ok || !res.body.success) {
    return NextResponse.json({ error: `échec : ${JSON.stringify(res.body.error || res.body)}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...res.body.result });
}
