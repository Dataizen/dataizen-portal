'use client';
// Bouton « Copier dans l'espace de travail » : copie la ressource dans un
// nouveau document Grist de l'instance, puis propose d'ouvrir Grist.
import { useState } from 'react';
import { useT } from './I18nProvider';

export default function CopyToGrist({ resourceId, docname, gristUrl }) {
  const t = useT();
  const [state, setState] = useState('');

  const go = async () => {
    setState(t('grist.msg_copying'));
    const r = await fetch('/api/grist/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: resourceId, docname }),
    });
    if (r.status === 202) setState('ok');
    else if (r.status === 401) window.location.href = '/api/auth/login';
    else setState(t('grist.msg_error'));
  };

  if (state === 'ok') {
    return (
      <span className="meta">
        {t('grist.copied')} ·{' '}
        <a href={gristUrl} target="_blank" rel="noreferrer">{t('grist.open_link')}</a>
      </span>
    );
  }
  return (
    <span className="meta">
      <button className="bouton-admin" onClick={go}>{t('grist.copy_button')}</button>{' '}
      {state && <span>{state}</span>}
    </span>
  );
}
