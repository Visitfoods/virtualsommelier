'use client';

import React, { useMemo, useState } from 'react';
import styles from '../backoffice.module.css';

export type CacheRow = { slug: string; websiteUrl: string; pages: number; timestamp: number; expiresAt: number };

function resolveBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

export default function ScrapeClient({ rows }: { rows: CacheRow[] }) {
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || process.env.SIMPLE_API_KEY || '';
  const base = useMemo(() => resolveBaseUrl(), []);

  const runOne = async (slug: string) => {
    try {
      setBusySlug(slug);
      const url = new URL('/api/scheduled-scraping', base);
      url.searchParams.set('action', 'runForGuide');
      url.searchParams.set('slug', slug);
      if (apiKey) url.searchParams.set('apiKey', apiKey);
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { ...(apiKey ? { 'x-api-key': apiKey } : {}) },
        cache: 'no-store',
      });
      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok || data?.ok !== true) throw new Error(String(data?.error || `HTTP ${resp.status}`));
      alert(`Scraping concluído para ${slug}.`);
      window.location.reload();
    } catch (e: any) {
      alert(`Erro ao executar scraping de ${slug}: ${e?.message || e}`);
    } finally {
      setBusySlug(null);
    }
  };

  const runAll = async () => {
    try {
      setBusyAll(true);
      const url = new URL('/api/scheduled-scraping', base);
      url.searchParams.set('action', 'run');
      if (apiKey) url.searchParams.set('apiKey', apiKey);
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { ...(apiKey ? { 'x-api-key': apiKey } : {}) },
        cache: 'no-store',
      });
      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok || data?.ok !== true) throw new Error(String(data?.error || `HTTP ${resp.status}`));
      alert('Scraping de todos os guias concluído.');
      window.location.reload();
    } catch (e: any) {
      alert(`Erro ao executar scraping de todos os guias: ${e?.message || e}`);
    } finally {
      setBusyAll(false);
    }
  };

  return (
    <div className={styles.dataCard}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className={styles.actionBtn} onClick={runAll} disabled={busyAll || !!busySlug}>
          {busyAll ? 'A executar…' : 'Executar scraping de todos os guias'}
        </button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Guia</th>
              <th>Website</th>
              <th>Páginas</th>
              <th>Último scraping</th>
              <th>Expira</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.slug}>
                <td>{c.slug}</td>
                <td style={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.websiteUrl}</td>
                <td>{c.pages}</td>
                <td>{c.timestamp ? new Date(c.timestamp).toLocaleString('pt-PT') : '-'}</td>
                <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleString('pt-PT') : '-'}</td>
                <td>
                  <button className={styles.actionBtn} onClick={() => runOne(c.slug)} disabled={busyAll || busySlug === c.slug}>
                    {busySlug === c.slug ? 'A executar…' : 'Executar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}





