import { NextResponse } from 'next/server';
import { sourceDataset } from '../../../lib/source';

// Configuration d'une carte construite dans Directus (collections cartes +
// carte_couches). Renvoyée au client pour un rendu MapLibre sans code.
const DIRECTUS = process.env.DIRECTUS_INTERNAL_URL || 'http://directus:8055';
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const CKAN_PUB = process.env.NEXT_PUBLIC_CKAN_URL || 'https://data.core.dataizen.eu';

// Une couche « Fichier vecteur » (type geojson) qui pointe vers une ressource
// NON GeoJSON (SHP, GPKG, KML…) ne peut pas être lue directement par le
// navigateur. MapServer la sert en WFS (une couche par ressource géo, nommée
// ms:res_<rid>). On bascule donc la couche en WFS, sans que l'utilisateur ait à
// saisir d'URL : il choisit juste la ressource dans la liste.
async function resoudreVecteurFichier(c) {
  if (c.type !== 'geojson' || !c.geojson_rid) return null;
  try {
    const rr = await fetch(`${CKAN}/api/3/action/resource_show?id=${c.geojson_rid}`,
      { next: { revalidate: 300 } });
    if (!rr.ok) return null;
    const res = (await rr.json()).result || {};
    const fmt = (res.format || '').toLowerCase();
    // vrai GeoJSON : rendu direct côté client (rien à faire)
    if (fmt === 'geojson' || /\.geojson(\?|$)/i.test(res.url || '')) return null;
    // autre format vecteur : on passe par le WFS MapServer du jeu
    const pr = await fetch(`${CKAN}/api/3/action/package_show?id=${res.package_id}`,
      { next: { revalidate: 300 } });
    const slug = pr.ok ? (await pr.json()).result?.name : null;
    if (!slug) return null;
    return {
      url: `${CKAN_PUB}/wfs?map=/mapserver/mapfiles/${slug}.map`,
      couche: `ms:res_${String(c.geojson_rid).replace(/-/g, '_')}`,
    };
  } catch {
    return null;
  }
}

// Choroplèthe : la couche de contours de référence (geojson_rid) est résolue en
// source géométrique (GeoJSON direct si le jeu est en GeoJSON, sinon WFS MapServer).
// Le client joint les valeurs du jeu thématique par code et colore par la valeur.
async function resoudreContour(rid) {
  if (!rid) return null;
  try {
    const rr = await fetch(`${CKAN}/api/3/action/resource_show?id=${rid}`, { next: { revalidate: 300 } });
    if (!rr.ok) return null;
    const res = (await rr.json()).result || {};
    const fmt = (res.format || '').toLowerCase();
    if (fmt === 'geojson' || /\.geojson(\?|$)/i.test(res.url || '')) {
      const url = /^https?:/i.test(res.url || '') ? res.url : `${CKAN_PUB}${res.url || ''}`;
      return { geojson: url };
    }
    const pr = await fetch(`${CKAN}/api/3/action/package_show?id=${res.package_id}`, { next: { revalidate: 300 } });
    const slug = pr.ok ? (await pr.json()).result?.name : null;
    if (!slug) return null;
    return { wfs: { url: `${CKAN_PUB}/wfs?map=/mapserver/mapfiles/${slug}.map`,
      couche: `ms:res_${String(rid).replace(/-/g, '_')}` } };
  } catch { return null; }
}

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'carte invalide' }, { status: 400 });
  try {
    const cr = await fetch(`${DIRECTUS}/items/cartes/${id}`, { next: { revalidate: 60 } });
    if (!cr.ok) return NextResponse.json({ error: 'carte introuvable' }, { status: 404 });
    const carte = (await cr.json()).data;
    if (!carte || carte.status !== 'published') {
      return NextResponse.json({ error: 'carte non publiée' }, { status: 404 });
    }
    const lr = await fetch(
      `${DIRECTUS}/items/carte_couches?filter[carte][_eq]=${id}&sort=sort&limit=50`,
      { next: { revalidate: 60 } });
    const couches = (lr.ok ? (await lr.json()).data : []) || [];
    const fonds = ['osm', 'plan', 'photo'].filter((f) => carte[`propose_${f}`] !== false);
    return NextResponse.json({
      titre: carte.titre,
      fondDefaut: carte.fond_defaut || 'osm',
      fonds: fonds.length ? fonds : ['osm'],
      vue3d: !!carte.vue_3d,
      // carte « pilote de territoire » : un clic sur la choroplèthe diffuse la sélection
      // (bus territoireBus) et met à jour les graphiques réactifs de la page.
      pilote_territoire: !!carte.pilote_territoire,
      emprise: carte.emprise || '',
      // vue initiale alternative : centre (lng,lat) + zoom (utilisée si pas d'emprise)
      centre: carte.centre || '',
      zoom: (carte.zoom === null || carte.zoom === undefined || carte.zoom === '') ? null : Number(carte.zoom),
      // relief 3D (PMTiles terrain-RGB) si une URL de terrain est renseignée
      terrain: carte.terrain_url ? {
        url: carte.terrain_url, encoding: 'mapbox', tileSize: 512,
        exaggeration: Number(carte.terrain_exageration) || 1.5,
      } : null,
      couches: await Promise.all(couches.map(async (c) => {
        // choroplèthe (jointure par code) : contours partagés + valeur d'un jeu tabulaire.
        // Pas besoin de recopier la géométrie dans le jeu thématique.
        if (c.type === 'choroplethe') {
          return {
            label: c.label, type: 'choroplethe', visible: c.visible !== false,
            activable: c.activable !== false, couleur: c.couleur,
            dataset: c.dataset, code_col: c.code_col || 'code',
            geo_code_col: c.geo_code_col || 'code', valeur_col: c.valeur_col || '',
            contour: await resoudreContour(c.geojson_rid || c.dataset),
            source: await sourceDataset(CKAN, c.dataset),
          };
        }
        const base = {
          label: c.label, type: c.type, dataset: c.dataset, url: c.url,
          couche: c.couche, couleur: c.couleur, visible: c.visible !== false,
          activable: c.activable !== false,
          geojson_rid: c.geojson_rid || '', hauteur_attr: c.hauteur_attr || 'hauteur',
          source: await sourceDataset(CKAN, c.geojson_rid || c.dataset),
        };
        const wfs = await resoudreVecteurFichier(c);
        if (wfs) { base.type = 'wfs'; base.url = wfs.url; base.couche = wfs.couche; }
        return base;
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Directus indisponible' }, { status: 502 });
  }
}
