import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  Timestamp,
  onSnapshot,
  arrayUnion
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { db as unifiedDb } from './config';

// Função para obter a base de dados dos guias (usa configuração unificada)
const getGuideDb = (_projectId: string) => {
  return unifiedDb;
};

// Função para obter textos traduzidos
const getTranslatedTexts = (language: string = 'pt') => {
  const texts = {
    'pt': {
      closingMessage: 'Esta conversa foi encerrada pelo operador. Obrigado pelo contacto! Pode continuar a falar com o guia virtual (IA) para mais ajuda.',
      openAiChat: 'Abrir chat com IA',
      // Textos da modal de orçamento
      budgetModal: {
        title: 'Pedir Orçamento',
        submitButton: 'Enviar Pedido',
        submittingButton: 'A enviar…',
        commercialTitle: 'Se precisares de informação contacta algum dos comerciais',
        commercialButton: 'Falar com Comercial',
        confirmationMessage: 'Obrigado pelo seu pedido de orçamento! Entraremos em contacto consigo brevemente.',
        // Campos padrão
        defaultFields: {
          name: 'Nome',
          email: 'Email',
          phone: 'Telefone',
          date: 'Data pretendida',
          people: 'Número de pessoas',
          notes: 'Notas'
        },
        // Textos adicionais
        close: 'Fechar',
        placeholderPrefix: 'Ex:',
        emailNotConfigured: 'Email de destino não configurado. Contacte o administrador.',
        sendError: 'Erro ao enviar pedido. Tente novamente ou contacte-nos diretamente.'
      }
    },
    'en': {
      closingMessage: 'This conversation has been closed by the operator. Thank you for your contact! You can continue talking to the virtual guide (AI) for more help.',
      openAiChat: 'Open AI Chat',
      // Textos da modal de orçamento
      budgetModal: {
        title: 'Request Quote',
        submitButton: 'Send Request',
        submittingButton: 'Sending…',
        commercialTitle: 'If you need information, contact one of our sales representatives',
        commercialButton: 'Contact Sales',
        confirmationMessage: 'Thank you for your quote request! We will contact you shortly.',
        // Campos padrão
        defaultFields: {
          name: 'Name',
          email: 'Email',
          phone: 'Phone',
          date: 'Preferred Date',
          people: 'Number of People',
          notes: 'Notes'
        },
        // Textos adicionais
        close: 'Close',
        placeholderPrefix: 'E.g.:',
        emailNotConfigured: 'Destination email not configured. Please contact the administrator.',
        sendError: 'Error sending request. Please try again or contact us directly.'
      }
    },
    'es': {
      closingMessage: 'Esta conversación ha sido cerrada por el operador. ¡Gracias por su contacto! Puede continuar hablando con el guía virtual (IA) para más ayuda.',
      openAiChat: 'Abrir chat con IA',
      // Textos da modal de orçamento
      budgetModal: {
        title: 'Solicitar Presupuesto',
        submitButton: 'Enviar Solicitud',
        submittingButton: 'Enviando…',
        commercialTitle: 'Si necesitas información, contacta con alguno de nuestros comerciales',
        commercialButton: 'Contactar Comercial',
        confirmationMessage: '¡Gracias por tu solicitud de presupuesto! Te contactaremos pronto.',
        // Campos padrão
        defaultFields: {
          name: 'Nombre',
          email: 'Email',
          phone: 'Teléfono',
          date: 'Fecha Preferida',
          people: 'Número de Personas',
          notes: 'Notas'
        },
        // Textos adicionais
        close: 'Cerrar',
        placeholderPrefix: 'Ej:',
        emailNotConfigured: 'Email de destino no configurado. Contacte al administrador.',
        sendError: 'Error al enviar solicitud. Inténtelo de nuevo o contáctenos directamente.'
      }
    },
    'fr': {
      closingMessage: 'Cette conversation a été fermée par l\'opérateur. Merci pour votre contact ! Vous pouvez continuer à parler au guide virtuel (IA) pour plus d\'aide.',
      openAiChat: 'Ouvrir chat IA',
      // Textos da modal de orçamento
      budgetModal: {
        title: 'Demander un Devis',
        submitButton: 'Envoyer la Demande',
        submittingButton: 'Envoi en cours…',
        commercialTitle: 'Si vous avez besoin d\'informations, contactez l\'un de nos commerciaux',
        commercialButton: 'Contacter Commercial',
        confirmationMessage: 'Merci pour votre demande de devis ! Nous vous contacterons bientôt.',
        // Campos padrão
        defaultFields: {
          name: 'Nom',
          email: 'Email',
          phone: 'Téléphone',
          date: 'Date Préférée',
          people: 'Nombre de Personnes',
          notes: 'Notes'
        },
        // Textos adicionais
        close: 'Fermer',
        placeholderPrefix: 'Ex:',
        emailNotConfigured: 'Email de destination non configuré. Veuillez contacter l\'administrateur.',
        sendError: 'Erreur lors de l\'envoi de la demande. Veuillez réessayer ou nous contacter directement.'
      }
    }
  };
  
  return texts[language as keyof typeof texts] || texts['pt'];
};

// Função para traduzir campos do formulário de orçamento
export const translateBudgetFields = (fields: Record<string, { required: boolean; label: string; type: string; labels?: { pt?: string; en?: string; es?: string; fr?: string } }>, language: string = 'pt') => {
  const translatedTexts = getTranslatedTexts(language);
  const defaultFields = translatedTexts.budgetModal.defaultFields;
  
  const translatedFields: Record<string, { required: boolean; label: string; type: string }> = {};
  
  Object.entries(fields).forEach(([key, field]) => {
    // Prioridade: rótulos multilíngues do backoffice > traduções padrão > label original
    let translatedLabel = field.label;
    
    if (language === 'pt') {
      // Para português, sempre usar o label principal (campo "Rótulo do Campo (PT)")
      translatedLabel = field.label;
    } else if (field.labels && field.labels[language as keyof typeof field.labels]) {
      // Para outros idiomas, usar rótulo multilíngue do backoffice
      translatedLabel = field.labels[language as keyof typeof field.labels] || field.label;
    } else if (defaultFields[key as keyof typeof defaultFields]) {
      // Usar tradução padrão como fallback
      translatedLabel = defaultFields[key as keyof typeof defaultFields];
    }
    
    translatedFields[key] = {
      ...field,
      label: translatedLabel
    };
  });
  
  return translatedFields;
};

// Exportar a função para uso no frontend
export { getTranslatedTexts };

// Interfaces para os dados dos guias
export interface GuideContactInfo {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'pending' | 'contacted' | 'resolved' | 'spam';
  source: 'contact-form' | 'chat-initiation';
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown; // Firestore Timestamp
  contactedAt?: unknown; // Firestore Timestamp
  notes?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface GuideChatMessage {
  id?: string;
  from: 'user' | 'guide' | 'system';
  text: string;
  timestamp: unknown; // Firestore Timestamp
  read: boolean;
  metadata?: {
    guideResponse: boolean;
    responseTime?: number; // em segundos
    messageType?: 'text' | 'image' | 'file';
    fileUrl?: string;
    closingMessage?: boolean; // marca mensagem de encerramento para evitar duplicados
    fromChatbot?: boolean; // indica se a mensagem veio do chatbot AI
  };
}

export interface GuideConversation {
  id?: string;
  guideSlug: string;
  projectId: string;
  userId: string;
  userName: string;
  userContact: string;
  userEmail?: string;
  userPhone?: string;
  status: 'active' | 'closed' | 'pending' | 'archived';
  priority: 'low' | 'medium' | 'high';
  category?: 'general' | 'ticket' | 'support' | 'sales' | 'technical';
  tags?: string[];
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown; // Firestore Timestamp
  lastActivity: unknown; // Firestore Timestamp
  closedAt?: unknown; // Firestore Timestamp
  closedBy?: string; // ID do guia que fechou
  closeReason?: string;
  messages: GuideChatMessage[];
  unreadCount?: number;
  totalMessages: number;
  averageResponseTime?: number; // em segundos
  satisfaction?: number; // 1-5 estrelas
  feedback?: string;
}

// Função para salvar pedido de contacto de um guia
export const saveGuideContactRequest = async (
  projectId: string,
  contactData: Omit<GuideContactInfo, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'priority'>
): Promise<string> => {
  try {
    const db = getGuideDb(projectId);
    
    const contactWithMetadata = {
      ...contactData,
      status: 'pending' as const,
      priority: 'medium' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'contact_requests'), contactWithMetadata);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao salvar pedido de contacto:', error);
    throw error;
  }
};

// Função para criar uma nova conversa num guia
export const createGuideConversation = async (
  projectId: string,
  conversationData: Omit<GuideConversation, 'id' | 'createdAt' | 'updatedAt' | 'lastActivity' | 'totalMessages' | 'unreadCount'>
): Promise<string> => {
  try {
    const db = getGuideDb(projectId);
    
         // Converter timestamps das mensagens para Date() em vez de serverTimestamp()
     const messagesWithDateTimestamps = conversationData.messages.map(msg => ({
       ...msg,
       timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(String(msg.timestamp))
     }));

     const conversationWithMetadata = {
       ...conversationData,
       messages: messagesWithDateTimestamps,
       createdAt: serverTimestamp(),
       updatedAt: serverTimestamp(),
       lastActivity: serverTimestamp(),
       totalMessages: conversationData.messages.length,
       unreadCount: 0
     };
    
    const docRef = await addDoc(collection(db, 'conversations'), conversationWithMetadata);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar conversa do guia:', error);
    throw error;
  }
};

// Função para enviar mensagem numa conversa
export const sendGuideMessage = async (
  projectId: string,
  conversationId: string,
  message: Omit<GuideChatMessage, 'id' | 'timestamp' | 'read'>
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    const messageWithMetadata = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(), // Usar Date() em vez de serverTimestamp() para arrays
      read: false
    };
    
    // Obter a conversa atual para calcular estatísticas
    const conversationDoc = await getDoc(conversationRef);
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }
    
    const currentData = conversationDoc.data() as GuideConversation;
    const updatedMessages = [...currentData.messages, messageWithMetadata];
    
    // Calcular tempo de resposta se for mensagem do guia
    let averageResponseTime = currentData.averageResponseTime;
    if (message.from === 'guide' && currentData.messages.length > 0) {
      const lastUserMessage = currentData.messages
        .filter(m => m.from === 'user')
        .pop();
      
      if (lastUserMessage && lastUserMessage.timestamp) {
        // Converter vários formatos possíveis de timestamp em milissegundos
        const toMillis = (value: any): number => {
          try {
            if (!value) return Date.now();
            if (typeof value?.toMillis === 'function') return value.toMillis();
            if (typeof value?.toDate === 'function') return value.toDate().getTime();
            if (value instanceof Date) return value.getTime();
            if (typeof value === 'number') return value;
            const parsed = Date.parse(value);
            return isNaN(parsed) ? Date.now() : parsed;
          } catch {
            return Date.now();
          }
        };
        
        const responseTime = Date.now() - toMillis(lastUserMessage.timestamp);
        const historicalCount = currentData.messages.length;
        const historicalAverage = currentData.averageResponseTime || 0;
        averageResponseTime = ((historicalAverage * historicalCount) + responseTime) / (historicalCount + 1);
      }
    }
    
    

    // Construir payload sem campos undefined
    const updateData: any = {
      messages: updatedMessages,
      updatedAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
      totalMessages: updatedMessages.length,
      unreadCount: message.from === 'user' ? (currentData.unreadCount || 0) + 1 : 0
    };

    if (typeof averageResponseTime === 'number' && !Number.isNaN(averageResponseTime)) {
      updateData.averageResponseTime = averageResponseTime;
    }

    await updateDoc(conversationRef, updateData);
    
    
  } catch (error) {
    console.error('Erro detalhado ao enviar mensagem:', error);
    console.error('Tipo de erro:', typeof error);
    console.error('Mensagem de erro:', error instanceof Error ? error.message : 'Erro desconhecido');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    throw error;
  }
};

// Função para obter uma conversa específica
export const getGuideConversation = async (
  projectId: string,
  conversationId: string
): Promise<GuideConversation> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }
    
    return { id: conversationDoc.id, ...conversationDoc.data() } as GuideConversation;
  } catch (error) {
    console.error('Erro ao obter conversa:', error);
    throw error;
  }
};

// Função para escutar mudanças numa conversa (tempo real)
export const listenToGuideConversation = (
  projectId: string,
  conversationId: string,
  callback: (conversation: GuideConversation) => void
) => {
  const db = getGuideDb(projectId);
  const conversationRef = doc(db, 'conversations', conversationId);
  
  return onSnapshot(conversationRef, (doc: any) => {
    if (doc.exists()) {
      const data = doc.data() as GuideConversation;
      callback({ ...data, id: doc.id });
    }
  });
};

// Função para escutar todas as conversas de um guia (tempo real)
export const listenToGuideConversations = (
  projectId: string,
  guideSlug: string,
  callback: (conversations: GuideConversation[]) => void
) => {
  
  const db = getGuideDb(projectId);
  
  
  // Criar query sem orderBy para evitar problemas com campos que podem não existir
  const q = query(
    collection(db, 'conversations'),
    where('guideSlug', '==', guideSlug)
  );
  
  
  
  return onSnapshot(q, (snapshot: any) => {
    
    const conversations: GuideConversation[] = [];
    
    snapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      
      conversations.push({
        ...data,
        id: doc.id
      });
    });
    
    // Ordenar localmente por lastActivity se existir, convertendo de forma resiliente
    const toMillis = (value: any): number => {
      try {
        if (!value) return 0;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const parsed = Date.parse(value);
        return isNaN(parsed) ? 0 : parsed;
      } catch {
        return 0;
      }
    };

    conversations.sort((a, b) => toMillis(b.lastActivity) - toMillis(a.lastActivity));
    
    
    callback(conversations);
  }, (error: any) => {
    console.error('Erro no listener:', error);
  });
};

// Função para escutar conversas ativas de um guia (tempo real)
export const listenToActiveGuideConversations = (
  projectId: string,
  guideSlug: string,
  callback: (conversations: GuideConversation[]) => void
) => {
  const db = getGuideDb(projectId);
  const q = query(
    collection(db, 'conversations'),
    where('guideSlug', '==', guideSlug),
    where('status', '==', 'active'),
    orderBy('lastActivity', 'desc')
  );
  
  return onSnapshot(q, (snapshot: any) => {
    const conversations: GuideConversation[] = [];
    
    snapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      conversations.push({
        ...data,
        id: doc.id
      });
    });
    
    callback(conversations);
  });
};

// Função para listar todas as conversas de um guia
export const listGuideConversations = async (
  projectId: string,
  guideSlug: string
): Promise<GuideConversation[]> => {
  try {
    
    const db = getGuideDb(projectId);
    
    
    // Criar query sem orderBy para evitar problemas com campos que podem não existir
    const q = query(
      collection(db, 'conversations'),
      where('guideSlug', '==', guideSlug)
    );
    
    
    const querySnapshot = await getDocs(q);
    
    
    const conversations: GuideConversation[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      
      conversations.push({
        ...data,
        id: doc.id
      });
    });
    
    // Ordenar localmente por lastActivity se existir, convertendo de forma resiliente
    const toMillis = (value: any): number => {
      try {
        if (!value) return 0;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const parsed = Date.parse(value);
        return isNaN(parsed) ? 0 : parsed;
      } catch {
        return 0;
      }
    };

    conversations.sort((a, b) => toMillis(b.lastActivity) - toMillis(a.lastActivity));
    
    
    return conversations;
  } catch (error) {
    console.error('Erro ao listar conversas do guia:', error);
    throw error;
  }
};

// Função para listar conversas ativas de um guia
export const listActiveGuideConversations = async (
  projectId: string,
  guideSlug: string
): Promise<GuideConversation[]> => {
  try {
    const db = getGuideDb(projectId);
    const q = query(
      collection(db, 'conversations'),
      where('guideSlug', '==', guideSlug),
      where('status', '==', 'active'),
      orderBy('lastActivity', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const conversations: GuideConversation[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      conversations.push({
        ...data,
        id: doc.id
      });
    });
    
    return conversations;
  } catch (error) {
    console.error('Erro ao listar conversas ativas do guia:', error);
    throw error;
  }
};

// Função para marcar mensagens como lidas
export const markGuideMessagesAsRead = async (
  projectId: string,
  conversationId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    const conversationDoc = await getDoc(conversationRef);
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }
    
    const conversation = conversationDoc.data() as GuideConversation;
    const updatedMessages = conversation.messages.map(msg => ({
      ...msg,
      read: true
    }));
    
    await updateDoc(conversationRef, {
      messages: updatedMessages,
      unreadCount: 0,
      updatedAt: serverTimestamp()
    });
    
    
  } catch (error) {
    console.error('Erro ao marcar mensagens como lidas:', error);
    throw error;
  }
};

// Função para fechar uma conversa
export const closeGuideConversation = async (
  projectId: string,
  conversationId: string,
  closedBy: string,
  closeReason?: string,
  language: string = 'pt'
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    // Ler a conversa atual para anexar mensagem de encerramento se necessário
    const snap = await getDoc(conversationRef);
    if (!snap.exists()) {
      throw new Error('Conversa não encontrada');
    }
    const data = snap.data() as GuideConversation;
    const alreadyHasClosing = Array.isArray(data.messages) && data.messages.some(m => (m as any)?.metadata?.closingMessage === true);

    // Mensagem de encerramento com link para abrir o chat de IA
    const translatedTexts = getTranslatedTexts(language);
    const closingMessage = {
      id: `close_${Date.now()}`,
      from: 'guide' as const,
      text: `✅ ${translatedTexts.closingMessage} <br/><button data-open-ai="1" style="margin-top:10px;padding:8px 14px;border:none;border-radius:8px;background:#000;color:#fff;cursor:pointer;font-weight:600">${translatedTexts.openAiChat}</button>`,
      timestamp: new Date(),
      read: false,
      metadata: { guideResponse: true, closingMessage: true }
    } as GuideChatMessage;

    const newMessages = alreadyHasClosing ? (data.messages || []) : ([...(data.messages || []), closingMessage]);
    
    await updateDoc(conversationRef, {
      status: 'closed',
      closedAt: serverTimestamp(),
      closedBy,
      closeReason,
      updatedAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
      messages: newMessages,
      totalMessages: newMessages.length
    });
    
    
  } catch (error) {
    console.error('Erro ao fechar conversa:', error);
    throw error;
  }
};

// Função para reabrir uma conversa
export const reopenGuideConversation = async (
  projectId: string,
  conversationId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      status: 'active',
      closedAt: null,
      closedBy: null,
      closeReason: null,
      updatedAt: serverTimestamp()
    });
    
    
  } catch (error) {
    console.error('Erro ao reabrir conversa:', error);
    throw error;
  }
};

// Função para arquivar uma conversa
export const archiveGuideConversation = async (
  projectId: string,
  conversationId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      status: 'archived',
      updatedAt: serverTimestamp()
    });
    
    
  } catch (error) {
    console.error('Erro ao arquivar conversa:', error);
    throw error;
  }
};

// Função para atualizar prioridade de uma conversa
export const updateGuideConversationPriority = async (
  projectId: string,
  conversationId: string,
  priority: 'low' | 'medium' | 'high'
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      priority,
      updatedAt: serverTimestamp()
    });
    
    
  } catch (error) {
    console.error('Erro ao atualizar prioridade:', error);
    throw error;
  }
};

// Função para adicionar tags a uma conversa
export const addGuideConversationTags = async (
  projectId: string,
  conversationId: string,
  tags: string[]
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      tags: arrayUnion(...tags),
      updatedAt: serverTimestamp()
    });
    
    
  } catch (error) {
    console.error('Erro ao adicionar tags:', error);
    throw error;
  }
};

// Função para atualizar status de um pedido de contacto
export const updateGuideContactStatus = async (
  projectId: string,
  contactId: string,
  status: 'pending' | 'contacted' | 'resolved' | 'spam',
  notes?: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const contactRef = doc(db, 'contact_requests', contactId);
    
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    };
    
    if (status === 'contacted') {
      updateData.contactedAt = serverTimestamp();
    }
    
    if (notes) {
      updateData.notes = notes;
    }
    
    await updateDoc(contactRef, updateData);
    
    
  } catch (error) {
    console.error('Erro ao atualizar status do contacto:', error);
    throw error;
  }
};

// Função para listar pedidos de contacto de um guia
export const listGuideContactRequests = async (
  projectId: string,
  guideSlug: string
): Promise<GuideContactInfo[]> => {
  try {
    const db = getGuideDb(projectId);
    const q = query(
      collection(db, 'contact_requests'),
      where('guideSlug', '==', guideSlug),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const contacts: GuideContactInfo[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideContactInfo;
      contacts.push({
        ...data,
        id: doc.id
      });
    });
    
    return contacts;
  } catch (error) {
    console.error('Erro ao listar pedidos de contacto:', error);
    throw error;
  }
};

// Função para obter estatísticas de um guia
export const getGuideStats = async (
  projectId: string,
  guideSlug: string
): Promise<{
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  averageResponseTime: number;
  totalContacts: number;
  pendingContacts: number;
}> => {
  try {
    const db = getGuideDb(projectId);
    
    // Obter conversas
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('guideSlug', '==', guideSlug)
    );
    const conversationsSnapshot = await getDocs(conversationsQuery);
    
    // Obter contactos
    const contactsQuery = query(
      collection(db, 'contact_requests'),
      where('guideSlug', '==', guideSlug)
    );
    const contactsSnapshot = await getDocs(contactsQuery);
    
    let totalConversations = 0;
    let activeConversations = 0;
    let totalMessages = 0;
    let totalResponseTime = 0;
    let responseCount = 0;
    
    conversationsSnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      totalConversations++;
      
      if (data.status === 'active') {
        activeConversations++;
      }
      
      totalMessages += data.totalMessages || 0;
      
      if (data.averageResponseTime) {
        totalResponseTime += data.averageResponseTime;
        responseCount++;
      }
    });
    
    const totalContacts = contactsSnapshot.size;
    let pendingContacts = 0;
    
    contactsSnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideContactInfo;
      if (data.status === 'pending') {
        pendingContacts++;
      }
    });
    
    return {
      totalConversations,
      activeConversations,
      totalMessages,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      totalContacts,
      pendingContacts
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas do guia:', error);
    throw error;
  }
};

// Função para apagar uma conversa (apenas para administradores)
export const deleteGuideConversation = async (
  projectId: string,
  conversationId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await deleteDoc(conversationRef);
    
    
  } catch (error) {
    console.error('Erro ao apagar conversa:', error);
    throw error;
  }
};

// Função para apagar um pedido de contacto (apenas para administradores)
export const deleteGuideContactRequest = async (
  projectId: string,
  contactId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const contactRef = doc(db, 'contact_requests', contactId);
    
    await deleteDoc(contactRef);
    
    
  } catch (error) {
    console.error('Erro ao apagar pedido de contacto:', error);
    throw error;
  }
};

// Função para listar todos os guias disponíveis
export const listAvailableGuides = async (projectId: string): Promise<{ slug: string; name: string; company?: string }[]> => {
  try {
    const db = getGuideDb(projectId);
    // Não usar orderBy em campo que pode não existir
    const q = query(collection(db, 'guides'));

    const querySnapshot = await getDocs(q);
    const guides: { slug: string; name: string; company?: string }[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const slug: string = data?.slug || docSnap.id;
      const name: string = data?.name || slug;
      const company: string | undefined = (data as any)?.company;
      if (slug) {
        guides.push({ slug, name, company });
      }
    });

    // Ordenar alfabeticamente por nome para consistência visual
    guides.sort((a, b) => (a.company || a.name).localeCompare((b.company || b.name), 'pt-PT'));
    return guides;
  } catch (error) {
    console.error('Erro ao listar guias disponíveis:', error);
    throw error;
  }
};

// Listar apenas guias com chat humano real ativo
export const listGuidesWithHumanChatEnabled = async (
  projectId: string
): Promise<{ slug: string; name: string; company?: string }[]> => {
  try {
    const db = getGuideDb(projectId);
    const q = query(collection(db, 'guides'), where('humanChatEnabled', '==', true));

    const querySnapshot = await getDocs(q);
    const guides: { slug: string; name: string; company?: string }[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      // Considerar inativos apenas quando explicitamente false
      if (data?.isActive === false) return;
      const slug: string = data?.slug || docSnap.id;
      const name: string = data?.name || slug;
      const company: string | undefined = (data as any)?.company;
      if (slug) {
        guides.push({ slug, name, company });
      }
    });

    guides.sort((a, b) => (a.company || a.name).localeCompare((b.company || b.name), 'pt-PT'));
    return guides;
  } catch (error) {
    console.error('Erro ao listar guias com chat humano ativo:', error);
    throw error;
  }
};

// Função para obter informações básicas de um guia
export const getGuideBasicInfo = async (
  projectId: string,
  guideSlug: string
): Promise<{ slug: string; name: string; description?: string } | null> => {
  try {
    const db = getGuideDb(projectId);
    const q = query(
      collection(db, 'guides'),
      where('slug', '==', guideSlug),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      slug: data.slug,
      name: data.name,
      description: data.description
    };
  } catch (error) {
    console.error('Erro ao obter informações básicas do guia:', error);
    throw error;
  }
};

// Função para obter dados completos de um guia (incluindo configurações de orçamento)
export const getGuideCompleteData = async (
  projectId: string,
  guideSlug: string
): Promise<any | null> => {
  try {
    console.log('🔍 getGuideCompleteData - Procurando guia:', guideSlug, 'no projeto:', projectId);
    const db = getGuideDb(projectId);
    const q = query(
      collection(db, 'guides'),
      where('slug', '==', guideSlug),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ Nenhum guia encontrado com slug:', guideSlug);
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    console.log('✅ Guia encontrado:', doc.id);
    console.log('📊 Dados do guia:', data);
    console.log('💰 budgetConfig encontrado:', data.budgetConfig);
    
    return {
      id: doc.id,
      ...data
    };
  } catch (error) {
    console.error('💥 Erro ao obter dados completos do guia:', error);
    throw error;
  }
};
