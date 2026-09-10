import { NextResponse } from 'next/server';

// « Utilisée dans » : instances (portails) où un jeu est employé (carte / graphique /
// tableau de bord). Proxifie dtz-rag, qui balaye le Directus de chaque instance.
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';
const TOKEN = process.env.RAG_WEBHOOK_TOKEN || '';

export async function GET(request) {
  const name = new URL(request.url).searchParams.get('name') || '';
  if (!/^[a-z0-9][a-z0-9_-]{0,110}$/.test(name)) {
    return NextResponse.json({ error: 'nom invalide' }, { status: 400 });
  }
  try {
    const r = await fetch(`${RAG}/dataset/usages/${encodeURIComponent(name)}`, {
      headers: { 'X-Dtz-Token': TOKEN }, signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return NextResponse.json({ instances: [] });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ instances: [] });
  }
}
