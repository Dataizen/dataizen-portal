import { notFound, redirect } from 'next/navigation';
import { getSession, isAdmin } from '../../../lib/session';
import GenerationIA from '../../../components/GenerationIA';
import GpuControl from '../../../components/GpuControl';

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
      <h1>Génération assistée par IA</h1>
      <p className="meta">
        Créez un graphique, une carte, un tableau de bord ou une page complète à partir de vos
        données, en langage naturel. Une <strong>page</strong> générée est créée en brouillon
        (à vérifier puis publier dans Directus) ; les graphiques et cartes, eux, sont publiés
        pour être visibles immédiatement, y compris dans l'aperçu.
      </p>
      <GpuControl />
      <GenerationIA adminUrl={process.env.NEXT_PUBLIC_ADMIN_URL} />
    </div>
  );
}
