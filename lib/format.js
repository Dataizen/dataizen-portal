// Formatage de tailles de fichiers (octets → Ko/Mo/Go lisibles).

export function formatTaille(octets) {
  const n0 = Number(octets);
  if (!n0 || n0 <= 0) return null;
  const unites = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let n = n0, i = 0;
  while (n >= 1024 && i < unites.length - 1) { n /= 1024; i += 1; }
  // pas de décimale pour les octets et à partir de 100 ; une décimale sinon
  const val = (i === 0 || n >= 100) ? Math.round(n) : n.toFixed(1);
  return `${val} ${unites[i]}`;
}

// Poids total des données d'un jeu : somme des tailles de fichiers de ses
// ressources (celles dont la taille est connue). Renvoie null si inconnu.
export function tailleDataset(resources) {
  const total = (resources || []).reduce((s, r) => s + (Number(r.size) || 0), 0);
  return total > 0 ? total : null;
}
