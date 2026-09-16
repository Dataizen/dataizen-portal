'use client';
// Harmonisation DOLFIN dans le portail : associe les champs d'un modèle canonique
// (Smart Data Models) aux colonnes du jeu, avec proposition par l'IA souveraine.
// Réservé aux personnes pouvant éditer le jeu (admin d'instance ou déposant).
// À l'enregistrement, CKAN régénère une ressource NGSI-LD (interopérabilité MIM2).
import { useState } from 'react';
import { useT } from './I18nProvider';

export default function DolfinHarmonizer({ name, admin, harmonized }) {
  const t = useT();
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
    if (!gpu.available) return <span className="meta" title={t('dolfin.gpu_unavailable_title')}>{t('dolfin.gpu_unavailable')}</span>;
    if (gpu.ollama_ready) return <span className="meta" style={{ color: '#1a7f37' }}>{t('dolfin.gpu_ready')}</span>;
    if (gpu.wake_in_progress || gpu.instance_status === 'ACTIVE') return <span className="meta" style={{ color: '#bf8700' }}>{t('dolfin.gpu_starting')}</span>;
    return <span className="meta" title={t('dolfin.gpu_idle_title')}>{t('dolfin.gpu_idle')}</span>;
  }

  async function openPanel() {
    setOpen(true); setLoading(true); setMsg('');
    refreshGpu();
    try {
      const r = await fetch(`/api/dataset/dolfin/data?name=${encodeURIComponent(name)}`);
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || t('dolfin.msg_load_error')); setLoading(false); return; }
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
    } catch { setMsg(t('dolfin.msg_network_error')); }
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
    setAiBusy(true); setMsg(t('dolfin.msg_ai_analyzing_cols'));
    try {
      const r = await fetch(`/api/dataset/dolfin/propose?name=${encodeURIComponent(name)}&model=${mi}`);
      const d = await r.json();
      if (d.warming) { setMsg(d.message || t('dolfin.msg_ai_warming')); setAiBusy(false); return; }
      if (d.error) { setMsg(t('dolfin.ai_error_prefix') + d.error); setAiBusy(false); return; }
      const mp = d.mapping || {};
      setMap({ id: mp.id_field || '', fields: mp.fields || {},
               lon: mp.location?.lon || '', lat: mp.location?.lat || '' });
      const n = Object.keys(mp.fields || {}).length;
      setMsg(t('dolfin.msg_ai_applied', { n }));
    } catch { setMsg(t('dolfin.msg_ai_unavailable')); }
    setAiBusy(false);
    refreshGpu();
  }

  // Génère un brouillon de modèle canonique .dolfin par l'IA à partir de CE jeu.
  async function generateModel() {
    setGenBusy(true); setDraft(null);
    setGenMsg(t('dolfin.msg_gen_writing'));
    try {
      const r = await fetch('/api/dataset/dolfin/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.warming) { setGenMsg(d.message || t('dolfin.msg_ai_warming')); setGenBusy(false); return; }
      if (!r.ok || d.error) { setGenMsg(t('dolfin.ai_error_prefix') + (d.error || t('dolfin.unavailable'))); setGenBusy(false); return; }
      setDraft({ dolfin: d.dolfin || '', type: d.type_suggestion || '', titre: d.title || name });
      setGenMsg(t('dolfin.msg_gen_done'));
    } catch { setGenMsg(t('dolfin.msg_ai_unavailable')); }
    setGenBusy(false);
    refreshGpu();
  }

  // Enregistre le brouillon comme modèle DOLFIN : l'action CKAN compile le .dolfin,
  // le versionne, et le modèle devient sélectionnable pour harmoniser ce jeu.
  async function saveModel() {
    if (!draft) return;
    if (!draft.type.trim() || !draft.titre.trim()) { setGenMsg(t('dolfin.msg_need_type_title')); return; }
    setSaving(true); setGenMsg(t('dolfin.msg_saving_dolfin'));
    try {
      const r = await fetch('/api/dolfin/models', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: draft.type.trim(), titre: draft.titre.trim(), dolfin: draft.dolfin, desc: '' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setGenMsg(t('dolfin.msg_save_refused') + (d.error || t('dolfin.check_syntax'))); setSaving(false); return; }
      const savedType = draft.type.trim();
      setGenMsg(t('dolfin.msg_model_saved') + (d.message ? ' — ' + d.message : '') + t('dolfin.msg_model_saved_suffix'));
      setDraft(null);
      // recharger la liste des modèles et sélectionner le nouveau
      const rr = await fetch(`/api/dataset/dolfin/data?name=${encodeURIComponent(name)}`);
      const dd = await rr.json();
      if (rr.ok) {
        setModels(dd.models || []);
        const idx = (dd.models || []).findIndex((m) => m.type === savedType);
        if (idx >= 0) { setMi(idx); setMap({ id: '', fields: {}, lon: '', lat: '' }); }
      }
    } catch { setGenMsg(t('dolfin.msg_network_error')); }
    setSaving(false);
  }

  async function save() {
    setMsg(t('dolfin.msg_saving'));
    const r = await fetch('/api/dataset/dolfin/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mapping: build() }),
    });
    if (r.ok) {
      setMsg(t('dolfin.msg_harmonized'));
      setTimeout(() => window.location.reload(), 2500);
    }
    else { const d = await r.json().catch(() => ({})); setMsg(d.error || t('dolfin.msg_save_error')); }
  }

  const opt = (val, onChange, key) => (
    <select value={val} onChange={onChange} aria-label={key}>
      <option value="">{t('dolfin.opt_column')}</option>
      {cols.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );

  if (!open) {
    return <button className="bouton-admin" onClick={openPanel}>🧩 {harmonized ? t('dolfin.btn_edit_harmo') : t('dolfin.btn_harmo')}</button>;
  }

  return (
    <div className="carte edition">
      <h3>{t('dolfin.harmo_title')}</h3>
      {loading ? <p className="meta">{t('dolfin.loading')}</p> : (!cols.length ? (
        <p className="meta">{t('dolfin.no_csv')}</p>
      ) : (
        <>
          <p className="meta">{t('dolfin.intro_map')}</p>
          <p className="meta">{t('dolfin.harmo_desc_1')}
            <strong>NGSI-LD</strong>{t('dolfin.harmo_desc_2')}<strong>{t('dolfin.harmo_csv')}</strong>{t('dolfin.harmo_and')}<strong>GeoJSON</strong>{t('dolfin.harmo_desc_4')}</p>
          {admin && <p className="meta" style={{ margin: '0 0 .4rem' }}><a href="/dolfin/models">{t('dolfin.manage_models')}</a></p>}

          {admin && (
            <div style={{ margin: '0 0 .8rem' }}>
              <button className="bouton-admin secondaire" onClick={generateModel} disabled={genBusy}>
                {genBusy ? t('dolfin.gen_writing_btn') : t('dolfin.gen_model_btn')}
              </button>{' '}
              {gpuBadge()}
              {(genMsg && !draft) && <span className="meta" style={{ marginLeft: '.5rem' }}>{genMsg}</span>}
              {draft && (
                <div className="carte" style={{ marginTop: '.6rem' }}>
                  <p className="meta">{t('dolfin.draft_desc_1')}<code>.dolfin</code>{t('dolfin.draft_desc_2')}<code>.dolfin</code>{t('dolfin.draft_desc_3')}</p>
                  <label>{t('dolfin.draft_label_type')}
                    <input value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} placeholder="PointOfInterest" />
                  </label>
                  <label>{t('dolfin.draft_label_titre')}
                    <input value={draft.titre} onChange={(e) => setDraft({ ...draft, titre: e.target.value })} placeholder={t('dolfin.draft_titre_ph')} />
                  </label>
                  <textarea value={draft.dolfin} spellCheck={false} rows={18}
                    onChange={(e) => setDraft({ ...draft, dolfin: e.target.value })}
                    style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '.85rem', lineHeight: 1.45, whiteSpace: 'pre', overflow: 'auto' }} />
                  <p>
                    <button className="bouton-admin" onClick={saveModel} disabled={saving}>{t('dolfin.save_model_btn')}</button>{' '}
                    <button className="bouton-admin secondaire" onClick={() => { setDraft(null); setGenMsg(''); }}>{t('dolfin.cancel')}</button>{' '}
                    <span className="meta">{genMsg}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <label>{t('dolfin.model_select_label')}
            <select value={mi} onChange={changeModel}>
              {models.map((m, i) => <option key={m.type} value={i}>{m.titre}</option>)}
            </select>
          </label>
          {model?.desc && <p className="meta">{model.desc}</p>}

          <p>
            <button className="bouton-admin secondaire" onClick={propose} disabled={aiBusy}>
              {aiBusy ? t('dolfin.ai_thinking_btn') : t('dolfin.propose_btn')}
            </button>{' '}
            {gpuBadge()}
          </p>

          {model && (
            <div className="dolfin-mapper">
              <label>{t('dolfin.field_id')} {opt(map.id, setKey('id'), t('dolfin.field_id'))}</label>
              {(model.champs || []).map((f) => (
                <label key={f}>{f} {opt(map.fields[f] || '', setField(f), f)}</label>
              ))}
              {model.geo && (
                <>
                  <label>{t('dolfin.field_lon')} {opt(map.lon, setKey('lon'), t('dolfin.field_lon'))}</label>
                  <label>{t('dolfin.field_lat')} {opt(map.lat, setKey('lat'), t('dolfin.field_lat'))}</label>
                </>
              )}
            </div>
          )}

          <p>
            <button className="bouton-admin" onClick={save}>{t('dolfin.save_harmo_btn')}</button>{' '}
            <button className="bouton-admin secondaire" onClick={() => setOpen(false)}>{t('dolfin.close')}</button>{' '}
            <span className="meta">{msg}</span>
          </p>
        </>
      ))}
      {loading && <span className="meta">{msg}</span>}
    </div>
  );
}
