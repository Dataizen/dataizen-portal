'use client';
// Bloc « Recherche d'indicateur » : un mini moteur de recherche des indicateurs
// d'un portrait (tableau de bord). On tape, la liste se filtre ; un clic sur un
// indicateur cartographiable l'affiche sur le tableau de bord de la page (via le
// bus, même identifiant) et défile jusqu'à la carte.
import { useEffect } from 'react';
import { setIndicateur } from './territoireBus';

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function monter(el) {
  const tb = el.dataset.tb;
  if (!tb) return;
  const cfg = await fetch(`/api/tableau-bord?id=${encodeURIComponent(tb)}`)
    .then((r) => r.json()).catch(() => null);
  const inds = (cfg && cfg.indicateurs) || [];
  if (!inds.length) { el.innerHTML = '<p class="meta">Aucun indicateur à rechercher.</p>'; return; }

  el.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'rech-indic-champ';
  input.placeholder = 'Rechercher un indicateur…';
  input.setAttribute('aria-label', 'Rechercher un indicateur');
  const liste = document.createElement('div');
  liste.className = 'rech-indic-liste';
  el.append(input, liste);

  const rendre = (q) => {
    const ql = (q || '').trim().toLowerCase();
    // champ vide : simple indication, pas la liste entière (c'est une recherche)
    if (!ql) {
      liste.innerHTML = `<p class="meta">${inds.length} indicateurs. `
        + 'Tapez pour filtrer (habitants, prix, vacance, forêt…).</p>';
      return;
    }
    const vus = inds.filter((i) => `${i.libelle} ${i.th} ${i.unite}`.toLowerCase().includes(ql));
    if (!vus.length) { liste.innerHTML = '<p class="meta">Aucun indicateur ne correspond.</p>'; return; }
    liste.innerHTML = '';
    for (const i of vus) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rech-indic-item';
      if (!i.carto) b.classList.add('non-carto');
      b.innerHTML = `<span class="ri-lib">${esc(i.libelle)}</span>`
        + `<span class="ri-meta">${esc(i.th)}${i.unite ? ` · ${esc(i.unite)}` : ''}</span>`
        + (i.carto ? '<span class="badge">carte</span>' : '');
      b.title = i.carto ? 'Afficher sur la carte du tableau de bord'
        : 'Indicateur non cartographiable';
      b.addEventListener('click', () => {
        if (i.carto) setIndicateur({ tb, colonne: i.colonne });
        const dash = document.querySelector(`.dtz-territoire[data-tb="${tb}"]`);
        if (dash) dash.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      liste.appendChild(b);
    }
  };
  rendre('');
  input.addEventListener('input', () => rendre(input.value));
}

export default function RechercheIndicateur() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.dtz-recherche-indicateur')].filter((e) => !e.dataset.init);
    if (!els.length) return;
    for (const el of els) {
      el.dataset.init = '1';
      monter(el).catch(() => { el.innerHTML = '<p class="meta">Recherche indisponible.</p>'; });
    }
  });
  return null;
}
