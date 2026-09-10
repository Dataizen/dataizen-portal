import { NextResponse } from 'next/server';
import { searchDatasets, catalogueOrgs } from '../../../../lib/ckan';
import { getSettings } from '../../../../lib/directus';
import { getSession, isAdmin } from '../../../../lib/session';

// Recherche de jeux pour le sélecteur de l'outil de génération IA (multi-sélection).
// Réutilise le moteur du catalogue, scopé aux organisations de l'instance.
export async function GET(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  }
  const sp = new URL(request.url).searchParams;
  const q = (sp.get('q') || '').slice(0, 200);
  const format = (sp.get('format') || '').slice(0, 40);
  const theme = (sp.get('theme') || '').slice(0, 80);
  let orgs = null;
  try { orgs = catalogueOrgs(await getSettings()); } catch { orgs = null; }
  try {
    const r = await searchDatasets({ q, format, theme, orgs, rows: 30 });
    const items = (r.results || []).map((d) => {
      const fmts = [...new Set((d.resources || []).map((x) => (x.format || '').toUpperCase()).filter(Boolean))];
      const geo = fmts.some((f) => ['GEOJSON', 'SHP', 'GPKG'].includes(f))
        || (d.resources || []).some((x) => x.datastore_active && /geo|the_geom|geom/i.test(JSON.stringify(x)));
      return { name: d.name, title: d.title || d.name, formats: fmts, geo };
    });
    return NextResponse.json({ count: r.count || items.length, items });
  } catch {
    return NextResponse.json({ error: 'catalogue indisponible' }, { status: 502 });
  }
}
