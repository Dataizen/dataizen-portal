'use client';
// Gestion des modèles DOLFIN depuis le portail (admin d'instance). Liste, création,
// édition, suppression, avec suivi des modifications (auteur, date, versions).
import { useState, useEffect } from 'react';
import { useT } from './I18nProvider';

const EMPTY = { slug: '', type: '', titre: '', desc: '', champs: '', geo: false, dolfin: '' };

function fmtDate(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleString('fr-FR'); } catch { return s; }
}

export default function DolfinModels() {
  const t = useT();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);      // null = liste ; objet = éditeur
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState('');
  const [histOpen, setHistOpen] = useState('');
  const [usage, setUsage] = useState({});
  const [useOpen, setUseOpen] = useState('');
  const [instanceOrg, setInstanceOrg] = useState('');

  async function load() {
    setLoading(true);
    const r = await fetch('/api/dolfin/models');
    const d = await r.json();
    setModels(r.ok ? (d.models || []) : []);
    setUsage(r.ok ? (d.usage || {}) : {});
    setInstanceOrg(r.ok ? (d.instanceOrg || '') : '');
    if (!r.ok) setMsg(d.error || t('dolfin.msg_load_error'));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...EMPTY }); setPreview(''); setMsg(''); }
  function openEdit(m) {
    setForm({ slug: m.builtin ? '' : m.slug, type: m.type, titre: m.builtin ? m.titre + t('dolfin.copy_suffix') : m.titre,
              desc: m.desc || '', champs: (m.champs || []).join(', '), geo: !!m.geo, dolfin: m.dolfin || '' });
    setPreview(''); setMsg('');
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  function onDolfinChange(e) {
    const src = e.target.value;
    setForm({ ...form, dolfin: src });
    const champs = [];
    src.split('\n').forEach((l) => { const m = l.match(/^\s*has\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/); if (m && champs.indexOf(m[1]) < 0) champs.push(m[1]); });
    const geo = /\b(lat|lon|latitude|longitude|location|geo)\b/i.test(src);
    setPreview(champs.length ? (t('dolfin.detected_prefix') + champs.join(', ') + (geo ? t('dolfin.geo_suffix') : '')) : '');
  }

  async function save() {
    // Avertissement inter-organisations : ce modèle est global. S'il est utilisé par des
    // jeux hors de l'organisation de l'instance, prévenir avant d'enregistrer ; ces jeux
    // seront signalés « à régénérer » à leurs responsables (bannière sur leur fiche).
    const used = usage[form.type] || [];
    const externes = used.filter((j) => j.org && instanceOrg && j.org !== instanceOrg);
    if (externes.length) {
      const orgs = [...new Set(externes.map((j) => j.org_title || j.org))].join(', ');
      const ok = window.confirm(
        t('dolfin.confirm_external', { used: used.length, ext: externes.length, orgs }));
      if (!ok) return;
    }
    setMsg(t('dolfin.msg_saving_compile'));
    const r = await fetch('/api/dolfin/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const d = await r.json();
    if (r.ok) {
      const n = (d.impacted || []).length;
      setMsg(n ? t('dolfin.msg_saved_impacted', { n }) : t('dolfin.msg_saved'));
      setForm(null); load();
    } else setMsg(d.error || t('dolfin.msg_failed'));
  }

  async function remove(slug) {
    if (!window.confirm(t('dolfin.confirm_delete'))) return;
    const r = await fetch('/api/dolfin/models/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }),
    });
    if (r.ok) load(); else setMsg(t('dolfin.msg_delete_failed'));
  }

  if (loading) return <p className="meta">{t('dolfin.loading')}</p>;

  if (form) {
    return (
      <div className="carte edition">
        <h3>{form.slug ? t('dolfin.form_edit_title') : t('dolfin.form_new_title')}</h3>
        <label>{t('dolfin.form_label_title')}<input value={form.titre} onChange={set('titre')} placeholder={t('dolfin.form_title_ph')} />
        <label>{t('dolfin.form_label_type')}<input value={form.type} onChange={set('type')} placeholder="PointOfInterest" /></label>
        <label>{t('dolfin.form_label_desc')}<input value={form.desc} onChange={set('desc')} /></label>
        <label>{t('dolfin.form_label_fields')}<input value={form.champs} onChange={set('champs')} placeholder="name, category, address" /></label>
        <label className="meta"><input type="checkbox" checked={form.geo} onChange={set('geo')} /> {t('dolfin.form_geo')}</label>
        <label>{t('dolfin.form_label_source')}
          <textarea rows={12} value={form.dolfin} onChange={onDolfinChange} style={{ fontFamily: 'monospace' }}
            placeholder={'package <http://exemple/uc/poi>:\n  dolfin_version "1"\n\nconcept PointOfInterest:\n  has name: one string\n  has category: optional string'} />
        </label>
        {preview && <p className="meta">{preview}</p>}
        <p>
          <button className="bouton-admin" onClick={save}>{t('dolfin.form_save')}</button>{' '}
          <button className="bouton-admin secondaire" onClick={() => setForm(null)}>{t('dolfin.cancel')}</button>{' '}
          <span className="meta">{msg}</span>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p><button className="bouton-admin" onClick={openNew}>{t('dolfin.new_model')}</button> <span className="meta">{msg}</span></p>
      <div className="defilable">
        <table className="donnees">
          <thead>
            <tr><th>{t('dolfin.th_title')}</th><th>{t('dolfin.th_type')}</th><th>{t('dolfin.th_fields')}</th><th>{t('dolfin.th_geo')}</th><th>{t('dolfin.th_origin')}</th><th>{t('dolfin.th_used_by')}</th><th>{t('dolfin.th_last_modif')}</th><th></th></tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <>
                <tr key={m.slug}>
                  <td>{m.titre}</td>
                  <td><code>{m.type}</code></td>
                  <td className="meta">{(m.champs || []).join(', ')}</td>
                  <td>{m.geo ? '✔' : ''}</td>
                  <td>{m.builtin ? <span className="badge">{t('dolfin.builtin')}</span> : <span className="badge">{t('dolfin.custom')}</span>}</td>
                  <td className="meta">
                    {(usage[m.type] || []).length
                      ? <a href="#" onClick={(e) => { e.preventDefault(); setUseOpen(useOpen === m.type ? '' : m.type); }}>{t('dolfin.n_datasets', { n: usage[m.type].length })}</a>
                      : <span className="meta">{t('dolfin.none')}</span>}
                  </td>
                  <td className="meta">
                    {m.builtin ? '—' : (
                      <>
                        {m.updated_by ? `${m.updated_by}` : ''}{m.updated_at ? ` · ${fmtDate(m.updated_at)}` : ''}
                        {(m.history || []).length ? (
                          <> · <a href="#" onClick={(e) => { e.preventDefault(); setHistOpen(histOpen === m.slug ? '' : m.slug); }}>
                            {t('dolfin.n_versions', { n: m.history.length })}</a></>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td>
                    {m.builtin
                      ? <button className="bouton-admin secondaire" onClick={() => openEdit(m)}>{t('dolfin.duplicate')}</button>
                      : <>
                          <button className="bouton-admin secondaire" onClick={() => openEdit(m)}>{t('dolfin.edit')}</button>{' '}
                          <button className="bouton-admin secondaire" onClick={() => remove(m.slug)}>{t('dolfin.delete')}</button>
                        </>}
                  </td>
                </tr>
                {histOpen === m.slug && (
                  <tr key={m.slug + '-h'}>
                    <td colSpan={8} className="meta">
                      <strong>{t('dolfin.history_label')}</strong>
                      <ul>
                        {(m.history || []).slice().reverse().map((h, i) => (
                          <li key={i}>{fmtDate(h.at)} — {h.by} ({h.action})</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
                {useOpen === m.type && (
                  <tr key={m.type + '-u'}>
                    <td colSpan={8} className="meta">
                      <strong>{t('dolfin.used_by_label', { titre: m.titre })}</strong>
                      <ul>
                        {(usage[m.type] || []).map((j) => (
                          <li key={j.name}><a href={`/dataset/${j.name}`}>{j.title || j.name}</a></li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
