// Client API CKAN côté serveur (SSR). Le portail ne duplique aucune donnée :
// tout vient de package_search / package_show / datastore_search.
import { deptsDeRegion } from './regions';

const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
export const CKAN_PUBLIC = process.env.NEXT_PUBLIC_CKAN_URL || 'https://data.core.dataizen.eu';

async function action(name, params = {}) {
  const url = new URL(`${CKAN}/api/3/action/${name}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`CKAN ${name}: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(`CKAN ${name}: échec`);
  return data.result;
}

// Périmètre du catalogue de l'instance (réglé dans Directus, Réglages du portail) :
// null = toutes les données ; sinon liste des organisations exposées.
export function catalogueOrgs(settings) {
  const scope = settings?.catalogue_scope || 'toutes';
  if (scope === 'organisation') return [process.env.INSTANCE_NAME].filter(Boolean);
  if (scope === 'selection') {
    const l = settings?.catalogue_organisations;
    return Array.isArray(l) ? l : [];
  }
  return null;
}

export async function searchDatasets({ q = '', organization = '', format = '', theme = '', tags = '', territoire = '', territoireRegion = '', perime = '', harmonise = '', utilise = '', orgs = null, start = 0, rows = 10 }) {
  const fq = [];
  if (orgs && orgs.length) fq.push(`organization:(${orgs.map((o) => `"${o}"`).join(' OR ')})`);
  if (organization) fq.push(`organization:"${organization}"`);
  if (format) fq.push(`res_format:"${format}"`);
  if (theme) fq.push(`extras_theme:"${theme}"`);
  if (tags) fq.push(`tags:"${tags}"`);
  if (territoire) fq.push(`extras_territoires:"${territoire}"`);
  // filtre « région » : les jeux couvrant au moins un des départements de la région
  if (territoireRegion) {
    const dd = deptsDeRegion(territoireRegion);
    if (dd.length) fq.push(`extras_territoires:(${dd.map((d) => `"${d}"`).join(' OR ')})`);
  }
  // validité : périmé = date de fin strictement avant aujourd'hui (comme le badge).
  if (perime === 'cacher' || perime === 'seuls') {
    const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    fq.push(`${perime === 'cacher' ? '-' : ''}extras_validite_fin:[* TO ${hier}]`);
  }
  // harmonisation DOLFIN : présence (ou absence) de l'extra dolfin_mapping.
  if (harmonise === 'oui') fq.push('extras_dolfin_mapping:[* TO *]');
  else if (harmonise === 'non') fq.push('-extras_dolfin_mapping:[* TO *]');
  // utilisation : le jeu apparaît (ou non) sur une page publiée d'un portail
  // (extra usages_instances, stampé périodiquement par dtz-rag).
  if (utilise === 'oui') fq.push('extras_usages_instances:[* TO *]');
  else if (utilise === 'non') fq.push('-extras_usages_instances:[* TO *]');
  return action('package_search', {
    q,
    fq: fq.join(' AND '),
    start,
    rows,
    'facet.field': '["organization","res_format","tags","extras_territoires"]',
    'facet.limit': 100,
  });
}

export const getDataset = (name) => action('package_show', { id: name });
export const listOrganizations = () => action('organization_list', { all_fields: true });

// Lecture privilégiée (jeton d'édition) : permet de voir un jeu PRIVÉ (brouillon
// déposé, en attente de publication) au déposant ou à un admin. Renvoie null si
// introuvable ou jeton absent. Ne jamais exposer le résultat sans vérifier le droit.
export const getDatasetPrivileged = async (name) => {
  const token = process.env.CKAN_EDIT_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`${CKAN}/api/3/action/package_show?id=${encodeURIComponent(name)}`,
      { headers: { Authorization: token }, cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return d.success ? d.result : null;
  } catch { return null; }
};

// Dépôts d'un utilisateur (privés inclus) : ses propres jeux ; pour un admin,
// tous les brouillons privés de l'org (modération). Via le jeton d'édition.
export const listDeposits = async ({ email, admin, org, adminAll = false }) => {
  const token = process.env.CKAN_EDIT_TOKEN;
  if (!token || (!email && !admin)) return [];
  try {
    // NB : filtrer par le NOM d'organisation via le champ Solr `organization` ; `owner_org`
    // est l'ID (UUID) de l'org, pas son nom (sinon la requête admin renvoie 0).
    const r = await fetch(
      `${CKAN}/api/3/action/package_search?include_private=true&rows=500`
      + (admin && org ? `&fq=organization:${encodeURIComponent(org)}` : ''),
      { headers: { Authorization: token }, cache: 'no-store' });
    if (!r.ok) return [];
    const res = (await r.json()).result?.results || [];
    const dep = (p) => (p.extras || []).find((e) => e.key === 'depose_par')?.value;
    // Admin : par défaut on ne montre que les dépôts (avec déposant) ; adminAll=true montre
    // TOUS les jeux de l'instance (ex. vue « jeux privés » : inclut les jeux importés sans déposant).
    return res
      .filter((p) => (admin ? (adminAll || !!dep(p)) : dep(p) === email))
      .map((p) => ({ name: p.name, title: p.title || p.name, private: !!p.private,
        depose_par: dep(p), org: (p.organization || {}).name }));
  } catch { return []; }
};

export async function listLicenses() {
  try {
    const all = await action('license_list');
    return all.map((l) => ({ id: l.id, title: l.title }));
  } catch {
    return [{ id: 'notspecified', title: 'Licence non renseignée' }];
  }
}

export async function previewDatastore(resourceId, limit = 10) {
  try {
    // total_estimation_threshold : au-delà de ce nombre de lignes, CKAN renvoie un total ESTIMÉ
    // (stats PostgreSQL, instantané) au lieu d'un count exact (plusieurs secondes sur des millions
    // de lignes, qui plombait le chargement de la fiche). Exact pour les petites tables.
    return await action('datastore_search', { resource_id: resourceId, limit, total_estimation_threshold: 1000 });
  } catch {
    return null; // ressource pas (encore) chargée dans le datastore
  }
}

// Aperçu datastore d'une ressource PRIVÉE (jeton d'édition) : l'aperçu public ne peut
// pas lire une ressource privée, donc la fiche l'utilise pour un jeu privé qu'elle est
// déjà autorisée à montrer (déposant / admin, via getDatasetPrivileged). null sinon.
export async function previewDatastorePrivileged(resourceId, limit = 10) {
  const token = process.env.CKAN_EDIT_TOKEN;
  if (!token) return null;
  try {
    // total_estimation_threshold : total ESTIMÉ (instantané) au-delà de 1000 lignes, sinon un count
    // exact sur des millions de lignes ajoutait ~2 s au chargement de chaque fiche (cache no-store).
    const url = `${CKAN}/api/3/action/datastore_search?resource_id=${encodeURIComponent(resourceId)}&limit=${limit}&total_estimation_threshold=1000`;
    const r = await fetch(url, { headers: { Authorization: token }, cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return d.success ? d.result : null;
  } catch {
    return null;
  }
}
