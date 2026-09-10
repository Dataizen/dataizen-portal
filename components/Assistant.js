'use client';
// Widget d'assistant (RAG souverain) : bouton flottant + panneau de discussion.
// Interroge /api/assistant qui appelle le service dtz-rag (données CKAN publiques
// + contenu CMS de l'instance) et renvoie une réponse sourcée.
import { useState, useRef, useEffect } from 'react';

// Rendu markdown minimal et sûr (échappement HTML d'abord) pour les réponses de
// l'assistant : gras, italique, code, liens https, listes à puces, titres.
function renderMd(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let html = '', inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of (md || '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const li = line.match(/^\s*[*-]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    closeList();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { const n = Math.min(h[1].length + 2, 5); html += `<h${n}>${inline(h[2])}</h${n}>`; continue; }
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([]); // {role, text, sources?}
  const [ctx, setCtx] = useState({}); // { dataset?, focus_url?, page_title?, label? }
  const [embedded, setEmbedded] = useState(false); // dans un iframe (outil/aperçu) : masqué
  const boxRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.self !== window.top) setEmbedded(true);
  }, []);

  useEffect(() => {
    // contexte de la page courante : l'assistant priorise ce qu'on consulte
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const title = document.title || '';
    const md = path.match(/^\/dataset\/([a-z0-9_-]+)/i);
    if (md) { setCtx({ dataset: md[1], page_title: title, label: <>le jeu <code>{md[1]}</code></> }); return; }
    if (/^\/(pages|actualites)\//.test(path)) {
      const url = window.location.href.split('#')[0].split('?')[0];
      setCtx({ focus_url: url, page_title: title, label: <>la page « {title.replace(/\s*[|–-].*$/, '') || 'courante'} »</> });
    } else {
      setCtx({ page_title: title });
    }
  }, []);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [msgs, busy]);

  async function ask(e) {
    e?.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setQ(''); setBusy(true);
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: question,
          context: { dataset: ctx.dataset, focus_url: ctx.focus_url, page_title: ctx.page_title },
        }),
      });
      const d = await r.json();
      if (d.warming) {
        setMsgs((m) => [...m, { role: 'ia', text: d.message, warming: true }]);
      } else if (d.error) {
        setMsgs((m) => [...m, { role: 'ia', text: 'Désolé, une erreur est survenue.' }]);
      } else {
        setMsgs((m) => [...m, { role: 'ia', text: d.answer || 'Aucune réponse.', sources: d.sources || [] }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: 'ia', text: 'Assistant indisponible pour le moment.' }]);
    }
    setBusy(false);
  }

  if (embedded) return null; // pas de widget assistant dans un iframe embarqué
  if (!open) {
    return (
      <button className="assistant-fab" onClick={() => setOpen(true)}
              aria-label="Ouvrir l'assistant de données">💬 Assistant</button>
    );
  }

  return (
    <div className="assistant-panel" role="dialog" aria-label="Assistant de données">
      <div className="assistant-tete">
        <strong>Assistant de données</strong>
        <button className="assistant-fermer" onClick={() => setOpen(false)} aria-label="Fermer">✕</button>
      </div>
      <div className="assistant-corps" ref={boxRef}>
        {msgs.length === 0 && (
          <p className="meta">
            {ctx.label
              ? <>Vous consultez {ctx.label} : l'assistant le prend comme contexte prioritaire.
                 Posez votre question, les réponses citent leurs sources.</>
              : <>Posez une question sur les données du catalogue ou le contenu du site.
                 Les réponses citent leurs sources. (Données publiques uniquement.)</>}
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`assistant-msg ${m.role}`}>
            {m.role === 'ia' && !m.warming
              ? <div className="assistant-md" dangerouslySetInnerHTML={{ __html: renderMd(m.text) }} />
              : <div>{m.text}</div>}
            {m.sources?.length > 0 && (
              <ul className="assistant-sources">
                {m.sources.map((s, j) => (
                  <li key={j}>{s.url ? <a href={s.url}>{s.title}</a> : s.title}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {busy && <p className="meta">L'assistant réfléchit…</p>}
      </div>
      <form className="assistant-saisie" onSubmit={ask}>
        <input value={q} onChange={(e) => setQ(e.target.value)} disabled={busy}
               placeholder="Votre question…" aria-label="Votre question" />
        <button className="bouton-admin" type="submit" disabled={busy || !q.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
