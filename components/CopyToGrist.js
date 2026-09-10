'use client';
// Bouton « Copier dans l'espace de travail » : copie la ressource dans un
// nouveau document Grist de l'instance, puis propose d'ouvrir Grist.
import { useState } from 'react';

export default function CopyToGrist({ resourceId, docname, gristUrl }) {
  const [state, setState] = useState('');

  const go = async () => {
    setState('copie en cours…');
    const r = await fetch('/api/grist/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: resourceId, docname }),
    });
    if (r.status === 202) setState('ok');
    else if (r.status === 401) window.location.href = '/api/auth/login';
    else setState('erreur');
  };

  if (state === 'ok') {
    return (
      <span className="meta">
        ✔ copié ·{' '}
        <a href={gristUrl} target="_blank" rel="noreferrer">ouvrir l’espace de travail (Grist)</a>
      </span>
    );
  }
  return (
    <span className="meta">
      <button className="bouton-admin" onClick={go}>📋 Copier dans l’espace de travail (Grist)</button>{' '}
      {state && <span>{state}</span>}
    </span>
  );
}
