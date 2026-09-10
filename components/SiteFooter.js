// Pied de page réutilisable (toutes instances) : un menu de liens alimenté par
// Directus (pages marquées « afficher dans le pied de page ») + une ligne de
// mentions. S'adapte à l'habillage courant (DSFR ou thème standard).

function Liens({ links, className }) {
  if (!links?.length) return null;
  return (
    <nav className={className} aria-label="Liens de pied de page">
      <ul>
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} {...(l.externe ? { target: '_blank', rel: 'noopener' } : {})}>{l.title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function SiteFooter({ links = [], text, dsfr = false }) {
  if (dsfr) {
    return (
      <footer className="fr-footer" role="contentinfo">
        <div className="fr-container">
          <Liens links={links} className="footer-menu" />
          <div className="fr-footer__bottom">
            <div className="fr-footer__bottom-copy"><p>{text}</p></div>
          </div>
        </div>
      </footer>
    );
  }
  return (
    <footer className="site" role="contentinfo">
      <Liens links={links} className="footer-menu" />
      <p className="footer-copy">{text}</p>
    </footer>
  );
}
