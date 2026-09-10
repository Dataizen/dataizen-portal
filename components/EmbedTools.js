'use client';
// Confort des contenus embarqués (Evidence, Superset, Grist).
// - une barre d'action au-dessus de chaque iframe : plein écran + ouvrir dans
//   un onglet, pour échapper au cadre étroit (navigation simplifiée) ;
// - hauteur adaptée (grande par défaut, plein écran sur demande) ;
// - si le contenu embarqué émet sa hauteur (message { type:'dtz:height' }),
//   l'iframe s'ajuste et l'ascenseur interne disparaît.
// DOM déjà rendu côté serveur (dans le HTML des pages) : manipulation sûre,
// même principe que CartesLoader. Sans JavaScript, l'iframe reste utilisable.
import { useEffect } from 'react';

export default function EmbedTools() {
  useEffect(() => {
    // iframes à équiper d'une barre plein écran / ouvrir : les tableaux de bord
    // Evidence, tout iframe d'un bloc « embed » (Superset, Grist, contenu intégré),
    // et tout iframe opté explicitement via data-dtz-tools (cartes vMap, atlas… dans
    // le contenu d'une page). YouTube en est exclu (contrôles plein écran natifs).
    const sel = 'iframe.evidence, .embed iframe, iframe[data-dtz-tools]';
    const frames = [...document.querySelectorAll(sel)].filter((f) => !f.closest('.dtz-youtube'));
    for (const frame of frames) {
      if (frame.dataset.dtzEmbed) continue;      // déjà équipée
      frame.dataset.dtzEmbed = '1';

      // réutiliser un conteneur .embed existant (bloc embed/flourish), sinon en créer un
      let wrap = frame.closest('.embed');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'embed';
        frame.parentNode.insertBefore(wrap, frame);
        wrap.append(frame);
      }

      const bar = document.createElement('div');
      bar.className = 'embed__bar';

      const plein = document.createElement('button');
      plein.type = 'button';
      plein.className = 'embed__btn';
      plein.textContent = '⛶ Plein écran';
      plein.setAttribute('aria-label', 'Afficher ce contenu en plein écran');
      plein.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else wrap.requestFullscreen?.();
      });

      const ouvrir = document.createElement('a');
      ouvrir.className = 'embed__btn';
      ouvrir.href = frame.src;
      ouvrir.target = '_blank';
      ouvrir.rel = 'noopener';
      ouvrir.textContent = 'Ouvrir ↗';
      ouvrir.setAttribute('aria-label', 'Ouvrir ce contenu dans un nouvel onglet');

      bar.append(plein, ouvrir);
      wrap.insertBefore(bar, wrap.firstChild);   // barre au-dessus de l'iframe
    }

    // auto-adaptation de hauteur pour les contenus qui l'émettent (Evidence)
    const onMsg = (e) => {
      const h = e.data && e.data.type === 'dtz:height' ? Number(e.data.height) : 0;
      if (!h) return;
      for (const frame of document.querySelectorAll('iframe.evidence')) {
        if (frame.contentWindow === e.source) {
          frame.style.height = Math.max(320, Math.min(h + 24, 20000)) + 'px';
        }
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  });
  return null;
}
