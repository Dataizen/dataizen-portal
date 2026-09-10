import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';

// Exploration d'une ressource datastore : recherche EN SOUS-CHAÎNE (ILIKE), filtres
// par colonne, tri et pagination, servis côté serveur (adapté aux gros jeux). La
// recherche/filtre passe par datastore_search_sql avec une requête construite
// SERVEUR (noms de colonnes validés contre le schéma réel, termes échappés) : le
// client ne fournit jamais de SQL. Lecture publique pour un jeu public ; privé =
// session admin/déposant.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const TOKEN = process.env.CKAN_EDIT_TOKEN;

async function ckan(action, params) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: TOKEN },
    body: JSON.stringify(params), cache: 'no-store',
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

const ident = (n) => `"${String(n).replace(/"/g, '""')}"`;             // identifiant SQL
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;              // littéral chaîne SQL
const like = (col, term) => `CAST(${ident(col)} AS text) ILIKE ${lit(`%${term}%`)}`;

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const name = (sp.get('name') || '').trim();
  const resourceId = (sp.get('resource_id') || '').trim();
  if (!/^[a-z0-9_-]{2,100}$/.test(name) || !/^[a-f0-9-]{36}$/.test(resourceId)) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }

  // autorisation : public -> tout le monde ; privé -> admin ou déposant
  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`, {
    headers: { Authorization: TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return NextResponse.json({ error: 'jeu introuvable' }, { status: 404 });
  const pkg = (await shown.json()).result;
  if (!(pkg.resources || []).some((r) => r.id === resourceId)) {
    return NextResponse.json({ error: 'ressource inconnue' }, { status: 404 });
  }
  if (pkg.private) {
    const session = await getSession();
    const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
    if (!session || (!isAdmin(session) && deposant !== session.email)) {
      return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
    }
  }

  // colonnes réelles : sert de liste blanche pour tout nom de colonne utilisé en SQL
  const meta = await ckan('datastore_search', { resource_id: resourceId, limit: 0 });
  if (!meta.ok) return NextResponse.json({ error: 'ressource sans datastore' }, { status: 400 });
  const allFields = (meta.body.result.fields || []).filter((f) => f.id !== '_id');
  const colSet = new Set(allFields.map((f) => f.id));
  const cols = allFields.map((f) => f.id);
  const fieldsOut = allFields.map((f) => ({ id: f.id, type: f.type, label: f.info?.label || f.id, notes: f.info?.notes || '' }));

  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25', 10) || 25, 1), 100);
  const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
  const q = (sp.get('q') || '').slice(0, 200).trim();
  const sortField = colSet.has(sp.get('sort_field')) ? sp.get('sort_field') : '';
  const sortDir = sp.get('sort_dir') === 'desc' ? 'desc' : 'asc';
  const colFilters = {};
  try {
    const raw = JSON.parse(sp.get('filters') || '{}');
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        if (colSet.has(k) && typeof v === 'string' && v.trim()) colFilters[k] = v.trim().slice(0, 200);
      }
    }
  } catch { /* filtres illisibles : ignorés */ }

  const hasSearch = q || Object.keys(colFilters).length;
  const orderBy = sortField ? ` ORDER BY ${ident(sortField)} ${sortDir}` : '';

  // Sans recherche : datastore_search classique (rapide, total inclus).
  if (!hasSearch) {
    const params = { resource_id: resourceId, limit, offset };
    if (sortField) params.sort = `${ident(sortField)} ${sortDir}`;
    let r = await ckan('datastore_search', params);
    if (!r.ok && sortField) r = await ckan('datastore_search', { resource_id: resourceId, limit, offset });
    if (!r.ok) return NextResponse.json({ error: 'requête datastore échouée' }, { status: 502 });
    // on garde _id dans les enregistrements (référence de ligne pour l'édition) ; il
    // n'est pas affiché (les colonnes viennent de `fields`, sans _id).
    return NextResponse.json({ fields: fieldsOut, records: clean(r.body.result.records), total: r.body.result.total || 0 });
  }

  // Recherche/filtre EN SOUS-CHAÎNE via SQL ILIKE (construit côté serveur).
  const where = Object.keys(colFilters).length
    ? Object.entries(colFilters).map(([c, t]) => like(c, t)).join(' AND ')
    : `(${cols.map((c) => like(c, q)).join(' OR ')})`;
  const table = ident(resourceId);
  const sel = ['_id', ...cols].map(ident).join(', ');   // _id conservé (référence de ligne)
  const runRows = (ob) => ckan('datastore_search_sql',
    { sql: `SELECT ${sel} FROM ${table} WHERE ${where}${ob} LIMIT ${limit} OFFSET ${offset}` });

  let rr = await runRows(orderBy);
  if (!rr.ok && orderBy) rr = await runRows('');           // tri non applicable : sans tri
  if (!rr.ok) return NextResponse.json({ error: 'requête datastore échouée' }, { status: 502 });
  const rc = await ckan('datastore_search_sql', { sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}` });
  const total = rc.ok ? Number((rc.body.result.records[0] || {}).n) || 0 : (rr.body.result.records || []).length;
  return NextResponse.json({ fields: fieldsOut, records: rr.body.result.records || [], total });
}

function clean(records) {
  // on retire seulement _full_text (interne) ; _id est conservé comme référence de ligne.
  return (records || []).map((rec) => { const o = { ...rec }; delete o._full_text; return o; });
}
