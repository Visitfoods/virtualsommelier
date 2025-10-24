import { put } from '@vercel/blob';

export const runtime = 'nodejs';

export async function GET() {
	try {
		// Verifica se o token está configurado
		if (!process.env.BLOB_READ_WRITE_TOKEN) {
			return new Response(JSON.stringify({
				status: 'error',
				message: 'BLOB_READ_WRITE_TOKEN não configurado',
				configured: false,
				tokenValid: false
			}), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}

		// Testa se o token é válido fazendo um upload de teste (permitindo overwrite para evitar erro de ficheiro existente)
		const testContent = 'Teste de configuração do Vercel Blob';
		const { url } = await put('test-config.txt', testContent, { access: 'public', allowOverwrite: true });

		return new Response(JSON.stringify({
			status: 'success',
			message: 'Vercel Blob está configurado e funcionando',
			configured: true,
			tokenValid: true,
			tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 20) + '...',
			environment: process.env.NODE_ENV || 'unknown',
			domain: process.env.VERCEL_URL || 'unknown',
			testUrl: url
		}), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erro desconhecido';
		return new Response(JSON.stringify({
			status: 'error',
			message: `Erro ao testar Vercel Blob: ${message}`,
			configured: false,
			tokenValid: false,
			error: message
		}), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}
}
