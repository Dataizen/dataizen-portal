import { NextResponse } from 'next/server';

// Proxy WFS/GeoJSON (évite les blocages CORS des services externes).
// N'accepte que des URL http(s) de services cartographiques, en GET.
export async function GET(request) {
  const u = new URL(request.url).searchParams.get('u') || '';
  let cible;
  try {
    cible = new URL(u);
  } catch {
    return NextResponse.json({ error: 'url invalide' }, { status: 400 });
  }
  if (!/^https?:$/.test(cible.protocol)) {
    return NextResponse.json({ error: 'protocole non autorisé' }, { status: 400 });
  }
  try {
    const r = await fetch(cible, { next: { revalidate: 300 } });
    if (!r.ok) return NextResponse.json({ error: 'service indisponible' }, { status: 502 });
    const txt = await r.text();
    try {
      return NextResponse.json(JSON.parse(txt));
    } catch {
      return NextResponse.json({ error: 'réponse non GeoJSON' }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: 'service injoignable' }, { status: 502 });
  }
}
