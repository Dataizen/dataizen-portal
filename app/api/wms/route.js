// Proxy de tuiles WMS (même origine → pas de CORS côté navigateur ; la vue WMS
// de CKAN streame l'image binaire sans en-tête CORS). MapLibre appelle
// /api/wms?bbox={bbox-epsg-3857}&u=<url WMS GetMap sans BBOX, encodée> : le token
// {bbox-epsg-3857} reste littéral (hors partie encodée) pour être substitué.
export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const u = sp.get('u') || '';
  const bbox = sp.get('bbox') || '';
  let cible;
  try {
    cible = new URL(u);
  } catch {
    return new Response('url invalide', { status: 400 });
  }
  if (!/^https?:$/.test(cible.protocol)) {
    return new Response('protocole non autorisé', { status: 400 });
  }
  if (bbox) {
    if (!/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(bbox)) {
      return new Response('bbox invalide', { status: 400 });
    }
    cible.searchParams.set('BBOX', bbox);
  }
  try {
    const r = await fetch(cible, { next: { revalidate: 300 } });
    if (!r.ok) return new Response('service indisponible', { status: 502 });
    const ct = r.headers.get('content-type') || 'image/png';
    // une exception WMS revient en XML : on renvoie une image transparente vide
    if (!ct.startsWith('image/')) {
      return new Response('tuile indisponible', { status: 502 });
    }
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return new Response('service injoignable', { status: 502 });
  }
}
