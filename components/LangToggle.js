'use client';
// Bouton de langue de l'INTERFACE (chrome du portail), sur toutes les instances.
// Bascule entre la langue de l'instance (PORTAL_LANG) et l'anglais via un cookie
// `dtz_lang` lu côté serveur dans le layout (rechargement pour réappliquer le SSR).
// Ne traduit que l'interface : le contenu éditorial et les métadonnées des jeux
// restent dans leur langue de saisie.
const LABELS = { fr: 'Français', en: 'English', pt: 'Português', da: 'Dansk' };

export default function LangToggle({ current, base }) {
  // Rien à basculer si l'instance est déjà en anglais.
  if (!base || base === 'en') return null;
  const target = current === 'en' ? base : 'en';
  const set = () => {
    try {
      document.cookie = `dtz_lang=${target}; path=/; max-age=31536000; samesite=lax`;
    } catch { /* cookies indisponibles */ }
    location.reload();
  };
  return (
    <button type="button" className="lang-toggle navlink" onClick={set}
            lang={target} title={LABELS[target]}
            aria-label={`Interface: ${LABELS[target]}`}>
      {target.toUpperCase()}
    </button>
  );
}
