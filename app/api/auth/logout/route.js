import { NextResponse } from 'next/server';
import { COOKIE } from '../../../../lib/session';

export async function GET() {
  const res = NextResponse.redirect(process.env.NEXT_PUBLIC_BASE_URL || '/');
  res.cookies.set(COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
