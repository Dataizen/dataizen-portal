import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';

// Gestion des modèles DOLFIN (globaux) depuis le portail. Réservé aux admins
// d'instance (session) ; l'écriture passe par le token de service CKAN, qui
// exécute les actions dolfin_model_* (elles-mêmes réservées sysadmin côté CKAN).
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function ckanAction(action, payload) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}), cache: 'no-store',
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

function errMsg(body) {
  const e = body && body.error;
  if (!e) return 'échec';
  if (typeof e === 'string') return e;
  if (e.message) return e.message;
  return Object.values(e).flat().join(' ') || 'échec';
}

export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const r = await ckanAction('dolfin_model_list', {});
  if (!r.ok) return NextResponse.json({ error: errMsg(r.body) }, { status: 502 });
  const u = await ckanAction('dolfin_model_usage', {});
  return NextResponse.json({
    models: r.body.result?.models || [],
    usage: (u.ok && u.body.result?.usage) || {},
    instanceOrg: process.env.INSTANCE_NAME || '',
  });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const data = await request.json();
  const r = await ckanAction('dolfin_model_save', { ...data, author: session.email });
  if (!r.ok) return NextResponse.json({ error: errMsg(r.body) }, { status: 400 });
  return NextResponse.json(r.body.result);
}
