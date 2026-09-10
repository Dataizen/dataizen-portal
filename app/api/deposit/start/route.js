import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSession, isAdmin } from '../../../../lib/session';

// Émet un TICKET signé (HMAC) autorisant le dépôt d'un gros fichier (upload résumable
// tus) sur un jeu précis. Le navigateur envoie ce ticket à tusd (depot.<domain>) ;
// le hook tusd-hook le vérifie avant d'enregistrer la ressource CKAN. L'autorisation
// (qui peut déposer où) est décidée ICI, côté portail (session Keycloak), pas dans tusd.
export const runtime = 'nodejs';

const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const SECRET = process.env.DEPOT_HMAC_SECRET || '';
const ENDPOINT = process.env.DEPOT_URL || '';           // ex : https://depot.core.dataizen.eu/files/
const INSTANCE_ORG = process.env.INSTANCE_NAME || 'dataizen';
const TTL_S = 3600;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

async function ckanGet(action, params) {
  const r = await fetch(`${CKAN}/api/3/action/${action}?${new URLSearchParams(params)}`, {
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok && body.success, result: body.result };
}

function signTicket(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  return `${body}.${sig}`;
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  if (!SECRET || !ENDPOINT) {
    return NextResponse.json({ error: 'dépôt de gros fichiers non configuré' }, { status: 503 });
  }

  const { pkg, rid } = await request.json().catch(() => ({}));

  // Résout le jeu cible (par son nom, ou via la ressource à remplacer) et vérifie le droit
  // de dépôt : administrateur, ou jeu appartenant à l'organisation de l'instance.
  let packageName = pkg;
  if (rid && !packageName) {
    const res = await ckanGet('resource_show', { id: rid });
    if (!res.ok) return NextResponse.json({ error: 'ressource introuvable' }, { status: 404 });
    const p = await ckanGet('package_show', { id: res.result.package_id });
    if (!p.ok) return NextResponse.json({ error: 'jeu introuvable' }, { status: 404 });
    packageName = p.result.name;
  }
  if (!packageName) return NextResponse.json({ error: 'jeu cible manquant' }, { status: 400 });

  const p = await ckanGet('package_show', { id: packageName });
  if (!p.ok) return NextResponse.json({ error: 'jeu introuvable' }, { status: 404 });
  const org = (p.result.organization || {}).name;
  if (!isAdmin(session) && org !== INSTANCE_ORG) {
    return NextResponse.json({ error: 'dépôt non autorisé sur ce jeu' }, { status: 403 });
  }

  const payload = { pkg: p.result.name, exp: Math.floor(Date.now() / 1000) + TTL_S };
  if (rid) payload.rid = rid;   // remplacement du fichier d'une ressource existante
  return NextResponse.json({ endpoint: ENDPOINT, ticket: signTicket(payload) });
}
