import { NextRequest, NextResponse } from 'next/server';
const nodemailer = require('nodemailer');
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';
import { requireApiKeyAuth } from '@/middleware/apiKeyMiddleware';

export const runtime = 'nodejs';

// Configuração do transporter SMTP com capacidade de override
const createTransporter = (overrides: Partial<any> = {}) => {
  const portFromEnv = parseInt(process.env.SMTP_PORT || '587');
  const secureFromEnv =
    typeof process.env.SMTP_SECURE === 'string'
      ? process.env.SMTP_SECURE === 'true'
      : portFromEnv === 465; // heurística comum: 465 => secure

  const baseConfig: any = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: portFromEnv,
    secure: secureFromEnv, // true para 465, false para outras portas
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Configurações de segurança TLS/SSL
    tls: {
      rejectUnauthorized: true, // rejeitar certificados inválidos
      ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256'
    },
    // Timeouts mais largos para servidores lentos
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  };

  const finalConfig = { ...baseConfig, ...overrides };
  return nodemailer.createTransport(finalConfig);
};

// Utilitário simples para gerar um rótulo legível a partir da chave
const humanizeKey = (key: string) => {
  try {
    const cleaned = key
      .replace(/^custom_\d+_?/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^(\w)/, (m) => m.toUpperCase());
    return cleaned || 'Campo';
  } catch {
    return 'Campo';
  }
};

// Validação robusta de email
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Sanitização de dados para logs
const sanitizeForLog = (data: any): any => {
  if (typeof data === 'string') {
    // Mascarar emails em logs
    return data.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@$2');
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('pass') || key.toLowerCase().includes('password')) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitizeForLog(value);
      }
    }
    return sanitized;
  }
  return data;
};

// Função para gerar template HTML do email
const generateEmailTemplate = (
  formData: Record<string, string>,
  guideName: string,
  guideSlug?: string,
  fieldLabels?: Record<string, string>,
  companyName?: string,
  companyIconURL?: string,
  selectedLanguage?: string,
  emailSubject?: string,
  emailSubjectLabels?: Record<string, string>,
  emailText?: string,
  emailTextLabels?: Record<string, string>,
  emailTextTitle?: string,
  emailTextTitleLabels?: Record<string, string>
) => {
  const fields = Object.entries(formData)
    .filter(([key, value]) => value && value.trim() !== '')
    .map(([key, value]) => {
      // Descobrir rótulo do campo baseado no idioma
      const getDefaultLabels = (lang?: string) => {
        const labels: Record<string, Record<string, string>> = {
          pt: {
            name: 'Nome',
            email: 'Email',
            phone: 'Telefone',
            date: 'Data pretendida',
            people: 'Número de pessoas',
            notes: 'Notas'
          },
          en: {
            name: 'Name',
            email: 'Email',
            phone: 'Phone',
            date: 'Preferred Date',
            people: 'Number of People',
            notes: 'Notes'
          },
          es: {
            name: 'Nombre',
            email: 'Email',
            phone: 'Teléfono',
            date: 'Fecha Preferida',
            people: 'Número de Personas',
            notes: 'Notas'
          },
          fr: {
            name: 'Nom',
            email: 'Email',
            phone: 'Téléphone',
            date: 'Date Préférée',
            people: 'Nombre de Personnes',
            notes: 'Notes'
          }
        };
        return labels[lang as keyof typeof labels] || labels.pt;
      };
      const defaultLabels = getDefaultLabels(selectedLanguage);
      const label = (fieldLabels && fieldLabels[key]) || defaultLabels[key] || humanizeKey(key);
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;">
            ${label}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd;">
            ${value}
          </td>
        </tr>
      `;
    }).join('');

  const headerLogoHtml = ((): string => {
    try {
      const src = String(companyIconURL || '').trim();
      if (src && /^https?:\/\//i.test(src)) {
        return `<div style="text-align:center;margin-bottom:16px;"><img src="${src}" alt="Logo" style="max-width:140px; max-height:60px; border-radius:8px;" /></div>`;
      }
    } catch {}
    return '';
  })();

  const companyForTitle = (companyName || guideName || 'Guia Virtual');
  const origemText = `Formulário Virtual Sommelier - ${companyForTitle}`;

  // Textos baseados no idioma ou campos personalizados do backoffice
  const getEmailTexts = (lang?: string, customSubject?: string, customText?: string, customTextTitle?: string, customSubjectLabels?: Record<string, string>, customTextLabels?: Record<string, string>, customTextTitleLabels?: Record<string, string>) => {
    const defaultTexts: Record<string, Record<string, string>> = {
      pt: {
        title: 'Novo Pedido de Orçamento - Guia Virtual',
        subtitle: 'Recebeu um novo pedido de orçamento através do formulário virtual.',
        clientData: 'Dados do Cliente:',
        requestDate: 'Data do pedido:',
        origin: 'Origem:',
        footer: 'Este email foi enviado automaticamente pelo sistema Virtual Sommelier.'
      },
      en: {
        title: 'New Budget Request - Virtual Guide',
        subtitle: 'You have received a new budget request through the virtual form.',
        clientData: 'Client Data:',
        requestDate: 'Request Date:',
        origin: 'Origin:',
        footer: 'This email was sent automatically by the Virtual Sommelier system.'
      },
      es: {
        title: 'Nueva Solicitud de Presupuesto - Guía Virtual',
        subtitle: 'Ha recibido una nueva solicitud de presupuesto a través del formulario virtual.',
        clientData: 'Datos del Cliente:',
        requestDate: 'Fecha de Solicitud:',
        origin: 'Origen:',
        footer: 'Este correo fue enviado automáticamente por el sistema Virtual Sommelier.'
      },
      fr: {
        title: 'Nouvelle Demande de Devis - Guide Virtuel',
        subtitle: 'Vous avez reçu une nouvelle demande de devis via le formulaire virtuel.',
        clientData: 'Données du Client:',
        requestDate: 'Date de Demande:',
        origin: 'Origine:',
        footer: 'Cet email a été envoyé automatiquement par le système Virtual Sommelier.'
      }
    };
    
    const defaultText = defaultTexts[lang as keyof typeof defaultTexts] || defaultTexts.pt;
    
    // Usar campos personalizados do backoffice se disponíveis
    return {
      title: (customSubjectLabels && lang && customSubjectLabels[lang]) || customSubject || defaultText.title,
      subtitle: (customTextLabels && lang && customTextLabels[lang]) || customText || defaultText.subtitle,
      clientData: (customTextTitleLabels && lang && customTextTitleLabels[lang]) || customTextTitle || defaultText.clientData,
      requestDate: defaultText.requestDate,
      origin: defaultText.origin,
      footer: defaultText.footer
    };
  };

  const emailTexts = getEmailTexts(selectedLanguage, emailSubject, emailText, emailTextTitle, emailSubjectLabels, emailTextLabels, emailTextTitleLabels);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${emailTexts.title} - ${companyForTitle}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        ${headerLogoHtml}
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top:0;">🎯 ${emailTexts.title} - ${companyForTitle}</h2>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          ${emailTexts.subtitle}
        </p>
        
        <h3 style="color: #34495e; margin-top: 30px;">📋 ${emailTexts.clientData}</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #fff;">
          ${fields}
        </table>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #3498db;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            <strong>📅 ${emailTexts.requestDate}</strong> ${new Date().toLocaleString(selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'es' ? 'es-ES' : selectedLanguage === 'fr' ? 'fr-FR' : 'pt-PT')}
          </p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
            <strong>🌐 ${emailTexts.origin}</strong> ${origemText}
          </p>
          
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          ${emailTexts.footer}
        </p>
      </div>
    </body>
    </html>
  `;
};

export async function POST(request: NextRequest) {
  try {
    // Headers de segurança
    const response = NextResponse.next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Aplicar autenticação de API
    const authResult = await requireApiKeyAuth()(request);
    if (authResult) {
      return authResult;
    }

    // Aplicar rate limiting
    const rateLimitResult = await standardRateLimit()(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Suportar tanto JSON como multipart/form-data com anexos
    const contentType = request.headers.get('content-type') || '';
    let toEmail: string = '';
    let formData: Record<string, string> = {};
    let guideName: string = 'Guia Virtual';
    let guideSlug: string | undefined;
    let fieldLabels: Record<string, string> | undefined;
    let companyName: string | undefined;
    let companyIconURL: string | undefined;
    let selectedLanguage: string | undefined;
    let emailSubject: string | undefined;
    let emailSubjectLabels: Record<string, string> | undefined;
    let emailTextTitle: string | undefined;
    let emailTextTitleLabels: Record<string, string> | undefined;
    let emailText: string | undefined;
    let emailTextLabels: Record<string, string> | undefined;
    let attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData();
      toEmail = String(fd.get('toEmail') || '');
      guideName = String(fd.get('guideName') || 'Guia Virtual');
      guideSlug = (fd.get('guideSlug') || undefined) as any;
      companyName = (fd.get('companyName') || undefined) as any;
      companyIconURL = (fd.get('companyIconURL') || undefined) as any;
      selectedLanguage = String(fd.get('selectedLanguage') || 'pt');
      emailSubject = (fd.get('emailSubject') || undefined) as any;
      emailSubjectLabels = JSON.parse(String(fd.get('emailSubjectLabels') || '{}'));
      emailTextTitle = (fd.get('emailTextTitle') || undefined) as any;
      emailTextTitleLabels = JSON.parse(String(fd.get('emailTextTitleLabels') || '{}'));
      emailText = (fd.get('emailText') || undefined) as any;
      emailTextLabels = JSON.parse(String(fd.get('emailTextLabels') || '{}'));
      fieldLabels = JSON.parse(String(fd.get('fieldLabels') || '{}'));
      try { formData = JSON.parse(String(fd.get('formData') || '{}')); } catch { formData = {}; }
      // extrair ficheiros: chaves que começam por 'file:'
      for (const [key, value] of fd.entries()) {
        if (typeof value === 'object' && key.startsWith('file:')) {
          const file = value as unknown as File;
          const arrayBuffer = await file.arrayBuffer();
          attachments.push({ filename: file.name || 'anexo', content: Buffer.from(arrayBuffer), contentType: file.type || undefined });
        }
      }
    } else {
      const body = await request.json();
      ({ toEmail, formData, guideName = 'Guia Virtual', guideSlug, fieldLabels, companyName, companyIconURL, selectedLanguage, emailSubject, emailSubjectLabels, emailTextTitle, emailTextTitleLabels, emailText, emailTextLabels } = body);
    }

    // Validações
    if (!toEmail || !formData) {
      return NextResponse.json(
        { error: 'Email de destino e dados do formulário são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar formato dos emails
    const forwardEmails = toEmail
      .split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email && email.includes('@'));

    // Verificar se todos os emails são válidos
    const invalidEmails = forwardEmails.filter((email: string) => !validateEmail(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Emails inválidos: ${invalidEmails.join(', ')}` },
        { status: 400 }
      );
    }

    // Lista final: apenas emails de reencaminhamento configurados no backoffice
    const emailList = forwardEmails;

    // Verificar se as variáveis de ambiente do SMTP estão configuradas
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('❌ Variáveis de ambiente SMTP não configuradas');
      return NextResponse.json(
        { error: 'Configuração de email não disponível' },
        { status: 500 }
      );
    }

    // Logs sanitizados para segurança
    console.log('📧 Configurando envio de email...');
    console.log('📬 Emails de destino:', forwardEmails.length, 'destinatários');
    console.log('📍 Guia:', sanitizeForLog({ guideName, guideSlug }));

    // Criar transporter (tentativa 1: método padrão)
    let transporter = createTransporter();

    // Verificar conexão SMTP com fallback para AUTH LOGIN
    try {
      console.log('🔍 Verificando conexão SMTP (AUTH padrão)...');
      await transporter.verify();
      console.log('✅ Conexão SMTP verificada (AUTH padrão)');
    } catch (error: any) {
      console.error('❌ Verificação SMTP falhou (AUTH padrão):', error);

      // Se rejeitou com AUTH PLAIN/535, tentar forçar LOGIN
      const authError = String(error?.response || error?.message || '').toLowerCase();
      if (authError.includes('535') || authError.includes('auth plain') || authError.includes('authentication rejected')) {
        console.log('↩️ Tentando novamente com authMethod=LOGIN...');
        transporter = createTransporter({ authMethod: 'LOGIN' });
        try {
          await transporter.verify();
          console.log('✅ Conexão SMTP verificada (AUTH LOGIN)');
        } catch (err: any) {
          console.error('❌ Verificação SMTP falhou (AUTH LOGIN):', err);
          return NextResponse.json(
            { 
              error: 'Falha na autenticação SMTP',
              details: err?.response || err?.message || 'Erro desconhecido',
            },
            { status: 500 }
          );
        }
      } else {
        // Tratamento específico para erros de certificado
        if (String(error?.message || '').includes('certificate')) {
          return NextResponse.json(
            { 
              error: 'Erro de certificado SSL - configuração de segurança do servidor SMTP',
              details: 'O certificado SSL do servidor não corresponde ao hostname configurado'
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { 
            error: 'Falha na configuração do servidor de email',
            details: error?.message || 'Erro desconhecido'
          },
          { status: 500 }
        );
      }
    }

    // Gerar template HTML
    const htmlContent = generateEmailTemplate(formData, guideName, guideSlug, fieldLabels, companyName, companyIconURL, selectedLanguage, emailSubject, emailSubjectLabels, emailText, emailTextLabels, emailTextTitle, emailTextTitleLabels);

    // Enviar email para todos os destinatários
    console.log('📤 Preparando envio de emails...');
    const emailPromises = emailList.map(async (email, index) => {
      console.log(`📧 Enviando email ${index + 1}/${emailList.length} para: ${sanitizeForLog(email)}`);
      
      const mailOptions = {
        from: {
          name: 'Virtual Sommelier',
          address: process.env.SMTP_USER
        },
        to: email,
        subject: `🎯 ${emailSubject || (selectedLanguage === 'en' ? 'New Budget Request' : selectedLanguage === 'es' ? 'Nueva Solicitud de Presupuesto' : selectedLanguage === 'fr' ? 'Nouvelle Demande de Devis' : 'Novo Pedido de Orçamento')} - ${companyName || guideName}`,
        html: htmlContent,
        attachments: attachments,
        // Versão texto simples como fallback
        text: `
${selectedLanguage === 'en' ? 'New Budget Request' : selectedLanguage === 'es' ? 'Nueva Solicitud de Presupuesto' : selectedLanguage === 'fr' ? 'Nouvelle Demande de Devis' : 'Novo Pedido de Orçamento'} - Guia Virtual - ${companyName || guideName}
${guideSlug ? `Guia: ${guideSlug}` : ''}

${selectedLanguage === 'en' ? 'Client Data:' : selectedLanguage === 'es' ? 'Datos del Cliente:' : selectedLanguage === 'fr' ? 'Données du Client:' : 'Dados do Cliente:'}
${Object.entries(formData)
  .filter(([key, value]) => value && String(value).trim() !== '')
  .map(([key, value]) => {
    const getDefaultLabels = (lang?: string) => {
      const labels: Record<string, Record<string, string>> = {
        pt: { name: 'Nome', email: 'Email', phone: 'Telefone', date: 'Data pretendida', people: 'Número de pessoas', notes: 'Notas' },
        en: { name: 'Name', email: 'Email', phone: 'Phone', date: 'Preferred Date', people: 'Number of People', notes: 'Notes' },
        es: { name: 'Nombre', email: 'Email', phone: 'Teléfono', date: 'Fecha Preferida', people: 'Número de Personas', notes: 'Notas' },
        fr: { name: 'Nom', email: 'Email', phone: 'Téléphone', date: 'Date Préférée', people: 'Nombre de Personnes', notes: 'Notes' }
      };
      return labels[lang as keyof typeof labels] || labels.pt;
    };
    const defaultLabels = getDefaultLabels(selectedLanguage);
    const label = (fieldLabels && fieldLabels[key]) || defaultLabels[key] || humanizeKey(key);
    return `${label}: ${value}`;
  })
  .join('\n')}

${selectedLanguage === 'en' ? 'Date:' : selectedLanguage === 'es' ? 'Fecha:' : selectedLanguage === 'fr' ? 'Date:' : 'Data:'} ${new Date().toLocaleString(selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'es' ? 'es-ES' : selectedLanguage === 'fr' ? 'fr-FR' : 'pt-PT')}
${selectedLanguage === 'en' ? 'Origin:' : selectedLanguage === 'es' ? 'Origen:' : selectedLanguage === 'fr' ? 'Origine:' : 'Origem:'} Formulário Virtual Sommelier - ${companyName || guideName}
        `
      };

      try {
        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ Email enviado com sucesso para ${sanitizeForLog(email)}:`, result.messageId);
        return result;
      } catch (error) {
        console.error(`❌ Erro ao enviar email para ${sanitizeForLog(email)}:`, error);
        throw error;
      }
    });

    // Aguardar todos os emails serem enviados
    const results = await Promise.all(emailPromises);
    
    console.log('Emails enviados com sucesso:', results.map(r => r.messageId));
    
    return NextResponse.json({
      success: true,
      messageIds: results.map(r => r.messageId),
      emailsSent: emailList.length,
      forwardEmails: forwardEmails.length,
      message: `Email enviado com sucesso para ${emailList.length} destinatário(s) configurado(s) no backoffice`
    }, {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    });

  } catch (error) {
    console.error('Erro ao enviar email:', error);
    
    return NextResponse.json(
      { 
        error: 'Falha ao enviar email',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { 
        status: 500,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
      }
    );
  }
}
