'use client';
// Mise à jour des données d'une ressource (ou ajout d'une ressource) depuis la
// fiche : un bouton, un fichier, la chaîne de dépôt fait le reste. Quand on
// remplace le fichier d'une ressource EXISTANTE (resourceId fourni), CKAN garde
// le même identifiant de ressource : le dictionnaire de colonnes (libellés, types
// forcés), le mapping DOLFIN, les graphiques/cartes et les API branchés dessus
// sont donc préservés ; une colonne ajoutée apparaît en plus (type texte).
import { useRef, useState } from 'react';
import { uploadResumable } from '../lib/resumable';
import { useT } from './I18nProvider';

// Au-delà de ce seuil, on bascule sur l'upload résumable (tus) : pas de mur du web tier,
// reprise après coupure. En dessous, la voie directe (simple et rapide) suffit.
const SEUIL_RESUMABLE = 90 * 1024 * 1024;

const okMsg = (t, resourceId) => resourceId
  ? t('resource.ok_replaced')
  : t('resource.ok_added');

export default function UpdateResource({ dataset, resourceId, label, explain }) {
  const t = useT();
  const input = useRef(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);

    // Gros fichier : voie résumable (tus) via un ticket signé.
    if (file.size > SEUIL_RESUMABLE) {
      try {
        setMsg(t('resource.msg_preparing'));
        const dep = await fetch('/api/deposit/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resourceId ? { rid: resourceId } : { pkg: dataset }),
        }).then((x) => x.json());
        if (!dep.ticket) throw new Error(dep.error || t('resource.err_unauthorized'));
        await uploadResumable(file, dep.endpoint, dep.ticket, (pct) => setMsg(t('resource.msg_uploading', { pct })));
        setMsg(okMsg(t, resourceId));
        setTimeout(() => window.location.reload(), 3000);
      } catch (err) {
        setMsg(t('resource.msg_error', { e: err.message }));
        setBusy(false);
      }
      return;
    }

    // Petit fichier : voie directe historique.
    setMsg(t('resource.msg_uploading_direct'));
    const fd = new FormData();
    fd.set('dataset', dataset);
    if (resourceId) fd.set('resource_id', resourceId);
    fd.set('file', file);
    const r = await fetch('/api/resource/update', { method: 'POST', body: fd });
    if (r.ok) {
      setMsg(okMsg(t, resourceId));
      setTimeout(() => window.location.reload(), 3000);
    } else {
      const data = await r.json().catch(() => ({}));
      setMsg(t('resource.msg_error', { e: data.error || r.status }));
      setBusy(false);
    }
  };

  return (
    <span>
      <input ref={input} type="file" hidden
        accept=".csv,.tsv,.xlsx,.xls,.json,.geojson,.gpkg,.zip"
        onChange={(e) => upload(e.target.files[0])} />
      <button className="bouton-admin secondaire" disabled={busy} onClick={() => input.current.click()}>
        {busy ? '⏳ …' : (label || t('resource.update_button'))}
      </button>{' '}
      {explain && !msg && (
        <span className="meta">
          {t('resource.explain')}
        </span>
      )}
      {msg && <span className="meta">{msg}</span>}
    </span>
  );
}
