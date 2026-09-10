import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';

// Suggestion de liaison territoriale d'un jeu (niveau + contour de référence), via dtz-rag.
// Réservé à l'admin d'instance ou au déposant.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  const { name } = await request.json().catch(() => ({}));
  if (!/^[a-z0-9_-]{2,100}$/.test(name || '')) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  const tok = process.env.CKAN_EDIT_TOKEN;
  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`,
    { headers: { Authorization: tok }, cache: 'no-store' });
  if (!shown.ok) return NextResponse.json({ error: 'dataset introuvable' }, { status: 404 });
  const deposant = ((await shown.json()).result.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!isAdmin(session) && deposant !== session.email) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
  }
  try {
    const r = await fetch(`${RAG}/territory/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dtz-Token': process.env.RAG_WEBHOOK_TOKEN || '' },
      body: JSON.stringify({ dataset: name }), signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return NextResponse.json({ error: 'détection indisponible' }, { status: 502 });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ error: 'détection indisponible' }, { status: 502 });
  }
}
