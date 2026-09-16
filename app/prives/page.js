import { listDeposits } from '../../lib/ckan';
import { getSession, isAdmin } from '../../lib/session';
import { t } from '../../lib/i18n';

// Jeux privés (brouillons) : ils n'apparaissent PAS dans la recherche du catalogue public.
// Cette page les liste pour l'utilisateur connecté (les siens ; tous ceux de l'instance
// pour un admin), avec un lien vers chaque fiche.
export const dynamic = 'force-dynamic';

export default async function Prives() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <h1>{t('prives.title_short')}</h1>
        <p><a className="bouton-admin" href="/api/auth/login">{t('prives.login_cta')}</a> {t('prives.login_after')}</p>
      </div>
    );
  }
  const admin = isAdmin(session);
  const org = process.env.INSTANCE_NAME || 'dataizen';
  const depots = (await listDeposits({ email: session.email, admin, org, adminAll: true })).filter((d) => d.private);

  return (
    <div>
      <h1>{t('prives.title')}</h1>
      <p className="meta">
        {admin ? t('prives.intro_admin') : t('prives.intro_user')}
      </p>
      {depots.length === 0 ? (
        <p className="meta">{t('prives.empty')}</p>
      ) : (
        <ul className="liste-depots">
          {depots.map((d) => (
            <li key={d.name}>
              <a href={`/dataset/${d.name}`}>{d.title}</a>{' '}
              <span className="badge perime">{t('prives.badge_draft')}</span>
              {admin && d.depose_par && <span className="meta">{t('prives.deposited_by', { n: d.depose_par })}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="meta" style={{ marginTop: '1rem' }}>
        <a href="/deposer">{t('prives.new_deposit')}</a> · <a href="/catalogue">{t('prives.public_catalog')}</a>
      </p>
    </div>
  );
}
