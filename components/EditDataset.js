'use client';
// Édition intégrée des métadonnées (admins et déposant). Les champs viennent
// de lib/metadata.js : en ajouter là-bas suffit pour qu'ils apparaissent ici.
import { useState } from 'react';

export default function EditDataset({ name, title, notes, tags, extras, fields, admin, isPrivate, licenses = [], licenseId }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    title: title || '',
    notes: notes || '',
    tags: (tags || []).join(', '),
    visibility: isPrivate ? 'private' : 'public',
    license_id: licenseId || 'notspecified',
    ...Object.fromEntries((fields || []).map((f) => [f.key, extras?.[f.key] || ''])),
  });
  const [msg, setMsg] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  // Complète les champs VIDES avec une proposition IA (post-dépôt, à la demande).
  // Ne remplace jamais une valeur déjà saisie ; l'utilisateur vérifie puis enregistre.
  const completerIA = async () => {
    setAiBusy(true); setMsg("l'IA analyse les données…");
    try {
      const r = await fetch('/api/dataset/metadata-propose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.warming) { setMsg(d.message); setAiBusy(false); return; }
      if (d.error) { setMsg('IA : ' + d.error); setAiBusy(false); return; }
      setValues((v) => {
        const nv = { ...v };
        if (d.title && !v.title.trim()) nv.title = d.title;
        if (d.notes && !v.notes.trim()) nv.notes = d.notes;
        if (Array.isArray(d.tags) && d.tags.length && !v.tags.trim()) nv.tags = d.tags.join(', ');
        for (const [k, val] of Object.entries(d.extras || {})) {
          if (k in nv && !String(nv[k] || '').trim()) nv[k] = val;
        }
        return nv;
      });
      setMsg('✨ Champs vides complétés par l’IA : vérifiez puis enregistrez.');
    } catch { setMsg('IA indisponible.'); }
    setAiBusy(false);
  };

  const save = async () => {
    setMsg('enregistrement…');
    const r = await fetch('/api/dataset/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...values }),
    });
    if (r.ok) {
      setMsg('✔ enregistré');
      setTimeout(() => window.location.reload(), 700);
    } else {
      setMsg(r.status === 401 ? 'session expirée : reconnectez-vous' : 'erreur d’enregistrement');
    }
  };

  if (!open) {
    return (
      <button className="bouton-admin" onClick={() => setOpen(true)}>
        ✏️ Modifier les métadonnées
      </button>
    );
  }
  return (
    <div className="carte edition">
      <label>Titre</label>
      <input value={values.title} onChange={set('title')} />
      <label>Description</label>
      <textarea rows={5} value={values.notes} onChange={set('notes')} />
      {(fields || []).map((f) => (
        <div key={f.key}>
          <label>{f.label}</label>
          {f.type === 'select' ? (
            <select value={values[f.key]} onChange={set(f.key)}>
              <option value="">-</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={f.type === 'date' ? 'date' : 'text'} value={values[f.key]}
              onChange={set(f.key)} placeholder={f.placeholder || ''} />
          )}
        </div>
      ))}
      <label>Mots-clés (séparés par des virgules)</label>
      <input value={values.tags} onChange={set('tags')} />
      {licenses.length > 0 && (
        <>
          <label>Licence</label>
          <select value={values.license_id} onChange={set('license_id')}>
            {licenses.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </>
      )}
      {admin && (
        <>
          <label>Visibilité</label>
          <select value={values.visibility} onChange={set('visibility')}>
            <option value="private">Privé (brouillon)</option>
            <option value="public">Public (visible au catalogue)</option>
          </select>
        </>
      )}
      <p>
        <button className="bouton-admin" onClick={save}>Enregistrer</button>{' '}
        <button className="bouton-admin secondaire" onClick={completerIA} disabled={aiBusy}>
          {aiBusy ? '⏳ L’IA analyse…' : '✨ Compléter avec l’IA'}
        </button>{' '}
        <button className="bouton-admin secondaire" onClick={() => setOpen(false)}>Annuler</button>{' '}
        <span className="meta">{msg}</span>
      </p>
    </div>
  );
}
