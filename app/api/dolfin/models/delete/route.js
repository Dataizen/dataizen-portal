import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../../lib/session';

const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const { slug } = await request.json();
  if (!/^[a-z0-9-]{1,80}$/.test(slug || '')) return NextResponse.json({ error: 'slug invalide' }, { status: 400 });
  const r = await fetch(`${CKAN}/api/3/action/dolfin_model_delete`, {
    method: 'POST',
    headers: { Authorization: process.env.CKAN_EDIT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }), cache: 'no-store',
  });
  return NextResponse.json(r.ok ? { ok: true } : { error: 'échec' }, { status: r.ok ? 200 : 400 });
}
