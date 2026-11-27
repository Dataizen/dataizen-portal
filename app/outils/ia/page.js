import { notFound, redirect } from 'next/navigation';
import { getSession, isAdmin } from '../../../lib/session';
import GenerationIA from '../../../components/GenerationIA';
import GpuControl from '../../../components/GpuControl';
import { t } from '../../../lib/i18n';

export const dynamic = 'force-dynamic';

// Outil de génération IA, intégré en iframe dans le module « Outils » de Directus.
// Réservé aux admins d'instance (il crée des éléments Directus). Sans session portail
// (cas fréquent : on arrive depuis l'admin Directus), on lance la connexion SSO avec
// retour ici (silencieuse si une session Keycloak existe déjà).
export default async function OutilsIA() {
  const session = await getSession();
  if (!session) redirect('/api/auth/login?returnTo=/outils/ia');
  if (!isAdmin(session)) notFound();
  return (
    <div>
      <h1>{t('ia.title')}</h1>
      <p className="meta">
        {t('ia.intro_before')} <strong>{t('ia.intro_page')}</strong> {t('ia.intro_after')}
      </p>
      <GpuControl />
      <GenerationIA adminUrl={process.env.NEXT_PUBLIC_ADMIN_URL} />
    </div>
  );
}
