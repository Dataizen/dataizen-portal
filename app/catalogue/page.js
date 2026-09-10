import CatalogueView from '../../components/CatalogueView';
import { getSettings } from '../../lib/directus';
import { catalogueOrgs } from '../../lib/ckan';
import { getSession } from '../../lib/session';

export const dynamic = 'force-dynamic';

export default async function Catalogue({ searchParams }) {
  const sp = await searchParams;
  const orgs = catalogueOrgs(await getSettings());
  const session = await getSession();
  return (
    <>
      {session && (
        <p className="meta" style={{ marginBottom: '.6rem' }}>
          🔒 Les jeux privés (brouillons) n'apparaissent pas dans cette recherche publique.{' '}
          <a href="/prives">Voir les jeux privés</a>
        </p>
      )}
      <CatalogueView sp={sp} orgs={orgs} />
    </>
  );
}
