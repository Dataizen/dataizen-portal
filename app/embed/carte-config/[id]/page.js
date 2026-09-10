// Aperçu d'une carte construite dans Directus (collection cartes), sans habillage
// du portail, pour intégration en iframe dans la fiche Directus de la carte.
// Réutilise le moteur de cartes (CartesLoader, mode data-config, API /api/carte-config).
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Aperçu carte', robots: { index: false } };

export default async function EmbedCarteConfig({ params }) {
  const { id } = await params;
  const cid = String(id || '');
  const valide = /^\d+$/.test(cid);
  return (
    <div className="dtz-embed plein">
      {valide ? (
        <div className="dtz-carte" data-config={cid} role="img"
             aria-label="Aperçu de la carte" />
      ) : (
        <p className="meta" style={{ padding: '1rem' }}>Carte invalide.</p>
      )}
    </div>
  );
}
