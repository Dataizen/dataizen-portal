'use client';
// Indicateur « traitement en cours » sur la fiche d'un jeu : pour une ressource déposée
// dont le datastore n'est pas encore prêt, affiche l'état du chargement (xloader) et
// recharge la page automatiquement quand les données deviennent disponibles.
import { useEffect, useState } from 'react';

export default function ChargementIndicator({ resourceId, initialActive }) {
  const [etat, setEtat] = useState(initialActive ? 'complete' : 'checking');

  useEffect(() => {
    if (initialActive) return undefined;
    let stop = false;
    let timer;
    const tick = async () => {
      try {
        const r = await fetch(`/api/resource/loadstatus?rid=${encodeURIComponent(resourceId)}`, { cache: 'no-store' });
        const d = await r.json();
        if (stop) return;
        if (d.active) { window.location.reload(); return; }   // datastore prêt -> on affiche la table
        if (d.status === 'error') { setEtat('error'); return; }
        if (d.status === 'pending' || d.status === 'running' || d.status === 'submitting') {
          setEtat('running');
          timer = setTimeout(tick, 5000);
        } else {
          setEtat('idle');   // pas de job (fichier non tabulaire, ou déjà traité) : rien à montrer
        }
      } catch {
        if (!stop) timer = setTimeout(tick, 8000);
      }
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [resourceId, initialActive]);

  if (etat === 'running' || etat === 'checking') {
    return (
      <p className="meta" style={{ color: '#b45309' }}>
        ⏳ Données en cours de chargement… (cette table apparaîtra automatiquement)
      </p>
    );
  }
  if (etat === 'error') {
    return (
      <p className="meta" style={{ color: '#b91c1c' }}>
        ⚠️ Le chargement des données a échoué. Le fichier reste téléchargeable ; vous pouvez retenter via « Mettre à jour les données ».
      </p>
    );
  }
  return null;
}
