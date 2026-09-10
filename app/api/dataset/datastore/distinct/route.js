import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../../lib/session';

// Valeurs distinctes d'une colonne, pour l'auto-complétion / menu déroulant des
// filtres de la grille. Bornée (échantillon des 2000 premières lignes) : suffisant
// pour proposer les valeurs d'une colonne catégorielle, sans scanner un gros jeu.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const TOKEN = process.env.CKAN_EDIT_TOKEN;

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const field = (sp.get('field') || '').trim();
  // deux entrées : par (name + resource_id) [grille], ou par slug de jeu [bloc Filtre].
  const slug = (sp.get('slug') || '').trim();
  let name = (sp.get('name') || '').trim();
  let resourceId = (sp.get('resource_id') || '').trim();
  if (!field) return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  if (slug) {
    if (!/^[a-z0-9_-]{2,100}$/.test(slug)) return NextResponse.json({ values: [] });
    name = slug;
  } else if (!/^[a-z0-9_-]{2,100}$/.test(name) || !/^[a-f0-9-]{36}$/.test(resourceId)) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }

  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`, {
    headers: { Authorization: TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return NextResponse.json({ values: [] });
  const pkg = (await shown.json()).result;
  const res = slug
    ? (pkg.resources || []).find((r) => r.datastore_active && !r.harmonized_from)
    : (pkg.resources || []).find((r) => r.id === resourceId);
  if (!res) return NextResponse.json({ values: [] });
  resourceId = res.id;
  if (pkg.private) {
    const session = await getSession();
    const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
    if (!session || (!isAdmin(session) && deposant !== session.email)) {
      return NextResponse.json({ values: [] });
    }
  }

  const r = await fetch(`${CKAN}/api/3/action/datastore_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: TOKEN },
    body: JSON.stringify({ resource_id: resourceId, fields: field, limit: 2000 }), cache: 'no-store',
  });
  if (!r.ok) return NextResponse.json({ values: [] });
  const body = await r.json();
  const seen = new Set();
  for (const rec of (body.result?.records || [])) {
    const v = rec[field];
    if (v === null || v === undefined || v === '') continue;
    seen.add(String(v));
    if (seen.size > 200) break;
  }
  const values = [...seen].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })).slice(0, 100);
  return NextResponse.json({ values });
}
