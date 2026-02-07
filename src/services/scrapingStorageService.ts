import { 
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { mainDb } from '../firebase/mainConfig';

export type ScrapedPage = {
  url: string;
  title?: string;
  description?: string;
  text?: string;
  kind?: 'product' | 'page' | 'blog' | 'faq';
};

type ScrapingConfig = {
  maxPages: number;
  maxDepth: number;
  includePatterns?: string[];
  excludePatterns?: string[];
};

type ScrapingDataDoc = {
  id: string;
  guideSlug: string;
  websiteUrl: string;
  domain: string;
  scrapedAt: any;
  expiresAt: any;
  pages: ScrapedPage[];
  status: 'active' | 'expired' | 'processing';
  metadata?: {
    totalPages: number;
    version?: string;
    config?: ScrapingConfig;
  };
};

const COLLECTION = 'scraping_data';

export class ScrapingStorageService {
  static readonly TTL_HOURS = 4;

  static async save(guideSlug: string, websiteUrl: string, pages: ScrapedPage[], config?: ScrapingConfig): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TTL_HOURS * 60 * 60 * 1000);
    const domain = (() => {
      try { return new URL(websiteUrl).hostname; } catch { return ''; }
    })();

    const docData: Omit<ScrapingDataDoc, 'id'> = {
      guideSlug,
      websiteUrl,
      domain,
      scrapedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      pages,
      status: 'active',
      metadata: { totalPages: pages.length, version: '1.0', config },
    };

    const ref = await addDoc(collection(mainDb, COLLECTION), docData as any);
    return ref.id;
  }

  static async getValidByGuide(guideSlug: string): Promise<ScrapedPage[] | null> {
    const now = new Date();
    const q = query(
      collection(mainDb, COLLECTION),
      where('guideSlug', '==', guideSlug),
      where('status', '==', 'active'),
      where('expiresAt', '>', Timestamp.fromDate(now)),
      orderBy('scrapedAt', 'desc'),
      firestoreLimit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data() as ScrapingDataDoc;
    return Array.isArray(data.pages) ? data.pages : null;
  }

  static async getValidByDomain(domain: string): Promise<ScrapedPage[] | null> {
    const now = new Date();
    const q = query(
      collection(mainDb, COLLECTION),
      where('domain', '==', domain),
      where('status', '==', 'active'),
      where('expiresAt', '>', Timestamp.fromDate(now)),
      orderBy('scrapedAt', 'desc'),
      firestoreLimit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data() as ScrapingDataDoc;
    return Array.isArray(data.pages) ? data.pages : null;
  }

  static async cleanupExpired(): Promise<void> {
    const now = new Date();
    const q = query(
      collection(mainDb, COLLECTION),
      where('expiresAt', '<=', Timestamp.fromDate(now))
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(mainDb);
    snap.docs.forEach(d => batch.update(d.ref, { status: 'expired' }));
    await batch.commit();
  }
}





