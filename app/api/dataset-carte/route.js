import { NextResponse } from 'next/server';

// Config de carte multi-sources pour une fiche : points datastore (défaut),
// service WMS et service WFS de MapServer, en couches activables. L'utilisateur
// choisit la représentation. Renvoyée à CartesLoader (mode data-fiche).
const CKAN_INT = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const CKAN_PUB = process.env.NEXT_PUBLIC_CKAN_URL || 'https://data.core.dataizen.eu';
const GEO = process.env.NEXT_PUBLIC_GEO_URL || '';

export async function GET(request) {
  const name = new URL(request.url).searchParams.get('name') || '';
  if (!/^[a-z0-9_-]{2,100}$/.test(name)) {
    return NextResponse.json({ error: 'dataset invalide' }, { status: 400 });
  }
  try {
    // Jeton d'édition : permet de servir la carte d'un jeu PRIVÉ (brouillon) à son
    // déposant / à un admin (la fiche a déjà vérifié le droit avant d'appeler cette route).
    const pr = await fetch(`${CKAN_INT}/api/3/action/package_show?id=${name}`, {
      headers: process.env.CKAN_EDIT_TOKEN ? { Authorization: process.env.CKAN_EDIT_TOKEN } : {},
      cache: 'no-store',
    });
    if (!pr.ok) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    const pkg = (await pr.json()).result;
    const org = pkg.organization?.name;
    const rid = (pkg.resources || []).find((r) => r.datastore_active)?.id;

    // emprise depuis la collection pygeoapi (si présente)
    let bbox = '';
    if (GEO) {
      try {
        const cr = await fetch(`${GEO}/collections/${name}?f=json`, { next: { revalidate: 300 } });
        if (cr.ok) {
          const b = (await cr.json())?.extent?.spatial?.bbox?.[0];
          if (Array.isArray(b) && b.length >= 4) bbox = [b[0], b[1], b[2], b[3]].join(',');
        }
      } catch { /* emprise optionnelle */ }
    }

    // Mapfile MapServer du jeu (généré par la chaîne géo, y compris pour une géométrie EN
    // COLONNE du datastore). Noms de couches DÉTERMINISTES : on NE fait PAS de GetCapabilities
    // (un GetCapabilities recalcule l'emprise de la couche via ST_Extent sur toute la table, soit
    // plusieurs secondes sur un jeu de millions de lignes, x2 pour WMS+WFS : c'était la cause
    // principale de la lenteur de la fiche). La ressource géo porte wms_url/wfs_url et dtz_geo_total.
    const mapBase = `/mapserver/mapfiles/${name}.map`;
    const wfsBase = `${CKAN_PUB}/wfs?map=${mapBase}`;
    const wmsMapBase = `${CKAN_PUB}/wms?map=${mapBase}`;
    const geoColRes = (pkg.resources || []).find((r) => r.wms_url || r.wfs_url)
      || (pkg.resources || []).find((r) => r.datastore_active);
    const ridU = geoColRes?.id ? String(geoColRes.id).replace(/-/g, '_') : '';
    const geoTotal = Number(geoColRes?.dtz_geo_total || 0);
    // Au-delà de ce seuil, le mapfile sert deux couches à échelle (détail `res_<rid>_hi` au zoom
    // serré + aperçu `res_<rid>_ov` au dézoom) regroupées sous le groupe WMS `res_<rid>`.
    const OVERVIEW_MIN = 200000;
    // WMS : le client demande le groupe `res_<rid>` (rend le détail ou l'aperçu selon l'échelle) ;
    // pour un petit jeu c'est la couche unique du même nom. WFS : la couche détail.
    const wmsMapLayer = geoColRes?.wms_url && ridU ? `res_${ridU}` : '';
    const wfsType = geoColRes?.wfs_url && ridU
      ? (geoTotal > OVERVIEW_MIN ? `ms:res_${ridU}_hi` : `ms:res_${ridU}`)
      : '';

    // La couche « Points (données) » n'a de sens que si le datastore porte des colonnes
    // de coordonnées ; sinon elle s'afficherait vide (cas d'une table par code commune).
    const COLS_LAT = ['latitude', 'lat', 'y_lat'];
    const COLS_LON = ['longitude', 'lon', 'lng', 'x_lon'];
    let hasCoords = false;
    if (rid) {
      try {
        const fr = await fetch(`${CKAN_INT}/api/3/action/datastore_search?resource_id=${rid}&limit=0`,
          { next: { revalidate: 120 } });
        if (fr.ok) {
          const cols = ((await fr.json()).result?.fields || []).map((f) => String(f.id).toLowerCase());
          hasCoords = cols.some((c) => COLS_LAT.includes(c)) && cols.some((c) => COLS_LON.includes(c));
        }
      } catch { /* sans preuve de coordonnées, pas de couche Points */ }
    }

    // Le service WMS n'expose une couche que si MapServer a un mapfile pour ce jeu
    // (jeu spatialisé). On vérifie les capabilities pour ne pas proposer de couche vide.
    let wmsHasLayer = false, wmsCouche = name;
    if (org && rid) {
      try {
        const wc = await fetch(`${CKAN_PUB}/wms/${org}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`,
          { next: { revalidate: 300 } });
        if (wc.ok) {
          const xml = await wc.text();
          const resName = `res_${String(rid).replace(/-/g, '_')}`;
          if (xml.includes(`<Name>${name}</Name>`)) { wmsHasLayer = true; wmsCouche = name; }
          else if (xml.includes(`<Name>${resName}</Name>`)) { wmsHasLayer = true; wmsCouche = resName; }
        }
      } catch { /* WMS optionnel */ }
    }

    // ressource GeoJSON (fichier) : affichée directement sur la carte
    const geoRes = (pkg.resources || []).find((r) =>
      (r.format || '').toLowerCase() === 'geojson' || /\.geojson(\?|$)/i.test(r.url || ''));

    // Couches par ordre de priorité ; la PREMIÈRE couche réellement géométrique est
    // visible par défaut (on ne montre jamais une couche vide en défaut).
    const couches = [];
    let visiblePris = false;
    const pousser = (c) => {
      const visible = !visiblePris;
      if (visible) visiblePris = true;
      couches.push({ ...c, visible });
    };
    if (geoRes) pousser({ type: 'geojson', geojson_rid: geoRes.id, label: 'Carte',
      activable: true, couleur: '#2f5496' });
    // Rendu SERVEUR en tuiles (n'affiche que le visible) : couche par défaut dès qu'un mapfile
    // WMS existe. C'est la bonne voie pour les gros volumes (millions de géométries en colonne).
    if (wmsMapLayer) pousser({ type: 'wms', url: wmsMapBase, couche: wmsMapLayer,
      label: 'Carte (rendu serveur)', activable: true, couleur: '#1e7a46' });
    if (rid && hasCoords) pousser({ type: 'catalogue', dataset: rid, label: 'Points (données)',
      activable: true, couleur: '#1e7a46' });
    if (wmsHasLayer) pousser({ type: 'wms', url: `${CKAN_PUB}/wms/${org}`, couche: wmsCouche,
      label: 'Service WMS', activable: true, couleur: '#1e7a46' });
    // Le WFS charge les entités vectorielles CÔTÉ CLIENT : on ne le propose comme couche de carte
    // que pour un PETIT jeu (au-delà, le client tenterait de charger des dizaines de milliers /
    // millions d'entités et n'afficherait rien, cf. testlm1). Le rendu serveur WMS reste la couche
    // d'affichage pour les gros jeux ; le service WFS demeure accessible par son URL pour les SIG.
    const WFS_MAP_MAX = 5000;
    if (wfsType && geoTotal > 0 && geoTotal <= WFS_MAP_MAX) pousser({ type: 'wfs', url: wfsBase,
      couche: wfsType, label: 'Service WFS', activable: true, couleur: '#c2571a' });

    if (!couches.length) return NextResponse.json({ error: 'aucune source géo' }, { status: 404 });

    return NextResponse.json({
      titre: pkg.title || name, fonds: ['plan', 'osm', 'photo'], fondDefaut: 'plan',
      vue3d: false, bbox, couches,
    });
  } catch {
    return NextResponse.json({ error: 'indisponible' }, { status: 502 });
  }
}
