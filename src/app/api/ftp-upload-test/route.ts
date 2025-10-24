import { NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		// Ler o ficheiro de teste
		const testFilePath = path.join(process.cwd(), 'test-video.txt');
		const fileBuffer = fs.readFileSync(testFilePath);
		
		// Nome do guia e ficheiro para teste
		const testGuide = 'teste-upload';
    const fileName = `teste_${Date.now()}.txt`;
    const remotePath = `virtualsommelier/${testGuide}/${fileName}`;
		
		
		
		// Fazer upload do ficheiro
		const url = await uploadBufferToAmen(remotePath, fileBuffer);
		
		return NextResponse.json({
			success: true,
			message: 'Upload de teste concluído com sucesso!',
			path: remotePath,
			url: url,
			fileSize: fileBuffer.length
		});
	} catch (error) {
		console.error('Erro no teste de upload:', error);
		return NextResponse.json({
			success: false,
			error: error instanceof Error ? error.message : 'Erro desconhecido',
			message: 'Falha no upload de teste. Verifique as configurações.'
		}, { status: 500 });
	}
}
