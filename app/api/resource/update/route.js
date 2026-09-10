import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';

// Mise à jour des données d'une ressource (nouveau fichier) ou ajout d'une
// ressource à un dataset existant, depuis la fiche du catalogue.
// Autorisé aux admins de l'instance et au déposant du dataset (extra depose_par).
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const MAX_UPLOAD = 100 * 1024 * 1024;

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });

  const form = await request.formData();
  const dataset = String(form.get('dataset') || '');
  const resourceId = String(form.get('resource_id') || ''); // vide = ajout
  const file = form.get('file');
  if (!/^[a-z0-9_-]{2,100}$/.test(dataset) || !file || typeof file === 'string' || !file.size) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD) return NextResponse.json({ error: 'fichier trop volumineux (100 Mo max)' }, { status: 400 });

  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${dataset}`, {
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return NextResponse.json({ error: 'dataset introuvable' }, { status: 404 });
  const pkg = (await shown.json()).result;
  const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!isAdmin(session) && deposant !== session.email) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
  }

  const fd = new FormData();
  fd.set('upload', file, file.name);
  fd.set('format', (file.name.split('.').pop() || '').toUpperCase());
  let action;
  if (resourceId) {
    if (!(pkg.resources || []).some((r) => r.id === resourceId)) {
      return NextResponse.json({ error: 'ressource inconnue' }, { status: 404 });
    }
    fd.set('id', resourceId);
    fd.set('last_modified', new Date().toISOString());
    action = 'resource_patch';
  } else {
    fd.set('package_id', dataset);
    fd.set('name', file.name);
    action = 'resource_create';
  }
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN },
    body: fd,
  });
  if (!r.ok) return NextResponse.json({ error: 'échec CKAN' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
