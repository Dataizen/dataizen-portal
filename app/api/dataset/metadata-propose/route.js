import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';
import { METADATA_FIELDS } from '../../../../lib/metadata';

// Proposition IA de métadonnées pour un jeu DÉJÀ déposé (post-dépôt, à la demande).
// Lit les colonnes + un échantillon depuis le datastore (chargé après le dépôt),
// interroge dtz-rag, et renvoie une proposition (titre, description, tags, extras).
// Réservé à l'admin d'instance ou au déposant. Écriture faite ensuite via /edit.
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
  const res = (pkg.resources || []).find((r) => r.datastore_active && !r.harmonized_from);
  if (!res) {
    return NextResponse.json({ error: 'aucune ressource chargée dans le datastore (patientez le chargement du fichier)' }, { status: 409 });
  }
  const ds = await fetch(`${CKAN}/api/3/action/datastore_search?resource_id=${res.id}&limit=8`,
    { headers: { Authorization: tok }, cache: 'no-store' });
  const dsj = (await ds.json()).result || {};
  const columns = (dsj.fields || []).map((f) => f.id).filter((id) => id !== '_id');
  const sample = (dsj.records || []).map((r) => { const o = { ...r }; delete o._id; return o; });

  try {
    const r = await fetch(`${RAG}/generate/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dtz-Token': process.env.RAG_WEBHOOK_TOKEN || '' },
      body: JSON.stringify({
        columns, sample, filename: res.name || pkg.name,
        fields: METADATA_FIELDS.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options })),
      }),
      signal: AbortSignal.timeout(150000),
    });
    if (r.status === 503) return NextResponse.json({ warming: true, message: "L'IA démarre le GPU (1 à 2 min). Réessayez dans une minute." });
    if (!r.ok) return NextResponse.json({ error: 'proposition indisponible' }, { status: 502 });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ warming: true, message: "L'IA démarre (le GPU peut mettre 1 à 2 min). Réessayez dans une minute." });
  }
}
