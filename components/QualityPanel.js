'use client';
// Contrôle qualité d'un jeu (déterministe + suggestions IA), à la demande du
// déposant ou d'un admin. Affiche un score, une checklist et des pistes d'amélioration.
import { useState } from 'react';

const ICON = { ok: '✔', warn: '⚠', ko: '✖' };
const COLOR = { ok: '#1a7f37', warn: '#bf8700', ko: '#a3271a' };

export default function QualityPanel({ name }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState(null);
  const [msg, setMsg] = useState('');

  async function run() {
    setOpen(true); setBusy(true); setMsg(''); setRep(null);
    try {
      const r = await fetch('/api/dataset/quality', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || 'contrôle indisponible'); setBusy(false); return; }
      setRep(d);
    } catch { setMsg('contrôle indisponible'); }
    setBusy(false);
  }

  if (!open) {
    return <button className="bouton-admin secondaire" onClick={run}>🔎 Contrôle qualité</button>;
  }
  return (
    <div className="carte edition">
      <h3>Contrôle qualité {rep && <span className="badge">score {rep.score}/100</span>}</h3>
      {busy && <p className="meta">analyse en cours…</p>}
      {msg && <p className="meta">{msg}</p>}
      {rep && (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 .6rem' }}>
            {rep.checks.map((c) => (
              <li key={c.key} style={{ margin: '.2rem 0' }}>
                <span style={{ color: COLOR[c.status], fontWeight: 700 }}>{ICON[c.status]}</span>{' '}
                {c.label}{c.detail ? <span className="meta"> — {c.detail}</span> : ''}
              </li>
            ))}
          </ul>
          {rep.suggestions?.length > 0 && (
            <>
              <strong>Pistes d'amélioration :</strong>
              <ul>{rep.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
          {rep.warming && <p className="meta">Les suggestions IA n'ont pas pu être générées (le GPU démarre) ; réessayez dans une minute.</p>}
        </>
      )}
      <p><button className="bouton-admin secondaire" onClick={run} disabled={busy}>Relancer</button>{' '}
        <button className="bouton-admin secondaire" onClick={() => setOpen(false)}>Fermer</button></p>
    </div>
  );
}
