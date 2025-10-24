"use client";

import React, { useEffect, useState } from 'react';

type PreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

function normalizeUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    return u.href;
  } catch {
    return null;
  }
}

function extractHostname(u?: string) {
  try {
    return u ? new URL(u).hostname : undefined;
  } catch {
    return undefined;
  }
}

export function extractUrlsFromText(text: string): string[] {
  // Apenas URLs explícitas com http/https
  const fullUrlRegex = /(https?:\/\/[^\s<>")']+)/gim;
  const fullUrls = text.match(fullUrlRegex) || [];

  // Links em markdown [texto](url) mas apenas se a URL for http/https
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/gim;
  const markdownUrls: string[] = [];
  let match;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const candidate = match[2].trim();
    if (/^https?:\/\//i.test(candidate)) markdownUrls.push(candidate);
  }

  const all = [...fullUrls.map(u => u.trim()), ...markdownUrls];
  const unique = Array.from(new Set(all.filter(u => u.length > 2)));
  return unique;
}

export default function LinkPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError('URL inválido');
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const q = `/api/link-preview?url=${encodeURIComponent(normalized)}`;
        const res = await fetch(q, { cache: 'no-store' });
        const json = (await res.json()) as PreviewData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError('Falha ao carregar preview');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Preparar imagem com fallback robusto (favicon por domínio)
  useEffect(() => {
    if (!data) return;
    try {
      const host = extractHostname(data.url);
      const favicon = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null;
      setImageSrc(data.image || favicon);
    } catch {
      setImageSrc(data.image || null);
    }
  }, [data]);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  if (error) return null;
  if (!data) return null;

  const hasImage = !!imageSrc;
  const title = data.title || extractHostname(data.url) || 'Link';
  const description = data.description || undefined;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'stretch',
        textDecoration: 'none',
        background: 'rgba(0,0,0,0.05)',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 8,
        color: 'inherit',
        // Layout responsivo: horizontal no desktop, vertical no mobile
        flexDirection: isMobile ? 'column' : 'row',
      }}
    >
      {hasImage && (
        <div style={{ 
          width: isMobile ? '100%' : 96, 
          minWidth: isMobile ? '100%' : 96, 
          height: isMobile ? 200 : 96, 
          background: '#f2f2f2' 
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc || undefined}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => {
              try {
                const host = extractHostname(data.url);
                const fallback = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null;
                if (imageSrc !== fallback) {
                  setImageSrc(fallback);
                  return;
                }
              } catch {}
              setImageSrc(null); // esconder imagem se também falhar o fallback
            }}
          />
        </div>
      )}
      <div style={{ 
        padding: 10, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center',
        flex: 1
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.7)', lineHeight: 1.35 }}>
            {description.length > 180 ? `${description.slice(0, 177)}...` : description}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 6 }}>{extractHostname(data.url)}</div>
      </div>
    </a>
  );
}


