import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';
import { notify } from '../../../../lib/notify';

// Suppression COMPLÈTE d'un jeu de données (réservée aux administrateurs). Purge le jeu
// CKAN, ce qui déclenche le nettoyage de tout ce qui gravite autour (ressources, tables
// datastore, mapfiles WMS/WFS, config pygeoapi via le plugin ogc ; retrait de l'index de
// recherche IA via ckanext-rag). Notifie les admins, en signalant si le jeu était utilisé.
export const runtime = 'nodejs';

const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';

async function ckan(action, payload) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.CKAN_EDIT_TOKEN },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

// Lignes « instance : page » où le jeu est utilisé (carte / graphique / tableau de bord).
async function usageLines(name) {
  try {
    const r = await fetch(`${RAG}/dataset/usages/${encodeURIComponent(name)}`, {
      headers: { 'X-Dtz-Token': process.env.RAG_WEBHOOK_TOKEN || '' },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    const lines = [];
    for (const inst of d.instances || []) {
      for (const p of inst.pages || []) lines.push(`${inst.instance} : ${p.titre || p.title || p.slug || 'page'}`);
    }
    return lines;
  } catch { return []; }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'réservé aux administrateurs' }, { status: 403 });
  }
  const { name } = await request.json().catch(() => ({}));
  if (!/^[a-z0-9][a-z0-9_-]{0,110}$/.test(name || '')) {
    return NextResponse.json({ error: 'nom invalide' }, { status: 400 });
  }

  const show = await ckan('package_show', { id: name });
  if (!show.ok || !show.body.success) {
    return NextResponse.json({ error: 'jeu introuvable' }, { status: 404 });
  }
  const title = show.body.result.title || name;
  const resources = show.body.result.resources || [];
  const usages = await usageLines(name);

  // 1. Tables datastore de chaque ressource : suppression EXPLICITE et fiable (la purge
  // seule ne les supprime pas toujours ; ça libère l'espace en base).
  for (const r of resources) {
    if (r.datastore_active) {
      await ckan('datastore_delete', { resource_id: r.id, force: true }).catch(() => {});
    }
  }
  // 2. state=deleted (retrait de l'index RAG via ckanext-rag) puis purge définitive.
  await ckan('package_patch', { id: name, state: 'deleted' });
  const purge = await ckan('dataset_purge', { id: name });
  // 3. Artefacts OGC (mapfile WMS/WFS, entrée pygeoapi) : action DÉDIÉE appelée EN DERNIER
  // (le jeu est purgé, donc aucun événement ne peut régénérer le mapfile ensuite). CKAN 2.11
  // n'ayant pas de hook after_dataset_purge, ce nettoyage explicite est indispensable.
  await ckan('ogc_purge_artifacts', { name, resources: resources.map((r) => ({ id: r.id })) }).catch(() => {});
  if (!purge.ok || !purge.body.success) {
    return NextResponse.json({ error: `échec de la suppression : ${JSON.stringify(purge.body.error || purge.body)}` }, { status: 502 });
  }

  const admins = [...new Set([
    ...(process.env.PORTAL_ADMINS || '').split(','),
    ...(process.env.PLATFORM_ADMINS || '').split(','),
  ].map((s) => s.trim().toLowerCase()).filter(Boolean))];
  const corps =
    `Le jeu de données « ${title} » (${name}) a été SUPPRIMÉ par ${session.name || session.email} (${session.email}).\n\n`
    + (usages.length
      ? `⚠️ Il était UTILISÉ dans ${usages.length} élément(s) publié(s) :\n- ${usages.join('\n- ')}\n\n`
        + `Les cartes / graphiques / tableaux concernés peuvent désormais être vides : à vérifier.\n\n`
      : `Il n'était utilisé dans aucune page publiée au moment de la suppression.\n\n`)
    + `Nettoyage effectué : ressources, tables datastore, mapfiles WMS/WFS, configuration pygeoapi, index de recherche IA.`;
  try { await notify(admins, `Jeu supprimé : ${title}`, corps); } catch { /* la suppression a réussi, la notif est best-effort */ }

  return NextResponse.json({ ok: true, usages });
}
