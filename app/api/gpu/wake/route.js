import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';

// Démarrage (réveil) du GPU souverain. Réservé aux admins d'instance (session portail) :
// proxifie dtz-rag /gpu/wake avec le jeton de service. Le réveil coûte du temps GPU
// facturé, d'où la protection.
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';
const TOKEN = process.env.RAG_WEBHOOK_TOKEN || '';

export async function POST() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  }
  try {
    const r = await fetch(`${RAG}/gpu/wake`, {
      method: 'POST',
      headers: {
        'X-Dtz-Token': TOKEN,
        'X-Dtz-Instance': process.env.INSTANCE_NAME || '',
        'X-Dtz-User': session.email || '',
      },
      signal: AbortSignal.timeout(12000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: d.detail || 'réveil impossible' }, { status: r.status || 502 });
    return NextResponse.json({ started: true });
  } catch {
    return NextResponse.json({ error: 'réveil impossible' }, { status: 502 });
  }
}
