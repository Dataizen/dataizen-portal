// Définitions canoniques des concepts DOLFIN (Smart Data Models), pour pré-remplir
// le dictionnaire des données : quand une colonne est associée à un concept du modèle
// pivot, on propose un libellé et une description alignés sur la définition canonique.
// Couvre les concepts des modèles intégrés (PointOfInterest, ClassifiedTree,
// TrafficObservation). Best-effort : un concept inconnu n'est simplement pas suggéré.
export const CONCEPT_DEFS = {
  name: { label: 'Nom', notes: 'Nom de l\'entité (Smart Data Models : name).' },
  category: { label: 'Catégorie', notes: 'Catégorie ou type de l\'entité (Smart Data Models : category).' },
  address: { label: 'Adresse', notes: 'Adresse postale (Smart Data Models : address).' },
  localId: { label: 'Identifiant local', notes: 'Identifiant local de l\'objet (Smart Data Models : localId).' },
  species: { label: 'Espèce', notes: 'Espèce (Smart Data Models : species).' },
  kind: { label: 'Type', notes: 'Type ou catégorie (Smart Data Models : kind).' },
  specimenCount: { label: 'Nombre de spécimens', notes: 'Nombre de spécimens (Smart Data Models : specimenCount).' },
  observedAt: { label: 'Date d\'observation', notes: 'Horodatage de l\'observation (Smart Data Models : observedAt).' },
  city: { label: 'Ville', notes: 'Ville concernée (Smart Data Models : city).' },
  intensity: { label: 'Intensité', notes: 'Intensité du trafic (Smart Data Models : intensity).' },
  averageSpeed: { label: 'Vitesse moyenne', notes: 'Vitesse moyenne mesurée (Smart Data Models : averageSpeed).' },
};

// Suggestions par colonne du jeu, à partir du mapping (colonne -> concept) et de la
// localisation lon/lat. Renvoie { [colonne]: { label, notes } }.
export function suggestionsFromMapping(rows, geo) {
  const out = {};
  for (const [concept, col] of rows || []) {
    if (CONCEPT_DEFS[concept]) out[col] = CONCEPT_DEFS[concept];
  }
  if (geo && geo.lon) out[geo.lon] = { label: 'Longitude', notes: 'Longitude (composante de location, Smart Data Models).' };
  if (geo && geo.lat) out[geo.lat] = { label: 'Latitude', notes: 'Latitude (composante de location, Smart Data Models).' };
  return out;
}
