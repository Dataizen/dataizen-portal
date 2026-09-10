import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  if (!process.env.GRIST_PUBLISH_TOKEN) {
    return NextResponse.json({ error: 'grist non activé' }, { status: 400 });
  }

  const { resource, docname } = await request.json();
  const r = await fetch(`${process.env.HUB_URL}/api/import-grist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance: process.env.INSTANCE_NAME,
      resource,
      docname,
      token: process.env.GRIST_PUBLISH_TOKEN,
    }),
  });
  return NextResponse.json({ ok: r.status === 202 }, { status: r.status });
}
