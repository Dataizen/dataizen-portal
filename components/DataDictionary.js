'use client';
// Dictionnaire de données : description et type par colonne du datastore.
// Affiché sur la fiche ; éditable par les admins et le déposant (facilitateur
// graphique : pas de détour par l'admin CKAN). RGAA : table avec en-têtes.
import { useState } from 'react';

// Types déclarables (alignés datastore CKAN) : pilotent le cast des colonnes
// dans les vues et les APIs générées (dtz-sync-apis), au lieu du texte brut.
const TYPES = [
  { v: '', label: 'auto' },
  { v: 'text', label: 'texte' },
  { v: 'int', label: 'entier' },
  { v: 'numeric', label: 'décimal' },
  { v: 'timestamp', label: 'date / heure' },
  { v: 'bool', label: 'booléen' },
];
const typeLabel = (v) => TYPES.find((t) => t.v === v)?.label || 'auto';

export default function DataDictionary({ name, resourceId, fields, canEdit, dolfinByCol, dolfinType, dolfinSuggest }) {
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
    setMsg('enregistrement…');
    const r = await fetch('/api/dataset/dictionary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, resource_id: resourceId, colonnes: cols.map((f) => ({ id: f.id, ...vals[f.id] })) }),
    });
    if (r.ok) { setMsg('✔ enregistré'); setTimeout(() => window.location.reload(), 700); }
    else setMsg(r.status === 401 ? 'session expirée' : 'erreur d’enregistrement');
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
      if (rempli) parts.push(`${rempli} colonne(s) pré-remplie(s) depuis DOLFIN, vérifiez puis enregistrez`);
      else if (mappees) parts.push('les colonnes mappées à un concept DOLFIN sont déjà documentées');
      else parts.push('aucune colonne n’est mappée à un concept DOLFIN');
      if (dejaOk && rempli) parts.push(`${dejaOk} déjà renseignée(s)`);
      if (sansConcept) parts.push(`${sansConcept} colonne(s) sans concept DOLFIN : à documenter à la main ou via « Compléter avec l’IA »`);
      setMsg(parts.join(' · '));
      return next;
    });
  };

  return (
    <div>
      <h3>Dictionnaire de données</h3>
      <div className="defilable">
        <table className="donnees">
          <thead>
            <tr>
              <th>Colonne</th><th>Type déclaré</th><th>Libellé</th><th>Description</th>
              {hasDolfin && <th>Concept DOLFIN</th>}
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
                              aria-label={`Type de la colonne ${f.id}`}>
                        {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                      </select>
                    </td>
                    <td><input value={vals[f.id].label} onChange={set(f.id, 'label')} /></td>
                    <td><input value={vals[f.id].notes} onChange={set(f.id, 'notes')} /></td>
                  </>
                ) : (
                  <>
                    <td className="meta">{typeLabel(f.info?.type_override)}</td>
                    <td>{f.info?.label || <span className="meta">non renseigné</span>}</td>
                    <td>{f.info?.notes || <span className="meta">non renseigné</span>}</td>
                  </>
                )}
                {hasDolfin && (
                  <td>
                    {dolfinByCol[f.id]
                      ? <a className="badge" href={modelUrl} title={`Concept du modèle DOLFIN ${dolfinType}`}>{dolfinByCol[f.id]}</a>
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
          Le type déclaré est appliqué aux vues et aux APIs générées (les colonnes sont
          converties, par exemple en entier ou en date, au lieu d'être renvoyées en texte brut).
        </p>
      )}
      {hasDolfin && (
        <p className="meta">
          Les colonnes portant un « Concept DOLFIN » sont associées au modèle pivot{' '}
          {modelUrl ? <a href={modelUrl}><code>{dolfinType}</code></a> : <code>{dolfinType}</code>} (harmonisation sémantique).
        </p>
      )}
      {canEdit && !open && (
        <button className="bouton-admin" onClick={() => setOpen(true)}>✏️ Documenter les colonnes</button>
      )}
      {canEdit && open && (
        <p>
          <button className="bouton-admin" onClick={save}>Enregistrer</button>{' '}
          <button className="bouton-admin secondaire" onClick={() => setOpen(false)}>Annuler</button>{' '}
          {canSuggest && (
            <button className="bouton-admin secondaire" onClick={suggestFill}
              title="Remplir les libellés et notes vides à partir des concepts DOLFIN">
              ✨ Pré-remplir depuis DOLFIN
            </button>
          )}{' '}
          <span className="meta">{msg}</span>
        </p>
      )}
    </div>
  );
}
