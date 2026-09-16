'use client';
// « Utilisée dans » : liste les instances (portails) Dataizen où ce jeu est employé
// (carte, graphique, tableau de bord). Chargé côté client pour ne pas ralentir la fiche
// (le balayage interroge le Directus de chaque instance via dtz-rag).
import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

const LABEL_KEYS = { graphique: 'usages.typeGraphique', carte: 'usages.typeCarte', 'tableau-bord': 'usages.typeTableauBord' };
const PLURIEL_KEYS = { graphique: 'usages.typeGraphiquePlural', carte: 'usages.typeCartePlural', 'tableau-bord': 'usages.typeTableauBordPlural' };

// Résume une liste de véhicules par type : 1 -> « carte « Titre » », plusieurs du même
// type -> « 3 graphiques », mélange -> « 3 graphiques, 1 carte ».
function resume(vias, t) {
  const parType = {};
  for (const v of vias) (parType[v.type] = parType[v.type] || []).push(v.titre);
  return Object.entries(parType).map(([typ, titres]) =>
    (titres.length === 1
      ? `${LABEL_KEYS[typ] ? t(LABEL_KEYS[typ]) : typ} « ${titres[0]} »`
      : `${titres.length} ${PLURIEL_KEYS[typ] ? t(PLURIEL_KEYS[typ]) : typ}`)
  ).join(', ');
}

export default function DatasetUsages({ name }) {
  const t = useT();
  const [data, setData] = useState(null);
  useEffect(() => {
    let ok = true;
    fetch(`/api/dataset/usages?name=${encodeURIComponent(name)}`)
      .then((r) => r.json()).then((d) => { if (ok) setData(d); }).catch(() => {});
    return () => { ok = false; };
  }, [name]);

  if (!data) return <p className="meta">{t('usages.searching')}</p>;
  const insts = data.instances || [];
  if (!insts.length) {
    return (
      <p className="meta">{t('usages.notUsed')}</p>
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
                {' '}<span className="meta">({resume(p.via, t)})</span>
              </li>
            ))}
            {(it.orphelins || []).length > 0 && (
              <li className="meta">
                {t('usages.orphans')}
                {' '}{resume(it.orphelins, t)}
              </li>
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
}
