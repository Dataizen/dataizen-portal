// i18n MONO-LANGUE par instance : la langue est fixée par la variable d'env PORTAL_LANG
// (défaut 'fr'), lue côté SERVEUR au runtime (image portail partagée entre instances, comme
// NEXT_PUBLIC_BASE_URL). Le contenu éditorial (pages, actualités) est saisi par instance dans
// sa langue ; ce module ne traduit que le « chrome » du portail.
//
// - Composants SERVEUR : import { t } et t('cle', {var}).
// - Composants CLIENT  : useT() depuis components/I18nProvider (la langue vient d'un provider
//   alimenté côté serveur, car process.env.PORTAL_LANG n'existe pas dans le bundle client).
//
// fr.json est la RÉFÉRENCE des clés : une clé absente de la langue cible retombe sur le
// français, puis sur la clé elle-même.
import fr from './messages/fr.json';
import pt from './messages/pt.json';
import en from './messages/en.json';

const DICTS = { fr, pt, en };
export const DEFAULT_LANG = 'fr';
export const LANGS = Object.keys(DICTS);

export function getLang() {
  const l = (process.env.PORTAL_LANG || DEFAULT_LANG).toLowerCase();
  return DICTS[l] ? l : DEFAULT_LANG;
}

export function translate(lang, key, vars) {
  const d = DICTS[lang] || DICTS[DEFAULT_LANG];
  let s = d && key in d ? d[key] : key in fr ? fr[key] : key;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

// Composants SERVEUR uniquement (lit PORTAL_LANG au runtime).
export function t(key, vars) {
  return translate(getLang(), key, vars);
}
