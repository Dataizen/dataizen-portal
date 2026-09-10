'use client';
// « Utilisée dans » : liste les instances (portails) Dataizen où ce jeu est employé
// (carte, graphique, tableau de bord). Chargé côté client pour ne pas ralentir la fiche
// (le balayage interroge le Directus de chaque instance via dtz-rag).
import { useEffect, useState } from 'react';

const LABEL = { graphique: 'graphique', carte: 'carte', 'tableau-bord': 'tableau de bord' };
const PLURIEL = { graphique: 'graphiques', carte: 'cartes', 'tableau-bord': 'tableaux de bord' };

// Résume une liste de véhicules par type : 1 -> « carte « Titre » », plusieurs du même
// type -> « 3 graphiques », mélange -> « 3 graphiques, 1 carte ».
function resume(vias) {
  const parType = {};
  for (const v of vias) (parType[v.type] = parType[v.type] || []).push(v.titre);
  return Object.entries(parType).map(([t, titres]) =>
    (titres.length === 1 ? `${LABEL[t] || t} « ${titres[0]} »` : `${titres.length} ${PLURIEL[t] || t}`)
  ).join(', ');
}

export default function DatasetUsages({ name }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let ok = true;
    fetch(`/api/dataset/usages?name=${encodeURIComponent(name)}`)
      .then((r) => r.json()).then((d) => { if (ok) setData(d); }).catch(() => {});
    return () => { ok = false; };
  }, [name]);

  if (!data) return <p className="meta">Recherche des usages…</p>;
  const insts = data.instances || [];
  if (!insts.length) {
    return (
      <p className="meta">Ce jeu n’est pas encore utilisé dans un portail (aucune carte,
        graphique ou tableau de bord publié ne s’appuie dessus).</p>
    );
  }
  return (
    <ul style={{ margin: '.3rem 0 0', paddingLeft: '1.1rem' }}>
      {insts.map((it) => (
        <li key={it.instance} style={{ marginBottom: '.5rem' }}>
          <strong>{it.instance}</strong>
          <ul style={{ margin: '.2rem 0 0', paddingLeft: '1.1rem' }}>
            {(it.pages || []).map((p) => (
              <li key={p.slug}>
                <a href={`${it.portal}/pages/${p.slug}`} target="_blank" rel="noopener">{p.title}</a>
                {' '}<span className="meta">({resume(p.via)})</span>
              </li>
            ))}
            {(it.orphelins || []).length > 0 && (
              <li className="meta">
                Aussi créé mais pas encore posé sur une page publiée&nbsp;:
                {' '}{resume(it.orphelins)}
              </li>
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
}
