// Rendu d'un état d'éditeur Lexical (richText Payload) en HTML. Léger et autonome
// (pas de dépendance @payloadcms/richtext-lexical côté portail) : on parcourt l'arbre
// de noeuds et on émet le HTML des noeuds courants (paragraphe, titre, liste, citation,
// lien, texte formaté, saut de ligne, filet). Les noeuds inconnus rendent leurs enfants.
//
// Le texte produit passe ensuite par equiperEmbeds (directives [[graphique:N]]…) côté
// appelant, donc les directives saisies restent fonctionnelles.

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// format = masque de bits Lexical : 1 gras, 2 italique, 4 barré, 8 souligné, 16 code.
function renderText(node) {
  let t = esc(node.text);
  if (t === '') return '';
  const f = node.format || 0;
  if (f & 16) t = `<code>${t}</code>`;
  if (f & 1) t = `<strong>${t}</strong>`;
  if (f & 2) t = `<em>${t}</em>`;
  if (f & 8) t = `<u>${t}</u>`;
  if (f & 4) t = `<s>${t}</s>`;
  return t;
}

function children(node) {
  return (node.children || []).map(renderNode).join('');
}

function renderNode(node) {
  if (!node || typeof node !== 'object') return '';
  switch (node.type) {
    case 'text': return renderText(node);
    case 'linebreak': return '<br>';
    case 'horizontalrule': return '<hr>';
    case 'paragraph': {
      const inner = children(node);
      return inner ? `<p>${inner}</p>` : '';
    }
    case 'heading': {
      const tag = /^h[1-6]$/.test(node.tag) ? node.tag : 'h2';
      return `<${tag}>${children(node)}</${tag}>`;
    }
    case 'quote': return `<blockquote>${children(node)}</blockquote>`;
    case 'list': {
      const tag = node.listType === 'number' ? 'ol' : 'ul';
      return `<${tag}>${children(node)}</${tag}>`;
    }
    case 'listitem': return `<li>${children(node)}</li>`;
    case 'link':
    case 'autolink': {
      const url = node.fields?.url || node.url || '#';
      const blank = node.fields?.newTab ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${esc(url)}"${blank}>${children(node)}</a>`;
    }
    case 'tab': return ' ';
    default:
      // noeud inconnu : on tente ses enfants, sinon rien.
      return node.children ? children(node) : '';
  }
}

// Vrai si la valeur ressemble à un état Lexical ({ root: { children } }).
export function isLexical(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
    && !!v.root && typeof v.root === 'object';
}

// État Lexical -> chaîne HTML. Renvoie '' si vide.
export function lexicalToHtml(state) {
  if (!isLexical(state)) return '';
  return (state.root.children || []).map(renderNode).join('');
}
