// Client Directus côté serveur (lecture publique uniquement).
// Toutes les fonctions renvoient null/[] si Directus est indisponible :
// le portail doit rester utilisable sans back-office (mode dégradé).
import { catalogueOrgs, searchDatasets, getDataset } from './ckan';

const DIRECTUS = process.env.DIRECTUS_INTERNAL_URL || 'http://directus:8055';

async function items(path) {
  try {
    const res = await fetch(`${DIRECTUS}${path}`, { next: { revalidate: 15 } });
    if (!res.ok) return null;
    return (await res.json()).data;
  } catch {
    return null;
  }
}

export const getSettings = () => items('/items/portal_settings');

// Navigation : pages en menu, avec sous-menus via la page parente.
// Une page enfant apparaît sous son parent même sans show_in_nav sur l'enfant.
export const getNavPages = async (admin = false) => {
  const pages = (await items('/items/pages?filter[status][_eq]=published&sort=sort&fields=id,title,slug,parent,show_in_nav,lien_externe,admin_seulement&limit=200')) || [];
  // pages « réservées aux admins » : absentes des menus pour les visiteurs
  const visibles = admin ? pages : pages.filter((p) => !p.admin_seulement);
  const enfants = (id) => visibles.filter((p) => p.parent === id);
  return visibles
    .filter((p) => p.show_in_nav && !p.parent)
    .map((p) => ({ ...p, children: enfants(p.id) }));
};

// Pages du menu de pied de page (footer), réutilisable sur toutes les instances :
// toute page publiée marquée show_in_footer, triée. Renvoie l'URL (lien externe
// éventuel) et si elle ouvre dans un nouvel onglet. Tolère l'absence du champ
// (instances au schéma antérieur) : la liste est alors simplement vide.
export const getFooterPages = async (admin = false) => {
  const pages = (await items('/items/pages?filter[status][_eq]=published&filter[show_in_footer][_eq]=true&sort=sort&fields=title,slug,lien_externe,admin_seulement&limit=100')) || [];
  return pages.filter((p) => admin || !p.admin_seulement).map((p) => ({
    title: p.title,
    href: p.lien_externe || `/pages/${p.slug}`,
    externe: !!p.lien_externe && /^https?:\/\//.test(p.lien_externe),
  }));
};

const CHAMPS_BLOCS = 'id,type,titre,largeur,texte,carte,graphique,chiffres,config,image,legende,lien,tableau_bord,territoire_config,embed_type,embed_url,hauteur,sort';

export const getPage = async (slug) => {
  const r = await items(`/items/pages?filter[status][_eq]=published&filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`);
  const page = r?.[0] || null;
  if (!page) return null;
  // constructeur par blocs : requête séparée (robuste si la collection n'existe pas encore)
  page.blocs = (await items(
    `/items/page_blocs?filter[page][_eq]=${page.id}&filter[status][_eq]=published&sort=sort&limit=200&fields=${CHAMPS_BLOCS}`,
  )) || [];
  return page;
};

// Aperçu d'une page NON publiée (brouillon) : réservé à l'appel admin (route protégée).
// Ne filtre pas sur le statut, ni pour la page ni pour ses blocs, afin que l'oeil
// « Aperçu » de Directus rende le brouillon tel qu'il sera une fois publié.
export const getPagePreview = async (slug) => {
  const r = await items(`/items/pages?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`);
  const page = r?.[0] || null;
  if (!page) return null;
  page.blocs = (await items(
    `/items/page_blocs?filter[page][_eq]=${page.id}&sort=sort&limit=200&fields=${CHAMPS_BLOCS}`,
  )) || [];
  return page;
};

// Mise en page de l'accueil : blocs ordonnés gérés dans Directus (home_blocks).
export const getHomeBlocks = async () =>
  (await items('/items/home_blocks?filter[status][_eq]=published&sort=sort')) || [];

// Thématiques et indicateurs : collections réutilisables (bloc thèmes et
// chiffres clés de l'accueil pilotés par Directus).
export const getThematiques = async () =>
  (await items('/items/thematiques?filter[status][_eq]=published&sort=sort')) || [];

export const getIndicateurs = async () =>
  (await items('/items/indicateurs?filter[status][_eq]=published&sort=sort')) || [];

export const getActualites = async (limit = 50, theme = '') =>
  (await items(`/items/actualites?filter[status][_eq]=published`
    + (theme ? `&filter[thematique][_eq]=${encodeURIComponent(theme)}` : '')
    + `&sort=-date_publication&limit=${limit}`)) || [];

export const getCartes = async () =>
  (await items('/items/cartes?filter[status][_eq]=published&fields=id,titre&sort=sort')) || [];

export const getActualite = async (id) => {
  const r = await items(`/items/actualites/${id}`);
  return r && r.status === 'published' ? r : null;
};

export const getReusesForDataset = async (datasetName) =>
  (await items(`/items/reuses?filter[status][_eq]=published&filter[datasets][_contains]=${encodeURIComponent(datasetName)}`)) || [];

// Directives d'intégration, utilisables en markdown comme dans le WYSIWYG :
// [[evidence:slug]] (page d'observatoire) et [[grist:chemin]] (vue Grist).
// Les iframes portent un title : exigence d'accessibilité (RGAA 2.1).
function applyDirectives(html) {
  const obs = process.env.NEXT_PUBLIC_OBS_URL || '';
  const grist = process.env.NEXT_PUBLIC_GRIST_URL || '';
  return html
    .replace(/\[\[evidence:([a-z0-9_\/-]*)\]\]/g, (_, slug) =>
      obs ? `<iframe class="evidence" title="Page Evidence ${slug || 'accueil'}" src="${obs}/${slug}" loading="lazy"></iframe>`
          : '<p><em>(Evidence non activé sur cette instance)</em></p>')
    .replace(/\[\[grist:([A-Za-z0-9_\/.?=&-]*)\]\]/g, (_, path) =>
      grist ? `<iframe class="evidence" title="Tableau Grist" src="${grist}/${path}${path.includes('?') ? '&' : '?'}embed=true&style=singlePage" loading="lazy"></iframe>`
            : '<p><em>(Grist non activé sur cette instance)</em></p>')
    .replace(/\[\[superset:([a-z0-9-]+)\]\]/g, (_, slug) => {
      const bi = process.env.NEXT_PUBLIC_BI_URL || '';
      return bi ? `<iframe class="evidence" title="Tableau de bord ${slug}" src="${bi}/superset/dashboard/${slug}/?standalone=3" loading="lazy"></iframe>`
                : '<p><em>(Superset non activé sur cette instance)</em></p>';
    })
    .replace(/\[\[graphique:(\d+)\]\]/g, (_, id) =>
      `<div class="dtz-graphique" data-config="${id}" role="img" aria-label="Graphique"></div>`)
    .replace(/\[\[territoire:([^\]]+)\]\]/g, (_, args) => {
      // Multi-niveaux : [[territoire:Départements=<rid>,<geo>,<code>|EPCI=<rid>,<geo>,<code>]]
      // Niveau unique  : [[territoire:<rid indicateurs>|<contour: uuid ou fichier>]]
      const parts = String(args).split('|').map((s) => s.trim()).filter(Boolean);
      const uuid = (s) => /^[a-f0-9-]{36}$/.test(s || '');
      // rid peut être une liste de ressources à fusionner par code : uuid+uuid+uuid
      const rids = (s) => s && String(s).split('+').every((x) => uuid(x.trim()));
      if (parts.some((p) => p.includes('='))) {
        const niveaux = [];
        for (const p of parts) {
          const eq = p.indexOf('=');
          const label = p.slice(0, eq).trim();
          const [rid, geo, code] = p.slice(eq + 1).split(',').map((s) => s.trim());
          if (rids(rid)) niveaux.push({ label, rid, geo: geo || '', code: code || 'code' });
        }
        if (!niveaux.length) return '';
        const json = JSON.stringify(niveaux).replace(/"/g, '&quot;');
        return `<div class="dtz-territoire" data-niveaux="${json}" role="group" aria-label="Tableau de bord territorial"></div>`;
      }
      const [rid, geo] = parts;
      if (!rids(rid)) return '';
      return `<div class="dtz-territoire" data-rid="${rid}"${geo ? ` data-geo="${geo}"` : ''} role="group" aria-label="Tableau de bord territorial"></div>`;
    })
    .replace(/\[\[carte:(\d+)\]\]/g, (_, id) =>
      `<div class="dtz-carte" data-config="${id}" role="img" aria-label="Carte interactive"></div>`)
    .replace(/\[\[carte:([a-f0-9,-]{36,})\]\]/g, (_, rids) =>
      `<div class="dtz-carte" data-rid="${rids}" role="img" aria-label="Carte des points"></div>`)
    // Visualisation Flourish embarquée : [[flourish:ID]] ou [[flourish:ID|hauteur]].
    // Solution transitoire (reprise de sites existants) ; l'iframe est chargée
    // par le navigateur du visiteur (le portail reste sans egress). À remplacer
    // à terme par des graphiques/cartes locaux branchés au catalogue.
    .replace(/\[\[flourish:(\d+)(?:\|(\d+))?\]\]/g, (_, id, h) =>
      `<div class="embed dtz-flourish"><iframe src="https://flo.uri.sh/visualisation/${id}/embed?auto=1" `
      + `title="Visualisation Flourish" style="display:block;width:100%;height:${h || 600}px;border:0" `
      + `loading="lazy" referrerpolicy="no-referrer" allow="fullscreen"></iframe></div>`)
    // Vidéo YouTube : [[youtube:ID]] (ou URL complète). Ratio 16:9 responsive,
    // domaine sans cookie (youtube-nocookie), composant réutilisable sur toutes
    // les instances. L'iframe est chargée par le navigateur du visiteur.
    .replace(/\[\[youtube:([^\]]+)\]\]/g, (_, v) => {
      const id = (String(v).match(/(?:v=|\/embed\/|youtu\.be\/|^)\s*([A-Za-z0-9_-]{11})/) || [])[1];
      if (!id) return '';
      return `<div class="embed dtz-youtube"><iframe src="https://www.youtube-nocookie.com/embed/${id}" `
        + `title="Vidéo YouTube" loading="lazy" referrerpolicy="no-referrer" `
        + `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" `
        + `allowfullscreen></iframe></div>`;
    });
}

const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reecrireAssets = (html) => {
  const admin = process.env.NEXT_PUBLIC_ADMIN_URL || '';
  return html.replace(/src="\/assets\//g, `src="${admin}/assets/`)
    .replace(/href="\/assets\//g, `href="${admin}/assets/`);
};

// Équipe automatiquement les iframes intégrées dans le contenu (carte vMap, tableau
// de bord… collés dans le WYSIWYG) de l'attribut data-dtz-tools : EmbedTools leur
// ajoute alors la barre « plein écran / ouvrir », sans opt-in manuel. On exclut
// YouTube (contrôles natifs) et Flourish (déjà dans un conteneur .embed équipé).
const equiperEmbeds = (html) => html.replace(/<iframe\b([^>]*)>/gi, (tag, attrs) => {
  if (/data-dtz-tools/i.test(attrs)) return tag;
  if (/youtube(?:-nocookie)?\.com|youtu\.be|flo\.uri\.sh/i.test(attrs)) return tag;
  return `<iframe data-dtz-tools="1"${attrs}>`;
});

// Contenu de page : HTML du WYSIWYG Directus (images, tableaux, listes…)
// ou markdown historique. Les images uploadées dans Directus (/assets/...)
// sont réécrites vers le domaine d'administration de l'instance.
export function renderContent(content) {
  const c = content || '';
  if (/^\s*</.test(c)) {
    return equiperEmbeds(reecrireAssets(applyDirectives(c)));
  }
  return equiperEmbeds(miniMarkdown(c));
}

// Constructeur de pages par blocs : rend une suite de blocs typés (texte, carte,
// graphique, tableau de bord, intégration) composés dans Directus par sélecteurs,
// sans directive à écrire. Réutilise les composants du portail (CartesLoader,
// ChartsLoader, TerritoireDashboard, EmbedTools) via les mêmes marqueurs HTML.
const LARGEURS = { pleine: 'pleine', moitie: 'moitie', tiers: 'tiers', 'deux-tiers': 'deux-tiers' };

// point d'insertion « ＋ Ajouter un bloc ici » entre deux blocs, réservé à l'éditeur
// visuel (masqué pour les visiteurs par .dtz-edit-only). Deux comportements au clic :
//  - dans l'éditeur visuel : VisualEditing ouvre le drawer de l'item PARENT existant
//    (la page) focalisé sur son champ o2m « blocs », où l'on crée le bloc déjà relié
//    (Directus ne permet pas de créer un item depuis l'iframe : on passe par l'o2m).
//    Les attributs data-parent-* pilotent ce drawer intégré.
//  - hors éditeur / si le parent est inconnu : BlockInserter ouvre le formulaire de
//    création Directus pré-rempli (data-collection/page/sort), dans un nouvel onglet.
export function insererBloc({ collection, page = null, sort = 0 }) {
  // Bouton d'insertion : BlockInserter capte le clic et ouvre le formulaire de création
  // Directus (collection + page + position). Pas de data-directus ici (voir VisualEditing).
  return `<button type="button" class="dtz-inserer dtz-edit-only" data-collection="${collection}"`
    + (page != null ? ` data-page="${page}"` : '')
    + ` data-sort="${sort}" aria-label="Ajouter un bloc ici">＋ Ajouter un bloc ici</button>`;
}

export async function renderBlocs(blocs, pageId = null) {
  if (!Array.isArray(blocs) || !blocs.length) return '';
  const un = async (b) => {
    let sansTitre = false;
    const h = Number(b.hauteur) > 0 ? Number(b.hauteur) : 0;
    let cfg = {};
    try { cfg = JSON.parse(b.config || '{}'); } catch { cfg = {}; }
    let corps = '';
    if (b.type === 'texte') {
      corps = reecrireAssets(applyDirectives(b.texte || ''));
    } else if (b.type === 'carte' && b.carte) {
      corps = `<div class="dtz-carte" data-config="${b.carte}"${h ? ` style="height:${h}px"` : ''} role="img" aria-label="Carte interactive"></div>`;
    } else if (b.type === 'graphique' && b.graphique) {
      corps = `<div class="dtz-graphique" data-config="${b.graphique}" role="img" aria-label="Graphique"></div>`;
    } else if (b.type === 'filtre') {
      // Filtre global de page : menu déroulant qui pilote graphiques et carte de la page.
      // config JSON : { "field": "annee", "label": "Année", "values": ["2020","2021"] }
      // ou { "field":"annee", "label":"Année", "dataset":"<slug>", "column":"annee" } (auto).
      let cfg = {};
      try { cfg = typeof b.config === 'string' ? JSON.parse(b.config || '{}') : (b.config || {}); } catch { cfg = {}; }
      const field = String(cfg.field || '').trim();
      if (field) {
        const values = Array.isArray(cfg.values) ? cfg.values.map(String) : [];
        const attrs = `data-field="${escHtml(field)}" data-label="${escHtml(cfg.label || b.titre || field)}"`
          + (values.length ? ` data-values="${escHtml(JSON.stringify(values))}"` : '')
          + (cfg.dataset ? ` data-dataset="${escHtml(String(cfg.dataset))}"` : '')
          + (cfg.column ? ` data-column="${escHtml(String(cfg.column))}"` : '');
        corps = `<div class="dtz-filtre" ${attrs} role="group" aria-label="Filtre de page"></div>`;
      }
    } else if (b.type === 'chiffres') {
      // champ « chiffres » = liste (json). Robuste à l'ancien format texte JSON.
      let arr = [];
      if (Array.isArray(b.chiffres)) arr = b.chiffres;
      else { try { arr = JSON.parse(b.chiffres || '[]'); } catch { arr = []; } }
      corps = `<div class="chiffres">${arr.map((c) =>
        `<div class="chiffre"><strong>${escHtml(c.valeur)}</strong><span>${escHtml(c.libelle)}</span></div>`).join('')}</div>`;
    } else if (b.type === 'image' && b.image) {
      const admin = process.env.NEXT_PUBLIC_ADMIN_URL || '';
      const alt = escHtml(b.legende || b.titre || '');
      let img = `<img src="${admin}/assets/${b.image}" alt="${alt}" loading="lazy" style="max-width:100%;height:auto;border-radius:10px" />`;
      if (b.lien) img = `<a href="${escHtml(b.lien)}">${img}</a>`;
      corps = `<figure class="bloc-image">${img}${b.legende ? `<figcaption>${escHtml(b.legende)}</figcaption>` : ''}</figure>`;
    } else if (b.type === 'tableau-bord' && b.tableau_bord) {
      corps = `<div class="dtz-territoire" data-tb="${b.tableau_bord}" role="group" aria-label="Tableau de bord territorial"></div>`;
    } else if (b.type === 'recherche-indicateur' && b.tableau_bord) {
      corps = `<div class="dtz-recherche-indicateur" data-tb="${b.tableau_bord}" role="search" aria-label="Recherche d'indicateur"></div>`;
    } else if (b.type === 'territoire' && b.territoire_config) {
      corps = applyDirectives(`[[territoire:${b.territoire_config}]]`);
    } else if (b.type === 'carte-selecteur' && b.territoire_config) {
      // carte-sélecteur simple : la carte pilote les graphiques, sans panneau d'indicateurs
      corps = applyDirectives(`[[territoire:${b.territoire_config}]]`)
        .replace('class="dtz-territoire"', 'class="dtz-territoire" data-panneau="0"');
    } else if (b.type === 'embed' && b.embed_url) {
      corps = ['evidence', 'grist', 'superset'].includes(b.embed_type)
        ? applyDirectives(`[[${b.embed_type}:${b.embed_url}]]`)
        : `<div class="embed"><iframe src="${escHtml(b.embed_url)}" title="${escHtml(b.titre || 'Contenu intégré')}" style="width:100%;height:${h || 480}px;border:0" loading="lazy"></iframe></div>`;
    } else if (b.type === 'flourish' && b.embed_url) {
      // schéma Flourish : l'ID de visualisation (chiffres) OU une URL d'embed complète,
      // saisi dans le champ « URL d'intégration ». Chargé par le navigateur du visiteur.
      const v = String(b.embed_url).trim();
      const src = /^\d+$/.test(v) ? `https://flo.uri.sh/visualisation/${v}/embed?auto=1` : escHtml(v);
      corps = `<div class="embed dtz-flourish"><iframe src="${src}" title="${escHtml(b.titre || 'Visualisation Flourish')}" style="width:100%;height:${h || 560}px;border:0" loading="lazy" referrerpolicy="no-referrer" allow="fullscreen"></iframe></div>`;
    } else if (b.type === 'video' && b.embed_url) {
      // vidéo YouTube : ID de vidéo OU URL complète, saisi dans « URL d'intégration ».
      // Composant réutilisable ; l'iframe est chargée par le navigateur du visiteur.
      corps = applyDirectives(`[[youtube:${String(b.embed_url).trim()}]]`);
    } else if (b.type === 'rapport') {
      // modèle « rapport » réutilisable : le champ config (JSON) porte
      // { intro?: [...], sections: [{titre, texte, info, flourish}], parent? }.
      // Rendu client par RapportLoader (pagination, 2 colonnes). Placeholder vide
      // (rendu 100 % client, pas d'hydratation SSR à réconcilier).
      sansTitre = true;
      let conf = b.config;
      if (typeof conf !== 'string') conf = JSON.stringify(conf || {});
      const attr = conf.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      corps = `<div class="dtz-rapport" data-titre="${escHtml(b.titre || '')}" data-config="${attr}"></div>`;
    } else if (b.type === 'hero') {
      sansTitre = true;
      corps = `<section class="hero"><h1>${escHtml(b.titre || '')}</h1>${reecrireAssets(applyDirectives(b.texte || ''))}</section>`;
    } else if (b.type === 'recherche') {
      let n = null;
      try { n = (await searchDatasets({ rows: 0, orgs: catalogueOrgs(await getSettings()) })).count; } catch { /* CKAN indispo */ }
      corps = '<form class="recherche" action="/catalogue" method="get">'
        + '<input type="search" name="q" placeholder="Rechercher un jeu de données…" />'
        + '<button type="submit">Rechercher</button></form>'
        + `<p class="meta"><a href="/catalogue">Catalogue complet${n != null ? ` (${n} jeux de données)` : ''} →</a></p>`;
    } else if (b.type === 'themes') {
      const th = await getThematiques();
      // Chaque thématique mène à sa page dédiée si elle en a une, sinon au
      // catalogue filtré sur son thème CKAN (référence data.gouv) : l'accueil
      // éditorial reste connecté au catalogue.
      const lienTheme = (t) => (t.slug
        ? `/pages/${t.slug}`
        : (t.theme ? `/catalogue?theme=${encodeURIComponent(t.theme)}` : '/catalogue'));
      corps = th.length ? `<div class="vitrines">${th.map((t) =>
        `<a class="carte vitrine thematique" href="${lienTheme(t)}"${t.couleur ? ` style="border-top:4px solid ${t.couleur}"` : ''}>`
        + `<h3>${t.icone ? escHtml(t.icone) + ' ' : ''}${escHtml(t.title)}</h3>${t.description ? `<p>${escHtml(t.description)}</p>` : ''}</a>`).join('')}</div>` : '';
    } else if (b.type === 'actualites') {
      const admin = process.env.NEXT_PUBLIC_ADMIN_URL || '';
      const actus = await getActualites(Number(cfg.limit) || 4, cfg.theme || '');
      corps = actus.length ? `<div class="vitrines">${actus.map((a) =>
        `<a class="carte vitrine actu" href="/actualites/${a.id}">${a.image ? `<img class="actu-img" src="${admin}/assets/${a.image}?width=640&format=webp" alt="" loading="lazy" />` : ''}`
        + `<p class="meta">${(a.date_publication || '').slice(0, 10)}</p><h3>${escHtml(a.title)}</h3>${a.chapo ? `<p>${escHtml(a.chapo)}</p>` : ''}</a>`).join('')}</div>`
        + '<p class="meta"><a href="/actualites">Toutes les actualités →</a></p>' : '';
    } else if (b.type === 'datasets') {
      const slugs = Array.isArray(cfg.datasets) ? cfg.datasets : [];
      const ds = (await Promise.all(slugs.map((s) => getDataset(s).catch(() => null)))).filter(Boolean);
      corps = ds.length ? `<div class="vitrines">${ds.map((d) =>
        `<a class="carte vitrine" href="/dataset/${d.name}"><h3>${escHtml(d.title || d.name)}</h3>`
        + `${d.notes ? `<p>${escHtml(d.notes.length > 120 ? d.notes.slice(0, 120) + '…' : d.notes)}</p>` : ''}</a>`).join('')}</div>` : '';
    }
    const titre = (b.titre && !sansTitre) ? `<h3 class="bloc-titre">${escHtml(b.titre)}</h3>` : '';
    // marqueurs d'édition visuelle Directus (activés en iframe par VisualEditing)
    const edit = ` data-edit-collection="page_blocs" data-edit-item="${b.id}"`
      + (b.type === 'texte' || b.type === 'hero' ? ' data-edit-fields="texte"' : '');
    return `<section class="bloc ${LARGEURS[b.largeur] || 'pleine'}"${edit}>${titre}${corps}</section>`;
  };
  const rendus = await Promise.all(blocs.map(un));
  // interleave : un point d'insertion avant chaque bloc, un dernier après tous.
  let out = '';
  blocs.forEach((b, i) => {
    out += insererBloc({ collection: 'page_blocs', page: pageId, sort: Number(b.sort) || i });
    out += rendus[i];
  });
  const dernier = Number(blocs[blocs.length - 1]?.sort);
  out += insererBloc({ collection: 'page_blocs', page: pageId, sort: (Number.isFinite(dernier) ? dernier : blocs.length) + 1 });
  return `<div class="blocs-grille">${out}</div>`;
}

// Rendu markdown minimal (titres, gras, italique, liens, paragraphes).
// Volontairement sans dépendance ; à remplacer par un vrai renderer si besoin.
export function miniMarkdown(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return applyDirectives(esc(md || ''))
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%;height:auto" loading="lazy">')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)/g, '<a href="$2">$1</a>')
    .split(/\n{2,}/)
    .map((b) => (b.startsWith('<h') ? b : `<p>${b.replace(/\n/g, '<br>')}</p>`))
    .join('\n');
}
