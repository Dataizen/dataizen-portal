'use client';
// Indicateur d'état du GPU souverain (badge discret), visible de tous, y compris
// non connectés. Le GPU alimente l'assistant et la génération IA ; il se met en veille
// après inactivité et démarre en 1 à 2 min. Interroge /api/gpu/status périodiquement.
import { useState, useEffect } from 'react';

// Dérive un état d'affichage commun (réutilisé par GpuControl).
export function etatGpu(s) {
  if (!s || !s.available) return null;
  const enMarche = !!(s.ollama_ready && s.model_loaded && s.ollama_responding);
  const enVeille = s.instance_status === 'SHELVED_OFFLOADED' || s.instance_status === 'SHELVED'
    || (!enMarche && !s.wake_in_progress);
  const demarre = !!s.wake_in_progress || (!enMarche && !enVeille);
  if (enMarche) return { cle: 'marche', pastille: '🟢', texte: 'IA souveraine en marche' };
  if (demarre) return { cle: 'demarre', pastille: '🟠', texte: 'IA souveraine en démarrage…' };
  return { cle: 'veille', pastille: '⚪', texte: 'IA souveraine en veille' };
}

export default function GpuStatus() {
  const [s, setS] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.self !== window.top) return; // pas dans un iframe
    let stop = false;
    const charger = async () => {
      try { const r = await fetch('/api/gpu/status'); const d = await r.json(); if (!stop) setS(d); }
      catch { /* silencieux */ }
    };
    charger();
    const id = setInterval(charger, 30000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const e = etatGpu(s);
  if (!e) return null;
  return (
    <span className={`dtz-gpu-badge dtz-gpu-${e.cle}`}
          title="État du GPU souverain qui alimente l'assistant et la génération IA (mise en veille après inactivité, démarrage 1 à 2 min).">
      {e.pastille} {e.texte}
    </span>
  );
}
