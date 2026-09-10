import './globals.css';
import { getNavPages, getFooterPages, getSettings, getActualites } from '../lib/directus';
import { getSession, isAdmin } from '../lib/session';
import { themeCss, logoUrl } from '../lib/themes';
import { CKAN_PUBLIC } from '../lib/ckan';
import Nav, { navEntries } from '../components/Nav';
import CartesLoader from '../components/CartesLoader';
import Reveal from '../components/Reveal';
import MenuA11y from '../components/MenuA11y';
import EmbedTools from '../components/EmbedTools';
import CookieConsent from '../components/CookieConsent';
import SiteFooter from '../components/SiteFooter';
import ChartsLoader from '../components/ChartsLoader';
import FiltreLoader from '../components/FiltreLoader';
import RapportLoader from '../components/RapportLoader';
import BlockInserter from '../components/BlockInserter';
import TerritoireDashboard from '../components/TerritoireDashboard';
import RechercheIndicateur from '../components/RechercheIndicateur';
import VisualEditing from '../components/VisualEditing';
import Assistant from '../components/Assistant';
import GpuStatus from '../components/GpuStatus';

export const metadata = {
  title: 'Dataizen : données territoriales',
  description: 'Catalogue de données territoriales ouvert, souverain et open source.',
};

function SessionLinks({ session }) {
  if (!session) return <a href="/api/auth/login">Connexion</a>;
  return (
    <>
      {isAdmin(session) && process.env.NEXT_PUBLIC_ADMIN_URL && (
        <>
          <a href={process.env.NEXT_PUBLIC_ADMIN_URL}>⚙️ Administration</a> ·{' '}
        </>
      )}
      <a href="/deposer">Déposer une donnée</a> · {session.email} ·{' '}
      <a href="/api/auth/logout">Déconnexion</a>
    </>
  );
}

// Habillage DSFR (thème "dsfr") : en-tête, navigation et pied de page du
// système de design de l'État, servis en local (aucun CDN). L'usage du DSFR
// est réservé aux services de l'État : voir docs/ACCESSIBILITE.md.
function DsfrChrome({ site, logo, navPages, session, children, footer, footerPages }) {
  return (
    <>
      <header role="banner" className="fr-header dtz-sticky">
        <div className="fr-header__body">
          <div className="fr-container">
            <div className="fr-header__body-row">
              <div className="fr-header__brand fr-enlarge-link">
                <div className="fr-header__brand-top">
                  {logo ? (
                    <div className="fr-header__logo"><img className="logo-img" src={logo} alt="" /></div>
                  ) : (
                    <div className="fr-header__logo">
                      <p className="fr-logo">République<br />Française</p>
                    </div>
                  )}
                </div>
                <div className="fr-header__service">
                  <a href="/" title={`Accueil : ${site}`}>
                    <p className="fr-header__service-title">{site}</p>
                  </a>
                </div>
              </div>
              <div className="fr-header__tools">
                <div className="fr-header__tools-links session">
                  <SessionLinks session={session} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="fr-header__menu">
          <div className="fr-container">
            <nav className="fr-nav" role="navigation" aria-label="Navigation principale">
              <ul className="fr-nav__list">
                {navEntries(navPages, { actualites: true }).map((e) => (
                  <li className="fr-nav__item" key={e.href}>
                    <a className="fr-nav__link" href={e.href}>{e.title}</a>
                    {e.children?.length > 0 && (
                      <ul className="sous-menu">
                        {e.children.map((c) => (
                          <li key={c.href}><a className="fr-nav__link" href={c.href}>{c.title}</a></li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </header>
      <main id="contenu" role="main" className="fr-container fr-my-4w">{children}</main>
      <SiteFooter links={footerPages} text={footer} dsfr />
    </>
  );
}

export default async function RootLayout({ children }) {
  const settings = await getSettings();
  const session = await getSession();
  const estAdmin = isAdmin(session);
  const navPages = await getNavPages(estAdmin);
  const footerPages = await getFooterPages(estAdmin);
  const aDesActualites = (await getActualites(1)).length > 0;
  const site = settings?.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'Dataizen';
  const css = themeCss(settings);
  const logo = logoUrl(settings);
  const dsfr = settings?.theme_preset === 'dsfr';
  const footer = settings?.site_description ||
    `${site} : plateforme de données territoriales, open source et hébergée souverainement.`;

  return (
    <html lang="fr">
      <body className={dsfr ? 'dsfr' : ''}>
        {/* autodécouverte DCAT-AP : les moissonneurs (data.gouv.fr…) suivent ce lien */}
        <link rel="alternate" type="application/rdf+xml" title="Catalogue DCAT" href={`${CKAN_PUBLIC}/catalog.xml`} />
        {dsfr && <link rel="stylesheet" precedence="default" href="/dsfr/dsfr.min.css" />}
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <a className="acces-rapide" href="#contenu">Aller au contenu</a>
        {dsfr ? (
          <DsfrChrome site={site} logo={logo} navPages={navPages} session={session} footer={footer} footerPages={footerPages}>
            {children}
          </DsfrChrome>
        ) : (
          <>
            <header className="site dtz-sticky" role="banner">
              <a className="logo" href="/">
                {logo && <img className="logo-img" src={logo} alt="" />}
                {site}
              </a>
              <Nav navPages={navPages} actualites={aDesActualites} />
              <span className="session"><SessionLinks session={session} /></span>
            </header>
            <main id="contenu" role="main">{children}</main>
            <SiteFooter links={footerPages} text={footer} />
          </>
        )}
        <CartesLoader />
        <ChartsLoader />
        <FiltreLoader />
        <RapportLoader />
        <BlockInserter adminUrl={process.env.NEXT_PUBLIC_ADMIN_URL} />
        <TerritoireDashboard />
        <RechercheIndicateur />
        <VisualEditing directusUrl={process.env.NEXT_PUBLIC_ADMIN_URL} />
        <Reveal />
        <MenuA11y />
        <EmbedTools />
        <Assistant />
        <GpuStatus />
        <CookieConsent />
        {settings?.custom_js && (
          <script dangerouslySetInnerHTML={{ __html: settings.custom_js }} />
        )}
      </body>
    </html>
  );
}
