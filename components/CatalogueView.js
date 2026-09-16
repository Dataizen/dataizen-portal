import { searchDatasets, CKAN_PUBLIC } from '../lib/ckan';
import { extrasToObject, THEMES } from '../lib/metadata';
import { formatTaille, tailleDataset } from '../lib/format';
import { nomDepartement } from '../lib/departements';
import { nomRegion } from '../lib/regions';
import FacetteCarteTerritoire from './FacetteCarteTerritoire';
import { t } from '../lib/i18n';

// vrai si le jeu est périmé (extra validite_fin dépassée)
function estPerime(d, aujourdhui) {
  const fin = extrasToObject(d.extras).validite_fin;
  return !!(fin && /^\d{4}-\d{2}-\d{2}$/.test(fin) && fin < aujourdhui);
}

// Vue catalogue (recherche + facettes + résultats), rendue côté serveur.
// Utilisée par /catalogue et en secours sur l'accueil si aucun bloc n'est défini.

function lienFacette(params, cle, valeur) {
  const p = new URLSearchParams(params);
  if (p.get(cle) === valeur) p.delete(cle); else p.set(cle, valeur);
  p.delete('start');
  return `/catalogue?${p.toString()}`;
}

function Facette({ titre, items, cle, params }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="facette">
      <h4>{titre}</h4>
      <ul>
        {items.map((it) => (
          <li key={it.name}>
            <a className={params[cle] === it.name ? 'actif' : ''} href={lienFacette(params, cle, it.name)}>
              {it.display_name || it.name}
            </a>{' '}
            <span className="meta">({it.count})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Facette Territoire : départements couverts (extra `territoires`, codes indexés
// comme jetons propres, donc facettables). Codes traduits en noms, triés.
// Carte-sélecteur de territoire (choisir un département ou une région) + liste
// texte repliée comme équivalent accessible et repli sans JavaScript.
function FacetteTerritoire({ items, params }) {
  const depts = (items || [])
    .map((it) => ({ code: it.name, nom: nomDepartement(it.name), count: it.count }))
    .filter((d) => d.nom)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  if (!depts.length) return null;
  const codes = depts.map((d) => d.code).join(',');
  const counts = Object.fromEntries(depts.map((d) => [d.code, d.count]));
  const filtreActif = params.territoire
    ? t('catalogue.department', { n: nomDepartement(params.territoire) })
    : params.territoire_region ? t('catalogue.region', { n: nomRegion(params.territoire_region) }) : '';
  return (
    <div className="facette">
      <h4>{t('catalogue.territory')}</h4>
      {filtreActif && (
        <p className="meta">{filtreActif} · <a href={lienFacette(params, 'territoire', params.territoire)
          .replace(/territoire_region=[^&]*/, '')}>{t('catalogue.remove')}</a></p>
      )}
      <div className="dtz-facette-territoire" role="group" aria-label={t('catalogue.chooseTerritoryMap')}
        data-codes={codes} data-counts={JSON.stringify(counts)}
        data-sel-dept={params.territoire || ''} data-sel-region={params.territoire_region || ''} />
      <details>
        <summary className="meta">{t('catalogue.departmentList')}</summary>
        <ul>
          {depts.map((d) => (
            <li key={d.code}>
              <a className={params.territoire === d.code ? 'actif' : ''} href={lienFacette(params, 'territoire', d.code)}>
                {d.nom}
              </a>{' '}
              <span className="meta">({d.count})</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// Facette Thématiques : vocabulaire fixe (l'extra `theme` est indexé en texte, non
// facettable proprement). Filtrage exact par la valeur choisie.
function FacetteTheme({ params }) {
  const lien = (v) => {
    const p = new URLSearchParams(params);
    if (params.theme === v) p.delete('theme'); else p.set('theme', v);
    p.delete('start');
    return `/catalogue?${p.toString()}`;
  };
  return (
    <div className="facette">
      <h4>{t('catalogue.themes')}</h4>
      <ul>
        {THEMES.map((t) => (
          <li key={t}><a className={params.theme === t ? 'actif' : ''} href={lien(t)}>{t}</a></li>
        ))}
      </ul>
    </div>
  );
}

function FiltreValidite({ params }) {
  const lien = (v) => {
    const p = new URLSearchParams(params);
    if (params.perime === v) p.delete('perime'); else p.set('perime', v);
    p.delete('start');
    return `/catalogue?${p.toString()}`;
  };
  return (
    <div className="facette">
      <h4>{t('catalogue.validity')}</h4>
      <ul>
        <li><a className={params.perime === 'cacher' ? 'actif' : ''} href={lien('cacher')}>{t('catalogue.hideExpired')}</a></li>
        <li><a className={params.perime === 'seuls' ? 'actif' : ''} href={lien('seuls')}>{t('catalogue.expiredOnly')}</a></li>
      </ul>
    </div>
  );
}

function FiltreHarmonisation({ params }) {
  const lien = (v) => {
    const p = new URLSearchParams(params);
    if (params.harmonise === v) p.delete('harmonise'); else p.set('harmonise', v);
    p.delete('start');
    return `/catalogue?${p.toString()}`;
  };
  return (
    <div className="facette">
      <h4>{t('catalogue.dolfinHarmonization')}</h4>
      <ul>
        <li><a className={params.harmonise === 'oui' ? 'actif' : ''} href={lien('oui')}>{t('catalogue.harmonizedWithModel')}</a></li>
        <li><a className={params.harmonise === 'non' ? 'actif' : ''} href={lien('non')}>{t('catalogue.notHarmonized')}</a></li>
      </ul>
    </div>
  );
}

function FiltreUtilisation({ params }) {
  const lien = (v) => {
    const p = new URLSearchParams(params);
    if (params.utilise === v) p.delete('utilise'); else p.set('utilise', v);
    p.delete('start');
    return `/catalogue?${p.toString()}`;
  };
  return (
    <div className="facette">
      <h4>{t('catalogue.usage')}</h4>
      <ul>
        <li><a className={params.utilise === 'oui' ? 'actif' : ''} href={lien('oui')}>{t('catalogue.usedOnPage')}</a></li>
        <li><a className={params.utilise === 'non' ? 'actif' : ''} href={lien('non')}>{t('catalogue.notUsed')}</a></li>
      </ul>
    </div>
  );
}

export default async function CatalogueView({ sp, orgs = null }) {
  const q = sp.q || '';
  const organization = sp.organization || '';
  const format = sp.format || '';
  const theme = sp.theme || '';
  const tags = sp.tags || '';
  const territoire = sp.territoire || '';
  const territoireRegion = sp.territoire_region || '';
  const perime = sp.perime || '';
  const harmonise = sp.harmonise || '';
  const utilise = sp.utilise || '';
  const start = parseInt(sp.start || '0', 10);
  const rows = 10;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const r = await searchDatasets({ q, organization, format, theme, tags, territoire, territoireRegion, perime, harmonise, utilise, orgs, start, rows });
  const params = {
    ...(q && { q }), ...(organization && { organization }),
    ...(format && { format }), ...(theme && { theme }),
    ...(tags && { tags }), ...(territoire && { territoire }),
    ...(territoireRegion && { territoire_region: territoireRegion }), ...(perime && { perime }),
    ...(harmonise && { harmonise }), ...(utilise && { utilise }),
  };

  return (
    <div>
      <form className="recherche" action="/catalogue" method="get">
        <input type="search" name="q" defaultValue={q} placeholder={t('catalogue.searchPlaceholder')} />
        {theme && <input type="hidden" name="theme" value={theme} />}
        <button type="submit">{t('catalogue.search')}</button>
      </form>
      {theme && (
        <p className="meta">
          {t('catalogue.theme')}<strong>{theme}</strong> · <a href="/catalogue">{t('catalogue.removeFilter')}</a>
        </p>
      )}
      {orgs && (
        <p className="meta">
          {t('catalogue.scope', { orgs: orgs.length ? orgs.join(', ') : t('catalogue.noOrganization') })}
          {' '}<span title={t('catalogue.instanceSettingTitle')}>{t('catalogue.instanceSetting')}</span>
        </p>
      )}

      <div className="layout">
        <aside>
          <Facette titre={t('catalogue.organizations')} items={r.search_facets?.organization?.items} cle="organization" params={params} />
          <FacetteTerritoire items={r.search_facets?.extras_territoires?.items} params={params} />
          <FacetteCarteTerritoire />
          <FacetteTheme params={params} />
          <Facette titre={t('catalogue.formats')} items={r.search_facets?.res_format?.items} cle="format" params={params} />
          <Facette titre={t('catalogue.keywords')} items={r.search_facets?.tags?.items} cle="tags" params={params} />
          <FiltreValidite params={params} />
          <FiltreHarmonisation params={params} />
          <FiltreUtilisation params={params} />
        </aside>

        <section>
          <p className="meta">{t('catalogue.results', { n: r.count })}</p>
          {r.results.map((d) => (
            <article className="carte" key={d.name}>
              <h3><a href={`/dataset/${d.name}`}>{d.title || d.name}</a>
                {estPerime(d, aujourdhui) && (
                  <span className="badge perime" title={t('catalogue.expiredTitle')}>{t('catalogue.expiredBadge')}</span>
                )}
                {(d.extras || []).some((e) => e.key === 'dolfin_mapping') && (
                  <span className="badge" title={t('catalogue.harmonizedTitle')}>{t('catalogue.harmonizedBadge')}</span>
                )}
                {(() => {
                  const u = (d.extras || []).find((e) => e.key === 'usages_instances');
                  return u && u.value ? (
                    <span className="badge" title={t('catalogue.usedTitle', { n: u.value })}>{t('catalogue.usedBadge')}</span>
                  ) : null;
                })()}
              </h3>
              {d.notes && <p>{d.notes.length > 220 ? d.notes.slice(0, 220) + '…' : d.notes}</p>}
              <p className="meta">
                {d.organization?.title || t('catalogue.noOrganizationName')}
                {' · '}
                {[...new Set((d.resources || []).map((res) => res.format).filter(Boolean))].map((f) => (
                  <span className="badge" key={f}>{f}</span>
                ))}
                {tailleDataset(d.resources) && (
                  <span title={t('catalogue.totalWeightTitle')}>{' · '}{formatTaille(tailleDataset(d.resources))}</span>
                )}
              </p>
            </article>
          ))}
          <div className="pagination">
            {start > 0 && (
              <a href={`/catalogue?${new URLSearchParams({ ...params, start: Math.max(0, start - rows) })}`}>{t('catalogue.previous')}</a>
            )}
            {start + rows < r.count && (
              <a href={`/catalogue?${new URLSearchParams({ ...params, start: start + rows })}`}>{t('catalogue.next')}</a>
            )}
          </div>
        </section>
      </div>

      <div className="carte" style={{ marginTop: '1.5rem' }}>
        <h3>{t('catalogue.interoperable')}</h3>
        <p>
          {t('catalogue.metadataExposed')}<strong>DCAT-AP</strong>{t('catalogue.harvestable')}
        </p>
        <p className="meta">
          {t('catalogue.feed')}{' '}
          <a href={`${CKAN_PUBLIC}/catalog.xml`}>RDF/XML</a>
          {' · '}
          <a href={`${CKAN_PUBLIC}/catalog.ttl`}>Turtle</a>
          {' · '}
          <a href={`${CKAN_PUBLIC}/catalog.jsonld`}>JSON-LD</a>
        </p>
        <p className="meta">
          {t('catalogue.dataApi')}<a href="/api-explorer">{t('catalogue.apiExplorer')}</a>{t('catalogue.apiDoc')}
        </p>
      </div>
    </div>
  );
}
