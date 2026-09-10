import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';

// Édition du dictionnaire de données (label + description par colonne du
// datastore). Réservé aux admins de l'instance et au déposant du dataset.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function ckan(action, payload, auth = false) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: process.env.CKAN_EDIT_TOKEN } : {}) },
    body: JSON.stringify(payload),
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });

  const { name, resource_id, colonnes } = await request.json();
  if (!/^[a-z0-9_-]{2,100}$/.test(name || '') || !/^[a-f0-9-]{36}$/.test(resource_id || '')) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }

  // autorisation : admin ou déposant du dataset
  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`, {
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return NextResponse.json({ error: 'dataset introuvable' }, { status: 404 });
  const pkg = (await shown.json()).result;
  const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!isAdmin(session) && deposant !== session.email) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
  }

  // champs actuels (on conserve les types ; on ne fait que poser les info)
  const info = await ckan('datastore_search', { resource_id, limit: 0 }, true);
  if (!info.ok) return NextResponse.json({ error: 'ressource sans datastore' }, { status: 400 });
  const TYPES = ['text', 'int', 'numeric', 'timestamp', 'bool'];
  const saisie = new Map((colonnes || []).map((c) => [c.id, c]));
  const fields = info.body.result.fields
    .filter((f) => f.id !== '_id')
    .map((f) => {
      const s = saisie.get(f.id);
      const champ = { id: f.id, type: f.type };
      const label = (s?.label || '').trim();
      const notes = (s?.notes || '').trim();
      const typeOverride = TYPES.includes(s?.type_override) ? s.type_override : '';
      if (label || notes || typeOverride) {
        champ.info = { label: label.slice(0, 200), notes: notes.slice(0, 2000), type_override: typeOverride };
      }
      return champ;
    });

  const r = await ckan('datastore_create', { resource_id, force: true, fields }, true);
  if (!r.ok) return NextResponse.json({ error: 'échec CKAN' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
