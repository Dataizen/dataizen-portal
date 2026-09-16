'use client';
// Suppression complète d'un jeu de données (admin). Avant de supprimer, on VÉRIFIE et on
// AFFICHE où le jeu est utilisé (cartes / graphiques / tableaux de bord publiés), pour
// prévenir l'admin. La suppression purge le jeu CKAN et tout ce qui gravite autour.
import { useState } from 'react';
import { useT } from './I18nProvider';

const ROUGE = '#b91c1c';

export default function DeleteDataset({ name, title }) {
  const t = useT();
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
        for (const p of inst.pages || []) lines.push(`${inst.instance} — ${p.titre || p.title || p.slug || t('delete.page_fallback')}`);
      }
      setUsages(lines);
    } catch { setUsages([]); }
  }

  async function supprimer() {
    setBusy(true); setMsg(t('delete.msg_deleting'));
    try {
      const r = await fetch('/api/dataset/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setMsg(t('delete.msg_deleted')); window.location.href = '/catalogue'; }
      else { setBusy(false); setMsg(t('delete.msg_error', { e: d.error || r.status })); }
    } catch (e) { setBusy(false); setMsg(t('delete.msg_error', { e: e.message })); }
  }

  if (!open) {
    return (
      <button className="bouton-admin secondaire" style={{ color: ROUGE, borderColor: ROUGE }} onClick={ouvrir}>
        {t('delete.open_button')}
      </button>
    );
  }

  return (
    <div className="carte" style={{ borderColor: ROUGE }}>
      <h3 style={{ color: ROUGE }}>{t('delete.confirm_title', { title })}</h3>
      {usages === null ? (
        <p className="meta">{t('delete.checking')}</p>
      ) : usages.length ? (
        <>
          <p style={{ color: ROUGE }}>
            {t('delete.used_before')} <strong>{t('delete.used_strong')}</strong> {t('delete.used_after', { n: usages.length })}
          </p>
          <ul>{usages.map((u, i) => <li key={i}>{u}</li>)}</ul>
          <p className="meta">{t('delete.will_empty_before')} <strong>{t('delete.will_empty_strong')}</strong> {t('delete.will_empty_after')}</p>
        </>
      ) : (
        <p className="meta">{t('delete.not_used')}</p>
      )}
      <p className="meta">
        {t('delete.definitive_before')} <strong>{t('delete.definitive_strong')}</strong> {t('delete.definitive_after')}
      </p>
      <p>
        <button className="bouton-admin" style={{ background: ROUGE, borderColor: ROUGE }}
          disabled={busy || usages === null} onClick={supprimer}>
          {t('delete.confirm_button')}
        </button>{' '}
        <button className="bouton-admin secondaire" disabled={busy} onClick={() => setOpen(false)}>{t('delete.cancel')}</button>{' '}
        <span className="meta">{msg}</span>
      </p>
    </div>
  );
}
