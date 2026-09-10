import { notFound } from 'next/navigation';
import { getSession, isAdmin } from '../../../lib/session';
import DolfinModels from '../../../components/DolfinModels';

export const dynamic = 'force-dynamic';

export default async function ModelesDolfin() {
  const session = await getSession();
  if (!session || !isAdmin(session)) notFound();  // réservé aux admins d'instance
  return (
    <div>
      <p className="meta"><a href="/catalogue">← Catalogue</a></p>
      <h1>Modèles DOLFIN</h1>
      <p className="meta">Modèles canoniques (pivot / Smart Data Models) proposés lors de
        l'harmonisation d'un jeu. Modèles partagés par toutes les instances. Les modifications
        sont tracées (auteur, date, versions).</p>
      <DolfinModels />
    </div>
  );
}
