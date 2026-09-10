import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';
import { valuesToExtras } from '../../../../lib/metadata';

// Édition intégrée des métadonnées : admins de l'instance et déposant du dataset.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });

  const values = await request.json();
  const name = values.name;
  if (!/^[a-z0-9_-]{2,100}$/.test(name || '')) {
    return NextResponse.json({ error: 'dataset invalide' }, { status: 400 });
  }

  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`, {
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return NextResponse.json({ error: 'dataset introuvable' }, { status: 404 });
  const pkg = (await shown.json()).result;
  const admin = isAdmin(session);
  const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!admin && deposant !== session.email) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
  }

  const patch = {
    id: name,
    title: String(values.title || '').slice(0, 200),
    notes: String(values.notes || '').slice(0, 5000),
    extras: valuesToExtras(values, pkg.extras || []),
  };
  if (typeof values.tags === 'string') {
    patch.tags = values.tags.split(',').map((t) => t.trim()).filter(Boolean)
      .slice(0, 15).map((t) => ({ name: t.slice(0, 100) }));
  }
  if (admin && (values.visibility === 'private' || values.visibility === 'public')) {
    patch.private = values.visibility === 'private';
  }
  if (typeof values.license_id === 'string' && /^[a-zA-Z0-9._-]{0,100}$/.test(values.license_id)) {
    patch.license_id = values.license_id;
  }

  const r = await fetch(`${CKAN}/api/3/action/package_patch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.CKAN_EDIT_TOKEN },
    body: JSON.stringify(patch),
  });
  if (!r.ok) return NextResponse.json({ error: 'échec CKAN' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
