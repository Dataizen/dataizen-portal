// Source de données Payload pour le portail (miroir de l'interface de lib/directus.js).
// Activée quand CMS_SOURCE=payload. Chaque fonction renvoie la MÊME forme que la version
// Directus, pour que le rendu du portail (renderBlocs, pages, accueil) soit inchangé.
//
// Lecture serveur via l'URL interne du conteneur Payload ; les URLs de médias sont rendues
// en absolu vers l'URL publique Payload (le navigateur doit pouvoir les charger).

const INTERNAL = process.env.PAYLOAD_INTERNAL_URL || 'http://payload:3000';
const PUBLIC = process.env.NEXT_PUBLIC_PAYLOAD_URL || '';
const LOCALE = process.env.PORTAL_LANG || 'fr';

async function api(path) {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${INTERNAL}/api${path}${sep}locale=${LOCALE}&fallback-locale=${LOCALE}`,
      { next: { revalidate: 15 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// URL absolue d'un média Payload (objet upload populé par depth, ou id).
export function mediaUrl(m) {
  if (!m) return '';
  if (typeof m === 'string') return /^https?:/.test(m) ? m : '';
  const u = m.url || '';
  if (!u) return '';
  return /^https?:/.test(u) ? u : `${PUBLIC}${u}`;
}

const rel = (v) => (v && typeof v === 'object' ? v.id : v); // relationship -> id

export const getSettings = async () => {
  const g = await api('/globals/portal_settings?depth=1');
  if (!g) return null;
  return {
    ...g,
    site_name: g.site_name,
    logo: mediaUrl(g.logo),
    theme_preset: g.theme_preset,
    primary_color: g.primary_color,
    secondary_color: g.secondary_color,
    custom_css: g.custom_css,
    custom_js: g.custom_js,
    catalogue_scope: g.catalogue_scope,
    catalogue_organisations: typeof g.catalogue_organisations === 'string'
      ? g.catalogue_organisations.split(',').map((s) => s.trim()).filter(Boolean)
      : (g.catalogue_organisations || []),
  };
};

// Navigation : pages publiées en menu, sous-menus via parent.
export const getNavPages = async (admin = false) => {
  const r = await api('/pages?where[_status][equals]=published&limit=200&depth=0&sort=sort');
  const pages = (r?.docs || []).map((p) => ({
    id: p.id, title: p.title, slug: p.slug, parent: rel(p.parent),
    show_in_nav: p.show_in_nav, lien_externe: p.lien_externe, admin_seulement: p.admin_seulement,
  }));
  const visibles = admin ? pages : pages.filter((p) => !p.admin_seulement);
  const enfants = (id) => visibles.filter((p) => p.parent === id);
  return visibles.filter((p) => p.show_in_nav && !p.parent).map((p) => ({ ...p, children: enfants(p.id) }));
};

export const getFooterPages = async (admin = false) => {
  const r = await api('/pages?where[_status][equals]=published&where[show_in_footer][equals]=true&limit=100&depth=0&sort=sort');
  return (r?.docs || []).filter((p) => admin || !p.admin_seulement).map((p) => ({
    title: p.title,
    href: p.lien_externe || `/pages/${p.slug}`,
    externe: !!p.lien_externe && /^https?:\/\//.test(p.lien_externe),
  }));
};

// Convertit un bloc Payload (layout) vers la forme attendue par renderBlocs (page_blocs Directus).
function toBloc(b, i) {
  const base = { id: b.id || i, type: b.blockType, titre: b.titre, largeur: b.largeur || 'pleine', sort: i };
  switch (b.blockType) {
    case 'texte': return { ...base, texte: b.texte || '' };
    case 'hero': return { ...base, texte: b.texte || '' };
    case 'carte': return { ...base, carte: rel(b.carte), hauteur: b.hauteur };
    case 'graphique': return { ...base, graphique: rel(b.graphique), hauteur: b.hauteur };
    case 'image': return { ...base, image: mediaUrl(b.image), legende: b.legende, lien: b.lien };
    case 'rapport': return { ...base, config: b.config };
    case 'chiffres': return { ...base, chiffres: b.chiffres };
    case 'embed': return { ...base, embed_type: b.embed_type, embed_url: b.embed_url, hauteur: b.hauteur };
    default: return base;
  }
}

async function pageBySlug(slug, publishedOnly) {
  const q = `/pages?where[slug][equals]=${encodeURIComponent(slug)}`
    + (publishedOnly ? '&where[_status][equals]=published' : '&draft=true') + '&depth=2&limit=1';
  const r = await api(q);
  const p = r?.docs?.[0];
  if (!p) return null;
  p.blocs = (p.layout || []).map(toBloc);
  return p;
}
export const getPage = (slug) => pageBySlug(slug, true);
export const getPagePreview = (slug) => pageBySlug(slug, false);

export const getHomeBlocks = async () => {
  const r = await api('/home_blocks?where[_status][equals]=published&limit=100&depth=0&sort=sort');
  return (r?.docs || []).map((h) => ({
    id: h.id, type: h.type, title: h.title, content: h.content, config: h.config, embed_url: h.embed_url, sort: h.sort,
  }));
};

export const getThematiques = async () => {
  const r = await api('/thematiques?where[_status][equals]=published&limit=100&depth=0&sort=sort');
  return (r?.docs || []).map((t) => ({
    id: t.id, title: t.title, slug: t.slug, icone: t.icone, description: t.description, couleur: t.couleur, theme: t.theme,
  }));
};

export const getIndicateurs = async () => {
  const r = await api('/indicateurs?where[_status][equals]=published&limit=100&depth=0&sort=sort');
  return (r?.docs || []).map((i) => ({
    id: i.id, libelle: i.libelle, valeur: i.valeur, unite: i.unite, source: i.source, date_valeur: i.date_valeur,
  }));
};

export const getActualites = async (limit = 50, theme = '') => {
  let q = `/actualites?where[_status][equals]=published&limit=${limit}&depth=1&sort=-date_publication`;
  if (theme) q += `&where[thematique][equals]=${encodeURIComponent(theme)}`;
  const r = await api(q);
  return (r?.docs || []).map((a) => ({
    id: a.id, title: a.title, chapo: a.chapo, date_publication: a.date_publication,
    image: mediaUrl(a.image), thematique: a.thematique, content: a.content,
  }));
};

export const getActualite = async (id) => {
  const a = await api(`/actualites/${id}?depth=1`);
  if (!a || a._status !== 'published') return null;
  return { ...a, image: mediaUrl(a.image) };
};

export const getCartes = async () => {
  const r = await api('/cartes?where[_status][equals]=published&limit=200&depth=0&sort=sort');
  return (r?.docs || []).map((c) => ({ id: c.id, titre: c.titre }));
};

export const getReusesForDataset = async () => [];

// Pour /api/carte-config : renvoie la carte Payload + ses couches (forme proche de Directus).
export const getCartePayload = async (id) => {
  const c = await api(`/cartes/${id}?depth=0`);
  if (!c || c._status !== 'published') return null;
  return {
    carte: {
      titre: c.titre, fond_defaut: c.fond_defaut, propose_osm: c.propose_osm, propose_plan: c.propose_plan,
      propose_photo: c.propose_photo, vue_3d: c.vue_3d, pilote_territoire: c.pilote_territoire,
      emprise: c.emprise, centre: c.centre, zoom: c.zoom, terrain_url: c.terrain_url,
      terrain_exageration: c.terrain_exageration, status: c._status,
    },
    couches: (c.couches || []).map((l) => ({
      label: l.label, type: l.type, dataset: l.dataset, geojson_rid: l.geojson_rid, url: l.url, couche: l.couche,
      couleur: l.couleur, visible: l.visible, activable: l.activable, hauteur_attr: l.hauteur_attr,
      code_col: l.code_col, geo_code_col: l.geo_code_col, valeur_col: l.valeur_col,
      toit: l.toit, toit_couleur: l.toit_couleur, toit_hauteur: l.toit_hauteur,
    })),
  };
};

// Pour /api/graphique : renvoie la config d'un graphique Payload.
export const getGraphiquePayload = async (id) => {
  const g = await api(`/graphiques/${id}?depth=0`);
  if (!g || g._status !== 'published') return null;
  return g;
};

// Pour /api/tableau-bord : renvoie {titre, ensemble, niveaux[], indicateurs[]} depuis
// le tableau Payload (niveaux/indicateurs en arrays imbriqués).
export const getTableauBordPayload = async (id) => {
  const t = await api(`/tableaux_bord/${id}?depth=0`);
  if (!t || t._status !== 'published') return null;
  const niveaux = (t.niveaux || []).filter((n) => n.dataset).map((n) => ({
    label: n.label, rid: n.dataset, geo: n.contour || '',
    code: n.code_colonne || 'code', geoCode: n.geo_code_colonne || 'code',
  }));
  const indicateurs = (t.indicateurs || []).filter((i) => i.colonne).map((i) => ({
    colonne: i.colonne, libelle: i.libelle || i.colonne, unite: i.unite || '',
    d: Number(i.decimales) || 0, th: i.categorie || 'Autres',
    agg: i.agregation || 'sum', carto: i.cartographiable !== false,
    s: Array.isArray(i.seuils) && i.seuils.length >= 3 ? i.seuils : undefined,
  }));
  return { titre: t.titre, ensemble: t.territoire || '', niveaux, indicateurs };
};
