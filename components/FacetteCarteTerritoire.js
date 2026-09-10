'use client';
// Carte-sélecteur de territoire pour le catalogue : une carte de la France
// métropolitaine où l'on choisit N'IMPORTE QUEL département (ceux qui ont des
// données sont mis en avant), avec une bascule « Régions » pour choisir une région
// entière. L'Outre-mer, géographiquement éloigné, est proposé en pastilles sous la
// carte. Progressive enhancement : la liste texte reste l'équivalent accessible.
import { useEffect } from 'react';
import { REGIONS } from '../lib/regions';
import { DEPARTEMENTS } from '../lib/departements';

const PALETTE = ['#2f5496', '#c2571a', '#1e7a46', '#8a3ffc', '#b3261e', '#0ea5e9',
  '#b58900', '#7d5fff', '#0aa89e', '#d6336c'];
const DOM = ['971', '972', '973', '974', '976'];

function majUrl(key, val) {
  const p = new URLSearchParams(window.location.search);
  p.delete(key === 'territoire' ? 'territoire_region' : 'territoire');
  if (p.get(key) === val) p.delete(key); else p.set(key, val);
  p.delete('start');
  window.location.search = p.toString();
}

async function monter(div, maplibregl) {
  let counts = {}; try { counts = JSON.parse(div.dataset.counts || '{}'); } catch { counts = {}; }
  const selDept = div.dataset.selDept || '';
  const selRegion = div.dataset.selRegion || '';
  const gj = await fetch('/api/territoires-geo?all=1').then((r) => r.json()).catch(() => null);
  if (!gj || !gj.features?.length) { div.style.display = 'none'; return; }
  // marque chaque département avec son nombre de jeux (mise en avant des présents)
  for (const f of gj.features) f.properties.nb = counts[f.properties.code] || 0;
  const regionsAvecData = new Set(gj.features.filter((f) => f.properties.nb > 0).map((f) => f.properties.region));

  const regions = [...new Set(gj.features.map((f) => f.properties.region).filter(Boolean))];
  const parRegion = ['match', ['get', 'region']];
  regions.forEach((r, i) => parRegion.push(r, PALETTE[i % PALETTE.length]));
  parRegion.push('#9aa4b2');

  const wrap = document.createElement('div');
  const barre = document.createElement('div'); barre.className = 'facette-carte-controles';
  const bDep = document.createElement('button'); bDep.type = 'button'; bDep.textContent = 'Départements';
  const bReg = document.createElement('button'); bReg.type = 'button'; bReg.textContent = 'Régions';
  barre.append(bDep, bReg);
  const carte = document.createElement('div'); carte.className = 'facette-carte';
  // pastilles Outre-mer (codes/noms seulement, pas de géométrie sur la carte métropole)
  const domBar = document.createElement('div'); domBar.className = 'facette-dom';
  domBar.innerHTML = '<span class="meta">Outre-mer :</span> ';
  for (const c of DOM) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'facette-dom-chip';
    const nb = counts[c] || 0;
    b.textContent = DEPARTEMENTS[c] + (nb ? ` (${nb})` : '');
    if (!nb) b.classList.add('vide');
    if (selDept === c) b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', () => majUrl('territoire', c));
    domBar.appendChild(b);
  }
  div.innerHTML = ''; div.append(barre, carte, domBar);

  const map = new maplibregl.Map({
    container: carte,
    style: { version: 8, sources: {}, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#eef2f7' } }] },
    attributionControl: false, cooperativeGestures: true,
  });
  let mode = selRegion ? 'region' : 'dept';

  const fillColor = () => (mode === 'region'
    ? parRegion
    : ['case', ['==', ['get', 'code'], selDept || '___'], '#c2571a',
      ['>', ['get', 'nb'], 0], '#2f5496', '#cbd5e1']);
  const fillOpacity = () => (mode === 'region'
    ? ['case', ['in', ['get', 'region'], ['literal', [...regionsAvecData]]], 0.6, 0.2]
    : ['case', ['>', ['get', 'nb'], 0], 0.62, 0.22]);

  map.on('load', () => {
    map.addSource('dep', { type: 'geojson', data: gj });
    map.addLayer({ id: 'dep-fill', type: 'fill', source: 'dep', paint: { 'fill-color': fillColor(), 'fill-opacity': fillOpacity() } });
    map.addLayer({ id: 'dep-line', type: 'line', source: 'dep', paint: { 'line-color': '#33415560', 'line-width': 0.7 } });
    map.addLayer({ id: 'dep-sel', type: 'line', source: 'dep',
      filter: ['==', ['get', 'code'], selDept || '___'], paint: { 'line-color': '#111', 'line-width': 2.4 } });

    // cadrage sur la métropole (les DOM sont en pastilles, pas sur la carte)
    const b = new maplibregl.LngLatBounds();
    for (const f of gj.features) {
      if (DOM.includes(f.properties.code)) continue;
      const p = (c) => (typeof c[0] === 'number' ? b.extend([c[0], c[1]]) : c.forEach(p));
      p(f.geometry.coordinates);
    }
    if (!b.isEmpty()) map.fitBounds(b, { padding: 12, animate: false });

    const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '220px' });
    map.on('mousemove', 'dep-fill', (e) => {
      const p = e.features[0].properties; map.getCanvas().style.cursor = 'pointer';
      const lib = mode === 'region' ? (REGIONS[p.region]?.nom || 'Région') : p.nom;
      const nb = mode === 'region'
        ? gj.features.filter((f) => f.properties.region === p.region).reduce((s, f) => s + f.properties.nb, 0)
        : p.nb;
      pop.setLngLat(e.lngLat).setHTML(`<strong>${lib}</strong>${nb ? ` · ${nb} jeu${nb > 1 ? 'x' : ''}` : ' · aucun jeu'}`).addTo(map);
    });
    map.on('mouseleave', 'dep-fill', () => { map.getCanvas().style.cursor = ''; pop.remove(); });
    map.on('click', 'dep-fill', (e) => {
      const p = e.features[0].properties;
      if (mode === 'region') { if (p.region) majUrl('territoire_region', p.region); }
      else majUrl('territoire', p.code);
    });
  });

  const setMode = (m) => {
    mode = m;
    bDep.setAttribute('aria-pressed', String(m === 'dept'));
    bReg.setAttribute('aria-pressed', String(m === 'region'));
    if (map.getLayer('dep-fill')) {
      map.setPaintProperty('dep-fill', 'fill-color', fillColor());
      map.setPaintProperty('dep-fill', 'fill-opacity', fillOpacity());
    }
  };
  bDep.addEventListener('click', () => setMode('dept'));
  bReg.addEventListener('click', () => setMode('region'));
  setMode(mode);
}

export default function FacetteCarteTerritoire() {
  useEffect(() => {
    const divs = [...document.querySelectorAll('.dtz-facette-territoire')].filter((d) => !d.dataset.monte);
    if (!divs.length) return;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      for (const d of divs) { d.dataset.monte = '1'; monter(d, maplibregl).catch(() => { d.style.display = 'none'; }); }
    })();
  });
  return null;
}
