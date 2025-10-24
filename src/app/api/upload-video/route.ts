import { NextRequest, NextResponse } from 'next/server';
import { uploadVideoBufferToCloudflare } from '@/lib/cloudflareStream';
import { sanitizeGuideSlug, sanitizeFilename, isAllowedMimeType, isAllowedFileSize } from '@/utils/sanitize';
import { strictRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Lista de tipos MIME permitidos
const ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
// Tamanho máximo permitido (200MB)
const MAX_FILE_SIZE = 200 * 1024 * 1024;

export async function POST(request: NextRequest) {
	try {
		// Aplicar rate limiting mais rigoroso para uploads de vídeo
		const rateLimitResult = await strictRateLimit()(request);
		if (rateLimitResult) {
			return rateLimitResult;
		}
		
		// Verificar autenticação via API Key simples
		const authResult = await simpleApiKeyAuth()(request);
		if (authResult) {
			return authResult;
		}

		const formData = await request.formData();
		// Aceitar tanto 'file' como 'video' para compatibilidade com o front-end
		const file = (formData.get('file') || formData.get('video')) as File | null;
		const guideSlug = (formData.get('guideSlug') || formData.get('slug')) as string | null;
		const fileType = (formData.get('fileType') || formData.get('type')) as 'background' | 'welcome' | 'mobileTabletBackground' | null;

		if (!file || !guideSlug || !fileType) {
			return NextResponse.json(
				{ error: 'Ficheiro, slug e tipo são obrigatórios' },
				{ status: 400 }
			);
		}

		// Validar tipo MIME
		if (!isAllowedMimeType(file.type, ALLOWED_MIME_TYPES)) {
			return NextResponse.json(
				{ error: 'Tipo de ficheiro não permitido. Apenas vídeos MP4, WebM, OGG e QuickTime são permitidos.' },
				{ status: 400 }
			);
		}

		// Validar tamanho do ficheiro
		if (!isAllowedFileSize(file.size, MAX_FILE_SIZE)) {
			return NextResponse.json(
				{ error: `Tamanho do ficheiro excede o limite máximo de ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
				{ status: 400 }
			);
		}

		// Sanitizar slug e nome do ficheiro
		const sanitizedSlug = sanitizeGuideSlug(guideSlug);
		const timestamp = Date.now();
		const sanitizedFileName = sanitizeFilename(file.name || 'video');
		const fileName = `${fileType}_${timestamp}_${sanitizedFileName}`;

		// Upload direto do buffer para Cloudflare Stream
		const buffer = Buffer.from(await file.arrayBuffer());
		const cloudflare = await uploadVideoBufferToCloudflare(buffer, fileName);
		if (cloudflare?.uid) {
			console.log(`[Cloudflare Stream] Upload direto OK`, { uid: cloudflare.uid, fileName, guideSlug, fileType });
			// Devolver também um campo 'path' compatível com o front-end (iframe por defeito)
			return NextResponse.json({ success: true, stored: true, fileName, cloudflare, path: cloudflare.iframe, message: 'Upload para Cloudflare concluído' });
		} else {
			console.warn('[Cloudflare Stream] Upload direto sem uid', { fileName, guideSlug, fileType });
			return NextResponse.json({ success: false, error: 'Falha no upload para Cloudflare' }, { status: 500 });
		}

	} catch (error) {
		console.error('Erro ao fazer upload de vídeo:', error);
		return NextResponse.json(
			{ error: 'Erro interno do servidor ao fazer upload de vídeo' },
			{ status: 500 }
		);
	}
}