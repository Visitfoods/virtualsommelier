import { NextRequest, NextResponse } from 'next/server';
import { translateFaqs } from '@/lib/ai';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { faqData, targetLanguage } = await request.json();

    if (!faqData || !Array.isArray(faqData)) {
      return NextResponse.json(
        { error: 'faqData é obrigatório e deve ser um array' },
        { status: 400 }
      );
    }

    if (!targetLanguage || !['en', 'es', 'fr'].includes(targetLanguage)) {
      return NextResponse.json(
        { error: 'targetLanguage deve ser "en", "es" ou "fr"' },
        { status: 400 }
      );
    }

    const translatedFaqs = await translateFaqs(faqData, targetLanguage);

    return NextResponse.json({ translatedFaqs });
  } catch (error) {
    console.error('Erro na tradução de FAQs:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor na tradução' },
      { status: 500 }
    );
  }
}



