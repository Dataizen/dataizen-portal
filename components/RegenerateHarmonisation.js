'use client';
// Bouton de régénération des fichiers harmonisés d'un jeu, affiché quand le modèle
// DOLFIN a changé depuis la dernière harmonisation. Réservé aux personnes pouvant
// éditer le jeu (admin d'instance ou déposant).
import { useState } from 'react';

export default function RegenerateHarmonisation({ name }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setBusy(true); setMsg('régénération en cours…');
    try {
      const r = await fetch('/api/dataset/dolfin/regenerate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (r.ok) { setMsg('✔ fichiers régénérés'); setTimeout(() => window.location.reload(), 1200); }
      else { const d = await r.json().catch(() => ({})); setMsg(d.error || 'échec'); setBusy(false); }
    } catch { setMsg('erreur réseau'); setBusy(false); }
  }

  return (
    <>
      <button className="bouton-admin" onClick={run} disabled={busy}>
        {busy ? '⏳ Régénération…' : '♻ Régénérer les fichiers harmonisés'}
      </button>{' '}
      <span className="meta">{msg}</span>
    </>
  );
}
