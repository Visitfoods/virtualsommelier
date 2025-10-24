import { NextRequest, NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';
import { sanitizeGuideSlug, sanitizeFilename, isAllowedMimeType, isAllowedFileSize } from '@/utils/sanitize';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lista de origens permitidas para CORS
const ALLOWED_ORIGINS = new Set([
  'https://virtualguide.info',
  'https://www.virtualguide.info',
  'http://localhost:3000'
]);

// Configurar CORS para OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  
  // Se a origem não estiver na lista, não adicionar headers CORS
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Lista de tipos MIME permitidos
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
// Tamanho máximo permitido (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
		const fileType = (formData.get('fileType') || formData.get('type')) as string | null;

		if (!file || !guideSlug) {
			return NextResponse.json(
				{ error: 'Ficheiro e slug são obrigatórios' },
				{ status: 400 }
			);
		}

		// Validar tipo MIME
		if (!isAllowedMimeType(file.type, ALLOWED_MIME_TYPES)) {
			return NextResponse.json(
				{ error: 'Tipo de ficheiro não permitido. Apenas imagens são permitidas.' },
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
		const sanitizedFileName = sanitizeFilename(file.name || 'image');
    const fileName = `${fileType || 'chatIcon'}_${timestamp}_${sanitizedFileName}`;
    const remotePath = `virtualsommelier/${sanitizedSlug}/${fileName}`;
		
		const buffer = Buffer.from(await file.arrayBuffer());
		const publicUrl = await uploadBufferToAmen(remotePath, buffer);
		// Adicionar headers CORS na resposta de sucesso
		const origin = request.headers.get('origin') || '';
		const response = NextResponse.json(
			{ success: true, stored: true, path: publicUrl, fileName, message: 'Imagem guardada no servidor (FTP) com sucesso' }
		);

		// Adicionar headers CORS se a origem for permitida
		if (ALLOWED_ORIGINS.has(origin)) {
			response.headers.set('Access-Control-Allow-Origin', origin);
			response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
			response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
		}

		return response;
	} catch (error) {
		console.error('Erro ao fazer upload de imagem:', error);
		// Adicionar headers CORS mesmo na resposta de erro
		const origin = request.headers.get('origin') || '';
		const errorResponse = NextResponse.json(
			{ error: 'Erro interno do servidor ao fazer upload de imagem', details: error instanceof Error ? error.message : 'Erro desconhecido' },
			{ status: 500 }
		);

		// Adicionar headers CORS se a origem for permitida
		if (ALLOWED_ORIGINS.has(origin)) {
			errorResponse.headers.set('Access-Control-Allow-Origin', origin);
			errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
			errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
		}

		return errorResponse;
	}
}