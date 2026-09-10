// Thèmes prêts à l'emploi et polices du portail, choisis dans Directus
// (Réglages du portail). Aucune ressource externe : palettes en dur, polices
// en piles système (souveraineté : rien n'est chargé depuis un CDN).

export const PRESETS = {
  dataizen: {},
  ardoise: { '--bleu': '#2d3b4e', '--bleu-clair': '#51678a', '--fond': '#f4f6f8' },
  foret: { '--bleu': '#1e5e40', '--bleu-clair': '#2f8a61', '--fond': '#f4f8f5' },
  terre: { '--bleu': '#7c4a1e', '--bleu-clair': '#a86b3c', '--fond': '#faf7f2' },
  bordeaux: { '--bleu': '#6e1e33', '--bleu-clair': '#96324e', '--fond': '#faf5f6' },
  // Palette du système de design de l'État (bleu France, fond neutre).
  // Une intégration DSFR complète (composants, police Marianne) est au backlog.
  dsfr: { '--bleu': '#000091', '--bleu-clair': '#1212ff', '--fond': '#f6f6f6' },
};

// Modèles de design complets (tendances 2026), applicables aux sites
// d'observatoires et de collectivités : palette + habillage CSS entier.
// Choisis dans Directus (Réglages du portail -> Thème) comme les palettes.
export const MODELES = {
  // Néo-brutalisme 2026 (inspiration kristi.digital) : crème, encre noire,
  // bordures franches, ombres dures décalées, accents joyeux.
  brutal: {
    vars: {
      '--bleu': '#111111', '--bleu-clair': '#3a3a3a', '--fond': '#f6f1e7',
      '--bordure': '#111111', '--texte': '#111111', '--texte-2': '#4a4a44',
    },
    css: `
      body { background: var(--fond); }
      h1, h2, h3 { text-transform: uppercase; letter-spacing: -0.02em; font-weight: 800; }
      header.site { background: var(--fond); border-bottom: 3px solid #111; box-shadow: none; }
      header.site .logo, header.site nav a, header.site .session, header.site .session a { color: #111; }
      header.site nav a:hover, header.site nav a:focus-visible { background: #f2c14e; color: #111; }
      header.site nav a[aria-current="page"] { background: #f2c14e; color: #111; box-shadow: none; border: 2px solid #111; }
      .sous-menu { border: 2px solid #111; box-shadow: 5px 5px 0 #111; border-radius: 10px; }
      .hero { background: #f2c14e; color: #111; border: 3px solid #111; box-shadow: 8px 8px 0 #111; border-radius: 14px; }
      .hero h1 { color: #111; font-size: 2.7rem; }
      .hero a { color: #111; }
      .carte, .chiffre, .stat { border: 2px solid #111 !important; border-radius: 12px; box-shadow: 5px 5px 0 #111; }
      .carte.vitrine:hover, .chiffre:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0 #111; }
      .chiffre strong { color: #111; }
      .chiffre:nth-child(3n+1) { background: #f4a6c6; } .chiffre:nth-child(3n+2) { background: #8fd8c2; }
      .chiffre:nth-child(3n) { background: #f2c14e; }
      .badge, .badge.theme { background: #fff; border: 2px solid #111; color: #111; border-radius: 999px; }
      .recherche button, .bouton-admin { background: #f2c14e; color: #111; border: 2px solid #111; border-radius: 999px; box-shadow: 3px 3px 0 #111; font-weight: 700; }
      .recherche button:hover, .bouton-admin:hover { background: #111; color: #f2c14e; }
      .recherche input, .edition input, .edition select, .edition textarea { border: 2px solid #111; border-radius: 10px; }
      .banniere h1 { text-shadow: none; }
      footer.site { border-top: 3px solid #111; color: #111; }
      .dtz-carte { border: 2px solid #111; box-shadow: 5px 5px 0 #111; }
      iframe.evidence { border: 2px solid #111; }
      .embed__btn { border: 2px solid #111; border-radius: 0; font-weight: 700; }
    `,
  },
  // Éditorial 2026 : blanc cassé, titres serif, filets fins, terracotta.
  editorial: {
    vars: {
      '--bleu': '#1a1a18', '--bleu-clair': '#b4552d', '--fond': '#faf9f6',
      '--bordure': '#e3e0d8', '--texte': '#1a1a18', '--texte-2': '#6b675e',
    },
    css: `
      h1, h2, h3, .chiffre strong, .hero h1 { font-family: Georgia, 'Times New Roman', serif; font-weight: 600; letter-spacing: 0; }
      header.site { background: var(--fond); border-bottom: 1px solid #1a1a18; box-shadow: none; }
      header.site .logo, header.site nav a, header.site .session, header.site .session a { color: #1a1a18; }
      header.site nav a:hover, header.site nav a:focus-visible { background: transparent; color: #b4552d; text-decoration: underline; }
      .hero { background: var(--fond); color: #1a1a18; border: 0; border-top: 4px solid #1a1a18; border-bottom: 1px solid #1a1a18; border-radius: 0; padding: 3.4rem 0.5rem; }
      .hero h1 { color: #1a1a18; font-size: 3rem; font-style: italic; }
      .hero a { color: #b4552d; }
      .carte, .chiffre { border: 0; border-top: 1px solid #1a1a18; border-radius: 0; box-shadow: none; background: transparent; }
      .carte.vitrine:hover { transform: none; box-shadow: none; background: #f2efe8; }
      .chiffre { text-align: left; } .chiffre strong { font-size: 2.6rem; color: #b4552d; }
      .badge, .badge.theme { background: transparent; border: 1px solid #1a1a18; color: #1a1a18; border-radius: 0; }
      .recherche button, .bouton-admin { background: #1a1a18; color: #faf9f6; border-radius: 0; border: 1px solid #1a1a18; }
      a { color: #b4552d; text-decoration: underline; text-underline-offset: 3px; }
      header.site nav a, .carte.vitrine, .badge { text-decoration: none; }
      footer.site { border-top: 1px solid #1a1a18; }
    `,
  },
  // Verre 2026 : profondeur douce, translucidités, indigo.
  verre: {
    vars: {
      '--bleu': '#4f46e5', '--bleu-clair': '#818cf8', '--fond': '#eef0fb',
      '--bordure': '#dcdff5', '--texte': '#1e1b4b', '--texte-2': '#5b5a80',
    },
    css: `
      body { background: linear-gradient(160deg, #eef0fb 0%, #fdf1f7 55%, #eafaf3 100%) fixed; }
      header.site { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.7); box-shadow: 0 2px 16px rgba(79, 70, 229, 0.08); }
      header.site .logo, header.site nav a, header.site .session, header.site .session a { color: #1e1b4b; }
      header.site nav a:hover, header.site nav a:focus-visible { background: rgba(79, 70, 229, 0.12); color: #4f46e5; }
      .hero { background: linear-gradient(120deg, rgba(79,70,229,0.92), rgba(129,140,248,0.85)); border-radius: 22px; box-shadow: 0 18px 45px rgba(79, 70, 229, 0.25); }
      .carte, .chiffre { background: rgba(255, 255, 255, 0.62); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.8); border-radius: 18px; box-shadow: 0 8px 28px rgba(30, 27, 75, 0.08); }
      .carte.vitrine:hover, .chiffre:hover { box-shadow: 0 16px 40px rgba(79, 70, 229, 0.18); }
      .badge, .badge.theme { background: rgba(79, 70, 229, 0.1); color: #4f46e5; border-radius: 999px; }
      .recherche button, .bouton-admin { background: #4f46e5; border-color: #4f46e5; border-radius: 999px; color: #fff; }
      .recherche input { border-radius: 999px; background: rgba(255,255,255,0.75); }
      table.donnees, table { background: rgba(255,255,255,0.7); }
    `,
  },
  // Civique 2026 : bento institutionnel vif, lisible, très structuré.
  civic: {
    vars: {
      '--bleu': '#1d4ed8', '--bleu-clair': '#0ea5e9', '--fond': '#f4f6f9',
      '--bordure': '#dbe2ec', '--texte': '#0b1220', '--texte-2': '#51607a',
    },
    css: `
      .hero { background: linear-gradient(115deg, #1d4ed8 0%, #0ea5e9 90%); border-radius: 20px; }
      .hero h1 { font-size: 2.6rem; }
      .carte, .chiffre { border-radius: 16px; border: 1px solid var(--bordure); }
      .chiffre { border-top: 5px solid #0ea5e9; }
      .chiffre:nth-child(even) { border-top-color: #1d4ed8; }
      .chiffre strong { background: linear-gradient(115deg, #1d4ed8, #0ea5e9); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .badge, .badge.theme { background: #e0edff; color: #1d4ed8; border-radius: 999px; font-weight: 600; }
      .carte.vitrine.thematique { border-top-width: 6px; }
      .recherche button, .bouton-admin { border-radius: 10px; font-weight: 600; }
      header.site nav a.actif { background: rgba(255,255,255,0.15); }
    `,
  },
  // Observatoire régional (inspiration OFER BFC) : en-tête blanc à logos,
  // barre de navigation ardoise à droite avec accents or, hero photo en
  // surimpression, filets or. Réutilisable pour les observatoires de région.
  oferbfc: {
    vars: {
      '--bleu': '#4a5a66', '--bleu-clair': '#e0a200', '--fond': '#ffffff',
      '--bordure': '#e3e0d8', '--texte': '#3c3b3b', '--texte-2': '#6b675e',
    },
    css: `
      /* en-tête blanc : logos à gauche, barre ardoise (nav) à droite */
      header.site { background: #fff; color: #3c3b3b; box-shadow: 0 1px 0 #e3e0d8; padding: 0.6rem 1.5rem; }
      header.site .logo { color: #3c3b3b; }
      header.site .logo .logo-img { max-height: 52px; width: auto; }
      header.site nav ul.menu { background: #4a5a66; border-radius: 6px; padding: 0.15rem; }
      header.site nav a { color: #eef1f4; }
      header.site nav a:hover, header.site nav a:focus-visible { background: #e0a200; color: #2b333a; }
      header.site nav a[aria-current="page"] { box-shadow: inset 0 -3px 0 #e0a200; color: #fff; }
      /* barre utilitaire (Connexion / Déposer / …) en pastille or */
      header.site .session { color: #6b675e; }
      header.site .session a { color: #8a6d00; font-weight: 600; }
      .sous-menu { border-color: #e3e0d8; box-shadow: 0 8px 22px rgba(60,59,59,0.14); }
      .sous-menu a:hover, .sous-menu a:focus-visible { background: #fbf3dd; color: #4a5a66; }
      /* page courante dans un sous-menu (fond blanc) : texte ardoise lisible,
         sinon la règle de nav (texte blanc) le rendrait blanc sur blanc */
      header.site .sous-menu a[aria-current="page"] { color: #4a5a66; background: #fbf3dd; box-shadow: none; }
      /* hero plein cadre, titre blanc capitales en surimpression (photo posée
         par la couche via custom_css : .hero { background-image: url(...) }) */
      .hero { background: #4a5a66; color: #fff; border-radius: 0; padding: 4.5rem 2rem; position: relative;
        background-size: cover; background-position: center; }
      .hero::before { content: ""; position: absolute; inset: 0; background: rgba(38,46,53,0.45); }
      .hero-corps { position: relative; z-index: 1; }
      .hero h1 { color: #fff; text-transform: uppercase; font-weight: 800; letter-spacing: -0.01em;
        font-size: 2.4rem; text-shadow: 0 2px 10px rgba(0,0,0,0.35); }
      /* encart Atlas : carte blanche opaque, texte ardoise lisible (le color:#fff
         du hero le rendait blanc sur blanc), lien souligné en or */
      .hero-encart { background: #fff; color: #2b333a; }
      .hero-encart span { color: #2b333a; text-decoration: underline; text-decoration-color: #e0a200; }
      .hero-encart:hover span { text-decoration-thickness: 2px; }
      /* filets or sur les titres de section et cartes-vitrines */
      main h2 { border-left: 5px solid #e0a200; padding-left: 0.6rem; }
      .carte.vitrine.thematique { border-top: 4px solid #e0a200; }
      .chiffre strong { color: #4a5a66; }
      .recherche button, .bouton-admin { background: #4a5a66; color: #fff; border-color: #4a5a66; border-radius: 4px; font-weight: 700; }
      .recherche button:hover, .bouton-admin:hover { background: #e0a200; color: #2b333a; border-color: #e0a200; }
      /* bouton admin secondaire : contour ardoise sur fond blanc (sinon texte gris
         sur fond ardoise = illisible une fois connecté) */
      .bouton-admin.secondaire { background: #fff; color: #4a5a66; border-color: #4a5a66; }
      .bouton-admin.secondaire:hover { background: #e0a200; color: #2b333a; border-color: #e0a200; }
      .badge, .badge.theme { background: #fbf3dd; color: #8a6d00; }
      .dtz-cookies { background: #1f6bb0; }
      .dtz-cookies-accepter { color: #1f6bb0; }
    `,
  },
};

export const FONTS = {
  systeme: '',
  classique: "Georgia, 'Times New Roman', serif",
  humaniste: "Seravek, 'Trebuchet MS', Verdana, sans-serif",
  marianne: "Marianne, 'Helvetica Neue', Arial, sans-serif",
};

// Réglages Directus -> CSS injecté (les couleurs explicites priment sur le preset)
export function themeCss(settings) {
  const modele = MODELES[settings?.theme_preset];
  const vars = { ...(modele?.vars || PRESETS[settings?.theme_preset] || {}) };
  if (settings?.primary_color) vars['--bleu'] = settings.primary_color;
  if (settings?.secondary_color) vars['--bleu-clair'] = settings.secondary_color;
  const font = FONTS[settings?.font_family];
  let css = '';
  const entries = Object.entries(vars);
  if (entries.length) {
    css += `:root { ${entries.map(([k, v]) => `${k}: ${v};`).join(' ')} }\n`;
  }
  if (modele?.css) css += modele.css + '\n';
  if (font) css += `body { font-family: ${font}; }\n`;
  if (settings?.custom_css) css += settings.custom_css;
  return css;
}

// Logo : fichier uploadé dans Directus (servi par /assets) ou URL externe
export function logoUrl(settings) {
  if (settings?.logo) {
    const admin = process.env.NEXT_PUBLIC_ADMIN_URL || '';
    return admin ? `${admin}/assets/${settings.logo}` : '';
  }
  return settings?.logo_url || '';
}

// URL d'un fichier Directus (image d'actualité, bannière de page…)
export function assetUrl(uuid) {
  const admin = process.env.NEXT_PUBLIC_ADMIN_URL || '';
  return uuid && admin ? `${admin}/assets/${uuid}` : '';
}
