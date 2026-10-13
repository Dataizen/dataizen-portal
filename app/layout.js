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
import UsageTracker from '../components/UsageTracker';
import { t, getLang, translate, LANGS } from '../lib/i18n';
import { I18nProvider } from '../components/I18nProvider';
import LangToggle from '../components/LangToggle';
import { cookies } from 'next/headers';

export async function generateMetadata() {
  return { title: t('meta.title'), description: t('meta.description') };
}

function SessionLinks({ session, lang }) {
  const tr = (k, v) => translate(lang, k, v);
  if (!session) return <a href="/api/auth/login">{tr('nav.login')}</a>;
  return (
    <>
      {isAdmin(session) && process.env.NEXT_PUBLIC_ADMIN_URL && (
        <>
          <a href={process.env.NEXT_PUBLIC_ADMIN_URL}>{tr('nav.admin')}</a> ·{' '}
        </>
      )}
      <a href="/deposer">{tr('nav.deposit')}</a> · {session.email} ·{' '}
      <a href="/api/auth/logout">{tr('nav.logout')}</a>
    </>
  );
}

// Habillage DSFR (thème "dsfr") : en-tête, navigation et pied de page du
// système de design de l'État, servis en local (aucun CDN). L'usage du DSFR
// est réservé aux services de l'État : voir docs/ACCESSIBILITE.md.
function DsfrChrome({ site, logo, navPages, session, children, footer, footerPages, lang, base }) {
  const tr = (k, v) => translate(lang, k, v);
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
                  <a href="/" title={tr('nav.homeTitle', { site })}>
                    <p className="fr-header__service-title">{site}</p>
                  </a>
                </div>
              </div>
              <div className="fr-header__tools">
                <div className="fr-header__tools-links session">
                  <SessionLinks session={session} lang={lang} />
                  <LangToggle current={lang} base={base} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="fr-header__menu">
          <div className="fr-container">
            <nav className="fr-nav" role="navigation" aria-label={tr('a11y.mainNav')}>
              <ul className="fr-nav__list">
                {navEntries(navPages, { actualites: true, lang }).map((e) => (
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
      <SiteFooter links={footerPages} text={footer} dsfr lang={lang} />
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
  // Langue de l'instance (PORTAL_LANG) ; surchargée par le cookie `dtz_lang` (bouton
  // de langue de l'interface, voir LangToggle) pour l'anglais sur toutes les instances.
  const base = getLang();
  const jar = await cookies();
  const ckLang = jar.get('dtz_lang')?.value;
  const lang = ckLang && LANGS.includes(ckLang) ? ckLang : base;
  const footer = settings?.site_description || translate(lang, 'footer.default', { site });

  return (
    <html lang={lang}>
      <body className={dsfr ? 'dsfr' : ''}>
        <I18nProvider lang={lang}>
        {/* autodécouverte DCAT-AP : les moissonneurs (data.gouv.fr…) suivent ce lien */}
        <link rel="alternate" type="application/rdf+xml" title="Catalogue DCAT" href={`${CKAN_PUBLIC}/catalog.xml`} />
        {dsfr && <link rel="stylesheet" precedence="default" href="/dsfr/dsfr.min.css" />}
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <a className="acces-rapide" href="#contenu">{translate(lang, 'a11y.skip')}</a>
        {dsfr ? (
          <DsfrChrome site={site} logo={logo} navPages={navPages} session={session} footer={footer} footerPages={footerPages} lang={lang} base={base}>
            {children}
          </DsfrChrome>
        ) : (
          <>
            <header className="site dtz-sticky" role="banner">
              <a className="logo" href="/">
                {logo && <img className="logo-img" src={logo} alt="" />}
                {site}
              </a>
              <Nav navPages={navPages} actualites={aDesActualites} lang={lang} />
              <span className="session"><SessionLinks session={session} lang={lang} /><LangToggle current={lang} base={base} /></span>
            </header>
            <main id="contenu" role="main">{children}</main>
            <SiteFooter links={footerPages} text={footer} lang={lang} />
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
        <UsageTracker />
        <CookieConsent />
        {settings?.custom_js && (
          <script dangerouslySetInnerHTML={{ __html: settings.custom_js }} />
        )}
        </I18nProvider>
      </body>
    </html>
  );
}
