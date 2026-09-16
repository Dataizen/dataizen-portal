// Codes distrito (Portugal continental) -> nom, pour la facette « Territoire » du
// catalogue quand l'instance est de pays PT. Équivalent portugais de departements.js.
// Les codes suivent le référentiel CKAN referentiel-distritos-portugal (code DI, 01-18).
export const DISTRITOS = {
  '01': 'Aveiro', '02': 'Beja', '03': 'Braga', '04': 'Bragança',
  '05': 'Castelo Branco', '06': 'Coimbra', '07': 'Évora', '08': 'Faro',
  '09': 'Guarda', '10': 'Leiria', '11': 'Lisboa', '12': 'Portalegre',
  '13': 'Porto', '14': 'Santarém', '15': 'Setúbal', '16': 'Viana do Castelo',
  '17': 'Vila Real', '18': 'Viseu',
};

export const nomDistrito = (code) => DISTRITOS[String(code).padStart(2, '0')] || null;
