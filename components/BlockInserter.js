'use client';
// Points d'insertion de blocs (« ＋ Ajouter un bloc ici ») de l'éditeur visuel.
// Un simple clic ouvre le formulaire de création Directus du bon type de collection
// (home_blocks / page_blocs), pré-rempli avec la page et la position (sort) du point
// cliqué, dans un nouvel onglet Directus (session d'édition déjà active) : aucun jeton
// d'écriture n'est exposé au portail. Masqué aux visiteurs.
// (On n'utilise plus le drawer intégré via data-directus sur les interstices : l'overlay
// Directus y ajoutait un bouton IA redondant et le clic dépendait du crayon au survol.)
import { useEffect } from 'react';

// adminUrl est fourni en prop par le layout (variable d'environnement d'exécution,
// non inlinée dans le bundle client — même principe que VisualEditing).
export default function BlockInserter({ adminUrl }) {
  useEffect(() => {
    const admin = adminUrl;
    if (!admin) return;
    const onClick = (e) => {
      const el = e.target.closest('.dtz-inserer');
      if (!el) return;
      e.preventDefault();
      const params = new URLSearchParams();
      if (el.dataset.page) params.set('page', el.dataset.page);
      if (el.dataset.sort) params.set('sort', el.dataset.sort);
      params.set('status', 'published');
      const url = `${admin.replace(/\/$/, '')}/admin/content/${el.dataset.collection}/+?${params}`;
      window.open(url, '_blank', 'noopener');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [adminUrl]);
  return null;
}
