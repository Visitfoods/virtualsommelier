import { NextRequest, NextResponse } from 'next/server';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';
import { uploadBufferToAmen } from '@/lib/amenFtp';
import { getFirestore, collection, getDocs, Timestamp } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Configuração para o projeto virtualchat-b0e17 via variáveis de ambiente
const VIRTUALCHAT_FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_TARGET_FIREBASE_API_KEY as string,
  authDomain: process.env.NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN as string,
  projectId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID as string,
  storageBucket: process.env.NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_APP_ID as string,
  measurementId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_MEASUREMENT_ID || ''
} as const;

// Inicializar Firebase para backup
const backupApp = (() => {
  const appName = 'vg-virtualchat-backup';
  const existing = getApps().find(a => a.name === appName);
  if (existing) return existing;
  return initializeApp(VIRTUALCHAT_FIREBASE_CONFIG, appName);
})();

const backupDb = getFirestore(backupApp);

type AllowedProject = 'virtualchat-b0e17';

  // Mapa de coleções conhecidas por projeto (somente leitura)
const PROJECT_COLLECTIONS: Record<AllowedProject, string[]> = {
  'virtualchat-b0e17': ['contactoschatreal', 'conversations', 'followers', 'guides', 'orcamentos', 'users']
};

function getDbForProject(project: AllowedProject) {
  // Usar a configuração específica para backup via variáveis de ambiente
  return backupDb;
}

// Gera conteúdo Markdown com informações do backup
function generateBackupMarkdown(project: AllowedProject, exported: any, date: Date) {
  const projectNames: Record<AllowedProject, string> = {
    'virtualchat-b0e17': 'VirtualChat B0E17'
  };

  const projectDescriptions: Record<AllowedProject, string> = {
    'virtualchat-b0e17': 'Base de dados principal - Guias, conversas, contactos'
  };

  const collections = PROJECT_COLLECTIONS[project];
  const totalDocuments = Object.values(exported.collections).reduce((total: number, docs: any) => total + docs.length, 0);
  
  let markdown = `# Backup Firestore - ${projectNames[project]}\n\n`;
  markdown += `**Data do Backup:** ${date.toLocaleString('pt-PT')}\n`;
  markdown += `**Projeto:** ${project}\n`;
  markdown += `**Descrição:** ${projectDescriptions[project]}\n\n`;
  
  markdown += `## Resumo do Backup\n\n`;
  markdown += `- **Total de documentos:** ${totalDocuments}\n`;
  markdown += `- **Coleções exportadas:** ${collections.length}\n`;
  markdown += `- **Tamanho do ficheiro JSON:** ${(Buffer.byteLength(JSON.stringify(exported), 'utf-8') / 1024).toFixed(2)} KB\n\n`;
  
  markdown += `## Coleções Exportadas\n\n`;
  
  collections.forEach(collectionName => {
    const docs = exported.collections[collectionName] || [];
    markdown += `### ${collectionName}\n`;
    markdown += `- **Documentos:** ${docs.length}\n`;
    
    if (docs.length > 0) {
      // Mostrar alguns campos de exemplo do primeiro documento
      const firstDoc = docs[0];
      const fields = Object.keys(firstDoc).filter(key => key !== 'id');
      markdown += `- **Campos:** ${fields.slice(0, 5).join(', ')}${fields.length > 5 ? '...' : ''}\n`;
    }
    markdown += `\n`;
  });
  
  markdown += `## Estrutura do Ficheiro\n\n`;
  markdown += `O ficheiro JSON contém a seguinte estrutura:\n\n`;
  markdown += `\`\`\`json\n`;
  markdown += `{\n`;
  markdown += `  "project": "${project}",\n`;
  markdown += `  "createdAt": "${exported.createdAt}",\n`;
  markdown += `  "collections": {\n`;
  collections.forEach((collectionName, index) => {
    markdown += `    "${collectionName}": [\n`;
    markdown += `      // Array de documentos da coleção\n`;
    markdown += `    ]${index < collections.length - 1 ? ',' : ''}\n`;
  });
  markdown += `  }\n`;
  markdown += `}\n`;
  markdown += `\`\`\`\n\n`;
  
  markdown += `## Notas Importantes\n\n`;
  markdown += `- Este backup foi criado em modo **apenas leitura**\n`;
  markdown += `- Nenhum dado foi alterado ou corrompido no Firebase\n`;
  markdown += `- Os timestamps foram convertidos para formato ISO string\n`;
  markdown += `- Todos os documentos incluem o campo \`id\` do Firestore\n\n`;
  
  markdown += `---\n`;
  markdown += `*Backup gerado automaticamente pelo sistema VirtualGuide*\n`;
  
  return markdown;
}

// Converte valores Firestore Timestamp/Date para strings ISO de forma segura (recursivo)
function toSerializable(value: any): any {
  try {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value?.toDate === 'function') {
      try { return value.toDate().toISOString(); } catch { /* noop */ }
    }
    if (Array.isArray(value)) return value.map(v => toSerializable(v));
    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) out[k] = toSerializable(v);
      return out;
    }
    return value;
  } catch {
    return value;
  }
}

async function exportCollections(project: AllowedProject) {
  const db = getDbForProject(project);
  const collections = PROJECT_COLLECTIONS[project];
  const result: Record<string, unknown[]> = {};

  console.log(`🔍 Iniciando backup do projeto: ${project}`);
  console.log(`📊 Coleções a exportar: ${collections.join(', ')}`);

  for (const colName of collections) {
    try {
      console.log(`📁 Exportando coleção: ${colName}`);
      const snap = await getDocs(collection(db, colName));
      const entries: unknown[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        entries.push({ id: docSnap.id, ...toSerializable(data) });
      });
      result[colName] = entries;
      console.log(`✅ Coleção ${colName}: ${entries.length} documentos exportados`);
    } catch (error) {
      console.error(`❌ Erro ao exportar coleção ${colName}:`, error);
      // Continuar com outras coleções mesmo se uma falhar
      result[colName] = [];
    }
  }

  return {
    project,
    createdAt: new Date().toISOString(),
    collections: result
  };
}

export async function POST(request: NextRequest) {
  console.log('🚀 Iniciando backup Firestore...');
  
  try {
    // Verificar se as variáveis de ambiente estão definidas
    const requiredEnvVars = [
      'NEXT_PUBLIC_TARGET_FIREBASE_API_KEY',
      'NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_TARGET_FIREBASE_APP_ID'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ Variáveis de ambiente em falta:', missingVars);
      return NextResponse.json(
        { error: 'Configuração de Firebase incompleta. Variáveis de ambiente em falta.' },
        { status: 500 }
      );
    }
    
    console.log('✅ Variáveis de ambiente verificadas');

    // Rate limit
    console.log('🔒 Verificando rate limit...');
    const rl = await standardRateLimit()(request);
    if (rl) {
      console.log('❌ Rate limit excedido');
      return rl;
    }
    console.log('✅ Rate limit OK');

    // Auth por API key simples
    console.log('🔑 Verificando autenticação...');
    const auth = await simpleApiKeyAuth()(request);
    if (auth) {
      console.log('❌ Falha na autenticação');
      return auth;
    }
    console.log('✅ Autenticação OK');

    const contentType = request.headers.get('content-type') || '';
    let body: any = {};
    if (contentType.includes('application/json')) {
      try { body = await request.json(); } catch { body = {}; }
    }

    const project = (body?.project || 'virtualchat-b0e17') as AllowedProject;
    console.log(`📊 Projeto selecionado: ${project}`);
    
    if (!Object.keys(PROJECT_COLLECTIONS).includes(project)) {
      console.log('❌ Projeto inválido:', project);
      return NextResponse.json({ error: 'Projeto inválido' }, { status: 400 });
    }

    console.log('📦 Iniciando exportação das coleções...');
    const exported = await exportCollections(project);
    console.log('✅ Exportação concluída');
    const json = JSON.stringify(exported, null, 2);
    console.log(`📄 JSON gerado: ${Buffer.byteLength(json, 'utf-8')} bytes`);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    
    // Gerar ficheiro Markdown com informações do backup
    console.log('📝 Gerando ficheiro Markdown...');
    const markdownContent = generateBackupMarkdown(project, exported, now);
    
    // Upload do ficheiro JSON
    console.log('☁️ Fazendo upload do ficheiro JSON...');
    const jsonPath = `backups/${project}/${dateStr}/firestore-backup-${timestamp}.json`;
    const jsonUrl = await uploadBufferToAmen(jsonPath, Buffer.from(json, 'utf-8'));
    console.log('✅ Upload JSON concluído:', jsonUrl);
    
    // Upload do ficheiro Markdown
    console.log('☁️ Fazendo upload do ficheiro Markdown...');
    const mdPath = `backups/${project}/${dateStr}/backup-info-${timestamp}.md`;
    const mdUrl = await uploadBufferToAmen(mdPath, Buffer.from(markdownContent, 'utf-8'));
    console.log('✅ Upload Markdown concluído:', mdUrl);

    console.log('🎉 Backup concluído com sucesso!');
    return NextResponse.json({ 
      success: true, 
      project, 
      jsonUrl, 
      markdownUrl: mdUrl,
      bytes: Buffer.byteLength(json, 'utf-8'),
      markdownBytes: Buffer.byteLength(markdownContent, 'utf-8')
    });
  } catch (error) {
    console.error('❌ Erro no backup Firestore:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}


