// Navigation principale : liens système + pages Directus (avec sous-menus via
// la page parente). Sous-menus en CSS pur (:hover et :focus-within), donc
// utilisables au clavier (RGAA 12) ; aucun JS requis.

export function navEntries(navPages, options = {}) {
  // Ordre éditorial : les pages Directus (triées) d'abord, les actualités si
  // elles existent, le catalogue en dernier. Organisations et réutilisations
  // restent accessibles par leurs URLs mais sortent du menu (décision 25/07).
  // une page peut porter un lien externe (lien_externe) : l'entrée de menu pointe
  // alors vers cette URL (nouvel onglet) au lieu de /pages/<slug>.
  const lien = (p) => p.lien_externe || `/pages/${p.slug}`;
  const externe = (p) => !!p.lien_externe && /^https?:\/\//.test(p.lien_externe);
  const entries = navPages.map((p) => ({
    title: p.title,
    href: lien(p),
    externe: externe(p),
    children: (p.children || []).map((c) => ({ title: c.title, href: lien(c), externe: externe(c) })),
  }));
  if (options.actualites) entries.push({ title: 'Actualités', href: '/actualites' });
  entries.push({ title: 'Catalogue', href: '/catalogue' });
  return entries;
}

export default function Nav({ navPages, actualites = false }) {
  return (
    <nav aria-label="Navigation principale">
      <ul className="menu">
        {navEntries(navPages, { actualites }).map((e) => (
          <li key={e.href} className={e.children?.length ? 'a-sous-menu' : ''}>
            <a href={e.href} {...(e.externe ? { target: '_blank', rel: 'noopener' } : {})}>{e.title}</a>
            {e.children?.length > 0 && (
              <ul className="sous-menu">
                {e.children.map((c) => (
                  <li key={c.href}>
                    <a href={c.href} {...(c.externe ? { target: '_blank', rel: 'noopener' } : {})}>{c.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
