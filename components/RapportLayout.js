'use client';
// Modèle de page « rapport » (reprise de la disposition OFER BFC) : fil d'Ariane,
// grand titre centré, pagination Précédent / 1 2 3 / Suivant entre les sections,
// et mise en page 2 colonnes (texte à gauche ; information clé + visualisation
// Flourish à droite). Réutilisable pour toute page structurée en sections.
import { useState } from 'react';

// texte/info d'une section : chaînes déjà en HTML (paragraphes, listes, gras issus
// de la source) rendues telles quelles ; repli sur <p> pour les chaînes en texte brut
// (compatibilité avec l'ancien format de contenu).
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const asHtml = (arr) => (arr || []).map((s) => (/^\s*</.test(s) ? s : `<p>${esc(s)}</p>`)).join('');

function Viz({ id }) {
  if (!id) return null;
  return (
    <div className="rap-viz">
      <iframe
        src={`https://flo.uri.sh/visualisation/${id}/embed?auto=1`}
        title="Visualisation" loading="lazy" referrerPolicy="no-referrer" allow="fullscreen"
        style={{ display: 'block', width: '100%', height: 560, border: 0 }}
      />
    </div>
  );
}

export default function RapportLayout({ title, intro = [], sections = [], parent }) {
  const [i, setI] = useState(0);
  const n = sections.length;
  const sec = sections[i] || {};
  return (
    <div className="rapport">
      <nav className="rap-fil" aria-label="Fil d'Ariane">
        <a href="/">Accueil</a><span aria-hidden="true"> / </span>
        {parent && (<><a href={`/pages/${parent.slug}`}>{parent.title}</a><span aria-hidden="true"> / </span></>)}
        <strong>{title}</strong>
      </nav>
      <h1 className="rap-titre">{title}</h1>

      {intro.length > 0 && (
        <div className="rap-intro">{intro.map((p, k) => <p key={k}>{p}</p>)}</div>
      )}

      {n > 1 && (
        <div className="rap-pager" role="tablist" aria-label="Sections du rapport">
          <button type="button" className="rap-nav" disabled={i === 0}
                  onClick={() => setI((v) => Math.max(0, v - 1))}>‹ Précédent</button>
          {sections.map((_, k) => (
            <button type="button" key={k} role="tab" aria-selected={k === i}
                    className={k === i ? 'rap-num actif' : 'rap-num'} onClick={() => setI(k)}>{k + 1}</button>
          ))}
          <button type="button" className="rap-nav" disabled={i === n - 1}
                  onClick={() => setI((v) => Math.min(n - 1, v + 1))}>Suivant ›</button>
        </div>
      )}

      <section className="rap-section">
        <div className="rap-gauche">
          {sec.titre && <h2>{sec.titre}</h2>}
          <div className="rap-texte" dangerouslySetInnerHTML={{ __html: asHtml(sec.texte) }} />
        </div>
        <div className="rap-droite">
          <div className="rap-info" dangerouslySetInnerHTML={{ __html: asHtml(sec.info) }} />
          <Viz id={sec.flourish} />
        </div>
      </section>
    </div>
  );
}
