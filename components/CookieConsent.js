'use client';
// Bandeau de consentement aux cookies, réutilisable sur toutes les instances.
// Souverain et respectueux : par défaut AUCUN traceur n'est chargé ; le choix
// (accepté/refusé) est mémorisé en localStorage. Tant qu'aucun traceur tiers
// n'est activé, le bandeau ne sert qu'à l'information et au recueil du choix ;
// il pose la base pour activer plus tard une mesure d'audience conditionnée.
import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

const CLE = 'dtz-consent';

export default function CookieConsent({ enSavoirPlus = '/pages/mentions-legales' }) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Pas de bandeau dans un iframe (outil admin embarqué /outils, aperçus /embed,
    // éditeur visuel) : contexte interne, et il gênerait l'interaction.
    if (window.self !== window.top) return;
    try {
      if (!localStorage.getItem(CLE)) setVisible(true);
    } catch { /* localStorage indisponible : on n'affiche rien */ }
  }, []);

  const choisir = (valeur) => {
    try {
      localStorage.setItem(CLE, JSON.stringify({ choix: valeur, date: new Date().toISOString() }));
    } catch { /* ignore */ }
    setVisible(false);
    // point d'extension : si valeur === 'accepte', activer ici une mesure
    // d'audience respectueuse de la vie privée (aucun traceur par défaut).
    window.dispatchEvent(new CustomEvent('dtz-consent', { detail: valeur }));
  };

  if (!visible) return null;
  return (
    <div className="dtz-cookies" role="dialog" aria-live="polite"
         aria-label={t('cookies.dialogAria')}>
      <div className="dtz-cookies-txt">
        <strong>{t('cookies.title')}</strong>{' '}
        <span>{t('cookies.body')}</span>{' '}
        <a href={enSavoirPlus}>{t('cookies.learnMore')}</a>
      </div>
      <div className="dtz-cookies-actions">
        <button type="button" className="dtz-cookies-refuser" onClick={() => choisir('refuse')}>
          {t('cookies.decline')}
        </button>
        <button type="button" className="dtz-cookies-accepter" onClick={() => choisir('accepte')}>
          {t('cookies.accept')}
        </button>
      </div>
    </div>
  );
}
