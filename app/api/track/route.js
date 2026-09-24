import { NextResponse } from 'next/server';

// Suivi d'usage anonyme du portail public : enregistre les pages vues et les téléchargements
// dans la collection Directus `usage_events` de l'instance. AUCUNE donnée personnelle n'est
// stockée : ni adresse IP, ni identifiant, ni cookie. Respecte Do Not Track / Global Privacy
// Control. Le suivi ne doit jamais casser la navigation (toute erreur est silencieuse).
export const runtime = 'nodejs';

const DIRECTUS = process.env.DIRECTUS_INTERNAL_URL || 'http://directus:8055';
const TYPES = new Set(['page', 'download', 'search']);

export async function POST(request) {
  // Défense en profondeur : le client s'abstient déjà si l'utilisateur refuse le suivi.
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') {
    return new NextResponse(null, { status: 204 });
  }
  let ev;
  try {
    ev = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const type = TYPES.has(ev && ev.type) ? ev.type : 'page';
  const chemin = typeof (ev && ev.chemin) === 'string' ? ev.chemin.slice(0, 300) : '';
  const ref = typeof (ev && ev.ref) === 'string' && ev.ref ? ev.ref.slice(0, 200) : undefined;
  try {
    await fetch(`${DIRECTUS}/items/usage_events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, chemin, ref }),
    });
  } catch {
    // silencieux
  }
  return new NextResponse(null, { status: 204 });
}
