import { notFound } from 'next/navigation';
import { getDataset, getDatasetPrivileged, previewDatastore, previewDatastorePrivileged, CKAN_PUBLIC, listLicenses } from '../../../lib/ckan';
import { detectGeo } from '../../../lib/geo';
import { getReusesForDataset } from '../../../lib/directus';
import { getSession, isAdmin } from '../../../lib/session';
import { METADATA_FIELDS, extrasToObject } from '../../../lib/metadata';
import { formatTaille, tailleDataset } from '../../../lib/format';
import { suggestionsFromMapping } from '../../../lib/dolfin';
import EditDataset from '../../../components/EditDataset';
import CopyToGrist from '../../../components/CopyToGrist';
import UpdateResource from '../../../components/UpdateResource';
import DataTable from '../../../components/DataTable';
import ChargementIndicator from '../../../components/ChargementIndicator';
import DataDictionary from '../../../components/DataDictionary';
import DolfinHarmonizer from '../../../components/DolfinHarmonizer';
import RegenerateHarmonisation from '../../../components/RegenerateHarmonisation';
import QualityPanel from '../../../components/QualityPanel';
import ValidateButton from '../../../components/ValidateButton';
import TerritoryLink from '../../../components/TerritoryLink';
import DatasetUsages from '../../../components/DatasetUsages';
import DeleteDataset from '../../../components/DeleteDataset';
import GeoReprocess from '../../../components/GeoReprocess';

export const dynamic = 'force-dynamic';


// Services OGC pour ce dataset ? (pygeoapi, cache 5 min). Renvoie aussi
// l'emprise (bbox 4326 "minlon,minlat,maxlon,maxlat") pour cadrer l'aperçu WMS.
async function collectionGeo(name) {
  const geo = process.env.NEXT_PUBLIC_GEO_URL;
  if (!geo) return { ok: false, bbox: '', hasGeometry: false };
  try {
    const r = await fetch(`${geo}/collections/${name}?f=json`, { next: { revalidate: 300 } });
    if (!r.ok) return { ok: false, bbox: '', hasGeometry: false };
    const c = await r.json();
    const b = c?.extent?.spatial?.bbox?.[0];
    const bbox = Array.isArray(b) && b.length >= 4 ? [b[0], b[1], b[2], b[3]].join(',') : '';
    // Une collection pygeoapi peut exister SANS géométrie (table indexée par code, ex.
    // portrait par commune). Dans ce cas la carte s'afficherait vide. On vérifie donc
    // qu'au moins une entité porte une géométrie non nulle (un seul item suffit, cache 5 min).
    let hasGeometry = false;
    try {
      const ir = await fetch(`${geo}/collections/${name}/items?f=json&limit=1`, { next: { revalidate: 300 } });
      if (ir.ok) {
        const j = await ir.json();
        hasGeometry = (j?.features || []).some((f) => f && f.geometry);
      }
    } catch { /* sans preuve de géométrie, on ne propose pas la carte */ }
    return { ok: true, bbox, hasGeometry };
  } catch {
    return { ok: false, bbox: '', hasGeometry: false };
  }
}

export default async function FicheDataset({ params }) {
  const { name } = await params;
  const session = await getSession();
  const admin = isAdmin(session);
  // jeu public : lecture normale ; jeu privé (brouillon déposé) : lecture privilégiée
  // réservée au déposant ou à un admin (sinon on ne divulgue pas son existence).
  let d = null;
  try { d = await getDataset(name); } catch { d = null; }
  if (!d && session) d = await getDatasetPrivileged(name);
  if (!d) notFound();
  const extras = extrasToObject(d.extras);
  // Modèle DOLFIN d'harmonisation appliqué (extra dolfin_mapping) : type + schéma
  // (correspondance concept pivot -> colonne source), affiché publiquement sur la fiche.
  let dolfin = null;
  try {
    if (extras.dolfin_mapping) {
      const m = JSON.parse(extras.dolfin_mapping);
      const rows = Object.entries(m.fields || {}).filter(([, col]) => col);
      const geo = m.location && m.location.lon && m.location.lat ? m.location : null;
      // carte inverse colonne -> concept, pour annoter le dictionnaire des données
      const byCol = {};
      for (const [concept, col] of rows) byCol[col] = concept;
      if (geo) { byCol[geo.lon] = 'location'; byCol[geo.lat] = 'location'; }
      dolfin = { type: m.type || null, context: m.context || null, idField: m.id_field || null, rows, geo, byCol };
    }
  } catch { dolfin = null; }
  const dolfinType = dolfin?.type || null;
  // Dérive du modèle DOLFIN : périmé si le modèle a été mis à jour depuis la dernière
  // harmonisation (latest_rev != rev). Les extras sont posés côté CKAN (plugin ckanext-dolfin).
  const dolfinStale = !!extras.dolfin_model_latest_rev
    && extras.dolfin_model_latest_rev !== extras.dolfin_model_rev;
  const dolfinChangedBy = extras.dolfin_model_changed_by;
  const isOwner = !!session && extras.depose_par === session.email;
  if (d.private && !admin && !isOwner) notFound();
  const resDatastore = (d.resources || []).find((r) => r.datastore_active);
  // Jeu privé (déjà réservé à l'admin/déposant ci-dessus) : aperçu via le jeton d'édition,
  // car l'aperçu public ne peut pas lire une ressource privée.
  const preview = resDatastore
    ? (d.private ? await previewDatastorePrivileged(resDatastore.id, 25) : await previewDatastore(resDatastore.id, 25))
    : null;
  const reuses = await getReusesForDataset(name);
  const gristUrl = process.env.NEXT_PUBLIC_GRIST_URL;
  const canEdit = admin || isOwner;
  const licenses = canEdit ? await listLicenses() : [];
  const geo = await collectionGeo(d.name);
  const geoOk = geo.ok;
  const geoHasGeometry = geo.hasGeometry;   // collection pygeoapi réellement géométrique
  const hasGeojson = (d.resources || []).some((r) =>
    (r.format || '').toLowerCase() === 'geojson' || /\.geojson(\?|$)/i.test(r.url || ''));
  // Détection des données géographiques du datastore (nom + échantillon de contenu) :
  // points lat/lon ou colonne « lat, lon », colonne géométrie WKT/GeoJSON (ex. « Geo Shape »).
  const geoDet = detectGeo(preview);
  // Une ressource a-t-elle une couche OGC (mapfile MapServer) ? Le job géo pose wms_url/wfs_url
  // dès qu'une colonne géométrie (Geo Shape/WKT/…) a été géométrisée : la carte de fiche sert
  // alors la couche WMS en TUILES (rendu serveur du seul visible), même pour des millions de tracés.
  const hasOgcLayer = (d.resources || []).some((r) => r.wms_url || r.wfs_url);
  // Carte affichable : points lat/lon, couche OGC (WMS/WFS du mapfile), service pygeoapi, ou GeoJSON.
  const carteAffichable = !!geoDet.pair || hasOgcLayer || (geoOk && geoHasGeometry) || hasGeojson;
  const geoUrl = process.env.NEXT_PUBLIC_GEO_URL;

  // validité / péremption du jeu de données (extras validite_debut / validite_fin)
  const vDebut = extras.validite_debut, vFin = extras.validite_fin;
  const fmtJMA = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s;
  let validite = null;
  if (vDebut || vFin) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const perime = vFin && vFin < aujourdhui;
    const pasEncore = vDebut && vDebut > aujourdhui;
    const etat = perime ? 'perime' : pasEncore ? 'attente' : 'valide';
    const libelle = perime ? `Données périmées depuis le ${fmtJMA(vFin)}`
      : pasEncore ? `Valides à partir du ${fmtJMA(vDebut)}`
      : vFin ? `Valides jusqu'au ${fmtJMA(vFin)}`
      : `Valides depuis le ${fmtJMA(vDebut)}`;
    const detail = (vDebut && vFin) ? ` · période de validité : ${fmtJMA(vDebut)} au ${fmtJMA(vFin)}` : '';
    validite = <p className={`validite ${etat}`}>{perime ? '⚠ ' : ''}{libelle}{detail}</p>;
  }

  // Bandeau « harmonisé » : formats normalisés (DOLFIN / Smart Data Models) disponibles.
  const harmonises = [...new Set((d.resources || [])
    .filter((r) => r.harmonized_from).map((r) => (r.format || '').toUpperCase()).filter(Boolean))];

  return (
    <div>
      <p className="meta"><a href="/catalogue">← Catalogue</a></p>
      <h1>{d.title || d.name}</h1>
      {validite}
      {dolfinType && (
        <p className="validite valide">
          🧩 Jeu harmonisé (DOLFIN / Smart Data Models{dolfinType ? <> · <code>{dolfinType}</code></> : ''})
          {harmonises.length ? ` · ressources normalisées : ${harmonises.join(', ')}` : ''}.
          {' '}<a href={`/dolfin/modele/${encodeURIComponent(dolfinType)}`}>Voir le modèle</a>
        </p>
      )}
      {canEdit && dolfinStale && (
        <p className="validite perime">
          ⚠ Le modèle DOLFIN{dolfinType ? <> <code>{dolfinType}</code></> : ''} a été mis à jour
          {dolfinChangedBy ? ` par ${dolfinChangedBy}` : ''}. Les fichiers harmonisés peuvent être régénérés.
          {' '}<RegenerateHarmonisation name={d.name} />
        </p>
      )}
      {d.notes && <p>{d.notes}</p>}
      {canEdit && (
        <EditDataset
          name={d.name}
          title={d.title}
          notes={d.notes}
          tags={(d.tags || []).map((t) => t.name)}
          extras={extras}
          fields={METADATA_FIELDS}
          admin={admin}
          isPrivate={!!d.private}
          licenses={licenses}
          licenseId={d.license_id || 'notspecified'}
        />
      )}
      {canEdit && (
        <p style={{ marginTop: '.5rem' }}>
          <QualityPanel name={d.name} />{' '}
          <TerritoryLink name={d.name} adminUrl={process.env.NEXT_PUBLIC_ADMIN_URL} />
          {admin && d.private && <> <ValidateButton name={d.name} /></>}
        </p>
      )}
      {canEdit && resDatastore && (
        <p style={{ marginTop: '.5rem' }}><DolfinHarmonizer name={d.name} admin={admin} harmonized={!!dolfinType} /></p>
      )}

      <div className="carte">
        <dl className="fiche">
          <dt>Organisation</dt><dd>{d.organization?.title || '-'}</dd>
          <dt>Licence</dt><dd>{d.license_title || '-'}</dd>
          <dt>Dernière modification</dt><dd>{(d.metadata_modified || '').slice(0, 10)}</dd>
          <dt>Visibilité</dt><dd>{d.private ? 'Privé (brouillon)' : 'Public'}</dd>
          {extras.valide === 'oui' && (
            <><dt>Validation</dt><dd>
              <span className="badge">✔ validé</span>
              {extras.valide_par && <span className="meta"> par {extras.valide_par}</span>}
              {extras.valide_le && <span className="meta"> le {extras.valide_le}</span>}
            </dd></>
          )}
          {dolfinType && (
            <><dt>Modèle DOLFIN</dt><dd>
              <code>{dolfinType}</code>{' '}
              <span className="badge">harmonisé</span>
              {(d.resources || []).filter((r) => r.harmonized_from).length > 0 && (
                <span className="meta"> · {(d.resources || []).filter((r) => r.harmonized_from).length} sortie(s) (NGSI-LD / CSV / GeoJSON) ci-dessous</span>
              )}
            </dd></>
          )}
          {tailleDataset(d.resources) && (
            <><dt>Taille des données</dt><dd>{formatTaille(tailleDataset(d.resources))}</dd></>
          )}
          {METADATA_FIELDS.filter((f) => extras[f.key] && !f.key.startsWith('validite_')).map((f) => (
            <div key={f.key} style={{ display: 'contents' }}>
              <dt>{f.label}</dt><dd>{extras[f.key]}</dd>
            </div>
          ))}
          {extras.depose_par && (
            <><dt>Déposé par</dt><dd>{extras.depose_par}</dd></>
          )}
          {d.tags?.length > 0 && (
            <><dt>Mots-clés</dt><dd>{d.tags.map((t) => <span className="badge" key={t.name}>{t.display_name}</span>)}</dd></>
          )}
        </dl>
      </div>

      {dolfin && (dolfin.rows.length > 0 || dolfin.geo) && (
        <div className="carte dolfin-schema">
          <h2>Schéma DOLFIN</h2>
          <p className="meta">
            Ce jeu est harmonisé vers le modèle pivot <code>{dolfin.type}</code> des Smart Data Models :
            correspondance des concepts vers les colonnes du jeu.
            {' '}<a href={`/dolfin/modele/${encodeURIComponent(dolfin.type)}`}>Voir le modèle →</a>
          </p>
          <div className="defilable">
            <table className="donnees">
              <thead><tr><th>Concept DOLFIN</th><th>Colonne source</th></tr></thead>
              <tbody>
                {dolfin.rows.map(([concept, col]) => (
                  <tr key={concept}><td><code>{concept}</code></td><td><a href={`#col-${col}`}>{col}</a></td></tr>
                ))}
                {dolfin.geo && (
                  <tr><td><code>location</code></td><td>
                    <a href={`#col-${dolfin.geo.lon}`}>{dolfin.geo.lon}</a>, <a href={`#col-${dolfin.geo.lat}`}>{dolfin.geo.lat}</a>
                    {' '}<span className="meta">(longitude, latitude)</span>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {dolfin.idField && <p className="meta">Identifiant : <code>{dolfin.idField}</code></p>}
          {dolfin.context && (
            <p className="meta">Contexte : <a href={dolfin.context} rel="nofollow noopener" target="_blank">{dolfin.context}</a></p>
          )}
        </div>
      )}

      <h2>Ressources</h2>
      {(d.resources || []).map((r) => (
        <div className="carte" key={r.id}>
          <h3>{r.name || r.url?.split('/').pop()}</h3>
          <p className="meta">
            <span className="badge">{r.format || '?'}</span>
            {formatTaille(r.size) ? ` ${formatTaille(r.size)} · ` : ' '}
            <a href={r.url}>Télécharger</a>
            {r.datastore_active && (
              <> · <a href={`${CKAN_PUBLIC}/api/3/action/datastore_search?resource_id=${r.id}&limit=100`}>API datastore</a></>
            )}
          </p>
          {r.url_type === 'upload' && (!r.datastore_active || ['detecting', 'geometrizing', 'error'].includes(r.dtz_geo_status)) && (
            <ChargementIndicator resourceId={r.id} initialActive={r.datastore_active} />
          )}
          {r.datastore_active && gristUrl && session && (
            <p><CopyToGrist resourceId={r.id} docname={d.name} gristUrl={gristUrl} /></p>
          )}
          {canEdit && (
            <p><UpdateResource dataset={d.name} resourceId={r.id} /></p>
          )}
        </div>
      ))}
      {canEdit && (
        <p><UpdateResource dataset={d.name} label="➕ Ajouter un fichier de données" /></p>
      )}
      {gristUrl && !session && (
        <p className="meta">
          <a href="/api/auth/login">Connectez-vous</a> pour copier ces données dans l'espace de travail (Grist).
        </p>
      )}

      {carteAffichable && (
        <div>
          <h3>Carte</h3>
          <div className="dtz-carte" data-fiche={d.name} role="img"
               aria-label="Carte du jeu de données, sources sélectionnables" />
          <p className="meta">Sources sélectionnables (boutons en haut à gauche) : carte GeoJSON, points des données, services WMS et WFS.</p>
        </div>
      )}

      {/* Géométrie détectée en colonne (WKT/GeoJSON) mais pas encore servie en carte :
          on le signale plutôt que d'afficher une carte vide. Le rendu à l'échelle passe
          par la publication en service OGC (WMS/WFS MapServer). */}
      {!carteAffichable && (geoDet.geomCol || geoDet.pointCol) && (
        <div>
          <p className="meta" style={{ color: '#0f766e' }}>
            🗺️ Ce jeu contient des données géographiques
            {geoDet.geomCol ? <> : colonne «&nbsp;{geoDet.geomCol}&nbsp;» (géométries WKT/GeoJSON)</> : null}
            {geoDet.pointCol ? <>{geoDet.geomCol ? ' et ' : ' : '}colonne «&nbsp;{geoDet.pointCol}&nbsp;» (points «&nbsp;lat, lon&nbsp;»)</> : null}.
            {' '}La carte est servie côté serveur (rendu de l'emprise visible) après préparation des géométries.
          </p>
          {canEdit && <p><GeoReprocess name={d.name} /></p>}
        </div>
      )}

      {carteAffichable && canEdit && (
        <p className="meta"><GeoReprocess name={d.name} /></p>
      )}

      {resDatastore && preview?.records?.length ? (
        <DataTable name={d.name} resourceId={resDatastore.id} canEdit={canEdit}
          initial={{
            fields: preview.fields.filter((f) => f.id !== '_id')
              .map((f) => ({ id: f.id, type: f.type, label: f.info?.label || f.id, notes: f.info?.notes || '' })),
            records: preview.records.map((r) => { const o = { ...r }; delete o._full_text; return o; }),
            total: preview.total || 0,
          }} />
      ) : null}

      {canEdit && resDatastore && (
        <div className="carte" style={{ margin: '.6rem 0' }}>
          <h3 style={{ marginTop: 0 }}>Mettre à jour les données</h3>
          <UpdateResource dataset={d.name} resourceId={resDatastore.id} explain />
        </div>
      )}

      {resDatastore && preview?.fields && (
        <DataDictionary name={d.name} resourceId={resDatastore.id} fields={preview.fields} canEdit={canEdit}
          dolfinByCol={dolfin?.byCol} dolfinType={dolfinType}
          dolfinSuggest={dolfin ? suggestionsFromMapping(dolfin.rows, dolfin.geo) : null} />
      )}

      {reuses.length > 0 && (
        <div>
          <h2>Réutilisations</h2>
          {reuses.map((r) => (
            <div className="carte" key={r.id}>
              <h3>{r.url ? <a href={r.url}>{r.title}</a> : r.title}</h3>
              {r.description && <p>{r.description}</p>}
            </div>
          ))}
        </div>
      )}

      <h2>Utilisée dans les portails</h2>
      <p className="meta">Instances Dataizen où ce jeu alimente une carte, un graphique ou un
        tableau de bord publié.</p>
      <DatasetUsages name={d.name} />

      <h2>API</h2>
      <p className="meta">
        Fiche : <a href={`${CKAN_PUBLIC}/api/3/action/package_show?id=${d.name}`}>{`package_show?id=${d.name}`}</a>
        {' · '}
        <a href="/api-explorer">Explorateur d'API interactif</a>
      </p>
      {geoOk && (
        <div className="carte">
          <h3>🌍 API géographiques</h3>
          <p className="meta">
            <a href={`${geoUrl}/collections/${d.name}`}>OGC API Features</a>
            {' · '}
            <a href={`${geoUrl}/collections/${d.name}/items?f=json&limit=1000`}>GeoJSON</a>
            {' · '}
            <a href={`${CKAN_PUBLIC}/wms/${d.organization?.name}?SERVICE=WMS&REQUEST=GetCapabilities`}>WMS (organisation)</a>
            {' · '}
            <a href={`${CKAN_PUBLIC}/wfs?map=/mapserver/mapfiles/${d.name}.map&SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities`}>WFS</a>
          </p>
          <p className="meta">Utilisables dans QGIS, MapLibre/Leaflet et tout client OGC.</p>
        </div>
      )}

      <p className="meta">
        Administration (connexion requise) :{' '}
        <a href={`${CKAN_PUBLIC}/dataset/edit/${d.name}`}>modifier les métadonnées</a>
        {' · '}
        <a href={`${CKAN_PUBLIC}/dataset/${d.name}/resources`}>gérer les données</a>
      </p>

      {admin && (
        <div style={{ marginTop: '2rem' }}>
          <DeleteDataset name={d.name} title={d.title || d.name} />
        </div>
      )}
    </div>
  );
}
