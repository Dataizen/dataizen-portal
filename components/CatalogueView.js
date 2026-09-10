import { searchDatasets, CKAN_PUBLIC } from '../lib/ckan';
import { extrasToObject, THEMES } from '../lib/metadata';
import { formatTaille, tailleDataset } from '../lib/format';
import { nomDepartement } from '../lib/departements';
import { nomRegion } from '../lib/regions';
import FacetteCarteTerritoire from './FacetteCarteTerritoire';

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
    ? `Département : ${nomDepartement(params.territoire)}`
    : params.territoire_region ? `Région : ${nomRegion(params.territoire_region)}` : '';
  return (
    <div className="facette">
      <h4>Territoire</h4>
      {filtreActif && (
        <p className="meta">{filtreActif} · <a href={lienFacette(params, 'territoire', params.territoire)
          .replace(/territoire_region=[^&]*/, '')}>retirer</a></p>
      )}
      <div className="dtz-facette-territoire" role="group" aria-label="Choisir un territoire sur la carte"
        data-codes={codes} data-counts={JSON.stringify(counts)}
        data-sel-dept={params.territoire || ''} data-sel-region={params.territoire_region || ''} />
      <details>
        <summary className="meta">Liste des départements</summary>
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
      <h4>Thématiques</h4>
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
      <h4>Validité</h4>
      <ul>
        <li><a className={params.perime === 'cacher' ? 'actif' : ''} href={lien('cacher')}>Masquer les périmés</a></li>
        <li><a className={params.perime === 'seuls' ? 'actif' : ''} href={lien('seuls')}>Périmés seulement</a></li>
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
      <h4>Harmonisation DOLFIN</h4>
      <ul>
        <li><a className={params.harmonise === 'oui' ? 'actif' : ''} href={lien('oui')}>Harmonisés (avec modèle)</a></li>
        <li><a className={params.harmonise === 'non' ? 'actif' : ''} href={lien('non')}>Non harmonisés</a></li>
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
      <h4>Utilisation</h4>
      <ul>
        <li><a className={params.utilise === 'oui' ? 'actif' : ''} href={lien('oui')}>Utilisés (sur une page)</a></li>
        <li><a className={params.utilise === 'non' ? 'actif' : ''} href={lien('non')}>Non utilisés</a></li>
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
        <input type="search" name="q" defaultValue={q} placeholder="Rechercher un jeu de données…" />
        {theme && <input type="hidden" name="theme" value={theme} />}
        <button type="submit">Rechercher</button>
      </form>
      {theme && (
        <p className="meta">
          Thème : <strong>{theme}</strong> · <a href="/catalogue">retirer le filtre</a>
        </p>
      )}
      {orgs && (
        <p className="meta">
          Périmètre du catalogue : {orgs.length ? orgs.join(', ') : 'aucune organisation'}
          {' '}<span title="Réglable dans Directus, Réglages du portail">(réglage de l'instance)</span>
        </p>
      )}

      <div className="layout">
        <aside>
          <Facette titre="Organisations" items={r.search_facets?.organization?.items} cle="organization" params={params} />
          <FacetteTerritoire items={r.search_facets?.extras_territoires?.items} params={params} />
          <FacetteCarteTerritoire />
          <FacetteTheme params={params} />
          <Facette titre="Formats" items={r.search_facets?.res_format?.items} cle="format" params={params} />
          <Facette titre="Mots-clés" items={r.search_facets?.tags?.items} cle="tags" params={params} />
          <FiltreValidite params={params} />
          <FiltreHarmonisation params={params} />
          <FiltreUtilisation params={params} />
        </aside>

        <section>
          <p className="meta">{r.count} jeu(x) de données</p>
          {r.results.map((d) => (
            <article className="carte" key={d.name}>
              <h3><a href={`/dataset/${d.name}`}>{d.title || d.name}</a>
                {estPerime(d, aujourdhui) && (
                  <span className="badge perime" title="Données périmées (fin de validité dépassée)"> Périmé</span>
                )}
                {(d.extras || []).some((e) => e.key === 'dolfin_mapping') && (
                  <span className="badge" title="Jeu harmonisé (modèle pivot DOLFIN)"> harmonisé</span>
                )}
                {(() => {
                  const u = (d.extras || []).find((e) => e.key === 'usages_instances');
                  return u && u.value ? (
                    <span className="badge" title={`Utilisé sur une page de : ${u.value}`}> utilisé</span>
                  ) : null;
                })()}
              </h3>
              {d.notes && <p>{d.notes.length > 220 ? d.notes.slice(0, 220) + '…' : d.notes}</p>}
              <p className="meta">
                {d.organization?.title || 'Sans organisation'}
                {' · '}
                {[...new Set((d.resources || []).map((res) => res.format).filter(Boolean))].map((f) => (
                  <span className="badge" key={f}>{f}</span>
                ))}
                {tailleDataset(d.resources) && (
                  <span title="Poids total des fichiers de données">{' · '}{formatTaille(tailleDataset(d.resources))}</span>
                )}
              </p>
            </article>
          ))}
          <div className="pagination">
            {start > 0 && (
              <a href={`/catalogue?${new URLSearchParams({ ...params, start: Math.max(0, start - rows) })}`}>← Précédent</a>
            )}
            {start + rows < r.count && (
              <a href={`/catalogue?${new URLSearchParams({ ...params, start: start + rows })}`}>Suivant →</a>
            )}
          </div>
        </section>
      </div>

      <div className="carte" style={{ marginTop: '1.5rem' }}>
        <h3>Catalogue interopérable</h3>
        <p>
          Les métadonnées sont exposées au format standard <strong>DCAT-AP</strong>, moissonnable
          par data.gouv.fr et tout agrégateur compatible (identifiants stables, JSON-LD, RDF).
        </p>
        <p className="meta">
          Flux du catalogue :{' '}
          <a href={`${CKAN_PUBLIC}/catalog.xml`}>RDF/XML</a>
          {' · '}
          <a href={`${CKAN_PUBLIC}/catalog.ttl`}>Turtle</a>
          {' · '}
          <a href={`${CKAN_PUBLIC}/catalog.jsonld`}>JSON-LD</a>
        </p>
        <p className="meta">
          API de données : <a href="/api-explorer">explorateur d'API interactif</a> (documentation
          des API générées automatiquement pour chaque jeu de données public)
        </p>
      </div>
    </div>
  );
}
