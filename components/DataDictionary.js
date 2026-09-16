'use client';
// Dictionnaire de données : description et type par colonne du datastore.
// Affiché sur la fiche ; éditable par les admins et le déposant (facilitateur
// graphique : pas de détour par l'admin CKAN). RGAA : table avec en-têtes.
import { useState } from 'react';
import { useT } from './I18nProvider';

// Types déclarables (alignés datastore CKAN) : pilotent le cast des colonnes
// dans les vues et les APIs générées (dtz-sync-apis), au lieu du texte brut.
const TYPES = [
  { v: '', k: 'dict.type_auto' },
  { v: 'text', k: 'dict.type_text' },
  { v: 'int', k: 'dict.type_int' },
  { v: 'numeric', k: 'dict.type_numeric' },
  { v: 'timestamp', k: 'dict.type_timestamp' },
  { v: 'bool', k: 'dict.type_bool' },
];
const typeLabel = (t, v) => t(TYPES.find((x) => x.v === v)?.k || 'dict.type_auto');

export default function DataDictionary({ name, resourceId, fields, canEdit, dolfinByCol, dolfinType, dolfinSuggest }) {
  const t = useT();
  const cols = (fields || []).filter((f) => f.id !== '_id');
  // Lien avec le schéma DOLFIN : une colonne peut porter un concept du modèle pivot.
  const hasDolfin = !!dolfinByCol && Object.keys(dolfinByCol).length > 0;
  const modelUrl = dolfinType ? `/dolfin/modele/${encodeURIComponent(dolfinType)}` : null;
  const canSuggest = !!dolfinSuggest && Object.keys(dolfinSuggest).length > 0;
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState(() =>
    Object.fromEntries(cols.map((f) => [f.id, {
      label: f.info?.label || '', notes: f.info?.notes || '', type_override: f.info?.type_override || '',
    }])));
  const [msg, setMsg] = useState('');
  if (!cols.length) return null;

  const set = (id, k) => (e) => setVals({ ...vals, [id]: { ...vals[id], [k]: e.target.value } });
  const declares = cols.some((f) => f.info?.type_override);
  const save = async () => {
    setMsg(t('dict.msg_saving'));
    const r = await fetch('/api/dataset/dictionary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, resource_id: resourceId, colonnes: cols.map((f) => ({ id: f.id, ...vals[f.id] })) }),
    });
    if (r.ok) { setMsg(t('dict.msg_saved')); setTimeout(() => window.location.reload(), 700); }
    else setMsg(r.status === 401 ? t('dict.msg_session_expired') : t('dict.msg_save_error'));
  };

  // Pré-remplit les libellés/notes VIDES des colonnes associées à un concept DOLFIN,
  // depuis la définition canonique (Smart Data Models). Ne touche pas aux valeurs déjà
  // saisies. L'auteur vérifie puis enregistre.
  const suggestFill = () => {
    setVals((cur) => {
      const next = { ...cur };
      let rempli = 0; let dejaOk = 0;
      for (const f of cols) {
        const s = dolfinSuggest?.[f.id];
        if (!s) continue;  // colonne sans concept DOLFIN : rien à proposer
        const avant = next[f.id];
        const label = avant.label || s.label || '';
        const notes = avant.notes || s.notes || '';
        if (label !== avant.label || notes !== avant.notes) rempli += 1;
        else dejaOk += 1;
        next[f.id] = { ...next[f.id], label, notes };
      }
      const mappees = cols.filter((f) => dolfinSuggest?.[f.id]).length;
      const sansConcept = cols.length - mappees;
      // Message explicite : le pré-remplissage DOLFIN ne couvre QUE les colonnes mappées
      // à un concept du modèle ; les autres restent à documenter (manuel ou IA).
      const parts = [];
      if (rempli) parts.push(t('dict.fill_prefilled', { n: rempli }));
      else if (mappees) parts.push(t('dict.fill_already_doc'));
      else parts.push(t('dict.fill_none_mapped'));
      if (dejaOk && rempli) parts.push(t('dict.fill_already_filled', { n: dejaOk }));
      if (sansConcept) parts.push(t('dict.fill_no_concept', { n: sansConcept }));
      setMsg(parts.join(' · '));
      return next;
    });
  };

  return (
    <div>
      <h3>{t('dict.title')}</h3>
      <div className="defilable">
        <table className="donnees">
          <thead>
            <tr>
              <th>{t('dict.th_column')}</th><th>{t('dict.th_type')}</th><th>{t('dict.th_label')}</th><th>{t('dict.th_description')}</th>
              {hasDolfin && <th>{t('dict.th_concept')}</th>}
            </tr>
          </thead>
          <tbody>
            {cols.map((f) => (
              <tr key={f.id} id={`col-${f.id}`}>
                <td><code>{f.id}</code></td>
                {open ? (
                  <>
                    <td>
                      <select value={vals[f.id].type_override} onChange={set(f.id, 'type_override')}
                              aria-label={t('dict.aria_col_type', { id: f.id })}>
                        {TYPES.map((ty) => <option key={ty.v} value={ty.v}>{t(ty.k)}</option>)}
                      </select>
                    </td>
                    <td><input value={vals[f.id].label} onChange={set(f.id, 'label')} /></td>
                    <td><input value={vals[f.id].notes} onChange={set(f.id, 'notes')} /></td>
                  </>
                ) : (
                  <>
                    <td className="meta">{typeLabel(t, f.info?.type_override)}</td>
                    <td>{f.info?.label || <span className="meta">{t('dict.not_set')}</span>}</td>
                    <td>{f.info?.notes || <span className="meta">{t('dict.not_set')}</span>}</td>
                  </>
                )}
                {hasDolfin && (
                  <td>
                    {dolfinByCol[f.id]
                      ? <a className="badge" href={modelUrl} title={t('dict.concept_title', { type: dolfinType })}>{dolfinByCol[f.id]}</a>
                      : <span className="meta"> </span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(declares || open) && (
        <p className="meta">
          {t('dict.type_note')}
        </p>
      )}
      {hasDolfin && (
        <p className="meta">
          {t('dict.dolfin_note_before')}{' '}
          {modelUrl ? <a href={modelUrl}><code>{dolfinType}</code></a> : <code>{dolfinType}</code>} {t('dict.dolfin_note_after')}
        </p>
      )}
      {canEdit && !open && (
        <button className="bouton-admin" onClick={() => setOpen(true)}>{t('dict.doc_columns_btn')}</button>
      )}
      {canEdit && open && (
        <p>
          <button className="bouton-admin" onClick={save}>{t('dict.save')}</button>{' '}
          <button className="bouton-admin secondaire" onClick={() => setOpen(false)}>{t('dict.cancel')}</button>{' '}
          {canSuggest && (
            <button className="bouton-admin secondaire" onClick={suggestFill}
              title={t('dict.prefill_title')}>
              {t('dict.prefill_btn')}
            </button>
          )}{' '}
          <span className="meta">{msg}</span>
        </p>
      )}
    </div>
  );
}
