/**
 * Funções de sanitização para prevenir vulnerabilidades de segurança
 */

/**
 * Sanitiza um slug para prevenir path traversal e outros ataques
 * Remove caracteres especiais, pontos, barras e outros caracteres perigosos
 * @param slug O slug a ser sanitizado
 * @returns O slug sanitizado
 */
export function sanitizeGuideSlug(slug: string): string {
  if (!slug) return '';
  
  // Remover caracteres não alfanuméricos, exceto hífen e underscore
  // Isso impede path traversal (.., /, \) e outros caracteres especiais
  return slug.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
}

/**
 * Sanitiza um nome de ficheiro para prevenir path traversal e outros ataques
 * @param filename O nome do ficheiro a ser sanitizado
 * @returns O nome do ficheiro sanitizado
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  
  // Remover caminhos e caracteres especiais, preservando extensão
  const sanitized = filename.replace(/[^\w\s.-]/g, '_');
  
  // Garantir que não começa com ponto (ficheiros ocultos)
  return sanitized.replace(/^\.+/, '');
}

/**
 * Valida se um tipo MIME é permitido
 * @param mime O tipo MIME a ser validado
 * @param allowedTypes Array de tipos MIME permitidos
 * @returns true se o tipo MIME é permitido, false caso contrário
 */
export function isAllowedMimeType(mime: string, allowedTypes: string[]): boolean {
  if (!mime) return false;
  
  // Verificar se o tipo MIME está na lista de permitidos
  return allowedTypes.some(type => {
    // Permitir wildcards (e.g., 'image/*')
    if (type.endsWith('/*')) {
      const prefix = type.slice(0, -1);
      return mime.startsWith(prefix);
    }
    return mime === type;
  });
}

/**
 * Verifica se o tamanho do ficheiro está dentro do limite
 * @param size Tamanho do ficheiro em bytes
 * @param maxSize Tamanho máximo permitido em bytes
 * @returns true se o tamanho é permitido, false caso contrário
 */
export function isAllowedFileSize(size: number, maxSize: number): boolean {
  return size > 0 && size <= maxSize;
}
