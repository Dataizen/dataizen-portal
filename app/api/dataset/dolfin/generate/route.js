import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../../lib/session';

// Brouillon de modèle DOLFIN (.dolfin) généré par l'IA à partir d'un jeu : colonnes +
// échantillon + syntaxe DOLFIN. Proxifie dtz-rag (/dolfin/model). Réservé à l'admin
// d'instance ou au déposant. L'enregistrement du modèle se fait ensuite via
// /api/dolfin/models (action CKAN dolfin_model_save, qui compile et versionne le .dolfin).
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
  const pkg = (await shown.json()).result;
  const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!isAdmin(session) && deposant !== session.email) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
  }

  try {
    const r = await fetch(`${RAG}/dolfin/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dtz-Token': process.env.RAG_WEBHOOK_TOKEN || '' },
      body: JSON.stringify({ dataset: name }),
      cache: 'no-store',
    });
    const body = await r.json().catch(() => ({}));
    if (r.status === 503) {
      return NextResponse.json({ warming: true, message: body.detail || 'Le GPU démarre, réessaie dans une minute.' });
    }
    if (!r.ok) {
      return NextResponse.json({ error: body.detail || 'génération indisponible' }, { status: r.status || 502 });
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: 'service IA injoignable' }, { status: 502 });
  }
}
