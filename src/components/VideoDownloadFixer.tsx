'use client';

import { useState } from 'react';

interface VideoDownloadFixerProps {
  videoUrl: string;
  onFixed?: (newUrl: string) => void;
}

export default function VideoDownloadFixer({ videoUrl, onFixed }: VideoDownloadFixerProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [status, setStatus] = useState<{
    downloadable: boolean;
    message: string;
    videoData?: any;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extrair UID do URL do Cloudflare
  const extractUid = (url: string): string | null => {
    const match = url.match(/videodelivery\.net\/([a-f0-9]+)/);
    return match ? match[1] : null;
  };

  const uid = extractUid(videoUrl);

  if (!uid) {
    return (
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#f8d7da', 
        border: '1px solid #f5c6cb',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#721c24'
      }}>
        ❌ URL não é do Cloudflare Stream
      </div>
    );
  }

  const checkVideoStatus = async () => {
    setIsChecking(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/fix-video-downloads?uid=${uid}`, {
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsChecking(false);
    }
  };

  const fixVideoDownloads = async () => {
    setIsFixing(true);
    setError(null);

    try {
      const response = await fetch('/api/fix-video-downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: JSON.stringify({ uid }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
      
      if (data.success && data.downloadable) {
        // Notificar componente pai sobre a correção
        if (onFixed && data.mp4Url) {
          onFixed(data.mp4Url);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div style={{ 
      marginTop: '10px', 
      padding: '10px', 
      backgroundColor: '#f8f9fa', 
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      fontSize: '12px'
    }}>
      <div style={{ marginBottom: '10px' }}>
        <strong>🔧 Verificar Downloads MP4</strong>
        <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>
          UID: {uid}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <button
          onClick={checkVideoStatus}
          disabled={isChecking || isFixing}
          style={{
            padding: '6px 12px',
            backgroundColor: isChecking ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: isChecking || isFixing ? 'not-allowed' : 'pointer',
            fontSize: '11px'
          }}
        >
          {isChecking ? '⏳ Verificando...' : '🔍 Verificar'}
        </button>

        {status && !status.downloadable && (
          <button
            onClick={fixVideoDownloads}
            disabled={isFixing || isChecking}
            style={{
              padding: '6px 12px',
              backgroundColor: isFixing ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: isFixing || isChecking ? 'not-allowed' : 'pointer',
              fontSize: '11px'
            }}
          >
            {isFixing ? '⏳ Corrigindo...' : '🔧 Corrigir'}
          </button>
        )}
      </div>

      {status && (
        <div style={{ 
          padding: '8px', 
          backgroundColor: status.downloadable ? '#d4edda' : '#fff3cd',
          border: `1px solid ${status.downloadable ? '#c3e6cb' : '#ffeaa7'}`,
          borderRadius: '3px',
          marginBottom: '8px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {status.downloadable ? '✅ Downloads Ativos' : '⚠️ Downloads Inativos'}
          </div>
          <div style={{ fontSize: '11px' }}>
            {status.message}
          </div>
          {status.videoData && (
            <div style={{ fontSize: '10px', marginTop: '4px', color: '#6c757d' }}>
              <div>Tamanho: {status.videoData.size ? `${(status.videoData.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</div>
              <div>Duração: {status.videoData.duration ? `${status.videoData.duration}s` : 'N/A'}</div>
              <div>Status: {status.videoData.status || 'N/A'}</div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '8px', 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb',
          borderRadius: '3px',
          color: '#721c24'
        }}>
          <strong>❌ Erro:</strong> {error}
        </div>
      )}

      {status?.downloadable && (
        <div style={{ 
          padding: '6px', 
          backgroundColor: '#d1ecf1', 
          border: '1px solid #bee5eb',
          borderRadius: '3px',
          fontSize: '10px'
        }}>
          <strong>🔗 URL MP4:</strong><br/>
          <code style={{ wordBreak: 'break-all' }}>
            {status.mp4Url || `https://videodelivery.net/${uid}/downloads/default.mp4`}
          </code>
        </div>
      )}
    </div>
  );
}


