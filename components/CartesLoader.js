'use client';
// Cartes MapLibre du portail (auto-hébergé, chargé à la demande). Deux modes :
//  - <div class="dtz-carte" data-rid="uuid[,uuid2…]">  : couches = ressources datastore (rapide)
//  - <div class="dtz-carte" data-config="ID">          : carte construite dans Directus
//    (collections cartes + carte_couches) : fonds choisis, couches catalogue/WMS/WFS, vue 3D.
// Fonds : tuiles OSM / Plan IGN / photos aériennes (services externes). La vue 3D
// ajoute des bâtiments extrudés (tuiles vectorielles OpenFreeMap).
// Accessibilité (RGAA) : contrôles au clavier, aria-pressed.
import { useEffect } from 'react';
import { getSelection, setSelection, onSelection, getFiltre, onFiltre } from './territoireBus';

const FONDS = {
  osm: {
    nom: 'OpenStreetMap',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© les contributeurs <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  plan: {
    nom: 'Plan IGN',
    tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}'],
    attribution: '© <a href="https://www.ign.fr/">IGN</a> - Géoplateforme',
  },
  photo: {
    nom: 'Photos aériennes',
    tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}'],
    attribution: '© <a href="https://www.ign.fr/">IGN</a> - Géoplateforme',
  },
};
const COULEURS = ['#2f5496', '#c2571a', '#1e7a46', '#8a3ffc', '#b3261e', '#0ea5e9'];

function bouton(txt, aria, onclick, presse) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = txt;
  b.setAttribute('aria-label', aria);
  if (presse !== undefined) b.setAttribute('aria-pressed', String(presse));
  b.addEventListener('click', onclick);
  return b;
}

// Descripteurs de couches à partir d'un div (mode data-rid, data-config ou data-wms)
async function lireCouches(div) {
  if (div.dataset.wms) {
    // aperçu du service WMS d'un jeu de données (MapServer) sur un fond de carte
    return {
      fonds: ['plan', 'osm', 'photo'], fondDefaut: 'plan', vue3d: false,
      bbox: div.dataset.bbox || '',
      couches: [{
        type: 'wms', url: div.dataset.wms, couche: div.dataset.layer,
        visible: true, activable: false, couleur: COULEURS[0],
        label: div.dataset.label || 'Couche WMS',
      }],
    };
  }
  if (div.dataset.fiche || div.dataset.config) {
    const url = div.dataset.fiche
      ? `/api/dataset-carte?name=${encodeURIComponent(div.dataset.fiche)}`
      : `/api/carte-config?id=${div.dataset.config}`;
    const r = await fetch(url);
    const cfg = await r.json().catch(() => ({}));
    // config indisponible (carte non publiée, introuvable, jeu absent…) : on remonte la
    // raison pour afficher un message clair au lieu d'une carte vide.
    if (cfg.error || !r.ok) return { couches: [], erreur: cfg.error || 'Carte indisponible.' };
    return {
      fonds: cfg.fonds, fondDefaut: cfg.fondDefaut, vue3d: cfg.vue3d, bbox: cfg.bbox || '',
      emprise: cfg.emprise || '', centre: cfg.centre || '', zoom: cfg.zoom ?? null,
      terrain: cfg.terrain || null, pilote: !!cfg.pilote_territoire,
      couches: (cfg.couches || []).map((c, i) => ({
        ...c, couleur: c.couleur || COULEURS[i % COULEURS.length],
      })),
    };
  }
  const rids = (div.dataset.rid || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    fonds: ['osm', 'plan', 'photo'], fondDefaut: 'osm', vue3d: true,
    couches: rids.map((rid, i) => ({
      type: 'catalogue', dataset: rid, visible: true, activable: rids.length > 1,
      couleur: COULEURS[i % COULEURS.length],
    })),
  };
}

async function ajouterCatalogue(map, maplibregl, c, i, bounds) {
  const r = await fetch(`/api/carte?rid=${c.dataset}`);
  const d = await r.json().catch(() => ({}));

  // Donnée du catalogue à géométrie (colonne geom : polygones, lignes, points) :
  // rendue comme une couche GeoJSON, pas seulement en points lat/lon.
  if (d.geojson?.features?.length) {
    const src = `c${i}`;
    const vis = c.visible ? 'visible' : 'none';
    const col = c.couleur;
    map.addSource(src, { type: 'geojson', data: d.geojson });
    map.addLayer({
      id: `${src}-fill`, type: 'fill', source: src,
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
      layout: { visibility: vis }, paint: { 'fill-color': col, 'fill-opacity': 0.35 },
    });
    map.addLayer({
      id: `${src}-line`, type: 'line', source: src,
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'], true, false],
      layout: { visibility: vis }, paint: { 'line-color': col, 'line-width': 1.6 },
    });
    map.addLayer({
      id: `${src}-circle`, type: 'circle', source: src,
      filter: ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
      layout: { visibility: vis },
      paint: { 'circle-radius': 6, 'circle-color': col, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' },
    });
    for (const suf of ['fill', 'line', 'circle']) popupGeojson(map, maplibregl, `${src}-${suf}`);
    etendreBounds(bounds, d.geojson.features);
    return c.label || d.titre || `Couche ${i + 1}`;
  }

  if (!d.points?.length) return null;
  const geojson = {
    type: 'FeatureCollection',
    features: d.points.map((p) => {
      bounds.extend([p.lon, p.lat]);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: p.props };
    }),
  };
  map.addSource(`c${i}`, { type: 'geojson', data: geojson });
  map.addLayer({
    id: `c${i}`, type: 'circle', source: `c${i}`,
    layout: { visibility: c.visible ? 'visible' : 'none' },
    paint: {
      'circle-radius': 6, 'circle-color': c.couleur,
      'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9,
    },
  });
  map.on('click', `c${i}`, (e) => {
    const p = e.features[0].properties;
    const lignes = Object.entries(p).filter(([, v]) => v !== '' && v != null).slice(0, 8)
      .map(([k, v]) => `<strong>${k}</strong> : ${String(v).slice(0, 120)}`).join('<br>');
    new maplibregl.Popup({ maxWidth: '320px' }).setLngLat(e.lngLat).setHTML(lignes).addTo(map);
  });
  map.on('mouseenter', `c${i}`, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', `c${i}`, () => { map.getCanvas().style.cursor = ''; });
  return c.label || d.titre || `Couche ${i + 1}`;
}

function ajouterWms(map, c, i) {
  const base = c.url;
  // URL WMS GetMap SANS BBOX, encodée ; le BBOX (token MapLibre) reste littéral
  // dans /api/wms?bbox=... (proxy même origine, contourne l'absence de CORS WMS).
  const wms = `${base}${base.includes('?') ? '&' : '?'}SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${encodeURIComponent(c.couche || '')}&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=256&HEIGHT=256`;
  map.addSource(`c${i}`, {
    type: 'raster', tileSize: 256,
    tiles: [`/api/wms?bbox={bbox-epsg-3857}&u=${encodeURIComponent(wms)}`],
  });
  map.addLayer({
    id: `c${i}`, type: 'raster', source: `c${i}`,
    layout: { visibility: c.visible ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.8 },
  });
  return c.label || `Couche WMS ${i + 1}`;
}

async function ajouterWfs(map, maplibregl, c, i, bounds) {
  const base = c.url;
  const u = `${base}${base.includes('?') ? '&' : '?'}SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${encodeURIComponent(c.couche || '')}&OUTPUTFORMAT=geojson&SRSNAME=EPSG:4326&COUNT=5000`;
  const r = await fetch(`/api/wfs?u=${encodeURIComponent(u)}`);
  const gj = await r.json().catch(() => null);
  if (!gj?.features?.length) return null;
  const src = `c${i}`;
  const vis = c.visible ? 'visible' : 'none';
  const col = c.couleur;
  map.addSource(src, { type: 'geojson', data: gj });
  // polygones (remplissage), lignes et contours, points : rendus selon la géométrie
  map.addLayer({
    id: `${src}-fill`, type: 'fill', source: src,
    filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
    layout: { visibility: vis }, paint: { 'fill-color': col, 'fill-opacity': 0.35 },
  });
  map.addLayer({
    id: `${src}-l`, type: 'line', source: src,
    filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'], true, false],
    layout: { visibility: vis }, paint: { 'line-color': col, 'line-width': 2 },
  });
  map.addLayer({
    id: `${src}-circle`, type: 'circle', source: src,
    filter: ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
    layout: { visibility: vis },
    paint: { 'circle-radius': 5, 'circle-color': col, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' },
  });
  for (const suf of ['fill', 'circle']) popupGeojson(map, maplibregl, `${src}-${suf}`);
  etendreBounds(bounds, gj.features);
  return c.label || `Couche WFS ${i + 1}`;
}

// Choroplèthe par jointure : géométrie = contours partagés (WFS ou GeoJSON),
// valeurs = un jeu tabulaire du catalogue (code + valeur), jointes par code.
// Chaque contour est coloré selon sa valeur (dégradé du clair à la couleur de la
// couche). Aucune géométrie n'est recopiée dans le jeu thématique.
async function ajouterChoroplethe(map, maplibregl, c, i, bounds, pilote) {
  const ct = c.contour || {};
  let gj = null;
  if (ct.wfs) {
    const u = `${ct.wfs.url}&SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${encodeURIComponent(ct.wfs.couche)}&OUTPUTFORMAT=geojson&SRSNAME=EPSG:4326&COUNT=60000`;
    gj = await fetch(`/api/wfs?u=${encodeURIComponent(u)}`).then((r) => r.json()).catch(() => null);
  } else if (ct.geojson) {
    gj = await fetch(ct.geojson).then((r) => r.json()).catch(() => null);
  }
  if (!gj?.features?.length) return null;

  // jointure : colonne code côté DONNÉES (code_col) et propriété code côté GÉOMÉTRIE
  // (geo_code_col) peuvent différer (ex : code_commune ↔ code). Défaut : 'code'.
  const codeCol = c.code_col || 'code';
  const geoCol = c.geo_code_col || 'code';
  const valCol = c.valeur_col;
  const data = await fetch(`/api/territoire?rid=${encodeURIComponent(c.dataset)}`).then((r) => r.json()).catch(() => null);
  const vmap = new Map();
  const nmap = new Map();
  // nom du territoire (pour la sélection) : 1re colonne parlante du jeu tabulaire
  const nomCol = (data?.fields || []).find((f) => /nom|libell|territoire|commune|epci|departement|region/i.test(f)) || 'nom';
  for (const r of (data?.records || [])) {
    const k = String(r[codeCol] ?? '').toUpperCase();
    const v = Number(String(r[valCol] ?? '').replace(',', '.'));
    if (k && Number.isFinite(v)) vmap.set(k, v);
    if (k && r[nomCol]) nmap.set(k, String(r[nomCol]));
  }
  let min = Infinity; let max = -Infinity;
  for (const f of gj.features) {
    const p = f.properties || (f.properties = {});
    const code = String(p[geoCol] ?? p.code ?? '').toUpperCase();
    p._code = code;  // clé normalisée pour la sélection et le surlignage
    const v = vmap.has(code) ? vmap.get(code) : null;
    p._val = v;
    if (v != null) { if (v < min) min = v; if (v > max) max = v; }
  }
  if (!Number.isFinite(min)) return null;
  if (min === max) max = min + 1;

  const src = `ch${i}`;
  const vis = c.visible ? 'visible' : 'none';
  const teinte = c.couleur || '#2f5496';
  map.addSource(src, { type: 'geojson', data: gj });
  map.addLayer({
    id: `${src}-fill`, type: 'fill', source: src, layout: { visibility: vis },
    paint: {
      'fill-color': ['case', ['==', ['get', '_val'], null], '#e6e6e6',
        ['interpolate', ['linear'], ['get', '_val'], min, '#eef3f8', max, teinte]],
      'fill-opacity': 0.82,
    },
  });
  map.addLayer({
    id: `${src}-l`, type: 'line', source: src, layout: { visibility: vis },
    paint: { 'line-color': '#ffffff', 'line-width': 0.6 },
  });
  // couche de surlignage du territoire sélectionné (partagé avec les graphiques
  // de la page via le bus territoireBus). Vide tant qu'aucun territoire n'est choisi.
  map.addLayer({
    id: `${src}-sel`, type: 'line', source: src, layout: { visibility: vis },
    paint: { 'line-color': '#c2571a', 'line-width': 3 },
    filter: ['==', ['get', '_code'], ' '],
  });

  if (pilote) {
    // carte pilote : le clic sélectionne le territoire (et le rediffuse à la page).
    // Recliquer la même zone désélectionne (retour à l'ensemble).
    map.on('click', `${src}-fill`, (e) => {
      const p = e.features[0].properties || {};
      const code = p._code || '';
      if (!code) return;
      const cur = getSelection();
      const nom = nmap.get(code) || p.nom || p[geoCol] || code;
      // pas de `rid` : chaque graphique « portée territoire » de la page garde SON
      // propre jeu et se filtre sur le `code` du territoire choisi (blocs indépendants).
      setSelection((cur && String(cur.code).toUpperCase() === code)
        ? null
        : { niveau: c.label || 'territoire', code, nom });
    });
  } else {
    // carte non pilote : le clic ouvre une infobulle de valeur (comportement d'origine).
    map.on('click', `${src}-fill`, (e) => {
      const p = e.features[0].properties || {};
      const nom = nmap.get(p._code) || p.nom || p[geoCol] || p.code || '';
      const val = (p._val === null || p._val === undefined || p._val === '') ? 'non disponible' : p._val;
      new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(e.lngLat)
        .setHTML(`<strong>${nom}</strong><br>${valCol || 'valeur'} : ${val}`).addTo(map);
    });
  }
  // surlignage réactif : reflète le territoire courant, qu'il vienne de cette carte
  // ou d'un autre composant de la page.
  const surligner = (sel) => {
    const code = sel && sel.code ? String(sel.code).toUpperCase() : ' ';
    if (map.getLayer(`${src}-sel`)) map.setFilter(`${src}-sel`, ['==', ['get', '_code'], code]);
  };
  const off = onSelection(surligner);
  surligner(getSelection());
  map.on('remove', off);

  map.on('mouseenter', `${src}-fill`, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', `${src}-fill`, () => { map.getCanvas().style.cursor = ''; });
  etendreBounds(bounds, gj.features);
  legendeChoro(map, c.label || valCol, min, max, teinte);
  return c.label || `Choroplèthe ${i + 1}`;
}

// Légende dégradée d'une choroplèthe (min → max), en bas à droite de la carte.
function legendeChoro(map, titre, min, max, teinte) {
  const cont = map.getContainer();
  const el = document.createElement('div');
  el.className = 'dtz-legende-choro';
  const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100);
  el.innerHTML = `<div class="dtz-legende-titre">${titre || ''}</div>`
    + `<div class="dtz-legende-barre" style="background:linear-gradient(90deg,#eef3f8,${teinte})"></div>`
    + `<div class="dtz-legende-bornes"><span>${fmt(min)}</span><span>${fmt(max)}</span></div>`;
  cont.appendChild(el);
}

// Étend l'emprise (LngLatBounds) avec toutes les coordonnées de features GeoJSON.
function etendreBounds(bounds, features) {
  const walk = (co) => {
    if (typeof co[0] === 'number') { bounds.extend([co[0], co[1]]); return; }
    for (const c of co) walk(c);
  };
  for (const f of features) if (f.geometry?.coordinates) walk(f.geometry.coordinates);
}

// Infobulle d'attributs au clic sur une couche GeoJSON (comme le mode catalogue).
function popupGeojson(map, maplibregl, layerId) {
  map.on('click', layerId, (e) => {
    const p = e.features[0].properties || {};
    const lignes = Object.entries(p)
      .filter(([k, v]) => !k.startsWith('_') && v !== '' && v != null)
      .slice(0, 8)
      .map(([k, v]) => `<strong>${k}</strong> : ${String(v).slice(0, 120)}`)
      .join('<br>');
    if (lignes) new maplibregl.Popup({ maxWidth: '320px' }).setLngLat(e.lngLat).setHTML(lignes).addTo(map);
  });
  map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
}

// Couche GeoJSON du catalogue (rid CKAN via /api/geojson). is3d = extrusion 3D.
// Polygones/lignes/points sont rendus selon la géométrie. Pour les jeux
// volumineux (proxy tronqué à MAX_FEATURES côté serveur), la couche recharge
// l'emprise visible au déplacement de la carte (paramètre bbox).
async function ajouterGeojson(map, maplibregl, c, i, bounds, is3d, ctx) {
  const rid = c.geojson_rid;
  if (!rid || !/^[a-f0-9-]{36}$/.test(rid)) return null;
  const r = await fetch(`/api/geojson?rid=${rid}`);
  const gj = await r.json().catch(() => null);
  if (!gj || !gj.features?.length) return null;
  const src = `c${i}`;
  const vis = c.visible ? 'visible' : 'none';
  const col = c.couleur;
  map.addSource(src, { type: 'geojson', data: gj });
  if (is3d) {
    const attr = c.hauteur_attr || 'hauteur';
    map.addLayer({
      id: `${src}-3d`, type: 'fill-extrusion', source: src,
      layout: { visibility: vis },
      paint: {
        'fill-extrusion-color': col,
        'fill-extrusion-height': ['coalesce', ['to-number', ['get', attr]], 0],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.85,
      },
    });
    popupGeojson(map, maplibregl, `${src}-3d`);
    if (ctx) ctx.besoin3d = true;
  } else {
    // couleur par entité si la donnée porte une propriété « couleur »
    // (cartes d'intensité : pollution, bruit…), sinon couleur de la couche.
    const colExpr = ['coalesce', ['get', 'couleur'], col];
    map.addLayer({
      id: `${src}-fill`, type: 'fill', source: src,
      filter: ['==', ['geometry-type'], 'Polygon'],
      layout: { visibility: vis },
      // opacité plus forte pour les cartes d'intensité (entités porteuses d'une
      // couleur propre), plus légère pour les autres polygones (parcelles…).
      paint: { 'fill-color': colExpr, 'fill-opacity': ['case', ['has', 'couleur'], 0.72, 0.4] },
    });
    map.addLayer({
      id: `${src}-line`, type: 'line', source: src,
      filter: ['match', ['geometry-type'], ['Polygon', 'LineString'], true, false],
      layout: { visibility: vis },
      paint: { 'line-color': colExpr, 'line-width': 1.6 },
    });
    map.addLayer({
      id: `${src}-circle`, type: 'circle', source: src,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: { visibility: vis },
      paint: {
        'circle-radius': 5, 'circle-color': colExpr,
        'circle-stroke-width': 1, 'circle-stroke-color': '#fff',
      },
    });
    for (const suf of ['fill', 'line', 'circle']) popupGeojson(map, maplibregl, `${src}-${suf}`);
  }
  etendreBounds(bounds, gj.features);

  if (gj._tronque) {
    // couche volumineuse : recharge l'emprise visible au déplacement (bbox)
    if (ctx) ctx.notes.push(
      `« ${c.label || 'couche'} » : jeu volumineux, ${gj._retour} objets affichés sur ${gj._total}. `
      + 'Zoomez ou déplacez la carte pour recharger l\'emprise visible.');
    let enCours = false;
    const recharger = async () => {
      if (enCours || !map.getSource(src)) return;
      enCours = true;
      try {
        const b = map.getBounds();
        const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',');
        const rr = await fetch(`/api/geojson?rid=${rid}&bbox=${bbox}`);
        const g2 = await rr.json().catch(() => null);
        if (g2?.features && map.getSource(src)) map.getSource(src).setData(g2);
      } catch { /* on garde les données actuelles */ }
      enCours = false;
    };
    map.on('moveend', recharger);
  }
  return c.label || `Couche ${i + 1}`;
}

function ajouterBatiments3d(map) {
  // bâtiments extrudés (tuiles vectorielles OpenFreeMap, schéma OpenMapTiles)
  if (map.getSource('ofm')) return;
  map.addSource('ofm', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
  map.addLayer({
    id: 'batiments3d', type: 'fill-extrusion', source: 'ofm', 'source-layer': 'building',
    minzoom: 14, layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': '#b7c0cc',
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.85,
    },
  });
}

// Filtre global de page appliqué à la carte : sur chaque couche de données (source
// geojson) DONT les entités portent le champ filtré, on ajoute une condition
// `champ == valeur` (en préservant un éventuel filtre de base) ; on ignore les couches
// de surlignage (`-sel`) et celles sans le champ (elles restent complètes). Restaure
// le filtre de base quand le filtre global est levé.
function appliquerFiltreCarte(map, filt) {
  map._dtzOrig = map._dtzOrig || {};
  let layers = [];
  try { layers = (map.getStyle().layers) || []; } catch { return; }
  for (const lyr of layers) {
    if (!lyr.source || /-sel$/.test(lyr.id)) continue;
    const src = map.getSource(lyr.source);
    if (!src || (src.type && src.type !== 'geojson')) continue;
    let data;
    try { data = src.serialize().data; } catch { continue; }
    if (!data || typeof data === 'string' || !Array.isArray(data.features) || !data.features.length) continue;
    const active = !!(filt && filt.field && filt.value != null && filt.value !== '');
    const hasField = active && data.features.some(
      (f) => f.properties && Object.prototype.hasOwnProperty.call(f.properties, filt.field));
    if (active && hasField) {
      if (!(lyr.id in map._dtzOrig)) map._dtzOrig[lyr.id] = map.getFilter(lyr.id) ?? null;
      const base = map._dtzOrig[lyr.id];
      const cond = ['==', ['to-string', ['get', filt.field]], String(filt.value)];
      map.setFilter(lyr.id, base ? ['all', base, cond] : cond);
    } else if (lyr.id in map._dtzOrig) {
      map.setFilter(lyr.id, map._dtzOrig[lyr.id]);   // restaure le filtre de base
      delete map._dtzOrig[lyr.id];
    }
  }
}

async function monter(div, maplibregl) {
  const conf = await lireCouches(div);
  if (!conf || !conf.couches.length) {
    // message clair : carte non publiée / introuvable (conf.erreur) vs carte sans couche.
    const msg = conf && conf.erreur
      ? 'Carte non disponible : elle n\'est pas publiée ou est introuvable.'
      : 'Carte : aucune couche à afficher.';
    div.innerHTML = `<p class="meta" style="padding:1rem">🗺️ ${msg}</p>`;
    return;
  }
  const fond0 = FONDS[conf.fondDefaut] || FONDS.osm;
  const map = new maplibregl.Map({
    container: div,
    style: {
      version: 8,
      sources: { fond: { type: 'raster', tiles: fond0.tiles, tileSize: 256, attribution: fond0.attribution } },
      layers: [{ id: 'fond', type: 'raster', source: 'fond' }],
    },
    cooperativeGestures: true,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));

  // Recadre le canvas quand le conteneur change de taille (MapLibre ne suit que
  // la fenêtre) : indispensable pour les conteneurs dimensionnés après le montage,
  // p. ex. l'aperçu plein cadre en iframe (position:fixed), sinon le canvas reste
  // à sa taille initiale de repli (400×300).
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(div);
    map.on('remove', () => ro.disconnect());
  }

  map.on('load', async () => {
    const bounds = new maplibregl.LngLatBounds();
    const meta = [];
    const ctx = { notes: [], besoin3d: false };
    for (let i = 0; i < conf.couches.length; i++) {
      const c = conf.couches[i];
      let label = null;
      try {
        if (c.type === 'wms') label = ajouterWms(map, c, i);
        else if (c.type === 'choroplethe') label = await ajouterChoroplethe(map, maplibregl, c, i, bounds, conf.pilote);
        else if (c.type === 'wfs') label = await ajouterWfs(map, maplibregl, c, i, bounds);
        else if (c.type === 'geojson') label = await ajouterGeojson(map, maplibregl, c, i, bounds, false, ctx);
        else if (c.type === 'geojson3d') label = await ajouterGeojson(map, maplibregl, c, i, bounds, true, ctx);
        else label = await ajouterCatalogue(map, maplibregl, c, i, bounds);
      } catch { /* couche ignorée si erreur */ }
      if (label) meta.push({ i, label, couleur: c.couleur, activable: c.activable });
    }
    // Filtre global de page (bloc Filtre) : la carte s'y abonne et filtre ses couches
    // de données (celles dont les entités ont le champ). Générique, comme les graphiques.
    try {
      const offF = onFiltre((filt) => { try { appliquerFiltreCarte(map, filt); } catch { /* couche non filtrable */ } });
      appliquerFiltreCarte(map, getFiltre());
      map.on('remove', offF);
    } catch { /* filtre global optionnel */ }
    // liens « Source » vers les fiches des jeux de données affichés (sous la carte)
    try {
      const srcs = [];
      for (const c of conf.couches) {
        if (c.source && c.source.slug && !srcs.some((s) => s.slug === c.source.slug)) srcs.push(c.source);
      }
      const prev = div.parentNode && div.parentNode.querySelector(':scope > .source-lien');
      if (prev) prev.remove();
      if (srcs.length && div.parentNode) {
        const p = document.createElement('p');
        p.className = 'source-lien';
        p.innerHTML = 'Source : ' + srcs.map((s) =>
          `<a href="/dataset/${encodeURIComponent(s.slug)}">${s.titre}</a>`).join(', ');
        div.insertAdjacentElement('afterend', p);
      }
    } catch { /* liens source optionnels */ }
    const construirePanneau = () => {
    try {
      // Vue initiale, par ordre de priorité : (1) emprise explicite, (2) centre+zoom
      // explicites, (3) cadrage automatique sur les données affichées.
      const empriseManuelle = (conf.emprise || '').split(',').map(Number);
      const centre = (conf.centre || '').split(',').map(Number);
      if (empriseManuelle.length === 4 && empriseManuelle.every(Number.isFinite)) {
        const [w, s, e, n] = empriseManuelle;
        map.fitBounds([[w, s], [e, n]], { padding: 20, animate: false });
      } else if (centre.length === 2 && centre.every(Number.isFinite) && Number.isFinite(conf.zoom)) {
        map.jumpTo({ center: [centre[0], centre[1]], zoom: conf.zoom });
      } else if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 45, maxZoom: 15, animate: false });
      else if (conf.bbox) {
        // emprise fournie (aperçu WMS : pas de géométrie côté client)
        const [w, s, e, n] = conf.bbox.split(',').map(Number);
        if ([w, s, e, n].every(Number.isFinite)) {
          map.fitBounds([[w, s], [e, n]], { padding: 30, maxZoom: 15, animate: false });
        }
      }
    } catch { /* bounds dégénéré */ }
    try { if (conf.vue3d) ajouterBatiments3d(map); } catch { /* bâtiments 3D indisponibles */ }
    // vue 3D automatique quand une couche GeoJSON 3D (extrusion) est présente
    try { if (ctx.besoin3d) { map.setPitch(55); map.setBearing(-17); } } catch { /* pitch indisponible */ }
    // relief 3D (raster-dem PMTiles terrain-RGB) : source + terrain + ciel, si configuré
    let terrainActif = false;
    if (conf.terrain && conf.terrain.url) {
      try {
        map.addSource('dem', {
          type: 'raster-dem', url: `pmtiles://${conf.terrain.url}`,
          encoding: conf.terrain.encoding || 'mapbox', tileSize: conf.terrain.tileSize || 512,
        });
        map.setTerrain({ source: 'dem', exaggeration: conf.terrain.exaggeration || 1.5 });
        map.setPitch(Math.max(map.getPitch(), 60));
        terrainActif = true;
        // ciel atmosphérique (facultatif, API selon version MapLibre) : n'empêche
        // jamais le relief si indisponible.
        try {
          map.setSky({ 'sky-color': '#a9c8e8', 'horizon-color': '#eaf0f6',
            'fog-color': '#ffffff', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6 });
        } catch { /* ciel optionnel */ }
      } catch { terrainActif = false; }
    }

    // panneau de contrôle : fonds, couches, 3D
    const panneau = document.createElement('div');
    panneau.className = 'dtz-carte-controles';
    panneau.setAttribute('role', 'group');
    panneau.setAttribute('aria-label', 'Options de la carte');

    if (conf.fonds.length > 1) {
      const gf = document.createElement('div');
      gf.className = 'groupe';
      for (const id of conf.fonds) {
        const f = FONDS[id];
        if (!f) continue;
        const b = bouton(f.nom, `Fond de carte : ${f.nom}`, () => {
          map.getSource('fond').setTiles(f.tiles);
          gf.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
        }, id === conf.fondDefaut);
        gf.appendChild(b);
      }
      panneau.appendChild(gf);
    }
    const activables = meta.filter((m) => m.activable);
    if (activables.length) {
      const gc = document.createElement('div');
      gc.className = 'groupe';
      for (const m of meta) {
        if (!m.activable) continue;
        const ids = [`c${m.i}`, `c${m.i}-l`, `c${m.i}-fill`, `c${m.i}-line`,
          `c${m.i}-circle`, `c${m.i}-3d`].filter((x) => map.getLayer(x));
        const b = bouton(m.label, `Afficher ou masquer : ${m.label}`, () => {
          const vis = map.getLayoutProperty(ids[0], 'visibility') !== 'none';
          ids.forEach((id) => map.setLayoutProperty(id, 'visibility', vis ? 'none' : 'visible'));
          b.setAttribute('aria-pressed', String(!vis));
        }, map.getLayoutProperty(ids[0], 'visibility') !== 'none');
        b.style.borderLeft = `4px solid ${m.couleur}`;
        gc.appendChild(b);
      }
      panneau.appendChild(gc);
    }
    const g3 = document.createElement('div');
    g3.className = 'groupe';
    const b3d = bouton('3D', 'Basculer la vue 3D (bâtiments)', () => {
      const en3d = map.getPitch() > 0;
      map.easeTo({ pitch: en3d ? 0 : 60, bearing: en3d ? 0 : -18, duration: 600 });
      if (map.getLayer('batiments3d')) {
        map.setLayoutProperty('batiments3d', 'visibility', en3d ? 'none' : 'visible');
      }
      b3d.setAttribute('aria-pressed', String(!en3d));
    }, false);
    g3.appendChild(b3d);
    // bascule du relief (terrain PMTiles) quand la carte en dispose
    if (conf.terrain && conf.terrain.url) {
      const bRelief = bouton('Relief', 'Activer ou désactiver le relief du terrain', () => {
        const on = !!map.getTerrain();
        if (on) { map.setTerrain(null); }
        else {
          if (!map.getSource('dem')) {
            map.addSource('dem', { type: 'raster-dem', url: `pmtiles://${conf.terrain.url}`,
              encoding: conf.terrain.encoding || 'mapbox', tileSize: conf.terrain.tileSize || 512 });
          }
          map.setTerrain({ source: 'dem', exaggeration: conf.terrain.exaggeration || 1.5 });
          if (map.getPitch() === 0) map.easeTo({ pitch: 60, duration: 500 });
        }
        bRelief.setAttribute('aria-pressed', String(!on));
      }, terrainActif);
      g3.appendChild(bRelief);
    }
    panneau.appendChild(g3);
    div.appendChild(panneau);

    // note pour les couches volumineuses rechargées par emprise (bbox)
    if (ctx.notes.length) {
      const note = document.createElement('p');
      note.className = 'dtz-carte-note meta';
      note.setAttribute('role', 'status');
      note.textContent = ctx.notes.join(' ');
      div.appendChild(note);
    }
    };
    try { construirePanneau(); } catch { /* contrôles indisponibles, la carte reste utilisable */ }
  });
}

export default function CartesLoader() {
  useEffect(() => {
    const divs = [...document.querySelectorAll('.dtz-carte[data-rid], .dtz-carte[data-config], .dtz-carte[data-fiche]')]
      .filter((d) => !d.dataset.monte);
    if (!divs.length) return;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      // protocole PMTiles (relief terrain-RGB servi en .pmtiles), enregistré une fois
      try {
        if (!window.__pmtilesEnregistre) {
          const { Protocol } = await import('pmtiles');
          const proto = new Protocol();
          maplibregl.addProtocol('pmtiles', proto.tile);
          window.__pmtilesEnregistre = true;
        }
      } catch { /* relief PMTiles indisponible, les cartes restent en 2D */ }
      for (const div of divs) {
        if (div.dataset.monte) continue;
        div.dataset.monte = '1';
        monter(div, maplibregl).catch(() => {
          div.innerHTML = '<p class="meta" style="padding:1rem">Carte indisponible.</p>';
        });
      }
    })();
  });
  return null;
}
