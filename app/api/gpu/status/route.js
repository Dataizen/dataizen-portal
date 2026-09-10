import { NextResponse } from 'next/server';

// État du GPU souverain (indicateur). PUBLIC (front non connecté + module admin) :
// lecture seule, proxifie dtz-rag. CORS ouvert pour que le module Directus (autre
// sous-domaine) puisse l'afficher.
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';
export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

// Cache mémoire court : le badge est interrogé par chaque visiteur toutes les 30 s ;
// on partage un seul appel amont au contrôleur GPU pendant 10 s.
let cache = { at: 0, data: null };

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.at < 10000) {
    return NextResponse.json(cache.data, { headers: CORS });
  }
  try {
    const r = await fetch(`${RAG}/gpu/status`, { signal: AbortSignal.timeout(9000) });
    const d = await r.json();
    cache = { at: now, data: d };
    return NextResponse.json(d, { headers: CORS });
  } catch {
    return NextResponse.json({ available: false }, { headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
}
