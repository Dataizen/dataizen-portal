import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';

// Validation de la liaison : crée une carte choroplèthe (cartes + carte_couches, brouillon)
// dans le Directus de l'instance via dtz-rag. Réservé à l'admin d'instance ou au déposant.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  const { name, intent } = await request.json().catch(() => ({}));
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
    const r = await fetch(`${RAG}/generate/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dtz-Token': process.env.RAG_WEBHOOK_TOKEN || '' },
      body: JSON.stringify({ instance: process.env.INSTANCE_NAME || '', dataset: name, intent: intent || '' }),
      signal: AbortSignal.timeout(150000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 503) return NextResponse.json({ warming: true, message: d.detail || "L'IA démarre (1 à 2 min), réessayez." });
    if (r.status === 400) return NextResponse.json({ error: d.detail || 'liaison impossible' }, { status: 400 });
    if (!r.ok) return NextResponse.json({ error: 'création indisponible' }, { status: 502 });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ warming: true, message: "L'IA démarre (le GPU peut mettre 1 à 2 min)." });
  }
}
