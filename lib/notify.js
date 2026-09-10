// Notifications par email (best-effort) via le service dtz-rag (relais SMTP).
// N'échoue jamais l'action appelante : on ignore les erreurs d'envoi.
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';

export async function notify(to, subject, text) {
  const list = (Array.isArray(to) ? to : [to]).filter((e) => e && e.includes('@'));
  if (!list.length) return;
  try {
    await fetch(`${RAG}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dtz-Token': process.env.RAG_WEBHOOK_TOKEN || '' },
      body: JSON.stringify({ to: list, subject, text }),
      signal: AbortSignal.timeout(20000),
    });
  } catch { /* best-effort : l'échec d'envoi ne bloque pas l'action */ }
}
