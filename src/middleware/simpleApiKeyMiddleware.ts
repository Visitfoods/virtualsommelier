import { NextRequest, NextResponse } from 'next/server';

export const simpleApiKeyAuth = () => {
  return async (request: NextRequest) => {
    try {
      // Verificar se pelo menos uma das chaves API está definida
      const API_KEY = process.env.SIMPLE_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
      const isProd = process.env.NODE_ENV === 'production';
      // Em desenvolvimento, se não existir chave, não bloquear
      if (!API_KEY && !isProd) {
        return null;
      }
      // Em produção, a chave é obrigatória
      if (!API_KEY && isProd) {
        return NextResponse.json(
          { error: 'Configuração de autenticação inválida' },
          { status: 500 }
        );
      }

      // Obter a chave API do header ou query parameter (para compatibilidade)
      const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('apiKey');

      // Se não houver chave, retornar erro
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Chave API não fornecida' },
          { status: 401 }
        );
      }

      // Verificar se a chave é válida
      if (API_KEY && apiKey !== API_KEY) {
        return NextResponse.json(
          { error: 'Chave API inválida' },
          { status: 401 }
        );
      }

      // Se chegou aqui, a autenticação foi bem sucedida
      return null;
    } catch (error) {
      console.error('Erro na autenticação:', error);
      return NextResponse.json(
        { error: 'Erro na autenticação' },
        { status: 500 }
      );
    }
  };
};
