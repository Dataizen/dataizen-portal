// Aperçu d'un graphique construit dans Directus (collection graphiques), sans
// habillage du portail, pour intégration en iframe dans la fiche Directus du
// graphique. Réutilise le moteur de graphiques (ChartsLoader, data-config,
// API /api/graphique). Flux défilable : la table de données peut être haute.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Aperçu graphique', robots: { index: false } };

export default async function EmbedGraphique({ params }) {
  const { id } = await params;
  const gid = String(id || '');
  const valide = /^\d+$/.test(gid);
  return (
    <div className="dtz-embed flux">
      {valide ? (
        <div className="dtz-graphique" data-config={gid} />
      ) : (
        <p className="meta" style={{ padding: '1rem' }}>Graphique invalide.</p>
      )}
    </div>
  );
}
