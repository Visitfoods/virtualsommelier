import type { Metadata } from 'next';

// Nota: CSS global já é importado no layout raiz em `src/app/layout.tsx`.

export const metadata: Metadata = {
  title: 'Backoffice - Guia Real',
  description: 'Painel administrativo para gerenciar conversas do Guia Real',
};

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Em layouts de segmento do App Router não devemos renderizar <html> ou <body>.
  // Apenas devolver os children garante que não há nested <html>/<body> e evita hydration errors.
  return children;
}