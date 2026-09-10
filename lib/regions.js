// Régions françaises (code INSEE) -> nom + départements, pour la carte-sélecteur
// de territoire du catalogue (choisir un département ou une région entière).
export const REGIONS = {
  '11': { nom: 'Île-de-France', depts: ['75', '77', '78', '91', '92', '93', '94', '95'] },
  '24': { nom: 'Centre-Val de Loire', depts: ['18', '28', '36', '37', '41', '45'] },
  '27': { nom: 'Bourgogne-Franche-Comté', depts: ['21', '25', '39', '58', '70', '71', '89', '90'] },
  '28': { nom: 'Normandie', depts: ['14', '27', '50', '61', '76'] },
  '32': { nom: 'Hauts-de-France', depts: ['02', '59', '60', '62', '80'] },
  '44': { nom: 'Grand Est', depts: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'] },
  '52': { nom: 'Pays de la Loire', depts: ['44', '49', '53', '72', '85'] },
  '53': { nom: 'Bretagne', depts: ['22', '29', '35', '56'] },
  '75': { nom: 'Nouvelle-Aquitaine', depts: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'] },
  '76': { nom: 'Occitanie', depts: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'] },
  '84': { nom: 'Auvergne-Rhône-Alpes', depts: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'] },
  '93': { nom: "Provence-Alpes-Côte d'Azur", depts: ['04', '05', '06', '13', '83', '84'] },
  '94': { nom: 'Corse', depts: ['2A', '2B'] },
  '01': { nom: 'Guadeloupe', depts: ['971'] },
  '02': { nom: 'Martinique', depts: ['972'] },
  '03': { nom: 'Guyane', depts: ['973'] },
  '04': { nom: 'La Réunion', depts: ['974'] },
  '06': { nom: 'Mayotte', depts: ['976'] },
};

export function regionDeDept(code) {
  const c = String(code).toUpperCase();
  for (const [r, v] of Object.entries(REGIONS)) if (v.depts.includes(c)) return r;
  return null;
}

export const deptsDeRegion = (code) => (REGIONS[String(code)] || {}).depts || [];
export const nomRegion = (code) => (REGIONS[String(code)] || {}).nom || null;
