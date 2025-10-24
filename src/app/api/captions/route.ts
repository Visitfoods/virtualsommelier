import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const src = searchParams.get('src');
		if (!src) {
			return new Response('Missing src', { status: 400 });
		}

		let targetUrl: URL;
		try {
			targetUrl = new URL(src);
		} catch {
			return new Response('Invalid URL', { status: 400 });
		}

		if (!(targetUrl.protocol === 'http:' || targetUrl.protocol === 'https:')) {
			return new Response('Unsupported protocol', { status: 400 });
		}

		const upstream = await fetch(targetUrl.toString(), {
			method: 'GET',
			headers: {
				'User-Agent': 'VirtualGuide/1.0 (+captions-proxy)'
			},
			cache: 'no-store',
			next: { revalidate: 0 }
		});

		if (!upstream.ok) {
			return new Response('Failed to fetch captions', { status: upstream.status });
		}

		const contentType = upstream.headers.get('content-type') || 'text/vtt; charset=utf-8';
		const body = await upstream.arrayBuffer();

		return new Response(body, {
			status: 200,
			headers: {
				'Content-Type': contentType.includes('text') ? contentType : 'text/vtt; charset=utf-8',
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'public, max-age=60'
			}
		});
	} catch (err) {
		return new Response('Internal error', { status: 500 });
	}
}

export const dynamic = 'force-dynamic';


