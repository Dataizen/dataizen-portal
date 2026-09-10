import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Vue PUBLIQUE en lecture seule d'un modèle DOLFIN (documentation du schéma pivot).
// Cible du lien « Voir le modèle » depuis la fiche d'un jeu. Les modèles sont des
// définitions canoniques partagées (non sensibles) ; la lecture passe par le token
// de service CKAN côté serveur (jamais exposé au navigateur). N'affiche que les
// champs publics (type, titre, description, concepts), pas d'auteur ni d'historique.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function getModel(type) {
  try {
    const r = await fetch(`${CKAN}/api/3/action/dolfin_model_list`, {
      method: 'POST',
      headers: { Authorization: process.env.CKAN_EDIT_TOKEN, 'Content-Type': 'application/json' },
      body: '{}', cache: 'no-store',
    });
    if (!r.ok) return null;
    const models = (await r.json())?.result?.models || [];
    const m = models.find((x) => x.type === type || x.slug === type);
    if (!m) return null;
    return {
      type: m.type, titre: m.titre || m.type, desc: m.desc || '',
      champs: Array.isArray(m.champs) ? m.champs : [], geo: !!m.geo, builtin: !!m.builtin,
    };
  } catch {
    return null;
  }
}

export default async function ModeleDolfin({ params }) {
  const { type } = await params;
  const m = await getModel(decodeURIComponent(type));
  if (!m) notFound();
  return (
    <div>
      <p className="meta"><a href="/catalogue">← Catalogue</a></p>
      <h1>{m.titre} <span className="badge">{m.builtin ? 'intégré' : 'personnalisé'}</span></h1>
      <p className="meta">
        Modèle pivot des Smart Data Models, cible de l'harmonisation sémantique DOLFIN.
        Type : <code>{m.type}</code>{m.geo ? ' · géolocalisé (location)' : ''}
      </p>
      {m.desc && <p>{m.desc}</p>}
      <h2>Concepts du modèle</h2>
      {m.champs.length > 0 || m.geo ? (
        <ul>
          {m.champs.map((c) => <li key={c}><code>{c}</code></li>)}
          {m.geo && <li><code>location</code> <span className="meta">(longitude, latitude)</span></li>}
        </ul>
      ) : (
        <p className="meta">Aucun concept déclaré.</p>
      )}
      <p className="meta">
        Un jeu est harmonisé vers ce modèle en associant chacun de ses concepts à une colonne du jeu
        (voir le panneau « Schéma DOLFIN » sur la fiche du jeu).
      </p>
    </div>
  );
}
