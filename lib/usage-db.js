// Écriture des événements d'usage dans le store dédié (base `usage`, hors CMS).
// Découple l'analytics de fréquentation de Directus/Payload : le portail insère
// directement dans la table `events` (instance en colonne), via un rôle qui n'a
// QUE le droit d'insérer. Activé uniquement si USAGE_DATABASE_URI est défini
// (sinon on retombe sur le comportement historique côté /api/track).
//
// Pool pg singleton (partagé entre requêtes). Toute erreur est silencieuse : le
// suivi ne doit jamais casser la navigation. Aucune donnée personnelle n'est
// stockée (ni IP, ni identifiant, ni cookie).
import pg from 'pg';

const URI = process.env.USAGE_DATABASE_URI || '';
const INSTANCE = process.env.INSTANCE_NAME || process.env.NEXT_PUBLIC_INSTANCE || '';

let pool = null;
function getPool() {
  if (!URI) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: URI,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      allowExitOnIdle: true,
    });
    // Ne jamais crasher le process sur une erreur de connexion inactive.
    pool.on('error', () => {});
  }
  return pool;
}

export const usageEnabled = () => !!URI;

// Insère un événement. Renvoie false silencieusement en cas d'échec.
export async function recordEvent({ type, chemin, ref }) {
  const p = getPool();
  if (!p) return false;
  try {
    await p.query(
      'INSERT INTO events (instance, type, chemin, ref) VALUES ($1, $2, $3, $4)',
      [INSTANCE, type, chemin, ref || null],
    );
    return true;
  } catch {
    return false;
  }
}
