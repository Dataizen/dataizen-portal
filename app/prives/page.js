import { listDeposits } from '../../lib/ckan';
import { getSession, isAdmin } from '../../lib/session';

// Jeux privés (brouillons) : ils n'apparaissent PAS dans la recherche du catalogue public.
// Cette page les liste pour l'utilisateur connecté (les siens ; tous ceux de l'instance
// pour un admin), avec un lien vers chaque fiche.
export const dynamic = 'force-dynamic';

export default async function Prives() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <h1>Jeux privés</h1>
        <p><a className="bouton-admin" href="/api/auth/login">Connectez-vous</a> pour voir les jeux privés (brouillons).</p>
      </div>
    );
  }
  const admin = isAdmin(session);
  const org = process.env.INSTANCE_NAME || 'dataizen';
  const depots = (await listDeposits({ email: session.email, admin, org, adminAll: true })).filter((d) => d.private);

  return (
    <div>
      <h1>Jeux privés (brouillons)</h1>
      <p className="meta">
        {admin
          ? "Tous les brouillons privés de l'instance. Ils ne sont pas visibles dans le catalogue public tant qu'ils ne sont pas publiés."
          : "Vos dépôts en brouillon privé. Ils ne sont visibles que de vous (et des administrateurs) tant qu'ils ne sont pas publiés."}
      </p>
      {depots.length === 0 ? (
        <p className="meta">Aucun jeu privé pour le moment.</p>
      ) : (
        <ul className="liste-depots">
          {depots.map((d) => (
            <li key={d.name}>
              <a href={`/dataset/${d.name}`}>{d.title}</a>{' '}
              <span className="badge perime">Brouillon privé</span>
              {admin && d.depose_par && <span className="meta"> · déposé par {d.depose_par}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="meta" style={{ marginTop: '1rem' }}>
        <a href="/deposer">Déposer un nouveau jeu</a> · <a href="/catalogue">Catalogue public</a>
      </p>
    </div>
  );
}
