// Aperçu cartographique minimal d'un jeu de données, sans habillage du portail,
// destiné à l'intégration en iframe (fiche Directus d'un jeu géo : « visualiser
// l'emprise sans passer par le catalogue »). Réutilise le moteur de cartes du
// portail (CartesLoader monté par le layout racine, mode data-fiche) et l'API
// /api/dataset-carte. La règle globale body:has(.dtz-embed) masque en-tête et
// pied de page ; la carte occupe toute la fenêtre de l'iframe.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Aperçu carte', robots: { index: false } };

export default async function EmbedCarte({ params }) {
  const { name } = await params;
  const slug = String(name || '');
  const valide = /^[a-z0-9_-]{2,100}$/.test(slug);
  return (
    <div className="dtz-embed plein">
      {valide ? (
        <div className="dtz-carte" data-fiche={slug} role="img"
             aria-label="Aperçu cartographique du jeu de données" />
      ) : (
        <p className="meta" style={{ padding: '1rem' }}>Jeu de données invalide.</p>
      )}
    </div>
  );
}
