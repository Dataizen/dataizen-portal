'use client';
// Formulaire de dépôt : facilitateur graphique unique pour créer un jeu de
// données (métadonnées + fichier ou URL) sans passer par l'admin CKAN.
// Le fichier est déposé en UPLOAD RÉSUMABLE (tus, composant ResumableFile) : gros
// fichiers (jusqu'à 10 Go) et reprise après coupure, sans passer par le web tier.
// Pré-remplissage IA : l'entête + un échantillon du fichier CSV sont lus côté
// client et envoyés au service RAG qui propose titre, description, mots-clés.
import { useState, useRef, useEffect } from 'react';
import ResumableFile from './ResumableFile';

// Parse rapide (entête + échantillon) d'un CSV/TSV côté client. Détection simple
// du séparateur et retrait des guillemets ; suffisant pour le contexte IA.
function parseDelimited(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return { columns: [], sample: [] };
  const head = lines[0];
  const delim = [';', ',', '\t'].map((d) => [d, head.split(d).length])
    .sort((a, b) => b[1] - a[1])[0][0];
  const split = (l) => l.split(delim).map((c) => c.replace(/^"(.*)"$/, '$1').trim());
  const columns = split(head).filter(Boolean);
  const sample = lines.slice(1, 9).map((l) => {
    const cells = split(l);
    const o = {};
    columns.forEach((c, i) => { o[c] = cells[i] ?? ''; });
    return o;
  });
  return { columns, sample };
}

export default function DepositForm({ admin, organizations, instanceOrg, licenses, fields, depositor }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [vals, setVals] = useState(
    depositor?.email && fields.some((f) => f.key === 'point_de_contact')
      ? { point_de_contact: depositor.email } : {});
  const [parsed, setParsed] = useState(null); // { columns, sample, filename }
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [mounted, setMounted] = useState(false); // Uppy est client-only (pas de SSR)
  const fileRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const setVal = (k) => (e) => setVals((v) => ({ ...v, [k]: e.target.value }));

  // Appelé quand un fichier est déposé dans Uppy : pré-remplissage IA pour les CSV.
  async function onFileSelected(blob, name) {
    setParsed(null); setAiMsg('');
    if (!/\.(csv|tsv|txt)$/i.test(name || '')) {
      setAiMsg('Pré-remplissage IA disponible pour les fichiers CSV.');
      return;
    }
    try {
      const text = await blob.slice(0, 65536).text();
      const { columns, sample } = parseDelimited(text);
      if (columns.length) {
        setParsed({ columns, sample, filename: name });
        setAiMsg(`${columns.length} colonnes détectées : vous pouvez pré-remplir avec l'IA.`);
      }
    } catch { /* fichier illisible côté client : pré-remplissage indisponible */ }
  }

  async function prefill() {
    if (!parsed) { setAiMsg("Choisissez d'abord un fichier CSV."); return; }
    setAiBusy(true); setAiMsg("L'IA analyse le fichier (le GPU peut mettre 1 à 2 min à démarrer)…");
    try {
      const r = await fetch('/api/dataset/prefill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed,
          fields: fields.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options })),
        }),
      });
      const d = await r.json();
      if (d.warming) { setAiMsg(d.message); setAiBusy(false); return; }
      if (d.error) { setAiMsg('IA : ' + d.error); setAiBusy(false); return; }
      if (d.title) setTitle(d.title);
      if (d.notes) setNotes(d.notes);
      if (Array.isArray(d.tags) && d.tags.length) setTags(d.tags.join(', '));
      if (d.extras) setVals((v) => ({ ...v, ...d.extras }));
      setAiMsg('✨ Métadonnées pré-remplies : vérifiez et ajustez avant de déposer.');
    } catch { setAiMsg('IA indisponible.'); }
    setAiBusy(false);
  }

  const submit = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    const hasFile = fileRef.current?.hasFile();
    setMsg('création du jeu…');
    const fd = new FormData(e.target); // métadonnées + éventuelle URL (PAS le fichier : il passe par tus)
    let data;
    try {
      const r = await fetch('/api/dataset/create', { method: 'POST', body: fd });
      data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || r.status);
    } catch (err) {
      setEnvoi(false); setMsg(`erreur : ${err.message}`); return;
    }

    // Dépôt du fichier en upload résumable (le composant Uppy affiche la progression).
    if (hasFile) {
      try {
        setMsg('dépôt du fichier en cours… (vous pouvez suivre la progression ci-dessus ; la reprise est automatique)');
        const t = await fetch('/api/deposit/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pkg: data.name }),
        }).then((x) => x.json());
        if (!t.ticket) throw new Error(t.error || 'dépôt non autorisé');
        await fileRef.current.upload(t.endpoint, t.ticket);
      } catch (err) {
        setEnvoi(false);
        setMsg(`Jeu créé, mais le dépôt du fichier a échoué (${err.message}). Vous pouvez réessayer depuis la fiche du jeu.`);
        setTimeout(() => { window.location.href = `/dataset/${data.name}`; }, 4000);
        return;
      }
    }
    setMsg('✔ Dépôt terminé (brouillon privé ; un administrateur le publiera). Redirection…');
    window.location.href = `/dataset/${data.name}`;
  };

  return (
    <form className="carte edition" onSubmit={submit}>
      <label>Titre *</label>
      <input name="title" required minLength={3} maxLength={200} value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ex : Équipements sportifs de la commune" />

      <label>Description</label>
      <textarea name="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Que contient cette donnée, comment a-t-elle été produite ?" />

      {fields.map((f) => (
        <div key={f.key}>
          <label>{f.label}</label>
          {f.type === 'select' ? (
            <select name={f.key} value={vals[f.key] || ''} onChange={setVal(f.key)}>
              <option value="">-</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={f.type === 'date' ? 'date' : 'text'} name={f.key}
              value={vals[f.key] || ''} onChange={setVal(f.key)}
              placeholder={f.placeholder || ''} maxLength={500} />
          )}
        </div>
      ))}

      <label>Mots-clés (séparés par des virgules)</label>
      <input name="tags" value={tags} onChange={(e) => setTags(e.target.value)}
        placeholder="ex : sport, équipements, jeunesse" />

      <label>Licence</label>
      <select name="license_id" defaultValue="notspecified">
        {licenses.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
      </select>

      {admin ? (
        <>
          <label>Organisation</label>
          <select name="organization" defaultValue={instanceOrg}>
            {organizations.map((o) => <option key={o.name} value={o.name}>{o.display_name || o.name}</option>)}
          </select>
          <label>Visibilité</label>
          <select name="visibility" defaultValue="private">
            <option value="private">Privé (brouillon, visible des admins)</option>
            <option value="public">Public (visible au catalogue)</option>
          </select>
        </>
      ) : (
        <p className="meta">
          Le jeu de données sera déposé en <strong>privé</strong> dans l'organisation « {instanceOrg} » :
          un administrateur pourra le publier au catalogue.
        </p>
      )}

      <label>Fichier de données (CSV, XLSX, GeoJSON… jusqu'à 10 Go, reprise automatique)</label>
      {mounted
        ? <ResumableFile ref={fileRef} onFileSelected={onFileSelected} />
        : <p className="meta">chargement du dépôt de fichier…</p>}
      <p style={{ margin: '.4rem 0' }}>
        <button type="button" className="bouton-admin secondaire" onClick={prefill} disabled={aiBusy || !parsed}>
          {aiBusy ? '⏳ L\'IA analyse…' : '✨ Pré-remplir les métadonnées avec l\'IA'}
        </button>{' '}
        <span className="meta">{aiMsg}</span>
      </p>
      <p className="meta">ou lien vers une donnée hébergée ailleurs :</p>
      <input name="resource_url" type="url" placeholder="https://…" />

      <p>
        <button className="bouton-admin" disabled={envoi} type="submit">Déposer</button>{' '}
        <span className="meta">{msg}</span>
      </p>
    </form>
  );
}
