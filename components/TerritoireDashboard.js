'use client';
// Tableau de bord territorial : une carte choroplèthe sert de SÉLECTEUR (clic
// sur un territoire) et filtre un panneau d'indicateurs + un graphique.
// Plusieurs NIVEAUX territoriaux (ex. Départements / EPCI) commutables : chaque
// niveau = un jeu d'indicateurs (datastore) + un contour (GeoJSON CKAN ou fichier).
// Cible : <div class="dtz-territoire" data-niveaux='[{label,rid,geo,code}]'>
//   ou (niveau unique) data-rid=... data-geo=... data-code=...
// MapLibre + ECharts auto-hébergés, chargés à la demande.
import { useEffect } from 'react';
import { setSelection, onIndicateur } from './territoireBus';

let echartsP = null;
function loadECharts() {
  if (window.echarts) return Promise.resolve(window.echarts);
  if (echartsP) return echartsP;
  echartsP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/echarts/echarts.min.js';
    s.onload = () => res(window.echarts); s.onerror = rej;
    document.head.appendChild(s);
  });
  return echartsP;
}

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const geoUrlDe = (raw) => !raw ? '/geo/bfc-departements.geojson'
  : /^[a-f0-9-]{36}$/.test(raw) ? `/api/geojson?rid=${raw}`
  : raw.startsWith('/') ? raw : `/geo/${raw}`;

// Registre d'indicateurs : libellé, unité, décimales, mode d'agrégation
// régionale (quand aucun territoire n'est sélectionné), thème, et si
// l'indicateur peut être cartographié (bouton + choroplèthe).
// agg : sum | dens | wpop (moyenne pondérée population) | wmen | wsup
const INDIC_DEFAUT = {
  population: { l: 'Habitants', u: '', d: 0, agg: 'sum', carto: 1, th: 'demo' },
  densite: { l: 'Densité', u: ' hab/km²', d: 0, agg: 'dens', carto: 1, th: 'demo' },
  superficie_km2: { l: 'Superficie', u: ' km²', d: 0, agg: 'sum', th: 'demo' },
  communes: { l: 'Communes', u: '', d: 0, agg: 'sum', th: 'demo' },
  evolution_pop_pct: { l: 'Évolution de la population', u: ' %', d: 1, agg: 'wpop', carto: 1, th: 'demo' },
  part_moins_25: { l: 'Moins de 25 ans', u: ' %', d: 1, agg: 'wpop', th: 'demo' },
  part_25_64: { l: '25 à 64 ans', u: ' %', d: 1, agg: 'wpop', th: 'demo' },
  part_65_plus: { l: '65 ans et plus', u: ' %', d: 1, agg: 'wpop', carto: 1, th: 'sante',
    s: ['#eef4f0', 18, '#cfe6da', 22, '#8fceac', 26, '#4ea87c', 30, '#14396b'] },
  menages: { l: 'Ménages', u: '', d: 0, agg: 'sum', th: 'habitat' },
  evolution_menages_pct: { l: 'Évolution des ménages', u: ' %', d: 1, agg: 'wpop', th: 'habitat' },
  taille_moyenne_menage: { l: 'Taille moyenne des ménages', u: '', d: 2, agg: 'wmen', th: 'habitat' },
  part_menage_1_personne: { l: "Ménages d'une personne", u: ' %', d: 1, agg: 'wmen', carto: 1, th: 'habitat' },
  part_artificialise: { l: 'Sols artificialisés', u: ' %', d: 1, agg: 'wsup', carto: 1, th: 'env',
    s: ['#f3eee9', 3, '#e6c9a8', 6, '#d99a5c', 10, '#b5651d', 20, '#7a3e0a'] },
  part_agricole: { l: 'Sols agricoles', u: ' %', d: 1, agg: 'wsup', th: 'env' },
  part_foret: { l: 'Forêts', u: ' %', d: 1, agg: 'wsup', carto: 1, th: 'env' },
  part_eau_zh: { l: 'Eau et zones humides', u: ' %', d: 1, agg: 'wsup', th: 'env' },
  artificialisation_ha_2009_2024: { l: 'Artificialisation 2009-2024', u: ' ha', d: 1, agg: 'sum', th: 'env' },
  recettes_fonct: { l: 'Recettes de fonctionnement', u: ' €/hab', d: 0, agg: 'wpop', th: 'fin' },
  depenses_fonct: { l: 'Dépenses de fonctionnement', u: ' €/hab', d: 0, agg: 'wpop', th: 'fin' },
  epargne_nette: { l: 'Épargne nette', u: ' €/hab', d: 0, agg: 'wpop', carto: 1, th: 'fin' },
  encours_dette: { l: 'Encours de dette', u: ' €/hab', d: 0, agg: 'wpop', carto: 1, th: 'fin' },
  depenses_equipement: { l: "Dépenses d'équipement", u: ' €/hab', d: 0, agg: 'wpop', th: 'fin' },
  // indicateurs consolidés (jeux « portrait » multi-niveaux)
  part_75_plus: { l: '75 ans et plus', u: ' %', d: 1, agg: 'wpop', th: 'sante' },
  niveau_vie_median: { l: 'Niveau de vie médian', u: ' €', d: 0, agg: 'wpop', carto: 1, th: 'eco' },
  taux_pauvrete: { l: 'Taux de pauvreté', u: ' %', d: 1, agg: 'wpop', carto: 1, th: 'eco' },
  nb_menages: { l: 'Ménages', u: '', d: 0, agg: 'sum', th: 'habitat' },
  taux_vacance: { l: 'Vacance des logements', u: ' %', d: 1, agg: 'wmen', carto: 1, th: 'habitat' },
  part_logements_sociaux: { l: 'Logements sociaux', u: ' %', d: 1, agg: 'wmen', carto: 1, th: 'habitat' },
  apl_mg: { l: 'Accès médecins généralistes (APL)', u: '', d: 1, agg: 'wpop', carto: 1, th: 'sante' },
  apl_inf: { l: 'Accès infirmiers (APL)', u: '', d: 1, agg: 'wpop', th: 'sante' },
  apl_dent: { l: 'Accès dentistes (APL)', u: '', d: 1, agg: 'wpop', th: 'sante' },
};
const THEMES_DEFAUT = [['demo', 'Démographie'], ['eco', 'Économie'], ['habitat', 'Habitat'],
  ['env', 'Environnement'], ['sante', 'Santé et vieillissement'],
  ['fin', 'Finances locales'], ['autre', 'Autres indicateurs']];

// Construit le registre d'indicateurs et l'ordre des thèmes à partir d'un
// tableau de bord configuré dans Directus (/api/tableau-bord). Renvoie null si
// pas de config (le composant retombe alors sur les valeurs par défaut).
async function configTableauBord(el) {
  if (!el.dataset.tb) return null;
  try {
    const cfg = await fetch(`/api/tableau-bord?id=${encodeURIComponent(el.dataset.tb)}`).then((r) => r.json());
    if (!cfg || !cfg.niveaux || !cfg.niveaux.length) return null;
    const indic = {}; const ordre = [];
    for (const i of cfg.indicateurs || []) {
      indic[i.colonne] = { l: i.libelle, u: i.unite || '', d: i.d || 0, agg: i.agg || 'sum',
                           th: i.th || 'autre', carto: i.carto ? 1 : 0, s: i.s };
      if (!ordre.includes(i.th)) ordre.push(i.th);
    }
    return { niveaux: cfg.niveaux, indic, themes: ordre.map((t) => [t, t]), ensemble: cfg.ensemble || '' };
  } catch { return null; }
}

function niveauxDe(el) {
  if (el.dataset.niveaux) {
    try {
      return JSON.parse(el.dataset.niveaux).map((n) => ({
        label: n.label, rid: n.rid, geo: n.geo || '', code: n.code || 'code', nom: n.nom || 'nom',
      }));
    } catch { /* ignore */ }
  }
  return [{ label: 'Territoire', rid: el.dataset.rid, geo: el.dataset.geo || '',
            code: el.dataset.code || 'code', nom: el.dataset.nom || 'departement' }];
}

async function monter(el, maplibregl, echarts) {
  // tableau de bord configuré (data-tb) ou config historique (data-niveaux)
  const tb = await configTableauBord(el);
  const indic = tb ? tb.indic : INDIC_DEFAUT;
  const themesOrdre = tb ? tb.themes : THEMES_DEFAUT;
  const niveaux = tb
    ? tb.niveaux.map((n) => ({ label: n.label, rid: n.rid, geo: n.geo, code: n.code || 'code',
                              geoCode: n.geoCode || n.code || 'code', nom: 'nom' }))
    : niveauxDe(el);
  // Nom de l'« ensemble » (vue avant sélection) : configurable par tableau (champ territoire),
  // sinon attribut data-ensemble, sinon défaut historique (Bourgogne-Franche-Comté).
  const ensemble = (tb && tb.ensemble) || el.dataset.ensemble || '';
  const lib = (k) => (indic[k] ? indic[k].l : k);
  const fmtV = (v, k) => {
    const m = indic[k] || { d: 0, u: '' };
    const s = (Number.isFinite(v) ? v : 0).toLocaleString('fr-FR',
      { minimumFractionDigits: m.d || 0, maximumFractionDigits: m.d || 0 });
    return s + (m.u || '');
  };
  const nomCandidats = ['departement', 'epci', 'nom', 'libelle', 'territoire'];

  el.innerHTML = '';
  const levelBar = document.createElement('div');
  levelBar.className = 'terr-niveaux';
  levelBar.setAttribute('role', 'group');
  levelBar.setAttribute('aria-label', 'Niveau territorial');
  const metricBar = document.createElement('div');
  metricBar.className = 'terr-metriques';
  metricBar.setAttribute('role', 'group');
  metricBar.setAttribute('aria-label', 'Indicateur affiché');
  const grille = document.createElement('div');
  grille.className = 'terr-grille';
  const divCarte = document.createElement('div');
  divCarte.className = 'terr-carte';
  const panneau = document.createElement('aside');
  panneau.className = 'terr-panneau';
  // mode carte-sélecteur simple (data-panneau="0") : la carte pilote les
  // graphiques de la page (bus de sélection) sans afficher son propre panneau.
  const avecPanneau = el.dataset.panneau !== '0';
  if (avecPanneau) grille.append(divCarte, panneau);
  else { grille.append(divCarte); grille.classList.add('sans-panneau'); }
  // section « catégorie » pleine largeur sous la carte : bannière du thème de
  // l'indicateur choisi + tous ses indicateurs pour le territoire sélectionné.
  const sectionCat = document.createElement('section');
  sectionCat.className = 'terr-categorie';
  if (niveaux.length > 1) el.append(levelBar);
  el.append(metricBar, grille);
  if (avecPanneau) el.append(sectionCat);

  const map = new maplibregl.Map({
    container: divCarte,
    style: {
      version: 8,
      sources: {
        fond: {
          type: 'raster', tileSize: 256,
          tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}'],
          attribution: '© <a href="https://www.ign.fr/">IGN</a> - Géoplateforme',
        },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#eef3f8' } },
        { id: 'fond', type: 'raster', source: 'fond' },
      ],
    },
    cooperativeGestures: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  const divChart = document.createElement('div');
  divChart.className = 'terr-chart';
  const chart = echarts.init(divChart, null, { renderer: 'svg' });

  // état du niveau courant
  const S = { rows: [], parCode: {}, codeCol: 'code', nomCol: 'nom',
              metrics: [], cartoMetrics: [], metric: 'population', selection: null, label: '',
              cadre: false };

  const domaine = (key) => {
    const vals = S.rows.map((r) => num(r[key])).filter((v) => v > 0);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 1];
  };
  const echelle = (key) => {
    const meta = indic[key] || {};
    // choroplèthe à seuils (paliers de couleur) si l'indicateur en déclare
    if (meta.s && meta.s.length >= 3) {
      return ['step', ['coalesce', ['get', key], -1], ...meta.s];
    }
    const [mn, mx] = domaine(key);
    // domaine dégénéré (ex. niveau Région : un seul territoire, min = max) :
    // l'expression interpolate exige des paliers croissants, sinon la couche
    // ne s'affiche pas. On rend alors une couleur unie.
    if (!(mx > mn)) return '#2f8a61';
    return ['interpolate', ['linear'], ['coalesce', ['get', key], 0],
      mn, '#e3efe8', (mn + mx) / 2, '#5fae86', mx, '#14396b'];
  };

  // rang du territoire sélectionné pour l'indicateur courant (1 = plus élevé)
  const rangSelection = () => {
    if (!S.selection) return null;
    const tri = [...S.rows].sort((a, b) => num(b[S.metric]) - num(a[S.metric]));
    const i = tri.findIndex((r) => String(r[S.codeCol]) === S.selection);
    return i < 0 ? null : { rang: i + 1, total: tri.length };
  };

  // Comparaison lisible quel que soit le nombre de territoires : barres
  // HORIZONTALES (noms en clair) du top 10, plus le territoire sélectionné s'il
  // est au-delà. Au-delà de 14 territoires on ne montre pas tout (illisible).
  const rendreChart = () => {
    const tri = [...S.rows].sort((a, b) => num(b[S.metric]) - num(a[S.metric]));
    const selIdx = S.selection ? tri.findIndex((r) => String(r[S.codeCol]) === S.selection) : -1;
    let vus;
    if (tri.length <= 14) vus = tri;
    else { vus = tri.slice(0, 10); if (selIdx >= 10) vus = [...vus, tri[selIdx]]; }
    const data = [...vus].reverse(); // ECharts: 1re catégorie en bas
    chart.setOption({
      grid: { left: 8, right: 24, top: 6, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v) => fmtV(v, S.metric) },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: data.map((r) => r[S.nomCol]),
        axisLabel: { fontSize: 10, width: 120, overflow: 'truncate' } },
      series: [{ type: 'bar', barMaxWidth: 18, data: data.map((r) => ({
        value: num(r[S.metric]),
        itemStyle: { color: String(r[S.codeCol]) === S.selection ? '#c2571a' : '#2f8a61' },
      })), name: lib(S.metric) }],
    }, true);
  };

  // valeur d'un indicateur pour le territoire sélectionné, ou agrégat régional
  const valeurDe = (key) => {
    const sel = S.selection ? S.parCode[S.selection] : null;
    if (sel) return num(sel[key]);
    const sommeDe = (f) => S.rows.reduce((s, r) => s + f(r), 0);
    const pondere = (k, poids) => {
      const w = sommeDe((r) => num(r[poids]));
      return w ? sommeDe((r) => num(r[k]) * num(r[poids])) / w : 0;
    };
    const agg = (indic[key] || {}).agg;
    if (agg === 'dens') { const su = sommeDe((r) => num(r.superficie_km2)); return su ? sommeDe((r) => num(r.population)) / su : 0; }
    if (agg === 'wpop') return pondere(key, 'population');
    if (agg === 'wmen') return pondere(key, (S.rows[0] && S.rows[0].nb_menages !== undefined) ? 'nb_menages' : 'menages');
    if (agg === 'wsup') return pondere(key, 'superficie_km2');
    return sommeDe((r) => num(r[key]));
  };
  const themeActif = () => (indic[S.metric] || {}).th || 'autre';
  const libelleTheme = (t) => (themesOrdre.find((x) => x[0] === t) || [t, t])[1];
  const titreTerr = () => (S.selection
    ? (S.parCode[S.selection] || {})[S.nomCol] || S.selection : (ensemble || 'Bourgogne-Franche-Comté'));
  const soustitreTerr = () => (S.selection ? `${S.label} · ${S.selection}`
    : `Ensemble du territoire (${S.rows.length} ${S.label.toLowerCase()})`);

  // panneau de droite : l'indicateur choisi (big number) + le graphe comparatif
  const rendrePanneau = () => {
    if (!avecPanneau) return; // carte-sélecteur simple : pas de panneau propre
    panneau.innerHTML =
      `<h3>${titreTerr()}</h3><p class="meta">${soustitreTerr()}` +
      (S.selection ? ' · <button type="button" class="terr-reset">↩ toute la région</button>'
        : ' · <span class="meta">cliquez un territoire sur la carte</span>') + '</p>' +
      `<div class="terr-tuile terr-vedette"><strong>${fmtV(valeurDe(S.metric), S.metric)}</strong>` +
      `<span>${lib(S.metric)}</span></div>` +
      (() => {
        const r = rangSelection();
        const titre = S.rows.length > 14 ? 'Comparaison (10 premiers)' : 'Comparaison des territoires';
        return `<h4 class="terr-theme">${titre}${r ? ` · <span class="terr-rang">${r.rang}<sup>e</sup> sur ${r.total}</span>` : ''}</h4>`;
      })();
    panneau.appendChild(divChart);
    chart.resize();
    rendreChart();
    const reset = panneau.querySelector('.terr-reset');
    if (reset) reset.addEventListener('click', () => { S.selection = null; appliquer(); });
  };

  // section sous la carte : catégorie (thème) de l'indicateur choisi + tous ses
  // indicateurs pour le territoire. Change quand on change d'indicateur/catégorie.
  const rendreCategorie = () => {
    if (!avecPanneau) return;
    const t = themeActif();
    const cles = S.metrics.filter((k) => ((indic[k] || {}).th || 'autre') === t);
    const tuiles = cles.map((m) =>
      `<div class="terr-tuile"><strong>${fmtV(valeurDe(m), m)}</strong><span>${lib(m)}</span></div>`).join('');
    sectionCat.innerHTML =
      `<div class="terr-cat-banniere">${libelleTheme(t)}</div>` +
      `<p class="meta">${titreTerr()} · ${soustitreTerr()}</p>` +
      `<div class="terr-tuiles terr-cat-tuiles">${tuiles
        || '<span class="meta">Aucun indicateur pour ce thème à ce niveau.</span>'}</div>`;
  };

  const appliquer = () => {
    if (map.getLayer('sel')) map.setFilter('sel', ['==', ['get', '_code'], S.selection || '__none__']);
    rendrePanneau();
    rendreCategorie();
    // diffusion à tous les composants réactifs (graphiques de détail dessous)
    const sel = S.selection ? S.parCode[S.selection] : null;
    setSelection(S.selection
      ? { niveau: S.label, code: S.selection, nom: (sel && sel[S.nomCol]) || S.selection, rid: S.rid }
      : null);
  };

  const rendreMetriques = () => {
    metricBar.innerHTML = '';
    // choroplèthes groupées par thème (indicateur affiché sur la carte)
    const parTheme = {};
    for (const m of S.cartoMetrics) { const t = (indic[m] || {}).th || 'autre'; (parTheme[t] = parTheme[t] || []).push(m); }
    const themeCourant = () => (indic[S.metric] || {}).th || 'autre';
    // sélecteur compact à deux niveaux : rangée d'onglets de catégorie (toujours
    // visibles) + boutons d'indicateur de la seule catégorie active (gain de place).
    const onglets = document.createElement('div');
    onglets.className = 'terr-cat-onglets'; onglets.setAttribute('role', 'tablist');
    onglets.setAttribute('aria-label', 'Catégorie d’indicateurs');
    const actifs = document.createElement('div');
    actifs.className = 'terr-metrique-actif';

    const majCarte = () => {
      if (map.getLayer('fill')) map.setPaintProperty('fill', 'fill-color', echelle(S.metric));
      rendrePanneau();     // met à jour le big number de l'indicateur choisi
      rendreCategorie();   // change la catégorie (bannière + tuiles) sous la carte
    };
    const rendreActifs = () => {
      actifs.innerHTML = '';
      for (const m of (parTheme[themeCourant()] || [])) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = lib(m);
        b.setAttribute('aria-pressed', String(m === S.metric));
        b.addEventListener('click', () => {
          S.metric = m;
          actifs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          majCarte();
        });
        actifs.appendChild(b);
      }
    };
    for (const [t, lab] of themesOrdre) {
      if (!parTheme[t]) continue;
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'terr-cat-onglet'; c.textContent = lab;
      c.setAttribute('role', 'tab');
      c.setAttribute('aria-pressed', String(t === themeCourant()));
      c.addEventListener('click', () => {
        if (themeCourant() !== t) S.metric = parTheme[t][0];
        onglets.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        c.setAttribute('aria-pressed', 'true');
        rendreActifs();
        majCarte();
      });
      onglets.appendChild(c);
    }
    metricBar.append(onglets, actifs);
    rendreActifs();
  };

  const poserCouches = (geo) => {
    for (const id of ['sel', 'line', 'fill']) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource('terr')) map.removeSource('terr');
    map.addSource('terr', { type: 'geojson', data: geo });
    map.addLayer({ id: 'fill', type: 'fill', source: 'terr',
      paint: { 'fill-color': echelle(S.metric), 'fill-opacity': 0.68 } });
    map.addLayer({ id: 'line', type: 'line', source: 'terr', paint: { 'line-color': '#fff', 'line-width': 1 } });
    map.addLayer({ id: 'sel', type: 'line', source: 'terr',
      filter: ['==', ['get', '_code'], '__none__'], paint: { 'line-color': '#c2571a', 'line-width': 3.5 } });
    // cadrage seulement au premier affichage : un changement de niveau
    // (départements/EPCI/communes) conserve le zoom et le centre courants.
    if (!S.cadre) {
      try {
        const b = new maplibregl.LngLatBounds();
        const walk = (c) => Array.isArray(c[0]) ? c.forEach(walk) : b.extend(c);
        geo.features.forEach((f) => walk(f.geometry.coordinates));
        map.fitBounds(b, { padding: 20, animate: false });
        S.cadre = true;
      } catch { /* emprise par défaut */ }
    }
  };

  const chargerNiveau = async (niv) => {
    const [geo, data] = await Promise.all([
      fetch(geoUrlDe(niv.geo)).then((r) => r.json()),
      fetch(`/api/territoire?rid=${encodeURIComponent(niv.rid)}`).then((r) => r.json()),
    ]);
    const rows = data.records || [];
    for (const r of rows) if (r.population && r.superficie_km2) r.densite = num(r.population) / num(r.superficie_km2);
    S.rows = rows;
    S.codeCol = niv.code;
    // colonne code côté géométrie (peut différer de celle des données) ; défaut 'code'
    S.geoCol = niv.geoCode || 'code';
    S.nomCol = nomCandidats.find((c) => rows[0] && rows[0][c] !== undefined) || niv.nom;
    S.parCode = Object.fromEntries(rows.map((r) => [String(r[S.codeCol]), r]));
    // tuiles : tous les indicateurs connus présents (dans l'ordre du registre)
    S.metrics = Object.keys(indic).filter((k) => rows[0] && rows[0][k] !== undefined && rows[0][k] !== '');
    if (!S.metrics.length) S.metrics = Object.keys(rows[0] || {}).filter((k) => k !== S.codeCol && k !== S.nomCol);
    // carto : sous-ensemble cartographiable (boutons + choroplèthe + graphique)
    S.cartoMetrics = S.metrics.filter((k) => indic[k] && indic[k].carto);
    if (!S.cartoMetrics.length) S.cartoMetrics = S.metrics.slice(0, 1);
    // on garde l'indicateur (et donc la catégorie) en cours si le nouveau niveau
    // le porte ; sinon repli sur le premier indicateur cartographiable
    S.metric = S.cartoMetrics.includes(S.metric) ? S.metric : S.cartoMetrics[0];
    S.selection = null;
    S.label = niv.label;
    S.rid = niv.rid; // jeu du niveau courant, diffusé aux graphes réactifs
    for (const f of geo.features) {
      const code = String(f.properties[S.geoCol] ?? f.properties.code);
      const row = S.parCode[code];
      f.properties._code = code;
      if (row) for (const m of S.cartoMetrics) f.properties[m] = num(row[m]);
    }
    rendreMetriques();
    rendrePanneau();
    rendreCategorie();
    setSelection(null); // changement de niveau = retour à l'ensemble régional
    // couches carte : dès que le style est prêt (sinon au 'load')
    if (map.isStyleLoaded()) poserCouches(geo);
    else map.once('load', () => poserCouches(geo));
  };

  // sélecteur de niveau
  niveaux.forEach((niv, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = niv.label;
    b.setAttribute('aria-pressed', String(i === 0));
    b.addEventListener('click', () => {
      levelBar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      chargerNiveau(niv);
    });
    levelBar.appendChild(b);
  });

  // clic sur la carte -> sélection (lié une fois, lit l'état courant)
  map.on('click', (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: map.getLayer('fill') ? ['fill'] : [] })[0];
    if (f) { S.selection = String(f.properties._code); appliquer(); }
  });
  map.on('mousemove', (e) => {
    if (!map.getLayer('fill')) return;
    const f = map.queryRenderedFeatures(e.point, { layers: ['fill'] })[0];
    map.getCanvas().style.cursor = f ? 'pointer' : '';
  });

  chargerNiveau(niveaux[0]);

  // sélection d'un indicateur depuis un bloc « Recherche d'indicateur » de la page
  // (ciblé sur ce tableau de bord) : bascule la choroplèthe et le panneau.
  const selectionnerIndicateur = (colonne) => {
    if (!colonne || !S.cartoMetrics.includes(colonne)) return;
    S.metric = colonne;
    if (map.getLayer('fill')) map.setPaintProperty('fill', 'fill-color', echelle(S.metric));
    rendrePanneau(); rendreCategorie(); rendreMetriques();
  };
  onIndicateur((sel) => {
    if (!sel || (sel.tb && String(sel.tb) !== String(el.dataset.tb || ''))) return;
    selectionnerIndicateur(sel.colonne);
  });
}

export default function TerritoireDashboard() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.dtz-territoire')].filter((e) => !e.dataset.init);
    if (!els.length) return;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      const echarts = await loadECharts();
      for (const el of els) {
        el.dataset.init = '1';
        try { await monter(el, maplibregl, echarts); }
        catch { el.innerHTML = '<p class="meta" style="padding:1rem">Tableau de bord indisponible.</p>'; }
      }
    })();
  });
  return null;
}
