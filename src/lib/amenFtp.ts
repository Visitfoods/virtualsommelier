import { Client, AccessOptions } from 'basic-ftp';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type FtpSecureMode = boolean | 'implicit';

function getEnv(name: string, required = true): string | undefined {
	const value = process.env[name];
	if (required && (!value || value.trim() === '')) {
		console.error(`Variável de ambiente em falta: ${name}`);
		throw new Error(`Variável de ambiente em falta: ${name}`);
	}
	return value;
}

// Verifica se as variáveis de ambiente obrigatórias para FTP estão configuradas
function checkRequiredFtpEnv(): boolean {
	const requiredVars = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'FTP_BASE_URL'];
	const missing = requiredVars.filter(name => !process.env[name]);
	
	if (missing.length > 0) {
		console.error(`Variáveis de ambiente FTP em falta: ${missing.join(', ')}`);
		return false;
	}
	return true;
}

function toBool(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	return /^(1|true|yes)$/i.test(value.trim());
}

export interface AmenFtpConfig {
	host: string;
	user: string;
	password: string;
	port?: number;
	secure?: FtpSecureMode;
	publicHtmlPath?: string; // ex: 'public_html' | '.' | '/home/user/public_html'
	baseUrl: string; // ex: 'https://seudominio.com'
}

// Valores padrão para ambiente de desenvolvimento (sem credenciais reais)
const defaultConfig: AmenFtpConfig = {
	host: 'localhost',
	user: 'user',
	password: '',
	port: 21,
	secure: false,
	publicHtmlPath: '.',
	baseUrl: 'https://localhost'
};

export function getAmenFtpConfig(): AmenFtpConfig {
	try {
		// Verificar se todas as variáveis de ambiente obrigatórias estão configuradas
		if (!checkRequiredFtpEnv()) {
			throw new Error('Configuração FTP incompleta: variáveis de ambiente obrigatórias não estão definidas');
		}
		
		// Obter valores das variáveis de ambiente (agora sabemos que existem)
		const host = getEnv('FTP_HOST', true)!;
		const user = getEnv('FTP_USER', true)!;
		const password = getEnv('FTP_PASSWORD', true)!;
		const port = process.env.FTP_PORT ? Number(process.env.FTP_PORT) : defaultConfig.port;
		
		const secureEnv = process.env.FTP_SECURE;
		let secure: FtpSecureMode = defaultConfig.secure;
		if (secureEnv) {
			if (secureEnv.toLowerCase() === 'implicit') secure = 'implicit';
			else secure = toBool(secureEnv) ?? defaultConfig.secure;
		}
		
		// Permitir vazio (raiz), relativo ou absoluto
		const publicHtmlPath = process.env.FTP_PUBLIC_HTML_PATH ?? defaultConfig.publicHtmlPath;
		const baseUrl = getEnv('FTP_BASE_URL', true)!;
		

		
		return { host, user, password, port, secure, publicHtmlPath, baseUrl };
	} catch (error) {
		console.error('Erro ao obter configuração FTP:', error);
		throw new Error('Configuração FTP inválida. Verifique as variáveis de ambiente necessárias.');
	}
}

async function connectClient(config: AmenFtpConfig): Promise<Client> {
	const client = new Client();
	client.ftp.verbose = false; // Desativar logs verbosos para evitar vazamento de informações sensíveis
	const access: AccessOptions = {
		host: config.host,
		user: config.user,
		password: config.password,
		secure: config.secure || true, // Preferir conexão segura quando possível
		port: config.port,
	};
	await client.access(access);
	return client;
}

export async function uploadBufferToAmen(relativePathUnderPublicHtml: string, buffer: Buffer): Promise<string> {
	const config = getAmenFtpConfig();
	const client = await connectClient(config);
	try {
		// Garante diretório remoto
		const normalized = relativePathUnderPublicHtml.replace(/^\/+/, '');
		const parts = normalized.split('/');
		const fileName = parts.pop() as string;
		
		// Guardar diretório inicial
		const initialDir = await client.pwd();
		
		// Criar diretórios passo a passo
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			try {
				await client.cd(part);
			} catch (e) {
				await client.send('MKD ' + part);
				await client.cd(part);
			}
		}
		
		// Upload do ficheiro
		const stream = Readable.from(buffer);
		await client.uploadFrom(stream, fileName);

		// Voltar ao diretório inicial
		await client.cd(initialDir);

		// URL pública (assume que publicHtmlPath aponta para o webroot do domínio)
		const url = `${config.baseUrl.replace(/\/$/, '')}/${normalized}`;
		return url;
	} finally {
		client.close();
	}
}

// Função para apagar uma pasta e todo o seu conteúdo via FTP
export async function deleteDirectoryRecursive(remotePath: string): Promise<boolean> {
	const config = getAmenFtpConfig();
	const client = await connectClient(config);
	try {
		// Normalizar caminho
		const normalized = remotePath.replace(/^\/+/, '').replace(/\/+$/, '');
		
		// Guardar diretório inicial
		const initialDir = await client.pwd();
		
		try {
			// Verificar se o diretório existe
			await client.cd(normalized);
			
			// Listar conteúdo
			const list = await client.list();
			
			// Apagar ficheiros e subdiretórios
			for (const item of list) {
				if (item.type === 1) { // Ficheiro
					await client.remove(item.name);
				} else if (item.type === 2) { // Diretório
					if (item.name !== '.' && item.name !== '..') {
						// Recursivamente apagar subdiretórios
						await client.cd(item.name);
						const sublist = await client.list();
						for (const subitem of sublist) {
							if (subitem.type === 1) { // Ficheiro
								await client.remove(subitem.name);
							}
						}
						await client.cdup(); // Voltar ao diretório pai
						await client.removeDir(item.name);
					}
				}
			}
			
			// Voltar ao diretório inicial
			await client.cd(initialDir);
			
			// Apagar o diretório principal
			await client.removeDir(normalized);
			
			return true;
		} catch (e) {
			console.error(`Erro ao apagar diretório ${normalized}:`, e);
			return false;
		}
	} finally {
		client.close();
	}
}

// Função para apagar um ficheiro específico via FTP
export async function deleteFileFromFtp(remotePath: string): Promise<boolean> {
	const config = getAmenFtpConfig();
	const client = await connectClient(config);
	try {
		// Normalizar caminho
		const normalized = remotePath.replace(/^\/+/, '').replace(/\/+$/, '');
		
		// Guardar diretório inicial
		const initialDir = await client.pwd();
		
		try {
			// Extrair diretório e nome do ficheiro
			const parts = normalized.split('/');
			const fileName = parts.pop() as string;
			const directory = parts.join('/');
			
			// Navegar para o diretório se necessário
			if (directory) {
				await client.cd(directory);
			}
			
			// Verificar se o ficheiro existe
			const list = await client.list();
			const fileExists = list.some(item => item.name === fileName && item.type === 1);
			
			if (!fileExists) {
				return false;
			}
			
			// Apagar o ficheiro
			await client.remove(fileName);
			
			// Voltar ao diretório inicial
			await client.cd(initialDir);
			
			return true;
		} catch (e) {
			console.error(`Erro ao apagar ficheiro ${normalized}:`, e);
			return false;
		}
	} finally {
		client.close();
	}
}

// Interface para o upload em chunks
// Removidos: tipos e funções de upload por chunks – usamos apenas upload direto