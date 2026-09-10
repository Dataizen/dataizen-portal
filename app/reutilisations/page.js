const DIRECTUS = process.env.DIRECTUS_INTERNAL_URL || 'http://directus:8055';

export const dynamic = 'force-dynamic';

export default async function Reutilisations() {
  let reuses = [];
  try {
    const res = await fetch(`${DIRECTUS}/items/reuses?filter[status][_eq]=published`, { next: { revalidate: 60 } });
    if (res.ok) reuses = (await res.json()).data;
  } catch { /* mode dégradé */ }

  return (
    <div>
      <h1>Réutilisations</h1>
      {reuses.length === 0 && (
        <p className="meta">Aucune réutilisation publiée pour le moment. Proposez la vôtre via le back-office.</p>
      )}
      {reuses.map((r) => (
        <div className="carte" key={r.id}>
          <h3>{r.url ? <a href={r.url}>{r.title}</a> : r.title}</h3>
          {r.description && <p>{r.description}</p>}
          {Array.isArray(r.datasets) && r.datasets.length > 0 && (
            <p className="meta">
              Données utilisées : {r.datasets.map((d) => <a className="badge" key={d} href={`/dataset/${d}`}>{d}</a>)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
