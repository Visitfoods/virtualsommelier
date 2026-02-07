import { NextRequest, NextResponse } from 'next/server';
import { ScheduledScrapingService } from '@/services/scheduledScrapingService';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const slug = url.searchParams.get('slug') || undefined;
  
  // Verificar se é chamada do Vercel Cron (sem API key requerida)
  const cronSecret = req.headers.get('x-vercel-cron');
  const isCronCall = cronSecret === process.env.CRON_SECRET || cronSecret === '1';
  
  // Se não for cron, exigir autenticação
  if (!isCronCall) {
    const auth = await simpleApiKeyAuth()(req);
    if (auth) return auth as any;
  }
  
  try {
    if (action === 'start') {
      ScheduledScrapingService.start();
      return NextResponse.json({ ok: true, running: true });
    }
    if (action === 'stop') {
      ScheduledScrapingService.stop();
      return NextResponse.json({ ok: true, running: false });
    }
    if (action === 'run') {
      const stats = await ScheduledScrapingService.run();
      return NextResponse.json({ ok: true, stats });
    }
    if (action === 'runForGuide') {
      if (!slug) return NextResponse.json({ error: 'slug em falta' }, { status: 400 });
      const res = await ScheduledScrapingService.runForGuide(slug);
      return NextResponse.json({ ok: true, result: res });
    }
    if (action === 'stats') {
      const stats = ScheduledScrapingService.getStats();
      return NextResponse.json({ ok: true, stats, running: ScheduledScrapingService.isRunning() });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}


