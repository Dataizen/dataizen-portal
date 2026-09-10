import { NextResponse } from 'next/server';

// Proxy du fichier GeoJSON d'une ressource CKAN (même origine pour le navigateur,
// et masque le stockage interne). Sert les contours territoriaux et les couches
// d'urbanisme (PLU, cadastre, bâtiments) du catalogue.
//
// Stratégie de volume : certaines ressources sont lourdes (cadastre ~60 Mo, BD
// TOPO ~52 Mo) et ne peuvent pas être chargées d'un coup dans le navigateur.
//   - paramètre bbox=xmin,ymin,xmax,ymax (WGS84) : ne renvoie que les features
//     dont l'emprise recoupe la bbox (la carte recharge au déplacement) ;
//   - plafond MAX_FEATURES : au-delà, la réponse est tronquée (drapeau tronque).
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const MAX_FEATURES = 20000;

// Emprise [minX, minY, maxX, maxY] d'une géométrie (parcours récursif des coordonnées).
function geomBbox(coords, acc) {
  if (typeof coords[0] === 'number') {
    const [x, y] = coords;
    if (x < acc[0]) acc[0] = x;
    if (y < acc[1]) acc[1] = y;
    if (x > acc[2]) acc[2] = x;
    if (y > acc[3]) acc[3] = y;
    return acc;
  }
  for (const c of coords) geomBbox(c, acc);
  return acc;
}

// true si l'emprise de la feature recoupe la bbox demandée.
function recoupe(feature, bbox) {
  const g = feature.geometry;
  if (!g || !g.coordinates) return false;
  const b = geomBbox(g.coordinates, [Infinity, Infinity, -Infinity, -Infinity]);
  return b[0] <= bbox[2] && b[2] >= bbox[0] && b[1] <= bbox[3] && b[3] >= bbox[1];
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const rid = params.get('rid') || '';
  if (!/^[a-f0-9-]{36}$/.test(rid)) {
    return NextResponse.json({ error: 'ressource invalide' }, { status: 400 });
  }
  // bbox optionnelle (xmin,ymin,xmax,ymax en WGS84)
  let bbox = null;
  const bp = params.get('bbox');
  if (bp) {
    const v = bp.split(',').map(Number);
    if (v.length === 4 && v.every(Number.isFinite)) bbox = v;
  }
  try {
    const rs = await fetch(`${CKAN}/api/3/action/resource_show?id=${rid}`, { next: { revalidate: 600 } });
    if (!rs.ok) return NextResponse.json({ error: 'ressource introuvable' }, { status: 404 });
    const url = (await rs.json()).result?.url;
    if (!url) return NextResponse.json({ error: 'pas de fichier' }, { status: 404 });
    // le fichier est servi par CKAN ; on le récupère côté serveur (URL interne)
    const interne = url.replace(/^https?:\/\/[^/]+/, CKAN);
    const r = await fetch(interne, { next: { revalidate: 600 } });
    if (!r.ok) return NextResponse.json({ error: 'fichier indisponible' }, { status: 502 });
    const gj = await r.json().catch(() => null);
    if (!gj) return NextResponse.json({ error: 'GeoJSON invalide' }, { status: 502 });

    let features = Array.isArray(gj.features) ? gj.features : [];
    const total = features.length;
    if (bbox) features = features.filter((f) => recoupe(f, bbox));
    const apresBbox = features.length;
    let tronque = false;
    if (features.length > MAX_FEATURES) {
      // échantillonnage régulier sur tout le fichier (et non les premières
      // features) : sinon un GeoJSON écrit dalle par dalle (canopée LIDAR)
      // n'afficherait qu'un coin. Le pas préserve la répartition spatiale.
      const pas = Math.ceil(features.length / MAX_FEATURES);
      features = features.filter((_, i) => i % pas === 0);
      tronque = true;
    }
    return NextResponse.json(
      { type: 'FeatureCollection', features, _total: total, _retour: apresBbox, _tronque: tronque },
      { headers: { 'Cache-Control': 'public, max-age=600' } },
    );
  } catch {
    return NextResponse.json({ error: 'indisponible' }, { status: 502 });
  }
}
