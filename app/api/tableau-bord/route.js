import { NextResponse } from 'next/server';

// Configuration d'un tableau de bord territorial construit dans Directus
// (collections tableaux_bord + tb_niveaux + tb_indicateurs). Renvoie les
// niveaux (jeu + contour + colonne code) et les indicateurs (colonne, libellé,
// unité, catégorie, agrégation, cartographiable, seuils) : le composant
// TerritoireDashboard rend tout le reste (carte, panneau, catégorie).
const DIRECTUS = process.env.DIRECTUS_INTERNAL_URL || 'http://directus:8055';

const seuilsJson = (v) => {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  try { const p = JSON.parse(v); return Array.isArray(p) && p.length >= 3 ? p : undefined; } catch { return undefined; }
};

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'tableau invalide' }, { status: 400 });
  try {
    const tr = await fetch(`${DIRECTUS}/items/tableaux_bord/${id}`, { next: { revalidate: 60 } });
    if (!tr.ok) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    const t = (await tr.json()).data;
    if (!t || t.status !== 'published') return NextResponse.json({ error: 'non publié' }, { status: 404 });

    const [nr, ir] = await Promise.all([
      fetch(`${DIRECTUS}/items/tb_niveaux?filter[tableau][_eq]=${id}&sort=sort&limit=20`, { next: { revalidate: 60 } }),
      fetch(`${DIRECTUS}/items/tb_indicateurs?filter[tableau][_eq]=${id}&sort=sort&limit=200`, { next: { revalidate: 60 } }),
    ]);
    const niveaux = ((nr.ok ? (await nr.json()).data : []) || [])
      .filter((n) => n.dataset)
      .map((n) => ({ label: n.label, rid: n.dataset, geo: n.contour || '',
                     code: n.code_colonne || 'code', geoCode: n.geo_code_colonne || 'code' }));
    const indicateurs = ((ir.ok ? (await ir.json()).data : []) || [])
      .filter((i) => i.colonne)
      .map((i) => ({
        colonne: i.colonne, libelle: i.libelle || i.colonne, unite: i.unite || '',
        d: Number(i.decimales) || 0, th: i.categorie || 'Autres',
        agg: i.agregation || 'sum', carto: i.cartographiable !== false, s: seuilsJson(i.seuils),
      }));
    return NextResponse.json({ titre: t.titre, niveaux, indicateurs });
  } catch {
    return NextResponse.json({ error: 'indisponible' }, { status: 502 });
  }
}
