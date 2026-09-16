import CatalogueView from '../../components/CatalogueView';
import { getSettings } from '../../lib/directus';
import { catalogueOrgs } from '../../lib/ckan';
import { getSession } from '../../lib/session';
import { t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function Catalogue({ searchParams }) {
  const sp = await searchParams;
  const orgs = catalogueOrgs(await getSettings());
  const session = await getSession();
  return (
    <>
      {session && (
        <p className="meta" style={{ marginBottom: '.6rem' }}>
          {t('catalogue.privateHidden')}{' '}
          <a href="/prives">{t('catalogue.viewPrivate')}</a>
        </p>
      )}
      <CatalogueView sp={sp} orgs={orgs} />
    </>
  );
}
