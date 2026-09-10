import { Fragment } from 'react';
import { getHomeBlocks, getActualites, getThematiques, getIndicateurs, miniMarkdown } from '../lib/directus';
import { getDataset, searchDatasets, catalogueOrgs } from '../lib/ckan';
import { THEMES } from '../lib/metadata';
import { assetUrl } from '../lib/themes';
import CatalogueView from '../components/CatalogueView';
import { getSettings } from '../lib/directus';

export const dynamic = 'force-dynamic';

// marqueurs d'édition visuelle Directus pour les blocs d'accueil (collection home_blocks)
const edh = (block) => ({ 'data-edit-collection': 'home_blocks', 'data-edit-item': block.id });

// Accueil piloté par Directus : chaque bloc de la collection home_blocks est
// rendu dans l'ordre. Sans bloc défini, l'accueil reste le catalogue (v0).

function Hero({ block }) {
  // Encart optionnel (carte/lien flottant, ex. « Atlas implantation ») :
  // config.encart = { texte, lien, image }. Réutilisable sur toute instance.
  const e = block.config?.encart;
  const externe = e?.lien && /^https?:\/\//.test(e.lien);
  return (
    <section className="hero" {...edh(block)}>
      <div className="hero-corps">
        <h1>{block.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: miniMarkdown(block.content || '') }} />
      </div>
      {e?.lien && (
        <a className="hero-encart" href={e.lien}
           {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {e.texte && <span>{e.texte}</span>}
          {e.image && <img src={e.image} alt="" loading="lazy" />}
        </a>
      )}
    </section>
  );
}

function Texte({ block }) {
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <div dangerouslySetInnerHTML={{ __html: miniMarkdown(block.content || '') }} />
    </section>
  );
}

async function ChiffresCles({ block }) {
  // chiffres du config JSON, ou à défaut la collection Indicateurs de Directus
  let chiffres = block.config?.chiffres || [];
  if (!chiffres.length) {
    chiffres = (await getIndicateurs()).map((i) => ({
      valeur: i.valeur, libelle: [i.libelle, i.unite && `(${i.unite})`].filter(Boolean).join(' '),
      source: i.source,
    }));
  }
  if (!chiffres.length) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <div className="chiffres">
        {chiffres.map((c, i) => (
          <div className="chiffre" key={i} title={c.source || undefined}>
            <strong>{c.valeur}</strong>
            <span>{c.libelle}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

async function Recherche({ block }) {
  let count = null;
  try {
    const orgs = catalogueOrgs(await getSettings());
    count = (await searchDatasets({ rows: 0, orgs })).count;
  } catch { /* CKAN indisponible */ }
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <form className="recherche" action="/catalogue" method="get">
        <input type="search" name="q" placeholder="Rechercher un jeu de données…" />
        <button type="submit">Rechercher</button>
      </form>
      <p className="meta">
        <a href="/catalogue">Catalogue complet{count != null ? ` (${count} jeux de données)` : ''} →</a>
      </p>
    </section>
  );
}

async function Themes({ block }) {
  // la collection Thématiques (cartes riches vers les pages du site) prime ;
  // sinon, la liste des thèmes du catalogue en badges
  const thematiques = await getThematiques();
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      {thematiques.length > 0 ? (
        <div className="vitrines">
          {thematiques.map((t) => (
            <a className="carte vitrine thematique" key={t.slug} href={`/pages/${t.slug}`}
               style={t.couleur ? { borderTop: `4px solid ${t.couleur}` } : undefined}>
              <h3>{t.icone && <span aria-hidden="true">{t.icone} </span>}{t.title}</h3>
              {t.description && <p>{t.description}</p>}
            </a>
          ))}
        </div>
      ) : (
        <div className="themes">
          {(block.config?.themes || THEMES).map((t) => (
            <a className="badge theme" key={t} href={`/catalogue?theme=${encodeURIComponent(t)}`}>{t}</a>
          ))}
        </div>
      )}
    </section>
  );
}

async function DatasetsUne({ block }) {
  const slugs = block.config?.datasets || [];
  const datasets = (await Promise.all(slugs.map((s) => getDataset(s).catch(() => null)))).filter(Boolean);
  if (!datasets.length) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <div className="vitrines">
        {datasets.map((d) => (
          <a className="carte vitrine" key={d.name} href={`/dataset/${d.name}`}>
            <h3>{d.title || d.name}</h3>
            {d.notes && <p>{d.notes.length > 120 ? d.notes.slice(0, 120) + '…' : d.notes}</p>}
          </a>
        ))}
      </div>
    </section>
  );
}

async function Actualites({ block }) {
  const actus = await getActualites(block.config?.limit || 4);
  if (!actus.length) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <div className="vitrines">
        {actus.map((a) => (
          <a className="carte vitrine actu" href={`/actualites/${a.id}`} key={a.id}>
            {a.image && <img className="actu-img" src={`${assetUrl(a.image)}?width=640&format=webp`} alt="" loading="lazy" />}
            <p className="meta">{(a.date_publication || '').slice(0, 10)}</p>
            <h3>{a.title}</h3>
            {a.chapo && <p>{a.chapo}</p>}
          </a>
        ))}
      </div>
      <p className="meta"><a href="/actualites">Toutes les actualités →</a></p>
    </section>
  );
}

function EvidenceEmbed({ block }) {
  const obs = process.env.NEXT_PUBLIC_OBS_URL;
  if (!obs) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <iframe className="evidence" src={`${obs}/${block.config?.slug || ''}`} loading="lazy" />
    </section>
  );
}

function GristEmbed({ block }) {
  const grist = process.env.NEXT_PUBLIC_GRIST_URL;
  const path = block.config?.path;
  if (!grist || !path) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <iframe
        className="evidence"
        src={`${grist}/${path}${path.includes('?') ? '&' : '?'}embed=true&style=singlePage`}
        loading="lazy"
      />
    </section>
  );
}

function SupersetEmbed({ block }) {
  const bi = process.env.NEXT_PUBLIC_BI_URL;
  const slug = block.config?.slug;
  if (!bi || !slug) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <iframe className="evidence" title={block.title || 'Tableau de bord'}
        src={`${bi}/superset/dashboard/${slug}/?standalone=3`} loading="lazy" />
    </section>
  );
}

function CarteBloc({ block }) {
  const cfg = block.config?.carte;   // id d'une carte construite dans Directus
  const rid = block.config?.resource; // ou ressource datastore directe
  if (!cfg && !rid) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <div className="dtz-carte" {...(cfg ? { 'data-config': cfg } : { 'data-rid': rid })}
        role="img" aria-label={block.title || 'Carte'} />
    </section>
  );
}

function GraphiqueBloc({ block }) {
  const id = block.config?.graphique;   // id d'un graphique construit dans Directus
  if (!id) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <div className="dtz-graphique" data-config={id} role="img" aria-label={block.title || 'Graphique'} />
    </section>
  );
}

function FlourishBloc({ block }) {
  // ID de visualisation (chiffres) ou URL d'embed complète, dans le champ « Lien / ID »
  // (embed_url) ; compat ascendante avec l'ancien config.id.
  const raw = block.embed_url || block.config?.id || block.config?.flourish;
  if (!raw) return null;
  const v = String(raw).trim();
  const src = /^\d+$/.test(v) ? `https://flo.uri.sh/visualisation/${v}/embed?auto=1` : v;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <div className="embed dtz-flourish">
        <iframe src={src}
          title={block.title || 'Visualisation Flourish'} loading="lazy" referrerPolicy="no-referrer"
          allow="fullscreen" style={{ display: 'block', width: '100%', height: block.config?.hauteur || 560, border: 0 }} />
      </div>
    </section>
  );
}

function VideoBloc({ block }) {
  // Lien ou ID YouTube dans le champ « Lien / ID » (embed_url) ; compat config.youtube/url.
  const raw = block.embed_url || block.config?.youtube || block.config?.url;
  if (!raw) return null;
  const id = (String(raw).match(/(?:v=|\/embed\/|youtu\.be\/|^)\s*([A-Za-z0-9_-]{11})/) || [])[1];
  if (!id) return null;
  return (
    <section className="bloc" {...edh(block)}>
      {block.title && <h2>{block.title}</h2>}
      <div className="embed dtz-youtube">
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}`}
          title={block.title || 'Vidéo YouTube'} loading="lazy" referrerPolicy="no-referrer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen />
      </div>
    </section>
  );
}

const RENDUS = {
  hero: Hero,
  texte: Texte,
  flourish: FlourishBloc,
  video: VideoBloc,
  chiffres_cles: ChiffresCles,
  recherche: Recherche,
  themes: Themes,
  datasets_une: DatasetsUne,
  actualites: Actualites,
  evidence: EvidenceEmbed,
  grist: GristEmbed,
  superset: SupersetEmbed,
  carte: CarteBloc,
  graphique: GraphiqueBloc,
};

export default async function Accueil({ searchParams }) {
  const [blocks, settings] = await Promise.all([getHomeBlocks(), getSettings()]);
  if (!blocks.length) {
    const sp = await searchParams;
    return <CatalogueView sp={sp} orgs={catalogueOrgs(settings)} />;
  }
  const settingsId = settings?.id;
  return (
    <div>
      {blocks.map((b, i) => {
        const Rendu = RENDUS[b.type];
        return (
          <Fragment key={b.id}>
            <Inserer sort={Number(b.sort) || i} settingsId={settingsId} />
            {Rendu ? <Rendu block={b} /> : null}
          </Fragment>
        );
      })}
      <Inserer sort={(Number(blocks[blocks.length - 1]?.sort) || blocks.length) + 1} settingsId={settingsId} />
    </div>
  );
}

// point d'insertion « ＋ Ajouter un bloc ici » pour l'accueil (collection home_blocks),
// réservé à l'éditeur visuel (masqué pour les visiteurs). Dans l'éditeur, VisualEditing
// ouvre le drawer du singleton portal_settings focalisé sur son o2m « blocs » (création
// intégrée, bloc relié). Hors éditeur / sans id de réglages : BlockInserter (nouvel onglet).
function Inserer({ sort, settingsId }) {
  const parent = settingsId != null
    ? { 'data-parent-collection': 'portal_settings', 'data-parent-item': settingsId, 'data-parent-field': 'blocs' }
    : {};
  return (
    <button type="button" className="dtz-inserer dtz-edit-only"
      data-collection="home_blocks" data-sort={sort} {...parent} aria-label="Ajouter un bloc ici">
      ＋ Ajouter un bloc ici
    </button>
  );
}
