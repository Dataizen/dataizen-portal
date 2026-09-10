'use client';
// Accessibilité des sous-menus (RGAA) : annonce l'état ouvert/fermé aux
// lecteurs d'écran (aria-expanded + aria-haspopup) ; l'ouverture reste en CSS
// (:hover/:focus-within), donc tout fonctionne aussi sans JavaScript.
import { useEffect } from 'react';

export default function MenuA11y() {
  useEffect(() => {
    // aria-current="page" sur l'entrée de navigation correspondant à la page
    // courante (RGAA 12.x : repérer la position dans la navigation).
    const ici = window.location.pathname.replace(/\/+$/, '') || '/';
    const liens = document.querySelectorAll('header nav a[href^="/"]');
    for (const a of liens) {
      const href = a.getAttribute('href').replace(/\/+$/, '') || '/';
      if (href === ici) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }

    const parents = [...document.querySelectorAll('.a-sous-menu')];
    for (const li of parents) {
      const lien = li.querySelector(':scope > a');
      if (!lien) continue;
      lien.setAttribute('aria-haspopup', 'true');
      lien.setAttribute('aria-expanded', 'false');
      const maj = (v) => lien.setAttribute('aria-expanded', String(v));
      li.addEventListener('mouseenter', () => maj(true));
      li.addEventListener('mouseleave', () => maj(false));
      li.addEventListener('focusin', () => maj(true));
      li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget)) maj(false); });
    }
  });
  return null;
}
