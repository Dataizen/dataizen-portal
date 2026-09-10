'use client';
// Révélation douce des blocs au défilement (site "vivant" sans lourdeur,
// compatible RGESN : CSS + IntersectionObserver, rien d'autre).
// prefers-reduced-motion est respecté : tout est visible immédiatement.
import { useEffect } from 'react';

export default function Reveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cibles = [...document.querySelectorAll('.bloc, article.carte, .vitrines > *, .chiffre')];
    if (!cibles.length) return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('revele');
          obs.unobserve(e.target);
        }
      }
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    for (const c of cibles) {
      // Un élément plus haut que le viewport ne peut jamais atteindre un seuil élevé :
      // avec un seuil non nul il resterait invisible (cas d'une longue page « article.carte »
      // comme un glossaire). On ne le masque donc PAS (reste visible), et pour les autres
      // le seuil 0 suffit (révélé dès qu'un pixel entre dans le viewport).
      if (c.getBoundingClientRect().height > window.innerHeight) continue;
      c.classList.add('a-reveler');
      obs.observe(c);
    }
    return () => obs.disconnect();
  });
  return null;
}
