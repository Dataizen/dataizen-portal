import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../../lib/session';

// Proposition IA du mapping DOLFIN. Réservé aux admins de l'instance et au déposant.
// Proxifie l'endpoint CKAN /dataset/<id>/dolfin/propose (qui appelle le modèle
// souverain via le proxy ollama). Renvoie {mapping}, {warming} ou {error}.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  const url = new URL(request.url);
  const name = url.searchParams.get('name') || '';
  const model = url.searchParams.get('model') || '0';
  if (!/^[a-z0-9_-]{2,100}$/.test(name) || !/^\d{1,3}$/.test(model)) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  // autorisation : admin ou déposant
  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`, {
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return NextResponse.json({ error: 'dataset introuvable' }, { status: 404 });
  const pkg = (await shown.json()).result;
  const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!isAdmin(session) && deposant !== session.email) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
  }
  // proxy CKAN (le service ollama réveille le GPU ; réponse warming si pas prêt)
  try {
    const r = await fetch(
      `${CKAN}/dataset/${encodeURIComponent(name)}/dolfin/propose?model=${model}`,
      { headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store',
        signal: AbortSignal.timeout(60000) });
    const body = await r.json().catch(() => ({ error: 'réponse IA illisible' }));
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ warming: true,
      message: "L'IA démarre le GPU (première requête). Réessaie dans une minute." });
  }
}
