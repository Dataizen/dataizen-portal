'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Suivi d'usage anonyme du portail public : signale au serveur les pages vues et les
// téléchargements de ressources. Aucune donnée personnelle, aucun cookie, aucun stockage
// navigateur. Respecte Do Not Track et Global Privacy Control (l'utilisateur qui refuse
// le suivi n'émet rien).
function optedOut() {
  try {
    const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return dnt === '1' || dnt === 'yes' || navigator.globalPrivacyControl === true;
  } catch {
    return false;
  }
}

function send(type, chemin, ref) {
  try {
    const body = JSON.stringify({ type, chemin, ref });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    }
  } catch {
    // silencieux
  }
}

export default function UsageTracker() {
  const pathname = usePathname();
  const off = useRef(false);
  useEffect(() => { off.current = optedOut(); }, []);

  // Page vue : au chargement et à chaque changement de route.
  useEffect(() => {
    if (off.current) return;
    send('page', pathname || (typeof location !== 'undefined' ? location.pathname : ''));
  }, [pathname]);

  // Téléchargements : liens de fichiers/ressources (CKAN download, datastore dump, export).
  useEffect(() => {
    if (off.current) return;
    const onClick = (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (/\/download\/|\/datastore\/dump\/|[?&](format|f)=/.test(href)) {
        const m = href.match(/\/dataset\/([^/?#]+)/) || href.match(/resource\/([0-9a-f-]{8,})/i);
        send('download', typeof location !== 'undefined' ? location.pathname : '', m ? m[1] : '');
      }
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
