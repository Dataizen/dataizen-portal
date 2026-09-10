import { NextResponse } from 'next/server';

// Points d'une ressource datastore pour la carte (proxy serveur : pas de CORS,
// pas de token exposé). Détecte latitude/longitude et renvoie les attributs
// (8 premiers champs) pour les infobulles et les couches.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const LAT = ['latitude', 'lat', 'y_lat'];
const LON = ['longitude', 'lon', 'lng', 'x_lon'];
// Colonnes portant une géométrie (GeoJSON ou WKT) : une donnée du catalogue
// n'est pas forcément des points lat/lon, elle peut être des polygones/lignes.
const GEOM = ['geom', 'geometry', 'the_geom', 'geojson', 'shape', 'wkt', 'wkb_geometry'];

// Convertit une valeur de colonne géométrie en géométrie GeoJSON (objet déjà
// GeoJSON, chaîne GeoJSON, ou WKT POINT/LINESTRING/POLYGON simple). Renvoie null
// si non interprétable.
function versGeometrie(v) {
  if (!v) return null;
  if (typeof v === 'object') return v.type ? v : null;
  const s = String(v).trim();
  if (s.startsWith('{')) { try { const g = JSON.parse(s); return g && g.type ? g : null; } catch { return null; } }
  const m = s.match(/^(POINT|LINESTRING|POLYGON|MULTIPOLYGON)\s*(ZM?|M)?\s*\((.+)\)$/i);
  if (!m) return null;
  const type = m[1].toUpperCase();
  const nums = (t) => t.trim().split(/\s+/).slice(0, 2).map(Number);
  const ring = (t) => t.split(',').map(nums);
  try {
    if (type === 'POINT') return { type: 'Point', coordinates: nums(m[3]) };
    if (type === 'LINESTRING') return { type: 'LineString', coordinates: ring(m[3]) };
    if (type === 'POLYGON') return { type: 'Polygon', coordinates: m[3].replace(/^\(|\)$/g, '').split(/\)\s*,\s*\(/).map(ring) };
    if (type === 'MULTIPOLYGON') return { type: 'MultiPolygon',
      coordinates: m[3].replace(/^\(\(|\)\)$/g, '').split(/\)\)\s*,\s*\(\(/).map((poly) => poly.split(/\)\s*,\s*\(/).map(ring)) };
  } catch { return null; }
  return null;
}

export async function GET(request) {
  const rid = new URL(request.url).searchParams.get('rid') || '';
  if (!/^[a-f0-9-]{36}$/.test(rid)) {
    return NextResponse.json({ error: 'ressource invalide' }, { status: 400 });
  }
  const r = await fetch(`${CKAN}/api/3/action/datastore_search?resource_id=${rid}&limit=2000`,
    { next: { revalidate: 300 } });
  if (!r.ok) return NextResponse.json({ error: 'datastore indisponible' }, { status: 502 });
  const { result } = await r.json();
  const fields = result.fields.map((f) => f.id).filter((f) => f !== '_id');
  const flat = fields.find((f) => LAT.includes(f.toLowerCase()));
  const flon = fields.find((f) => LON.includes(f.toLowerCase()));
  const fgeom = fields.find((f) => GEOM.includes(f.toLowerCase()));
  if (!flat && !flon && !fgeom) return NextResponse.json({ points: [], attrs: [] });

  // nom de la ressource et du dataset (titre de couche)
  let titre = '';
  try {
    const rr = await fetch(`${CKAN}/api/3/action/resource_show?id=${rid}`, { next: { revalidate: 3600 } });
    if (rr.ok) {
      const res = (await rr.json()).result;
      // titre lisible : celui du jeu de données plutôt que le nom du fichier
      const pk = await fetch(`${CKAN}/api/3/action/package_show?id=${res.package_id}`, { next: { revalidate: 3600 } });
      titre = (pk.ok && (await pk.json()).result?.title) || res.name || '';
    }
  } catch { /* optionnel */ }

  // Priorité à une colonne géométrie (polygones/lignes/points) : la couche est
  // rendue en GeoJSON. Sinon on retombe sur des points lat/lon.
  if (fgeom) {
    const gattrs = fields.filter((f) => f !== fgeom).slice(0, 8);
    const features = result.records.map((rec) => {
      const geometry = versGeometrie(rec[fgeom]);
      if (!geometry) return null;
      const props = {};
      for (const a of gattrs) props[a] = rec[a] ?? '';
      return { type: 'Feature', geometry, properties: props };
    }).filter(Boolean);
    if (features.length) {
      const label = fields.find((f) => /^(nom|name|titre|libelle)/i.test(f)) || gattrs[0];
      return NextResponse.json({
        geojson: { type: 'FeatureCollection', features },
        attrs: gattrs, label, titre, total: result.total,
      });
    }
  }
  if (!flat || !flon) return NextResponse.json({ points: [], attrs: [], titre });
  const attrs = fields.filter((f) => f !== flat && f !== flon).slice(0, 8);
  const label = fields.find((f) => /^(nom|name|titre|libelle)/i.test(f)) || attrs[0];

  const points = result.records
    .map((rec) => {
      const lat = parseFloat(rec[flat]);
      const lon = parseFloat(rec[flon]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const props = {};
      for (const a of attrs) props[a] = rec[a] ?? '';
      return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, props };
    })
    .filter(Boolean);
  return NextResponse.json({ points, attrs, label, titre, total: result.total });
}
