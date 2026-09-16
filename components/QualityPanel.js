'use client';
// Contrôle qualité d'un jeu (déterministe + suggestions IA), à la demande du
// déposant ou d'un admin. Affiche un score, une checklist et des pistes d'amélioration.
import { useState } from 'react';
import { useT } from './I18nProvider';

const ICON = { ok: '✔', warn: '⚠', ko: '✖' };
const COLOR = { ok: '#1a7f37', warn: '#bf8700', ko: '#a3271a' };

export default function QualityPanel({ name }) {
  const t = useT();
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
      if (!r.ok) { setMsg(d.error || t('quality.msg_unavailable')); setBusy(false); return; }
      setRep(d);
    } catch { setMsg(t('quality.msg_unavailable')); }
    setBusy(false);
  }

  if (!open) {
    return <button className="bouton-admin secondaire" onClick={run}>{t('quality.open_button')}</button>;
  }
  return (
    <div className="carte edition">
      <h3>{t('quality.title')} {rep && <span className="badge">{t('quality.score', { n: rep.score })}</span>}</h3>
      {busy && <p className="meta">{t('quality.analyzing')}</p>}
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
              <strong>{t('quality.suggestions_label')}</strong>
              <ul>{rep.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
          {rep.warming && <p className="meta">{t('quality.warming')}</p>}
        </>
      )}
      <p><button className="bouton-admin secondaire" onClick={run} disabled={busy}>{t('quality.rerun')}</button>{' '}
        <button className="bouton-admin secondaire" onClick={() => setOpen(false)}>{t('quality.close')}</button></p>
    </div>
  );
}
