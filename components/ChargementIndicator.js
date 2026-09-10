'use client';
// Indicateur « traitement en cours » multi-étapes sur la fiche d'un jeu. Suit deux
// traitements : le chargement des données au datastore (xloader) et la préparation
// cartographique (géométrisation d'une colonne géo -> carte WMS). Affiche l'étape en cours
// avec sa progression, et recharge la page quand un traitement se termine (table/carte).
import { useEffect, useRef, useState } from 'react';

const S = { load: '#b45309', geo: '#0f766e', err: '#b91c1c' };

export default function ChargementIndicator({ resourceId, initialActive }) {
  const [info, setInfo] = useState(null);
  const sawGeo = useRef(false);   // on a vu la préparation carte tourner -> recharger à la fin

  useEffect(() => {
    let stop = false, timer;
    const tick = async () => {
      try {
        const r = await fetch(`/api/resource/loadstatus?rid=${encodeURIComponent(resourceId)}`, { cache: 'no-store' });
        const d = await r.json();
        if (stop) return;
        setInfo(d);
        const dsLoading = !d.active && ['pending', 'running', 'submitting'].includes(d.status);
        const geoRunning = ['detecting', 'geometrizing'].includes(d.geo?.status);
        if (geoRunning) sawGeo.current = true;
        // datastore fraîchement prêt (avant la préparation carte) -> recharger pour la table
        if (d.active && !initialActive && !d.geo?.status) { window.location.reload(); return; }
        // préparation carte terminée -> recharger pour afficher la carte
        if (sawGeo.current && d.geo?.status === 'ready') { window.location.reload(); return; }
        if (dsLoading || geoRunning) { timer = setTimeout(tick, 5000); }
      } catch {
        if (!stop) timer = setTimeout(tick, 8000);
      }
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [resourceId, initialActive]);

  if (!info) return initialActive ? null : <p className="meta" style={{ color: S.load }}>⏳ …</p>;
  const { active, status, geo } = info;

  if (!active && ['pending', 'running', 'submitting'].includes(status)) {
    return <p className="meta" style={{ color: S.load }}>⏳ Chargement des données en cours… (la table apparaîtra automatiquement)</p>;
  }
  if (!active && status === 'error') {
    return <p className="meta" style={{ color: S.err }}>⚠️ Le fichier est bien déposé et téléchargeable ; c'est sa mise en table exploitable qui a échoué. Vous pouvez la relancer via « Mettre à jour les données ».</p>;
  }
  if (geo?.status === 'detecting' || geo?.status === 'geometrizing') {
    const pct = geo.done && geo.total ? Math.floor((100 * Number(geo.done)) / Number(geo.total)) : null;
    return (
      <p className="meta" style={{ color: S.geo }}>
        🗺️ Préparation de la carte en cours (géométries{geo.col ? <> « {geo.col} »</> : null}{pct != null ? `, ${pct}%` : ''})… la carte apparaîtra automatiquement.
      </p>
    );
  }
  if (geo?.status === 'error') {
    return <p className="meta" style={{ color: S.err }}>⚠️ La préparation cartographique a échoué. Vous pouvez la relancer via « Re-traiter la carte ».</p>;
  }
  return null;
}
