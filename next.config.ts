import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evitar repassar variáveis env manualmente; o Next já expõe NEXT_PUBLIC_ automaticamente
  // Removido bloco env para reduzir risco de exposição indevida
  
  //Remover logs de console em produção (mantém apenas errors)
  compiler: {
    removeConsole: { exclude: ['error'] }
  },
  /* config options here */
  // basePath: '/portugaldospequenitos',
  // assetPrefix: '/portugaldospequenitos',
  // Sem redirects: a página principal renderiza diretamente o guia
  
  // Configuração para imagens de domínios externos
  images: {
    domains: [
      'visitfoods.pt',
      'virtualguide.info',
      'lhwp3192.webapps.net',
      'companhiaportuguesa.pt',
      'www.companhiaportuguesa.pt'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'visitfoods.pt',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'virtualguide.info',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lhwp3192.webapps.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'companhiaportuguesa.pt',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.companhiaportuguesa.pt',
        port: '',
        pathname: '/**',
      }
    ],
  },

  // Configuração para servir ficheiros VTT com o Content-Type correto
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const csp = [
      "default-src 'self'",
      // Em dev, Next/webpack requer 'unsafe-eval'; em produção não permitimos
      `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://cdn.jsdelivr.net`,
      "style-src 'self' 'unsafe-inline'",
      // Fonts locais e embutidas
      "font-src 'self' data:",
      // Permitir web workers gerados via blob (necessário para hls.js com enableWorker)
      "worker-src 'self' blob:",
      // Imagens do próprio site e domínios configurados
      "img-src 'self' data: blob: https://visitfoods.pt https://virtualguide.info https://lhwp3192.webapps.net https://firebasestorage.googleapis.com https://videodelivery.net https://*.cloudflarestream.com https://www.google.com https://*.gstatic.com https://companhiaportuguesa.pt https://www.companhiaportuguesa.pt https://*.b-cdn.net https:",
      // Cloudflare Stream, VideoDelivery e Bunny Stream
      "media-src 'self' blob: https://videodelivery.net https://*.cloudflarestream.com https://*.b-cdn.net",
      "frame-src 'self' https://iframe.videodelivery.net https://*.cloudflarestream.com https://iframe.mediadelivery.net",
      // Conexões de API externas necessárias (Cloudflare, Bunny Stream, Firebase, etc.)
      "connect-src 'self' https://openrouter.ai https://videodelivery.net https://iframe.videodelivery.net https://*.cloudflarestream.com https://firestore.googleapis.com wss://firestore.googleapis.com https://*.googleapis.com https://www.gstatic.com https://cdn.jsdelivr.net https://video.bunnycdn.com https://*.b-cdn.net https://iframe.mediadelivery.net",
    ].join('; ');

    return [
      // Cabeçalhos de segurança globais (conservadores)
      {
        source: '/:path*',
        headers: [
          // Impedir clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Evitar MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Controlar envio de referrer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // CSP conservativa; permitir self, inline mínimo e frames/medias de domínios usados
          { key: 'Content-Security-Policy', value: csp }
        ]
      },
      {
        source: '/legendas.vtt',
        headers: [
          { key: 'Content-Type', value: 'text/vtt; charset=utf-8' },
          // CORS restrito: permitir apenas origens conhecidas
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ALLOWED_ORIGIN_1 || 'https://virtualguide.info' },
        ],
      },
      {
        source: '/legendas-desktop.vtt',
        headers: [
          { key: 'Content-Type', value: 'text/vtt; charset=utf-8' },
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ALLOWED_ORIGIN_1 || 'https://virtualguide.info' },
        ],
      },
      {
        source: '/legendas-mobile.vtt',
        headers: [
          { key: 'Content-Type', value: 'text/vtt; charset=utf-8' },
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ALLOWED_ORIGIN_1 || 'https://virtualguide.info' },
        ],
      },
      {
        source: '/legendas-tablet.vtt',
        headers: [
          { key: 'Content-Type', value: 'text/vtt; charset=utf-8' },
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ALLOWED_ORIGIN_1 || 'https://virtualguide.info' },
        ],
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;