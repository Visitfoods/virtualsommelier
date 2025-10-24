import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;
  return NextResponse.json({ configured: Boolean(key && key.length > 10) });
}


