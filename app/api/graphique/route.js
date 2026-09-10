import { NextResponse } from 'next/server';
import { sourceDataset } from '../../../lib/source';

// Configuration + données d'un graphique construit dans Directus (collection
// graphiques). Le calcul des séries (agrégation, tri, limite) est fait côté
// serveur : le client ne reçoit que des catégories/valeurs prêtes à tracer.
//
// Deux portées :
//  - « global » (défaut) : le graphique porte sur tous les territoires du jeu ;
//  - « territoire » : le graphique se recompose pour le territoire sélectionné
//    (param ?code=), soit en série de colonnes (structure), soit en série
//    temporelle (filtrage par territoire, X = période), soit en jauge.
const DIRECTUS = process.env.DIRECTUS_INTERNAL_URL || 'http://directus:8055';
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

const nombre = (v) => {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const jsonSafe = (v, secours) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string' || !v.trim()) return secours;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : secours; } catch { return secours; }
};
const couleurOk = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : null);

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  const code = params.get('code');
  const ridParam = params.get('rid');
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'graphique invalide' }, { status: 400 });
  try {
    const gr = await fetch(`${DIRECTUS}/items/graphiques/${id}`, { next: { revalidate: 60 } });
    if (!gr.ok) return NextResponse.json({ error: 'graphique introuvable' }, { status: 404 });
    const g = (await gr.json()).data;
    if (!g || g.status !== 'published') {
      return NextResponse.json({ error: 'graphique non publié' }, { status: 404 });
    }
    const portee = g.portee || 'global';
    // portée territoire : le rid du niveau courant (param) prime sur le dataset
    // fixe, pour lire la donnée du bon niveau (commune/EPCI/département/région).
    // Exception : une série temporelle garde son propre jeu (années par territoire),
    // elle n'est pas portée par les jeux consolidés du sélecteur ; on la filtre par code.
    const rid = (portee === 'territoire' && !g.serie_temporelle && /^[a-f0-9-]{36}$/.test(ridParam || ''))
      ? ridParam : (g.dataset || '');
    if (!/^[a-f0-9-]{36}$/.test(rid)) {
      return NextResponse.json({ error: 'donnée non renseignée' }, { status: 400 });
    }
    // Une série temporelle tous niveaux peut être volumineuse (une ligne par année
    // et par territoire) : on filtre par code côté serveur pour ne ramener que le
    // territoire choisi, indépendamment de la taille du jeu.
    const codeColG = g.code_colonne || 'code';
    const filtreTemporel = portee === 'territoire' && g.serie_temporelle && code;
    const dsUrl = filtreTemporel
      ? `${CKAN}/api/3/action/datastore_search?resource_id=${rid}&limit=1000&filters=${encodeURIComponent(JSON.stringify({ [codeColG]: String(code) }))}`
      : `${CKAN}/api/3/action/datastore_search?resource_id=${rid}&limit=6000`;
    const dr = await fetch(dsUrl, { next: { revalidate: 300 } });
    if (!dr.ok) return NextResponse.json({ error: 'datastore indisponible' }, { status: 502 });
    let rows = (await dr.json()).result.records || [];

    // Filtre global de page (bloc « Filtre ») : { ff: champ, fv: valeur }. Appliqué
    // UNIQUEMENT si la colonne existe dans ce jeu (sinon ce graphique n'est pas concerné
    // par le filtre et reste complet, plutôt que de se vider à tort).
    const ff = (params.get('ff') || '').slice(0, 200);
    const fv = params.get('fv');
    if (ff && fv != null && fv !== '' && rows.length && Object.prototype.hasOwnProperty.call(rows[0], ff)) {
      rows = rows.filter((r) => String(r[ff]) === String(fv));
    }

    const xcol = g.colonne_x, ycol = g.colonne_y, scol = g.colonne_serie || '';
    const unite = typeof g.unite === 'string' ? g.unite : '';
    const couleur = couleurOk(g.couleur);
    const source = await sourceDataset(CKAN, rid); // fiche du jeu de données (lien « Source »)

    // ------- Portée « territoire » : réactive à la sélection (param code) -------
    if (portee === 'territoire') {
      const codeCol = g.code_colonne || 'code';
      const base = {
        titre: g.titre, type: g.type, reactif: true, portee, unite,
        empile: !!g.empile, couleur, source, categories: [], series: [], pairs: [],
      };
      if (!code) {
        return NextResponse.json({ ...base, vide: true,
          message: 'Sélectionnez un territoire sur la carte pour afficher ce détail.' });
      }
      // série temporelle : toutes les lignes de ce territoire, X = période
      if (g.serie_temporelle) {
        const lignes = rows.filter((r) => String(r[codeCol]) === String(code))
          .sort((a, b) => String(a[xcol]).localeCompare(String(b[xcol]), 'fr'));
        if (!lignes.length) {
          return NextResponse.json({ ...base, vide: true, message: 'Pas de série pour ce territoire.' });
        }
        return NextResponse.json({ ...base, vide: false, xcol,
          categories: lignes.map((r) => String(r[xcol])),
          series: [{ name: g.titre, data: lignes.map((r) => nombre(r[ycol]) ?? 0) }] });
      }
      // série de colonnes : une valeur par colonne, pour la ligne du territoire
      const row = rows.find((r) => String(r[codeCol]) === String(code));
      if (!row) {
        return NextResponse.json({ ...base, vide: true,
          message: 'Ce territoire n’est pas disponible à ce niveau.' });
      }
      const cols = jsonSafe(g.colonnes, ycol ? [{ col: ycol, label: ycol }] : []);
      const paires = cols.map((c) => ({ label: c.label || c.col, valeur: nombre(row[c.col]) ?? 0 }));
      if (g.type === 'gauge') {
        const v = paires[0]?.valeur ?? 0;
        const max = Number(g.valeur_max) || (unite.includes('%') ? 100 : Math.max(1, v * 1.6));
        return NextResponse.json({ ...base, vide: false, valeur: v, max,
          libelle: paires[0]?.label || g.titre, seuils: jsonSafe(g.seuils, []) });
      }
      if (g.empile) {
        // barre empilée unique : un segment par colonne (structure 100 %)
        return NextResponse.json({ ...base, vide: false, xcol: 'Territoire',
          categories: [String(row.nom ?? row[g.colonne_x] ?? row[codeCol] ?? 'Territoire')],
          series: paires.map((p) => ({ name: p.label, data: [p.valeur] })) });
      }
      // barres/secteurs : catégories = libellés de colonnes
      return NextResponse.json({ ...base, vide: false, xcol: g.titre,
        categories: paires.map((p) => p.label),
        series: [{ name: g.titre, data: paires.map((p) => p.valeur) }] });
    }

    // ------------------- Portée « global » (comportement d'origine) -------------------
    const agg = scol && g.agregation === 'none' ? 'sum' : (g.agregation || 'none');
    const limite = Math.max(1, Math.min(Number(g.limite) || 20, 200));

    if (g.type === 'scatter') {
      const pairs = rows.map((r) => [nombre(r[xcol]), nombre(r[ycol])])
        .filter(([x, y]) => x !== null && y !== null).slice(0, 2000);
      return NextResponse.json({
        titre: g.titre, type: g.type, xcol, ycol, unite, couleur, source,
        reactif: false, categories: [], series: [], pairs,
      });
    }

    const totalX = new Map();
    const parSerie = new Map();
    const ordreSeries = [];
    const cumule = (m, k, y) => {
      const e = m.get(k) || { s: 0, n: 0 };
      if (agg === 'count') e.n += 1;
      else if (y !== null) { e.s += y; e.n += 1; }
      m.set(k, e);
    };
    const valeur = (e) => !e ? 0
      : agg === 'count' ? e.n : agg === 'avg' ? (e.n ? e.s / e.n : 0) : e.s;

    for (const r of rows) {
      const x = String(r[xcol] ?? '');
      const y = nombre(r[ycol]);
      if (agg !== 'count' && y === null) continue;
      cumule(totalX, x, y);
      const sName = scol ? String(r[scol] ?? '') : (g.titre || 'Valeur');
      if (!parSerie.has(sName)) { parSerie.set(sName, new Map()); ordreSeries.push(sName); }
      cumule(parSerie.get(sName), x, y);
    }

    let cats = [...totalX.keys()];
    if (g.tri === 'value') cats.sort((a, b) => valeur(totalX.get(b)) - valeur(totalX.get(a)));
    else if (g.tri === 'label') cats.sort((a, b) => a.localeCompare(b, 'fr'));
    cats = cats.slice(0, limite);

    const poids = (s) => [...parSerie.get(s).values()].reduce((t, e) => t + valeur(e), 0);
    const series = ordreSeries
      .sort((a, b) => poids(b) - poids(a))
      .slice(0, 12)
      .map((name) => ({
        name,
        data: cats.map((x) => Math.round(valeur(parSerie.get(name).get(x)) * 1000) / 1000),
      }));

    return NextResponse.json({
      titre: g.titre, type: g.type, xcol, ycol, serie: scol || null, unite, couleur,
      empile: !!g.empile, reactif: false, source, categories: cats, series, pairs: [],
    });
  } catch {
    return NextResponse.json({ error: 'indisponible' }, { status: 502 });
  }
}
