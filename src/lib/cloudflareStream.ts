// Cloudflare Stream helpers
// Implementa upload direto (multipart) e utilitários usados nas rotas API

type CloudflareApiResult<T> = {
	success: boolean;
	errors?: Array<{ code: number; message: string }>;
	messages?: Array<{ code?: number; message: string }>;
	result: T;
};

interface CloudflareStreamVideo {
	uid: string;
	status?: any;
	readyToStream?: boolean;
	meta?: any;
	thumbnail?: string;
	preview?: string;
	playback?: {
		hls?: string;
		dash?: string;
	};
}

const getAccountId = (): string => {
	return (
		process.env.CLOUDFLARE_ACCOUNT_ID ||
		process.env.CF_ACCOUNT_ID ||
		process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID ||
		''
	);
};

const getApiToken = (): string => {
	return (
		process.env.CLOUDFLARE_API_TOKEN ||
		process.env.CF_STREAM_API_TOKEN ||
		process.env.CF_API_TOKEN ||
		''
	);
};

function assertEnv() {
	const account = getAccountId();
	const token = getApiToken();
	if (!account || !token) {
		throw new Error('Cloudflare Stream: CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_API_TOKEN não definidos');
	}
}

export async function uploadVideoBufferToCloudflare(buffer: Buffer, fileName: string) {
	assertEnv();
	const accountId = getAccountId();
	const token = getApiToken();

	// Construir FormData (Node 18+ possui Blob/FormData nativas)
	const blob = new Blob([buffer]);
	const form = new FormData();
	form.append('file', blob, fileName);
	// Tornar público por omissão; os controlos finos podem ser feitos depois
	form.append('requireSignedURLs', 'false');
	form.append('allowedOrigins', JSON.stringify([]));

	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: form,
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Cloudflare Stream upload falhou: HTTP ${res.status} ${res.statusText} — ${text.slice(0, 300)}`);
	}

	const data = (await res.json()) as CloudflareApiResult<CloudflareStreamVideo>;
	if (!data?.success || !data?.result?.uid) {
		throw new Error(`Cloudflare Stream upload sem sucesso: ${JSON.stringify(data?.errors || data, null, 2)}`);
	}

	const uid = data.result.uid;
	return {
		uid,
		iframe: `https://iframe.videodelivery.net/${uid}`,
		hls: `https://videodelivery.net/${uid}/manifest/video.m3u8`,
		dash: `https://videodelivery.net/${uid}/manifest/video.mpd`,
		preview: data.result.preview || data.result.thumbnail || '',
		result: data.result,
	};
}

export async function getCloudflareVideoStatus(uid: string) {
	assertEnv();
	const accountId = getAccountId();
	const token = getApiToken();
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	if (!res.ok) return null;
	const json = (await res.json()) as CloudflareApiResult<any>;
	return json;
}

export async function setCloudflareVideoDownloadable(uid: string, downloadable: boolean) {
	assertEnv();
	const accountId = getAccountId();
	const token = getApiToken();
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`;
	const res = await fetch(url, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ meta: { downloadable } }),
	});
	return res.ok;
}

export async function setCloudflareVideoPublicAndDownloadable(uid: string) {
	assertEnv();
	const accountId = getAccountId();
	const token = getApiToken();
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`;
	const res = await fetch(url, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ requireSignedURLs: false, meta: { downloadable: true } }),
	});
	return res.ok;
}

export async function requestCloudflareMp4Download(uid: string) {
	// Best-effort: endpoint de downloads para gerar MP4
	assertEnv();
	const accountId = getAccountId();
	const token = getApiToken();
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`;
	const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
	return res.ok;
}

export async function waitUntilMp4Ready(uid: string, { maxTries = 15, intervalMs = 2000 } = {}) {
	for (let i = 0; i < maxTries; i++) {
		const status = await getCloudflareVideoStatus(uid);
		const state = (status as any)?.result?.status?.state || (status as any)?.result?.status;
		if (state === 'ready' || state === 'live-inprogress') return true;
		await new Promise(r => setTimeout(r, intervalMs));
	}
	return false;
}


// Apagar um vídeo do Cloudflare Stream
export async function deleteCloudflareVideo(uid: string): Promise<boolean> {
  assertEnv();
  const accountId = getAccountId();
  const token = getApiToken();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return res.ok;
}


// Cria um URL de direct upload (browser -> Cloudflare) evitando passar pelo servidor
export async function createCloudflareDirectUpload(params?: {
	fileName?: string;
	mimeType?: string;
	requireSignedURLs?: boolean;
	allowedOrigins?: string[];
	metadata?: Record<string, unknown>;
  maxDurationSeconds?: number;
}) {
	assertEnv();
	const accountId = getAccountId();
	const token = getApiToken();

	const baseBody: any = {
    // Algumas contas exigem explicitamente este campo
    maxDurationSeconds: params?.maxDurationSeconds ?? 3600, // 1 hora por omissão
	};
  // Só incluir opcionais se fornecidos para evitar falhas de validação em contas antigas
  if (typeof params?.requireSignedURLs === 'boolean') baseBody.requireSignedURLs = params.requireSignedURLs;
  if (params?.allowedOrigins && params.allowedOrigins.length > 0) baseBody.allowedOrigins = params.allowedOrigins;
  if (params?.fileName) (baseBody as any).creator = params.fileName;
  if (params?.metadata) (baseBody as any).meta = params.metadata;

  // Campos opcionais já tratados acima quando fornecidos (creator/meta)

	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`;
	const res = await fetch(url, {
 		method: 'POST',
 		headers: {
 			Authorization: `Bearer ${token}`,
 			'Content-Type': 'application/json',
 		},
		body: JSON.stringify(baseBody),
 	});

  const raw = await res.text().catch(() => '');
  if (!res.ok) {
    // Tentativa de retrocompatibilidade: enviar somente o campo obrigatório
    try {
      const res2 = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxDurationSeconds: baseBody.maxDurationSeconds }),
      });
      const raw2 = await res2.text().catch(() => '');
      if (!res2.ok) {
        throw new Error(`Cloudflare Stream direct_upload falhou: HTTP ${res.status} ${res.statusText} — ${raw.slice(0, 500)} | Fallback: HTTP ${res2.status} ${res2.statusText} — ${raw2.slice(0, 500)}`);
      }
      // substituir raw pela resposta do fallback
      return ((): any => {
        let json2: any = {};
        try { json2 = JSON.parse(raw2); } catch {}
        const r = json2?.result || {};
        const uid2 = r.uid || r.id;
        const uploadURL2 = r.uploadURL;
        if (!json2?.success || !uploadURL2 || !uid2) {
          throw new Error(`Resposta inválida do direct_upload (fallback): ${raw2.slice(0, 1000)}`);
        }
        return {
          uid: uid2,
          uploadURL: uploadURL2,
          iframe: `https://iframe.videodelivery.net/${uid2}`,
          hls: `https://videodelivery.net/${uid2}/manifest/video.m3u8`,
        };
      })();
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  let json: CloudflareApiResult<{
    id?: string; // algumas respostas usam id
    uid?: string; // outras usam uid
    uploadURL: string;
  }> | any = {};
  try { json = JSON.parse(raw); } catch {}

  const result = json?.result || {};
  const uid = result.uid || result.id;
  const uploadURL = result.uploadURL;
  if (!json?.success || !uploadURL || !uid) {
    throw new Error(`Resposta inválida do direct_upload: ${raw.slice(0, 1000)}`);
  }
  return {
    uid,
    uploadURL,
    iframe: `https://iframe.videodelivery.net/${uid}`,
    hls: `https://videodelivery.net/${uid}/manifest/video.m3u8`,
  };
}

