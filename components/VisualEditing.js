'use client';
import { useEffect } from 'react';

// Édition visuelle Directus : dans le module « Éditeur visuel », le portail est
// chargé en iframe et chaque bloc devient cliquable pour ouvrir son formulaire.
// On ne l'active qu'à l'intérieur d'un cadre (l'éditeur) ; pour un visiteur
// normal, le composant ne fait rien.
export default function VisualEditing({ directusUrl }) {
  useEffect(() => {
    if (!directusUrl || window.self === window.top) return;
    // On est dans UN iframe, mais l'édition visuelle ne concerne que les pages de
    // CONTENU chargées par l'éditeur visuel Directus. Les autres iframes (outils
    // embarqués comme /outils/ia, aperçus /embed/…) ne doivent PAS activer la lib :
    // sa couche d'interception de clics bloquerait sinon toute interaction de l'outil.
    if (/^\/(outils|embed)(\/|$)/.test(window.location.pathname)) return;
    let stop = false;
    // on est dans l'éditeur : révèle les affordances d'édition (ex. « ajouter un bloc »)
    document.body.classList.add('dtz-editing');
    import('@directus/visual-editing')
      .then(({ apply, setAttr }) => {
        if (stop) return;
        // blocs existants : clic pour éditer l'item dans un drawer (avec l'assistant IA
        // de l'éditeur visuel Directus, utile sur un vrai bloc).
        document.querySelectorAll('[data-edit-item]').forEach((el) => {
          el.setAttribute('data-directus', setAttr({
            collection: el.getAttribute('data-edit-collection'),
            item: el.getAttribute('data-edit-item'),
            fields: el.getAttribute('data-edit-fields') || undefined,
            mode: 'drawer',
          }));
        });
        // Les points d'insertion « ＋ Ajouter un bloc » ne reçoivent PAS data-directus :
        // l'overlay Directus y ajouterait un bouton IA redondant (même contexte partout) et
        // le clic dépendrait du crayon au survol. On les laisse à BlockInserter, qui ouvre
        // le formulaire de création pré-rempli (page + position) sur un simple clic.
        // rechargement après enregistrement pour refléter la modification
        apply({ directusUrl, onSaved: () => window.location.reload() });
      })
      .catch(() => {});
    return () => { stop = true; };
  }, [directusUrl]);
  return null;
}
