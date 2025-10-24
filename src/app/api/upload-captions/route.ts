import { NextRequest, NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';
import { sanitizeGuideSlug, isAllowedFileSize } from '@/utils/sanitize';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Tamanho máximo permitido (1MB)
const MAX_FILE_SIZE = 1 * 1024 * 1024;

export async function POST(request: NextRequest) {
	try {
		// Aplicar rate limiting
		const rateLimitResult = await standardRateLimit()(request);
		if (rateLimitResult) {
			return rateLimitResult;
		}
		
		// Verificar autenticação via API Key simples
		const authResult = await simpleApiKeyAuth()(request);
		if (authResult) {
			return authResult;
		}

		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const guideSlug = (formData.get('guideSlug') || formData.get('slug')) as string | null;
		const captionType = (formData.get('captionType') || formData.get('variant')) as 'desktop' | 'tablet' | 'mobile' | null;
		const languageRaw = (formData.get('language') || formData.get('lang')) as string | null;

		if (!file || !guideSlug || !captionType) {
			return NextResponse.json(
				{ error: 'Ficheiro, slug e variante são obrigatórios' },
				{ status: 400 }
			);
		}

		// Validar idioma (opcional, default pt)
		const allowedLangs = ['pt', 'en', 'es', 'fr'] as const;
		const lang = (languageRaw || 'pt').toLowerCase();
		if (!allowedLangs.includes(lang as any)) {
			return NextResponse.json(
				{ error: 'Idioma inválido. Use pt, en, es ou fr.' },
				{ status: 400 }
			);
		}

		// Verificar se é um ficheiro VTT
		if (!file.name.endsWith('.vtt')) {
			return NextResponse.json(
				{ error: 'Apenas ficheiros .vtt são permitidos' },
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

		// Sanitizar slug
		const sanitizedSlug = sanitizeGuideSlug(guideSlug);
		const timestamp = Date.now();
    const fileName = `captions_${lang}_${captionType}_${timestamp}.vtt`;
    const remotePath = `virtualsommelier/${sanitizedSlug}/${fileName}`;
		
		const buffer = Buffer.from(await file.arrayBuffer());
		const publicUrl = await uploadBufferToAmen(remotePath, buffer);
		return NextResponse.json({ success: true, stored: true, path: publicUrl, fileName, message: 'Legendas guardadas no servidor (FTP) com sucesso' });
	} catch (error) {
		console.error('Erro ao fazer upload de legendas:', error);
		return NextResponse.json(
			{ error: 'Erro interno do servidor ao fazer upload de legendas' },
			{ status: 500 }
		);
	}
}