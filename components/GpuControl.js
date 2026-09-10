'use client';
// Contrôle du GPU souverain pour les admins : affiche l'état et permet de le
// DÉMARRER (réveil) sans attendre une première génération. Utilisé sur la page
// outil (/outils/ia). Le démarrage prend 1 à 2 min ; l'état se rafraîchit seul.
import { useState, useEffect, useCallback } from 'react';
import { etatGpu } from './GpuStatus';

export default function GpuControl() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    try { const r = await fetch('/api/gpu/status'); setS(await r.json()); } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 15000);
    return () => clearInterval(id);
  }, [charger]);

  const demarrer = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/gpu/wake', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? 'Démarrage lancé : le GPU sera prêt dans 1 à 2 min.' : (d.error || 'Réveil impossible.'));
      setTimeout(charger, 2000);
    } catch { setMsg('Réveil impossible.'); }
    finally { setBusy(false); }
  };

  const e = etatGpu(s);
  const enMarche = e?.cle === 'marche';
  const demarreEnCours = e?.cle === 'demarre';
  return (
    <div className="carte dtz-gpu-control">
      <h3 style={{ marginBottom: '.4rem' }}>GPU souverain</h3>
      <p className="meta" style={{ marginBottom: '.6rem' }}>
        {e ? <>{e.pastille} <strong>{e.texte}</strong></> : 'État indisponible.'}
        {s?.billing_remaining_minutes != null && enMarche
          && <> · s'éteint dans ~{Math.max(0, Math.round(s.billing_remaining_minutes))} min sans activité</>}
      </p>
      <button className="bouton-admin" onClick={demarrer}
              disabled={busy || enMarche || demarreEnCours}>
        {enMarche ? 'Déjà en marche' : demarreEnCours ? '⏳ Démarrage…' : busy ? '⏳ …' : '▶ Démarrer le GPU'}
      </button>
      {msg && <p className="meta" style={{ marginTop: '.5rem' }}>{msg}</p>}
    </div>
  );
}
