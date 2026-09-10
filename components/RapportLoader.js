'use client';
// Bloc de page « Rapport » : hydrate les emplacements <div class="dtz-rapport"
// data-config="…"> posés par renderBlocs (type de bloc « rapport ») avec le
// composant RapportLayout (pagination, 2 colonnes contexte / information clé +
// visualisation). Le rendu est 100 % client (placeholder vide côté serveur), même
// principe que CartesLoader / ChartsLoader. Réutilisable sur toutes les instances.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import RapportLayout from './RapportLayout';

export default function RapportLoader() {
  useEffect(() => {
    for (const el of document.querySelectorAll('.dtz-rapport[data-config]')) {
      if (el.dataset.dtzMounted) continue;
      el.dataset.dtzMounted = '1';
      let cfg;
      try { cfg = JSON.parse(el.dataset.config); } catch { continue; }
      createRoot(el).render(
        <RapportLayout
          title={el.dataset.titre || cfg.title || ''}
          intro={cfg.intro || []}
          sections={cfg.sections || []}
          parent={cfg.parent}
        />,
      );
    }
  }, []);
  return null;
}
