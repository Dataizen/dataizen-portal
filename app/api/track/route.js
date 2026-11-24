import { NextResponse } from 'next/server';
import { usageEnabled, recordEvent } from '../../../lib/usage-db';

// Suivi d'usage anonyme du portail public : enregistre les pages vues et les téléchargements.
// AUCUNE donnée personnelle n'est stockée : ni adresse IP, ni identifiant, ni cookie. Respecte
// Do Not Track / Global Privacy Control. Le suivi ne doit jamais casser la navigation (toute
// erreur est silencieuse).
//
// Store : quand USAGE_DATABASE_URI est défini (instances Payload, et à terme tout le parc),
// on écrit dans la base `usage` dédiée, hors CMS (table events, instance en colonne). Sinon,
// comportement historique : écriture dans la collection Directus `usage_events` de l'instance.
export const runtime = 'nodejs';

const DIRECTUS = process.env.DIRECTUS_INTERNAL_URL || 'http://directus:8055';
const PAYLOAD = process.env.CMS_SOURCE === 'payload';
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

  // Store dédié (hors CMS) si configuré.
  if (usageEnabled()) {
    await recordEvent({ type, chemin, ref });
    return new NextResponse(null, { status: 204 });
  }

  // Back-office Payload sans store configuré : ne pas appeler Directus (arrêté).
  if (PAYLOAD) return new NextResponse(null, { status: 204 });

  // Historique : collection Directus usage_events de l'instance.
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
