import { NextResponse } from 'next/server';
import { usageEnabled, recordEvent } from '../../../lib/usage-db';

// Suivi d'usage anonyme du portail public : enregistre les pages vues et les téléchargements.
// AUCUNE donnée personnelle n'est stockée : ni adresse IP, ni identifiant, ni cookie. Respecte
// Do Not Track / Global Privacy Control. Le suivi ne doit jamais casser la navigation (toute
// erreur est silencieuse).
//
// Store : quand USAGE_DATABASE_URI est défini (toutes les instances), on écrit dans la base
// `usage` dédiée, hors CMS (table events, instance en colonne). Sans store configuré, le suivi
// est un no-op (le CMS Directus qui recevait l'usage a été décommissionné).
export const runtime = 'nodejs';

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

  // Store dédié (hors CMS) si configuré, sinon no-op.
  if (usageEnabled()) {
    await recordEvent({ type, chemin, ref });
  }
  return new NextResponse(null, { status: 204 });
}
