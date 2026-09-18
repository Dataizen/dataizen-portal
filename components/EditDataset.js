'use client';
// Édition intégrée des métadonnées (admins et déposant). Les champs viennent
// de lib/metadata.js : en ajouter là-bas suffit pour qu'ils apparaissent ici.
import { useState } from 'react';
import { useT } from './I18nProvider';
import { themeCode, fieldLabel, fieldPlaceholder, optionLabel } from '../lib/metadata';

export default function EditDataset({ name, title, notes, tags, extras, fields, admin, isPrivate, licenses = [], licenseId }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    title: title || '',
    notes: notes || '',
    tags: (tags || []).join(', '),
    visibility: isPrivate ? 'private' : 'public',
    license_id: licenseId || 'notspecified',
    // le thème peut être stocké en ancien libellé FR (non migré) : on le normalise en
    // code EU pour qu'il corresponde à une option du menu.
    ...Object.fromEntries((fields || []).map((f) => [f.key,
      f.i18nOptions === 'theme' ? (themeCode(extras?.[f.key]) || '') : (extras?.[f.key] || '')])),
  });
  const [msg, setMsg] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  // Complète les champs VIDES avec une proposition IA (post-dépôt, à la demande).
  // Ne remplace jamais une valeur déjà saisie ; l'utilisateur vérifie puis enregistre.
  const completerIA = async () => {
    setAiBusy(true); setMsg(t('edit.msg_ai_analyzing'));
    try {
      const r = await fetch('/api/dataset/metadata-propose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.warming) { setMsg(d.message); setAiBusy(false); return; }
      if (d.error) { setMsg(t('edit.ai_error_prefix') + d.error); setAiBusy(false); return; }
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
      setMsg(t('edit.msg_ai_filled'));
    } catch { setMsg(t('edit.msg_ai_unavailable')); }
    setAiBusy(false);
  };

  const save = async () => {
    setMsg(t('edit.msg_saving'));
    const r = await fetch('/api/dataset/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...values }),
    });
    if (r.ok) {
      setMsg(t('edit.msg_saved'));
      setTimeout(() => window.location.reload(), 700);
    } else {
      setMsg(r.status === 401 ? t('edit.msg_session_expired') : t('edit.msg_save_error'));
    }
  };

  if (!open) {
    return (
      <button className="bouton-admin" onClick={() => setOpen(true)}>
        {t('edit.open_button')}
      </button>
    );
  }
  return (
    <div className="carte edition">
      <label>{t('edit.label_title')}</label>
      <input value={values.title} onChange={set('title')} />
      <label>{t('edit.label_description')}</label>
      <textarea rows={5} value={values.notes} onChange={set('notes')} />
      {(fields || []).map((f) => (
        <div key={f.key}>
          <label>{fieldLabel(f, t)}</label>
          {f.type === 'select' ? (
            <select value={values[f.key]} onChange={set(f.key)}>
              <option value="">-</option>
              {f.options.map((o, i) => <option key={o} value={o}>{optionLabel(f, o, i, t)}</option>)}
            </select>
          ) : (
            <input type={f.type === 'date' ? 'date' : 'text'} value={values[f.key]}
              onChange={set(f.key)} placeholder={fieldPlaceholder(f, t)} />
          )}
        </div>
      ))}
      <label>{t('edit.label_tags')}</label>
      <input value={values.tags} onChange={set('tags')} />
      {licenses.length > 0 && (
        <>
          <label>{t('edit.label_license')}</label>
          <select value={values.license_id} onChange={set('license_id')}>
            {licenses.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </>
      )}
      {admin && (
        <>
          <label>{t('edit.label_visibility')}</label>
          <select value={values.visibility} onChange={set('visibility')}>
            <option value="private">{t('edit.vis_private')}</option>
            <option value="public">{t('edit.vis_public')}</option>
          </select>
        </>
      )}
      <p>
        <button className="bouton-admin" onClick={save}>{t('edit.save')}</button>{' '}
        <button className="bouton-admin secondaire" onClick={completerIA} disabled={aiBusy}>
          {aiBusy ? t('edit.ai_analyzing') : t('edit.ai_complete')}
        </button>{' '}
        <button className="bouton-admin secondaire" onClick={() => setOpen(false)}>{t('edit.cancel')}</button>{' '}
        <span className="meta">{msg}</span>
      </p>
    </div>
  );
}
