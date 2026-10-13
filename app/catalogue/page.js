import CatalogueView from '../../components/CatalogueView';
import { getSettings } from '../../lib/directus';
import { catalogueOrgs } from '../../lib/ckan';
import { getSession } from '../../lib/session';
import { getLang, translate, LANGS } from '../../lib/i18n';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function Catalogue({ searchParams }) {
  const sp = await searchParams;
  const orgs = catalogueOrgs(await getSettings());
  const session = await getSession();
  // langue de l'interface : cookie dtz_lang (bouton EN) sinon langue de l'instance
  const ck = (await cookies()).get('dtz_lang')?.value;
  const lang = ck && LANGS.includes(ck) ? ck : getLang();
  const t = (k, v) => translate(lang, k, v);
  return (
    <>
      {session && (
        <p className="meta" style={{ marginBottom: '.6rem' }}>
          {t('catalogue.privateHidden')}{' '}
          <a href="/prives">{t('catalogue.viewPrivate')}</a>
        </p>
      )}
      <CatalogueView sp={sp} orgs={orgs} lang={lang} />
    </>
  );
}
