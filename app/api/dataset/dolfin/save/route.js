import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../../lib/session';

// Enregistre le mapping DOLFIN (extra dolfin_mapping) et relance l'harmonisation.
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
  const { name, mapping } = await request.json();
  if (!/^[a-z0-9_-]{2,100}$/.test(name || '')) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  // le mapping doit être un JSON objet sérialisable et raisonnable
  let mappingStr;
  try {
    const obj = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
    if (!obj || typeof obj !== 'object') throw new Error('objet attendu');
    mappingStr = JSON.stringify(obj);
    if (mappingStr.length > 20000) throw new Error('mapping trop volumineux');
  } catch (e) {
    return NextResponse.json({ error: 'mapping invalide : ' + e.message }, { status: 400 });
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

  const extras = (pkg.extras || []).filter((e) => e.key !== 'dolfin_mapping');
  extras.push({ key: 'dolfin_mapping', value: mappingStr });
  const patch = await ckan('package_patch', { id: pkg.id, extras });
  if (!patch.ok) return NextResponse.json({ error: 'échec enregistrement' }, { status: 502 });

  // relancer l'harmonisation : `dolfin_regenerate` touche chaque CSV source par un
  // resource_patch neutre, ce qui déclenche le hook _harmonize_if_mapped -> génération
  // des sorties (NGSI-LD/CSV/GeoJSON). Fiable même quand le CSV porte xloader_skip
  // (contrairement à xloader_submit, qui ne relance alors rien).
  const reg = await ckan('dolfin_regenerate', { id: pkg.id });
  let n = reg.ok ? (reg.body.result?.regenerated || 0) : 0;
  // repli : si l'action n'est pas disponible, re-soumettre les CSV à xloader
  if (!reg.ok) {
    for (const res of (pkg.resources || [])) {
      if ((res.format || '').toLowerCase() === 'csv' && res.datastore_active) {
        const s = await ckan('xloader_submit', { resource_id: res.id, ignore_hash: true });
        if (s.ok) n += 1;
      }
    }
  }
  return NextResponse.json({ ok: true, resubmitted: n });
}
