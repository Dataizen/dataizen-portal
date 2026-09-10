import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../lib/session';

// Génération IA (outil Directus) : proxifie dtz-rag pour créer graphique / carte /
// tableau de bord / page à partir d'un ou plusieurs jeux et/ou d'une description.
// Réservé aux admins d'instance (écrit des items Directus via le token de service).
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';
const TOKEN = process.env.RAG_WEBHOOK_TOKEN || '';
const KINDS = { graphique: 'chart', carte: 'map', 'tableau-bord': 'dashboard', page: 'page', portrait: 'portrait' };
// Ces types acceptent une description SEULE (jeux découverts via le RAG), sans sélection.
const SANS_JEU = new Set(['page', 'portrait']);

export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  }
  const { kind, datasets, description, level } = await request.json().catch(() => ({}));
  const path = KINDS[kind];
  if (!path) return NextResponse.json({ error: 'type de génération inconnu' }, { status: 400 });
  const ds = Array.isArray(datasets) ? datasets.filter((d) => typeof d === 'string' && d).slice(0, 20) : [];
  const desc = (typeof description === 'string' ? description : '').slice(0, 2000);
  // portrait : niveau cible d'agrégation (un jeu communal peut être agrégé en EPCI/dép/région)
  const lvl = ['epci', 'departement', 'region'].includes(level) ? level : '';
  // page / portrait : une description seule suffit (découverte RAG des jeux) ; les autres exigent un jeu
  if (!ds.length && !SANS_JEU.has(kind)) {
    return NextResponse.json({ error: 'sélectionnez au moins un jeu de données' }, { status: 400 });
  }
  if (!ds.length && !desc) {
    return NextResponse.json({ error: 'décrivez la page souhaitée ou sélectionnez des jeux' }, { status: 400 });
  }
  try {
    const r = await fetch(`${RAG}/generate/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dtz-Token': TOKEN },
      body: JSON.stringify({ instance: process.env.INSTANCE_NAME || '', datasets: ds, description: desc, level: lvl }),
      signal: AbortSignal.timeout(280000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 503) {
      return NextResponse.json({ warming: true,
        message: "Le GPU souverain n'est pas encore disponible (démarrage 1 à 2 min). "
          + 'Rien n\'a été généré. Réessayez dans une minute.' }, { status: 503 });
    }
    if (!r.ok) {
      return NextResponse.json({ error: d.detail || 'génération indisponible' }, { status: r.status || 502 });
    }
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ warming: true,
      message: 'Le GPU souverain démarre (le réveil peut prendre 1 à 2 min). Réessayez.' }, { status: 503 });
  }
}
