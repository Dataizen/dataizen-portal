import { listOrganizations, listLicenses, listDeposits } from '../../lib/ckan';
import { getSession, isAdmin } from '../../lib/session';
import { METADATA_FIELDS } from '../../lib/metadata';
import DepositForm from '../../components/DepositForm';

export const dynamic = 'force-dynamic';

export default async function Deposer() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <h1>Déposer un jeu de données</h1>
        <p><a className="bouton-admin" href="/api/auth/login">Connectez-vous</a> pour déposer une donnée au catalogue.</p>
      </div>
    );
  }
  const admin = isAdmin(session);
  const instanceOrg = process.env.INSTANCE_NAME || 'dataizen';
  const [organizations, licenses, depots] = await Promise.all([
    admin ? listOrganizations() : Promise.resolve([]),
    listLicenses(),
    listDeposits({ email: session.email, admin, org: instanceOrg }),
  ]);

  return (
    <div>
      <h1>Déposer un jeu de données</h1>
      <p className="meta">
        Le fichier est chargé dans le datastore automatiquement (aperçu, API).
        Un dépôt est d'abord un <strong>brouillon privé</strong> : il est visible ici et sur sa
        fiche, {admin ? 'et vous pouvez le publier au catalogue depuis sa fiche (Visibilité).'
          : 'un administrateur le publiera au catalogue.'} Les métadonnées restent modifiables.
      </p>
      <DepositForm
        admin={admin}
        organizations={organizations}
        instanceOrg={instanceOrg}
        licenses={licenses}
        fields={METADATA_FIELDS}
        depositor={{ name: session.name, email: session.email }}
      />

      {depots.length > 0 && (
        <section className="carte" style={{ marginTop: '1.5rem' }}>
          <h2>{admin ? 'Dépôts de l’instance' : 'Mes dépôts'}</h2>
          <ul className="liste-depots">
            {depots.map((d) => (
              <li key={d.name}>
                <a href={`/dataset/${d.name}`}>{d.title}</a>{' '}
                <span className={`badge ${d.private ? 'perime' : ''}`}>
                  {d.private ? 'Brouillon privé' : 'Publié'}
                </span>
                {admin && d.private && <span className="meta"> · à publier</span>}
                {admin && d.depose_par && <span className="meta"> · déposé par {d.depose_par}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
