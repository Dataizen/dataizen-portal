'use client';
// Validation en un clic (admin) : publie le brouillon et le marque validé.
import { useState } from 'react';

export default function ValidateButton({ name }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function run() {
    if (!window.confirm('Valider ce jeu et le publier au catalogue ?')) return;
    setBusy(true); setMsg('validation…');
    try {
      const r = await fetch('/api/dataset/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (r.ok) { setMsg('✔ validé et publié'); setTimeout(() => window.location.reload(), 900); }
      else { const d = await r.json().catch(() => ({})); setMsg(d.error || 'échec'); setBusy(false); }
    } catch { setMsg('échec'); setBusy(false); }
  }
  return (
    <>
      <button className="bouton-admin" onClick={run} disabled={busy}>✔ Valider et publier</button>{' '}
      <span className="meta">{msg}</span>
    </>
  );
}
