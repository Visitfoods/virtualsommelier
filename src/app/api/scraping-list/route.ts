import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cacheDir = path.join(process.cwd(), '.next', 'scraping-cache');
    const entries = await fs.readdir(cacheDir);
    const out: Array<{ slug: string; websiteUrl: string; pages: number; timestamp: number; expiresAt: number }> = [];
    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      const slug = name.replace(/\.json$/, '');
      try {
        const raw = await fs.readFile(path.join(cacheDir, name), 'utf8');
        const data = JSON.parse(raw);
        out.push({ slug, websiteUrl: String(data.websiteUrl || ''), pages: Array.isArray(data.pages) ? data.pages.length : 0, timestamp: Number(data.timestamp || 0), expiresAt: Number(data.expiresAt || 0) });
      } catch {}
    }
    out.sort((a, b) => b.timestamp - a.timestamp);
    return NextResponse.json(out);
  } catch {
    return NextResponse.json([]);
  }
}




