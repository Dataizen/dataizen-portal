import { listOrganizations, listLicenses, listDeposits } from '../../lib/ckan';
import { getSession, isAdmin } from '../../lib/session';
import { METADATA_FIELDS } from '../../lib/metadata';
import DepositForm from '../../components/DepositForm';
import { t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function Deposer() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <h1>{t('deposit.title')}</h1>
        <p><a className="bouton-admin" href="/api/auth/login">{t('deposit.login_cta')}</a> {t('deposit.login_after')}</p>
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
      <h1>{t('deposit.title')}</h1>
      <p className="meta">
        {t('deposit.intro_before')} <strong>{t('deposit.intro_draft')}</strong>{t('deposit.intro_after')}{' '}
        {admin ? t('deposit.intro_admin') : t('deposit.intro_user')} {t('deposit.intro_end')}
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
          <h2>{admin ? t('deposit.list_admin') : t('deposit.list_mine')}</h2>
          <ul className="liste-depots">
            {depots.map((d) => (
              <li key={d.name}>
                <a href={`/dataset/${d.name}`}>{d.title}</a>{' '}
                <span className={`badge ${d.private ? 'perime' : ''}`}>
                  {d.private ? t('deposit.badge_draft') : t('deposit.badge_published')}
                </span>
                {admin && d.private && <span className="meta">{t('deposit.to_publish')}</span>}
                {admin && d.depose_par && <span className="meta">{t('deposit.deposited_by', { n: d.depose_par })}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
