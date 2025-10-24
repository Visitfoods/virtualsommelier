import { NextRequest, NextResponse } from 'next/server';
import { createCloudflareDirectUpload } from '@/lib/cloudflareStream';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';
import { strictRateLimit } from '@/middleware/rateLimitMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await strictRateLimit()(request);
    if (rateLimited) return rateLimited;

    const authed = await simpleApiKeyAuth()(request);
    if (authed) return authed;

    const { fileName, mimeType, requireSignedURLs = false, allowedOrigins = [], metadata = {}, maxDurationSeconds } = await request.json().catch(() => ({}));

    const direct = await createCloudflareDirectUpload({ fileName, mimeType, requireSignedURLs, allowedOrigins, metadata, maxDurationSeconds });
    return NextResponse.json({ success: true, ...direct });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Falha ao criar direct upload' }, { status: 500 });
  }
}


