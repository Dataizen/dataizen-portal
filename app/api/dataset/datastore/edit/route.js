import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../../lib/session';

// Édition légère et DURABLE d'une ressource datastore (approche A) : on régénère le
// fichier CSV de la ressource à partir des données courantes + les modifications
// (cellules, ajout / renommage / suppression de colonne), puis on le redépose
// (resource_patch, id conservé). xloader recharge : le dictionnaire des colonnes
// inchangées est préservé ; les modifications deviennent la source (rien n'est perdu
// à un futur re-dépôt). Réservé à l'admin d'instance ou au déposant.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const TOKEN = process.env.CKAN_EDIT_TOKEN;
const MAX_ROWS = 50000;   // borne d'édition en ligne (au-delà : passer par un re-dépôt de fichier)
const PAGE = 10000;

async function ckan(action, params) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: TOKEN },
    body: JSON.stringify(params), cache: 'no-store',
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  const { name, resource_id: resourceId, cells, addColumns, renameColumns, deleteColumns } =
    await request.json().catch(() => ({}));
  if (!/^[a-z0-9_-]{2,100}$/.test(name || '') || !/^[a-f0-9-]{36}$/.test(resourceId || '')) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }

  // autorisation : admin ou déposant
  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`, {
    headers: { Authorization: TOKEN }, cache: 'no-store',
  });
  if (!shown.ok) return NextResponse.json({ error: 'jeu introuvable' }, { status: 404 });
  const pkg = (await shown.json()).result;
  const res = (pkg.resources || []).find((r) => r.id === resourceId);
  if (!res) return NextResponse.json({ error: 'ressource inconnue' }, { status: 404 });
  const deposant = (pkg.extras || []).find((e) => e.key === 'depose_par')?.value;
  if (!isAdmin(session) && deposant !== session.email) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 403 });
  }

  // schéma courant + garde-fou volumétrie
  const meta = await ckan('datastore_search', { resource_id: resourceId, limit: 0 });
  if (!meta.ok) return NextResponse.json({ error: 'ressource sans datastore' }, { status: 400 });
  const total = meta.body.result.total || 0;
  if (total > MAX_ROWS) {
    return NextResponse.json({ error: `jeu trop volumineux pour l'édition en ligne (${total} lignes) : re-déposez un fichier corrigé.` }, { status: 413 });
  }
  const metaFields = meta.body.result.fields.filter((f) => f.id !== '_id');
  const colSet = new Set(metaFields.map((f) => f.id));
  let columns = metaFields.map((f) => f.id);
  // dictionnaire courant (pour le transférer aux colonnes renommées après rechargement)
  const oldInfo = Object.fromEntries(metaFields.filter((f) => f.info).map((f) => [f.id, f.info]));

  // valider les opérations contre le schéma réel
  const del = new Set((deleteColumns || []).filter((c) => colSet.has(c)));
  const renames = (renameColumns || []).filter((r) => r && colSet.has(r.from) && /^[^,"\n\r]{1,120}$/.test(r.to || '') && r.to !== r.from);
  const adds = (addColumns || []).filter((c) => /^[^,"\n\r]{1,120}$/.test(c || '')
    && !colSet.has(c) && !columns.includes(c));

  // récupérer toutes les lignes (paginé), sans _id
  const rows = [];
  const byId = {};
  for (let off = 0; off < total; off += PAGE) {
    const r = await ckan('datastore_search', { resource_id: resourceId, limit: PAGE, offset: off, sort: '"_id"' });
    if (!r.ok) return NextResponse.json({ error: 'lecture datastore échouée' }, { status: 502 });
    for (const rec of r.body.result.records) {
      const id = rec._id; const o = { ...rec }; delete o._full_text;
      rows.push(o); byId[id] = o;
    }
  }

  // appliquer les modifications de cellules (par _id ; colonne existante ou ajoutée)
  const editable = new Set([...colSet, ...adds]);
  for (const c of (cells || [])) {
    if (c && byId[c._id] && editable.has(c.field)) byId[c._id][c.field] = c.value ?? '';
  }

  // colonnes finales : ajouts, renommages, suppressions
  const renameMap = Object.fromEntries(renames.map((r) => [r.from, r.to]));
  columns = columns.filter((c) => !del.has(c)).map((c) => renameMap[c] || c);
  for (const a of adds) if (!columns.includes(a)) columns.push(a);

  // construire le CSV final
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((finalCol) => {
      // valeur d'origine : la colonne source (avant renommage) si renommée
      const src = Object.keys(renameMap).find((k) => renameMap[k] === finalCol) || finalCol;
      return csvCell(row[src]);
    }).join(','));
  }
  const csv = lines.join('\n') + '\n';

  // redéposer le fichier (id conservé -> xloader recharge, dictionnaire préservé)
  const fd = new FormData();
  fd.set('id', resourceId);
  fd.set('upload', new Blob([csv], { type: 'text/csv' }), (res.name || 'data') + '.csv');
  fd.set('format', 'CSV');
  fd.set('last_modified', new Date().toISOString());
  const up = await fetch(`${CKAN}/api/3/action/resource_patch`, {
    method: 'POST', headers: { Authorization: TOKEN }, body: fd,
  });
  if (!up.ok) return NextResponse.json({ error: 'échec de l\'enregistrement' }, { status: 502 });

  // Transfert du dictionnaire vers les colonnes renommées (xloader recolle par nom, donc
  // une colonne renommée perdrait ses libellé/type forcé). Best-effort : on attend le
  // rechargement (borné) puis on réapplique les info aux nouveaux noms.
  const renamedWithInfo = renames.filter((r) => oldInfo[r.from]);
  if (renamedWithInfo.length) {
    for (let i = 0; i < 8; i += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      const chk = await ckan('datastore_search', { resource_id: resourceId, limit: 0 });
      if (!chk.ok) continue;
      const now = chk.body.result.fields.filter((f) => f.id !== '_id');
      const nowSet = new Set(now.map((f) => f.id));
      if (!renamedWithInfo.every((r) => nowSet.has(r.to))) continue;
      const fields = now.map((f) => {
        const src = renamedWithInfo.find((r) => r.to === f.id);
        const info = src ? oldInfo[src.from] : f.info;
        return info ? { id: f.id, type: f.type, info } : { id: f.id, type: f.type };
      });
      await ckan('datastore_create', { resource_id: resourceId, force: true, fields });
      break;
    }
  }
  return NextResponse.json({ ok: true, rows: rows.length, columns });
}
