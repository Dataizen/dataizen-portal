import { NextResponse } from 'next/server';
import { getTableauBordPayload } from '../../../lib/payload-source';

// Configuration d'un tableau de bord territorial construit dans le CMS Payload
// (collections tableaux_bord + tb_niveaux + tb_indicateurs). Renvoie les
// niveaux (jeu + contour + colonne code) et les indicateurs (colonne, libellé,
// unité, catégorie, agrégation, cartographiable, seuils) : le composant
// TerritoireDashboard rend tout le reste (carte, panneau, catégorie).

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'tableau invalide' }, { status: 400 });
  try {
    const out = await getTableauBordPayload(id);
    if (!out) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: 'indisponible' }, { status: 502 });
  }
}
