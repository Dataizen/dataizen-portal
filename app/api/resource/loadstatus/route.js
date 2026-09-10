import { NextResponse } from 'next/server';

// Statut de chargement datastore d'une ressource (pour l'indicateur « traitement en
// cours » de la fiche). Combine datastore_active (prêt ?) et xloader_status (job en
// cours / échec). Lecture seule, sans effet de bord.
export const runtime = 'nodejs';

const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function ckan(action, payload) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.CKAN_EDIT_TOKEN },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return r.json().catch(() => ({}));
}

export async function GET(request) {
  const rid = new URL(request.url).searchParams.get('rid');
  if (!rid) return NextResponse.json({ error: 'rid requis' }, { status: 400 });

  const rs = await ckan('resource_show', { id: rid });
  const active = !!rs.result?.datastore_active;

  let status = 'unknown';
  let error = '';
  const st = await ckan('xloader_status', { resource_id: rid });
  if (st.success && st.result) {
    status = st.result.status || 'unknown';
    const e = st.result.error;
    error = typeof e === 'string' ? e : (e && e.message) || '';
  }
  return NextResponse.json({ active, status, error });
}
