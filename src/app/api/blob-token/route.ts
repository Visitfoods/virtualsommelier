import { NextRequest } from 'next/server';
import { strictRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lista de tipos MIME permitidos para upload
const ALLOWED_CONTENT_TYPES = [
  'video/mp4', 
  'video/webm', 
  'video/ogg', 
  'image/jpeg', 
  'image/png', 
  'image/gif', 
  'image/webp', 
  'text/vtt'
];

// Limite de tamanho de upload (100MB)
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
	try {
		// Aplicar rate limiting rigoroso para tokens de upload
		const rateLimitResult = await strictRateLimit()(request);
		if (rateLimitResult) {
			return rateLimitResult;
		}
		
		// Verificar autenticação via API Key simples
		const authResult = await simpleApiKeyAuth()(request);
		if (authResult) {
			return authResult;
		}

		if (!process.env.BLOB_READ_WRITE_TOKEN) {
			return new Response(JSON.stringify({ error: 'BLOB_READ_WRITE_TOKEN não configurado' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}

		// Obter parâmetros da requisição
		const data = await request.json().catch(() => ({}));
		const requestedType = data.contentType || '';
		const requestedSize = data.size ? Number(data.size) : 0;

		// Verificar se o tipo MIME solicitado é permitido
		const isAllowedType = ALLOWED_CONTENT_TYPES.some(type => {
			if (type.endsWith('/*')) {
				const prefix = type.slice(0, -1);
				return requestedType.startsWith(prefix);
			}
			return requestedType === type;
		});

		if (requestedType && !isAllowedType) {
			return new Response(JSON.stringify({ 
				error: 'Tipo de conteúdo não permitido',
				allowedTypes: ALLOWED_CONTENT_TYPES 
			}), {
				status: 400,
				headers: { 'content-type': 'application/json' },
			});
		}

		// Verificar se o tamanho solicitado está dentro do limite
		if (requestedSize > MAX_UPLOAD_SIZE) {
			return new Response(JSON.stringify({ 
				error: `Tamanho máximo excedido. Limite: ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB` 
			}), {
				status: 400,
				headers: { 'content-type': 'application/json' },
			});
		}

		const { createUploadToken } = await import('@vercel/blob');

		const { token } = await createUploadToken({
			allowedContentTypes: ALLOWED_CONTENT_TYPES,
			maximumSizeInBytes: MAX_UPLOAD_SIZE,
		});

		return new Response(JSON.stringify({ token }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erro desconhecido';
		return new Response(JSON.stringify({ error: 'Erro ao gerar token', message }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}
}
