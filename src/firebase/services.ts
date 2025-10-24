import { db } from './config';
import { collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, query, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
// Imports comentados para resolver warnings ESLint
// orderBy, limit, where, Timestamp

// Interface para os dados do formulário
export interface ContactFormData {
  name: string;
  contact: string;
  timestamp?: Date | { seconds: number; nanoseconds: number };
}

// Interface para mensagens do chat
export interface ChatMessage {
  id?: string;
  from: 'user' | 'agent';
  text: string;
  timestamp: string;
  read?: boolean;
  metadata?: {
    fromChatbot?: boolean;
    guideResponse?: boolean;
    messageType?: 'text' | 'image' | 'file';
    isThinking?: boolean;
  };
}

// Interface para conversas
export interface Conversation {
  id?: string;
  userId: string;
  userName: string;
  userContact: string;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  unreadCount?: number;
}

// Função para salvar os dados do formulário no Firestore
export const saveContactRequest = async (data: ContactFormData): Promise<string> => {
  try {
    // Adicionar timestamp
    const dataWithTimestamp = {
      ...data,
      timestamp: serverTimestamp(),
    };
    
    // Adicionar documento à coleção 'contactoschatreal'
    const docRef = await addDoc(collection(db, 'contactoschatreal'), dataWithTimestamp);
    
    
    return docRef.id;
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    console.error('Detalhes do erro:', {
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      code: (error as { code?: string })?.code,
      details: error
    });
    throw error;
  }
};

// Função para criar uma nova conversa
export const createConversation = async (
  userData: ContactFormData, 
  initialMessages?: ChatMessage[]
): Promise<string> => {
  try {
    // Usar mensagens iniciais fornecidas ou criar uma mensagem padrão
    const messages = initialMessages || [
      {
        from: 'agent',
        text: `Olá ${userData.name}! Sou o seu guia pessoal. Como posso ajudá-lo hoje?`,
        timestamp: new Date().toISOString(),
        read: false
      }
    ];
    
    const conversationData = {
      userId: `user_${Date.now()}`,
      userName: userData.name,
      userContact: userData.contact,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messages
    };

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar conversa:', error);
    throw error;
  }
};

// Função para enviar mensagem
export const sendMessage = async (conversationId: string, message: Omit<ChatMessage, 'timestamp'>): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Obter a conversa atual
    const conversationDoc = await getDoc(conversationRef);
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }

    const currentData = conversationDoc.data() as Conversation;
    const updatedMessages = [...(currentData.messages || []), messageWithTimestamp];

    await updateDoc(conversationRef, {
      messages: updatedMessages,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }
};

// Função para obter conversa
export const getConversation = async (conversationId: string): Promise<Conversation> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      return { ...conversationDoc.data(), id: conversationDoc.id } as Conversation;
    } else {
      throw new Error('Conversa não encontrada');
    }
  } catch (error) {
    console.error('Erro ao obter conversa:', error);
    throw error;
  }
};

// Função para escutar mudanças na conversa (tempo real)
export const listenToConversation = (conversationId: string, callback: (conversation: Conversation) => void) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  
  return onSnapshot(conversationRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data() as Conversation;
      callback({ ...data, id: doc.id });
    }
  });
};

// Função para escutar todas as conversas em tempo real
export const listenToAllConversations = (callback: (conversations: Conversation[]) => void) => {
  const q = query(collection(db, 'conversations'));
  
  return onSnapshot(q, (snapshot) => {
    const conversations: Conversation[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data() as Conversation;
      const messages = data.messages || [];
      
      // Calcular mensagens não lidas do usuário
      const unreadCount = messages.filter(msg => msg.from === 'user' && msg.read === false).length;
      
      conversations.push({
        ...data,
        id: doc.id,
        unreadCount
      });
    });
    
    // Ordenamos manualmente por updatedAt
    conversations.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA; // ordem decrescente
    });
    
    callback(conversations);
  });
};

// Função para escutar apenas conversas ativas em tempo real
export const listenToActiveConversations = (callback: (conversations: Conversation[]) => void) => {
  const q = query(collection(db, 'conversations'));
  
  return onSnapshot(q, (snapshot) => {
    const conversations: Conversation[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data() as Conversation;
      
      // Filtramos manualmente as conversas ativas
      if (data.status === 'active') {
        const messages = data.messages || [];
        const unreadCount = messages.filter(msg => msg.from === 'user' && msg.read === false).length;
        
        conversations.push({
          ...data,
          id: doc.id,
          unreadCount
        });
      }
    });
    
    // Ordenamos manualmente por updatedAt
    conversations.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA; // ordem decrescente
    });
    
    callback(conversations);
  });
};

// Função para listar todas as conversas para o backoffice
export const listConversations = async (): Promise<Conversation[]> => {
  try {
    // Modificando para não usar orderBy, que pode requerer índices
    const q = query(
      collection(db, 'conversations')
    );
    
    const querySnapshot = await getDocs(q);
    const conversations: Conversation[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Conversation;
      const messages = data.messages || [];
      
      // Calcular mensagens não lidas do usuário
      const unreadCount = messages.filter(msg => msg.from === 'user' && msg.read === false).length;
      
      conversations.push({
        ...data,
        id: doc.id,
        unreadCount
      });
    });
    
    // Ordenamos manualmente por updatedAt
    conversations.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA; // ordem decrescente
    });
    
    return conversations;
  } catch (error) {
    console.error('Erro ao listar conversas:', error);
    throw error;
  }
};

// Função para listar conversas ativas
export const listActiveConversations = async (): Promise<Conversation[]> => {
  try {
    // Modificando para não usar where e orderBy juntos, o que requer índices compostos
    const q = query(
      collection(db, 'conversations')
    );
    
    const querySnapshot = await getDocs(q);
    const conversations: Conversation[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Conversation;
      
      // Filtramos manualmente as conversas ativas
      if (data.status === 'active') {
        const messages = data.messages || [];
        const unreadCount = messages.filter(msg => msg.from === 'user' && msg.read === false).length;
        
        conversations.push({
          ...data,
          id: doc.id,
          unreadCount
        });
      }
    });
    
    // Ordenamos manualmente por updatedAt
    conversations.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA; // ordem decrescente
    });
    
    return conversations;
  } catch (error) {
    console.error('Erro ao listar conversas ativas:', error);
    throw error;
  }
};

// Função para marcar todas as mensagens de uma conversa como lidas
export const markAllMessagesAsRead = async (conversationId: string): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }
    
    const conversation = conversationDoc.data() as Conversation;
    const updatedMessages = conversation.messages.map(msg => ({
      ...msg,
      read: true
    }));
    
    await updateDoc(conversationRef, {
      messages: updatedMessages
    });
    
    
  } catch (error) {
    console.error('Erro ao marcar mensagens como lidas:', error);
    throw error;
  }
};

// Função para fechar uma conversa
export const closeConversation = async (conversationId: string): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      status: 'closed',
      updatedAt: serverTimestamp()
    });
    
    // Tentar limpar os cookies do cliente se a conversa for fechada pelo backoffice
    if (typeof window !== 'undefined') {
      clearConversationCookies(conversationId);
    }
    
    
  } catch (error) {
    console.error('Erro ao fechar conversa:', error);
    throw error;
  }
};

// Função para reabrir uma conversa
export const reopenConversation = async (conversationId: string): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      status: 'active',
      updatedAt: serverTimestamp()
    });
    
    
  } catch (error) {
    console.error('Erro ao reabrir conversa:', error);
    throw error;
  }
}; 

// Função para limpar cookies de uma conversa específica
export const clearConversationCookies = (conversationId: string): void => {
  try {
    // Verificar se estamos no navegador
    if (typeof document === 'undefined') return;

    // Obter o ID da conversa atual do cookie
    const storedConversationId = getCookie('chat_conversation_id');
    
    // Só limpar se o ID da conversa corresponder
    if (storedConversationId === conversationId) {
      deleteCookie('chat_conversation_id');
      deleteCookie('chat_user_name');
      deleteCookie('chat_user_contact');
      
    }
  } catch (error) {
    console.error('Erro ao limpar cookies da conversa:', error);
  }
};

// Funções auxiliares para gerir cookies
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

// Função para apagar todas as conversas
export const deleteAllConversations = async (): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
  
  
  try {
    // Verificar se o Firebase está configurado
    
    if (!db) {
      throw new Error('Firebase não está configurado');
    }
    
    // Obter todas as conversas
    
    const conversationsRef = collection(db, 'conversations');
    
    const conversationsSnapshot = await getDocs(conversationsRef);
    
    
    
    if (conversationsSnapshot.empty) {
      
      return { success: true, deletedCount: 0 };
    }
    
    // Testar se conseguimos ler os dados primeiro
    
    conversationsSnapshot.docs.forEach((doc, index) => {
      /* log removido: Conversa ${index + 1}: ${doc.id} */
    });
    
    // Apagar cada conversa uma por vez para evitar problemas de permissão
    
    let deletedCount = 0;
    
    for (const doc of conversationsSnapshot.docs) {
      try {
        
        await deleteDoc(doc.ref);
        
        deletedCount++;
      } catch (error) {
        console.error(`Erro ao apagar conversa ${doc.id}:`, error);
      }
    }
    
    
    
    return { 
      success: true, 
      deletedCount,
      error: deletedCount < conversationsSnapshot.docs.length ? 'Algumas conversas não puderam ser apagadas' : undefined
    };
  } catch (error) {
    console.error('Erro ao apagar todas as conversas:', error);
    return { 
      success: false, 
      deletedCount: 0, 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}; 