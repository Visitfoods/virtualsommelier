import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  DocumentSnapshot,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { testDb as db } from './testConfig';
import type { Follower, FollowerFilters } from '../types/follower';

const FOLLOWERS_COLLECTION = 'followers';

export async function addFollower(followerData: Omit<Follower, 'id' | 'createdAt'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, FOLLOWERS_COLLECTION), {
      ...followerData,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar seguidor:', error);
    throw error;
  }
}

export async function getFollowers(
  filters: FollowerFilters = {},
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
): Promise<{ followers: Follower[]; lastDoc?: DocumentSnapshot; hasMore: boolean }> {
  try {
    const constraints: QueryConstraint[] = [];
    
    // Aplicar filtros
    if (filters.guideId) {
      constraints.push(where('guideId', '==', filters.guideId));
    }
    
    // Se há filtro de guia, não usar orderBy para evitar erro de índice
    // Se não há filtro de guia, usar orderBy
    if (!filters.guideId) {
      constraints.push(orderBy('createdAt', 'desc'));
    }
    
    if (filters.dateFrom) {
      constraints.push(where('createdAt', '>=', Timestamp.fromDate(new Date(filters.dateFrom))));
    }
    
    if (filters.dateTo) {
      constraints.push(where('createdAt', '<=', Timestamp.fromDate(new Date(filters.dateTo))));
    }
    
    // Paginação
    constraints.push(limit(pageSize + 1)); // +1 para verificar se há mais
    
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    
    const q = query(collection(db, FOLLOWERS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    
    const followers: Follower[] = [];
    let newLastDoc: DocumentSnapshot | undefined;
    let hasMore = false;
    
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      if (i < pageSize) {
        const data = d.data();
        followers.push({
          id: d.id,
          ...data,
          createdAt: (data as any).createdAt?.toDate?.() || new Date(),
        } as Follower);
        newLastDoc = d;
      } else {
        hasMore = true;
      }
    }
    
    // Aplicar filtro de pesquisa no lado do cliente (se necessário)
    let filteredFollowers = followers;
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredFollowers = followers.filter(follower => 
        follower.name.toLowerCase().includes(searchTerm) ||
        follower.email.toLowerCase().includes(searchTerm) ||
        (follower.company && follower.company.toLowerCase().includes(searchTerm))
      );
    }
    
    // Se há filtro de guia, ordenar manualmente por data (mais recentes primeiro)
    if (filters.guideId) {
      filteredFollowers.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
    }
    
    return {
      followers: filteredFollowers,
      lastDoc: newLastDoc,
      hasMore
    };
  } catch (error) {
    console.error('Erro ao buscar seguidores:', error);
    throw error;
  }
}

export async function getFollowersByGuide(guideId: string): Promise<Follower[]> {
  try {
    const q = query(
      collection(db, FOLLOWERS_COLLECTION),
      where('guideId', '==', guideId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const followers: Follower[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      followers.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Follower);
    });
    
    return followers;
  } catch (error) {
    console.error('Erro ao buscar seguidores do guia:', error);
    throw error;
  }
}

export async function getFollowersCount(guideId?: string): Promise<number> {
  try {
    const constraints: QueryConstraint[] = [];
    
    if (guideId) {
      constraints.push(where('guideId', '==', guideId));
    }
    
    const q = query(collection(db, FOLLOWERS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    
    return snapshot.size;
  } catch (error) {
    console.error('Erro ao contar seguidores:', error);
    return 0;
  }
}

// Listar slugs de guias que têm pelo menos um seguidor
export async function listGuideSlugsWithFollowers(): Promise<string[]> {
  try {
    const q = query(collection(db, FOLLOWERS_COLLECTION), limit(1000));
    const snapshot = await getDocs(q);
    const set = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data() as any;
      if (data?.guideSlug) set.add(String(data.guideSlug));
    });
    return Array.from(set).sort();
  } catch (error) {
    console.error('Erro ao listar guias com seguidores:', error);
    return [];
  }
}
