import { NextResponse } from 'next/server';

// Statut des TRAITEMENTS d'une ressource (pour l'indicateur « traitement en cours » de la
// fiche). Combine : chargement datastore (datastore_active + xloader_status) et préparation
// cartographique (géométrisation en colonne, extras `dtz_geo_*`). Lecture seule.
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
  const r = rs.result || {};
  const active = !!r.datastore_active;

  let status = 'unknown';
  let error = '';
  const st = await ckan('xloader_status', { resource_id: rid });
  if (st.success && st.result) {
    status = st.result.status || 'unknown';
    const e = st.result.error;
    error = typeof e === 'string' ? e : (e && e.message) || '';
  }
  // Préparation cartographique (géométrisation d'une colonne géo) : états posés par le job ogc.
  const geo = {
    status: r.dtz_geo_status || '',   // detecting|geometrizing|ready|none|error
    done: r.dtz_geo_done || '',
    total: r.dtz_geo_total || '',
    kind: r.dtz_geo_kind || '',
    col: r.dtz_geo_col || '',
  };
  return NextResponse.json({ active, status, error, geo });
}
