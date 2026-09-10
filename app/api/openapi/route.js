import { NextResponse } from 'next/server';
import { searchDatasets, catalogueOrgs } from '../../../lib/ckan';
import { getSettings } from '../../../lib/directus';

// Spec OpenAPI de PostgREST filtrée au périmètre de l'instance : le schéma `api`
// est mutualisé (toutes les organisations du CKAN partagé), or l'explorateur ne
// doit montrer que les API des jeux de données du périmètre de l'instance.
// On récupère la spec publique puis on ne garde que les chemins des jeux du
// périmètre (plus la racine). Périmètre « toutes » = spec inchangée.
const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.core.dataizen.eu';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const r = await fetch(`${API}/`, { next: { revalidate: 120 } });
    if (!r.ok) return NextResponse.json({ error: 'API indisponible' }, { status: 502 });
    const spec = await r.json();

    const orgs = catalogueOrgs(await getSettings());
    if (orgs) {
      // liste des slugs (noms de jeux) du périmètre = noms des vues api.<slug>
      const slugs = new Set();
      let start = 0;
      for (let garde = 0; garde < 50; garde += 1) {
        const res = await searchDatasets({ orgs, rows: 100, start });
        (res.results || []).forEach((d) => slugs.add(d.name));
        start += 100;
        if (start >= (res.count || 0)) break;
      }
      const paths = {};
      for (const [chemin, def] of Object.entries(spec.paths || {})) {
        const nom = chemin.replace(/^\//, '').split('/')[0];
        if (chemin === '/' || slugs.has(nom)) paths[chemin] = def;
      }
      spec.paths = paths;
      if (spec.info) {
        spec.info.description = ((spec.info.description || '') +
          `\n\nPérimètre : ${orgs.length ? orgs.join(', ') : 'aucune organisation'}.`).trim();
      }
    }
    return NextResponse.json(spec, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch {
    return NextResponse.json({ error: 'indisponible' }, { status: 502 });
  }
}
