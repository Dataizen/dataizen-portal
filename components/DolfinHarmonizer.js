'use client';
// Harmonisation DOLFIN dans le portail : associe les champs d'un modèle canonique
// (Smart Data Models) aux colonnes du jeu, avec proposition par l'IA souveraine.
// Réservé aux personnes pouvant éditer le jeu (admin d'instance ou déposant).
// À l'enregistrement, CKAN régénère une ressource NGSI-LD (interopérabilité MIM2).
import { useState } from 'react';

export default function DolfinHarmonizer({ name, admin, harmonized }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [cols, setCols] = useState([]);
  const [mi, setMi] = useState(0);
  const [map, setMap] = useState({ id: '', fields: {}, lon: '', lat: '' });
  const [msg, setMsg] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [gpu, setGpu] = useState(null);
  const [genBusy, setGenBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null); // brouillon .dolfin généré : { dolfin, type, titre }
  const [genMsg, setGenMsg] = useState('');

  const model = models[mi];

  function refreshGpu() {
    fetch('/api/dolfin/gpu').then((r) => r.json()).then(setGpu).catch(() => {});
  }

  function gpuBadge() {
    if (!gpu) return null;
    if (!gpu.available) return <span className="meta" title="état GPU indisponible">⚫ IA</span>;
    if (gpu.ollama_ready) return <span className="meta" style={{ color: '#1a7f37' }}>🟢 GPU prêt</span>;
    if (gpu.wake_in_progress || gpu.instance_status === 'ACTIVE') return <span className="meta" style={{ color: '#bf8700' }}>🟠 GPU démarre…</span>;
    return <span className="meta" title="démarrera au 1er appel (1 à 2 min)">⚪ GPU en veille</span>;
  }

  async function openPanel() {
    setOpen(true); setLoading(true); setMsg('');
    refreshGpu();
    try {
      const r = await fetch(`/api/dataset/dolfin/data?name=${encodeURIComponent(name)}`);
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || 'erreur de chargement'); setLoading(false); return; }
      setModels(d.models || []); setCols(d.columns || []);
      if (d.current_mapping) {
        try {
          const cur = JSON.parse(d.current_mapping);
          const idx = (d.models || []).findIndex((m) => m.type === cur.type);
          if (idx >= 0) setMi(idx);
          setMap({
            id: cur.id_field || '', fields: cur.fields || {},
            lon: cur.location?.lon || '', lat: cur.location?.lat || '',
          });
        } catch { /* mapping courant illisible : on repart de zéro */ }
      }
    } catch { setMsg('erreur réseau'); }
    setLoading(false);
  }

  const setField = (f) => (e) => setMap({ ...map, fields: { ...map.fields, [f]: e.target.value } });
  const setKey = (k) => (e) => setMap({ ...map, [k]: e.target.value });
  const changeModel = (e) => { setMi(Number(e.target.value)); setMap({ id: '', fields: {}, lon: '', lat: '' }); };

  function build() {
    const m = models[mi];
    const out = { type: m.type, context: 'https://smartdatamodels.org/context.jsonld',
                  id_prefix: 'urn:ngsi-ld:' + m.type + ':', fields: {} };
    if (map.id) out.id_field = map.id;
    (m.champs || []).forEach((f) => { if (map.fields[f]) out.fields[f] = map.fields[f]; });
    if (m.geo && map.lon && map.lat) out.location = { lon: map.lon, lat: map.lat };
    return out;
  }

  async function propose() {
    setAiBusy(true); setMsg('L\'IA analyse les colonnes (le GPU peut mettre 1 à 2 min à démarrer)…');
    try {
      const r = await fetch(`/api/dataset/dolfin/propose?name=${encodeURIComponent(name)}&model=${mi}`);
      const d = await r.json();
      if (d.warming) { setMsg(d.message || 'L\'IA démarre, réessaie dans une minute.'); setAiBusy(false); return; }
      if (d.error) { setMsg('IA : ' + d.error); setAiBusy(false); return; }
      const mp = d.mapping || {};
      setMap({ id: mp.id_field || '', fields: mp.fields || {},
               lon: mp.location?.lon || '', lat: mp.location?.lat || '' });
      const n = Object.keys(mp.fields || {}).length;
      setMsg(`Proposition IA appliquée (${n} champ(s) mappé(s)). Vérifie, ajuste, puis enregistre.`);
    } catch { setMsg('IA indisponible.'); }
    setAiBusy(false);
    refreshGpu();
  }

  // Génère un brouillon de modèle canonique .dolfin par l'IA à partir de CE jeu.
  async function generateModel() {
    setGenBusy(true); setDraft(null);
    setGenMsg('L\'IA rédige un modèle à partir de ce jeu (le GPU peut mettre 1 à 2 min à démarrer)…');
    try {
      const r = await fetch('/api/dataset/dolfin/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.warming) { setGenMsg(d.message || 'L\'IA démarre, réessaie dans une minute.'); setGenBusy(false); return; }
      if (!r.ok || d.error) { setGenMsg('IA : ' + (d.error || 'indisponible')); setGenBusy(false); return; }
      setDraft({ dolfin: d.dolfin || '', type: d.type_suggestion || '', titre: d.title || name });
      setGenMsg('Brouillon généré. Relis, ajuste le type et le titre, puis enregistre le modèle.');
    } catch { setGenMsg('IA indisponible.'); }
    setGenBusy(false);
    refreshGpu();
  }

  // Enregistre le brouillon comme modèle DOLFIN : l'action CKAN compile le .dolfin,
  // le versionne, et le modèle devient sélectionnable pour harmoniser ce jeu.
  async function saveModel() {
    if (!draft) return;
    if (!draft.type.trim() || !draft.titre.trim()) { setGenMsg('Renseigne un type et un titre.'); return; }
    setSaving(true); setGenMsg('enregistrement + compilation du .dolfin…');
    try {
      const r = await fetch('/api/dolfin/models', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: draft.type.trim(), titre: draft.titre.trim(), dolfin: draft.dolfin, desc: '' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setGenMsg('Enregistrement refusé : ' + (d.error || 'vérifie la syntaxe .dolfin')); setSaving(false); return; }
      const savedType = draft.type.trim();
      setGenMsg('✔ Modèle enregistré et compilé' + (d.message ? ' — ' + d.message : '') + '. Sélectionne-le ci-dessus pour harmoniser ce jeu.');
      setDraft(null);
      // recharger la liste des modèles et sélectionner le nouveau
      const rr = await fetch(`/api/dataset/dolfin/data?name=${encodeURIComponent(name)}`);
      const dd = await rr.json();
      if (rr.ok) {
        setModels(dd.models || []);
        const idx = (dd.models || []).findIndex((m) => m.type === savedType);
        if (idx >= 0) { setMi(idx); setMap({ id: '', fields: {}, lon: '', lat: '' }); }
      }
    } catch { setGenMsg('erreur réseau'); }
    setSaving(false);
  }

  async function save() {
    setMsg('enregistrement…');
    const r = await fetch('/api/dataset/dolfin/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mapping: build() }),
    });
    if (r.ok) {
      setMsg('✔ Enregistré. Harmonisation lancée : les 3 ressources (NGSI-LD, CSV, GeoJSON) '
        + 'apparaissent dans la liste des ressources du jeu d’ici une minute.');
      setTimeout(() => window.location.reload(), 2500);
    }
    else { const d = await r.json().catch(() => ({})); setMsg(d.error || 'erreur d\'enregistrement'); }
  }

  const opt = (val, onChange, key) => (
    <select value={val} onChange={onChange} aria-label={key}>
      <option value="">— colonne —</option>
      {cols.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );

  if (!open) {
    return <button className="bouton-admin" onClick={openPanel}>🧩 {harmonized ? "Modifier l'harmonisation (DOLFIN)" : 'Harmoniser (DOLFIN)'}</button>;
  }

  return (
    <div className="carte edition">
      <h3>Harmonisation DOLFIN</h3>
      {loading ? <p className="meta">chargement…</p> : (!cols.length ? (
        <p className="meta">Aucune ressource CSV chargée dans le datastore pour ce jeu. Dépose un
          CSV et attends son chargement, puis reviens ici.</p>
      ) : (
        <>
          <p className="meta">{"Associe les champs du modèle aux colonnes du jeu, ou laisse l'IA proposer."}</p>
          <p className="meta">{"À l'enregistrement, 3 ressources harmonisées sont (re)générées et ajoutées au jeu, alignées sur le modèle pivot (Smart Data Models) : "}
            <strong>NGSI-LD</strong>{" (interopérabilité MIM2), "}<strong>{"CSV harmonisé"}</strong>{" et "}<strong>GeoJSON</strong>{". Elles apparaissent dans la liste des ressources du jeu (elles ne remplacent pas la donnée d'origine)."}</p>
          {admin && <p className="meta" style={{ margin: '0 0 .4rem' }}><a href="/dolfin/models">🧩 Gérer les modèles DOLFIN</a></p>}

          {admin && (
            <div style={{ margin: '0 0 .8rem' }}>
              <button className="bouton-admin secondaire" onClick={generateModel} disabled={genBusy}>
                {genBusy ? '⏳ L\'IA rédige…' : '✨ Générer un modèle DOLFIN (IA) depuis ce jeu'}
              </button>{' '}
              {gpuBadge()}
              {(genMsg && !draft) && <span className="meta" style={{ marginLeft: '.5rem' }}>{genMsg}</span>}
              {draft && (
                <div className="carte" style={{ marginTop: '.6rem' }}>
                  <p className="meta">{'Brouillon de modèle canonique '}<code>.dolfin</code>{' généré par l\'IA à partir des colonnes et d\'un échantillon de ce jeu. Base éditable : relis et ajuste. À l\'enregistrement, le '}<code>.dolfin</code>{' est compilé et versionné, et le modèle devient sélectionnable ci-dessus pour harmoniser ce jeu.'}</p>
                  <label>{'Type (identifiant du modèle) '}
                    <input value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} placeholder="PointOfInterest" />
                  </label>
                  <label>{'Titre '}
                    <input value={draft.titre} onChange={(e) => setDraft({ ...draft, titre: e.target.value })} placeholder="Points d'intérêt" />
                  </label>
                  <textarea value={draft.dolfin} spellCheck={false} rows={18}
                    onChange={(e) => setDraft({ ...draft, dolfin: e.target.value })}
                    style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '.85rem', lineHeight: 1.45, whiteSpace: 'pre', overflow: 'auto' }} />
                  <p>
                    <button className="bouton-admin" onClick={saveModel} disabled={saving}>Enregistrer le modèle</button>{' '}
                    <button className="bouton-admin secondaire" onClick={() => { setDraft(null); setGenMsg(''); }}>Annuler</button>{' '}
                    <span className="meta">{genMsg}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <label>Modèle DOLFIN
            <select value={mi} onChange={changeModel}>
              {models.map((m, i) => <option key={m.type} value={i}>{m.titre}</option>)}
            </select>
          </label>
          {model?.desc && <p className="meta">{model.desc}</p>}

          <p>
            <button className="bouton-admin secondaire" onClick={propose} disabled={aiBusy}>
              {aiBusy ? '⏳ L\'IA réfléchit…' : '✨ Proposer le mapping (IA)'}
            </button>{' '}
            {gpuBadge()}
          </p>

          {model && (
            <div className="dolfin-mapper">
              <label>Identifiant {opt(map.id, setKey('id'), 'Identifiant')}</label>
              {(model.champs || []).map((f) => (
                <label key={f}>{f} {opt(map.fields[f] || '', setField(f), f)}</label>
              ))}
              {model.geo && (
                <>
                  <label>Longitude {opt(map.lon, setKey('lon'), 'Longitude')}</label>
                  <label>Latitude {opt(map.lat, setKey('lat'), 'Latitude')}</label>
                </>
              )}
            </div>
          )}

          <p>
            <button className="bouton-admin" onClick={save}>Enregistrer + harmoniser</button>{' '}
            <button className="bouton-admin secondaire" onClick={() => setOpen(false)}>Fermer</button>{' '}
            <span className="meta">{msg}</span>
          </p>
        </>
      ))}
      {loading && <span className="meta">{msg}</span>}
    </div>
  );
}
