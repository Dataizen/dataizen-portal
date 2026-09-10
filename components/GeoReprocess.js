'use client';
// Bouton (admin/déposant) : (re)lancer la préparation cartographique d'un jeu, de façon
// idempotente. Géométrise les colonnes géo du datastore puis (re)génère la carte WMS/WFS.
import { useState } from 'react';

export default function GeoReprocess({ name }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (force) => {
    setBusy(true);
    setMsg('lancement…');
    try {
      const r = await fetch('/api/dataset/geo-reprocess', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, force }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg(`re-traitement lancé (${(d.enqueued || []).length} ressource(s)). La carte se met à jour automatiquement.`);
        setTimeout(() => window.location.reload(), 4000);
      } else {
        setMsg(`erreur : ${d.error || r.status}`);
        setBusy(false);
      }
    } catch (e) {
      setMsg(`erreur : ${e.message}`);
      setBusy(false);
    }
  };

  return (
    <span>
      <button className="bouton-admin secondaire" disabled={busy} onClick={() => go(false)} title="Détecte les colonnes géographiques et (re)construit la carte, sans rien casser">
        {busy ? '⏳ …' : '🗺️ Re-traiter la carte'}
      </button>{' '}
      {msg && <span className="meta">{msg}</span>}
    </span>
  );
}
