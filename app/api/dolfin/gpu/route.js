import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';

// État du GPU souverain (indicateur pour l'interface DOLFIN). Tout utilisateur connecté.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ available: false }, { status: 401 });
  try {
    const r = await fetch(`${CKAN}/api/3/action/dolfin_gpu_status`, {
      method: 'POST',
      headers: { Authorization: process.env.CKAN_EDIT_TOKEN, 'Content-Type': 'application/json' },
      body: '{}', cache: 'no-store', signal: AbortSignal.timeout(9000),
    });
    const d = await r.json().catch(() => ({}));
    return NextResponse.json(d.result || { available: false });
  } catch {
    return NextResponse.json({ available: false });
  }
}
