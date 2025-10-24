"use client";

import DOMPurify from 'dompurify';

/**
 * Configuração de sanitização de HTML
 * Define quais tags e atributos são permitidos
 */
const sanitizeConfig = {
  ALLOWED_TAGS: [
    // Tags de texto básicas
    'p', 'b', 'i', 'em', 'strong', 'a', 'span', 'br', 'hr',
    // Títulos
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Listas
    'ul', 'ol', 'li',
    // Tabelas simples
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // Formatação básica
    'blockquote', 'pre', 'code',
    // Imagens
    'img',
    // Controlo seguro
    'button'
  ],
  ALLOWED_ATTR: [
    // Atributos básicos
    'id', 'class', 'style',
    // Links
    'href', 'target', 'rel',
    // Imagens
    'src', 'alt', 'title', 'width', 'height',
    // Tabelas
    'colspan', 'rowspan',
    // Botões (sem handlers inline)
    'type', 'disabled',
    // Permitimos data-attrs específicos usados pelo app
    'data-open-ai'
  ],
  // Permitir atributos data-* específicos usados no app (e.g., data-open-ai)
  ALLOW_DATA_ATTR: true,
  // Permitir protocolos seguros para imagens
  ALLOW_UNKNOWN_PROTOCOLS: false,
  // Permitir URLs de imagens de qualquer domínio (mas com validação)
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  // Não permitir formulários
  FORBID_TAGS: ['form', 'input', 'textarea', 'select', 'option', 'script', 'style', 'iframe', 'frame', 'object', 'embed', 'applet'],
  // Não permitir eventos JavaScript
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup', 'onkeypress']
};

/**
 * Sanitiza HTML para prevenir XSS
 * @param html HTML a ser sanitizado
 * @returns HTML sanitizado seguro
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // No servidor, retornar o HTML original (será sanitizado no cliente)
    return html;
  }
  
  // No cliente, sanitizar o HTML
  const cleaned = DOMPurify.sanitize(html, sanitizeConfig);

  // Pós-processamento: reforçar atributos de links e remover links do próprio site
  try {
    const container = document.createElement('div');
    container.innerHTML = cleaned;

    const anchors = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[];
    const selfHost = window.location.host.replace(/^www\./i, '');
    const blockHosts = new Set<string>([selfHost]);

    for (const a of anchors) {
      const rawHref = (a.getAttribute('href') || '').trim();
      if (!rawHref) { a.replaceWith(document.createTextNode(a.textContent || '')); continue; }

      // Normalizar href antes de construir URL absoluto:
      // - Links tipo //dominio.com -> forçar https://
      // - Links tipo www.dominio.com -> prefixar https://
      // - Links tipo dominio.com/rota -> prefixar https://
      let normalizedHref = rawHref;
      if (/^\/\//.test(normalizedHref)) {
        normalizedHref = `https:${normalizedHref}`;
      } else if (/^www\.[^\s]+$/i.test(normalizedHref)) {
        normalizedHref = `https://${normalizedHref}`;
      } else if (
        /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?$/i.test(normalizedHref) &&
        !/^https?:/i.test(normalizedHref) &&
        !/^mailto:|^tel:/i.test(normalizedHref) &&
        !normalizedHref.startsWith('/') &&
        !normalizedHref.startsWith('#')
      ) {
        normalizedHref = `https://${normalizedHref}`;
      }

      // Normalizar URL; suportar relativos usando location como base
      let hrefUrl: URL | null = null;
      try { hrefUrl = new URL(normalizedHref, window.location.href); } catch { hrefUrl = null; }
      if (!hrefUrl) { a.replaceWith(document.createTextNode(a.textContent || '')); continue; }

      const host = hrefUrl.host.replace(/^www\./i, '');
      // Permitir apenas protocolos seguros ou mailto/tel
      if (!/^https?:$/i.test(hrefUrl.protocol) && !/^mailto:|^tel:/i.test(normalizedHref)) {
        a.replaceWith(document.createTextNode(a.textContent || ''));
        continue;
      }

      // Aplicar href normalizado de volta
      a.setAttribute('href', hrefUrl.href);

      // Tornar clicável em nova aba e seguro
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer nofollow');
    }

    return container.innerHTML;
  } catch {
    return cleaned;
  }
}

/**
 * Hook para usar com dangerouslySetInnerHTML de forma segura
 * @param html HTML a ser sanitizado
 * @returns Objeto para usar com dangerouslySetInnerHTML
 */
export function useSanitizedHtml(html: string): { __html: string } {
  return { __html: sanitizeHtml(html) };
}
