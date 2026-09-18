// Profil territorial par PAYS de l'instance (dimension distincte de la langue).
// Pilote la carte-sélecteur du catalogue, le référentiel de contours chargé, et les
// libellés de la facette Territoire. Le pays vient de la variable d'env PORTAL_PAYS
// (lue côté serveur ; défaut 'fr'), comme PORTAL_LANG pour la langue.
//
// - fr : départements (INSEE), bascule Régions, Outre-mer en pastilles hors carte.
// - pt : distritos (18, Portugal continental), pas de niveau région, pas de pastilles.
//
// Importable côté client (données pures) : le composant carte reçoit le pays en
// attribut de données et résout le profil ici.
import { nomDepartement } from './departements';
import { regionDeDept, deptsDeRegion, nomRegion } from './regions';
import { nomDistrito } from './distritos';
import { nomLad, regionDeLad, nomItl2, ladsDeItl2 } from './lad_uk';

const _none = () => null;
const _empty = () => [];

export const PROFILS = {
  fr: {
    pays: 'fr',
    // organisation CKAN des référentiels de ce pays (périmètre catalogue par défaut)
    referentielOrg: 'referentiels',
    // jeu de contours du niveau cartographique principal (carte-sélecteur)
    niveauSlug: 'referentiel-departements-france',
    // clé i18n du libellé du niveau (bouton de la carte, titre de facette)
    labelKey: 'map.departments',
    regionLabelKey: 'map.regions',
    hasRegions: true,
    // territoires proposés hors carte (pastilles), géographiquement éloignés
    horsCarte: ['971', '972', '973', '974', '976'],
    nom: nomDepartement,
    regionDe: regionDeDept,
    nomRegion,
    deptsDeRegion,
  },
  pt: {
    pays: 'pt',
    referentielOrg: 'referentiels-pt',
    niveauSlug: 'referentiel-distritos-portugal',
    labelKey: 'map.districts',
    regionLabelKey: null,
    hasRegions: false,
    horsCarte: [],
    nom: nomDistrito,
    regionDe: _none,
    nomRegion: _none,
    deptsDeRegion: _empty,
  },
  gb: {
    // Royaume-Uni : niveau carte = Local Authority Districts (LAD, ~361, tout le UK),
    // bascule = ITL2 (~46, regroupement statistique). Source ONS.
    pays: 'gb',
    referentielOrg: 'referentiels-uk',
    niveauSlug: 'referentiel-lad-uk',
    labelKey: 'map.localauthorities',
    regionLabelKey: 'map.itl2',
    hasRegions: true,
    horsCarte: [],
    nom: nomLad,
    regionDe: regionDeLad,
    nomRegion: nomItl2,
    deptsDeRegion: ladsDeItl2,
  },
};

export const DEFAULT_PAYS = 'fr';

// Côté SERVEUR uniquement (lit PORTAL_PAYS au runtime).
export function getPays() {
  const p = (process.env.PORTAL_PAYS || DEFAULT_PAYS).toLowerCase();
  return PROFILS[p] ? p : DEFAULT_PAYS;
}

export const profil = (pays) => PROFILS[String(pays || DEFAULT_PAYS).toLowerCase()] || PROFILS.fr;
