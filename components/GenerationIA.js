'use client';
// Outil de génération IA (intégré dans le module Outils de Directus en iframe).
// On recherche des jeux (moteur du catalogue), on en sélectionne un ou plusieurs,
// on décrit ce qu'on veut, puis on génère : graphique / carte / tableau de bord / page.
// Pour la page, la description seule suffit (l'IA découvre les jeux via le RAG).
import { useState } from 'react';

const ACTIONS = [
  { kind: 'graphique', label: '📊 Graphique', needData: true },
  { kind: 'carte', label: '🗺️ Carte', needData: true },
  { kind: 'tableau-bord', label: '📈 Tableau de bord', needData: true },
  { kind: 'portrait', label: '🗺️ Portrait de territoire', needData: false },
  { kind: 'page', label: '📄 Page complète', needData: false },
];

export default function GenerationIA({ adminUrl }) {
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
      if (r.status === 503 || d.warming) { setMsg({ ok: false, text: d.message || 'Le GPU démarre, réessayez dans une minute.' }); return; }
      if (!r.ok) { setMsg({ ok: false, text: d.error || 'Échec de la génération.' }); return; }
      if (kind === 'portrait') {
        setMsg({
          ok: true,
          text: `Portrait de territoire (brouillon) créé : « ${d.titre} » — niveau ${d.niveau || '?'}, `
            + `carte pilote + ${(d.indicateurs || []).length} jauge(s) réactive(s) : ${(d.indicateurs || []).join(', ')}. `
            + `Ouvrez la page, cliquez un territoire sur la carte : les chiffres se filtrent.`,
          links: adminUrl ? [{ label: 'Ouvrir la page dans Directus', href: `${adminUrl}/admin/content/pages/${d.page_id}` }] : [],
        });
      } else if (kind === 'page') {
        setMsg({
          ok: true,
          text: `Page brouillon créée : « ${d.titre} » — blocs : ${(d.blocs || []).join(', ')}`
            + (d.datasets_decouverts ? ` (jeux découverts par l'IA : ${(d.datasets || []).join(', ')})` : ''),
          links: adminUrl ? [{ label: 'Ouvrir la page dans Directus', href: `${adminUrl}/admin/content/pages/${d.page_id}` }] : [],
        });
      } else {
        const n = (d.results || []).length, errs = (d.errors || []);
        setMsg({
          ok: n > 0,
          text: `${n} élément(s) créé(s) et publié(s)${errs.length ? ` — ${errs.length} jeu(x) ignoré(s) : ${errs.map((e) => e.dataset).join(', ')}` : ''}.`,
          links: adminUrl ? [{ label: 'Voir dans Directus', href: `${adminUrl}/admin/content` }] : [],
        });
      }
    } catch { setMsg({ ok: false, text: 'Erreur réseau.' }); }
    finally { setBusy(''); }
  };

  return (
    <div className="generation-ia">
      <div className="carte">
        <h3>1. Choisir des données</h3>
        <form className="recherche" onSubmit={search}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Rechercher un jeu de données…" aria-label="Rechercher un jeu" />
          <button type="submit" disabled={searching}>{searching ? '…' : 'Rechercher'}</button>
        </form>
        {nbSel > 0 && (
          <p className="meta">{nbSel} jeu(x) sélectionné(s) : {Object.values(sel).join(', ')}
            {' '}<button className="bouton-admin secondaire" onClick={() => setSel({})}>tout désélectionner</button></p>
        )}
        {items && (
          <div className="defilable" style={{ maxHeight: 280 }}>
            {items.length === 0 && <p className="meta">Aucun jeu trouvé.</p>}
            {items.map((it) => (
              <label key={it.name} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.25rem 0' }}>
                <input type="checkbox" checked={!!sel[it.name]} onChange={() => toggle(it)} />
                <span><strong>{it.title}</strong>{' '}
                  {it.geo && <span className="badge">géo</span>}
                  {it.formats?.slice(0, 3).map((f) => <span className="badge" key={f}>{f}</span>)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="carte">
        <h3>2. Décrire ce que vous voulez</h3>
        <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ width: '100%' }}
          placeholder="Ex : répartition par territoire ; ou pour une page : « présenter les équipements sportifs de la région »" />
        <p className="meta">Pour une <strong>page</strong>, la description peut suffire : l'IA trouve les jeux
          pertinents et assemble les blocs. Pour graphique / carte / tableau de bord, sélectionnez au moins un jeu.</p>
      </div>

      <div className="carte">
        <h3>3. Générer <span className="meta">(à vérifier ensuite dans Directus)</span></h3>
        <p className="meta">
          <label>Portrait — niveau du territoire :{' '}
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Auto (niveau du jeu)</option>
              <option value="epci">EPCI (agréger si le jeu est communal)</option>
              <option value="departement">Département (idem)</option>
              <option value="region">Région (idem)</option>
            </select>
          </label>{' '}
          Un jeu à la commune est agrégé au niveau choisi (une ressource dérivée est ajoutée au jeu).
        </p>
        <p>
          {ACTIONS.map((a) => (
            <button key={a.kind} className="bouton-admin" disabled={!!busy}
                    onClick={() => generate(a.kind)} style={{ marginRight: '.4rem' }}
                    title={a.needData ? 'Nécessite au moins un jeu sélectionné' : 'Description seule possible'}>
              {busy === a.kind ? '⏳ …' : a.label}
            </button>
          ))}
        </p>
        {msg && (
          <p className={msg.ok ? 'validite valide' : 'validite perime'}>
            {msg.ok ? '✔ ' : '⚠ '}{msg.text}
            {(msg.links || []).map((l) => <> {' '}<a href={l.href} target="_blank" rel="noopener noreferrer">{l.label} →</a></>)}
          </p>
        )}
        {busy && <p className="meta">Génération en cours… le GPU souverain peut mettre 1 à 2 min à démarrer s'il était en veille.</p>}
      </div>
    </div>
  );
}
