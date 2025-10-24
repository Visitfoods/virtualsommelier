import { NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos para vídeos maiores

export async function GET() {
	try {
		// Caminho para o ficheiro de vídeo
		const videoPath = path.join(process.cwd(), 'public', 'guides', 'portugaldospequenitos', 'welcome_1755098274650_VirtualGuide_PortugaldosPequeninos.webm');
		
		// Verificar se o ficheiro existe
		if (!fs.existsSync(videoPath)) {
			return NextResponse.json({
				success: false,
				error: 'Ficheiro não encontrado',
				message: `O ficheiro de vídeo não foi encontrado em: ${videoPath}`
			}, { status: 404 });
		}
		
		// Obter informações do ficheiro
		const stats = fs.statSync(videoPath);
		
		// Ler o ficheiro de vídeo
		const fileBuffer = fs.readFileSync(videoPath);
		
		
		// Nome do guia e ficheiro para teste
		const testGuide = 'teste-video-grande';
		const fileName = `portugal-pequenitos_${Date.now()}.webm`;
    const remotePath = `virtualsommelier/${testGuide}/${fileName}`;
		
		
		
		// Fazer upload do ficheiro
		const url = await uploadBufferToAmen(remotePath, fileBuffer);
		
		return NextResponse.json({
			success: true,
			message: 'Upload de vídeo concluído com sucesso!',
			path: remotePath,
			url: url,
			fileSize: fileBuffer.length,
			fileSizeMB: (fileBuffer.length / (1024 * 1024)).toFixed(2)
		});
	} catch (error) {
		console.error('Erro no teste de upload de vídeo:', error);
		return NextResponse.json({
			success: false,
			error: error instanceof Error ? error.message : 'Erro desconhecido',
			message: 'Falha no upload de vídeo. Verifique as configurações.'
		}, { status: 500 });
	}
}
