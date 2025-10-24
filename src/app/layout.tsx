import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { mainDb } from "../firebase/mainConfig";
import { AuthProvider } from "../hooks/useAuth";
import { Suspense } from "react";
import RouteTracker from "../components/RouteTracker";

const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const title = 'Virtual Sommelier';
  const description = 'Sistema de guia virtual inteligente com IA da Inov Partner';

  return (
    <html lang="pt">
      <head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/faviconvirtualsommelier.jpg" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffffff" />
        {/* Open Graph defaults (para WhatsApp e redes sociais) */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://virtualguide.info" />
        <meta property="og:site_name" content="Virtual Sommelier" />
        <meta property="og:image" content="https://virtualguide.info/favicon.jpg" />
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://virtualguide.info/favicon.jpg" />
        {/* Canonical */}
        <link rel="canonical" href="https://virtualguide.info" />
      </head>
      <body className={`${montserrat.variable} font-montserrat`}>
        <AuthProvider>
          <Suspense fallback={null}>
            <RouteTracker />
          </Suspense>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
} 
