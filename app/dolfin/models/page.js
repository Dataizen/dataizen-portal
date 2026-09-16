import { notFound } from 'next/navigation';
import { getSession, isAdmin } from '../../../lib/session';
import DolfinModels from '../../../components/DolfinModels';
import { t } from '../../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function ModelesDolfin() {
  const session = await getSession();
  if (!session || !isAdmin(session)) notFound();  // réservé aux admins d'instance
  return (
    <div>
      <p className="meta"><a href="/catalogue">{t('dolfin.back_catalog')}</a></p>
      <h1>{t('dolfin.models_title')}</h1>
      <p className="meta">{t('dolfin.models_intro')}</p>
      <DolfinModels />
    </div>
  );
}
