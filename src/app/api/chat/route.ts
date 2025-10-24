import { NextRequest, NextResponse } from "next/server";
import { standardRateLimit } from "@/middleware/rateLimitMiddleware";
import { simpleApiKeyAuth } from "@/middleware/simpleApiKeyMiddleware";

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	try {
    // Rate limit
    const rl = await standardRateLimit()(request);
    if (rl) return rl;

    // Auth via API Key simples
    const auth = await simpleApiKeyAuth()(request);
    if (auth) return auth;

		const body = await request.json();
  const { messages, model = "openai/gpt-4o-mini", max_tokens = 512, temperature = 0.7, top_p = 0.9 } = body as {
			messages: Array<{ role: string; content: string }>;
			model?: string;
			max_tokens?: number;
			temperature?: number;
			top_p?: number;
		};

		if (!Array.isArray(messages) || messages.length === 0) {
			return NextResponse.json({ error: "Mensagens inválidas" }, { status: 400 });
		}

		const apiKey = process.env.OPENROUTER_API_KEY;
		if (!apiKey) {
			return NextResponse.json({ error: "OPENROUTER_API_KEY não configurada" }, { status: 500 });
		}

		const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`,
				"X-Title": "Virtualguide",
			},
			body: JSON.stringify({ messages, model, max_tokens, temperature, top_p }),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			return NextResponse.json({ error: "Falha ao chamar OpenRouter", details: errorBody }, { status: response.status });
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ error: "Erro inesperado", details: errorMessage }, { status: 500 });
	}
}


