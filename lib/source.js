// Résout une ressource datastore CKAN vers la fiche de son jeu de données au
// catalogue du portail (/dataset/<slug>), pour afficher un lien « Source »
// sous les graphiques et les cartes.
export async function sourceDataset(CKAN, rid) {
  if (!/^[a-f0-9-]{36}$/.test(rid || '')) return null;
  try {
    const rr = await fetch(`${CKAN}/api/3/action/resource_show?id=${rid}`, { next: { revalidate: 3600 } });
    if (!rr.ok) return null;
    const res = (await rr.json()).result;
    const pk = await fetch(`${CKAN}/api/3/action/package_show?id=${res.package_id}`, { next: { revalidate: 3600 } });
    if (!pk.ok) return null;
    const p = (await pk.json()).result;
    return { slug: p.name, titre: p.title || p.name };
  } catch { return null; }
}
