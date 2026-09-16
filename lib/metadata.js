// Champs de métadonnées du portail : UN SEUL endroit à modifier pour en ajouter.
// Chaque champ déclaré ici apparaît automatiquement dans le formulaire de dépôt,
// dans l'édition intégrée et sur la fiche du dataset.
// `core: true`  -> champ natif CKAN (envoyé tel quel à l'API)
// sinon         -> stocké dans les extras CKAN (clé/valeur), affiché avec son label.

// Vocabulaire des THÈMES = DCAT-AP `data-theme` (Office des publications de l'UE),
// commun à tous les pays et localisé. La valeur STOCKÉE dans l'extra CKAN `theme` est
// le CODE (ex. ENVI) ; le libellé affiché est traduit selon la langue de l'instance
// (clé i18n `theme.<CODE>`). URI = http://publications.europa.eu/resource/authority/data-theme/<CODE>
export const THEME_CODES = [
  'AGRI', 'ECON', 'EDUC', 'ENER', 'ENVI', 'GOVE', 'HEAL',
  'INTR', 'JUST', 'REGI', 'SOCI', 'TECH', 'TRAN',
];

// Rétro-compatibilité : anciens libellés français (data.gouv.fr) -> code EU. Sert à
// afficher et filtrer les jeux non encore migrés (leur extra `theme` porte le libellé),
// et alimente la migration. Repli assumé : plusieurs thèmes FR -> un même code.
export const THEME_FR_LEGACY = {
  'Administration et action publique': 'GOVE',
  'Agriculture': 'AGRI',
  'Aménagement du territoire et urbanisme': 'REGI',
  'Biodiversité et eau': 'ENVI',
  'Citoyenneté et démocratie': 'GOVE',
  'Climat, air et énergie': 'ENVI',
  'Culture, patrimoine et tourisme': 'EDUC',
  'Economie et entreprises': 'ECON',
  'Equipements, bâtiments et logements': 'REGI',
  'Formation, éducation et emploi': 'EDUC',
  'Mobilité et transports': 'TRAN',
  'Nuisances, déchets et risques': 'ENVI',
  'Occupation des sols': 'ENVI',
  'Social, santé et sports': 'HEAL',
};

// Valeur brute (code EU ou ancien libellé FR) -> code EU normalisé ('' si inconnu).
export function themeCode(value) {
  if (!value) return '';
  const v = String(value).trim();
  if (THEME_CODES.includes(v)) return v;
  return THEME_FR_LEGACY[v] || '';
}

// Code EU -> toutes les valeurs à matcher dans Solr (le code + ses anciens libellés FR),
// pour un filtre de facette rétro-compatible pendant/après la migration.
export function themeSolrValues(code) {
  const vals = [code];
  for (const [lbl, c] of Object.entries(THEME_FR_LEGACY)) if (c === code) vals.push(lbl);
  return vals;
}

export const FREQUENCES = [
  'Ponctuelle', 'Temps réel', 'Quotidienne', 'Hebdomadaire', 'Mensuelle',
  'Trimestrielle', 'Semestrielle', 'Annuelle', 'Pluriannuelle', 'Inconnue',
];

// Champs alignés sur le Guide de saisie des métadonnées générales de
// recherche.data.gouv.fr (février 2026). Titre, description, mots-clés et
// licence sont portés nativement par CKAN ; le reste vit en extras.
// (*) = obligatoire dans le guide : signalé dans le libellé, non bloquant au proto.
export const METADATA_FIELDS = [
  { key: 'sous_titre', label: 'Sous-titre', type: 'text',
    placeholder: 'titre secondaire complétant le titre principal' },
  { key: 'point_de_contact', label: 'Point de contact (*)', type: 'text',
    placeholder: 'Nom, Prénom — courriel (ex : Dupont, Marie — marie.dupont@agglo.fr)' },
  { key: 'auteur', label: 'Auteur (*)', type: 'text',
    placeholder: 'personne ou organisme responsable du jeu de données' },
  { key: 'producteur', label: 'Producteur', type: 'text',
    placeholder: 'organisme ayant produit les données' },
  { key: 'date_production', label: 'Date de production', type: 'text',
    placeholder: 'AAAA-MM-JJ' },
  { key: 'langue', label: 'Langue', type: 'select',
    options: ['Français', 'Anglais', 'Multilingue', 'Autre'] },
  { key: 'theme', label: 'Thématique', type: 'select', options: THEME_CODES, i18nOptions: 'theme' },
  { key: 'type_donnees', label: 'Type de données', type: 'select',
    options: ['Données d\'observation', 'Données d\'enquête', 'Données administratives',
              'Données de capteurs / mesures', 'Référentiel', 'Données géographiques',
              'Données de simulation', 'Autre'] },
  { key: 'source', label: 'Source / origine des données', type: 'text',
    placeholder: 'ex : INSEE, relevé terrain, DGFiP, moissonnage…' },
  { key: 'couverture_spatiale', label: 'Localisation / couverture spatiale', type: 'text',
    placeholder: 'ex : CA Paris-Saclay, commune de Massy…' },
  { key: 'territoires', label: 'Départements couverts (facette Territoire)', type: 'text',
    placeholder: 'codes séparés par des espaces, ex : 21 25 39 ; déduit automatiquement si la donnée a une colonne code' },
  { key: 'couverture_temporelle', label: 'Période couverte', type: 'text',
    placeholder: 'ex : 2020-2025, millésime 2025' },
  { key: 'validite_debut', label: 'Début de validité', type: 'date',
    placeholder: 'AAAA-MM-JJ' },
  { key: 'validite_fin', label: 'Fin de validité (péremption)', type: 'date',
    placeholder: 'AAAA-MM-JJ' },
  { key: 'frequence', label: 'Fréquence de mise à jour', type: 'select', options: FREQUENCES },
  { key: 'publication_associee', label: 'Publication ou contenu associé', type: 'text',
    placeholder: 'URL ou DOI d\'une publication, d\'une étude…' },
  // Profil DOLFIN (MIMaThon Phase 1) : rattache le jeu au modèle canonique de son
  // domaine (harmonisation par pivot). Additif, cf. docs/MIMATHON_PHASE1.md.
  { key: 'dolfin_profile', label: 'Profil DOLFIN (modèle canonique du domaine)', type: 'select',
    options: ['Arbres classés / patrimoniaux', 'Points d\'intérêt (POI)', 'Trafic routier',
              'Autre domaine'] },
  { key: 'dolfin_conformance', label: 'Alignement au profil DOLFIN', type: 'select',
    options: ['Aligné (reprend le modèle)', 'Partiel (étend le modèle)',
              'Écart (propose un nouveau modèle)'] },
  { key: 'dolfin_model_url', label: 'Modèle DOLFIN de référence (.dolfin)', type: 'text',
    placeholder: 'https://… vers le fichier .dolfin du domaine (optionnel)' },
];

// extras CKAN [{key, value}] -> objet {clé: valeur}
export function extrasToObject(extras) {
  const o = {};
  for (const e of extras || []) o[e.key] = e.value;
  return o;
}

// valeurs du formulaire -> extras CKAN (uniquement les champs déclarés, non vides)
export function valuesToExtras(values, previous = []) {
  const keep = previous.filter((e) => !METADATA_FIELDS.some((f) => f.key === e.key));
  const extras = METADATA_FIELDS
    .filter((f) => (values[f.key] || '').trim())
    .map((f) => ({ key: f.key, value: String(values[f.key]).trim().slice(0, 500) }));
  return [...keep, ...extras];
}
