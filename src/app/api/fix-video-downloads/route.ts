import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareVideoStatus, setCloudflareVideoDownloadable, setCloudflareVideoPublicAndDownloadable, requestCloudflareMp4Download, waitUntilMp4Ready } from '@/lib/cloudflareStream';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
	try {
		// Verificar autenticação
		const authResult = await simpleApiKeyAuth()(request);
		if (authResult) {
			return authResult;
		}

		const { uid } = await request.json();
		
		if (!uid) {
			return NextResponse.json({ error: 'UID do vídeo é obrigatório' }, { status: 400 });
		}

		console.log(`[Fix Downloads] Verificando vídeo: ${uid}`);

		// 1. Verificar status atual do vídeo
		const status = await getCloudflareVideoStatus(uid);
		if (!status) {
			return NextResponse.json({ error: 'Vídeo não encontrado no Cloudflare' }, { status: 404 });
		}

		const videoData = status.result;
		const currentDownloadable = videoData?.downloadable || false;

		console.log(`[Fix Downloads] Status atual - Downloads ativos: ${currentDownloadable}`);

		// 2. Se downloads não estão ativos, tentar ativar + disparar geração e aguardar
		if (!currentDownloadable) {
			console.log(`[Fix Downloads] Tentando ativar downloads para ${uid}`);
			const activated = await setCloudflareVideoPublicAndDownloadable(uid) || await setCloudflareVideoDownloadable(uid, true);
			await requestCloudflareMp4Download(uid);
			const ready = await waitUntilMp4Ready(uid);
			if (activated || ready) {
				return NextResponse.json({
					success: true,
					uid,
					action: 'activated',
					downloadable: true,
					mp4Url: `https://videodelivery.net/${uid}/downloads/default.mp4`,
					message: ready ? 'MP4 pronto e downloads ativos' : 'Downloads ativos; MP4 poderá ficar disponível em instantes'
				});
			}
			return NextResponse.json({ success: false, uid, action: 'failed', downloadable: false, message: 'Não foi possível preparar o MP4' }, { status: 500 });
		} else {
			// Downloads já estão ativos
			console.log(`[Fix Downloads] Downloads já estão ativos para ${uid}`);
			return NextResponse.json({
				success: true,
				uid,
				action: 'already_active',
				downloadable: true,
				mp4Url: `https://videodelivery.net/${uid}/downloads/default.mp4`,
				message: 'Downloads MP4 já estão ativos'
			});
		}

	} catch (error) {
		console.error('[Fix Downloads] Erro:', error);
		return NextResponse.json(
			{ error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Erro desconhecido' },
			{ status: 500 }
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		// Verificar autenticação
		const authResult = await simpleApiKeyAuth()(request);
		if (authResult) {
			return authResult;
		}

		const uid = request.nextUrl.searchParams.get('uid');
		
		if (!uid) {
			return NextResponse.json({ error: 'UID do vídeo é obrigatório' }, { status: 400 });
		}

		console.log(`[Check Downloads] Verificando status do vídeo: ${uid}`);

		// Verificar status do vídeo
		const status = await getCloudflareVideoStatus(uid);
		if (!status) {
			return NextResponse.json({ error: 'Vídeo não encontrado no Cloudflare' }, { status: 404 });
		}

		const videoData = status.result;
		const downloadable = videoData?.downloadable || false;

		return NextResponse.json({
			success: true,
			uid,
			downloadable,
			mp4Url: `https://videodelivery.net/${uid}/downloads/default.mp4`,
			videoData: {
				uid: videoData.uid,
				status: videoData.status,
				downloadable: videoData.downloadable,
				created: videoData.created,
				modified: videoData.modified,
				size: videoData.size,
				duration: videoData.duration
			},
			message: downloadable ? 'Downloads MP4 estão ativos' : 'Downloads MP4 não estão ativos'
		});

	} catch (error) {
		console.error('[Check Downloads] Erro:', error);
		return NextResponse.json(
			{ error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Erro desconhecido' },
			{ status: 500 }
		);
	}
}
