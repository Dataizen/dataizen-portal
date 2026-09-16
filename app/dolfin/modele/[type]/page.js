import { notFound } from 'next/navigation';
import { t } from '../../../../lib/i18n';

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
      <p className="meta"><a href="/catalogue">{t('dolfin.back_catalog')}</a></p>
      <h1>{m.titre} <span className="badge">{m.builtin ? t('dolfin.builtin') : t('dolfin.custom')}</span></h1>
      <p className="meta">
        {t('dolfin.model_intro')}{' '}
        {t('dolfin.type_label')} <code>{m.type}</code>{m.geo ? t('dolfin.geo_located') : ''}
      </p>
      {m.desc && <p>{m.desc}</p>}
      <h2>{t('dolfin.concepts_title')}</h2>
      {m.champs.length > 0 || m.geo ? (
        <ul>
          {m.champs.map((c) => <li key={c}><code>{c}</code></li>)}
          {m.geo && <li><code>location</code> <span className="meta">{t('dolfin.lon_lat')}</span></li>}
        </ul>
      ) : (
        <p className="meta">{t('dolfin.no_concept')}</p>
      )}
      <p className="meta">
        {t('dolfin.model_footer')}
      </p>
    </div>
  );
}
