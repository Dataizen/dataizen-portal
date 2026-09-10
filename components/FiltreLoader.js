'use client';
// Bloc « Filtre global de page » : hydrate chaque placeholder .dtz-filtre en un menu
// déroulant. Les valeurs viennent soit de la config (data-values), soit des valeurs
// distinctes d'une colonne d'un jeu (data-dataset -> /api/dataset/datastore/distinct).
// Au changement, émet { field, value } sur le bus ; graphiques et carte de la page
// s'y abonnent et se filtrent. Sans JavaScript, rien ne casse (placeholder vide).
import { useEffect } from 'react';
import { setFiltre } from './territoireBus';

export default function FiltreLoader() {
  useEffect(() => {
    const cibles = [...document.querySelectorAll('.dtz-filtre[data-field]')].filter((el) => !el.dataset.dtzInit);
    for (const el of cibles) {
      el.dataset.dtzInit = '1';
      const field = el.dataset.field;
      const label = el.dataset.label || field;

      const construire = (values) => {
        const wrap = document.createElement('div');
        wrap.className = 'dtz-filtre-ctrl';
        wrap.style.cssText = 'display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:.3rem 0';
        const lab = document.createElement('label');
        lab.textContent = label;
        const sel = document.createElement('select');
        sel.setAttribute('aria-label', label);
        const opt0 = document.createElement('option');
        opt0.value = ''; opt0.textContent = '(tout)';
        sel.appendChild(opt0);
        for (const v of values) {
          const o = document.createElement('option');
          o.value = String(v); o.textContent = String(v);
          sel.appendChild(o);
        }
        sel.addEventListener('change', () => setFiltre({ field, value: sel.value }));
        lab.appendChild(document.createTextNode(' '));
        lab.appendChild(sel);
        wrap.appendChild(lab);
        el.appendChild(wrap);
      };

      let statiques = [];
      if (el.dataset.values) { try { statiques = JSON.parse(el.dataset.values); } catch { statiques = []; } }
      if (statiques.length) {
        construire(statiques);
      } else if (el.dataset.dataset) {
        const col = el.dataset.column || field;
        fetch(`/api/dataset/datastore/distinct?slug=${encodeURIComponent(el.dataset.dataset)}&field=${encodeURIComponent(col)}`)
          .then((r) => r.json())
          .then((d) => construire(d.values || []))
          .catch(() => construire([]));
      } else {
        construire([]);
      }
    }
  });
  return null;
}
