'use client';
// Outil de génération IA (intégré dans le module Outils de Directus en iframe).
// On recherche des jeux (moteur du catalogue), on en sélectionne un ou plusieurs,
// on décrit ce qu'on veut, puis on génère : graphique / carte / tableau de bord / page.
// Pour la page, la description seule suffit (l'IA découvre les jeux via le RAG).
import { useState } from 'react';
import { useT } from './I18nProvider';

const ACTIONS = [
  { kind: 'graphique', k: 'ia.action_chart', needData: true },
  { kind: 'carte', k: 'ia.action_map', needData: true },
  { kind: 'tableau-bord', k: 'ia.action_dashboard', needData: true },
  { kind: 'portrait', k: 'ia.action_portrait', needData: false },
  { kind: 'page', k: 'ia.action_page', needData: false },
];

export default function GenerationIA({ adminUrl }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [sel, setSel] = useState({});           // name -> title
  const [desc, setDesc] = useState('');
  const [level, setLevel] = useState('');        // portrait : niveau cible (agrégation)
  const [busy, setBusy] = useState('');
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState(null);          // {ok, text, links?}

  const nbSel = Object.keys(sel).length;

  const search = async (e) => {
    e?.preventDefault();
    setSearching(true); setMsg(null);
    try {
      const r = await fetch(`/api/datasets/search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setItems(d.items || []);
    } catch { setItems([]); }
    setSearching(false);
  };

  const toggle = (it) => setSel((s) => {
    const n = { ...s };
    if (n[it.name]) delete n[it.name]; else n[it.name] = it.title;
    return n;
  });

  const generate = async (kind) => {
    setBusy(kind); setMsg(null);
    try {
      const r = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, datasets: Object.keys(sel), description: desc, level }),
      });
      const d = await r.json();
      if (r.status === 503 || d.warming) { setMsg({ ok: false, text: d.message || t('ia.msg_gpu_warming') }); return; }
      if (!r.ok) { setMsg({ ok: false, text: d.error || t('ia.msg_gen_failed') }); return; }
      if (kind === 'portrait') {
        setMsg({
          ok: true,
          text: t('ia.msg_portrait', {
            titre: d.titre, niveau: d.niveau || '?',
            n: (d.indicateurs || []).length, ind: (d.indicateurs || []).join(', '),
          }),
          links: adminUrl ? [{ label: t('ia.link_open_directus'), href: `${adminUrl}/admin/content/pages/${d.page_id}` }] : [],
        });
      } else if (kind === 'page') {
        setMsg({
          ok: true,
          text: t('ia.msg_page', { titre: d.titre, blocs: (d.blocs || []).join(', ') })
            + (d.datasets_decouverts ? t('ia.msg_page_discovered', { ds: (d.datasets || []).join(', ') }) : ''),
          links: adminUrl ? [{ label: t('ia.link_open_directus'), href: `${adminUrl}/admin/content/pages/${d.page_id}` }] : [],
        });
      } else {
        const n = (d.results || []).length, errs = (d.errors || []);
        setMsg({
          ok: n > 0,
          text: t('ia.msg_elements', { n }) + (errs.length ? t('ia.msg_ignored', { m: errs.length, list: errs.map((e) => e.dataset).join(', ') }) : '') + '.',
          links: adminUrl ? [{ label: t('ia.link_see_directus'), href: `${adminUrl}/admin/content` }] : [],
        });
      }
    } catch { setMsg({ ok: false, text: t('ia.msg_network_error') }); }
    finally { setBusy(''); }
  };

  return (
    <div className="generation-ia">
      <div className="carte">
        <h3>{t('ia.step1_title')}</h3>
        <form className="recherche" onSubmit={search}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder={t('ia.search_ph')} aria-label={t('ia.search_aria')} />
          <button type="submit" disabled={searching}>{searching ? '…' : t('ia.search_btn')}</button>
        </form>
        {nbSel > 0 && (
          <p className="meta">{t('ia.n_selected', { n: nbSel })} {Object.values(sel).join(', ')}
            {' '}<button className="bouton-admin secondaire" onClick={() => setSel({})}>{t('ia.deselect_all')}</button></p>
        )}
        {items && (
          <div className="defilable" style={{ maxHeight: 280 }}>
            {items.length === 0 && <p className="meta">{t('ia.no_dataset_found')}</p>}
            {items.map((it) => (
              <label key={it.name} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.25rem 0' }}>
                <input type="checkbox" checked={!!sel[it.name]} onChange={() => toggle(it)} />
                <span><strong>{it.title}</strong>{' '}
                  {it.geo && <span className="badge">{t('ia.badge_geo')}</span>}
                  {it.formats?.slice(0, 3).map((f) => <span className="badge" key={f}>{f}</span>)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="carte">
        <h3>{t('ia.step2_title')}</h3>
        <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ width: '100%' }}
          placeholder={t('ia.desc_ph')} />
        <p className="meta">{t('ia.step2_hint_before')} <strong>{t('ia.step2_hint_page')}</strong>{t('ia.step2_hint_after')}</p>
      </div>

      <div className="carte">
        <h3>{t('ia.step3_title')} <span className="meta">{t('ia.step3_note')}</span></h3>
        <p className="meta">
          <label>{t('ia.portrait_level_label')}{' '}
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">{t('ia.level_auto')}</option>
              <option value="epci">{t('ia.level_epci')}</option>
              <option value="departement">{t('ia.level_dept')}</option>
              <option value="region">{t('ia.level_region')}</option>
            </select>
          </label>{' '}
          {t('ia.level_hint')}
        </p>
        <p>
          {ACTIONS.map((a) => (
            <button key={a.kind} className="bouton-admin" disabled={!!busy}
                    onClick={() => generate(a.kind)} style={{ marginRight: '.4rem' }}
                    title={a.needData ? t('ia.title_need_data') : t('ia.title_desc_only')}>
              {busy === a.kind ? '⏳ …' : t(a.k)}
            </button>
          ))}
        </p>
        {msg && (
          <p className={msg.ok ? 'validite valide' : 'validite perime'}>
            {msg.ok ? '✔ ' : '⚠ '}{msg.text}
            {(msg.links || []).map((l) => <> {' '}<a href={l.href} target="_blank" rel="noopener noreferrer">{l.label} →</a></>)}
          </p>
        )}
        {busy && <p className="meta">{t('ia.generating')}</p>}
      </div>
    </div>
  );
}
