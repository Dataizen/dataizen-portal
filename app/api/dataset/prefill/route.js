import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';

// Pré-remplissage IA des métadonnées au dépôt : le client parse l'entête + un
// échantillon du fichier (avant chargement datastore) et l'envoie ici ; on
// interroge dtz-rag qui propose titre, description, mots-clés et champs de méta.
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  const { columns, sample, filename, fields } = await request.json().catch(() => ({}));
  if (!Array.isArray(columns) || !columns.length) {
    return NextResponse.json({ error: 'aucune colonne détectée dans le fichier' }, { status: 400 });
  }
  try {
    const r = await fetch(`${RAG}/generate/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dtz-Token': process.env.RAG_WEBHOOK_TOKEN || '' },
      body: JSON.stringify({
        columns: columns.slice(0, 200),
        sample: Array.isArray(sample) ? sample.slice(0, 10) : [],
        filename: (filename || '').slice(0, 200),
        fields: Array.isArray(fields) ? fields : [],
      }),
      signal: AbortSignal.timeout(150000),
    });
    if (r.status === 503) {
      return NextResponse.json({ warming: true,
        message: "L'IA démarre le GPU (1 à 2 min). Réessayez dans une minute." });
    }
    if (!r.ok) return NextResponse.json({ error: 'pré-remplissage indisponible' }, { status: 502 });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ warming: true,
      message: "L'IA démarre (le GPU peut mettre 1 à 2 min). Réessayez dans une minute." });
  }
}
