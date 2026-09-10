import { NextResponse } from 'next/server';
import { regionDeDept } from '../../../lib/regions';

// Contours des départements demandés (carte-sélecteur de territoire du catalogue).
// Source : le référentiel CKAN `referentiel-departements-france` (org referentiels),
// lu en interne (le portail n'a pas d'egress vers Internet). Auto-hébergé (RGESN).
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const SLUG = 'referentiel-departements-france';

export const dynamic = 'force-dynamic';

async function contoursFrance() {
  const pr = await fetch(`${CKAN}/api/3/action/package_show?id=${SLUG}`, { next: { revalidate: 604800 } });
  if (!pr.ok) return null;
  const res = ((await pr.json()).result?.resources || [])
    .find((r) => (r.format || '').toLowerCase() === 'geojson' || /\.geojson(\?|$)/i.test(r.url || ''));
  if (!res?.url) return null;
  const interne = res.url.replace(/^https?:\/\/[^/]+/, CKAN);
  const gr = await fetch(interne, { next: { revalidate: 604800 } });
  if (!gr.ok) return null;
  return gr.json().catch(() => null);
}

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const tous = sp.get('all') === '1';
  const codes = new Set((sp.get('codes') || '')
    .split(',').map((c) => c.trim().toUpperCase()).filter(Boolean));
  if (!tous && !codes.size) return NextResponse.json({ type: 'FeatureCollection', features: [] });
  try {
    const fc = await contoursFrance();
    const feats = (fc?.features || [])
      .filter((f) => tous || codes.has(String((f.properties || {}).code).toUpperCase()))
      .map((f) => ({
        type: 'Feature', geometry: f.geometry,
        properties: {
          code: String(f.properties.code), nom: f.properties.nom,
          region: regionDeDept(f.properties.code),
        },
      }));
    return NextResponse.json(
      { type: 'FeatureCollection', features: feats },
      { headers: { 'Cache-Control': 'public, max-age=86400' } },
    );
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 502 });
  }
}
