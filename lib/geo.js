// Détection de données géographiques dans un aperçu datastore, par NOM de colonne ET par
// ÉCHANTILLON de contenu (quelques lignes suffisent). Reconnaît trois formes :
//  - paire latitude / longitude (colonnes séparées) -> points cartographiables ;
//  - colonne « point » unique au format "lat, lon" (ex. « Geo Point » opendatasoft) ;
//  - colonne « géométrie » : WKT (POINT/LINESTRING/POLYGON…) ou GeoJSON (ex. « Geo Shape »).
// Le contenu prime : une colonne mal nommée mais contenant du WKT/GeoJSON est reconnue.

const LAT = ['latitude', 'lat', 'y_lat'];
const LON = ['longitude', 'lon', 'lng', 'long', 'x_lon'];
const POINT_NAMES = ['geo point', 'geo_point', 'geo_point_2d', 'point', 'coordonnees', 'coordonnées', 'coordinates', 'position'];
const GEOM_NAMES = ['geo shape', 'geo_shape', 'geo_shape_2d', 'geometry', 'géométrie', 'geometrie', 'geom', 'the_geom', 'wkt', 'geojson', 'shape', 'contour'];

const WKT_RE = /^\s*(SRID=\d+\s*;)?\s*(MULTI)?(POINT|LINESTRING|POLYGON|GEOMETRYCOLLECTION)\s*[(Z]/i;
const LATLON_RE = /^\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*$/;
const norm = (s) => String(s || '').trim().toLowerCase();

function looksGeometry(v) {
  const s = String(v == null ? '' : v).trim();
  if (WKT_RE.test(s)) return true;
  if (s.startsWith('{') && /"(?:type|coordinates)"\s*:/.test(s)) return true; // GeoJSON
  return false;
}
const looksLatLon = (v) => LATLON_RE.test(String(v == null ? '' : v));

// preview = { fields: [{ id }], records: [{ ... }] } (aperçu datastore, ~25 lignes).
export function detectGeo(preview) {
  const fields = (preview?.fields || []).map((f) => f.id).filter((id) => id !== '_id');
  const recs = (preview?.records || []).slice(0, 5);
  const lc = fields.map(norm);
  const sample = (col) => recs.map((r) => r[col]).find((v) => v != null && v !== '');

  const latCol = fields.find((f, i) => LAT.includes(lc[i]));
  const lonCol = fields.find((f, i) => LON.includes(lc[i]));
  const pair = latCol && lonCol ? { latCol, lonCol } : null;

  // Colonne point "lat, lon" : par nom confirmé au contenu, sinon par contenu seul.
  let pointCol = fields.find((f, i) => POINT_NAMES.includes(lc[i]) && looksLatLon(sample(f)));
  if (!pointCol) pointCol = fields.find((f) => looksLatLon(sample(f)));

  // Colonne géométrie WKT/GeoJSON : par nom confirmé au contenu, sinon par contenu seul.
  let geomCol = fields.find((f, i) => GEOM_NAMES.includes(lc[i]) && looksGeometry(sample(f)));
  if (!geomCol) geomCol = fields.find((f) => looksGeometry(sample(f)));

  return {
    pair,
    pointCol: pointCol || null,
    geomCol: geomCol || null,
    plottablePoints: !!(pair || pointCol),   // points affichables directement sur une carte
    any: !!(pair || pointCol || geomCol),     // le jeu porte une information géographique
  };
}
