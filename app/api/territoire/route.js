import { NextResponse } from 'next/server';

// Lignes d'un jeu de données territorial (une par territoire) pour le tableau
// de bord carte-sélecteur. Proxy serveur du datastore (pas de CORS, pas de token).
// Le paramètre rid peut désigner PLUSIEURS ressources à fusionner par code
// (uuid+uuid+uuid) : la première fixe le libellé du territoire, les suivantes
// ajoutent leurs colonnes (sans écraser celles déjà présentes).
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function lireRessource(rid) {
  const r = await fetch(`${CKAN}/api/3/action/datastore_search?resource_id=${rid}&limit=6000`,
    { next: { revalidate: 300 } });
  if (!r.ok) return null;
  const { result } = await r.json();
  return {
    fields: result.fields.filter((f) => f.id !== '_id').map((f) => f.id),
    records: result.records,
  };
}

export async function GET(request) {
  const raw = new URL(request.url).searchParams.get('rid') || '';
  const rids = raw.split(/[+,]/).map((s) => s.trim()).filter((s) => /^[a-f0-9-]{36}$/.test(s));
  if (!rids.length) {
    return NextResponse.json({ error: 'ressource invalide' }, { status: 400 });
  }
  const jeux = (await Promise.all(rids.map(lireRessource))).filter(Boolean);
  if (!jeux.length) return NextResponse.json({ error: 'datastore indisponible' }, { status: 502 });

  const base = jeux[0];
  // clé de jointure commune (code de préférence)
  const clef = base.fields.includes('code') ? 'code'
    : base.fields.find((f) => jeux.every((j) => j.fields.includes(f))) || 'code';

  // union par code : tout territoire présent dans au moins une ressource apparaît ;
  // pour chaque colonne, la première valeur non vide rencontrée gagne (base prioritaire).
  const fields = [];
  const parCode = new Map();
  for (const j of jeux) {
    for (const f of j.fields) if (!fields.includes(f)) fields.push(f);
    for (const rec of j.records) {
      const cle = String(rec[clef]);
      if (!parCode.has(cle)) parCode.set(cle, {});
      const cible = parCode.get(cle);
      for (const f of j.fields) {
        if (cible[f] === undefined || cible[f] === null || cible[f] === '') cible[f] = rec[f];
      }
    }
  }
  return NextResponse.json({ fields, records: [...parCode.values()] });
}
