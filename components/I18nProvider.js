'use client';
// Fournit la langue de l'instance aux composants CLIENT (alimentée côté serveur dans le
// layout). useT() renvoie une fonction de traduction ; useLang() la langue courante.
import { createContext, useContext } from 'react';
import { translate, DEFAULT_LANG } from '../lib/i18n';

const LangCtx = createContext(DEFAULT_LANG);

export function I18nProvider({ lang, children }) {
  return <LangCtx.Provider value={lang || DEFAULT_LANG}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function useT() {
  const lang = useContext(LangCtx);
  return (key, vars) => translate(lang, key, vars);
}
