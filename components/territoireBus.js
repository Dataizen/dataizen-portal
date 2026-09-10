// Bus de sélection territoriale partagé entre les composants du portail.
// Le tableau de bord (carte-sélecteur) émet la sélection courante ; les
// graphiques réactifs et tout autre composant s'y abonnent, ce qui permet
// qu'« un clic sur un territoire impacte tout ce qui est affiché dessous ».
// Générique et réutilisable sur n'importe quelle instance.
//
// Forme de la sélection : { niveau, code, nom } ou null (= ensemble régional).
const EVT = 'dtz:territoire';

export function getSelection() {
  return (typeof window !== 'undefined' && window.__dtzTerr) || null;
}

export function setSelection(sel) {
  if (typeof window === 'undefined') return;
  window.__dtzTerr = sel || null;
  window.dispatchEvent(new CustomEvent(EVT, { detail: window.__dtzTerr }));
}

export function onSelection(cb) {
  if (typeof window === 'undefined') return () => {};
  const h = (e) => cb(e.detail);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}

// Canal « indicateur » : un bloc Recherche d'indicateur émet l'indicateur choisi
// { tb, colonne } ; le tableau de bord correspondant (même id) l'affiche sur la
// carte. Générique, sans couplage direct entre les deux blocs.
const EVT_IND = 'dtz:indicateur';

export function setIndicateur(sel) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVT_IND, { detail: sel || null }));
}

export function onIndicateur(cb) {
  if (typeof window === 'undefined') return () => {};
  const h = (e) => cb(e.detail);
  window.addEventListener(EVT_IND, h);
  return () => window.removeEventListener(EVT_IND, h);
}

// Canal « filtre global de page » : un bloc Filtre (menu déroulant) émet une
// sélection générique { field, value } (ou null = tout) ; les graphiques, la carte
// et tout composant abonné filtrent leurs données par cette colonne/valeur. Permet
// « un seul contrôle qui filtre tout ce qui est affiché sur la page ». Générique et
// réutilisable, indépendant du canal territoire (qui reste dédié aux tableaux de bord).
const EVT_F = 'dtz:filtre';

export function getFiltre() {
  return (typeof window !== 'undefined' && window.__dtzFiltre) || null;
}

export function setFiltre(sel) {
  if (typeof window === 'undefined') return;
  window.__dtzFiltre = (sel && sel.field && sel.value !== '' && sel.value != null) ? sel : null;
  window.dispatchEvent(new CustomEvent(EVT_F, { detail: window.__dtzFiltre }));
}

export function onFiltre(cb) {
  if (typeof window === 'undefined') return () => {};
  const h = (e) => cb(e.detail);
  window.addEventListener(EVT_F, h);
  return () => window.removeEventListener(EVT_F, h);
}
