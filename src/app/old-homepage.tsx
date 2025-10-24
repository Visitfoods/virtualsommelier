'use client';
import { useState, useRef, useEffect, FormEvent } from "react";
import styles from "./page.module.css";
import { 
  MainContactFormData, 
  createMainConversation, 
  addMessageToMainConversation,
  ChatMessage 
} from "../firebase/mainServices";

// Componentes SVG das bandeiras
function PortugalFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="16" fill="#006600"/>
      <rect x="8" width="16" height="16" fill="#FF0000"/>
      <circle cx="10" cy="8" r="3" fill="#FFFF00"/>
      <circle cx="10" cy="8" r="2.5" fill="#006600"/>
      <circle cx="10" cy="8" r="1.5" fill="#FFFF00"/>
    </svg>
  );
}

function EnglandFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="16" fill="#012169"/>
      <path d="M0 0L24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3"/>
      <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="2"/>
      <path d="M12 0V16M0 8H24" stroke="#FFFFFF" strokeWidth="5"/>
      <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="3"/>
    </svg>
  );
}

function SpainFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="16" fill="#FF0000"/>
      <rect y="4" width="24" height="8" fill="#FFCC00"/>
    </svg>
  );
}

function FranceFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="8" height="16" fill="#002395"/>
      <rect x="8" width="8" height="16" fill="#FFFFFF"/>
      <rect x="16" width="8" height="16" fill="#ED2939"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="22" rx="11" fill="rgba(255,255,255,0.18)" />
      <path d="M6 11L16 6L11 16L10 12L6 11Z" fill="#ffffff" stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

// CloseIcon component - Commented out to fix ESLint warning
/* function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 4.5L13.5 13.5M4.5 13.5L13.5 4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
} */

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 12H5M12 19L5 12L12 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Home() {
  // Estados para a interface
  const [showChatbotPopup, setShowChatbotPopup] = useState(false);
  const [showGuidePopup, setShowGuidePopup] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<Array<{from: 'user' | 'bot', text: string}>>([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showChatbotWelcome, setShowChatbotWelcome] = useState(true);
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatbotInputRef = useRef<HTMLInputElement>(null);

  // Estados para o loader
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Simular carregamento inicial com barra de progresso
  const simulateLoading = () => {
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // Adicionar um pequeno delay antes de esconder o loading
          setTimeout(() => {
            setIsLoading(false);
          }, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 100); // Intervalo mais rápido para progresso mais suave
  };

  // Carregar conversationId do localStorage
  useEffect(() => {
    // Limpar dados do localStorage quando a página é recarregada
    // para forçar o preenchimento do formulário
    localStorage.removeItem('conversationId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userContact');
    setConversationId(null);
  }, []);

  // Controlar scroll da página quando chatbot está aberto
  useEffect(() => {
    if (showChatbotPopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showChatbotPopup]);

  // Iniciar simulação de carregamento
  useEffect(() => {
    simulateLoading();
  }, []);

  // Banco de conhecimento local para o chatbot da página principal
  const knowledgeBase = {
    produto: {
      info: "O VirtualGuide é um produto tecnológico avançado que utiliza a inteligência artificial para oferecer uma experiência personalizada a todos os utilizadores. Através de uma aplicação intuitiva, disponível em smartphones (Android e iOS), tablets e computadores, o VirtualGuide atua como um assistente virtual diário, auxiliando na obtenção de informação sobre um negócio ou ponto turístico.",
      definicao: "O VirtualGuide revoluciona a forma como se exploram espaços turísticos e culturais. Ao visitar monumentos, museus ou centros históricos, o utilizador recebe informações interativas sobre o local, com conteúdos multimédia como um vídeo explicativo que enriquece a visita. Tudo isto em tempo real e adaptado ao perfil do utilizador.",
      missao: "O VirtualGuide tem como missão transformar a forma como as pessoas exploram e interagem com espaços turísticos e culturais, oferecendo experiências personalizadas e imersivas através da tecnologia de inteligência artificial."
    },
    tecnologia: {
      ia: "O VirtualGuide utiliza inteligência artificial avançada para oferecer uma experiência personalizada a cada utilizador, adaptando os conteúdos e informações ao perfil individual.",
      aplicacao: "A aplicação VirtualGuide está disponível em smartphones (Android e iOS), tablets e computadores, oferecendo uma experiência consistente em todos os dispositivos.",
      interatividade: "O VirtualGuide oferece informações interativas sobre locais, incluindo conteúdos multimédia como vídeos explicativos que enriquecem a experiência de visita."
    },
    dispositivos: {
      smartphones: "O VirtualGuide está disponível em smartphones Android e iOS, permitindo acesso móvel às funcionalidades.",
      tablets: "A aplicação é compatível com tablets, oferecendo uma experiência otimizada para ecrãs maiores.",
      computadores: "O VirtualGuide também funciona em computadores, proporcionando uma experiência completa em desktop."
    },
    idiomas: {
      disponiveis: "A aplicação está disponível em várias línguas, incluindo português, inglês, espanhol e francês, permitindo uma experiência inclusiva e acessível a utilizadores de diferentes nacionalidades.",
      inclusividade: "O VirtualGuide promove a inclusividade através do suporte a múltiplos idiomas, tornando a experiência acessível a utilizadores de diferentes nacionalidades."
    },
    empresas: {
      ferramenta: "Para as empresas, o VirtualGuide representa uma poderosa ferramenta de comunicação e promoção. Pode ser integrado em espaços comerciais, hotéis, museus, eventos ou cidades inteligentes.",
      beneficios: "As empresas podem personalizar os conteúdos apresentados, divulgar produtos e serviços, recolher dados sobre o comportamento dos visitantes e melhorar a experiência do cliente com base em feedback em tempo real.",
      integracao: "O VirtualGuide pode ser integrado em diversos espaços como centros comerciais, hotéis, museus, eventos ou cidades inteligentes, oferecendo aos visitantes experiências imersivas e interativas."
    },
    experiencias: {
      utilizadores: "Com o VirtualGuide, os utilizadores ganham um companheiro inteligente para o dia a dia e para as suas viagens, oferecendo informações personalizadas e interativas.",
      empresas: "As empresas descobrem uma nova forma de se conectar com o público de forma inovadora, eficiente e envolvente através do VirtualGuide.",
      personalizacao: "O VirtualGuide oferece uma experiência personalizada adaptada ao perfil de cada utilizador, fornecendo informações relevantes e conteúdos multimédia em tempo real."
    },
    conteudos: {
      multimidia: "O VirtualGuide disponibiliza conteúdos multimédia como vídeos explicativos que enriquecem a experiência de visita aos locais turísticos e culturais.",
      interativos: "Os utilizadores recebem informações interativas sobre monumentos, museus e centros históricos, com conteúdos adaptados ao seu perfil.",
      tempo_real: "Todas as informações e conteúdos são fornecidos em tempo real, garantindo uma experiência atualizada e dinâmica."
    }
  };

  // Função para formatar respostas do chat com HTML
  function formatChatResponse(text: string): string {
    return text
      .replace(/^### (.*$)/gim, '<p style="font-weight: 600; margin: 15px 0 10px 0; font-size: 18px; color: rgba(255, 255, 255, 1);">$1</p>')
      .replace(/^## (.*$)/gim, '<p style="font-weight: 700; margin: 15px 0 10px 0; font-size: 19px; color: rgba(255, 255, 255, 1);">$1</p>')
      .replace(/^# (.*$)/gim, '<p style="font-weight: 800; margin: 15px 0 10px 0; font-size: 20px; color: rgba(255, 255, 255, 1);">$1</p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700; color: rgba(255, 255, 255, 1);">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="font-style: italic; color: rgba(255, 255, 255, 0.9);">$1</em>')
      .replace(/^\* (.*$)/gim, '<li style="margin: 8px 0; padding-left: 0; color: rgba(255, 255, 255, 1);">$1</li>')
      .replace(/^- (.*$)/gim, '<li style="margin: 8px 0; padding-left: 0; color: rgba(255, 255, 255, 1);">$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3498db; text-decoration: none; border-bottom: 1px dotted #3498db;" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 1); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 14px;">$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre style="background: rgba(0, 0, 0, 0.6); color: rgba(255, 255, 255, 1); padding: 15px; border-radius: 8px; overflow-x: auto; margin: 15px 0; font-family: monospace; font-size: 14px; line-height: 1.4;">$1</pre>')
      .replace(/\n\n/g, '</p><p style="margin: 12px 0; line-height: 1.6; color: rgba(255, 255, 255, 1);">')
      .replace(/^(.*)$/gm, '<p style="margin: 12px 0; line-height: 1.6; color: rgba(255, 255, 255, 1);">$1</p>')
      .replace(/<p style="margin: 12px 0; line-height: 1.6; color: rgba(255, 255, 255, 1);"><\/p>/g, '')
      .replace(/<\/h([1-3])><p/g, '</h$1><div style="margin: 15px 0;"><p')
      .replace(/<\/p><\/div>/g, '</p></div>');
  }

  // Função para gerar resposta local baseada no conhecimento
  function generateLocalResponse(userMessage: string): string {
    const message = userMessage.toLowerCase();
    
    // Verificar produto
    if (message.includes('virtualguide') || message.includes('virtual guide') || message.includes('o que é') || message.includes('quem')) {
      return knowledgeBase.produto.info;
    }
    
    if (message.includes('definição') || message.includes('definicao') || message.includes('como funciona')) {
      return knowledgeBase.produto.definicao;
    }
    
    if (message.includes('missão') || message.includes('missao') || message.includes('objetivo')) {
      return knowledgeBase.produto.missao;
    }
    
    // Verificar tecnologia
    if (message.includes('inteligência artificial') || message.includes('inteligencia artificial') || message.includes('ia') || message.includes('ai')) {
      return knowledgeBase.tecnologia.ia;
    }
    
    if (message.includes('aplicação') || message.includes('aplicacao') || message.includes('app')) {
      return knowledgeBase.tecnologia.aplicacao;
    }
    
    if (message.includes('interativo') || message.includes('interatividade') || message.includes('interação')) {
      return knowledgeBase.tecnologia.interatividade;
    }
    
    // Verificar dispositivos
    if (message.includes('smartphone') || message.includes('android') || message.includes('ios') || message.includes('telemóvel')) {
      return knowledgeBase.dispositivos.smartphones;
    }
    
    if (message.includes('tablet') || message.includes('ipad')) {
      return knowledgeBase.dispositivos.tablets;
    }
    
    if (message.includes('computador') || message.includes('desktop') || message.includes('pc')) {
      return knowledgeBase.dispositivos.computadores;
    }
    
    // Verificar idiomas
    if (message.includes('idioma') || message.includes('língua') || message.includes('lingua') || message.includes('português') || message.includes('inglês') || message.includes('espanhol') || message.includes('francês')) {
      return knowledgeBase.idiomas.disponiveis;
    }
    
    if (message.includes('inclusivo') || message.includes('inclusividade') || message.includes('acessível')) {
      return knowledgeBase.idiomas.inclusividade;
    }
    
    // Verificar empresas
    if (message.includes('empresa') || message.includes('negócio') || message.includes('negocio') || message.includes('comercial')) {
      return knowledgeBase.empresas.ferramenta;
    }
    
    if (message.includes('benefício') || message.includes('beneficio') || message.includes('vantagem')) {
      return knowledgeBase.empresas.beneficios;
    }
    
    if (message.includes('integração') || message.includes('integracao') || message.includes('hotel') || message.includes('museu') || message.includes('evento')) {
      return knowledgeBase.empresas.integracao;
    }
    
    // Verificar experiências
    if (message.includes('utilizador') || message.includes('usuário') || message.includes('usuario') || message.includes('companheiro')) {
      return knowledgeBase.experiencias.utilizadores;
    }
    
    if (message.includes('conectar') || message.includes('inovador') || message.includes('envolvente')) {
      return knowledgeBase.experiencias.empresas;
    }
    
    if (message.includes('personalizado') || message.includes('personalizada') || message.includes('perfil')) {
      return knowledgeBase.experiencias.personalizacao;
    }
    
    // Verificar conteúdos
    if (message.includes('multimédia') || message.includes('multimedia') || message.includes('vídeo') || message.includes('video')) {
      return knowledgeBase.conteudos.multimidia;
    }
    
    if (message.includes('interativo') || message.includes('monumento') || message.includes('museu')) {
      return knowledgeBase.conteudos.interativos;
    }
    
    if (message.includes('tempo real') || message.includes('tempo-real') || message.includes('atualizado')) {
      return knowledgeBase.conteudos.tempo_real;
    }
    
    // Saudações e despedidas
    if (message.includes('olá') || message.includes('oi') || message.includes('bom dia') || 
        message.includes('boa tarde') || message.includes('boa noite')) {
      return "Olá! Sou o assistente virtual do VirtualGuide. Como posso ajudar?";
    }
    
    if (message.includes('obrigado') || message.includes('adeus') || message.includes('até logo')) {
      return "Obrigado por contactar o VirtualGuide! Estamos sempre disponíveis para ajudar. Tenha um excelente dia!";
    }
    
    // Resposta genérica
    return "Obrigado pela sua pergunta. O VirtualGuide é uma solução tecnológica avançada que utiliza inteligência artificial para oferecer experiências personalizadas. Para mais informações, pode explorar as funcionalidades disponíveis na aplicação.";
  }

  // Função para chamar a API de IA (via OpenRouter na rota interna)
  async function callOpenRouterAI(userMessage: string) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `[INÍCIO SISTEMA: CONFIGURAÇÃO "Assistente Virtual do Virtual Guide"]

Tu és o assistente virtual oficial do Virtual Guide, uma aplicação tecnológica avançada que utiliza inteligência artificial para proporcionar experiências personalizadas e imersivas a utilizadores e empresas. A tua função é informar, esclarecer dúvidas e orientar os utilizadores sobre as funcionalidades, vantagens e formas de utilização do VirtualGuide.

Atenção: deves comunicar **exclusivamente em português de Portugal**, com uma linguagem clara, acessível, cordial e profissional. Adapta o teu tom consoante o perfil de quem interage contigo (turista, visitante, empresa ou entidade pública), mantendo sempre uma postura confiável, positiva e informativa.

### Conhecimentos fundamentais:
- O Virtual Guide está disponível em smartphones (Android e iOS), tablets e computadores.
- A aplicação pode ser utilizada em várias línguas, incluindo: português, inglês, espanhol e francês.
- Fornece conteúdos multimédia interativos (ex: vídeos explicativos) durante visitas a monumentos, museus, centros históricos e outros espaços culturais.
- Os conteúdos são adaptados em tempo real ao perfil do utilizador.
- É uma ferramenta útil no dia a dia e em viagens, oferecendo informações personalizadas e enriquecidas.
- As empresas podem integrá-lo em hotéis, museus, eventos, espaços comerciais e cidades inteligentes, com funcionalidades de personalização, promoção e recolha de dados sobre o comportamento dos visitantes.
- Permite melhorar a experiência do cliente com base em feedback em tempo real.

### Objectivos do chatbot:
- Esclarecer o que é o Virtual Guide, como funciona e onde pode ser usado.
- Apresentar os benefícios tanto para utilizadores individuais como para empresas.
- Informar sobre os conteúdos multimédia disponíveis, os dispositivos compatíveis e os idiomas suportados.
- Dar exemplos de casos de utilização e responder a perguntas frequentes.
- Estimular o interesse pelo produto e reforçar a sua utilidade e inovação.

### Restrições:
- Não inventes funcionalidades não mencionadas.
- Não forneças suporte técnico detalhado (encaminha para o suporte oficial quando necessário).
- Não assumes o papel de guia turístico humano.
- Não recolhes dados pessoais nem pedes informações sensíveis.

Mantém sempre o foco em ser um assistente informativo, prestável e alinhado com a missão do Virtual Guide: oferecer experiências personalizadas, interativas e inteligentes, tanto a utilizadores como a empresas, em Portugal e no mundo.

Always Respond in European Portuguese
[FINAL SISTEMA]`
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          model: "openai/gpt-4o-mini",
          max_tokens: 512,
          temperature: 0.7,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        console.error('Erro na API:', await response.text());
        return generateLocalResponse(userMessage);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        let responseText = "";
        if (data.choices[0].message && data.choices[0].message.content) {
          responseText = data.choices[0].message.content;
        } else if (data.choices[0].text) {
          responseText = data.choices[0].text;
        } else {
          return generateLocalResponse(userMessage);
        }
        
        responseText = responseText
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .replace(/<think>[\s\S]*?/g, '')
          .replace(/[\s\S]*?<\/think>/g, '')
          .replace(/<[^>]*>/g, '')
          .trim();
        
        responseText = formatChatResponse(responseText);
        
        const englishIndicators = ['the', 'and', 'for', 'with', 'this', 'that', 'what', 'where', 'when', 'how', 'which', 'who'];
        const words = responseText.toLowerCase().split(/\s+/);
        const englishWordCount = words.filter(word => englishIndicators.includes(word)).length;
        
        if (englishWordCount > 2 || responseText.length < 10) {
          return generateLocalResponse(userMessage);
        }
        
        return responseText || generateLocalResponse(userMessage);
      }
      
      return generateLocalResponse(userMessage);
    } catch (error) {
      console.error('Erro ao chamar a API:', error);
      return generateLocalResponse(userMessage);
    }
  }

  // Handlers para as bandeiras
  function handleFlagClick(country: string) {
    if (country !== 'portugal') {
      localStorage.setItem('selectedLanguage', country);
      window.location.href = '/coming-soon';
    }
  }

  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async function handleGuideFormSubmit(e: FormEvent) {
    e.preventDefault();
    
    if (!formName.trim() || !formContact.trim()) {
      setFormError('Por favor, preencha todos os campos.');
      return;
    }

    const contact = formContact.trim();
    if (!isValidEmail(contact)) {
      setFormError('Por favor, insira um email válido.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      // Preparar dados para o Firebase
      const contactData: MainContactFormData = {
        name: formName.trim(),
        email: contact,
        source: 'main-page'
      };

      // Criar conversa no Firebase (inclui automaticamente os dados do contacto)
      const newConversationId = await createMainConversation(contactData);
      setConversationId(newConversationId);
      
      // Guardar dados no localStorage
      localStorage.setItem('userName', formName);
      localStorage.setItem('userContact', formContact);
      localStorage.setItem('conversationId', newConversationId);
      
      // Limpar formulário
      setFormName('');
      setFormContact('');
      setFormSubmitted(true);
      
      // Fechar popup e abrir chat
      setTimeout(() => {
        setShowGuidePopup(false);
        setShowChatbotPopup(true);
        setFormSubmitted(false);
        document.body.style.overflow = 'hidden';
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao enviar dados para o Firebase:', error);
      setFormError('Erro ao enviar dados. Tente novamente.');
    } finally {
      setFormSubmitting(false);
    }
  }



  function handleSearchBarClick() {
    // Se já existe uma conversa ativa, abrir diretamente o chat
    if (conversationId) {
      setShowChatbotPopup(true);
      // Mostrar mensagem inicial se não há mensagens na conversa
      if (chatbotMessages.length === 0) {
        setShowInstructions(true);
        setShowChatbotWelcome(true);
      } else {
        setShowInstructions(false);
        setShowChatbotWelcome(false);
      }
      document.body.style.overflow = 'hidden';
    } else {
      // Se não há conversa ativa, abrir o formulário
    setShowGuidePopup(true);
    }
  }

  function handleCloseChatbot() {
    setShowChatbotPopup(false);
    // Não resetar as instruções ao fechar, manter o estado
    document.body.style.overflow = 'auto';
    // Não abrir o formulário de contacto novamente
    // setShowGuidePopup(false);
  }

  async function handleChatbotSend(e: React.FormEvent) {
    e.preventDefault();
    const chatbotInput = chatbotInputRef.current?.value;
    if (!chatbotInput?.trim()) return;
    
    // Esconder a mensagem inicial quando a primeira mensagem for enviada
    if (chatbotMessages.length === 0) {
      setShowInstructions(false);
      setShowChatbotWelcome(false);
    }
    
    const userMessage: ChatMessage = { 
      from: 'user', 
      text: chatbotInput,
      timestamp: new Date().toISOString()
    };
    setChatbotMessages(prev => [...prev, userMessage]);
    
    if (chatbotInputRef.current) {
      chatbotInputRef.current.value = "";
    }
    
    setChatbotMessages(prev => [...prev, { 
      from: 'bot', 
      text: '...',
      timestamp: new Date().toISOString()
    }]);
    
    try {
      // Guardar mensagem do utilizador no Firebase
      if (conversationId) {
        await addMessageToMainConversation(conversationId, userMessage);
      }
      
      const response = await callOpenRouterAI(chatbotInput);
      const botMessage: ChatMessage = { 
        from: 'bot', 
        text: response,
        timestamp: new Date().toISOString()
      };
      
      setChatbotMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].text === '...') {
          newMessages[newMessages.length - 1] = botMessage;
        } else {
          newMessages.push(botMessage);
        }
        return newMessages;
      });
      
      // Guardar resposta do bot no Firebase
      if (conversationId) {
        await addMessageToMainConversation(conversationId, botMessage);
      }
      
    } catch (error) {
      console.error('Erro ao processar resposta:', error);
      const errorMessage: ChatMessage = { 
        from: 'bot', 
        text: "Desculpe, estou com dificuldades técnicas neste momento. Pode tentar novamente ou contactar-nos diretamente através do telefone +351 239 801 170.",
        timestamp: new Date().toISOString()
      };
      
      setChatbotMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].text === '...') {
          newMessages[newMessages.length - 1] = errorMessage;
        }
        return newMessages;
      });
      
      // Guardar mensagem de erro no Firebase
      if (conversationId) {
        await addMessageToMainConversation(conversationId, errorMessage);
      }
    }
  }

  function handleChatbotInputChange() {
    // Não esconder automaticamente as instruções ao digitar
    // Só esconder quando uma mensagem for enviada
  }

  function handleChatInputClick() {
    // Se já existe uma conversa ativa, não fazer nada (chat já está aberto)
    if (!conversationId) {
    setShowGuidePopup(true);
    }
  }

  return (
    <div className={`${styles.bgVideoContainer} ${showChatbotPopup ? styles.chatbotOpen : ''}`}>
      {/* Loading Screen */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContent}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <img 
                src="/Icon Virtualguide.svg" 
                alt="VirtualGuide Logo" 
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
              />
            </div>
            <h2 className={styles.loadingTitle}>Estamos a preparar o seu Virtual Sommelier</h2>
            <div className={styles.loadingProgressContainer}>
              <div className={styles.loadingProgressBar}>
                <div 
                  className={styles.loadingProgressFill}
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <span className={styles.loadingProgressText}>{Math.round(loadingProgress)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Barra de bandeiras no topo */}
        <div className={styles.flagsBar}>
          <div className={styles.flagsContainer}>
            {/* Botão de voltar para chat - aparece quando há conversa no chat e não está aberto */}
            {chatbotMessages.length > 0 && !showChatbotPopup && (
              <button 
                className={styles.backToChatButton}
                onClick={() => {
                  setShowChatbotPopup(true);
                }}
                title="Voltar ao chat"
                aria-label="Voltar ao chat"
              >
                <span className={styles.buttonText}>voltar conversa</span>
              </button>
            )}
            <div className={styles.flagsGroup}>
              <div className={styles.flagItem} onClick={() => handleFlagClick('portugal')}>
                <PortugalFlag />
              </div>
              <div className={styles.flagItem} onClick={() => handleFlagClick('england')}>
                <EnglandFlag />
              </div>
              <div className={styles.flagItem} onClick={() => handleFlagClick('spain')}>
                <SpainFlag />
              </div>
              <div className={styles.flagItem} onClick={() => handleFlagClick('france')}>
                <FranceFlag />
              </div>
            </div>
          </div>
        </div>

      {/* Vídeo de fundo */}
      <video
        className={styles.backgroundImage}
        src="/Judite_2.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          objectFit: 'cover',
          objectPosition: 'center 15px'
        }}
      />



      {/* Barra de Pesquisa - mostrar quando chat fechado e formulário fechado */}
      {!showChatbotPopup && !showGuidePopup && (
        <div className={styles.glassmorphismControlBar}>
          <div className={styles.searchInputContainer}>
            <div className={styles.searchInputWrapper}>
              <svg className={styles.chatInputIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12 C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12H16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 8H13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 16H11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
                <input 
                  type="text"
                className={styles.searchInput}
                placeholder="Escreva a sua pergunta"
                onClick={handleSearchBarClick}
                readOnly
              />
              <button className={styles.searchButton} onClick={handleSearchBarClick}>
                <SendIcon />
              </button>
            </div>
              </div>
                </div>
      )}



      {/* Popup do Formulário de Dados Pessoais */}
      {showGuidePopup && (
        <div className={styles.guidePopupOverlay}>
          <div className={styles.guidePopup}>
            <div className={styles.guidePopupHeader}>
              <h3>Dados Pessoais</h3>
              <button 
                className={styles.closeButton} 
                onClick={() => {
                  setShowGuidePopup(false);
                  setFormName('');
                  setFormContact('');
                  setFormError(null);
                }}
                aria-label="Fechar"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.5 4.5L13.5 13.5M4.5 13.5L13.5 4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className={styles.guidePopupContent}>
              {formError && (
                <div className={styles.formError}>
                  {formError}
                </div>
              )}
              
              {formSubmitted ? (
                <div className={styles.formSuccess}>
                  <p>Dados enviados com sucesso!</p>
                  <p>A redirecionar para o chat...</p>
                </div>
              ) : (
                <form className={styles.guideForm} onSubmit={handleGuideFormSubmit}>
                  <div className={styles.formField}>
                    <label htmlFor="name">Nome completo *</label>
                    <input
                      type="text"
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Digite o seu nome completo"
                      required
                    />
                  </div>
                  
                  <div className={styles.formField}>
                    <label htmlFor="contact">Email *</label>
                    <input
                      type="email"
                      id="contact"
                      value={formContact}
                      onChange={(e) => setFormContact(e.target.value)}
                      placeholder="Digite o seu email"
                      required
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    className={styles.guideSubmitButton}
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? 'A enviar...' : 'Iniciar Conversa'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Popup do Chatbot */}
      {showChatbotPopup && (
        <div className={styles.chatbotPopupOverlay}>
          <div className={`${styles.chatbotPopup} ${showChatbotPopup ? styles.fullscreenPopup : ''}`}>
            <div className={styles.chatbotHeader}>
              <div className={styles.chatbotHeaderTitle}>
                <h3>BEM-VINDO AO ASSISTENTE VIRTUAL</h3>
                <p className={styles.chatbotHeaderSubtitle}>VIRTUAL GUIDE</p>
              </div>
                  <button 
                className={styles.backButton} 
                onClick={handleCloseChatbot}
                aria-label="Voltar"
              >
                <BackIcon />
                <span>voltar</span>
                  </button>
            </div>
            <div className={styles.chatbotContent}>
              {showChatbotWelcome && (
                <div className={styles.chatbotWelcome}>
                  {showInstructions && (
                    <div className={styles.glassmorphismBox}>
                      <div className={styles.chatbotInstructions}>
                        <div className={styles.instructionItem}>
                          <div className={styles.customBullet}></div>
                          <span>O que é o Virtual Guide ?</span>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.customBullet}></div>
                          <span>Em que locais está implementado o Virtual Guide ?</span>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.customBullet}></div>
                          <span>Como funciona a assistência técnica ?</span>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.customBullet}></div>
                          <span>Que tipos de conteúdos multimédia são disponibilizados (áudio, vídeo, realidade aumentada, etc.) ?</span>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.customBullet}></div>
                          <span>Em que dispositivos o Virtual Guide está disponível ?</span>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.customBullet}></div>
                          <span>O Virtual Guide está disponível em várias línguas ?</span>
                        </div>
                      </div>
                    </div>
                  )}
            </div>
              )}
              {chatbotMessages.length > 0 && (
                <div className={styles.chatbotMessages}>
                  {chatbotMessages.map((message, index) => (
                    <div key={index} className={message.from === 'user' ? styles.chatbotUserMessage : styles.chatbotBotMessage}>
                      <div className={styles.messageContent}>
                        <div dangerouslySetInnerHTML={{ __html: message.text }} />
                  </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.chatbotInputBar}>
              <form onSubmit={handleChatbotSend} className={styles.chatbotForm}>
                <input
                  ref={chatbotInputRef}
                  type="text"
                  className={styles.chatbotInput}
                  placeholder="Escreva a sua pergunta..."
                  onChange={handleChatbotInputChange}
                  onClick={handleChatInputClick}
                />
                <button type="submit" className={styles.chatbotSendButton}>
                  <SendIcon />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
            </div>
  );
}

