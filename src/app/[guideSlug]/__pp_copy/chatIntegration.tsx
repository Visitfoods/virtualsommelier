'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  createGuideConversation, 
  sendGuideMessage, 
  listenToGuideConversation
} from '../../../firebase/guideServices';

interface ChatIntegrationProps {
  guideSlug: string;
  projectId: string;
  userName?: string;
  userEmail?: string;
}

export default function ChatIntegration({ guideSlug, projectId, userName, userEmail }: ChatIntegrationProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inicializar conversa quando o componente monta
  useEffect(() => {
    if (guideSlug && projectId) {
      initializeConversation();
    }
  }, [guideSlug, projectId]);

  // Escutar mudanças na conversa
  useEffect(() => {
    if (conversationId) {
      const unsubscribe = listenToGuideConversation(projectId, conversationId, (conversation) => {
        setMessages(conversation.messages || []);
      });
      return unsubscribe;
    }
  }, [conversationId, projectId]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeConversation = async () => {
    try {
      const existingConversationId = localStorage.getItem(`chat_${guideSlug}_conversation`);
      if (existingConversationId) {
        setConversationId(existingConversationId);
        return;
      }

      const conversationData = {
        guideSlug,
        projectId,
        userId: `user_${Date.now()}`,
        userName: userName || 'Visitante',
        userContact: userEmail || 'visitante@email.com',
        userEmail,
        status: 'active' as const,
        priority: 'medium' as const,
        category: 'general' as const,
        messages: [
          {
            from: 'guide' as const,
            text: `Olá ${userName || 'visitante'}! Sou o seu guia virtual do ${guideSlug}. Como posso ajudá-lo hoje?`,
            timestamp: new Date(),
            read: false,
            metadata: { guideResponse: true }
          }
        ]
      };

      const newConversationId = await createGuideConversation(projectId, conversationData);
      setConversationId(newConversationId);
      localStorage.setItem(`chat_${guideSlug}_conversation`, newConversationId);

      // Notificação de início de chat humano
      try {
        await fetch('/api/send-human-chat-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guideSlug, conversationId: newConversationId, user: { name: conversationData.userName, contact: conversationData.userEmail || conversationData.userContact } })
        });
      } catch (err) {
        console.warn('Falha ao enviar notificação de chat humano:', err);
      }
    } catch (error) {
      console.error('Erro ao inicializar conversa:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;
    try {
      setIsTyping(true);
      await sendGuideMessage(projectId, conversationId, {
        from: 'user',
        text: newMessage,
        metadata: { guideResponse: false }
      });
      setNewMessage('');
      setIsTyping(false);

      setTimeout(async () => {
        if (conversationId) {
          const autoResponse = generateAutoResponse(newMessage);
          await sendGuideMessage(projectId, conversationId, {
            from: 'guide',
            text: autoResponse,
            metadata: { guideResponse: true }
          });
        }
      }, 1000 + Math.random() * 2000);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setIsTyping(false);
    }
  };

  const generateAutoResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    if (message.includes('horário') || message.includes('aberto') || message.includes('fechado')) {
      return 'O nosso horário de funcionamento é de segunda a domingo, das 9h às 18h.';
    }
    if (message.includes('preço') || message.includes('bilhete') || message.includes('custo')) {
      return 'Os preços variam consoante a idade e tipo de visita.';
    }
    if (message.includes('estacionamento') || message.includes('parque')) {
      return 'Temos estacionamento gratuito disponível junto à entrada principal.';
    }
    if (message.includes('acessibilidade') || message.includes('cadeira de rodas')) {
      return 'O espaço é totalmente acessível a pessoas com mobilidade reduzida.';
    }
    if (message.includes('restaurante') || message.includes('comida') || message.includes('café')) {
      return 'Existe restaurante e cafetaria no local.';
    }
    return 'Obrigado pela sua mensagem! Um guia irá responder em breve.';
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-integration">
      <div className="chat-container">
        <div className="chat-header">
          <h3>Chat com o Guia</h3>
        </div>

        <div className="messages-area">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.from === 'user' ? 'user-message' : 'guide-message'}`}>
              <div className="message-content">{message.text}</div>
              <div className="message-time">
                {formatTime(message.timestamp)}
                {message.metadata?.guideResponse && (
                  <span className="guide-response-badge">Guia</span>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="message guide-message typing">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="message-input">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Digite sua mensagem..."
            disabled={!conversationId}
          />
          <button onClick={handleSendMessage} disabled={!newMessage.trim() || !conversationId}>Enviar</button>
        </div>
      </div>

      <style jsx>{`
        .chat-integration { position: fixed; bottom: calc(20px + var(--kb-safe-area-offset, 0px)); right: 20px; width: 350px; z-index: 1000; }
        .chat-container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); overflow: hidden; }
        .chat-header { background: #007bff; color: white; padding: 15px 20px; display: flex; align-items: center; }
        .chat-header h3 { margin: 0; font-size: 16px; }
        .messages-area { height: 300px; overflow-y: auto; padding: 15px; background: #f8f9fa; }
        .message { margin-bottom: 12px; max-width: 80%; }
        .user-message { margin-left: auto; text-align: right; }
        .guide-message { margin-right: auto; text-align: left; }
        .message-content { background: white; padding: 10px 12px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: inline-block; max-width: 100%; word-wrap: break-word; }
        .user-message .message-content { background: #007bff; color: white; }
        .guide-message .message-content { background: white; color: #333; }
        .message-time { font-size: 11px; color: #999; margin-top: 4px; display: flex; align-items: center; gap: 6px; }
        .user-message .message-time { justify-content: flex-end; }
        .guide-response-badge { background: #28a745; color: white; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
        .typing-indicator { display: flex; gap: 4px; padding: 10px 12px; }
        .typing-indicator span { width: 8px; height: 8px; background: #999; border-radius: 50%; animation: typing 1.4s infinite ease-in-out; }
        .typing-indicator span:nth-child(1){ animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2){ animation-delay: -0.16s; }
        @keyframes typing { 0%,80%,100%{ transform: scale(0.8); opacity: 0.5;} 40%{ transform: scale(1); opacity: 1;} }
        .message-input { display: flex; padding: 15px; background: white; border-top: 1px solid #eee; }
        .message-input input { flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; margin-right: 10px; font-size: 14px; }
        .message-input input:focus { outline: none; border-color: #007bff; }
        .message-input button { background: #007bff; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .message-input button:hover:not(:disabled) { background: #0056b3; }
        .message-input button:disabled { background: #ccc; cursor: not-allowed; }
        @media (max-width: 768px) { .chat-integration { width: calc(100vw - 40px); right: 20px; left: 20px; } }
      `}</style>
    </div>
  );
}
