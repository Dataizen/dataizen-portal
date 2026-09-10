'use client';
// Suppression complète d'un jeu de données (admin). Avant de supprimer, on VÉRIFIE et on
// AFFICHE où le jeu est utilisé (cartes / graphiques / tableaux de bord publiés), pour
// prévenir l'admin. La suppression purge le jeu CKAN et tout ce qui gravite autour.
import { useState } from 'react';

const ROUGE = '#b91c1c';

export default function DeleteDataset({ name, title }) {
  const [open, setOpen] = useState(false);
  const [usages, setUsages] = useState(null); // null = en cours, [] = aucun
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function ouvrir() {
    setOpen(true); setUsages(null); setMsg('');
    try {
      const r = await fetch(`/api/dataset/usages?name=${encodeURIComponent(name)}`, { cache: 'no-store' });
      const d = await r.json();
      const lines = [];
      for (const inst of d.instances || []) {
        for (const p of inst.pages || []) lines.push(`${inst.instance} — ${p.titre || p.title || p.slug || 'page'}`);
      }
      setUsages(lines);
    } catch { setUsages([]); }
  }

  async function supprimer() {
    setBusy(true); setMsg('suppression en cours…');
    try {
      const r = await fetch('/api/dataset/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setMsg('✔ Jeu supprimé. Redirection…'); window.location.href = '/catalogue'; }
      else { setBusy(false); setMsg(`erreur : ${d.error || r.status}`); }
    } catch (e) { setBusy(false); setMsg(`erreur : ${e.message}`); }
  }

  if (!open) {
    return (
      <button className="bouton-admin secondaire" style={{ color: ROUGE, borderColor: ROUGE }} onClick={ouvrir}>
        🗑️ Supprimer ce jeu de données
      </button>
    );
  }

  return (
    <div className="carte" style={{ borderColor: ROUGE }}>
      <h3 style={{ color: ROUGE }}>Supprimer « {title} » ?</h3>
      {usages === null ? (
        <p className="meta">Vérification des utilisations…</p>
      ) : usages.length ? (
        <>
          <p style={{ color: ROUGE }}>
            ⚠️ Ce jeu est <strong>utilisé</strong> dans {usages.length} élément(s) publié(s) :
          </p>
          <ul>{usages.map((u, i) => <li key={i}>{u}</li>)}</ul>
          <p className="meta">Ces cartes, graphiques ou tableaux deviendront <strong>vides</strong> après suppression.</p>
        </>
      ) : (
        <p className="meta">✔ Ce jeu n'est utilisé dans aucune page publiée.</p>
      )}
      <p className="meta">
        La suppression est <strong>définitive</strong> : le jeu, ses ressources, les données
        (datastore), les cartes WMS/WFS, la config pygeoapi et l'index de recherche IA seront retirés.
      </p>
      <p>
        <button className="bouton-admin" style={{ background: ROUGE, borderColor: ROUGE }}
          disabled={busy || usages === null} onClick={supprimer}>
          Supprimer définitivement
        </button>{' '}
        <button className="bouton-admin secondaire" disabled={busy} onClick={() => setOpen(false)}>Annuler</button>{' '}
        <span className="meta">{msg}</span>
      </p>
    </div>
  );
}
