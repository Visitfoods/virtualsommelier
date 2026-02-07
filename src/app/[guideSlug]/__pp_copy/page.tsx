'use client';
import styles from "./page.module.css";
import React, { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { useSanitizedHtml, sanitizeHtml } from "@/utils/htmlSanitizer";
import MobileOptimizedVideo from "../../../components/MobileOptimizedVideo";
import PiPOptimizedVideo from "../../../components/PiPOptimizedVideo";
import OrientationWarning from "../../../components/OrientationWarning";
import { useVideoOptimization, usePiPOptimization } from "../../../hooks/useVideoOptimization";

import Image from "next/image";
import LinkPreviewCard, { extractUrlsFromText } from "../../../components/LinkPreviewCard";
import { saveContactRequest, createConversation, sendMessage, listenToConversation, closeConversation, type Conversation, type ChatMessage, getConversation } from "../../../firebase/services";
import { listAvailableGuides } from "../../../firebase/guideServices";

// Tipo local que estende ChatMessage com metadata para compatibilidade com GuideChatMessage
type ExtendedChatMessage = ChatMessage & {
  metadata?: {
    showWhenOpenedByGuide?: boolean;
    isTransitionMessage?: boolean;
    guideResponse?: boolean;
    closingMessage?: boolean;
    messageType?: 'text' | 'image' | 'file';
    fileUrl?: string;
    responseTime?: number;
  };
};
import { createGuideConversation, sendGuideMessage, listenToGuideConversation, getGuideConversation, closeGuideConversation } from "../../../firebase/guideServices";
import { getAuthHeaders } from "@/services/apiKeyService";

// Interface para os vídeos do guia
interface GuideVideos {
  backgroundVideoURL: string | null;
  mobileTabletBackgroundVideoURL: string | null;
  welcomeVideoURL: string | null;
  systemPrompt: string | null;
  websiteUrl?: string | null;
  chatConfig?: {
    welcomeTitle?: string | null;
    button1Text?: string | null;
    button1Function?: string | null;
    button2Text?: string | null;
    button2Function?: string | null;
    button3Text?: string | null;
    button3Function?: string | null;
    downloadVideoEnabled?: boolean | null;
  } | null;
  helpPoints?: {
    point1?: string | null;
    point2?: string | null;
    point3?: string | null;
    point4?: string | null;
    point5?: string | null;
  } | null;
  faq?: {
    name: string;
    questions: {
      question: string;
      answer: string;
      images?: string[];
    }[];
  }[];
  faqByLang?: {
    pt?: {
      name: string;
      questions: {
        question: string;
        answer: string;
        images?: string[];
      }[];
    }[] | null;
    en?: {
      name: string;
      questions: {
        question: string;
        answer: string;
        images?: string[];
      }[];
    }[] | null;
    es?: {
      name: string;
      questions: {
        question: string;
        answer: string;
        images?: string[];
      }[];
    }[] | null;
    fr?: {
      name: string;
      questions: {
        question: string;
        answer: string;
        images?: string[];
      }[];
    }[] | null;
  } | null;
  humanChatEnabled?: boolean | null;
  chatIconURL?: string | null;
  companyIconURL?: string | null;
  quickButtonsDisabled?: boolean | null;
  quickAreaImageURL?: string | null;
  quickAreaImageLink?: string | null;
  captions?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
  captionsByLang?: {
    pt?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    en?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    es?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    fr?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
  } | null;
  chatConfigByLang?: {
    pt?: {
      welcomeTitle?: string | null;
      button1Text?: string | null;
      button1Function?: string | null;
      button2Text?: string | null;
      button2Function?: string | null;
      button3Text?: string | null;
      button3Function?: string | null;
      downloadVideoEnabled?: boolean | null;
    } | null;
    en?: this['chatConfigByLang']['pt'] | null;
    es?: this['chatConfigByLang']['pt'] | null;
    fr?: this['chatConfigByLang']['pt'] | null;
  } | null;
}

// Props do componente
// Props do componente inline no export default (mantido para alinhar com tipos já usados no ficheiro)

// Estrutura de gestão de memória de conversa
// getAuthHeaders já importado no topo
type ConversationMessage = { role: "system" | "user" | "assistant"; content: string };
const conversation: ConversationMessage[] = [];

// (Removido: prompt estático antigo; agora usamos sempre o systemPrompt do Firestore)

// Função para obter sumário da conversa (opcional)
async function getSummary(conversation: ConversationMessage[], websiteUrl?: string | null): Promise<string> {
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: ((): HeadersInit => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }))(),
      body: JSON.stringify({
        q: "Faz um resumo conciso da conversa em português de Portugal. Máximo 128 tokens.",
        opts: {
          history: conversation,
          // deixar o backend decidir tokens
          temperature: 0.3,
          verbosity: "low"
        },
        website: websiteUrl || undefined
      })
    });

    if (!response.ok) {
      return "Resumo da conversa anterior";
    }

    const data = await response.json();
    if (data.text) {
      return data.text;
    }
    
    return "Resumo da conversa anterior";
  } catch (error) {
    console.error('Erro ao obter sumário:', error);
    return "Resumo da conversa anterior";
  }
}

// TTL para cache local das conversas/mensagens (2 dias)
const CHAT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

// Funções para persistência longa (bónus)
function saveConversationToStorage(guideSlug: string) {
  try {
    const key = `chatbot_conversation_${String(guideSlug || 'default')}`;
    const payload = { ts: Date.now(), data: conversation };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.error('Erro ao guardar conversa:', error);
  }
}

function loadConversationFromStorage(guideSlug: string) {
  try {
    const key = `chatbot_conversation_${String(guideSlug || 'default')}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // formato antigo (sem TTL)
        conversation.length = 0;
        conversation.push(...parsed);
        // atualizar para novo formato com TTL
        try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: conversation })); } catch {}
      } else if (parsed && typeof parsed === 'object') {
        const ts = Number(parsed.ts || 0);
        const data = Array.isArray(parsed.data) ? parsed.data : [];
        if (ts > 0 && Date.now() - ts > CHAT_TTL_MS) {
          // expirado
          try { localStorage.removeItem(key); } catch {}
          return;
        }
        conversation.length = 0;
        conversation.push(...data);
      }
    }
  } catch (error) {
    console.error('Erro ao carregar conversa:', error);
  }
}

// Cache local das mensagens visíveis no chat (UI)
function saveChatbotMessagesToStorage(guideSlug: string, msgs: Array<{ from: 'user' | 'bot'; text: string; metadata?: { fromChatbot?: boolean; isThinking?: boolean } }>) {
  try {
    const key = `chatbot_messages_${String(guideSlug || 'default')}`;
    // Evitar guardar placeholders de "a pensar" e mensagens vazias
    const cleaned = (msgs || []).filter(m => !m?.metadata?.isThinking && String(m?.text || '').trim().length > 0);
    // Limitar histórico guardado
    const limited = cleaned.slice(-50);
    const payload = { ts: Date.now(), data: limited };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    try { console.error('Erro ao guardar mensagens do chatbot:', error); } catch {}
  }
}

function loadChatbotMessagesFromStorage(guideSlug: string): Array<{ from: 'user' | 'bot'; text: string; metadata?: { fromChatbot?: boolean; isThinking?: boolean } }> {
  try {
    const key = `chatbot_messages_${String(guideSlug || 'default')}`;
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      // formato antigo (sem TTL)
      try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: parsed })); } catch {}
      return parsed as any;
    }
    if (parsed && typeof parsed === 'object') {
      const ts = Number(parsed.ts || 0);
      const data = Array.isArray(parsed.data) ? parsed.data : [];
      if (ts > 0 && Date.now() - ts > CHAT_TTL_MS) {
        // expirado
        try { localStorage.removeItem(key); } catch {}
        return [];
      }
      return data as any;
    }
    return [];
  } catch (error) {
    try { console.error('Erro ao carregar mensagens do chatbot:', error); } catch {}
    return [];
  }
}

// Deteção simples de intenção de orçamento (multilíngue)
function detectBudgetIntent(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const patterns: RegExp[] = [
    // Português
    /orçamento/s,
    /orcamento/s,
    /pedido\s+de\s+orçamento/s,
    /pedido\s+de\s+orcamento/s,
    /fazer\s+um\s+orçamento/s,
    /comprar\b/s,
    /compra\b/s,
    /(adquirir|adquira|adquiri)\b/s,
    /encomendar\b/s,
    /pedido\s+de\s+cotação/s,
    /cotação/s,
    /cotacao/s,
    /proposta\s+comercial/s,
    /estimativa\s+de\s+preço/s,
    /estimativa\s+de\s+preco/s,
    /preço\s+final/s,
    /preco\s+final/s,
    // Inglês
    /quote\b/s,
    /budget\b/s,
    /quotation\b/s,
    /estimate\b/s,
    /pricing\b/s,
    /price\s+quote/s,
    /cost\s+estimate/s,
    /buy\b/s,
    /purchase\b/s,
    /order\b/s,
    /checkout\b/s,
    /add\s+to\s+cart/s,
    // Espanhol
    /presupuesto\b/s,
    /cotización\b/s,
    /presupuestar\b/s,
    /solicitar\s+presupuesto/s,
    /pedir\s+presupuesto/s,
    /comprar\b/s,
    /adquirir\b/s,
    /encargar\b/s,
    /precio\s+final/s,
    /estimación\s+de\s+precio/s,
    // Francês
    /devis\b/s,
    /budget\b/s,
    /estimation\b/s,
    /tarif\b/s,
    /prix\s+final/s,
    /demander\s+un\s+devis/s,
    /obtenir\s+un\s+devis/s,
    /acheter\b/s,
    /achat\b/s,
    /commander\b/s,
    /commande\b/s,
  ];
  return patterns.some((re) => re.test(t));
}

// Deteção simples de intenção de falar com comerciais/vendas (multilíngue)
function detectSalesIntent(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const patterns: RegExp[] = [
    // Português
    /falar\s+com\s+o\s+comercial/s,
    /falar\s+com\s+comercial/s,
    /falar\s+com\s+os\s+comerciais/s,
    /comercial\b/s,
    /comerciais\b/s,
    /vendas\b/s,
    /ligar\s+ao?\s+comercial/s,
    /contactar\s+vendas/s,
    /contacto\s+comercial/s,
    /telefone\s+do\s+comercial/s,
    // Inglês
    /sales\b/s,
    /commercial\b/s,
    /speak\s+to\s+sales/s,
    /talk\s+to\s+sales/s,
    /contact\s+sales/s,
    /sales\s+team/s,
    /sales\s+representative/s,
    // Espanhol
    /ventas\b/s,
    /comercial\b/s,
    /hablar\s+con\s+ventas/s,
    /contactar\s+ventas/s,
    /equipo\s+de\s+ventas/s,
    /representante\s+de\s+ventas/s,
    // Francês
    /ventes\b/s,
    /commercial\b/s,
    /parler\s+aux\s+ventes/s,
    /contacter\s+les\s+ventes/s,
    /équipe\s+de\s+ventes/s,
    /représentant\s+commercial/s,
  ];
  return patterns.some((re) => re.test(t));
}

// Estado do modal de contacto simples (independente do Guia Real)
// (declarado dentro do componente React)

// Funções para gerir cookies
function setCookie(name: string, value: string, days: number = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name: string): string | null {
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
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

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

// MicIcon component for audio recording functionality - Commented out to fix ESLint warning
/* function MicIcon({active}: {active?: boolean}) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="22" rx="11" fill={active ? "#cb3c58" : "rgba(255,255,255,0.18)"} />
      <path d="M11 15.5C13.2091 15.5 15 13.7091 15 11.5V8.5C15 6.29086 13.2091 4.5 11 4.5C8.79086 4.5 7 6.29086 7 8.5V11.5C7 13.7091 8.79086 15.5 11 15.5Z" stroke="#51aecd" strokeWidth="1.5"/>
      <path d="M5.5 11.5C5.5 14.2614 7.73858 16.5 10.5 16.5C13.2614 16.5 15.5 14.2614 15.5 11.5" stroke="#51aecd" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 16.5V18" stroke="#51aecd" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
} */

function SendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="22" rx="11" fill="rgba(255,255,255,0.18)" />
      <path d="M6 11L16 6L11 16L10 12L6 11Z" fill="#ffffff" stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 4.5L13.5 13.5M4.5 13.5L13.5 4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 12H5M12 19L5 12L12 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// GuideIcon component for guide functionality - Commented out to fix ESLint warning
/* function GuideIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 13V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 16V16.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
} */

function RewindIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 242.6 246.39" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path fill="white" d="m6.01,144.55c4.29-1.12,8.67,1.46,9.79,5.75,34.37,120.48,207.81,98.3,210.75-27.06.7-83.75-94.88-135.92-164.88-90.17l7.79,11.05c1.61,2.28.14,5.44-2.63,5.69l-47.4,4.29c-2.78.25-4.78-2.6-3.61-5.13L35.79,5.78c1.17-2.53,4.64-2.84,6.25-.57l10.36,14.7c82.01-52.88,189.94,5.69,190.19,103.32.71,67.04-56.1,123.86-123.15,123.15-54.96.68-105.9-38.77-119.18-92.04-1.12-4.29,1.46-8.67,5.74-9.79Z"/>
        <g>
          <path fill="white" d="m103.13,159.36h-14.05v-52.93c-5.13,4.8-11.18,8.35-18.14,10.65v-12.75c3.67-1.2,7.65-3.47,11.95-6.82,4.3-3.35,7.25-7.26,8.85-11.72h11.4v73.58Z"/>
          <path fill="white" d="m147.87,85.78c7.1,0,12.65,2.53,16.65,7.6,4.77,6,7.15,15.95,7.15,29.84s-2.4,23.83-7.2,29.89c-3.97,5-9.5,7.5-16.6,7.5s-12.88-2.74-17.24-8.22c-4.37-5.48-6.55-15.25-6.55-29.32s2.4-23.73,7.2-29.79c3.97-5,9.5-7.5,16.6-7.5Zm0,11.65c-1.7,0-3.22.54-4.55,1.62-1.33,1.08-2.37,3.02-3.1,5.82-.97,3.63-1.45,9.75-1.45,18.34s.43,14.5,1.3,17.72c.87,3.22,1.96,5.36,3.27,6.42,1.32,1.07,2.82,1.6,4.52,1.6s3.22-.54,4.55-1.62c1.33-1.08,2.37-3.02,3.1-5.82.97-3.6,1.45-9.7,1.45-18.29s-.43-14.5-1.3-17.72c-.87-3.22-1.96-5.36-3.27-6.45-1.32-1.08-2.82-1.62-4.52-1.62Z"/>
        </g>
      </g>
    </svg>
  );
}

function FastForwardIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 242.6 246.39" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="white" d="m236.59,144.55c-4.29-1.12-8.67,1.46-9.79,5.75-34.37,120.48-207.81,98.3-210.75-27.06C15.36,39.48,110.94-12.69,180.93,33.06l-7.79,11.05c-1.61,2.28-.14,5.44,2.63,5.69l47.4,4.29c2.78.25,4.78-2.6,3.61-5.13l-19.98-43.19c-1.17-2.53-4.64-2.84-6.25-.57l-10.36,14.7C108.18-32.96.25,25.6,0,123.23c-.71,67.04,56.1,123.86,123.15,123.15,54.96.68,105.9-38.77,119.18-92.04,1.12-4.29-1.46-8.67-5.74-9.79Z"/>
      <g>
        <path fill="white" d="m103.13,159.36h-14.05v-52.93c-5.13,4.8-11.18,8.35-18.14,10.65v-12.75c3.67-1.2,7.65-3.47,11.95-6.82,4.3-3.35,7.25-7.26,8.85-11.72h11.4v73.58Z"/>
        <path fill="white" d="m147.87,85.78c7.1,0,12.65,2.53,16.65,7.6,4.77,6,7.15,15.95,7.15,29.84s-2.4,23.83-7.2,29.89c-3.97,5-9.5,7.5-16.6,7.5s-12.88-2.74-17.24-8.22c-4.37-5.48-6.55-15.25-6.55-29.32s2.4-23.73,7.2-29.79c3.97-5,9.5-7.5,16.6-7.5Zm0,11.65c-1.7,0-3.22.54-4.55,1.62-1.33,1.08-2.37,3.02-3.1,5.82-.97,3.63-1.45,9.75-1.45,18.34s.43,14.5,1.3,17.72c.87,3.22,1.96,5.36,3.27,6.42,1.32,1.07,2.82,1.6,4.52,1.6s3.22-.54,4.55-1.62c1.33-1.08,2.37-3.02,3.1-5.82.97-3.6,1.45-9.7,1.45-18.29s-.43-14.5-1.3-17.72c-.87-3.22-1.96-5.36-3.27-6.45-1.32-1.08-2.82-1.62-4.52-1.62Z"/>
      </g>
    </svg>
  );
}

function VolumeIcon({ muted }: { muted?: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {muted ? (
        <>
          <path d="M15 8L21 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 8L15 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 10.5V13.5C3 13.9142 3.33579 14.25 3.75 14.25H7.5L12 18V6L7.5 9.75H3.75C3.33579 9.75 3 10.0858 3 10.5Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ) : (
        <>
          <path d="M3 10.5V13.5C3 13.9142 3.33579 14.25 3.75 14.25H7.5L12 18V6L7.5 9.75H3.75C3.33579 9.75 3 10.0858 3 10.5Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16.5 7.5C18.1569 7.5 19.5 9.567 19.5 12C19.5 14.433 18.1569 16.5 16.5 16.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M15 10.5C15.5523 10.5 16 11.1716 16 12C16 12.8284 15.5523 13.5 15 13.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}
    </svg>
  );
}

function PlayPauseIcon({ playing }: { playing?: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {playing ? (
        <>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9.5 8.5V15.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14.5 8.5V15.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M15.5 12L10 8V16L15.5 12Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 242.6 246.4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.3,154.3c13.3,53.3,64.2,92.7,119.2,92c67.1,0.7,123.9-56.1,123.2-123.2C242.3,25.6,134.4-33,52.4,19.9L42,5.2c-1.6-2.3-5.1-2-6.2,0.6L15.8,49c-1.2,2.5,0.8,5.4,3.6,5.1l47.4-4.3c2.8-0.2,4.2-3.4,2.6-5.7l-7.8-11c70-45.8,165.6,6.4,164.9,90.2c-2.9,125.4-176.4,147.5-210.8,27.1c-1.1-4.3-5.5-6.9-9.8-5.8C1.7,145.7-0.9,150.1,0.3,154.3z" fill="white"/>
      <polygon points="157,126.3 157,182.6 108.2,154.5 59.5,126.3 108.2,98.2 157,70" fill="none" stroke="white" strokeWidth="11.3386" strokeMiterlimit="10"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 6V12M12 12L9 9M12 12L15 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 16H16" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ExpandIcon component - Commented out to fix ESLint warning
/* function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3H5C3.89543 3 3 3.89543 3 5V8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 3H19C20.1046 3 21 3.89543 21 5V8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 21H19C20.1046 21 21 20.1046 21 19V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 21H5C3.89543 21 3 20.1046 3 19V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
} */



// ChatIcon component for chat functionality - Commented out to fix ESLint warning
/* function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="currentColor"/>
    </svg>
  );
} */

export default function Home({ guideVideos, guideSlug }: { guideVideos: GuideVideos, guideSlug: string }) {
  // Estado para idioma selecionado
  const [selectedLanguage, setSelectedLanguage] = useState<'pt' | 'en' | 'es' | 'fr'>(() => {
    try {
      const stored = localStorage.getItem('selectedLanguage');
      if (stored === 'en' || stored === 'es' || stored === 'fr' || stored === 'pt') return stored;
    } catch {}
    return 'pt';
  });
  // Ref para garantir que callbacks assíncronos usam SEMPRE o idioma atual
  const selectedLanguageRef = useRef<'pt'|'en'|'es'|'fr'>(selectedLanguage);
  useEffect(() => { selectedLanguageRef.current = selectedLanguage; }, [selectedLanguage]);

  const currentChatConfig: GuideVideos['chatConfig'] | null = React.useMemo(() => {
    try {
      const byLang = (guideVideos as any)?.chatConfigByLang as Record<string, any> | undefined;
      const base = guideVideos?.chatConfig || null;
      const cfg = (byLang && selectedLanguage && byLang[selectedLanguage]) ? byLang[selectedLanguage] : null;
      const result = cfg || base;
      
      // Adicionar campos de tradução da mensagem AI se existirem no base
      if (base && (base as any).aiWelcomeMessageEn) {
        (result as any).aiWelcomeMessageEn = (base as any).aiWelcomeMessageEn;
        (result as any).aiWelcomeMessageEs = (base as any).aiWelcomeMessageEs;
        (result as any).aiWelcomeMessageFr = (base as any).aiWelcomeMessageFr;
      }
      
      return result;
    } catch {
      return (guideVideos?.chatConfig || null) as any;
    }
  }, [guideVideos, selectedLanguage]);

  // Utilitário local: converter HTML (respostas do bot) para texto simples
  const htmlToPlainText = (html: string): string => {
    try {
      if (!html || typeof html !== 'string') return '';
      // Remover scripts/estilos por segurança
      const sanitized = html
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
      // Substituir quebras básicas e listas
      const withBreaks = sanitized
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
      // Remover todas as tags restantes
      const noTags = withBreaks.replace(/<[^>]+>/g, '');
      // Decodificar entidades HTML simples
      const textarea = document.createElement('textarea');
      textarea.innerHTML = noTags;
      const decoded = textarea.value;
      return decoded
        .replace(/\u00A0/g, ' ')
        .replace(/[\t ]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
    } catch {
      try {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || '').trim();
      } catch {
        return html;
      }
    }
  };
  // Hooks de otimização
  const videoOptimization = useVideoOptimization();
  const pipOptimization = usePiPOptimization();
  // UI state variables
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showGuidePopup, setShowGuidePopup] = useState(false);
  const [isPromoMode, setIsPromoMode] = useState(false);
  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const [showStartButton, setShowStartButton] = useState(true);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showChatbotPopup, setShowChatbotPopup] = useState(false);
  // Marcar se o utilizador já abriu o chat com IA alguma vez nesta sessão
  const [hasVisitedAiChat, setHasVisitedAiChat] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<Array<{from: 'user' | 'bot', text: string, metadata?: { fromChatbot?: boolean, isThinking?: boolean }}>>([]);
  const [commercialButtonsShown, setCommercialButtonsShown] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showChatbotWelcome, setShowChatbotWelcome] = useState(true);
  const [websiteContext, setWebsiteContext] = useState<{ title?: string; description?: string; text?: string } | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [androidWelcomeHidden, setAndroidWelcomeHidden] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Formulário de orçamento (MVP sem persistência)
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState<Record<string, string>>({});
  const [budgetFiles, setBudgetFiles] = useState<Record<string, File | null>>({});

  // Configurações de orçamento do backoffice
  const [budgetConfig, setBudgetConfig] = useState({
    enabled: true,
    title: 'Pedir orçamento',
    titleLabels: {
      pt: '',
      en: '',
      es: '',
      fr: ''
    },
    budgetButtonText: 'Pedir orçamento',
    budgetButtonTextLabels: {
      pt: '',
      en: '',
      es: '',
      fr: ''
    },
    email: '',
    emailSubject: 'Novo Pedido de Orçamento',
    emailSubjectLabels: {
      pt: '',
      en: '',
      es: '',
      fr: ''
    },
    emailTextTitle: 'Detalhes do Pedido',
    emailTextTitleLabels: {
      pt: '',
      en: '',
      es: '',
      fr: ''
    },
    emailText: 'Recebeu um novo pedido de orçamento através do seu guia virtual. Seguem os detalhes:',
    emailTextLabels: {
      pt: '',
      en: '',
      es: '',
      fr: ''
    },
    commercialSectionEnabled: true,
    commercialPhones: [],
    commercialButtonText: 'Falar com Comercial',
    confirmationMessage: 'Obrigado pelo seu pedido de orçamento! Entraremos em contacto consigo brevemente.',
    fields: {
      name: { required: true, label: 'Nome', type: 'text' },
      email: { required: true, label: 'Email', type: 'email' },
      phone: { required: false, label: 'Telefone', type: 'tel' },
      date: { required: false, label: 'Data pretendida', type: 'date' },
      people: { required: false, label: 'Número de pessoas', type: 'number' },
      notes: { required: false, label: 'Notas', type: 'textarea' }
    }
  });
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);

  // Sistema de tradução integrado com o idioma do site
  const [translatedTexts, setTranslatedTexts] = useState<any>(null);

  // Função para carregar traduções baseada no idioma do site
  const loadTranslations = async (language: string) => {
    try {
      const { getTranslatedTexts } = await import('../../../firebase/guideServices');
      const texts = getTranslatedTexts(language);
      setTranslatedTexts(texts);
    } catch (error) {
      console.error('Erro ao carregar traduções:', error);
      // Fallback para português
      const { getTranslatedTexts } = await import('../../../firebase/guideServices');
      const texts = getTranslatedTexts('pt');
      setTranslatedTexts(texts);
    }
  };

  const handleOpenBudgetForm = () => { 
    setShowBudgetForm(true);
    // Inicializar formulário com campos vazios baseados na configuração
    const initialForm: Record<string, string> = {};
    Object.keys(budgetConfig.fields).forEach(fieldKey => {
      initialForm[fieldKey] = '';
    });
    setBudgetForm(initialForm);
  };
  // Helper: retomar o vídeo principal e garantir PiP parado após fechar modal
  const resumeMainVideoAfterModalClose = () => {
    try {
      setPipVisible(false);
      setPipVideoPlaying(false);
      if (pipVideoRef.current) { try { pipVideoRef.current.pause(); } catch {} }
    } catch {}
    try {
      // NÃO retomar se o utilizador fechou o PiP manualmente
      if (videoRef.current && !pipManuallyClosed) {
        try { lastUserGestureAtRef.current = Date.now(); desiredStateRef.current = 'playing'; } catch {}
        maybePlay(videoRef.current)
          .then((ok) => {
            if (ok) { setVideoPlaying(true); return; }
            try { videoRef.current!.play().then(() => setVideoPlaying(true)).catch(() => {}); } catch {}
          })
          .catch(() => {
            try { videoRef.current!.play().then(() => setVideoPlaying(true)).catch(() => {}); } catch {}
          });
      }
    } catch {}
  };

  const handleCloseBudgetForm = () => { 
    setShowBudgetForm(false);
    resumeMainVideoAfterModalClose();
  };

  const handleCloseSimpleContact = () => {
    setShowSimpleContact(false);
    resumeMainVideoAfterModalClose();
  };
  const handleBudgetChange = (field: string, value: string) => {
    setBudgetForm(prev => ({ ...prev, [field]: value }));
  };
  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Verificar se há email configurado
      if (!budgetConfig.email) {
        alert(translatedTexts?.budgetModal?.emailNotConfigured || 'Email de destino não configurado. Contacte o administrador.');
        return;
      }
      setBudgetSubmitting(true);

      // Construir mapa de rótulos a partir da configuração (para usar no email)
      const fieldLabels: Record<string, string> = {};
      try {
        Object.entries(budgetConfig.fields).forEach(([key, cfg]: any) => {
          fieldLabels[key] = (cfg?.label || String(key)).trim();
        });
      } catch {}

      // Construir rótulos para uso no email
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      // Separar campos de texto e anexos
      const hasFiles = Object.values(budgetFiles).some(f => !!f);
      let response: Response;
      if (hasFiles) {
        const fd = new FormData();
        fd.append('toEmail', String(budgetConfig.email || ''));
        fd.append('guideName', String((guideVideos as any)?.name || 'Guia Virtual'));
        fd.append('guideSlug', String(guideSlug || ''));
        fd.append('companyName', String(companyName || (guideVideos as any)?.company || guideSlug || ''));
        fd.append('companyIconURL', String((guideVideos as any)?.companyIconURL || (guideVideos as any)?.chatIconURL || ''));
        fd.append('selectedLanguage', String(selectedLanguage || 'pt'));
        fd.append('emailSubject', String(budgetConfig.emailSubject || ''));
        fd.append('emailSubjectLabels', JSON.stringify(budgetConfig.emailSubjectLabels || {}));
        fd.append('emailTextTitle', String(budgetConfig.emailTextTitle || ''));
        fd.append('emailTextTitleLabels', JSON.stringify(budgetConfig.emailTextTitleLabels || {}));
        fd.append('emailText', String(budgetConfig.emailText || ''));
        fd.append('emailTextLabels', JSON.stringify(budgetConfig.emailTextLabels || {}));
        fd.append('fieldLabels', JSON.stringify(fieldLabels || {}));
        // Apenas os campos de texto no formData
        const textOnly: Record<string, string> = {};
        Object.entries(budgetConfig.fields).forEach(([key, cfg]: any) => {
          if (String(cfg?.type) === 'file') return;
          textOnly[key] = String(budgetForm[key] || '');
        });
        fd.append('formData', JSON.stringify(textOnly));
        // Anexos
        Object.entries(budgetFiles).forEach(([key, file]) => {
          if (file) {
            // prefixo do campo no nome para identificação opcional
            const name = `${key}__${file.name}`;
            fd.append(`file:${key}`, file, name);
          }
        });
        response = await fetch('/api/send-budget-email', {
          method: 'POST',
          headers: getAuthHeaders() as HeadersInit,
          body: fd,
          signal: controller.signal,
        });
      } else {
        // JSON clássico quando não há anexos
        response = await fetch('/api/send-budget-email', {
          method: 'POST',
          headers: ((): HeadersInit => {
            const base: Record<string, string> = { 'Content-Type': 'application/json' };
            const auth = getAuthHeaders();
            return { ...base, ...auth } as HeadersInit;
          })(),
          body: JSON.stringify({
            toEmail: budgetConfig.email,
            formData: budgetForm,
            guideName: guideVideos?.name || 'Guia Virtual',
            guideSlug: guideSlug,
            fieldLabels,
            companyName: companyName || (guideVideos as any)?.company || guideSlug,
            companyIconURL: (guideVideos as any)?.companyIconURL || (guideVideos as any)?.chatIconURL || null,
            selectedLanguage: selectedLanguage,
            emailSubject: budgetConfig.emailSubject,
            emailSubjectLabels: budgetConfig.emailSubjectLabels,
            emailTextTitle: budgetConfig.emailTextTitle,
            emailTextTitleLabels: budgetConfig.emailTextTitleLabels,
            emailText: budgetConfig.emailText,
            emailTextLabels: budgetConfig.emailTextLabels
          }),
          signal: controller.signal,
        });
      }
      clearTimeout(timeoutId);

      let result: any = {};
      try {
        result = await response.json();
      } catch {}

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao enviar email');
      }

      // Mostrar mensagem de confirmação configurada no backoffice
        alert(translatedTexts?.budgetModal?.confirmationMessage || budgetConfig.confirmationMessage);
      
      console.log('Email enviado com sucesso:', result.messageId);
      
    } catch (error) {
      console.error('Erro ao enviar pedido de orçamento:', error);
      alert(translatedTexts?.budgetModal?.sendError || 'Erro ao enviar pedido. Tente novamente ou contacte-nos diretamente.');
    } finally {
      setBudgetSubmitting(false);
      
      setShowBudgetForm(false);
      // Limpar formulário dinamicamente
      const emptyForm: Record<string, string> = {};
      Object.keys(budgetConfig.fields).forEach(fieldKey => {
        emptyForm[fieldKey] = '';
      });
      setBudgetForm(emptyForm);
      setBudgetFiles({});
    }
  };
  // Atualizar flag sempre que o popup do chat de IA for aberto
  useEffect(() => {
    if (showChatbotPopup) {
      setHasVisitedAiChat(true);
    }
    // Fallback: abrir IA se existir intenção pendente no localStorage
    try {
      const shouldOpen = localStorage.getItem('vg_open_ai_after_close') === '1';
      if (shouldOpen && !showChatbotPopup) {
        setShowChatbotPopup(true);
        setReturnedFromAiAfterHuman(true);
        localStorage.removeItem('vg_open_ai_after_close');
      }
    } catch {}
  }, [showChatbotPopup]);

  // Carregar contexto do website associado ao guia (se existir)
  useEffect(() => {
    const url = (guideVideos as any)?.websiteUrl as string | undefined;
    if (!url || !/^https?:\/\//i.test(url)) return;
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}&includeText=1`, {
          headers: ((): HeadersInit => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }))()
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setWebsiteContext({ title: data?.title, description: data?.description, text: data?.text });
      } catch {}
    })();
    return () => { aborted = true; };
  }, [guideVideos]);

  // Watchdog: tenta abrir IA periodicamente enquanto existir a flag
  useEffect(() => {
    let watchdogId: any = null;
    try {
      watchdogId = setInterval(() => {
        try {
          const shouldOpen = localStorage.getItem('vg_open_ai_after_close') === '1';
          if (shouldOpen && !showChatbotPopup) {
            setShowChatbotPopup(true);
            setReturnedFromAiAfterHuman(true);
            localStorage.removeItem('vg_open_ai_after_close');
          }
        } catch {}
      }, 800);
    } catch {}
    return () => { try { clearInterval(watchdogId); } catch {} };
  }, [showChatbotPopup]);
  // Estado do modal de contacto simples (independente do Guia Real)
  const [showSimpleContact, setShowSimpleContact] = useState(false);
  const [simpleContactName, setSimpleContactName] = useState("");
  const [simpleContactEmail, setSimpleContactEmail] = useState("");

  function handleGuideClick(e: React.MouseEvent) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {}

    // Inserir imediatamente a mensagem de transição (sem esperar resposta), se falou com a IA
    try {
      const hasChatbotInteraction = chatbotMessages.some(m => m.from === 'user') && chatbotMessages.some(m => m.from === 'bot');
      if (hasChatbotInteraction) {
        const transitionText = formatMessage(getInterfaceTexts().transitionMessage, { guide: getInterfaceTexts().talkToRealGuide.toLowerCase() });
        setHumanChatMessages(prev => {
          // remover duplicados existentes
          const filtered = (prev || []).filter(m => !(m?.metadata?.isTransitionMessage === true || (typeof m?.text === 'string' && m.text.trim() === transitionText)));
          // inserir após "Informações importantes" se existir
          const importantIndex = filtered.findIndex(m => typeof m.text === 'string' && m.text.includes(getInterfaceTexts().importantInfo));
          const insertIndex = importantIndex >= 0 ? importantIndex + 1 : filtered.length;
          const next = [...filtered];
          next.splice(insertIndex, 0, {
            from: 'agent',
            text: transitionText,
            timestamp: new Date().toISOString(),
            read: false,
            metadata: { isTransitionMessage: true, showWhenOpenedByGuide: true }
          } as ExtendedChatMessage);
          return next as any;
        });
      }
    } catch {}

    try {
      setShowChatbotPopup(false);
    } catch {}
    try {
      if (typeof window !== 'undefined' && typeof (window as any).openGuiaReal === 'function') {
        (window as any).openGuiaReal();
      } else {
        setShowGuidePopup(true);
      }
    } catch {}
  }

  // Estado da barra de cookies
  const [showCookieBar, setShowCookieBar] = useState(false);
  const [cookieBarMounted, setCookieBarMounted] = useState(false);

  // Estados para animação de carregamento do guia
  const [isGuideThinking, setIsGuideThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState(() => getInterfaceTexts().thinking1);
  const [isTextTransitioning, setIsTextTransitioning] = useState(false);

  // Estados do vídeo principal
  const [mainVideoLoaded, setMainVideoLoaded] = useState(false);
  const [mainVideoLoading, setMainVideoLoading] = useState(false);
  const [mainVideoError, setMainVideoError] = useState(false);
  const [mainVideoProgress, setMainVideoProgress] = useState(0);

  // Estados de readiness dos vídeos de fundo (e progresso para compor a barra inicial)
  const [bgVideoReady, setBgVideoReady] = useState(false);
  const [welcomeBgReady, setWelcomeBgReady] = useState(false);
  const [bgVideoError, setBgVideoError] = useState(false);
  const [welcomeBgError, setWelcomeBgError] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [welcomeBgProgress, setWelcomeBgProgress] = useState(0);

  // Estado para nome da empresa
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Função para enviar mensagem diretamente ao chatbot
  const sendMessageToChatbot = async (message: string) => {
    if (!message.trim()) return;

    // Adicionar mensagem do utilizador
    setChatbotMessages(prev => [...prev, { from: 'user', text: message.trim() }]);
    
    // Manter instruções visíveis (glassmorphismBox)
    // setShowInstructions(false);
    
    // Mostrar estado de "a pensar"
    setIsGuideThinking(true);
    setChatbotMessages(prev => [...prev, { from: 'bot', text: '', metadata: { isThinking: true } }]);

    try {
      // Preparar histórico da conversa
      const conversationHistory: ConversationMessage[] = chatbotMessages.map(msg => ({
        role: msg.from === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      // Adicionar nova mensagem do utilizador
      conversationHistory.push({ role: 'user', content: message.trim() });

      // Fazer pedido à API
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: ((): HeadersInit => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }))(),
        body: JSON.stringify({
          q: message.trim(),
          opts: {
            history: conversationHistory,
            // Alinhar com callOpenRouterAI: passar system correto + contexto humano
            system: getSystemPromptForLanguage(),
            temperature: 0.7,
            verbosity: "medium"
          },
          website: (guideVideos as any)?.websiteUrl || undefined
        })
      });

      const data = await response.json();
      
      // Esconder estado de "a pensar"
      setIsGuideThinking(false);
      
      // Remover mensagem de "a pensar" e adicionar resposta
      setChatbotMessages(prev => {
        const withoutThinking = prev.filter(msg => !msg.metadata?.isThinking);
        return [...withoutThinking, { from: 'bot', text: data.text || getInterfaceTexts().processingError }];
      });

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setIsGuideThinking(false);
      setChatbotMessages(prev => {
        const withoutThinking = prev.filter(msg => !msg.metadata?.isThinking);
        return [...withoutThinking, { from: 'bot', text: getInterfaceTexts().generalError }];
      });
    }
  };

  // Fallback de resolução para vídeos Bunny Stream (MP4 play_XXXp.mp4)
  // Tenta resoluções mais baixas quando uma resolução falha
  const tryBunnyResolutionFallback = (videoEl: HTMLVideoElement | null): boolean => {
    if (!videoEl) return false;
    const src = (videoEl.currentSrc || videoEl.src || '').toString();
    
    // Se for HLS que falhou (playlist.m3u8 com 404), tentar MP4 diretamente
    if (src.includes('b-cdn.net') && src.includes('playlist.m3u8')) {
      const match = src.match(/b-cdn\.net\/([^/]+)/);
      if (match && match[1]) {
        const videoId = match[1];
        // Tentar resoluções MP4 por ordem decrescente: 720p → 480p → 360p → 240p
        const resolutions = [720, 480, 360, 240];
        let attempted = false;
        
        const tryNextResolution = async (index: number = 0): Promise<void> => {
          if (index >= resolutions.length) {
            console.error('❌ Bunny: Nenhuma resolução MP4 disponível para', videoId);
            return;
          }
          
          const res = resolutions[index];
          const fallbackUrl = `https://vz-42532543-0c8.b-cdn.net/${videoId}/play_${res}p.mp4`;
          
          try {
            // Testar se o ficheiro existe com HEAD request
            const response = await fetch(fallbackUrl, { method: 'HEAD' });
            if (response.ok) {
              console.warn(`🔄 Bunny: HLS não disponível, usando MP4 ${res}p`, { antigo: src, novo: fallbackUrl });
              videoEl.src = fallbackUrl;
              videoEl.load();
              videoEl.play().catch(() => {});
            } else {
              // Tentar próxima resolução
              await tryNextResolution(index + 1);
            }
          } catch {
            // Tentar próxima resolução
            await tryNextResolution(index + 1);
          }
        };
        
        tryNextResolution();
        return true;
      }
      return false;
    }
    
    // Só funciona para URLs MP4 do Bunny (play_XXXp.mp4)
    if (!src || !src.includes('b-cdn.net') || !/play_\d+p\.mp4/.test(src)) {
      return false;
    }
    
    try {
      const match = src.match(/play_(\d+)p\.mp4/);
      if (!match) return false;
      const currentRes = parseInt(match[1], 10);
      const resolutions = [1080, 720, 480, 360, 240];
      const currentIndex = resolutions.indexOf(currentRes);
      
      // Se já está na resolução mais baixa, não há mais fallbacks
      if (currentIndex === -1 || currentIndex === resolutions.length - 1) {
        return false;
      }
      
      // Tentar próxima resolução mais baixa
      const nextRes = resolutions[currentIndex + 1];
      const newSrc = src.replace(/play_\d+p\.mp4/, `play_${nextRes}p.mp4`);
      console.warn(`🔄 Bunny: fallback de resolução ${currentRes}p → ${nextRes}p`, { antigo: src, novo: newSrc });
      videoEl.src = newSrc;
      try {
        videoEl.load();
        videoEl.play().catch(() => {});
      } catch {}
      return true;
    } catch (err) {
      console.error('❌ Erro no fallback de resolução do Bunny:', err);
      return false;
    }
  };

  // Normaliza o URL de vídeo para reprodução no frontoffice
  // Suporta Cloudflare Stream e Bunny Stream
  const toStreamUrl = (url?: string | null, provider?: 'cloudflare' | 'bunny' | null, force720p: boolean = false) => {
    if (!url) return '';
    try {
      // IMPORTANTE: Auto-detectar provider BASEADO NO URL (dar prioridade ao formato real)
      // Mesmo que o videoProvider esteja definido como 'bunny', se o URL for do Cloudflare, processar como Cloudflare
      const detectedProvider = 
        (url.includes('videodelivery.net') || url.includes('iframe.videodelivery.net')) ? 'cloudflare' : 
        (url.includes('b-cdn.net') || url.includes('bunnycdn.com') || url.includes('mediadelivery.net')) ? 'bunny' : 
        provider; // Só usar o provider passado se não conseguir detectar pelo URL
      
      console.log('🎬 toStreamUrl:', { originalUrl: url, providerPassed: provider, detectedProvider, force720p });

      // 1) Cloudflare Stream → HLS (.m3u8)
      if (detectedProvider === 'cloudflare') {
        if (url.includes('videodelivery.net/') || url.includes('iframe.videodelivery.net/')) {
          // Extrair UID de várias formas (iframe, manifest, downloads, etc.)
          const iframeMatch = url.match(/iframe\.videodelivery\.net\/([a-zA-Z0-9_-]{10,})/);
          const directMatch = url.match(/videodelivery\.net\/([a-zA-Z0-9_-]{10,})/);
          const uid = (iframeMatch && iframeMatch[1]) || (directMatch && directMatch[1]);
          if (uid) {
            const convertedUrl = `https://videodelivery.net/${uid}/manifest/video.m3u8`;
            console.log('🔄 Cloudflare convertido:', { original: url, converted: convertedUrl });
            return convertedUrl;
          }
        }
      }

      // 2) Bunny Stream → Processar diferentes formatos de URL
      if (detectedProvider === 'bunny') {
        // CDN hostname da biblioteca Bunny Stream
        const cdnHostname = 'vz-42532543-0c8.b-cdn.net';
        
        // 2a) Se for URL HLS (.m3u8) - usar diretamente (melhor compatibilidade e bitrate adaptativo)
        // NÃO converter HLS para MP4, pois:
        // - O HLS adaptativo é mais eficiente
        // - O MP4 pode ainda não estar processado no Bunny
        // - O HLS já suporta múltiplas resoluções automaticamente
        if (url.includes('.m3u8')) {
          console.log('✅ toStreamUrl retornou (Bunny HLS - mantém HLS):', url);
          return url;
        }
        
        // 2b) Se for URL MP4 direta do Bunny CDN (vz-*.b-cdn.net/{videoId}/play_XXXp.mp4)
        if (url.includes('b-cdn.net') && url.includes('/play_')) {
          // Já é um MP4 direto, usar como está (ou converter para HLS se não for force720p)
          if (force720p) {
            // Manter o MP4 original (pode ser qualquer resolução disponível)
            console.log('✅ toStreamUrl retornou (Bunny MP4 - mantém):', url);
            return url;
          }
          // Se não for force720p, tentar converter para HLS para bitrate adaptativo
          const match = url.match(/b-cdn\.net\/([^/]+)/);
          if (match && match[1]) {
            const videoId = match[1];
            const convertedUrl = `https://${cdnHostname}/${videoId}/playlist.m3u8`;
            console.log('🔄 Bunny MP4→HLS adaptativo:', { original: url, converted: convertedUrl });
            return convertedUrl;
          }
          // Se não conseguirmos extrair o videoId, usar o URL original
          console.log('⚠️ Não consegui extrair videoId do Bunny, usando original:', url);
          return url;
        }
        
        // 2c) Se for URL de embed do Bunny (iframe.mediadelivery.net/embed/{libraryId}/{videoId})
        if (url.includes('iframe.mediadelivery.net/embed/')) {
          const match = url.match(/iframe\.mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/);
          if (match) {
            const [, , videoId] = match;
            // Sempre usar HLS playlist (adaptativo e mais compatível)
            const convertedUrl = `https://${cdnHostname}/${videoId}/playlist.m3u8`;
            console.log('🔄 Bunny embed→HLS:', { original: url, converted: convertedUrl });
            return convertedUrl;
          }
        }
        
        // 2d) Se for URL de play do Bunny (video.bunnycdn.com/play/{libraryId}/{videoId})
        if (url.includes('video.bunnycdn.com/play/')) {
          const match = url.match(/video\.bunnycdn\.com\/play\/(\d+)\/([a-f0-9-]+)/);
          if (match) {
            const [, , videoId] = match;
            // Sempre usar HLS playlist (adaptativo e mais compatível)
            const convertedUrl = `https://${cdnHostname}/${videoId}/playlist.m3u8`;
            console.log('🔄 Bunny play→HLS:', { original: url, converted: convertedUrl });
            return convertedUrl;
          }
        }
        
        // 2f) Outros URLs do Bunny - retornar como está
        console.log('✅ toStreamUrl retornou (Bunny outros):', url);
        return url;
      }

      // 3) Proxy especial para ficheiros hospedados em visitfoods.pt (legado FTP)
      if (url.includes('/vg-video/')) {
        console.log('✅ toStreamUrl retornou (vg-video):', url);
        return url; // idempotência
      }
      const u = new URL(url, window.location.origin);
      if ((u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') && u.pathname !== '/vg-video/') {
        const pathOnly = u.pathname;
        const proxyUrl = `https://visitfoods.pt/vg-video/?file=${encodeURIComponent(pathOnly)}`;
        console.log('✅ toStreamUrl retornou (proxy):', proxyUrl);
        return proxyUrl;
      }

      // 4) Caso contrário, devolver como está
      console.log('✅ toStreamUrl retornou (original):', url);
      return url;
    } catch (error) {
      console.error('❌ Erro em toStreamUrl:', error);
      return url;
    }
  };

  // Normaliza o URL para DOWNLOAD (MP4), independente de Cloudflare/FTP
  const toDownloadUrl = (url?: string | null) => {
    if (!url) return '';
    try {
      // Cloudflare Stream: usar endpoint de downloads (se ativo no vídeo)
      if (url.includes('videodelivery.net/') || url.includes('iframe.videodelivery.net/')) {
        const iframeMatch = url.match(/iframe\.videodelivery\.net\/([a-zA-Z0-9_-]{10,})/);
        const hlsMatch = url.match(/videodelivery\.net\/([a-zA-Z0-9_-]{10,})/);
        const uid = (iframeMatch && iframeMatch[1]) || (hlsMatch && hlsMatch[1]);
        if (uid) return `https://videodelivery.net/${uid}/downloads/default.mp4`;
      }
      // Se já for um manifest HLS, tentar extrair UID e mapear para downloads
      if (url.endsWith('/manifest/video.m3u8')) {
        const m = url.match(/videodelivery\.net\/([a-zA-Z0-9_-]{10,})\/manifest\/video\.m3u8/);
        if (m && m[1]) return `https://videodelivery.net/${m[1]}/downloads/default.mp4`;
      }
      // FTP/visitfoods: preferir o caminho direto ao ficheiro
      const u = new URL(url, window.location.origin);
      if (u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') {
        // Se vier via proxy /vg-video/?file=..., extrair o file
        if (u.pathname === '/vg-video/' && u.searchParams.get('file')) {
          const pathOnly = u.searchParams.get('file') as string;
          return `https://visitfoods.pt${pathOnly}`;
        }
        return u.toString();
      }
      // Devolver o original como último recurso
      return url;
    } catch {
      return url;
    }
  };

  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreatingNewConversation, setIsCreatingNewConversation] = useState(false);
  
  // Contador de entradas no chat com guia real (para limite de 4 entradas)
  const [guideChatEntryCount, setGuideChatEntryCount] = useState(0);
  
  // Estado para bloquear sugestões de pergunta até receber resposta
  const [suggestionsBlocked, setSuggestionsBlocked] = useState(false);
  // Sugestões dinâmicas de próximas perguntas (máx. 2)
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
  
  // Estado para controlar quando mostrar a mensagem de transição do guia real
  const [showTransitionMessage, setShowTransitionMessage] = useState(false);
  const [transitionMessageShown, setTransitionMessageShown] = useState<{[key: string]: boolean}>({});
  
  // Estados para o chat humano
  const [showHumanChat, setShowHumanChat] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [humanChatMessages, setHumanChatMessages] = useState<ExtendedChatMessage[]>([]);
  const [humanChatInput, setHumanChatInput] = useState('');
  
  // Flag para exigir formulário novamente quando regressa ao AI após ter usado o chat real
  const [returnedFromAiAfterHuman, setReturnedFromAiAfterHuman] = useState(false);

  const [humanChatSubmitting, setHumanChatSubmitting] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false); // Som ativo por omissão
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [pipVideoPlaying, setPipVideoPlaying] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 20, y: 20 });
  
  // Função para resetar a posição do PiP para a posição inicial
  const resetPipPosition = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Detectar se é tablet (768px - 1024px) e ajustar posição
      const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
      const xOffset = isTablet ? 180 : 120; // Mais à esquerda em tablets
      setPipPosition({ x: window.innerWidth - xOffset, y: 20 });
    } else {
      setPipPosition({ x: 20, y: 20 });
    }
  }, []);
  
  // Atualizar posição inicial do PiP após montagem do componente (quando window está disponível)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      resetPipPosition();
    }
  }, [resetPipPosition]);

  // Sincronização centralizada de som entre vídeo principal e PiP
  useEffect(() => {
    try {
      if (videoRef.current) {
        videoRef.current.muted = videoMuted;
        videoRef.current.volume = videoMuted ? 0 : 1;
      }
    } catch {}
    try {
      if (pipVideoRef.current) {
        pipVideoRef.current.muted = videoMuted;
        pipVideoRef.current.volume = videoMuted ? 0 : 1;
      }
    } catch {}
  }, [videoMuted]);

  // Verificar se o utilizador já aceitou os cookies
  // Verificar consentimento de cookies após hidratação
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCookieBarMounted(true);
      const cookieConsent = localStorage.getItem('cookieConsent');
      console.log('Cookie consent status:', cookieConsent);
      if (cookieConsent === 'accepted' || cookieConsent === 'declined') {
        setShowCookieBar(false);
        console.log('Cookie bar hidden - consent already given');
      } else {
        setShowCookieBar(true);
        console.log('Cookie bar shown - no consent yet');
      }
    }
  }, []);

  // Animação do texto de carregamento do guia
  useEffect(() => {
    if (!isGuideThinking) return;

    const interval = setInterval(() => {
      // Iniciar transição
      setIsTextTransitioning(true);
      
      // Após um pequeno delay, mudar o texto
      setTimeout(() => {
        setThinkingText(prev => {
          if (prev === getInterfaceTexts().thinking1) {
            return getInterfaceTexts().thinking2;
          } else {
            return getInterfaceTexts().thinking1;
          }
        });
        
        // Finalizar transição
        setTimeout(() => {
          setIsTextTransitioning(false);
        }, 50);
      }, 250);
    }, 3000); // Muda a cada 3 segundos para dar tempo à transição

    return () => clearInterval(interval);
  }, [isGuideThinking]);

  // Funções para lidar com os cookies
  const handleAcceptCookies = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cookieConsent', 'accepted');
      setShowCookieBar(false);
    }
  };

  const handleDeclineCookies = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cookieConsent', 'declined');
      setShowCookieBar(false);
    }
  };

  // Resetar posição do PiP quando a orientação do dispositivo muda
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOrientationChange = () => {
      // Aguardar um pouco para que o resize seja processado
      setTimeout(() => {
        resetPipPosition();
      }, 100);
    };

    const handleResize = () => {
      // Resetar posição do PiP quando a janela é redimensionada
      resetPipPosition();
    };

    // Adicionar listeners para mudanças de orientação e resize
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [resetPipPosition]);

  // Definir modo promo (mantém comportamento anterior sem afetar loaders)
  useEffect(() => {
    (async () => {
      try {
        setIsPromoMode(false);
      } catch {
        setIsPromoMode(false);
      }
    })();
  }, []);
  
  // Carregar contador de entradas no chat do localStorage
  useEffect(() => {
    const savedCount = localStorage.getItem('guideChatEntryCount');
    if (savedCount) {
      setGuideChatEntryCount(parseInt(savedCount, 10));
    }
  }, []);

  // Ligar eventos para saber quando os vídeos de fundo estão prontos
  useEffect(() => {
    const bg = bgVideoRef.current;
    const welcome = welcomeBgVideoRef.current;

    const onBgCanPlay = () => { setBgVideoReady(true); setBgProgress(100); };
    const onWelcomeCanPlay = () => { setWelcomeBgReady(true); setWelcomeBgProgress(100); };

    if (bg) {
      bg.addEventListener('canplaythrough', onBgCanPlay, { once: true });
    }
    if (welcome) {
      welcome.addEventListener('canplaythrough', onWelcomeCanPlay, { once: true });
    }

    return () => {
      if (bg) bg.removeEventListener('canplaythrough', onBgCanPlay as EventListener);
      if (welcome) welcome.removeEventListener('canplaythrough', onWelcomeCanPlay as EventListener);
    };
  }, [guideVideos?.backgroundVideoURL, guideVideos?.mobileTabletBackgroundVideoURL]);

  // Atualizar a barra de progresso inicial com base no progresso real dos vídeos
  useEffect(() => {
    const hasWelcomeVideo = !!(guideVideos?.welcomeVideoURL);
    const mainPart = hasWelcomeVideo ? (mainVideoError ? 100 : mainVideoProgress) : 100;
    const clamped = Math.max(0, Math.min(mainPart, 99));
    setLoadingProgress((prev) => (mainPart >= 100 ? 100 : Math.max(prev, clamped)));

    const mainReady = mainVideoLoaded || !hasWelcomeVideo || mainVideoError;
    if (mainReady) {
      setLoadingProgress(100);
      setIsLoading(false);
    }
  }, [guideVideos?.welcomeVideoURL, mainVideoProgress, mainVideoLoaded, mainVideoError]);

  // Carregar conversa do localStorage no início
  useEffect(() => {
    loadConversationFromStorage(guideSlug);
    try {
      const restored = loadChatbotMessagesFromStorage(guideSlug);
      if (Array.isArray(restored) && restored.length > 0) {
        setChatbotMessages(restored);
      }
    } catch {}
  }, [guideSlug]);

  // Carregar nome da empresa do Firebase
  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        const guides = await listAvailableGuides('virtualchat-b0e17');
        const currentGuide = guides.find(guide => guide.slug === guideSlug);
        if (currentGuide && currentGuide.company) {
          setCompanyName(currentGuide.company);
        }
      } catch (error) {
        console.error('Erro ao carregar nome da empresa:', error);
      }
    };

    loadCompanyName();
  }, [guideSlug]);

  // Carregar configurações de orçamento do backoffice
  useEffect(() => {
    const loadBudgetConfig = async () => {
      try {
        const { getGuideCompleteData } = await import('../../../firebase/guideServices');
        const guideData = await getGuideCompleteData('virtualchat-b0e17', guideSlug);
        console.log('Dados completos do guia carregados:', guideData);
        if (guideData && guideData.budgetConfig) {
          console.log('Configurações de orçamento encontradas:', guideData.budgetConfig);
          
          // Migração para nova estrutura (compatibilidade com versão antiga)
          const config = guideData.budgetConfig;
          if (config.commercialPhone && !config.commercialPhones) {
            // Migrar de commercialPhone para commercialPhones
            config.commercialPhones = [{
              id: 'migrated_phone',
              phone: config.commercialPhone,
              label: config.commercialButtonText || 'Comercial'
            }];
            delete config.commercialPhone;
          }
          
          // Garantir que commercialButtonText existe
          if (!config.commercialButtonText) {
            config.commercialButtonText = 'Falar com Comercial';
          }
          
          // Garantir que commercialSectionEnabled existe
          if (config.commercialSectionEnabled === undefined) {
            config.commercialSectionEnabled = true;
          }
          // Garantir que budgetButtonText existe
          if (!config.budgetButtonText) {
            config.budgetButtonText = config.title || 'Pedir Orçamento';
          }
          
          // Migrar campos para incluir rótulos multilíngues se não existirem
          if (config.fields) {
            Object.keys(config.fields).forEach(fieldKey => {
              if (!config.fields[fieldKey].labels) {
                // Adicionar rótulos multilíngues padrão baseados no label atual
                const currentLabel = config.fields[fieldKey].label;
                config.fields[fieldKey].labels = {
                  pt: currentLabel,
                  en: currentLabel,
                  es: currentLabel,
                  fr: currentLabel
                };
              }
            });
          }
          
          setBudgetConfig(config);
        } else {
          console.log('Nenhuma configuração de orçamento encontrada para o guia:', guideSlug);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações de orçamento:', error);
      }
    };

    loadBudgetConfig();
  }, [guideSlug]);

  // Aplicar gradiente do guia como variáveis CSS globais (apenas se vierem do wrapper)
  useEffect(() => {
    try {
      const start = (guideVideos as any)?.gradientStartColor;
      const end = (guideVideos as any)?.gradientEndColor;
      if (typeof document !== 'undefined' && start && end) {
        document.documentElement.style.setProperty('--vg-gradient-start', start);
        document.documentElement.style.setProperty('--vg-gradient-end', end);
      }
    } catch {}
  }, [guideVideos]);

  // Carregar traduções baseadas no idioma do site
  useEffect(() => {
    loadTranslations(selectedLanguage);
  }, [selectedLanguage]);

  // Função para obter campos traduzidos
  const getTranslatedFields = () => {
    if (!translatedTexts) return budgetConfig.fields;
    
    try {
      const { translateBudgetFields } = require('../../../firebase/guideServices');
      return translateBudgetFields(budgetConfig.fields, selectedLanguage);
    } catch (error) {
      console.error('Erro ao traduzir campos:', error);
      return budgetConfig.fields;
    }
  };

  // Estado de rede lenta deve existir antes de efeitos que o usam
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  // Pré-carregar o vídeo principal ao abrir o site
  useEffect(() => {
    const url = toStreamUrl(guideVideos?.welcomeVideoURL, guideVideos?.videoProvider) || '';
    if (!url) return;

    setMainVideoLoading(true);
    setMainVideoError(false);
    setMainVideoProgress(10);

    // Em redes rápidas, ajudar com <link rel="preload">; em redes lentas, evitar overhead
    const link = document.createElement('link');
    if (!isSlowNetwork) {
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }

    // Vídeo oculto para pré-carregar
    const pre = document.createElement('video');
    pre.preload = isSlowNetwork ? 'metadata' : 'auto';
    pre.muted = true;
    pre.playsInline = true;
    pre.crossOrigin = 'anonymous';
    pre.src = url;
    pre.style.display = 'none';
    document.body.appendChild(pre);

    const onMeta = () => setMainVideoProgress(30);
    const onProgress = () => {
      if (pre.buffered.length > 0 && Number.isFinite(pre.duration) && pre.duration > 0) {
        const end = pre.buffered.end(pre.buffered.length - 1);
        const ratio = end / pre.duration;
        setMainVideoProgress(Math.min(99, 30 + ratio * 69));
        if (ratio >= 0.999) {
          setMainVideoProgress(100);
          setMainVideoLoaded(true);
          setMainVideoLoading(false);
        }
      }
    };
    const onCanPlay = () => {
      setMainVideoProgress(100);
      setMainVideoLoaded(true);
      setMainVideoLoading(false);
    };
    const onError = () => {
      setMainVideoError(true);
      setMainVideoLoading(false);
    };

    pre.addEventListener('loadedmetadata', onMeta);
    pre.addEventListener('progress', onProgress);
    pre.addEventListener('canplaythrough', onCanPlay);
    pre.addEventListener('error', onError);
    pre.load();

    // Em redes rápidas, pequeno HEAD para aquecer cache; em lentas, evitar pedido extra
    if (!isSlowNetwork) {
      fetch(url, { method: 'HEAD', mode: 'cors' }).catch(() => {});
    }

    return () => {
      try {
        pre.removeEventListener('loadedmetadata', onMeta);
        pre.removeEventListener('progress', onProgress);
        pre.removeEventListener('canplay', onCanPlay);
        pre.removeEventListener('error', onError);
        document.body.removeChild(pre);
        try { if (!isSlowNetwork) document.head.removeChild(link); } catch {}
      } catch {}
    };
  }, [guideVideos?.welcomeVideoURL, isSlowNetwork]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pipExpanded, setPipExpanded] = useState(false);
  const [pipVisible, setPipVisible] = useState(false);
  // Removido pipMuted pois o PiP sempre segue o vídeo principal
  const [savedVideoTime, setSavedVideoTime] = useState(0);
  // Mostrar/ocultar PiP quando aviso de rotação está visível
  const [orientationWarningVisible, setOrientationWarningVisible] = useState(false);
  const [shouldSaveTime, setShouldSaveTime] = useState(false);
  const [videoStateBeforeBlur, setVideoStateBeforeBlur] = useState({
    wasPlaying: false,
    currentTime: 0,
    wasMuted: false
  });
  const [pipStateBeforeBlur, setPipStateBeforeBlur] = useState({
    wasPlaying: false,
    currentTime: 0,
    wasMuted: false
  });
  const [pipManuallyClosed, setPipManuallyClosed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [preferHold, setPreferHold] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Guardar estado de som antes de abrir o formulário para restaurar depois
  const preFormMutedRef = useRef<boolean | null>(null);
  // Janela para ignorar pausas reativas logo após clicar Play
  const suppressPauseUntilRef = useRef<number>(0);
  // Flag para distinguir pausa iniciada pelo utilizador de pausas reativas
  const userInitiatedPauseRef = useRef<boolean>(false);
  // Janela para ignorar eventos de pause (ex.: durante a transição de pausa iniciada pelo utilizador)
  const ignorePauseEventUntilRef = useRef<number>(0);
  // Manter último tempo conhecido do vídeo principal para retomar exatamente desse ponto
  const lastKnownTimeRef = useRef<number>(0);
  // Pedido de reprodução pendente iniciado pelo utilizador (para repetir assim que houver canplay)
  const pendingUserPlayRef = useRef<boolean>(false);
  // Janela curta após clique do utilizador para não deixar o PiP interferir
  const userGestureGuardUntilRef = useRef<number>(0);
  // Estado desejado após clique do utilizador (enforcer simples contra reações externas)
  const desiredStateRef = useRef<'playing' | 'paused' | null>(null);
  // Bloqueio temporário de auto-plays após uma pausa do utilizador
  const hardPauseUntilRef = useRef<number>(0);
  // Guardar estado de loop original para evitar reinício em iOS quando em pausa
  const originalLoopRef = useRef<boolean | null>(null);
  // iOS: marcar último gesto explícito do utilizador (para evitar auto-plays/"flashes")
  const lastUserGestureAtRef = useRef<number>(0);
  const isIOS = typeof navigator !== 'undefined' ? /iP(ad|hone|od)/i.test(navigator.userAgent) : false;

  // Utilitário: tentar reproduzir o vídeo principal respeitando a guarda de pausa do utilizador
  const maybePlay = (video: HTMLVideoElement | null): Promise<boolean> => {
    // Bloquear plays reativos se o utilizador acabou de clicar Pausa,
    // exceto quando o estado desejado é explicitamente 'playing'
    if (desiredStateRef.current !== 'playing' && Date.now() < hardPauseUntilRef.current) {
      return Promise.resolve(false);
    }
    // Se o estado desejado é pausa, não iniciar play
    if (desiredStateRef.current === 'paused') return Promise.resolve(false);
    // iOS: evitar QUALQUER play automático fora de um gesto recente do utilizador (evita "flashes")
    if (isIOS) {
      const sinceGestureMs = Date.now() - (lastUserGestureAtRef.current || 0);
      if (sinceGestureMs > 800 && desiredStateRef.current !== 'playing') {
        return Promise.resolve(false);
      }
    }
    if (!video) return Promise.resolve(false);
    try {
      const r = video.play();
      if (r && typeof (r as any).then === 'function') {
        return (r as Promise<void>)
          .then(() => true)
          .catch(() => false);
      }
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  };

  // Força o estado do vídeo a corresponder ao estado desejado
  const enforceDesiredState = (video: HTMLVideoElement | null) => {
    if (!video) return;
    const attempt = () => {
      const want = desiredStateRef.current;
      if (want === 'playing') {
        if (video.paused) {
          // Não tentar play automaticamente durante janelas de hard pause/gesture/ignorePause
          if (Date.now() < hardPauseUntilRef.current) return;
          if (Date.now() < userGestureGuardUntilRef.current) return;
          if (Date.now() < ignorePauseEventUntilRef.current && !userInitiatedPauseRef.current) return;
          void maybePlay(video);
        }
      } else if (want === 'paused') {
        if (!video.paused) {
          try { video.pause(); } catch {}
        }
      }
    };
    // Executar múltiplas vezes para contrariar reações tardias (HLS/PiP)
    attempt();
    setTimeout(attempt, 150);
    setTimeout(attempt, 600);
  };

  // Atualizar última posição conhecida do vídeo e ignorar pausas "espúrias" logo após Play
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      try {
        if (Number.isFinite(v.currentTime)) {
          lastKnownTimeRef.current = v.currentTime;
        }
      } catch {}
    };
    const onPlay = () => {
      // Se o utilizador pediu pausa, forçar pausa mesmo que algo tenha dado play
      if (desiredStateRef.current === 'paused') {
        try { v.pause(); } catch {}
        return;
      }
    };
    const onPause = () => {
      // Ignorar eventos de pause durante a janela de proteção
      if (Date.now() < ignorePauseEventUntilRef.current) return;
      if (userInitiatedPauseRef.current) return; // respeitar pausa do utilizador
      // Garantir que o vídeo está efetivamente pausado
      if (!v.paused) return;
      // Se estiver dentro de uma janela de hard pause, não retomar
      if (Date.now() < hardPauseUntilRef.current) return;
      if (Date.now() < suppressPauseUntilRef.current) {
        // Ignorar pausa reativa e retomar
        void (async () => {
          try {
            if (v.readyState < 2) {
              await new Promise<void>((resolve) => {
                const onCan = () => { try { v.removeEventListener('canplay', onCan); } catch {}; resolve(); };
                v.addEventListener('canplay', onCan, { once: true });
              });
            }
            await v.play();
            setVideoPlaying(true);
          } catch {}
        })();
      }
    };
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [videoRef.current]);

  // Garantir que ao reabrir o chat (IA ou humano) o PiP pode voltar a aparecer
  useEffect(() => {
    if (!isDesktop && (showChatbotPopup || showHumanChat)) {
      setPipManuallyClosed(false);
    }
  }, [showChatbotPopup, showHumanChat, isDesktop]);

  // Extra: quando todos os chats/overlays fecham, limpar o flag de fecho manual do PiP
  useEffect(() => {
    if (!isDesktop && !showChatbotPopup && !showHumanChat && !showGuidePopup && !showBudgetForm && !showSimpleContact) {
      setPipManuallyClosed(false);
    }
  }, [showChatbotPopup, showHumanChat, showGuidePopup, showBudgetForm, showSimpleContact, isDesktop]);
  // Controlar vídeos quando popup de promoção estiver aberto
  useEffect(() => {
    // Em PC, não fazer nada - vídeos continuam sempre a reproduzir
    if (isDesktop) {
      return;
    }

    const forcePauseAll = () => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setVideoPlaying(false);
      }
      if (bgVideoRef.current && !bgVideoRef.current.paused) {
        bgVideoRef.current.pause();
      }
      if (welcomeBgVideoRef.current && !welcomeBgVideoRef.current.paused) {
        welcomeBgVideoRef.current.pause();
      }
    };

    if (showPromoPopup) {
      // Pausar imediatamente e com retries curtos
      forcePauseAll();
      const t1 = setTimeout(forcePauseAll, 50);
      const t2 = setTimeout(forcePauseAll, 200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [showPromoPopup, isDesktop]);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const welcomeBgVideoRef = useRef<HTMLVideoElement>(null);
  const chatbotInputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // Âncoras para auto-scroll nas listas de mensagens
  const chatbotEndRef = useRef<HTMLDivElement | null>(null);
  const humanEndRef = useRef<HTMLDivElement | null>(null);
  // Chaves de cache em sessão para dados do formulário do chat humano
  const SESSION_NAME_KEY = 'vg_user_name';
  const SESSION_CONTACT_KEY = 'vg_user_contact';
  // preferHold controlado por estado dos chats (sem temporizador)

  // Helpers para atualizar estado e cache de sessão
  const updateFormName = (value: string) => {
    setFormName(value);
  };
  const updateFormContact = (value: string) => {
    setFormContact(value);
  };
  // Forçar legendas sempre ativas no vídeo principal e desativadas no PiP
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const enableCaptions = () => {
      try {
        const tracks = Array.from(videoEl.textTracks || []);
        tracks.forEach((track) => {
          track.mode = 'showing';
        });
      } catch {}
    };

    enableCaptions();
    videoEl.addEventListener('loadedmetadata', enableCaptions);
    videoEl.addEventListener('loadeddata', enableCaptions);

    return () => {
      videoEl.removeEventListener('loadedmetadata', enableCaptions);
      videoEl.removeEventListener('loadeddata', enableCaptions);
    };
  }, []);

  useEffect(() => {
    const pipEl = pipVideoRef.current;
    if (!pipEl) return;

    const disableCaptions = () => {
      try {
        const tracks = Array.from(pipEl.textTracks || []);
        tracks.forEach((track) => {
          track.mode = 'disabled';
        });
      } catch {}
    };

    disableCaptions();
    pipEl.addEventListener('loadedmetadata', disableCaptions);
    pipEl.addEventListener('loadeddata', disableCaptions);

    return () => {
      pipEl.removeEventListener('loadedmetadata', disableCaptions);
      pipEl.removeEventListener('loadeddata', disableCaptions);
    };
  }, []);

  // Otimização: preconnect/dns-prefetch para o host de vídeos (reduz handshake)
  useEffect(() => {
    try {
      const addLink = (rel: string, href: string, as?: string) => {
        const el = document.createElement('link');
        el.rel = rel;
        el.href = href;
        if (as) el.as = as as any;
        el.crossOrigin = 'anonymous';
        document.head.appendChild(el);
        return () => { try { document.head.removeChild(el); } catch {} };
      };
      const cleanups: Array<() => void> = [];
      cleanups.push(addLink('preconnect', 'https://visitfoods.pt'));
      cleanups.push(addLink('dns-prefetch', 'https://visitfoods.pt'));
      return () => { cleanups.forEach(fn => fn()); };
    } catch {}
  }, []);
  // Otimização: preload do vídeo do PiP e prewarm de conexão
  useEffect(() => {
    const url = toStreamUrl(guideVideos?.welcomeVideoURL || '', guideVideos?.videoProvider) || '';
    if (!url || isDesktop || isSlowNetwork) return; // Em redes lentas, não fazer prewarm
    try {
      // Inserir <link rel="preload" as="video">
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);

      // Tentar um prewarm leve com Range 0-0 para abrir a ligação e popular cache
      fetch(url, { headers: { Range: 'bytes=0-0' } }).catch(() => {});

      return () => { try { document.head.removeChild(link); } catch {} };
    } catch {}
  }, [guideVideos?.welcomeVideoURL, isDesktop, isSlowNetwork]);

  // Garantir reprodução do PiP assim que estiver pronto (após HLS anexar)
  useEffect(() => {
    const v = pipVideoRef.current;
    if (!v) return;
    const tryAutoplay = () => {
      try {
        if (!pipVisible) return;
        if (!v.paused) return;
        // Autoplay fiável: começar mudo e restaurar estado depois noutro efeito
        v.muted = true;
        safePlay(v);
      } catch {}
    };
    v.addEventListener('loadedmetadata', tryAutoplay);
    v.addEventListener('canplay', tryAutoplay);
    return () => {
      v.removeEventListener('loadedmetadata', tryAutoplay);
      v.removeEventListener('canplay', tryAutoplay);
    };
  }, [pipVisible]);
  // Pré-carregar o vídeo do PiP: agressivo em redes rápidas, conservador em redes lentas
  useEffect(() => {
    const v = pipVideoRef.current;
    if (!v) return;
    try {
      if (isSlowNetwork) {
        v.preload = 'metadata';
        // Em redes lentas, não chamar load() proativamente
      } else {
        v.preload = 'auto';
        // Forçar o browser a preparar o vídeo (não bloqueante)
        if (v.readyState < 2) v.load();
      }
    } catch {}
  }, [guideVideos?.welcomeVideoURL, isSlowNetwork]);

  // Verificação inicial de cookies - manter o ID da conversa mesmo sem outros cookies
  useEffect(() => {
    const conversationId: string | null = getCookie('chat_conversation_id');
    const userName = getCookie('chat_user_name');
    const userContact = getCookie('chat_user_contact');
    // Não limpar o cookie da conversa se faltar name/contact (não persistimos mais esses dados)
    // Apenas limpar vestígios antigos se NÃO existir conversationId
    if (!conversationId && (userName || userContact)) {
      deleteCookie('chat_user_name');
      deleteCookie('chat_user_contact');
    }
  }, []);

  // Capturar cliques em links antes do PiP interferir
  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
        event.stopPropagation();
        event.preventDefault();
        // Não abrir link específico de PP
        return;
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
        event.stopPropagation();
        event.preventDefault();
        return; // bloquear link de PP
      }
      // Não prevenir eventos touch para outros elementos - permitir scroll normal
    };

    // Adicionar event listeners ao documento com capture para capturar antes do PiP
    document.addEventListener('click', handleLinkClick, true);
    document.addEventListener('touchstart', handleTouchStart, true);
    document.addEventListener('mousedown', handleLinkClick, true);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('mousedown', handleLinkClick, true);
    };
  }, []);

  // Log dos links encontrados - Commented out to fix ESLint warning
  /* useEffect(() => {
    const logLinks = () => {
      const links = document.querySelectorAll('a[href*="bymeoblueticket"]');
      // Logs removidos para limpeza do console
    };

    // Executar após um pequeno delay para garantir que o DOM foi atualizado
    const timer = setTimeout(logLinks, 100);
    
    // Também executar quando as mensagens mudarem
    const observer = new MutationObserver(logLinks);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [chatbotMessages, humanChatMessages]); */

  // Deteção de Android
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroidDevice = /android/.test(userAgent);
    setIsAndroid(isAndroidDevice);
  }, []);

  // Removido: pré-preenchimento do formulário via cookies/sessionStorage

  // Auto-scroll: chatbot (AI)
  useEffect(() => {
    try {
      const el = chatbotEndRef.current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } catch {}
  }, [chatbotMessages, showChatbotPopup]);
  // Auto-scroll: chat humano
  useEffect(() => {
    try {
      const el = humanEndRef.current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } catch {}
  }, [humanChatMessages, showHumanChat]);

  // Em desktop, manter hold enquanto não houver nenhum chat aberto
  useEffect(() => {
    if (!isDesktop) return;
    // Se qualquer chat estiver aberto, não preferir hold; caso contrário, preferir
    setPreferHold(!showHumanChat && !showChatbotPopup);
    return () => {};
  }, [showHumanChat, showChatbotPopup, isDesktop]);

  // Deteção de rede lenta (2g/3g, poupança de dados, downlink baixo)
  useEffect(() => {
    try {
      const nav: any = navigator as any;
      const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
      const et: string | undefined = conn?.effectiveType;
      const saveData: boolean | undefined = conn?.saveData;
      const downlink: number | undefined = conn?.downlink;
      const slow = (et && /2g|3g/.test(et)) || saveData === true || (typeof downlink === 'number' && downlink > 0 && downlink < 2);
      setIsSlowNetwork(!!slow);
      if (conn && typeof conn.addEventListener === 'function') {
        const handler = () => {
          const et2: string | undefined = conn?.effectiveType;
          const save2: boolean | undefined = conn?.saveData;
          const dl2: number | undefined = conn?.downlink;
          const slow2 = (et2 && /2g|3g/.test(et2)) || save2 === true || (typeof dl2 === 'number' && dl2 > 0 && dl2 < 2);
          setIsSlowNetwork(!!slow2);
        };
        conn.addEventListener('change', handler);
        return () => conn.removeEventListener('change', handler);
      }
    } catch {}
  }, []);



  // Detectar refresh da página e limpar mensagens do chatbot
  useEffect(() => {
    // Detectar refresh usando múltiplos métodos para compatibilidade
    const isRefresh = (
      // Método 1: performance.navigation (deprecated mas ainda funciona em alguns browsers)
      (performance.navigation && performance.navigation.type === 1) ||
      // Método 2: Verificar se a página foi carregada do cache
      (performance.getEntriesByType && (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type === 'reload') ||
      // Método 3: Verificar se há entrada de navigation
      (performance.getEntriesByType && performance.getEntriesByType('navigation').length > 0)
    );
    
    // Detectar se é iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as {MSStream?: boolean}).MSStream;
    
    if (isRefresh || isIOS) {
      // Não limpar as mensagens do chatbot para preservar histórico entre refresh/fecho de separador
      // Manter apenas a gestão do chat humano aqui
      
      // Em qualquer refresh, encerrar sessão ativa do chat humano
      const conversationId = getCookie('chat_conversation_id');
      if (conversationId) {
        closeGuideConversation('virtualchat-b0e17', conversationId, 'user', 'Fechada no refresh', selectedLanguage).catch(error => {
          console.error('Erro ao encerrar conversa no refresh:', error);
        });
        
        // Limpar cookies e estado local
        deleteCookie('chat_conversation_id');
        deleteCookie('chat_user_name');
        deleteCookie('chat_user_contact');
        
        setHasActiveSession(false);
        setHumanChatMessages([]);
        setCurrentConversation(null);
        setShowHumanChat(false);
        
        // Limpeza adicional em iOS
        if (isIOS) {
          sessionStorage.removeItem('mobile_session_checked');
        }
      }
    }
  }, []);
  
  // Detectar se é um carregamento inicial em mobile com sessão existente
  useEffect(() => {
    // Só executar uma vez no carregamento inicial
    const isInitialLoad = !sessionStorage.getItem('mobile_session_checked');
    
    if (isInitialLoad && isMobile) {
      const conversationId = getCookie('chat_conversation_id');
      const userName = getCookie('chat_user_name');
      const userContact = getCookie('chat_user_contact');
      
      // Se há uma sessão completa em mobile, marcar como verificada
      if (conversationId && userName && userContact) {
        sessionStorage.setItem('mobile_session_checked', 'true');
      }
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpeza específica para iOS no carregamento inicial
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as {MSStream?: boolean}).MSStream;
    
    if (isIOS) {
      // Em iOS, sempre limpar sessão no carregamento inicial para evitar problemas
      const conversationId = getCookie('chat_conversation_id');
      if (conversationId) {
        // Encerrar conversa no servidor
        closeGuideConversation('virtualchat-b0e17', conversationId, 'user', 'Fechada no carregamento iOS', selectedLanguage).catch(error => {
          console.error('Erro ao encerrar conversa no carregamento iOS:', error);
        });
        
        // Limpar cookies e estado
        deleteCookie('chat_conversation_id');
        deleteCookie('chat_user_name');
        deleteCookie('chat_user_contact');
        
        setHasActiveSession(false);
        setHumanChatMessages([]);
        setCurrentConversation(null);
        setShowHumanChat(false);
        
        // Limpar sessionStorage
        sessionStorage.removeItem('mobile_session_checked');
      }
    }
  }, []);
  // Função global para abrir guia real
  useEffect(() => {
    (window as { openGuiaReal?: () => void }).openGuiaReal = () => {
      // Fechar o chatbot AI se estiver aberto
      if (showChatbotPopup) {
        setShowChatbotPopup(false);
      }
      
      // Abrir sempre o popup para preencher dados do contacto
      setShowGuidePopup(true);
      
      // Parar o vídeo principal quando o formulário for aberto (não alterar estado global de som)
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          setVideoPlaying(false);
        } catch {}
      }
    };
    
    return () => {
      delete (window as { openGuiaReal?: () => void }).openGuiaReal;
    };
  }, [showChatbotPopup, currentConversation, isDesktop, showGuidePopup, returnedFromAiAfterHuman]);

  // Detectar se é desktop
  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
        setIsDesktop(width >= 1025);
        setIsTablet(width >= 768 && width <= 1024);
        setIsMobile(width < 768);
    };
    
    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    
    return () => {
      window.removeEventListener('resize', checkDeviceType);
    };
  }, []);

  // Sincronizar com o aviso de rotação (mesma lógica do componente OrientationWarning)
  useEffect(() => {
    const checkKeyboardOpen = () => {
      try {
        const currentHeight = window.innerHeight;
        const screenHeight = window.screen.height;
        const ua = navigator.userAgent.toLowerCase();
        const isIOS = ua.includes('iphone') || ua.includes('ipad');
        const isFirefoxIOS = ua.includes('firefox') && isIOS;

        // 1) Apenas considerar teclado se houver foco num campo de edição
        const active = document.activeElement as (HTMLElement | null);
        const isEditable = Boolean(
          active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable === true
          )
        );
        if (!isEditable) return false;

        // 2) Tentar visualViewport (Safari/Chrome iOS)
        const vv = (window as any).visualViewport;
        if (vv) {
          const heightDiff = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
          if (heightDiff > 80) return true;
        }

        // 3) Fallback por ratio de altura
        const heightRatio = currentHeight / screenHeight;
        const ratioThreshold = isFirefoxIOS ? 0.82 : (isIOS ? 0.85 : 0.80);
        return heightRatio < ratioThreshold;
      } catch {
        return false;
      }
    };

    const checkOrientation = () => {
      // Reativar detecção de teclado com limites ajustados
      if (checkKeyboardOpen()) {
        setOrientationWarningVisible(false);
        return;
      }

      try {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const isLandscape = height < width;
        const isAndroidPcMode = () => {
          try {
            const ua = navigator.userAgent.toLowerCase();
            const isAndroid = /android/.test(ua);
            const isMobileUA = /mobile/.test(ua);
            const hasTouch = (navigator as any).maxTouchPoints > 0;
            const hoverFine = window.matchMedia?.('(hover: hover)').matches && window.matchMedia?.('(pointer: fine)').matches;
            const looksTablet = width >= 768 && width <= 1297;
            return isAndroid && !isMobileUA && hasTouch && hoverFine && looksTablet;
          } catch {
            return false;
          }
        };
        const isMobileOrTablet = width <= 1297;
        const isTabletPcMode = isAndroidPcMode();
        const shouldShow = (isMobileOrTablet || isTabletPcMode) && isLandscape;
        setOrientationWarningVisible(shouldShow);
      } catch {
        setOrientationWarningVisible(false);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('focusin', checkOrientation);
    window.addEventListener('focusout', checkOrientation);
    
    // Verificar mudanças no visualViewport (Safari/Chrome iOS)
    const vv = (window as any).visualViewport;
    if (vv) {
      vv.addEventListener('resize', checkOrientation);
      vv.addEventListener('scroll', checkOrientation);
    }
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('focusin', checkOrientation);
      window.removeEventListener('focusout', checkOrientation);
      
      if (vv) {
        vv.removeEventListener('resize', checkOrientation);
        vv.removeEventListener('scroll', checkOrientation);
      }
    };
  }, []);

  // Monitorar mudanças de dispositivo para atualizar vídeos
  useEffect(() => {
    const bg = bgVideoRef.current;
    const welcome = welcomeBgVideoRef.current;

    if (bg && guideVideos?.backgroundVideoURL) {
      const currentVideoURL = (isMobile || isTablet) && guideVideos?.mobileTabletBackgroundVideoURL 
        ? guideVideos.mobileTabletBackgroundVideoURL 
        : guideVideos?.backgroundVideoURL;
      bg.src = toStreamUrl(currentVideoURL, guideVideos?.videoProvider, true) || "/Judite_2.mp4";
    }

    if (welcome && guideVideos?.backgroundVideoURL) {
      const currentVideoURL = (isMobile || isTablet) && guideVideos?.mobileTabletBackgroundVideoURL 
        ? guideVideos.mobileTabletBackgroundVideoURL 
        : guideVideos?.backgroundVideoURL;
      welcome.src = toStreamUrl(currentVideoURL, guideVideos?.videoProvider, true) || "/Judite_2.mp4";
    }
  }, [isMobile, isTablet, guideVideos?.backgroundVideoURL, guideVideos?.mobileTabletBackgroundVideoURL, guideVideos?.videoProvider]);
  // Controlar scroll da página quando chatbot está aberto
  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (showChatbotPopup || showHumanChat) {
      document.body.style.overflow = 'hidden';
              // No Android, forçar um reflow para garantir que o scroll seja bloqueado
        if (isAndroid) {
          void document.body.offsetHeight; // Trigger reflow
        }
    } else {
      // document.body.style.overflow = 'auto'; // Removido conforme pedido
      // No Android, forçar um reflow para garantir que o scroll seja restaurado
      if (isAndroid) {
        void document.body.offsetHeight; // Trigger reflow
      }
    }

    // Cleanup quando componente desmonta
    return () => {
      // document.body.style.overflow = 'auto'; // Removido conforme pedido
      // No Android, garantir que o scroll seja restaurado no cleanup
      if (isAndroid) {
        void document.body.offsetHeight; // Trigger reflow
      }
    };
  }, [showChatbotPopup, showHumanChat]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Pausar vídeo quando popups estiverem abertos
  useEffect(() => {
    if (videoRef.current) {
      if (showGuidePopup || showPromoPopup) {
        // SEMPRE pausar vídeo quando popups abrem
        try {
          videoRef.current.pause();
          setVideoPlaying(false);
          console.log('⏸️ Vídeo pausado ao abrir popup:', {
            paused: videoRef.current.paused,
            muted: videoRef.current.muted,
            volume: videoRef.current.volume
          });
        } catch (error) {
          console.error('Erro ao pausar vídeo:', error);
        }
      }
      // NÃO retomar automaticamente o vídeo quando o popup fecha
    }
  }, [showGuidePopup, showPromoPopup]);
  
  // Detectar dispositivos iOS e aplicar correções específicas
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as {MSStream?: boolean}).MSStream;
    
    if (isIOS) {
      
      // Adicionar meta viewport para evitar problemas com zoom
      let viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.setAttribute('name', 'viewport');
        document.head.appendChild(viewportMeta);
      }
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
      
      // Adicionar classe específica para iOS no body
      document.body.classList.add('ios-device');
      
      // Corrigir o problema de altura em iOS
      const setIOSHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      
      setIOSHeight();
      window.addEventListener('resize', setIOSHeight);
      window.addEventListener('orientationchange', setIOSHeight);
      
      // Adicionar regras CSS específicas para iOS
      const style = document.createElement('style');
      style.innerHTML = `
        .ios-device .fixedBottomContainer,
        .ios-device .page-module___8aEwW__fixedBottomContainer {
          position: fixed !important;
          bottom: calc(var(--kb-safe-area-offset, 0px)) !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 9999 !important;
          display: flex !important;
          flex-direction: column !important;
          background: rgba(255, 255, 255, 0.95) !important;
          padding-bottom: env(safe-area-inset-bottom, 0px) !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        .ios-device .chatbotInputBar,
        .ios-device .page-module___8aEwW__chatbotInputBar {
          position: relative !important;
          bottom: auto !important;
          left: auto !important;
          right: auto !important;
          z-index: auto !important;
          padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
          background: rgba(255, 255, 255, 0.9) !important;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          margin-bottom: 0 !important;
        }
        
        .ios-device .guideRealLinkContainer,
        .ios-device .page-module___8aEwW__guideRealLinkContainer {
          display: flex !important;
          justify-content: center !important;
          padding: 12px 20px !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: relative !important;
        }
        
        .ios-device .guideRealLink,
        .ios-device .page-module___8aEwW__guideRealLink {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          background: #000000 !important;
          color: #ffffff !important;
          border: none !important;
          padding: 12px 24px !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          font-size: 14px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        
        .ios-device .chatbotPopup {
          height: 100vh !important;
          height: calc(var(--vh, 1vh) * 100) !important;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
          border-bottom: none !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        
        /* Remover qualquer barra cinzenta no fundo do chat */
        .ios-device .chatbotBottomBar,
        .ios-device .page-module___8aEwW__chatbotBottomBar {
          display: none !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          background: transparent !important;
        }
        
        .ios-device .chatbotContent,
        .ios-device .page-module___8aEwW__chatbotContent {
          height: calc(100vh - 120px) !important;
          height: calc(var(--vh, 1vh) * 100 - 120px) !important;
          padding-bottom: 0 !important;
        }
        
        .ios-device .chatbotMessages,
        .ios-device .page-module___8aEwW__chatbotMessages {
          padding-bottom: 0 !important;
          border-bottom: none !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          margin-bottom: 0 !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
      `;      
      document.head.appendChild(style);
      
      return () => {
        window.removeEventListener('resize', setIOSHeight);
        window.removeEventListener('orientationchange', setIOSHeight);
        document.head.removeChild(style);
      };
    }
  }, []);

  // Ajuste dinâmico para teclado virtual (iOS/Chrome e outros navegadores que suportem visualViewport)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const visualViewport = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    if (!visualViewport) return;

    const updateKeyboardOffset = () => {
      try {
        const heightDiff = Math.max(0, window.innerHeight - (visualViewport.height + visualViewport.offsetTop));
        document.documentElement.style.setProperty('--kb-safe-area-offset', `${heightDiff}px`);
      } catch {
        // Ignorar erros de cálculo
      }
    };

    updateKeyboardOffset();
    visualViewport.addEventListener('resize', updateKeyboardOffset);
    visualViewport.addEventListener('scroll', updateKeyboardOffset);
    window.addEventListener('orientationchange', updateKeyboardOffset);

    return () => {
      try {
        visualViewport.removeEventListener('resize', updateKeyboardOffset);
        visualViewport.removeEventListener('scroll', updateKeyboardOffset);
        window.removeEventListener('orientationchange', updateKeyboardOffset);
        document.documentElement.style.removeProperty('--kb-safe-area-offset');
      } catch {
        // noop
      }
    };
  }, []);
  // Verificar se há uma sessão ativa do chat
  useEffect(() => {
    let conversationId: string | null = getCookie('chat_conversation_id');
    const userName = getCookie('chat_user_name');
    const userContact = getCookie('chat_user_contact');
    
    if (conversationId && userName && userContact) {
      setHasActiveSession(true);
      
              // Configurar listener para a conversa existente quando o chat estiver aberto
        if (showHumanChat && !isCreatingNewConversation) {
          console.log('🔍 Configurando listener para conversa existente:', conversationId);
          unsubscribeRef.current = listenToGuideConversation('virtualchat-b0e17', conversationId, (conversation) => {
          // Verificar se a conversa foi fechada no backoffice
            if ((conversation as any).status === 'closed') {
            
            // Removido: ignorar conversas criadas recentemente. Responder sempre ao fecho.
            
            // Verificar se já existe a mensagem de despedida (apenas por metadata)
              const hasClosingMessage = (conversation as any).messages?.some((m: any) => (
                m?.metadata?.closingMessage === true
              ));

              // Construir mensagem local de encerramento com HTML e botão (sem depender de leitura do Firebase)
              const closingMessageText = getInterfaceTexts().closingMessage;
              const openAiButtonText = getInterfaceTexts().openAiChat;
              const closingMessageHtml = `✅ ${closingMessageText} <br/><button data-open-ai="1" style="margin-top:10px;padding:8px 14px;border:none;border-radius:8px;background:#000;color:#fff;cursor:pointer;font-weight:600">${openAiButtonText}</button>`;

              const localMessages = ((conversation as any).messages || []) as unknown as ChatMessage[];
              const finalMessages = hasClosingMessage ? localMessages : ([
                ...localMessages,
                {
                  id: `local_close_${Date.now()}`,
                  from: 'agent',
                  text: closingMessageHtml,
                  timestamp: new Date().toISOString(),
                  read: false,
                  metadata: { guideResponse: true, closingMessage: true } as any
                } as any
              ]);

              // Atualizar as mensagens no estado local imediatamente
              setCurrentConversation(conversation as unknown as Conversation);
              setHumanChatMessages(finalMessages as unknown as ChatMessage[]);
            
             // Manter o chat real aberto. Apenas mostrar link na mensagem de encerramento
             // para o utilizador abrir o chat com IA quando quiser.
             return;
            
            return; // Sair para não atualizar os estados novamente
          }
          
          // Atualizar estados normalmente se a conversa ainda estiver ativa
          // Converter mensagens para o formato local para garantir compatibilidade
          const localMessages = (conversation as any).messages?.map((msg: any) => ({
            id: msg.id,
            from: msg.from === 'guide' ? 'agent' : 'user',
            text: msg.text,
            timestamp: msg.timestamp ? (msg.timestamp as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
            read: msg.read || false,
            metadata: (msg.metadata || {}) as ExtendedChatMessage['metadata']
          })) || [];
          
          // Fallback: se houve interação com o chatbot e a transição ainda não está presente,
          // inserir a mensagem de transição depois da mensagem de informações importantes (se existir),
          // caso contrário, antes da primeira mensagem do agente
          try {
            const hasChatbotQuestion = (conversation as any).messages?.some((m: any) => m.from === 'user' && m.metadata?.fromChatbot === true && String(m.text || '').trim().length > 0);
            const hasChatbotAnswer = (conversation as any).messages?.some((m: any) => (m.from === 'guide' || m.from === 'agent') && m.metadata?.fromChatbot === true && String(m.text || '').trim().length > 0);
            const hasChatbotInteraction = Boolean(hasChatbotQuestion && hasChatbotAnswer);
            if (hasChatbotInteraction) {
              const transitionText = formatMessage(getInterfaceTexts().transitionMessage, { guide: getInterfaceTexts().talkToRealGuide.toLowerCase() });
              // Remover duplicados existentes (mesmo texto ou flag)
              for (let i = localMessages.length - 1; i >= 0; i--) {
                const m = localMessages[i];
                if (m?.metadata?.isTransitionMessage === true || (typeof m?.text === 'string' && m.text.trim() === transitionText)) {
                  localMessages.splice(i, 1);
                }
              }
              // Encontrar posição: após a mensagem de informações importantes
              const importantInfoIndex = localMessages.findIndex(m => typeof m.text === 'string' && m.text.includes(getInterfaceTexts().importantInfo));
              const firstAgentIndex = localMessages.findIndex(m => m.from === 'agent');
              const insertIndex = importantInfoIndex >= 0 ? importantInfoIndex + 1 : (firstAgentIndex >= 0 ? firstAgentIndex : localMessages.length);
              const transitionMessage: ExtendedChatMessage = {
                id: `transition_${Date.now()}`,
                from: 'agent',
                text: transitionText,
                timestamp: new Date().toISOString(),
                read: false,
                metadata: { isTransitionMessage: true, showWhenOpenedByGuide: true }
              };
              localMessages.splice(insertIndex, 0, transitionMessage);
            }
          } catch {}

          // IMPORTANTE: Preservar a mensagem de boas-vindas se ela existir
          const welcomeMessage = localMessages.find(msg => 
            msg.from === 'agent' && 
            msg.text.includes(getInterfaceTexts().realGuideWelcomeBack.split('!')[1]) && 
            msg.metadata?.guideResponse === true
          );
          
          console.log('🔍 Listener recebeu conversa:', conversation);
          console.log('🔍 Mensagens convertidas:', localMessages);
          console.log('🔍 Número de mensagens:', localMessages.length);
          
          setCurrentConversation(conversation as unknown as Conversation);
          // Filtrar mensagem de transição gravada anteriormente caso não exista interação real com o chatbot
          const hasChatbotQuestion = (conversation as any).messages?.some((msg: any) =>
            msg.from === 'user' && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
          );
          const hasChatbotAnswer = (conversation as any).messages?.some((msg: any) =>
            (msg.from === 'guide' || msg.from === 'agent') && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
          );
          const hasChatbotInteraction = Boolean(hasChatbotQuestion && hasChatbotAnswer);

          const transitionText = formatMessage(getInterfaceTexts().transitionMessage, { 
            guide: getInterfaceTexts().talkToRealGuide.toLowerCase() 
          });
          const filteredLocalMessages = hasChatbotInteraction
            ? localMessages
            : localMessages.filter((m: any) => (
                m?.metadata?.isTransitionMessage === true
                  ? false
                  : (typeof m?.text === 'string' ? m.text.trim() !== transitionText : true)
              ));
          setHumanChatMessages(filteredLocalMessages as ExtendedChatMessage[]);
          
          // Verificar se o gestor abriu a conversa (para mostrar a mensagem de transição)
          // Só mostrar quando o gestor realmente abrir a conversa no backoffice E se o utilizador falou com o guia AI
          if ((conversation as any).status === 'active' && (conversation as any).metadata?.viewedByGuide === true) {
            console.log('🔍 Verificando se gestor abriu conversa:', {
              status: (conversation as any).status,
              metadata: (conversation as any).metadata,
              viewedByGuide: (conversation as any).metadata?.viewedByGuide
            });
            
            // Verificar se existiu uma interação real com o chatbot (pergunta do utilizador e resposta do bot)
            const hasChatbotQuestion = (conversation as any).messages.some((msg: any) =>
              msg.from === 'user' && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
            );
            const hasChatbotAnswer = (conversation as any).messages.some((msg: any) =>
              (msg.from === 'guide' || msg.from === 'agent') && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
            );
            const hasChatbotInteraction = hasChatbotQuestion && hasChatbotAnswer;
            
            if (hasChatbotInteraction) {
              // O gestor abriu a conversa no backoffice, adicionar a mensagem de transição
              const transitionMessage: ExtendedChatMessage = {
                from: 'agent',
                text: formatMessage(getInterfaceTexts().transitionMessage, { 
                  guide: getInterfaceTexts().talkToRealGuide.toLowerCase() 
                }),
                timestamp: new Date().toISOString(),
                read: false,
                metadata: { 
                  showWhenOpenedByGuide: true,
                  isTransitionMessage: true 
                }
              };
              
              // Verificar se a mensagem já foi mostrada para esta conversa
              const conversationId = (conversation as any).id;
              if (!transitionMessageShown[conversationId]) {
                // Adicionar a mensagem de transição ao estado local
                setHumanChatMessages(prev => {
                  const hasTransitionMessage = prev.some(msg => 
                    msg.metadata?.isTransitionMessage === true
                  );
                  
                  if (!hasTransitionMessage) {
                    console.log('🔍 Adicionando mensagem de transição ao estado local');
                    // Marcar que a mensagem foi mostrada para esta conversa
                    setTransitionMessageShown(prev => ({
                      ...prev,
                      [conversationId]: true
                    }));
                    return [...prev, transitionMessage];
                  }
                  console.log('🔍 Mensagem de transição já existe, não adicionando duplicada');
                  return prev;
                });
              } else {
                console.log('🔍 Mensagem de transição já foi mostrada para esta conversa');
              }
              
              setShowTransitionMessage(true);
            } else {
              console.log('🔍 Utilizador não falou com guia AI - não mostrando mensagem de transição');
            }
          }
        });
      }
    } else {
      setHasActiveSession(false);
      // Garantir que as mensagens estão limpas se não há sessão ativa
      setHumanChatMessages([]);
      setCurrentConversation(null);
    }
    
    // Limpar listener e estado quando o componente desmontar ou quando o chat fechar
    return () => {
      console.log('🧹 Limpando recursos ao desmontar componente');
      if (unsubscribeRef.current) {
        console.log('🔄 Removendo listener de conversa');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      // Garantir que flags de estado são limpas
      setIsCreatingNewConversation(false);
      setShowTransitionMessage(false);
      // Limpar estado da mensagem de transição para esta conversa
      const conversationId = getCookie('chat_conversation_id');
      if (conversationId) {
        setTransitionMessageShown(prev => {
          const newState = { ...prev };
          delete newState[conversationId];
          return newState;
        });
      }
    };
  }, [showHumanChat, hasActiveSession]); // Executar quando o estado do chat ou sessão mudar

      // Verificar periodicamente se a conversa ainda está ativa, mas apenas quando o chat NÃO está aberto
  useEffect(() => {
    let conversationId: string | null = getCookie('chat_conversation_id');
    
    // Se não houver uma conversa ativa, se o chat estiver aberto, ou se estiver criando uma nova conversa, não verificar
    // Se o ID da conversa tiver sido marcado como 'CLOSED' previamente, limpar para não fechar o chat ao reabrir
    if (conversationId === 'CLOSED') {
      deleteCookie('chat_conversation_id');
      conversationId = null as any;
    }

    if (!conversationId || showHumanChat || isCreatingNewConversation) {
      console.log('🔍 Pulando verificação de status:', 
        !conversationId ? 'sem conversa' : 
        showHumanChat ? 'chat aberto' : 
        'criando conversa'
      );
      return;
    }
    
    // Verificar o estado da conversa imediatamente
    const checkConversationStatus = async () => {
      try {
        // Usar getGuideConversation para verificar o estado da conversa no Firebase virtualchat-b0e17
        const conversation = await getGuideConversation('virtualchat-b0e17', conversationId);
        
        // Se a conversa foi fechada no backoffice
        if ((conversation as any).status === 'closed') {
          console.log('Conversa foi fechada no backoffice.');
          
          // Removido: ignorar conversas criadas recentemente
          
          // Se o chat não estiver aberto, simplesmente limpar os cookies
          if (!showHumanChat) {
            deleteCookie('chat_conversation_id');
            deleteCookie('chat_user_name');
            deleteCookie('chat_user_contact');
            
            setHasActiveSession(false);
            setCurrentConversation(null);
            setHumanChatMessages([]);
          }
          // Se o chat estiver aberto, não fazemos nada aqui, pois o outro useEffect já cuida disso
        } else {
          // Se a conversa ainda está ativa, verificar se os cookies ainda existem
          const currentConversationId = getCookie('chat_conversation_id');
          if (!currentConversationId) {
            console.log('Cookies foram limpos - limpando estado local');
            setHasActiveSession(false);
            setCurrentConversation(null);
            setHumanChatMessages([]);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar estado da conversa:', error);
        
        // IMPORTANTE: Se a conversa não for encontrada, pode ser uma conversa recém-criada
        // ou um problema de sincronização. Vamos aguardar um pouco antes de limpar tudo
        if (error instanceof Error && error.message.includes('Conversa não encontrada')) {
          console.log('🔄 Conversa não encontrada - pode ser uma conversa recém-criada. Aguardando...');
          
          // Se o chat estiver aberto, não limpar imediatamente
          if (showHumanChat) {
            console.log('💬 Chat está aberto - mantendo estado atual por mais tempo');
            return;
          }
          
          // Se o chat não estiver aberto, aguardar um pouco mais antes de limpar
          setTimeout(() => {
            console.log('⏰ Verificação atrasada - limpando cookies após conversa não encontrada');
            deleteCookie('chat_conversation_id');
            deleteCookie('chat_user_name');
            deleteCookie('chat_user_contact');
            
            setHasActiveSession(false);
            setCurrentConversation(null);
            setHumanChatMessages([]);
          }, 10000); // Aguardar 10 segundos antes de limpar
        }
      }
    };
    
    // Verificar após um delay inicial de 10 segundos
    const initialTimeout = setTimeout(checkConversationStatus, 10000);
    
    // Configurar verificação periódica (a cada 5 minutos)
    const intervalId = setInterval(checkConversationStatus, 300000); // 5 minutos
    
    // Limpar o intervalo e o timeout quando o componente desmontar
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [hasActiveSession, showHumanChat, showChatbotPopup, showGuidePopup, isCreatingNewConversation]); // eslint-disable-line react-hooks/exhaustive-deps
  // Controlar vídeo PiP e principal em mobile
  const prevChatOpenRef = useRef<boolean>(false);
  useEffect(() => {
    // Reativar PiP APENAS quando um chat reabre (transição fechado -> aberto)
    const chatOpen = !isDesktop && (showChatbotPopup || showHumanChat) && !showGuidePopup;
    if (chatOpen && !prevChatOpenRef.current && pipManuallyClosed) {
      setPipManuallyClosed(false);
    }
    // Atualizar memória da transição
    prevChatOpenRef.current = chatOpen;

    // Quando QUALQUER modal bloqueante está aberto, TODOS os vídeos devem estar pausados (mobile e desktop)
    if (showGuidePopup || showBudgetForm || showSimpleContact) {
      console.log('📱 Formulário aberto em smartphone - pausando todos os vídeos');
      
      // 1. Desativar PiP
      setPipVisible(false);
      setPipVideoPlaying(false);
      
      // 2. Pausar vídeo principal e salvar tempo
      if (videoRef.current) {
        try {
          setSavedVideoTime(videoRef.current.currentTime);
          videoRef.current.pause();
          setVideoPlaying(false);
        } catch (error) {
          console.error('Erro ao pausar vídeo principal:', error);
        }
      }
      
      // 3. Garantir que PiP está pausado
      if (pipVideoRef.current) {
        try {
          pipVideoRef.current.pause();
        } catch (error) {
          console.error('Erro ao pausar PiP:', error);
        }
      }
      
      return; // Sair do useEffect aqui quando formulário está aberto
    }
    
    // Visibilidade do PiP: só mostrar em mobile/tablet quando um chat está aberto e sem aviso de rotação
    const shouldShowPip = !isDesktop && (showChatbotPopup || showHumanChat) && !showGuidePopup && !showBudgetForm && !showSimpleContact && !pipManuallyClosed && !orientationWarningVisible;
    const shouldHidePip = !shouldShowPip;
    
    // 2. Chats abertos: mostrar PiP e PAUSAR o principal (garantir um de cada vez)
    if (shouldShowPip) {
      // Pausar o vídeo principal para não coexistirem dois vídeos em reprodução
      if (videoRef.current && !videoRef.current.paused) {
        try { videoRef.current.pause(); } catch {}
        setVideoPlaying(false);
      }
      // Mostrar PiP se ainda não visível
      if (!pipVisible) {
        console.log('🎬 Mostrando PiP para chat');
        setPipVisible(true);
        setShouldSaveTime(true);
      }
      // Tentar garantir que o PiP está a reproduzir do ponto correto
      if (pipVideoRef.current) {
        const pip = pipVideoRef.current;
        try {
          // Sincronizar tempo com o último conhecido do principal
          const t = (videoRef.current?.currentTime ?? savedVideoTime ?? 0);
          if (!Number.isNaN(t) && Math.abs((pip.currentTime || 0) - t) > 0.2) {
            pip.currentTime = t;
          }

          // Determinar estado de som com base no vídeo principal
          const targetMuted = preFormMutedRef.current ?? (videoRef.current ? videoRef.current.muted : videoMuted);
          // Aplicar SEMPRE o estado de som ao PiP, esteja ou não em pausa
          pip.muted = targetMuted;
          pip.volume = targetMuted ? 0 : 1;
          console.log('🔊 PiP - Estado de som aplicado ao abrir chat:', targetMuted);

          // Tentar iniciar o PiP se estiver pausado
          if (pip.paused) {
            setPipVideoPlaying(true);
            pip.play()
              .then(() => {
                setPipVideoPlaying(true);
              })
              .catch(() => {
                // fallback: tentar em mute (já está em mute se necessário)
                pip.muted = true;
                pip.volume = 0;
                pip.play()
                  .then(() => { setPipVideoPlaying(true); })
                  .catch(() => setPipVideoPlaying(false));
              });
          } else {
            // Já está a reproduzir
            setPipVideoPlaying(true);
          }
        } catch {}
      }
    }
    // 3. Chats fechados: esconder PiP e RETOMAR principal
    else if (shouldHidePip && pipVisible) {
      console.log('🎬 Escondendo PiP e retomando vídeo principal');
      setPipVisible(false);
      
      // Resetar o flag de fechamento manual quando todos os chats/overlays fecham
      if (!showChatbotPopup && !showHumanChat && !showGuidePopup && !showBudgetForm && !showSimpleContact) {
        setPipManuallyClosed(false);
      }
      
      // Retomar o vídeo principal quando chat ou formulário fecha em mobile
      if (!isDesktop && videoRef.current && !showGuidePopup && !showBudgetForm && !showSimpleContact && !showChatbotPopup && !showHumanChat) {
        try {
          // Usar o tempo do PiP se disponível, ou o tempo salvo anteriormente
          const currentTime = pipVideoRef.current?.currentTime || savedVideoTime || 0;
          // Ajuste fino para compensar latência
          videoRef.current.currentTime = Math.max(0, currentTime - 0.05);
          
          // Restaurar estado de som do vídeo principal
          const targetMuted = preFormMutedRef.current ?? (videoRef.current ? videoRef.current.muted : videoMuted);
          videoRef.current.muted = targetMuted;
          videoRef.current.volume = targetMuted ? 0 : 1;
          console.log('🔊 Restaurando estado de som ao fechar PiP:', targetMuted);
          
          // Retomar reprodução do vídeo principal (independentemente do estado de mute)
          try { lastUserGestureAtRef.current = Date.now(); desiredStateRef.current = 'playing'; } catch {}
          maybePlay(videoRef.current).then((ok) => {
              if (ok) { setVideoPlaying(true); setVideoMuted(targetMuted); return; }
              try { videoRef.current!.play().then(() => { setVideoPlaying(true); setVideoMuted(targetMuted); }).catch(() => {}); } catch {}
          }).catch(error => console.error('Erro ao retomar vídeo principal:', error));
          
          // Limpar a referência do estado de som
          setTimeout(() => {
            preFormMutedRef.current = null;
            console.log('🔊 Estado de som limpo após fechar PiP');
          }, 200);
        } catch (e) {
          console.error('Erro ao retomar vídeo principal:', e);
        }
      }

      // Parar vídeo PiP quando chat fecha
      if (pipVideoRef.current) {
        try { 
          pipVideoRef.current.pause();
          setPipVideoPlaying(false);
        } catch {}
      }
    }
    // Se o aviso de rotação estiver visível, garantir PiP desativado/pausado
    if (orientationWarningVisible) {
      setPipVisible(false);
      if (pipVideoRef.current) {
        try { pipVideoRef.current.pause(); } catch {}
      }
    }
  }, [showChatbotPopup, showHumanChat, showGuidePopup, showBudgetForm, showSimpleContact, isDesktop, pipVisible, pipManuallyClosed, orientationWarningVisible]);

  // Guardar o tempo do vídeo quando o chat ou formulário fecha (não quando PiP é fechado manualmente)
  useEffect(() => {
    // Só guardar o tempo se o PiP estava visível e o chat fechou (não quando PiP é fechado manualmente)
    if (!isDesktop && !showChatbotPopup && !showHumanChat && !showGuidePopup && videoRef.current && shouldSaveTime) {
      const currentTime = videoRef.current.currentTime;
      setSavedVideoTime(currentTime);
      setShouldSaveTime(false);
    }
  }, [showChatbotPopup, showHumanChat, showGuidePopup, isDesktop, shouldSaveTime, savedVideoTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Garantir: quando QUALQUER formulário/modal abre, o vídeo principal é APENAS pausado
  useEffect(() => {
    if (showGuidePopup || showBudgetForm || showSimpleContact) {
      (async () => {
      try {
        // 1. Guardar o estado atual do som do vídeo principal (mas NÃO modificar)
        const currentVideoMuted = videoRef.current ? videoRef.current.muted : videoMuted;
        const currentVideoVolume = videoRef.current ? videoRef.current.volume : (videoMuted ? 0 : 1);
        
        console.log('🔊 Estado atual do vídeo antes do formulário:', {
          muted: currentVideoMuted,
          volume: currentVideoVolume
        });
        
        // 2. APENAS pausar o vídeo principal (sem afetar o som)
        if (videoRef.current) {
          try {
            // Guardar tempo atual
            const currentTime = videoRef.current.currentTime;
            setSavedVideoTime(currentTime);
            
            // APENAS pausar, sem modificar o som
            await videoRef.current.pause();
            setVideoPlaying(false);
            
            console.log('⏸️ Vídeo principal pausado (som mantido):', {
              paused: videoRef.current.paused,
              muted: videoRef.current.muted,
              volume: videoRef.current.volume
            });
          } catch (error) {
            console.error('Erro ao pausar vídeo principal:', error);
          }
        }
        
        // 3. Configurar o PiP com o mesmo estado de som do vídeo principal
        if (pipVideoRef.current) {
          try {
            // Usar o estado ATUAL do vídeo principal
            pipVideoRef.current.volume = currentVideoVolume;
            pipVideoRef.current.muted = currentVideoMuted;
            
            console.log('🔊 PiP configurado com estado atual do vídeo:', {
              muted: currentVideoMuted,
              volume: currentVideoVolume
            });
          } catch (error) {
            console.error('Erro ao configurar som do PiP:', error);
          }
        }
        
        // 4. Pausar vídeos de background (sem afetar som)
        if (bgVideoRef.current) {
          try { await bgVideoRef.current.pause(); } catch {}
        }
        if (welcomeBgVideoRef.current) {
          try { await welcomeBgVideoRef.current.pause(); } catch {}
        }
      } catch (error) {
        console.error('Erro ao controlar som do formulário:', error);
      }
      })();
    }
    // Não limpar preFormMutedRef.current aqui - será limpo após restauração
  }, [showGuidePopup, showBudgetForm, showSimpleContact, isDesktop, videoMuted]);

  // Restaurar estado quando o formulário/modal fecha (sem modificar o som)
  useEffect(() => {
    if (!showGuidePopup && !showBudgetForm && !showSimpleContact) {
      try {
        // NÃO modificar o estado de som - manter como está
        if (videoRef.current) {
          console.log('🔊 Estado do vídeo mantido após fechar formulário:', {
            muted: videoRef.current.muted,
            volume: videoRef.current.volume
          });
        }
        
        // O PiP já está com o estado correto - não modificar
        if (pipVideoRef.current) {
          console.log('🔊 Estado do PiP mantido após fechar formulário:', {
            muted: pipVideoRef.current.muted,
            volume: pipVideoRef.current.volume
          });
        }
        
        // NÃO modificar estados de som do React
        // NÃO iniciar reprodução automaticamente
      } catch {}
    }
  }, [showGuidePopup, showBudgetForm, showSimpleContact]);
  // Garantir que o vídeo mantenha o seu estado de mute quando qualquer chat abre (AI ou guia real)
  useEffect(() => {
    if (isDesktop) return;
    if (showHumanChat || showChatbotPopup) {
      try {
        // IMPORTANTE: Para o chat real, usar o estado atual do vídeo principal
        // Para o chat AI, usar o estado global
        const targetMuted = showHumanChat ? 
          (videoRef.current ? videoRef.current.muted : videoMuted) : 
          videoMuted;
        
        const chatType = showHumanChat ? 'humano' : 'AI';
        console.log(`🔊 Chat ${chatType} aberto - estado de som:`, {
          targetMuted,
          videoMuted,
          currentVideoMuted: videoRef.current?.muted,
          isHumanChat: showHumanChat
        });
        
        // Configurar o PiP primeiro
        if (pipVideoRef.current) {
          // O PiP sempre segue o estado do vídeo principal
          // Importante: Primeiro garantir que o volume está configurado corretamente
          pipVideoRef.current.volume = targetMuted ? 0 : 1;
          // Depois configurar o mute
          pipVideoRef.current.muted = targetMuted;
          
          // Se o PiP estiver visível e o som estiver ativado, tentar tocar
          if (pipVisible && !targetMuted) {
            safePlay(pipVideoRef.current);
          }
        }
        
        // Depois configurar o vídeo principal
        if (videoRef.current) {
          videoRef.current.volume = targetMuted ? 0 : 1;
          videoRef.current.muted = targetMuted;
          
          if (!videoRef.current.paused) {
            try { videoRef.current.pause(); } catch {}
          }
          setVideoPlaying(false);
        }
        
        // Atualizar estados do React
        setVideoMuted(targetMuted);
        setVideoPlaying(!targetMuted);
        setPipVideoPlaying(!targetMuted && pipVisible);
      } catch (error) {
        console.error('Erro ao controlar som do chat:', error);
      }
    }
  }, [showHumanChat, showChatbotPopup, isDesktop, videoMuted, pipVisible]);

  // Sincronizar estado do vídeo PiP com eventos de play/pause
  useEffect(() => {
    const pipVideo = pipVideoRef.current;
    if (!pipVideo) return;

    const handlePlay = () => setPipVideoPlaying(true);
    const handlePause = () => setPipVideoPlaying(false);

    pipVideo.addEventListener('play', handlePlay);
    pipVideo.addEventListener('pause', handlePause);

    return () => {
      pipVideo.removeEventListener('play', handlePlay);
      pipVideo.removeEventListener('pause', handlePause);
    };
  }, []);

  // Pré-aquecer o vídeo do PiP em background para comutação instantânea
  useEffect(() => {
    if (isDesktop) return; // PiP só é relevante em mobile
    const pip = pipVideoRef.current;
    const main = videoRef.current;
    if (!pip || !main) return;

    try {
      // Não forçar src aqui para evitar descarregar; o src já vem do JSX.
      pip.preload = 'auto';
      // Inicialmente mute para garantir autoplay, mas será restaurado depois
      pip.volume = 0;
      pip.muted = true; // autoplay em mobile exige mute
      // manter tempo próximo do principal para evitar seeks longos
      const sync = () => {
        try {
          const t = main.currentTime || 0;
          if (Math.abs((pip.currentTime || 0) - t) > 0.5) {
            pip.currentTime = t;
          }
        } catch {}
      };
      const onTime = () => sync();
      main.addEventListener('timeupdate', onTime);

      // após primeira interação do utilizador na página, dar um play curto e pausar,
      // isto aquece o pipeline e torna o play seguinte instantâneo
      const warmup = (ev?: Event) => {
        // Não fazer warmup se o formulário estiver aberto
        if (showGuidePopup) return;
        // Ignorar cliques em controlos/botões para não consumir o primeiro clique do utilizador
        try {
          const target = (ev?.target || null) as HTMLElement | null;
          if (target && target.closest(`.${styles.glassmorphismControlBar}`)) {
            return;
          }
        } catch {}
        document.removeEventListener('touchstart', warmup);
        document.removeEventListener('click', warmup);
        safePlay(pip).then(() => {
          setTimeout(() => { try { pip.pause(); } catch {} }, 50);
        });
      };
      document.addEventListener('touchstart', warmup, { once: true, passive: true });
      // Usar capture para executar antes de outros handlers mas honrar o filtro de controlos
      document.addEventListener('click', warmup, { once: true, passive: true, capture: true } as any);

      return () => {
        main.removeEventListener('timeupdate', onTime);
        document.removeEventListener('touchstart', warmup as any);
        document.removeEventListener('click', warmup as any);
      };
    } catch {}
  }, [isDesktop]);



  // Função auxiliar para dar play em segurança (não executa se o formulário estiver aberto)
  const safePlay = (video: HTMLVideoElement | null): Promise<void> => {
    if (!video) return Promise.resolve();
    if (showGuidePopup) return Promise.resolve();
    try {
      const result = video.play();
      // Alguns browsers devolvem Promise
      if (result && typeof (result as any).catch === 'function') {
        return (result as Promise<void>).catch(() => { /* ignorar AbortError */ });
      }
      return Promise.resolve();
    } catch {
      return Promise.resolve();
    }
  };

  // Função simplificada para drag and drop do PiP
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Verificar se o clique foi num botão ou controlo
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest(`.${styles.pipControls}`)) {
      return; // Não iniciar drag se clicou num botão
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
    setIsDragging(true);
  };
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    // Apenas prevenir default se estiver realmente a fazer drag
    if (isDragging) {
      e.preventDefault();
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;
    
    // Limitar aos limites da janela baseado no tamanho atual
    const currentWidth = pipExpanded ? 180 : 120;
    const currentHeight = pipExpanded ? 320 : 213;
    const maxX = window.innerWidth - currentWidth;
    const maxY = window.innerHeight - currentHeight;
    
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));
    
    // Usar requestAnimationFrame para animação mais suave
    requestAnimationFrame(() => {
      setPipPosition({
        x: clampedX,
        y: clampedY
      });
    });
  }, [isDragging, dragOffset, pipExpanded]);

  const handleDragEnd = () => {
    setIsDragging(false);
  };
  // Função para fechar apenas o PiP sem fechar o chat
  const handleClosePiP = () => {
    // Parar o vídeo PiP
    if (pipVideoRef.current) {
      pipVideoRef.current.pause();
      setPipVideoPlaying(false);
    }
    // Resetar posição do PiP para a posição inicial
    resetPipPosition();
    setPipExpanded(false);
    // Marcar que foi fechado manualmente
    setPipManuallyClosed(true);
    // Esconder o PiP completamente
    setPipVisible(false);
  };
  // Clicar no PiP: voltar ao ecrã inicial (welcome) sem quebrar UX em mobile
  const handlePipBackToHome = (e: React.MouseEvent) => {
    try {
      // Evitar acionar quando a intenção é arrastar ou clicar em controlos
      const target = e.target as HTMLElement;
      if (isDragging) return;
      if (target.closest('button') || target.closest(`.${styles.pipControls}`)) return;

      // Parar apenas o PiP e preparar retoma imediata do vídeo principal
      try { pipVideoRef.current?.pause(); } catch {}
      if (videoRef.current) {
        // Sincronizar tempo do principal a partir do PiP (se existir)
        try {
          const pipTime = pipVideoRef.current?.currentTime;
          if (typeof pipTime === 'number' && !Number.isNaN(pipTime) && pipTime > 0) {
            videoRef.current.currentTime = pipTime;
          }
        } catch {}

        // Respeitar preferência de som atual
        try { videoRef.current.muted = videoMuted; } catch {}

        // Marcar gesto e intenção de reproduzir para não ser bloqueado no iOS
        try {
          lastUserGestureAtRef.current = Date.now();
          desiredStateRef.current = 'playing';
        } catch {}

        // Tentar reproduzir imediatamente
        maybePlay(videoRef.current).then((ok) => {
          if (!ok) {
            try { videoRef.current.play().then(() => setVideoPlaying(true)).catch(() => {}); } catch {}
          } else {
            setVideoPlaying(true);
          }
        });
      }

      // Fechar chats e popups
      setShowChatbotPopup(false);
      setShowHumanChat(false);
      setShowGuidePopup(false);
      setPipVisible(false);

      // Ir para o ecrã imediatamente após "Começar a conversa"
      setShowStartButton(false);

      // Garantir sincronização de tempo (idempotente)
      try {
        const pipTime = pipVideoRef.current?.currentTime || 0;
        if (videoRef.current) {
          if (!Number.isNaN(pipTime) && pipTime > 0) {
            try { videoRef.current.currentTime = pipTime; } catch {}
          }
          // Marcar intenção de play para reforçar no iOS
          try {
            lastUserGestureAtRef.current = Date.now();
            desiredStateRef.current = 'playing';
          } catch {}
          maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
        }
      } catch {}

      // Em desktop, preferir hold até nova interação
      if (isDesktop) setPreferHold(true);
    } catch {}
  };

  // Função para alternar o mute do vídeo PiP
  const handleTogglePiPMute = () => {
    // O PiP sempre segue o vídeo principal, então alternar o vídeo principal
    const newMutedState = !videoMuted;
    setVideoMuted(newMutedState);
      
    // Aplicar imediatamente aos vídeos
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
      videoRef.current.volume = newMutedState ? 0 : 1;
    }
    if (pipVideoRef.current) {
      // Primeiro configurar o volume para garantir que o áudio esteja corretamente configurado
      // Depois configurar o mute
      pipVideoRef.current.muted = newMutedState;
      pipVideoRef.current.volume = newMutedState ? 0 : 1;
      
      // Log para debug
      console.log('🔊 PiP mute alterado:', {
        muted: pipVideoRef.current.muted,
        volume: pipVideoRef.current.volume
      });
    }
    
    // Não salvar preferência - resetar sempre no refresh
  };

  // Event listeners para drag and drop
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, dragOffset, handleDragMove]);

  


  function handleTalkToMe() {
    setShowActionButtons(true); // Manter os botões visíveis
    setShowStartButton(false); // Esconder o botão inicial
    
    // Fechar o chat humano se estiver aberto
    if (showHumanChat) {
      setShowHumanChat(false);
    }
    
    // Em desktop, abrir o chatbot automaticamente. Em mobile, não abrir.
    if (isDesktop) {
      setShowChatbotPopup(true);
      setReturnedFromAiAfterHuman(true);
    }
    
    // Comportamento diferente para desktop e mobile
    if (videoRef.current) {
      if (isDesktop) {
        // Desktop: Reiniciar o vídeo apenas se for a primeira vez que se abre o chat
        if (!showChatbotPopup && !showHumanChat) {
          // Garantir retoma do último tempo conhecido antes de tocar
          const t = Number.isFinite(lastKnownTimeRef.current) && lastKnownTimeRef.current > 0
            ? lastKnownTimeRef.current : videoRef.current.currentTime;
          try { if (Math.abs((videoRef.current.currentTime || 0) - (t || 0)) > 0.2) { videoRef.current.currentTime = t; } } catch {}
          maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
          setVideoPlaying(true);
        } else {
          // Se já há um chat aberto, continuar o vídeo de onde está
          if (videoRef.current.paused) {
            maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
          }
        }
      } else {
        // Mobile: Iniciar o vídeo se não estiver tocando
        if (videoRef.current.paused) {
          maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
        }
        
        // Importante: Se o chat vai abrir em mobile, preparar para PiP
        if (!isDesktop && showChatbotPopup) {
          // Marcar para pausar o vídeo principal quando o PiP estiver pronto
          setTimeout(() => {
            if (videoRef.current && showChatbotPopup) {
              videoRef.current.pause();
              setVideoPlaying(false);
            }
          }, 200);
        }
      }
    } else {
      // Se o vídeo ainda não estiver carregado, tentar novamente após um momento
      setTimeout(() => {
        if (videoRef.current) {
          if (isDesktop) {
            if (!showChatbotPopup && !showHumanChat) {
              const t1 = Number.isFinite(lastKnownTimeRef.current) && lastKnownTimeRef.current > 0
                ? lastKnownTimeRef.current : videoRef.current.currentTime;
              try { if (Math.abs((videoRef.current.currentTime || 0) - (t1 || 0)) > 0.2) { videoRef.current.currentTime = t1; } } catch {}
              maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
              setVideoPlaying(true);
            } else {
              if (videoRef.current.paused) {
                maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
              }
            }
          } else {
            if (videoRef.current.paused) {
              maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
            }
          }
        }
      }, 100);
    }
    

  }

  function handleSearchBarClick() {
    setShowActionButtons(true); // Manter os botões visíveis
    setShowStartButton(false); // Esconder o botão inicial
    
    // Fechar o chat humano se estiver aberto
    if (showHumanChat) {
      setShowHumanChat(false);
    }
    
    // Sempre abrir o chatbot quando clicar na barra de pesquisa (tanto desktop quanto mobile)
    setShowChatbotPopup(true);
    setReturnedFromAiAfterHuman(true);
    
    // Comportamento diferente para desktop e mobile
    if (videoRef.current) {
      if (isDesktop) {
        // Desktop: Reiniciar o vídeo apenas se for a primeira vez que se abre o chat
        if (!showChatbotPopup && !showHumanChat) {
          const t2 = Number.isFinite(lastKnownTimeRef.current) && lastKnownTimeRef.current > 0
            ? lastKnownTimeRef.current : videoRef.current.currentTime;
          try { if (Math.abs((videoRef.current.currentTime || 0) - (t2 || 0)) > 0.2) { videoRef.current.currentTime = t2; } } catch {}
          maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
          setVideoPlaying(true);
        } else {
          // Se já há um chat aberto, continuar o vídeo de onde está
          if (videoRef.current.paused) {
            maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
          }
        }
      } else {
        // Mobile: Guardar o tempo atual para sincronização com PiP
        const currentTime = videoRef.current.currentTime;
        setSavedVideoTime(currentTime);
        
        // Pausar o vídeo principal imediatamente para evitar reprodução dupla
        videoRef.current.pause();
        setVideoPlaying(false);
      }
    } else {
      // Se o vídeo ainda não estiver carregado, tentar novamente após um momento
      setTimeout(() => {
        if (videoRef.current) {
          if (isDesktop) {
            if (!showChatbotPopup && !showHumanChat) {
              const t3 = Number.isFinite(lastKnownTimeRef.current) && lastKnownTimeRef.current > 0
                ? lastKnownTimeRef.current : videoRef.current.currentTime;
              try { if (Math.abs((videoRef.current.currentTime || 0) - (t3 || 0)) > 0.2) { videoRef.current.currentTime = t3; } } catch {}
              maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
            } else {
              if (videoRef.current.paused) {
                maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
              }
            }
          } else {
            // Mobile: Guardar o tempo atual para sincronização com PiP (no timeout)
            const currentTime = videoRef.current.currentTime;
            setSavedVideoTime(currentTime);
            // Não pausar o vídeo principal aqui - deixar o useEffect do PiP gerenciar
          }
        }
      }, 100);
    }
    
    // Focar no input do chatbot apenas em desktop
    if (isDesktop) {
      setTimeout(() => {
        chatbotInputRef.current?.focus();
      }, 300);
    }
    // Em mobile, não focar automaticamente para evitar que o teclado abra

  }

  function handleRewind() {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
  }

  function handleFastForward() {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
    }
  }

  function handleToggleMute() {
    const newMutedState = !videoMuted;
      setVideoMuted(newMutedState);
      
    // Aplicar imediatamente aos vídeos (inclui volume para evitar estados inconsistentes)
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
      videoRef.current.volume = newMutedState ? 0 : 1;
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.muted = newMutedState;
      pipVideoRef.current.volume = newMutedState ? 0 : 1;
    }
    
    // Não salvar preferência - resetar sempre no refresh
  }

  async function handlePlayPause() {
    const video = videoRef.current;
    if (!video) return;
    // Marcar gesto explícito do utilizador
    lastUserGestureAtRef.current = Date.now();

    // Se o vídeo está em reprodução, pausar
    if (!video.paused) {
      // Marcar pausa iniciada pelo utilizador para evitar auto-retomar
      userInitiatedPauseRef.current = true;
      desiredStateRef.current = 'paused';
      // Abrir janela para ignorar eventos de pause tardios
      ignorePauseEventUntilRef.current = Date.now() + 1200;
      // iOS: desativar loop durante pausa para evitar regressar ao início
      try {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isIOS = /iP(ad|hone|od)/i.test(ua);
        if (isIOS) {
          if (originalLoopRef.current === null) originalLoopRef.current = video.loop;
          video.loop = false;
        }
      } catch {}
      try { video.pause(); } catch {}
      setVideoPlaying(false);
      // Limpar flag após curto período (aumentar ligeiramente para iOS)
      setTimeout(() => { userInitiatedPauseRef.current = false; }, 1200);
      // Bloquear auto-plays reativos por um curto período
      hardPauseUntilRef.current = Date.now() + 1500;
      enforceDesiredState(video);
      return;
    }

    // Se o vídeo está pausado, garantir que está pronto e tentar reproduzir
    try {
      // Abrir janela de proteção de gesto do utilizador (impede PiP/efeitos reativos de pausar de imediato)
      userGestureGuardUntilRef.current = Date.now() + 800;
      desiredStateRef.current = 'playing';
      // iOS/Safari com HLS nativo: tentar play imediato dentro do gesto do utilizador
      try {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isIOS = /iP(ad|hone|od)/i.test(ua);
        const hasNativeHls = typeof video.canPlayType === 'function' && !!video.canPlayType('application/vnd.apple.mpegurl');
        if (isIOS && hasNativeHls) {
        try {
          await video.play();
          setVideoPlaying(true);
            enforceDesiredState(video);
            return;
        } catch {
            const wasMuted = video.muted;
            video.muted = true;
            try {
              await video.play();
              setVideoPlaying(true);
              setTimeout(() => { try { video.muted = wasMuted; } catch {} }, 300);
              enforceDesiredState(video);
              return;
            } catch {
              try { video.muted = wasMuted; } catch {}
              // continuar fluxo padrão
            }
          }
        }
      } catch {}
      // iOS: antes de retomar, restaurar tempo guardado se houve regressão
      try {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isIOS = /iP(ad|hone|od)/i.test(ua);
        if (isIOS) {
          const t = Number.isFinite(lastKnownTimeRef.current) && lastKnownTimeRef.current > 0 ? lastKnownTimeRef.current : (video.currentTime || 0);
          if (Math.abs((video.currentTime || 0) - (t || 0)) > 0.3) {
            try { video.currentTime = t; } catch {}
          }
        }
      } catch {}
      // Esperar até que o vídeo esteja pronto para reprodução
      if (video.readyState < 2) {
            await new Promise<void>((resolve) => {
              const onCanPlay = () => {
                video.removeEventListener('canplay', onCanPlay);
                resolve();
              };
          video.addEventListener('canplay', onCanPlay);
            });
      }

      // Tentar reproduzir normalmente primeiro
      try {
            await video.play();
            setVideoPlaying(true);
        enforceDesiredState(video);
        // iOS: restaurar loop após retomar
        try {
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
          const isIOS = /iP(ad|hone|od)/i.test(ua);
          if (isIOS && originalLoopRef.current !== null) {
            video.loop = originalLoopRef.current;
            originalLoopRef.current = null;
          }
        } catch {}
      } catch (error) {
        // Se falhar, tentar com mute temporário (comum para Cloudflare/HLS)
        const wasMuted = video.muted;
        video.muted = true;
        
        try {
          await video.play();
          setVideoPlaying(true);
          
          // Restaurar estado do áudio após sucesso
          setTimeout(() => {
            try { video.muted = wasMuted; } catch {}
          }, 300);
          enforceDesiredState(video);
          // iOS: restaurar loop após retomar
          try {
            const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
            const isIOS = /iP(ad|hone|od)/i.test(ua);
            if (isIOS && originalLoopRef.current !== null) {
              video.loop = originalLoopRef.current;
              originalLoopRef.current = null;
            }
          } catch {}
        } catch (error) {
          // Se ainda falhar, restaurar mute
          try { video.muted = wasMuted; } catch {}
          console.error('Falha ao reproduzir vídeo:', error);
        }
      }
    } catch (error) {
      console.error('Falha ao preparar vídeo:', error);
    }
  }

  function handleRestart() {
    if (videoRef.current) {
      // Reiniciar manualmente (botão restart) mantém o comportamento
      try { videoRef.current.currentTime = 0; } catch {}
      maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
      setVideoPlaying(true);
    }
  }

  const [isDownloading, setIsDownloading] = useState(false);
  
  // Estados para modal de perguntas rápidas
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<{[key: string]: boolean}>({});
  const [activeFaqCategory, setActiveFaqCategory] = useState<string | null>(null);
  const [faqImageIndex, setFaqImageIndex] = useState<{ [key: string]: number }>({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [modalCurrentIndex, setModalCurrentIndex] = useState(0);
  const [faqCurrentPage, setFaqCurrentPage] = useState<number>(1);
  const faqItemsPerPage = 4;
  const faqCatTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartLeftRef = useRef(0);

  // Funções para controlar modal de FAQ
  const handleOpenFaqModal = () => {
    setShowFaqModal(true);
    // Pausar vídeo principal quando modal FAQ abre (igual às outras modais)
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
        setVideoPlaying(false);
      } catch {}
    }
    // Em desktop, definir primeira categoria como ativa. Em mobile, deixar vazio para acordeão
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      // Selecionar FAQs baseadas no idioma atual
      const currentFaqs = (() => {
        if (guideVideos?.faqByLang?.[selectedLanguage]) {
          return guideVideos.faqByLang[selectedLanguage];
        }
        return guideVideos?.faq || null;
      })();
      
      if (currentFaqs && currentFaqs.length > 0) {
        setActiveFaqCategory(currentFaqs[0].name);
      }
    } else {
      setActiveFaqCategory(null);
    }
  };

  const handleCloseFaqModal = () => {
    setShowFaqModal(false);
    // Desktop: retomar vídeo principal quando modal FAQ fecha
    if (isDesktop) {
      if (videoRef.current && videoRef.current.paused) {
        try {
          maybePlay(videoRef.current).then((ok) => {
            if (ok) { setVideoPlaying(true); return; }
            try { videoRef.current!.play().then(() => setVideoPlaying(true)).catch(() => {}); } catch {}
          }).catch(() => {
            try { videoRef.current!.play().then(() => setVideoPlaying(true)).catch(() => {}); } catch {}
          });
        } catch {}
      }
    } else {
      // Mobile/Tablet: manter vídeo principal em pausa; o PiP é retomado pelo efeito de showFaqModal
      try {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setVideoPlaying(false);
        }
      } catch {}
    }
    setExpandedFaq({});
    setActiveFaqCategory(null);
  };

  const handleImageClick = (images: string[], currentIndex: number) => {
    setModalImages(images);
    setModalCurrentIndex(currentIndex);
    setShowImageModal(true);
    // Fechar o modal das FAQs quando abrir o modal de imagem
    setShowFaqModal(false);
    setActiveFaqCategory(null);
    setExpandedFaq({});
  };

  const handleCloseImageModal = () => {
    setShowImageModal(false);
    setModalImages([]);
    setModalCurrentIndex(0);
    
    // Reabrir o modal das FAQs quando fechar o modal de imagem
    setShowFaqModal(true);
    
    // Definir a primeira categoria como ativa
    const currentFaqs = (() => {
      if (guideVideos?.faqByLang?.[selectedLanguage]) {
        return guideVideos.faqByLang[selectedLanguage];
      } else if (guideVideos?.faq) {
        return guideVideos.faq;
      }
      return [];
    })();
    
    if (currentFaqs && currentFaqs.length > 0) {
      setActiveFaqCategory(currentFaqs[0].name);
    }
  };

  const handleImageNavigation = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setModalCurrentIndex(prev => prev > 0 ? prev - 1 : modalImages.length - 1);
    } else {
      setModalCurrentIndex(prev => prev < modalImages.length - 1 ? prev + 1 : 0);
    }
  };
  // Navegação por teclado (apenas setas, sem ESC)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showImageModal) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          if (modalImages.length > 1) {
            handleImageNavigation('prev');
          }
          break;
        case 'ArrowRight':
          if (modalImages.length > 1) {
            handleImageNavigation('next');
          }
          break;
      }
    };

    if (showImageModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // Previne scroll do body
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showImageModal, modalImages.length]);

  const handleFaqToggle = (questionIndex: number) => {
    setExpandedFaq(prev => ({
      ...prev,
      [questionIndex]: !prev[questionIndex]
    }));
  };

  const handleCategoryChange = (categoryName: string) => {
    // Se a categoria já está ativa, fechar (alternar)
    if (activeFaqCategory === categoryName) {
      setActiveFaqCategory(null);
    } else {
      setActiveFaqCategory(categoryName);
    }
    setExpandedFaq({}); // Fechar todas as perguntas ao mudar categoria
    setFaqCurrentPage(1); // reset para primeira página
  };

  // Em smartphone/tablet: controlar PiP quando modal de Perguntas Rápidas ou modal de imagem abre/fecha
  useEffect(() => {
    if (isDesktop) return;
    
    if (showFaqModal || showImageModal) {
      // Modal aberta: pausar PiP
      try {
        if (pipVideoRef.current) {
          pipVideoRef.current.pause();
          setPipVideoPlaying(false);
        }
      } catch {}
    } else {
      // Modal fechada: garantir que o vídeo principal permanece pausado em mobile/tablet
      if (!isDesktop && videoRef.current && !videoRef.current.paused) {
        try {
          videoRef.current.pause();
          setVideoPlaying(false);
        } catch {}
      }
      // Retomar PiP se estiver visível e não estiver mutado
      if (pipVisible && !videoMuted) {
        try {
          if (pipVideoRef.current) {
            pipVideoRef.current.play()
              .then(() => setPipVideoPlaying(true))
              .catch(() => setPipVideoPlaying(false));
          }
        } catch {}
      }
    }
  }, [showFaqModal, showImageModal, isDesktop, pipVisible, videoMuted]);

  const scrollCategoriesBy = (direction: number) => {
    const el = faqCatTrackRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  // Garantir que a categoria ativa fica visível ao centro
  useEffect(() => {
    if (!activeFaqCategory || !faqCatTrackRef.current) return;
    const el = faqCatTrackRef.current.querySelector(
      `[data-category="${CSS.escape(activeFaqCategory)}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeFaqCategory]);

  // Drag to scroll: rato e touch
  useEffect(() => {
    const el = faqCatTrackRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      scrollStartLeftRef.current = el.scrollLeft;
      el.setAttribute('data-dragging', 'true');
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartXRef.current;
      el.scrollLeft = scrollStartLeftRef.current - dx;
    };
    const endMouse = () => {
      isDraggingRef.current = false;
      el.removeAttribute('data-dragging');
    };

    const onTouchStart = (e: TouchEvent) => {
      isDraggingRef.current = true;
      dragStartXRef.current = e.touches[0].clientX;
      scrollStartLeftRef.current = el.scrollLeft;
      el.setAttribute('data-dragging', 'true');
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.touches[0].clientX - dragStartXRef.current;
      el.scrollLeft = scrollStartLeftRef.current - dx;
    };
    const endTouch = () => {
      isDraggingRef.current = false;
      el.removeAttribute('data-dragging');
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endMouse);
    el.addEventListener('touchstart', onTouchStart, { passive: true } as AddEventListenerOptions);
    el.addEventListener('touchmove', onTouchMove, { passive: true } as AddEventListenerOptions);
    window.addEventListener('touchend', endTouch);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endMouse);
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('touchmove', onTouchMove as any);
      window.removeEventListener('touchend', endTouch);
    };
  }, []);

  async function handleDownload() {
    const url = guideVideos?.welcomeVideoURL || (videoRef.current ? videoRef.current.src : '');
    if (!url || isDownloading) return;
    
    setIsDownloading(true);
    try {
      const downloadUrl = toDownloadUrl(url);
      console.log('🎬 Tentando download:', downloadUrl);
      
      const proxied = `/api/download-video?url=${encodeURIComponent(downloadUrl)}`;
      const nameFromUrl = (downloadUrl.split('/').pop() || 'video.mp4').split('?')[0];
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isIOS) {
        // iOS precisa de blob/objectURL para evitar comportamento de navegação
        const res = await fetch(proxied, { cache: 'no-store' });
        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Erro desconhecido');
          throw new Error(`Falha no download: ${res.status} - ${errorText.slice(0, 100)}`);
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = nameFromUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        console.log('✅ Download iniciado (iOS)');
      } else {
        // Outros browsers: usar iframe escondido para iniciar o download imediatamente (sem bloquear a UI)
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = proxied;
        document.body.appendChild(iframe);
        
        // Verificar se o download foi iniciado
        setTimeout(async () => {
          try { 
            document.body.removeChild(iframe); 
            // Verificar se houve erro no iframe
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc?.body?.textContent?.includes('error')) {
              console.warn('⚠️ Possível erro no download via iframe');
            } else {
              console.log('✅ Download iniciado (iframe)');
            }
          } catch (e) {
            console.warn('⚠️ Erro ao remover iframe:', e);
          }
        }, 10000);
      }
    } catch (error) {
      console.error('❌ Erro no download:', error);
      // Mostrar feedback visual ao utilizador
      alert(`Erro ao descarregar vídeo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsDownloading(false);
    }
  }
  function handleCloseChatbot() {
    setShowChatbotPopup(false);
    
    // Só resetar a mensagem de boas-vindas se não houver mensagens na conversa
    if (chatbotMessages.length === 0) {
      setShowInstructions(true);
      setShowChatbotWelcome(true);
    } else {
      // Se já há mensagens, manter o estado atual (não mostrar boas-vindas novamente)
      // setShowInstructions(false); // Manter instruções visíveis
      setShowChatbotWelcome(false);
    }
    
    // Garantir que o scroll da página seja restaurado
                // document.body.style.overflow = 'auto'; // Removido conforme pedido
    
    // Garantir que o popup do guia também seja fechado se estiver aberto
    if (showGuidePopup) {
      setShowGuidePopup(false);
    }
    
    // Comportamento diferente para desktop e mobile ao fechar chat
    if (videoRef.current) {
      if (isDesktop) {
        // Desktop: Parar vídeo principal e voltar ao estado inicial
        videoRef.current.pause();
        setVideoPlaying(false);
        
        // NO PC: Voltar ao estado inicial (não welcome overlay) quando o chat for fechado
        // Isso mostra a barra de pesquisa + "Falar com guia real"
        setShowStartButton(false);
      } else {
        // Mobile: Continuar vídeo automaticamente com som
        videoRef.current.muted = videoMuted; // Respeitar preferência salva
        setVideoMuted(videoMuted);
        maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
      }
    }
  }

  // Garante HTML legível quando a IA devolver texto simples
  function ensureHtmlFromText(text: string): string {
    try {
      const t = String(text || '').trim();
      // Se já vier com HTML estrutural, devolver como está
      if (/[<](p|ul|ol|li|h1|h2|h3|h4|br|code|pre|strong|em)\b/i.test(t)) return t;
      if (t === '') return '';
      // Converter quebras de parágrafo e linhas para HTML simples
      const paragraphs = t.split(/\n{2,}/g);
      const html = paragraphs
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`) // linhas simples → <br>
        .join('');
      return html;
    } catch {
      return String(text || '');
    }
  }

  // Extrai <button> (e <a data-button="true">) do HTML e devolve conteúdo sem botões + lista de botões
  function extractButtonsFromHtml(html: string): { contentHtml: string; buttons: Array<{ label: string; href?: string }> } {
    try {
      const safeHtml = sanitizeHtml(String(html || ''));
      const container = document.createElement('div');
      container.innerHTML = safeHtml;

      const buttons: Array<{ label: string; href?: string }> = [];

      // Extrair <button>
      Array.from(container.querySelectorAll('button')).forEach((btn) => {
        const label = String(btn.textContent || '').trim();
        const href = btn.getAttribute('data-href') || btn.querySelector('a')?.getAttribute('href') || undefined;
        if (label) buttons.push({ label, href: href || undefined });
        btn.remove();
      });

      // Extrair âncoras que aparentem ser botões ou CTAs
      // Ampliado para cobrir intenções de compra/aquisição em PT/EN/ES/FR
      const CTA_REGEX = /(bilhete|bilhetes|comprar|compra|compras|comprar online|comprar agora|buy now|buy|purchase|checkout|add to cart|adquirir|adquira|adquiri|encomendar|order|commande|commander|acheter|achat|réserver|reservar|ticket|tickets|saber mais|ver mais|suporte|instalar|software|entrega|necessário|tipo|oferecem)/i;
      Array.from(container.querySelectorAll('a')).forEach((a) => {
        const label = String(a.textContent || '').trim();
        const href = a.getAttribute('href') || undefined;
        const role = (a.getAttribute('role') || '').toLowerCase();
        const classList = (a.getAttribute('class') || '').toLowerCase();
        const isMarkedButton = a.getAttribute('data-button') === 'true' || role === 'button' || classList.includes('btn') || classList.includes('button');
        const looksLikeCTA = CTA_REGEX.test(label) && label.length <= 60;
        if (isMarkedButton || looksLikeCTA) {
          if (label) buttons.push({ label, href });
          a.remove();
        }
      });

      return { contentHtml: container.innerHTML, buttons };
    } catch {
      return { contentHtml: String(html || ''), buttons: [] };
    }
  }

  // Função para gerar system prompt baseado no idioma selecionado
  function getSystemPromptForLanguage() {
    const basePrompt = guideVideos?.systemPrompt || '';
    const websiteSnippet = (() => {
      if (!websiteContext || !websiteContext.text) return '';
      const header = `\n\nInformação do website oficial (${(guideVideos as any)?.websiteUrl || ''}):`;
      const meta = `${websiteContext.title ? `\n- Título: ${websiteContext.title}` : ''}${websiteContext.description ? `\n- Descrição: ${websiteContext.description}` : ''}`;
      const body = `\n- Conteúdo relevante (excerto):\n${String(websiteContext.text).slice(0, 1500)}`;
      return `${header}${meta}${body}`;
    })();
    
    const languageInstructions = {
      'pt': 'Responde sempre em português de Portugal.',
      'en': 'Respond always in English.',
      'es': 'Responde siempre en español.',
      'fr': 'Réponds toujours en français.'
    };

    const currentLanguageInstruction = languageInstructions[selectedLanguage] || languageInstructions['pt'];

    return `${basePrompt}${websiteSnippet}\n\nContexto do Guia:\n- chat_humano_disponivel: ${guideVideos?.humanChatEnabled ? 'SIM' : 'NAO'}.\n- idioma_selecionado: ${selectedLanguage.toUpperCase()}.\n\nInstruções ao assistente:\n- Se o utilizador pedir para falar com humano/guia real/atendente e chat_humano_disponivel=SIM, coloca NA PRIMEIRA LINHA apenas [[OPEN_HUMAN_CHAT]].\n- Após essa linha, escreve uma frase muito curta a informar que o vais encaminhar para um humano.\n- Se chat_humano_disponivel=NAO, nunca coloques [[OPEN_HUMAN_CHAT]] e explica educadamente que o chat humano não está disponível, continuando a ajudar como IA.\n- ${currentLanguageInstruction}`;
  }

  // Função para gerar system prompt para chat com formatação HTML
  function getSystemPromptForChatWithHTML(userText?: string) {
    const basePrompt = guideVideos?.systemPrompt || '';
    const websiteSnippet = (() => {
      if (!websiteContext || !websiteContext.text) return '';
      const header = `\n\nInformação do website oficial (${(guideVideos as any)?.websiteUrl || ''}):`;
      const meta = `${websiteContext.title ? `\n- Título: ${websiteContext.title}` : ''}${websiteContext.description ? `\n- Descrição: ${websiteContext.description}` : ''}`;
      const body = `\n- Conteúdo relevante (excerto):\n${String(websiteContext.text).slice(0, 1500)}`;
      return `${header}${meta}${body}`;
    })();
    
    const languageInstructions = {
      'pt': 'Responde SEMPRE em português de Portugal.',
      'en': 'Respond ALWAYS in English.',
      'es': 'Responde SIEMPRE en español.',
      'fr': 'Réponds TOUJOURS en français.'
    };

    const currentLanguageInstruction = languageInstructions[selectedLanguage] || languageInstructions['pt'];

    // Override: se for pedido para falar com comercial e existirem contactos, NÃO pedir [[OPEN_HUMAN_CHAT]]
    const salesOverride = (() => {
      try {
        const phones = (budgetConfig?.commercialSectionEnabled && Array.isArray(budgetConfig?.commercialPhones)) ? budgetConfig.commercialPhones : [];
        if (userText && detectSalesIntent(String(userText)) && phones.length > 0) {
          return `\n- Se o utilizador pedir para falar com comercial/vendas e existirem contactos comerciais disponíveis, NÃO escrevas [[OPEN_HUMAN_CHAT]] nem digas que o vais encaminhar para um humano. Mantém a resposta neutra e curta.`;
        }
      } catch {}
      return '';
    })();

    return `${basePrompt}${websiteSnippet}\n\nContexto do Guia:\n- chat_humano_disponivel: ${guideVideos?.humanChatEnabled ? 'SIM' : 'NAO'}.\n- idioma_selecionado: ${selectedLanguage.toUpperCase()}.\n\nInstruções ao assistente:\n- Se o utilizador pedir para falar com humano/guia real/atendente e chat_humano_disponivel=SIM, coloca NA PRIMEIRA LINHA apenas [[OPEN_HUMAN_CHAT]].\n- Após essa linha, escreve uma frase muito curta a informar que o vais encaminhar para um humano.\n- Se chat_humano_disponivel=NAO, nunca coloques [[OPEN_HUMAN_CHAT]] e explica educadamente que o chat humano não está disponível, continuando a ajudar como IA.\n- ${currentLanguageInstruction}${salesOverride}\n- Formata a resposta em HTML claro (usa <p>, <ul>, <li>, <strong>, <h3>).\n- Evita <img>, <iframe>, <video>.\n- Prefere listas e títulos curtos em vez de texto corrido.`;
  }

  // Função para obter título de boas-vindas baseado no idioma
  function getWelcomeTitle() {
    if (currentChatConfig?.welcomeTitle) {
      return currentChatConfig.welcomeTitle;
    }

    const defaultTitles = {
      'pt': 'BEM-VINDO AO GUIA VIRTUAL',
      'en': 'WELCOME TO THE VIRTUAL GUIDE',
      'es': 'BIENVENIDO AL GUÍA VIRTUAL',
      'fr': 'BIENVENUE AU GUIDE VIRTUEL'
    };

    return defaultTitles[selectedLanguage] || defaultTitles['pt'];
  }

  // Função para obter textos dos botões baseados no idioma
  function getButtonTexts() {
    const defaultTexts = {
      'pt': {
        button1: 'Como chegar?',
        button2: 'Horários e preços',
        button3: 'O que visitar?'
      },
      'en': {
        button1: 'How to get there?',
        button2: 'Hours and prices',
        button3: 'What to visit?'
      },
      'es': {
        button1: '¿Cómo llegar?',
        button2: 'Horarios y precios',
        button3: '¿Qué visitar?'
      },
      'fr': {
        button1: 'Comment y arriver?',
        button2: 'Horaires et prix',
        button3: 'Que visiter?'
      }
    };

    const currentTexts = defaultTexts[selectedLanguage] || defaultTexts['pt'];

    return {
      button1Text: currentChatConfig?.button1Text || currentTexts.button1,
      button2Text: currentChatConfig?.button2Text || currentTexts.button2,
      button3Text: currentChatConfig?.button3Text || currentTexts.button3,
      button1Function: currentChatConfig?.button1Function || currentTexts.button1,
      button2Function: currentChatConfig?.button2Function || currentTexts.button2,
      button3Function: currentChatConfig?.button3Function || currentTexts.button3
    };
  }

  // Função para obter textos da interface baseados no idioma
  // Função auxiliar para substituir placeholders nas mensagens
  function formatMessage(template: string, replacements: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => replacements[key] || match);
  }

  // Função para obter texto traduzido do budgetConfig
  function getBudgetText(type: 'title' | 'button', fallback: string): string {
    if (!budgetConfig) return fallback;
    
    const labels = type === 'title' ? budgetConfig.titleLabels : budgetConfig.budgetButtonTextLabels;
    const defaultText = type === 'title' ? budgetConfig.title : budgetConfig.budgetButtonText;
    
    // Tentar obter tradução baseada no idioma selecionado
    if (labels && selectedLanguage) {
      const translatedText = labels[selectedLanguage as keyof typeof labels];
      if (translatedText) return translatedText;
    }
    
    // Fallback para o texto padrão
    return defaultText || fallback;
  }

  function getInterfaceTexts() {
    const texts = {
      'pt': {
        startConversation: 'INICIAR CONVERSA',
        startConversationAria: 'Iniciar conversa',
        complaintsBook: 'Livro de Reclamações',
        privacyPolicy: 'Política de Privacidade',
        follow: 'Seguir',
        followAria: 'Seguir',
        followTitle: 'SEGUIR',
        followDescription: 'Siga e fique a par de todas as novidades',
        namePlaceholder: 'O seu nome',
        emailPlaceholder: 'O seu e-mail',
        followButton: 'Seguir',
        followSuccess: 'Obrigado! Agora receberá as nossas novidades.',
        followError: 'Erro ao processar o pedido. Tente novamente.',
        close: 'Fechar',
        faqButton: 'Perguntas Frequentes AI',
        faqTitle: 'Perguntas Frequentes AI',
        categories: 'Categorias',
        questions: 'Perguntas',
        chatPlaceholder: 'Escreva a sua pergunta...',
        searchPlaceholder: 'Escreva a sua pergunta',
        backToChat: 'Voltar conversa',
        disclaimer: 'O Virtual Sommelier pode cometer erros. Verifique informações importantes.',
        talkToRealGuide: 'FALAR COM SOMMELIER REAL',
        talkToRealGuideTitle: 'FALAR COM O CHAT REAL',
        realGuideChat: 'Conversa com Guia Real',
        fillDataToStart: 'Preencha os dados para iniciar conversa',
        yourName: 'O seu nome',
        yourEmail: 'O seu email',
        startConversationForm: 'INICIAR CONVERSAÇÃO',
        sending: 'A ENVIAR...',
        fillAllFields: 'Por favor, preencha todos os campos.',
        validEmail: 'Por favor, insira um email válido.',
        formError: 'Ocorreu um erro ao enviar o formulário. Por favor, tente novamente.',
        thinking1: 'Estamos a preparar a resposta',
        thinking2: 'A pensar',
        processingError: 'Desculpe, não consegui processar a sua pergunta.',
        generalError: 'Desculpe, ocorreu um erro. Tente novamente.',
        realGuideWelcome: 'Olá {name}! Sou o seu {guide}. Como posso ajudar hoje?',
        realGuideWelcomeBack: 'Olá! Bem-vindo(a) de volta. Sou o seu guia virtual. Como posso ajudá-lo hoje?',
        realGuideWelcomeBackWithName: 'Olá {name}! Bem-vindo(a) de volta. Sou o seu guia virtual. Como posso ajudá-lo hoje?',
        transitionMessage: 'Vejo que já falou com o nosso guia virtual. A partir daqui será a {guide} a responder',
        closingMessage: 'Esta conversa foi encerrada pelo operador. Obrigado pelo contacto! Pode continuar a falar com o guia virtual (IA) para mais ajuda.',
        aiWelcomeMessage: 'Olá! Sou o teu guia virtual e estou aqui para ajudar.',
        importantInfo: 'Informações importantes:',
        serviceHours: 'Horário de atendimento: das 9h às 18h',
        responseTimeInHours: 'Tempo médio de resposta em horário de atendimento: 10 minutos',
        responseTimeOutHours: 'Tempo médio de resposta fora do horário de atendimento: 24 horas',
        emailResponse: 'Todas as mensagens enviadas fora do horário de atendimento serão respondidas por email.',
        conversationWith: 'Conversa com',
        realTimeConversation: 'Conversa em tempo real',
        confirmExit: 'Tem a certeza que pretende sair da conversa com o guia real?',
        back: 'Voltar',
        confirmExitTitle: 'Confirmar Saída',
        cancel: 'Cancelar',
        yesExit: 'Sim, Sair',
        aiHelpText: 'Se não conseguires resolver a tua questão, clica aqui para',
        aiHelpTextOr: ' ou consultar as',
        aiHelpTextEnd: '.',
        openAiChat: 'Abrir chat com IA'
      },
      'en': {
        startConversation: 'START CONVERSATION',
        startConversationAria: 'Start conversation',
        complaintsBook: 'Complaints Book',
        privacyPolicy: 'Privacy Policy',
        follow: 'Follow',
        followAria: 'Follow',
        followTitle: 'FOLLOW',
        followDescription: 'Follow us and stay updated with all the news',
        namePlaceholder: 'Your name',
        emailPlaceholder: 'Your email',
        followButton: 'Follow',
        followSuccess: 'Thank you! You will now receive our updates.',
        followError: 'Error processing request. Please try again.',
        close: 'Close',
        faqButton: 'Frequently Asked Questions AI',
        faqTitle: 'Frequently Asked Questions AI',
        categories: 'Categories',
        questions: 'Questions',
        chatPlaceholder: 'Write your question...',
        searchPlaceholder: 'Write your question',
        backToChat: 'Back to chat',
        disclaimer: 'Virtual Sommelier may make mistakes. Please verify important information.',
        talkToRealGuide: 'TALK TO REAL SOMMELIER',
        talkToRealGuideTitle: 'TALK TO REAL CHAT',
        realGuideChat: 'Real Guide Chat',
        fillDataToStart: 'Fill in the data to start conversation',
        yourName: 'Your name',
        yourEmail: 'Your email',
        startConversationForm: 'START CONVERSATION',
        sending: 'SENDING...',
        fillAllFields: 'Please fill in all fields.',
        validEmail: 'Please enter a valid email.',
        formError: 'An error occurred while sending the form. Please try again.',
        thinking1: 'We are preparing the answer',
        thinking2: 'Thinking',
        processingError: 'Sorry, I couldn\'t process your question.',
        generalError: 'Sorry, an error occurred. Please try again.',
        realGuideWelcome: 'Hello {name}! I\'m your {guide}. How can I help you today?',
        realGuideWelcomeBack: 'Hello! Welcome back. I\'m your virtual guide. How can I help you today?',
        realGuideWelcomeBackWithName: 'Hello {name}! Welcome back. I\'m your virtual guide. How can I help you today?',
        transitionMessage: 'I see you\'ve already spoken with our virtual guide. From now on, {guide} will be responding',
        closingMessage: 'This conversation has been closed by the operator. Thank you for your contact! You can continue talking to the virtual guide (AI) for more help.',
        aiWelcomeMessage: 'Hello! I\'m your virtual guide and I\'m here to help.',
        importantInfo: 'Important information:',
        serviceHours: 'Service hours: from 9am to 6pm',
        responseTimeInHours: 'Average response time during service hours: 10 minutes',
        responseTimeOutHours: 'Average response time outside service hours: 24 hours',
        emailResponse: 'All messages sent outside service hours will be answered by email.',
        conversationWith: 'Conversation with',
        realTimeConversation: 'Real-time conversation',
        confirmExit: 'Are you sure you want to exit the conversation with the real guide?',
        back: 'Back',
        confirmExitTitle: 'Confirm Exit',
        cancel: 'Cancel',
        yesExit: 'Yes, Exit',
        aiHelpText: 'If you cannot resolve your question, click here to talk to our',
        aiHelpTextOr: 'or consult the',
        aiHelpTextEnd: '.',
        openAiChat: 'Open AI Chat'
      },
      'es': {
        startConversation: 'INICIAR CONVERSACIÓN',
        startConversationAria: 'Iniciar conversación',
        complaintsBook: 'Libro de Reclamaciones',
        privacyPolicy: 'Política de Privacidad',
        follow: 'Seguir',
        followAria: 'Seguir',
        followTitle: 'SEGUIR',
        followDescription: 'Síguenos y mantente al día con todas las novedades',
        namePlaceholder: 'Tu nombre',
        emailPlaceholder: 'Tu correo electrónico',
        followButton: 'Seguir',
        followSuccess: '¡Gracias! Ahora recibirás nuestras actualizaciones.',
        followError: 'Error al procesar la solicitud. Inténtalo de nuevo.',
        close: 'Cerrar',
        faqButton: 'Preguntas Frecuentes IA',
        faqTitle: 'Preguntas Frecuentes IA',
        categories: 'Categorías',
        questions: 'Preguntas',
        chatPlaceholder: 'Escribe tu pregunta...',
        searchPlaceholder: 'Escribe tu pregunta',
        backToChat: 'Volver al chat',
        disclaimer: 'Virtual Sommelier puede cometer errores. Verifique información importante.',
        talkToRealGuide: 'HABLAR CON SOMMELIER REAL',
        talkToRealGuideTitle: 'HABLAR CON CHAT REAL',
        realGuideChat: 'Chat con Guía Real',
        fillDataToStart: 'Complete los datos para iniciar conversación',
        yourName: 'Tu nombre',
        yourEmail: 'Tu email',
        startConversationForm: 'INICIAR CONVERSACIÓN',
        sending: 'ENVIANDO...',
        fillAllFields: 'Por favor, complete todos los campos.',
        validEmail: 'Por favor, ingrese un email válido.',
        formError: 'Ocurrió un error al enviar el formulario. Por favor, inténtelo de nuevo.',
        thinking1: 'Estamos preparando la respuesta',
        thinking2: 'Pensando',
        processingError: 'Lo siento, no pude procesar tu pregunta.',
        generalError: 'Lo siento, ocurrió un error. Por favor, inténtalo de nuevo.',
        realGuideWelcome: '¡Hola {name}! Soy tu {guide}. ¿Cómo puedo ayudarte hoy?',
        realGuideWelcomeBack: '¡Hola! Bienvenido de vuelta. Soy tu guía virtual. ¿Cómo puedo ayudarte hoy?',
        realGuideWelcomeBackWithName: '¡Hola {name}! Bienvenido de vuelta. Soy tu guía virtual. ¿Cómo puedo ayudarte hoy?',
        transitionMessage: 'Veo que ya has hablado con nuestro guía virtual. A partir de ahora, {guide} responderá',
        closingMessage: 'Esta conversación ha sido cerrada por el operador. ¡Gracias por su contacto! Puede continuar hablando con el guía virtual (IA) para más ayuda.',
        aiWelcomeMessage: '¡Hola! Soy tu guía virtual y estoy aquí para ayudar.',
        importantInfo: 'Información importante:',
        serviceHours: 'Horario de atención: de 9h a 18h',
        responseTimeInHours: 'Tiempo promedio de respuesta en horario de atención: 10 minutos',
        responseTimeOutHours: 'Tiempo promedio de respuesta fuera del horario de atención: 24 horas',
        emailResponse: 'Todos los mensajes enviados fuera del horario de atención serán respondidos por correo electrónico.',
        conversationWith: 'Conversación con',
        realTimeConversation: 'Conversación en tiempo real',
        confirmExit: '¿Estás seguro de que quieres salir de la conversación con el guía real?',
        back: 'Volver',
        confirmExitTitle: 'Confirmar Salida',
        cancel: 'Cancelar',
        yesExit: 'Sí, Salir',
        aiHelpText: 'Si no puedes resolver tu pregunta, haz clic aquí para hablar con nuestro',
        aiHelpTextOr: 'o consultar las',
        aiHelpTextEnd: '.',
        openAiChat: 'Abrir chat con IA'
      },
      'fr': {
        startConversation: 'COMMENCER LA CONVERSATION',
        startConversationAria: 'Commencer la conversation',
        complaintsBook: 'Livre de Réclamations',
        privacyPolicy: 'Politique de Confidentialité',
        follow: 'Suivre',
        followAria: 'Suivre',
        followTitle: 'SUIVRE',
        followDescription: 'Suivez-nous et restez informé de toutes les nouveautés',
        namePlaceholder: 'Votre nom',
        emailPlaceholder: 'Votre e-mail',
        followButton: 'Suivre',
        followSuccess: 'Merci ! Vous recevrez maintenant nos mises à jour.',
        followError: 'Erreur lors du traitement de la demande. Veuillez réessayer.',
        close: 'Fermer',
        faqButton: 'Questions Fréquentes IA',
        faqTitle: 'Questions Fréquentes IA',
        categories: 'Catégories',
        questions: 'Questions',
        chatPlaceholder: 'Écrivez votre question...',
        searchPlaceholder: 'Écrivez votre question',
        backToChat: 'Retour au chat',
        disclaimer: 'Virtual Sommelier peut faire des erreurs. Vérifiez les informations importantes.',
        talkToRealGuide: 'PARLER AU SOMMELIER RÉEL',
        talkToRealGuideTitle: 'PARLER AU CHAT RÉEL',
        realGuideChat: 'Chat avec Guide Réel',
        fillDataToStart: 'Remplissez les données pour commencer la conversation',
        yourName: 'Votre nom',
        yourEmail: 'Votre email',
        startConversationForm: 'COMMENCER LA CONVERSATION',
        sending: 'ENVOI EN COURS...',
        fillAllFields: 'Veuillez remplir tous les champs.',
        validEmail: 'Veuillez entrer un email valide.',
        formError: 'Une erreur s\'est produite lors de l\'envoi du formulaire. Veuillez réessayer.',
        thinking1: 'Nous préparons la réponse',
        thinking2: 'En train de réfléchir',
        processingError: 'Désolé, je n\'ai pas pu traiter votre question.',
        generalError: 'Désolé, une erreur s\'est produite. Veuillez réessayer.',
        realGuideWelcome: 'Bonjour {name}! Je suis votre {guide}. Comment puis-je vous aider aujourd\'hui?',
        realGuideWelcomeBack: 'Bonjour! Bon retour. Je suis votre guide virtuel. Comment puis-je vous aider aujourd\'hui?',
        realGuideWelcomeBackWithName: 'Bonjour {name}! Bon retour. Je suis votre guide virtuel. Comment puis-je vous aider aujourd\'hui?',
        transitionMessage: 'Je vois que vous avez déjà parlé avec notre guide virtuel. À partir de maintenant, {guide} répondra',
        closingMessage: 'Cette conversation a été fermée par l\'opérateur. Merci pour votre contact ! Vous pouvez continuer à parler au guide virtuel (IA) pour plus d\'aide.',
        aiWelcomeMessage: 'Bonjour! Je suis votre guide virtuel et je suis là pour vous aider.',
        importantInfo: 'Informations importantes:',
        serviceHours: 'Heures de service: de 9h à 18h',
        responseTimeInHours: 'Temps de réponse moyen pendant les heures de service: 10 minutes',
        responseTimeOutHours: 'Temps de réponse moyen en dehors des heures de service: 24 heures',
        emailResponse: 'Tous les messages envoyés en dehors des heures de service seront répondus par e-mail.',
        conversationWith: 'Conversation avec',
        realTimeConversation: 'Conversation en temps réel',
        confirmExit: 'Êtes-vous sûr de vouloir quitter la conversation avec le guide réel?',
        back: 'Retour',
        confirmExitTitle: 'Confirmer la Sortie',
        cancel: 'Annuler',
        yesExit: 'Oui, Sortir',
        aiHelpText: 'Si vous ne pouvez pas résoudre votre question, cliquez ici pour parler à notre',
        aiHelpTextOr: 'ou consulter les',
        aiHelpTextEnd: '.',
        openAiChat: 'Ouvrir chat IA'
      }
    };

    const lang = selectedLanguageRef.current || 'pt';
    const selectedTexts = texts[lang] || texts['pt'];
    
    // Aplicar lógica de seleção de idioma para aiWelcomeMessage
    const chatConfig = currentChatConfig as any;
    console.log('🔍 Debug aiWelcomeMessage:', {
      lang,
      chatConfig,
      hasAiWelcomeMessage: !!chatConfig?.aiWelcomeMessage,
      hasEn: !!chatConfig?.aiWelcomeMessageEn,
      hasEs: !!chatConfig?.aiWelcomeMessageEs,
      hasFr: !!chatConfig?.aiWelcomeMessageFr
    });
    
    if (chatConfig?.aiWelcomeMessage) {
      // Se há mensagem personalizada, usar baseada no idioma
      switch (lang) {
        case 'en':
          selectedTexts.aiWelcomeMessage = chatConfig.aiWelcomeMessageEn || chatConfig.aiWelcomeMessage;
          break;
        case 'es':
          selectedTexts.aiWelcomeMessage = chatConfig.aiWelcomeMessageEs || chatConfig.aiWelcomeMessage;
          break;
        case 'fr':
          selectedTexts.aiWelcomeMessage = chatConfig.aiWelcomeMessageFr || chatConfig.aiWelcomeMessage;
          break;
        default:
          selectedTexts.aiWelcomeMessage = chatConfig.aiWelcomeMessage;
      }
      console.log('✅ Mensagem selecionada:', selectedTexts.aiWelcomeMessage);
    }
    
    return selectedTexts;
  }

  // Função para gerar sugestões baseadas nas perguntas frequentes do guia
  function generateChatSuggestions() {
    // Selecionar FAQs baseadas no idioma atual
    const currentFaqs = (() => {
      if (guideVideos?.faqByLang?.[selectedLanguage]) {
        return guideVideos.faqByLang[selectedLanguage];
      }
      return guideVideos?.faq || null;
    })();

    if (!currentFaqs || !Array.isArray(currentFaqs)) {
      return;
    }

    // Coletar todas as perguntas das FAQs
    const allQuestions: string[] = [];
    currentFaqs.forEach(category => {
      if (category.questions && Array.isArray(category.questions)) {
        category.questions.forEach(faq => {
          if (faq.question && typeof faq.question === 'string') {
            allQuestions.push(faq.question);
          }
        });
      }
    });

    // Selecionar 2 perguntas aleatórias das FAQs
    if (allQuestions.length > 0) {
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
      const selectedSuggestions = shuffled.slice(0, 2);
      setChatSuggestions(selectedSuggestions);
    }
  }
  function handleChatbotSend(e: React.FormEvent) {
    e.preventDefault();
    const chatbotInput = chatbotInputRef.current?.value;
    if (!chatbotInput?.trim()) return;
    
    // IMPORTANTE: Bloquear sugestões até receber resposta
    setSuggestionsBlocked(true);
    // Limpar sugestões antigas enquanto aguardamos nova resposta
    setChatSuggestions([]);
    
    // Adicionar mensagem do utilizador ao histórico de conversa
    conversation.push({ role: "user", content: chatbotInput });
    
    // Adicionar mensagem do utilizador
    setChatbotMessages(prev => {
      const next = [...prev, { from: 'user', text: chatbotInput, metadata: { fromChatbot: true } }];
      try { saveChatbotMessagesToStorage(guideSlug, next); } catch {}
      return next;
    });
    
    // Limpar input
    if (chatbotInputRef.current) {
      chatbotInputRef.current.value = "";
    }
    
    // Esconder div de boas-vindas em Android após primeira mensagem
    if (isAndroid && !androidWelcomeHidden) {
      setAndroidWelcomeHidden(true);
    }
    
    // Mostrar indicador de digitação
    setIsGuideThinking(true);
    setThinkingText(getInterfaceTexts().thinking1);
    setChatbotMessages(prev => {
      const next = [...prev, { from: 'bot', text: getInterfaceTexts().thinking1.toLowerCase(), metadata: { fromChatbot: true, isThinking: true } }];
      // não guardar placeholder "a pensar" no storage
      return next;
    });
    
    // Chamar API e atualizar resposta (substitui callOpenRouterAI)
    fetch('/api/ask', {
      method: 'POST',
      headers: ((): HeadersInit => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }))(),
      body: JSON.stringify({
        q: chatbotInput,
        opts: {
          history: conversation,
          system: getSystemPromptForChatWithHTML(chatbotInput),
          temperature: 0.7,
          verbosity: 'medium'
      },
      website: (guideVideos as any)?.websiteUrl || undefined
      })
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({} as any));
        const response = (data && (data.answer || data.output || data.text || data.message)) || '';
        const formattedResponse = ensureHtmlFromText(response);
        // Adicionar resposta do assistente ao histórico de conversa
        conversation.push({ role: "assistant", content: response });
        
        // Controlo de tamanho de histórico
        const MAX_MSG = 20; // janela deslizante (ajusta à vontade)
        if (conversation.length > MAX_MSG) {
          conversation.shift(); // remove a mais antiga
        }
        
        // Sumário automático (opcional)
        if (conversation.length >= 40) {
          getSummary(conversation, (guideVideos as any)?.websiteUrl || undefined).then(summary => {
            conversation.splice(0, conversation.length - 10, // mantém só 10 recentes
              { role: "assistant", content: `[RESUMO]\n${summary}` });
          });
        }
        
        // Guardar conversa no localStorage
        saveConversationToStorage(guideSlug);
        
        // Parar animação de carregamento
        setIsGuideThinking(false);
        
        // Remover indicador de digitação e adicionar resposta real
        setChatbotMessages(prev => {
          const newMessages = [...prev];
          // Substituir o último "estamos a preparar a resposta" pela resposta real
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].text === getInterfaceTexts().thinking1.toLowerCase()) {
            const { contentHtml, buttons } = extractButtonsFromHtml(formattedResponse);
            newMessages[newMessages.length - 1] = { from: 'bot', text: contentHtml, metadata: { fromChatbot: true, buttons } as any } as any;
          } else {
            const { contentHtml, buttons } = extractButtonsFromHtml(formattedResponse);
            newMessages.push({ from: 'bot', text: contentHtml, metadata: { fromChatbot: true, buttons } as any } as any);
          }
          try { saveChatbotMessagesToStorage(guideSlug, newMessages); } catch {}
          return newMessages;
        });
        
    // IMPORTANTE: Desbloquear sugestões após receber resposta
    setSuggestionsBlocked(false);
    
    // Gerar sugestões baseadas nas perguntas frequentes do guia
    generateChatSuggestions();
      })
      .catch(error => {
        console.error('Erro ao processar resposta:', error);
        // Parar animação de carregamento
        setIsGuideThinking(false);
        
        // Remover indicador de digitação e adicionar mensagem de erro
        setChatbotMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].text === getInterfaceTexts().thinking1.toLowerCase()) {
            newMessages[newMessages.length - 1] = { 
              from: 'bot', 
              text: getInterfaceTexts().generalError,
              metadata: { fromChatbot: true }
            };
          }
          try { saveChatbotMessagesToStorage(guideSlug, newMessages); } catch {}
          return newMessages;
        });
        
    // IMPORTANTE: Desbloquear sugestões mesmo em caso de erro
    setSuggestionsBlocked(false);
    // Limpar sugestões para evitar confusão pós-erro
    setChatSuggestions([]);
      });
  }

  function handleChatbotInputChange() {
    // Manter as instruções (glassmorphismBox) visíveis quando o utilizador começar a escrever
    // if (showInstructions) {
    //   setShowInstructions(false);
    // }
    // Removido: if (showChatbotWelcome) { setShowChatbotWelcome(false); }
    // O cabeçalho agora permanece visível mesmo quando se começa a escrever
  }

  
  // Função para validar email
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Função para validar telefone (formato internacional) - Commented out to fix ESLint warning
  /* function isValidPhone(phone: string): boolean {
    // Remove espaços, hífens e parênteses
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    // Valida números de telefone internacionais: + seguido de código do país e número, ou apenas números
    const phoneRegex = /^(\+\d{1,4})?[\d\s\-\(\)]{7,15}$/;
    return phoneRegex.test(cleanPhone);
  } */

  async function handleGuideFormSubmit(e: FormEvent) {
    e.preventDefault();
    
    // Validação básica
    if (!formName.trim() || !formContact.trim()) {
      setFormError(getInterfaceTexts().fillAllFields);
      return;
    }

    // Validação do contacto (apenas email)
    const contact = formContact.trim();
    if (!isValidEmail(contact)) {
      setFormError(getInterfaceTexts().validEmail);
      return;
    }
    
    setFormSubmitting(true);
    setFormError(null);
    
    try {
      // Se promoção ativa: apenas guardar contacto e mostrar popup "FUNCIONALIDADE EXTRA"
      if (isPromoMode) {
        await saveContactRequest({ name: formName, contact: formContact });
        setShowPromoPopup(true);
        setShowGuidePopup(false);
        setFormName('');
        setFormContact('');
        setFormSubmitting(false);
        
        // Pausar o vídeo quando o popup de promoção abrir
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.pause();
            setVideoPlaying(false);
          }
        }, 100);
        return;
      }
      // Enviar dados para o Firebase
      await saveContactRequest({
        name: formName,
        contact: formContact
      });
      
      // Verificar se existem mensagens do chatbot para transferir
      let initialMessages: ChatMessage[] = [
        {
          from: 'agent',
          text: formatMessage(getInterfaceTexts().realGuideWelcome, { 
            name: formName, 
            guide: getInterfaceTexts().talkToRealGuide.toLowerCase() 
          }),
          timestamp: new Date().toISOString(),
          read: false
        },
        {
          from: 'agent',
          text: `ℹ️ ${getInterfaceTexts().importantInfo}<br><br>⏱️ ${getInterfaceTexts().responseTimeInHours}<br><br>🕐 ${getInterfaceTexts().serviceHours}<br><br>⏰ ${getInterfaceTexts().responseTimeOutHours}<br><br><strong>${getInterfaceTexts().emailResponse}</strong>`,
          timestamp: new Date().toISOString(),
          read: false
        }
      ];
      
      // Verificar se há histórico de chatbot para transferir
      // Verificar se houve uma interação real (pelo menos uma mensagem do usuário e uma resposta do bot)
      const hasUserMessage = chatbotMessages.some(msg => msg.from === 'user' && msg.text.trim().length > 0);
      const hasBotResponse = chatbotMessages.some(msg => msg.from === 'bot' && msg.text.trim().length > 0 && msg.text !== 'estamos a preparar a resposta');
      
      if (hasUserMessage && hasBotResponse) {
        console.log('🔍 Encontrada interação real com o chatbot');
        // Converter as mensagens do chatbot para o formato do chat humano
        const chatbotHistoryMessages: ChatMessage[] = chatbotMessages.map(msg => ({
          from: (msg.from === 'user' ? 'user' : 'agent'),
          // Mensagens do bot vêm formatadas em HTML -> converter para texto simples para o backoffice
          text: msg.from === 'user' ? msg.text : htmlToPlainText(msg.text),
          timestamp: new Date().toISOString(),
          read: true,
          metadata: { fromChatbot: true, messageType: 'text' as const }
        }));
        
        // Adicionar ao início da conversa para manter a ordem cronológica
        initialMessages = [...chatbotHistoryMessages, ...initialMessages];
        
        // NÃO adicionar a mensagem de transição aqui - ela será adicionada dinamicamente
        // quando o gestor abrir a conversa no backoffice
      }
      
      // Criar conversa no Firebase virtualchat-b0e17 usando guideServices
      const conversationData = {
        guideSlug,
        projectId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID || 'virtualchat-b0e17',
        userId: `user_${Date.now()}`,
        userName: formName,
        userContact: formContact,
        userEmail: formContact,
        status: 'active' as const,
        priority: 'medium' as const,
        category: 'general' as const,
        messages: initialMessages.map(msg => {
          const base: any = {
            from: (msg.from === 'agent' ? 'guide' : 'user') as 'user' | 'guide',
            text: msg.text,
            timestamp: new Date(msg.timestamp),
            read: msg.read || false
          };
          const fromChatbot = Boolean((msg as any).metadata?.fromChatbot);
          const guideResponse = msg.from === 'agent';
          // Só adicionar metadata quando necessário para evitar undefined
          if (fromChatbot || guideResponse) {
            base.metadata = {
              guideResponse,
              messageType: 'text' as const,
              ...(fromChatbot ? { fromChatbot: true } : {})
            };
          }
          return base;
        })
      };

      const conversationId = await createGuideConversation('virtualchat-b0e17', conversationData);
      // Guardar apenas o ID da conversa para permitir encerramento no refresh/modal
      setCookie('chat_conversation_id', conversationId, 7);

      // Notificar início de chat humano por email
      try {
        await fetch('/api/send-human-chat-notification', {
          method: 'POST',
          headers: ((): HeadersInit => ({ 'Content-Type': 'application/json', ...(getAuthHeaders?.() || {}) }))(),
          body: JSON.stringify({
            guideSlug,
            conversationId,
            user: { name: formName, contact: formContact }
          })
        });
      } catch (err) {
        try { console.warn('Falha ao enviar notificação de chat humano:', err); } catch {}
      }
      
      // Resetar contador de entradas quando dados são preenchidos novamente
      setGuideChatEntryCount(1); // Primeira entrada com novos dados
      localStorage.setItem('guideChatEntryCount', '1');
      console.log('🔄 Contador de entradas resetado para 1 após preenchimento de dados');
      
      // Sucesso: resetar a flag, já validou novamente os dados
      setReturnedFromAiAfterHuman(false);
      setFormSubmitted(true);
      setFormName('');
      setFormContact('');
      
              // Fechar o popup do formulário e abrir o chat humano
        setTimeout(() => {
          setShowGuidePopup(false);
          // Em smartphone, restaurar sincronização de som conforme o estado antes do formulário
          if (!isDesktop) {
            // Usar o estado guardado ou manter unmuted por padrão
            const targetMuted = preFormMutedRef.current ?? false;
            console.log('🔊 Restaurando estado de som após formulário:', targetMuted, 'Estado guardado:', preFormMutedRef.current);
            
            try {
              // Primeiro restaurar o estado do vídeo principal
              if (videoRef.current) {
                videoRef.current.muted = targetMuted;
                videoRef.current.volume = targetMuted ? 0 : 1;
                console.log('🔊 Vídeo principal - muted:', videoRef.current.muted, 'volume:', videoRef.current.volume);
                
                // Garantir que o vídeo toca se não estiver em mute
                if (!targetMuted) {
                  maybePlay(videoRef.current).then((ok) => {
                    if (!ok) {
                      try { console.error('Erro ao iniciar vídeo principal'); } catch {}
                    }
                  });
                }
              }
              
              // Depois sincronizar o PiP com o mesmo estado
              if (pipVideoRef.current) {
                pipVideoRef.current.muted = targetMuted;
                pipVideoRef.current.volume = targetMuted ? 0 : 1;
                console.log('🔊 PiP - muted:', pipVideoRef.current.muted, 'volume:', pipVideoRef.current.volume);
                
                // Se o PiP estiver visível e o som estiver ativado, garantir que está a tocar
                if (pipVisible && !targetMuted) {
                  safePlay(pipVideoRef.current)
                    .then(() => console.log('🔊 PiP iniciado com sucesso'));
                }
              }
              
              // Atualizar estados do React
              setVideoPlaying(!targetMuted);
              setVideoMuted(targetMuted);
              setPipVideoPlaying(!targetMuted && pipVisible);
              
              // Só limpar a referência depois de tudo estar sincronizado
              setTimeout(() => {
                const oldState = preFormMutedRef.current;
                preFormMutedRef.current = null;
                console.log('🔊 Estado de som limpo. Anterior:', oldState, 'Atual video:', videoRef.current?.muted, 'Atual PiP:', pipVideoRef.current?.muted);
              }, 500); // Aumentado para 500ms para garantir sincronização
            } catch (error) {
              console.error('Erro ao restaurar estado de som:', error);
            }
          }
          setFormSubmitted(false);
          // Garantir que o chatbot AI seja fechado antes de abrir o chat humano
          if (showChatbotPopup) {
            setShowChatbotPopup(false);
          }
          // Impedir scroll quando o chat do guia real estiver aberto
          document.body.style.overflow = 'hidden';
          setShowHumanChat(true);
          setShowActionButtons(true); // Mostrar controladores quando chat humano abre
          setHasActiveSession(true);
          
          // Comportamento diferente para desktop e mobile quando o chat humano abre
          if (videoRef.current) {
            if (isDesktop) {
              // Desktop: Continuar o vídeo de onde está
              if (videoRef.current.paused) {
                maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
              }
            } else {
              // Mobile: Guardar o tempo atual para sincronização com PiP
                          const currentTime = videoRef.current.currentTime;
            setSavedVideoTime(currentTime);
              // Não pausar o vídeo principal aqui - deixar o useEffect do PiP gerenciar
            }
          }
        
        // Inicializar a conversa
        const initialConversation: Conversation = {
          id: conversationId,
          userId: `user_${Date.now()}`,
          userName: formName,
          userContact: formContact,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: initialMessages
        };
        
        setCurrentConversation(initialConversation);
        setHumanChatMessages(initialConversation.messages);
        
        // IMPORTANTE: Verificar se a conversa foi criada corretamente no Firebase antes de configurar o listener
        const verifyConversationExists = async () => {
          try {
            console.log('🔍 Verificando se conversa existe no Firebase:', conversationId);
            const existingConversation = await getGuideConversation('virtualchat-b0e17', conversationId);
            
            if (existingConversation) {
              console.log('✅ Conversa confirmada no Firebase, configurando listener...');
              setupConversationListener();
            } else {
              console.log('❌ Conversa não encontrada no Firebase, tentando novamente...');
              // Tentar novamente após 2 segundos
              setTimeout(verifyConversationExists, 2000);
            }
          } catch (error) {
            console.log('🔄 Erro ao verificar conversa, tentando novamente...', error);
            // Tentar novamente após 2 segundos
            setTimeout(verifyConversationExists, 2000);
          }
        };
        
        // Função para configurar o listener após verificação
        const setupConversationListener = () => {
          console.log('=== LISTENER 1 ATIVADO ===');
          unsubscribeRef.current = listenToGuideConversation('virtualchat-b0e17', conversationId, (conversation) => {
                      // Converter mensagens para o formato local
          const localMessages = conversation.messages.map(msg => ({
            id: msg.id,
            from: msg.from === 'guide' ? 'agent' : 'user',
            text: msg.text,
            timestamp: msg.timestamp ? (msg.timestamp as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
            read: msg.read || false,
            metadata: (msg.metadata || {}) as ExtendedChatMessage['metadata']
          }));
          
          // Fallback: inserir mensagem de transição se aplicável (sem duplicar) e posicionar após informações importantes
          try {
            const hasChatbotQuestion = (conversation as any).messages?.some((m: any) => m.from === 'user' && m.metadata?.fromChatbot === true && String(m.text || '').trim().length > 0);
            const hasChatbotAnswer = (conversation as any).messages?.some((m: any) => (m.from === 'guide' || m.from === 'agent') && m.metadata?.fromChatbot === true && String(m.text || '').trim().length > 0);
            const hasChatbotInteraction = Boolean(hasChatbotQuestion && hasChatbotAnswer);
            if (hasChatbotInteraction) {
              const transitionText = formatMessage(getInterfaceTexts().transitionMessage, { guide: getInterfaceTexts().talkToRealGuide.toLowerCase() });
              for (let i = localMessages.length - 1; i >= 0; i--) {
                const m = localMessages[i];
                if (m?.metadata?.isTransitionMessage === true || (typeof m?.text === 'string' && m.text.trim() === transitionText)) {
                  localMessages.splice(i, 1);
                }
              }
              const importantInfoIndex = localMessages.findIndex(m => typeof m.text === 'string' && m.text.includes(getInterfaceTexts().importantInfo));
              const firstAgentIndex = localMessages.findIndex(m => m.from === 'agent');
              const insertIndex = importantInfoIndex >= 0 ? importantInfoIndex + 1 : (firstAgentIndex >= 0 ? firstAgentIndex : localMessages.length);
              const transitionMessage: ExtendedChatMessage = {
                id: `transition_${Date.now()}`,
                from: 'agent',
                text: transitionText,
                timestamp: new Date().toISOString(),
                read: false,
                metadata: { isTransitionMessage: true, showWhenOpenedByGuide: true }
              };
              localMessages.splice(insertIndex, 0, transitionMessage);
            }
          } catch {}

          // IMPORTANTE: Preservar a mensagem de boas-vindas se ela existir
          const welcomeMessage = localMessages.find(msg => 
            msg.from === 'agent' && 
            msg.text.includes('Bem-vindo(a) de volta') && 
            msg.metadata?.guideResponse === true
          );
          
          // Se não houver mensagem de boas-vindas, adicionar uma
          if (!welcomeMessage && localMessages.length === 0) {
            localMessages.unshift({
              id: `welcome_${Date.now()}`,
              from: 'agent',
              text: getInterfaceTexts().realGuideWelcomeBack,
              timestamp: new Date().toISOString(),
              read: false,
              metadata: { guideResponse: true }
            });
          }
          
          setCurrentConversation({
            id: conversation.id,
            userId: conversation.userId,
            userName: conversation.userName,
            userContact: conversation.userContact,
            status: conversation.status === 'closed' ? 'closed' : 'active',
            createdAt: conversation.createdAt ? (conversation.createdAt as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
            updatedAt: conversation.updatedAt ? (conversation.updatedAt as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
            messages: localMessages as ExtendedChatMessage[]
          });
          setHumanChatMessages(localMessages as ExtendedChatMessage[]);
            
            // Verificar se a conversa foi encerrada pelo backoffice
            if (conversation.status === 'closed') {
              console.log('Conversa encerrada pelo backoffice - fechando chat e controlando vídeo');
              
              // IMPORTANTE: Verificar se esta conversa foi criada recentemente (evitar fechamento prematuro)
              const conversationAge = Date.now() - (conversation.createdAt ? (conversation.createdAt as any).toDate?.().getTime() || Date.now() : Date.now());
              const isRecentlyCreated = conversationAge < 30000; // 30 segundos
              
              if (isRecentlyCreated) {
                console.log('🆕 Conversa criada recentemente, ignorando status closed do backoffice');
                return; // Não fechar conversas recém-criadas
              }
              
              // Fechar o chat após alguns segundos
              setTimeout(() => {
                // Limpar listener
                if (unsubscribeRef.current) {
                  unsubscribeRef.current();
                  unsubscribeRef.current = null;
                }
                
                // Restaurar scroll
                // document.body.style.overflow = 'auto'; // Removido conforme pedido
                
                // Fechar chat e limpar estado
                setShowHumanChat(false);
                setCurrentConversation(null);
                setHumanChatMessages([]);
                setHumanChatInput('');
                setHasActiveSession(false);
                
                // Limpar apenas o ID da conversa, manter dados do utilizador em cache
                deleteCookie('chat_conversation_id');
                // NÃO limpar: chat_user_name e chat_user_contact (mantidos para cache)
              
              // Controlar vídeo baseado no dispositivo
              if (videoRef.current) {
                if (isDesktop) {
                  // PC: Parar vídeo
                  videoRef.current.pause();
                  setVideoPlaying(false);
                  console.log('PC: Vídeo pausado após conversa encerrada pelo backoffice');
                } else {
                  // Smartphone: Continuar vídeo onde estava
                  videoRef.current.muted = false;
                  setVideoMuted(false);
                  maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
                  console.log('Smartphone: Vídeo continuando após conversa encerrada pelo backoffice');
                }
              }
              
              // Fechar outros popups se estiverem abertos
              if (showGuidePopup) {
                setShowGuidePopup(false);
              }
              if (showChatbotPopup) {
                setShowChatbotPopup(false);
              }
              
              // Setar o estado de retorno ao AI após conversa com humano
              setReturnedFromAiAfterHuman(true);
            }, 3000); // Aguardar 3 segundos antes de fechar
            }
          });
        };
        
        // Iniciar verificação da conversa após 2 segundos
        setTimeout(verifyConversationExists, 2000);
        
        }); // Fechar o setTimeout do setShowGuidePopup
      } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      console.error('Detalhes completos do erro:', error);
      
      // Verificar se é um erro de permissão
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('Permission')) {
          setFormError('Erro de permissão. Verifique as regras de segurança do Firebase.');
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          setFormError('Erro de conexão. Verifique a sua ligação à internet.');
        } else {
          setFormError(`Erro: ${error.message}`);
        }
      } else {
        setFormError(getInterfaceTexts().formError);
      }
    } finally {
      setFormSubmitting(false);
    }
  }
  // Função para criar nova conversa com dados em cache
  async function handleGuideFormSubmitWithCachedData(formData: { name: string; contact: string }) {
    try {
      setIsCreatingNewConversation(true);
      setFormSubmitting(true);
      setFormError('');

      // Incluir histórico do chatbot se existir interação real
      let cachedInitialMessages: ChatMessage[] = [
        {
          from: 'agent',
          text: formatMessage(getInterfaceTexts().realGuideWelcomeBackWithName, { name: formData.name }),
          timestamp: new Date().toISOString(),
          read: false,
          metadata: { guideResponse: true }
        }
      ];

      const cachedHasUserMessage = chatbotMessages.some(msg => msg.from === 'user' && msg.text.trim().length > 0);
      const cachedHasBotResponse = chatbotMessages.some(msg => msg.from === 'bot' && msg.text.trim().length > 0 && msg.text !== 'estamos a preparar a resposta');
      if (cachedHasUserMessage && cachedHasBotResponse) {
        const chatbotHistoryMessages: ChatMessage[] = chatbotMessages.map(msg => ({
          from: (msg.from === 'user' ? 'user' : 'agent'),
          text: msg.from === 'user' ? msg.text : htmlToPlainText(msg.text),
          timestamp: new Date().toISOString(),
          read: true,
          metadata: { fromChatbot: true, messageType: 'text' as const }
        }));
        cachedInitialMessages = [...chatbotHistoryMessages, ...cachedInitialMessages];
      }

      const conversationData = {
        guideSlug,
        projectId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID || 'virtualchat-b0e17',
        userId: `user_${Date.now()}`,
        userName: formData.name,
        userContact: formData.contact,
        userEmail: formData.contact,
        status: 'active' as const,
        priority: 'medium' as const,
        category: 'general' as const,
        messages: cachedInitialMessages.map(msg => {
          const base: any = {
            from: (msg.from === 'agent' ? 'guide' : 'user') as 'user' | 'guide',
            text: msg.text,
            timestamp: new Date(msg.timestamp),
            read: msg.read || false
          };
          if (msg.metadata) {
            const meta: any = {};
            if (msg.metadata.guideResponse === true) meta.guideResponse = true;
            if (msg.metadata.fromChatbot === true) meta.fromChatbot = true;
            if (msg.metadata.messageType) meta.messageType = msg.metadata.messageType as 'text' | 'image' | 'file';
            if (Object.keys(meta).length > 0) base.metadata = meta;
          }
          return base;
        })
      };

      const conversationId = await createGuideConversation('virtualchat-b0e17', conversationData);
      
      console.log('🆔 ID da conversa criada:', conversationId);
      console.log('📊 Dados da conversa criada:', conversationData);
      
      // Verificar se a conversa foi criada corretamente
      if (!conversationId) {
        throw new Error('Falha ao criar conversa: ID não foi retornado');
      }
      
      // Salvar dados da sessão em cookies (os dados do utilizador já estão em cache)
      setCookie('chat_conversation_id', conversationId, 7);
      
      console.log('✅ Nova conversa criada automaticamente com dados em cache:', conversationId);
      
      // Abrir o chat humano diretamente
      setShowHumanChat(true);
      setShowActionButtons(true);
      setHasActiveSession(true);
      
      // Controlar vídeo baseado no dispositivo
      if (videoRef.current) {
        if (isDesktop) {
          // Desktop: Continuar o vídeo de onde está
          if (videoRef.current.paused) {
            maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
          }
        } else {
          // Mobile: Guardar o tempo atual para sincronização com PiP
          const currentTime = videoRef.current.currentTime;
          setSavedVideoTime(currentTime);
          // Pausar o vídeo principal imediatamente para evitar reprodução dupla
          videoRef.current.pause();
          setVideoPlaying(false);
        }
      }
      
      // Inicializar a conversa com as mensagens usadas na criação (para UI local)
      const initialMessages: ChatMessage[] = cachedInitialMessages.map(m => ({
        ...m,
        metadata: m.metadata ? { ...m.metadata, messageType: 'text' as const } : undefined
      }));

      const initialConversation: Conversation = {
        id: conversationId,
        userId: `user_${Date.now()}`,
        userName: formData.name,
        userContact: formData.contact,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: initialMessages
      };
      
      setCurrentConversation(initialConversation);
      setHumanChatMessages(initialMessages);
      
      // IMPORTANTE: Verificar se a conversa foi criada corretamente no Firebase antes de configurar o listener
      const verifyConversationExists = async () => {
        try {
          console.log('🔍 Verificando se conversa existe no Firebase:', conversationId);
          const existingConversation = await getGuideConversation('virtualchat-b0e17', conversationId);
          
          if (existingConversation) {
            console.log('✅ Conversa confirmada no Firebase, configurando listener...');
            setupConversationListener();
          } else {
            console.log('❌ Conversa não encontrada no Firebase, tentando novamente...');
            // Tentar novamente após 2 segundos
            setTimeout(verifyConversationExists, 2000);
          }
        } catch (error) {
          console.log('🔄 Erro ao verificar conversa, tentando novamente...', error);
          // Tentar novamente após 2 segundos
          setTimeout(verifyConversationExists, 2000);
        }
      };
      
      // Função para configurar o listener após verificação
      const setupConversationListener = () => {
        console.log('⏰ Configurando listener para conversa:', conversationId);
        
        // IMPORTANTE: Verificar se ainda estamos a criar a conversa (evitar conflitos)
        if (!isCreatingNewConversation) {
          console.log('⚠️ Conversa não está mais a ser criada, cancelando configuração do listener');
          return;
        }
        
        // Limpar qualquer listener existente antes de configurar um novo
        if (unsubscribeRef.current) {
          console.log('🧹 Limpando listener existente antes de configurar novo');
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        // Configurar listener em tempo real para a nova conversa
        unsubscribeRef.current = listenToGuideConversation('virtualchat-b0e17', conversationId, (conversation) => {
        console.log('🔄 Listener recebeu atualização da conversa:', conversation);
        console.log('🔄 Status da conversa:', conversation.status);
        
        // Limpar flag de criação após primeira atualização
        if (isCreatingNewConversation) {
          console.log('✅ Conversa criada e atualizada com sucesso, limpando flag');
          setIsCreatingNewConversation(false);
        }
        
        const localMessages = conversation.messages.map(msg => ({
          id: msg.id,
          from: msg.from === 'guide' ? 'agent' : 'user',
          text: msg.text,
          timestamp: msg.timestamp ? (msg.timestamp as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
          read: msg.read || false,
          metadata: (msg.metadata || {}) as ExtendedChatMessage['metadata']
        }));
        
        // Fallback: inserir mensagem de transição se aplicável (sem duplicar) e posicionar após informações importantes
        try {
          const hasChatbotQuestion = (conversation as any).messages?.some((m: any) => m.from === 'user' && m.metadata?.fromChatbot === true && String(m.text || '').trim().length > 0);
          const hasChatbotAnswer = (conversation as any).messages?.some((m: any) => (m.from === 'guide' || m.from === 'agent') && m.metadata?.fromChatbot === true && String(m.text || '').trim().length > 0);
          const hasChatbotInteraction = Boolean(hasChatbotQuestion && hasChatbotAnswer);
          if (hasChatbotInteraction) {
            const transitionText = formatMessage(getInterfaceTexts().transitionMessage, { guide: getInterfaceTexts().talkToRealGuide.toLowerCase() });
            for (let i = localMessages.length - 1; i >= 0; i--) {
              const m = localMessages[i];
              if (m?.metadata?.isTransitionMessage === true || (typeof m?.text === 'string' && m.text.trim() === transitionText)) {
                localMessages.splice(i, 1);
              }
            }
            const importantInfoIndex = localMessages.findIndex(m => typeof m.text === 'string' && m.text.includes(getInterfaceTexts().importantInfo));
            const firstAgentIndex = localMessages.findIndex(m => m.from === 'agent');
            const insertIndex = importantInfoIndex >= 0 ? importantInfoIndex + 1 : (firstAgentIndex >= 0 ? firstAgentIndex : localMessages.length);
            const transitionMessage: ExtendedChatMessage = {
              id: `transition_${Date.now()}`,
              from: 'agent',
              text: transitionText,
              timestamp: new Date().toISOString(),
              read: false,
              metadata: { isTransitionMessage: true, showWhenOpenedByGuide: true }
            };
            localMessages.splice(insertIndex, 0, transitionMessage);
          }
        } catch {}

        // IMPORTANTE: Preservar a mensagem de boas-vindas se ela existir
        const welcomeMessage = localMessages.find(msg => 
          msg.from === 'agent' && 
          msg.text.includes('Bem-vindo(a) de volta') && 
          msg.metadata?.guideResponse === true
        );
        
        // Se não houver mensagem de boas-vindas, adicionar uma
        if (!welcomeMessage && localMessages.length === 0) {
          localMessages.unshift({
            id: `welcome_${Date.now()}`,
            from: 'agent',
            text: getInterfaceTexts().realGuideWelcomeBack,
            timestamp: new Date().toISOString(),
            read: false,
            metadata: { guideResponse: true }
          });
        }
        
        setCurrentConversation({
          id: conversation.id,
          userId: conversation.userId,
          userName: conversation.userName,
          userContact: conversation.userContact,
          status: conversation.status === 'closed' ? 'closed' : 'active',
          createdAt: conversation.createdAt ? (conversation.createdAt as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
          updatedAt: conversation.updatedAt ? (conversation.updatedAt as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
          messages: localMessages as ChatMessage[]
        });
        setHumanChatMessages(localMessages as ChatMessage[]);
        
        // Verificar se a conversa foi encerrada pelo backoffice
        if (conversation.status === 'closed') {
          console.log('⚠️ Conversa encerrada pelo backoffice - fechando chat');
          
          // IMPORTANTE: Verificar se esta conversa foi criada recentemente (evitar fechamento prematuro)
          const conversationAge = Date.now() - (conversation.createdAt ? (conversation.createdAt as any).toDate?.().getTime() || Date.now() : Date.now());
          const isRecentlyCreated = conversationAge < 30000; // 30 segundos
          
          if (isRecentlyCreated) {
            console.log('🆕 Conversa criada recentemente, ignorando status closed do backoffice');
            return; // Não fechar conversas recém-criadas
          }
          
          setTimeout(() => {
            if (unsubscribeRef.current) {
              unsubscribeRef.current();
              unsubscribeRef.current = null;
            }
            // document.body.style.overflow = 'auto'; // Removido conforme pedido
            setShowHumanChat(false);
            setCurrentConversation(null);
            setHumanChatMessages([]);
            setHumanChatInput('');
            setHasActiveSession(false);
            deleteCookie('chat_conversation_id');
          }, 3000);
        } else if (conversation.status === 'active') {
          console.log('✅ Conversa ativa - mantendo chat aberto');
        }
      });
      };
      
      // Iniciar verificação da conversa
      verifyConversationExists();
      
      // Marcar que a criação da conversa foi concluída
      setIsCreatingNewConversation(false);
      
    } catch (error) {
      console.error('Erro ao criar conversa com dados em cache:', error);
      // Em caso de erro, mostrar popup para preencher dados novamente
      setShowGuidePopup(true);
    } finally {
      setFormSubmitting(false);
      setIsCreatingNewConversation(false);
    }
  }

  // Funções para o chat humano
  function handleHumanChatClose() {
    // Mostrar popup de confirmação
    setShowCloseConfirmation(true);
  }
  async function handleConfirmClose() {
    try {
      // Obter o ID da conversa atual do cookie
      const conversationId = getCookie('chat_conversation_id');
      
      // IMPORTANTE: Aguardar um momento para garantir que não há criação de nova conversa em andamento
      if (isCreatingNewConversation) {
        console.log('⏳ Aguardando criação de nova conversa antes de encerrar...');
        return; // Não encerrar se estiver a criar nova conversa
      }
      
      // Se existir uma conversa ativa (não marcada como CLOSED), marcá-la como fechada no Firebase
      if (conversationId && conversationId !== 'CLOSED') {
        await closeGuideConversation('virtualchat-b0e17', conversationId, 'user', 'Fechada pelo utilizador', selectedLanguage);
      }
      
      // Limpar listener em tempo real (não limpar cache de identidade)
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      // Restaurar o scroll quando o chat do guia real for fechado
      // document.body.style.overflow = 'auto'; // Removido conforme pedido
      // No Android, forçar um reflow para garantir que o scroll seja restaurado
      if (/android/i.test(navigator.userAgent)) {
        void document.body.offsetHeight; // Trigger reflow
      }
      
      // Fechar o chat e limpar estados
      setShowHumanChat(false);
      // Em desktop, manter preferHold ativo para evitar que o vídeo principal apareça
      if (isDesktop) {
        setPreferHold(true);
        // Não resetar preferHold automaticamente - será resetado quando necessário
      }
      setCurrentConversation(null);
      setHumanChatMessages([]);
      setHumanChatInput('');
      setHasActiveSession(false);
      
      // Fechar popup de confirmação
      setShowCloseConfirmation(false);
      
      // Garantir que o popup do guia também seja fechado se estiver aberto
      if (showGuidePopup) {
        setShowGuidePopup(false);
      }
      
      // Ao fechar o chat humano:
      // - Em desktop: voltar ao chatbot AI
      // - Em mobile/tablet: voltar à página com o vídeo principal (sem AI)
      if (isDesktop) {
        setShowChatbotPopup(true);
      } else {
        setShowChatbotPopup(false);
        setShowStartButton(false);
        setPreferHold(false);
        // Mobile/Tablet: retomar imediatamente o vídeo principal
        try {
          if (videoRef.current) {
            // Marcar gesto do utilizador e intenção de play (iOS)
            try { lastUserGestureAtRef.current = Date.now(); desiredStateRef.current = 'playing'; } catch {}
            videoRef.current.muted = videoMuted;
            maybePlay(videoRef.current).then((ok) => {
              if (ok) { setVideoPlaying(true); return; }
              try { videoRef.current!.play().then(() => setVideoPlaying(true)).catch(() => {}); } catch {}
            });
          }
        } catch {}
      }
      
      // IMPORTANTE: Manter os dados do utilizador em cache (não limpar chat_user_name e chat_user_contact)
      // Limpar apenas o ID da conversa para evitar estados inválidos e reabrir sem formulário
      deleteCookie('chat_conversation_id');
      console.log('🏁 ID da conversa removido; identidade do utilizador mantida');
      // NÃO limpar: chat_user_name e chat_user_contact (mantidos para cache)
      
      // Comportamento diferente para desktop e mobile ao fechar chat humano
      if (videoRef.current) {
        if (isDesktop) {
          // Desktop: Retomar vídeo principal ao regressar ao chat com IA
          maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
          
          // NO PC: Voltar ao estado inicial (não welcome overlay) quando o chat for fechado
          // Isso mostra a barra de pesquisa + "Falar com guia real"
          setShowStartButton(false);
        } else {
          // Mobile: Continuar vídeo automaticamente com som
          videoRef.current.muted = videoMuted; // Respeitar preferência salva
          setVideoMuted(videoMuted);
          maybePlay(videoRef.current).then((ok) => { if (ok) setVideoPlaying(true); });
        }
      }
    } catch (error) {
      console.error('Erro ao encerrar conversa:', error);
      // Mesmo com erro, fechar o chat e limpar estados (preserva cache de identidade)
      setShowHumanChat(false);
      setCurrentConversation(null);
      setHumanChatMessages([]);
      setHumanChatInput('');
      setHasActiveSession(false);
      setShowCloseConfirmation(false);
      
      // IMPORTANTE: Manter os dados do utilizador em cache mesmo em caso de erro
      // Limpar apenas o ID da conversa para evitar estados inválidos
      deleteCookie('chat_conversation_id');
      console.log('🏁 ID da conversa removido (erro); identidade do utilizador mantida');
      // NÃO limpar: chat_user_name e chat_user_contact (mantidos para cache)
      
      // Em caso de erro, também voltar ao estado inicial no desktop
      if (isDesktop) {
        setShowStartButton(false);
      }
    }
  }

  function handleCancelClose() {
    setShowCloseConfirmation(false);
  }

  async function handleHumanChatSend(e: React.FormEvent) {
    e.preventDefault();
    
    if (!humanChatInput.trim() || !currentConversation?.id) return;
    
    const userMessage: ChatMessage = {
      from: 'user',
      text: humanChatInput.trim(),
      timestamp: new Date().toISOString(),
      read: false
    };
    
    setHumanChatSubmitting(true);
    
    try {
      // Adicionar mensagem do utilizador
      const updatedMessages = [...humanChatMessages, userMessage];
      setHumanChatMessages(updatedMessages);
      setHumanChatInput('');
      
      // Enviar para o Firebase virtualchat-b0e17 usando guideServices
      await sendGuideMessage('virtualchat-b0e17', currentConversation.id, {
        from: 'user',
        text: userMessage.text,
        metadata: { guideResponse: false }
      });
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setHumanChatSubmitting(false);
    }
  }
  function handleHumanChatInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setHumanChatInput(e.target.value);
  }

  // Handlers para as bandeiras
  function handleFlagClick(country: string) {
    // Mapear país -> idioma ISO
    const map: Record<string, 'pt' | 'en' | 'es' | 'fr'> = {
      portugal: 'pt',
      england: 'en',
      spain: 'es',
      france: 'fr'
    };
    const lang = map[country] || 'pt';
    try {
      localStorage.setItem('selectedLanguage', lang);
    } catch {}
    // Atualizar estado local para provocar re-render
    setSelectedLanguage(lang);

    // Limpar cache do chat com IA ao mudar de língua
    try {
      const convKey = `chatbot_conversation_${String(guideSlug || 'default')}`;
      const msgsKey = `chatbot_messages_${String(guideSlug || 'default')}`;
      localStorage.removeItem(convKey);
      localStorage.removeItem(msgsKey);
    } catch {}
    try {
      // Limpar memória em runtime
      conversation.length = 0;
    } catch {}
    try {
      setChatbotMessages([]);
      setShowChatbotWelcome(true);
      setShowInstructions(true);
      setHasVisitedAiChat(false);
      setCommercialButtonsShown(false); // Reset dos botões comerciais
    } catch {}
  }

  // Função utilitária para formatar timestamps do Firestore
  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'Agora';
    
    try {
      let date: Date;
      
      // Verificar se é um timestamp do Firestore
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      }
      // Verificar se é um timestamp do Firestore com toMillis
      else if (timestamp && typeof timestamp.toMillis === 'function') {
        date = new Date(timestamp.toMillis());
      }
      // Verificar se já é uma instância de Date
      else if (timestamp instanceof Date) {
        date = timestamp;
      }
      // Verificar se é um número (timestamp em milissegundos)
      else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      }
      // Verificar se é uma string ISO
      else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      }
      // Fallback para timestamp atual
      else {
        date = new Date();
      }
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return 'Agora';
      }
      
      return date.toLocaleTimeString('pt-PT', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Erro ao formatar timestamp:', error, timestamp);
      return 'Agora';
    }
  };

  // Restaurar conteúdo (FAQs, contactos) apenas DEPOIS do utilizador iniciar
  // Antes de clicar em "Iniciar conversa", manter escondido (mostrar só bandeiras e vídeo)
  useEffect(() => {
    if (!showGuidePopup && !showChatbotPopup && !showHumanChat) {
      setShowActionButtons(!showStartButton);
    }
  }, [showGuidePopup, showChatbotPopup, showHumanChat, showStartButton]);
  return (
    <>
      {/* Orientation Warning */}
      <OrientationWarning />
      
      {/* Loading Screen */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContent}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              {(() => {
                const src = (guideVideos?.companyIconURL as string) || "/Icon Virtualguide.svg";
                if (src.startsWith('http')) {
                  // eslint-disable-next-line @next/next/no-img-element
                  return <img src={src} alt="Ícone da Empresa" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />;
                }
                return <Image src={src} alt="Ícone da Empresa" width={80} height={80} style={{ borderRadius: '50%' }} />;
              })()}
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
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner}></div>
            </div>
          </div>
        </div>
      )}
      <div className={`${styles.bgVideoContainer} ${showChatbotPopup ? styles.chatbotOpen : ''} ${showHumanChat ? styles.humanChatOpen : ''}`}>
        {/* Barra de bandeiras no topo */}
        <div className={styles.flagsBar}>
          <div className={styles.flagsContainer}>
            {/* Botão de voltar para chat - aparece quando há conversa no chat com AI e não há chats abertos */}
            {chatbotMessages.length > 0 && !showChatbotPopup && !showHumanChat && (
              <button 
                className={styles.backToChatButton}
                onClick={async () => {
                  if (isDesktop) {
                    // Desktop: sair da welcome, garantir som e reproduzir o vídeo principal
                    setShowStartButton(false);
                    setVideoMuted(false);
                    setShowChatbotPopup(true);
                    const attemptPlay = (el?: HTMLVideoElement | null) => {
                      if (!el) return;
                      try { lastUserGestureAtRef.current = Date.now(); desiredStateRef.current = 'playing'; } catch {}
                      const prime = (el as any).primeForPlay?.();
                      const afterPrime = prime && typeof prime.then === 'function' ? prime.catch(() => false) : Promise.resolve(false);
                      afterPrime.finally(() => {
                        try { el.muted = false; el.volume = 1; } catch {}
                        maybePlay(el).then((ok) => {
                          if (ok) { setVideoPlaying(true); return; }
                          try { el.play().then(() => { setVideoPlaying(true); }).catch(() => {}); } catch {}
                        });
                      });
                    };
                    // Tentar imediatamente e novamente após render para apanhar o vídeo principal montado
                    attemptPlay(videoRef.current);
                    setTimeout(() => attemptPlay(videoRef.current), 150);
                    setTimeout(() => attemptPlay(videoRef.current), 500);
                  } else {
                    // Mobile/Tablet: manter comportamento anterior (abrir chat e pausar vídeo principal)
                    setShowChatbotPopup(true);
                    if (videoRef.current) {
                      try { videoRef.current.pause(); } catch {}
                      setVideoPlaying(false);
                    }
                  }
                }}
                title={getInterfaceTexts().backToChat}
                aria-label={getInterfaceTexts().backToChat}
              >
                <span className={styles.buttonText}>{getInterfaceTexts().backToChat.toLowerCase()}</span>
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

        {/* Vídeo de fundo quando o vídeo principal não está em reprodução */}
        {(!isDesktop || (isDesktop && !showChatbotPopup && !showHumanChat)) && (
          <video
            ref={bgVideoRef}
            className={styles.backgroundImage}
            src={toStreamUrl(
              // Usar vídeo específico para mobile/tablet se existir e for mobile/tablet, senão usar o vídeo principal
              (isMobile || isTablet) && guideVideos?.mobileTabletBackgroundVideoURL 
                ? guideVideos.mobileTabletBackgroundVideoURL 
                : guideVideos?.backgroundVideoURL,
              guideVideos?.videoProvider,
              true // Forçar 720p para vídeo de background (otimização)
            ) || "/Judite_2.mp4"}
            onError={(e) => {
              const currentVideoURL = (isMobile || isTablet) && guideVideos?.mobileTabletBackgroundVideoURL 
                ? guideVideos.mobileTabletBackgroundVideoURL 
                : guideVideos?.backgroundVideoURL;
              const video = e.currentTarget;
              console.error('❌ Erro ao carregar vídeo de fundo:', {
                originalURL: currentVideoURL,
                processedSrc: video.src,
                videoProvider: guideVideos?.videoProvider,
                error: e
              });
              
              // Se for Bunny Stream, tentar fallback de resolução
              if (guideVideos?.videoProvider === 'bunny' || (currentVideoURL && (currentVideoURL.includes('b-cdn.net') || currentVideoURL.includes('bunnycdn.com')))) {
                const handled = tryBunnyResolutionFallback(video);
                if (handled) return;
              }
              
              if (currentVideoURL && !String(video.src).includes('/vg-video/')) {
                try {
                  const u = new URL(currentVideoURL, window.location.origin);
                  if (u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') {
                    video.src = `https://visitfoods.pt/vg-video/?file=${encodeURIComponent(u.pathname)}`;
                    console.log('🔄 Usando proxy local para vídeo de fundo:', video.src);
                    return;
                  }
                } catch {}
              }
              if (currentVideoURL && !currentVideoURL.startsWith('http')) {
                video.src = `${window.location.origin}${currentVideoURL}`;
                console.log('🔄 Tentando carregar com caminho absoluto:', video.src);
              }
              // Marcar como "pronto" para não bloquear o loader
              setBgVideoError(true);
              setBgVideoReady(true);
              setBgProgress(100);
            }}
            autoPlay
            loop
            muted
            playsInline
            crossOrigin="anonymous"
            preload={isSlowNetwork ? 'metadata' : 'auto'}
            style={{
              objectFit: 'cover',
              objectPosition: 'center 15px'
            }}
          />
        )}

        {/* Vídeo principal - só mostrar quando não está na welcome page */}
        {!showStartButton && (
          <MobileOptimizedVideo
            ref={videoRef}
            className={styles.bgVideo}
            src={(function(){
              const computed = toStreamUrl(guideVideos?.welcomeVideoURL, guideVideos?.videoProvider) || "";
              try { console.debug('[Video principal] src calculado:', computed, 'original:', guideVideos?.welcomeVideoURL); } catch {}
              return computed || "/VirtualGuide_PortugaldosPequeninos.webm";
            })()}
            resumeTime={lastKnownTimeRef.current}
            preload={videoOptimization.recommendedPreload}
            onLoadedMetadata={() => {
              try {
                const v = videoRef.current as HTMLVideoElement | null;
                if (v && v.textTracks) {
                  for (let i = 0; i < v.textTracks.length; i++) {
                    v.textTracks[i].mode = 'showing';
                  }
                }
              } catch {}
              setMainVideoLoaded(true);
              setMainVideoLoading(false);
              setMainVideoProgress(100);
            }}
            onCanPlayThrough={() => { setMainVideoLoaded(true); setMainVideoLoading(false); setMainVideoProgress(100); }}
            onPlay={() => {
              setVideoPlaying(true);
              setPreferHold(false);
              try {
                const v = videoRef.current as HTMLVideoElement | null;
                if (v && v.textTracks) {
                  for (let i = 0; i < v.textTracks.length; i++) {
                    v.textTracks[i].mode = 'showing';
                  }
                }
              } catch {}
            }}
            onPause={() => setVideoPlaying(false)}
            onError={(e: any) => {
              setMainVideoError(true);
              setMainVideoLoading(false);
              console.error('❌ Erro ao carregar vídeo principal:', e);
              console.log('🔍 URL do vídeo principal:', guideVideos?.welcomeVideoURL);
              const video = e.currentTarget;
              
              // Se for Bunny Stream, tentar fallback de resolução
              if (guideVideos?.videoProvider === 'bunny' || (guideVideos?.welcomeVideoURL && (guideVideos.welcomeVideoURL.includes('b-cdn.net') || guideVideos.welcomeVideoURL.includes('bunnycdn.com')))) {
                const handled = tryBunnyResolutionFallback(video);
                if (handled) {
                  setMainVideoError(false);
                  setMainVideoLoading(true);
                  return;
                }
              }
              
              if (guideVideos?.welcomeVideoURL && !String(video.src).includes('/vg-video/')) {
                try {
                  const u = new URL(guideVideos.welcomeVideoURL, window.location.origin);
                  if (u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') {
                    video.src = `https://visitfoods.pt/vg-video/?file=${encodeURIComponent(u.pathname)}`;
                    console.log('🔄 Usando proxy local para vídeo principal:', video.src);
                    return;
                  }
                } catch {}
              }
              if (guideVideos?.welcomeVideoURL && !guideVideos.welcomeVideoURL.startsWith('http')) {
                video.src = `${window.location.origin}${guideVideos.welcomeVideoURL}`;
                console.log('🔄 Tentando carregar com caminho absoluto:', video.src);
                return;
              }
              // Fallback final para evitar ecrã preto
              video.src = "/VirtualGuide_PortugaldosPequeninos.webm";
              console.log('🟡 Fallback local para vídeo principal');
            }}
            autoPlay
            loop
            muted={videoMuted}
            playsInline
            crossOrigin="anonymous"
          >
            {(() => {
              const captions = (() => {
                const byLang = (guideVideos as any)?.captionsByLang as Record<string, { desktop?: string | null; tablet?: string | null; mobile?: string | null } | undefined> | undefined;
                const base = (guideVideos as any)?.captions as { desktop?: string | null; tablet?: string | null; mobile?: string | null } | undefined;
                if (byLang && byLang[selectedLanguage]) return byLang[selectedLanguage] || base;
                return base;
              })();
              // Gerar SEMPRE URLs do FTP (directas para /public/guides/<slug>/...)
              const buildFtpUrl = (fallbackPath: string) => fallbackPath;
              // Ignorar quaisquer URLs que contenham Cloudflare/videodelivery e preferir sempre FTP
              const safe = (value: string | null | undefined, fallback: string) => {
                const v = (value || '').trim();
                if (!v) return buildFtpUrl(fallback);
                if (/videodelivery\.net|iframe\.videodelivery\.net|cloudflare/i.test(v)) return buildFtpUrl(fallback);
                try {
                  const u = new URL(v, window.location.origin);
                  // Se já for mesma origem, devolver pathname; senão, usar proxy apenas para permitir CORS
                  const isSame = u.origin === window.location.origin;
                  return isSame ? (u.pathname + u.search) : `/api/captions?src=${encodeURIComponent(u.toString())}`;
                } catch {
                  // Se for caminho relativo, manter
                  return buildFtpUrl(v);
                }
              };
              const desktopSrc = safe(captions?.desktop, `/guides/${guideSlug}/captions_desktop.vtt`);
              const tabletSrc = safe(captions?.tablet, `/guides/${guideSlug}/captions_tablet.vtt`);
              const mobileSrc = safe(captions?.mobile, `/guides/${guideSlug}/captions_mobile.vtt`);
              if (isTablet) {
                return <track default kind="subtitles" src={tabletSrc} srcLang="pt" label="Português" />;
              }
              if (!isDesktop) {
                return <track default kind="subtitles" src={mobileSrc} srcLang="pt" label="Português" />;
              }
              return <track default kind="subtitles" src={desktopSrc} srcLang="pt" label="Português" />;
            })()}
          </MobileOptimizedVideo>
        )}

        {/* Loader do vídeo principal removido conforme pedido */}

        
        
        {/* Nova interface de boas-vindas */}
        {showStartButton && (
          <div className={styles.welcomeOverlay}>
            {/* Vídeo de fundo da welcome page */}
            <MobileOptimizedVideo
              ref={welcomeBgVideoRef}
              className={styles.welcomeBackgroundVideo}
              src={toStreamUrl(
                // Usar vídeo específico para mobile/tablet se existir e for mobile/tablet, senão usar o vídeo principal
                (isMobile || isTablet) && guideVideos?.mobileTabletBackgroundVideoURL 
                  ? guideVideos.mobileTabletBackgroundVideoURL 
                  : guideVideos?.backgroundVideoURL,
                guideVideos?.videoProvider,
                true // Forçar 720p para vídeo de background (otimização)
              ) || "/Judite_2.mp4"}
              autoPlay
              loop
              muted
              playsInline
              crossOrigin="anonymous"
                          preload={videoOptimization.recommendedPreload}
            onError={(e: any) => {
                const video = e.currentTarget;
                const currentVideoURL = (isMobile || isTablet) && guideVideos?.mobileTabletBackgroundVideoURL 
                  ? guideVideos.mobileTabletBackgroundVideoURL 
                  : guideVideos?.backgroundVideoURL;
                console.error('❌ Erro ao carregar vídeo de fundo (welcome):', {
                  originalURL: currentVideoURL,
                  processedSrc: video.src,
                  videoProvider: guideVideos?.videoProvider,
                  error: e
                });
                
                // Se for Bunny Stream, tentar fallback de resolução
                if (guideVideos?.videoProvider === 'bunny' || (currentVideoURL && (currentVideoURL.includes('b-cdn.net') || currentVideoURL.includes('bunnycdn.com')))) {
                  const handled = tryBunnyResolutionFallback(video);
                  if (handled) return;
                }
                
                if (currentVideoURL && !String(video.src).includes('/vg-video/')) {
                  try {
                    const u = new URL(currentVideoURL, window.location.origin);
                    if (u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') {
                      video.src = `https://visitfoods.pt/vg-video/?file=${encodeURIComponent(u.pathname)}`;
                      console.log('🔄 Proxy para welcome bg video:', video.src);
                      return;
                    }
                  } catch {}
                }
                if (currentVideoURL && !currentVideoURL.startsWith('http')) {
                  video.src = `${window.location.origin}${currentVideoURL}`;
                } else {
                  video.src = "/Judite_2.mp4";
                }
                // Não bloquear loader em erro
                setWelcomeBgError(true);
                setWelcomeBgReady(true);
                setWelcomeBgProgress(100);
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 15px',
                zIndex: -1
              }}
            />
            <div className={styles.startExperienceContainer}>
              <button
                className={styles.startExperienceButton}
                onClick={handleTalkToMe}
                aria-label={getInterfaceTexts().startConversationAria}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 6L3 2V10L10 6Z" fill="#ffffff"/>
                  </svg>
                </span>
                <span>{getInterfaceTexts().startConversation}</span>
              </button>
            </div>

          </div>
        )}

        {/* Barra de Pesquisa - mostrar quando não está na welcome page e chats fechados */}
        {!showStartButton && !showChatbotPopup && !showHumanChat && !showGuidePopup && (
          <div className={`${styles.glassmorphismControlBar} ${styles['page-module___8aEwW__glassmorphismControlBar']}`}>
            <div className={styles.searchInputContainer}>
              <div className={`${styles.searchInputWrapper} ${(!isDesktop && chatbotMessages.length > 0) ? styles.searchInputWrapperPulse : ''}`}>
                <svg className={styles.chatInputIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12 C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 12H16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 8H13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 16H11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input 
                  type="text"
                  className={styles.searchInput}
                  placeholder={!isDesktop && chatbotMessages.length > 0 ? getInterfaceTexts().backToChat : getInterfaceTexts().searchPlaceholder}
                  onClick={handleSearchBarClick}
                  readOnly
                />
                <button className={styles.searchButton} onClick={(e) => {
                  if (!isDesktop && pipVideoRef.current && videoRef.current) {
                    try {
                      // Pausar o vídeo principal IMEDIATAMENTE
                      videoRef.current.pause();
                      setVideoPlaying(false);
                      
                      // Sincronizar tempo e preparar PiP
                      const time = videoRef.current.currentTime || 0;
                      pipVideoRef.current.currentTime = time;
                      
                      // Preservar preferência de som original
                      // Primeiro configurar o volume para garantir que o áudio esteja corretamente configurado
                      pipVideoRef.current.volume = videoMuted ? 0 : 1;
                      // Depois configurar o mute
                      pipVideoRef.current.muted = videoMuted;
                      
                      // PLAY SÍNCRONO - crucial para Android
                      const playPromise = safePlay(pipVideoRef.current);
                      
                      // Após iniciar com sucesso
                      playPromise.then(() => {
                        setPipVideoPlaying(true);
                        // Garantir que o som está conforme a preferência do usuário
                        try { 
                          pipVideoRef.current!.volume = videoMuted ? 0 : 1;
                          pipVideoRef.current!.muted = videoMuted; 
                        } catch {}
                      }).catch(err => {
                        console.error('Erro no PiP:', err);
                        // Tentar novamente com mute (política de autoplay)
                        try {
                          pipVideoRef.current!.muted = true;
                          safePlay(pipVideoRef.current!).then(() => {
                            setPipVideoPlaying(true);
                            // Restaurar som após iniciar, se necessário
                            if (!videoMuted) {
                              setTimeout(() => {
                                try { pipVideoRef.current!.muted = false; } catch {}
                              }, 100);
                            }
                          });
                        } catch {}
                      });
                    } catch (err) {
                      console.error('Erro ao preparar PiP:', err);
                    }
                  }
                  handleSearchBarClick();
                }}>
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barra branca de largura total para abrir chat real - mostrar quando não está na welcome page e chats/popups fechados */}
        {!showStartButton && !showChatbotPopup && !showHumanChat && !showGuidePopup && (guideVideos?.humanChatEnabled ?? true) && (
          <div className={styles.chatLinkBar}>
            <button onClick={(e) => {
              setShowChatbotPopup(false);
              
              // Arranque síncrono do PiP durante o clique
              if (!isDesktop && pipVideoRef.current && videoRef.current) {
                try {
                  // Pausar o vídeo principal IMEDIATAMENTE
                  videoRef.current.pause();
                  setVideoPlaying(false);
                  
                  // Sincronizar tempo e preparar PiP
                  const time = videoRef.current.currentTime || 0;
                  pipVideoRef.current.currentTime = time;
                  
                  // Preservar preferência de som original
                  // Primeiro configurar o volume para garantir que o áudio esteja corretamente configurado
                  pipVideoRef.current.volume = videoMuted ? 0 : 1;
                  // Depois configurar o mute
                  pipVideoRef.current.muted = videoMuted;
                  
                  // PLAY SÍNCRONO - crucial para Android
                  const playPromise = safePlay(pipVideoRef.current);
                  
                  // Após iniciar com sucesso
                  playPromise.then(() => {
                    setPipVideoPlaying(true);
                    // Garantir que o som está conforme a preferência do usuário
                    try { 
                      pipVideoRef.current!.volume = videoMuted ? 0 : 1;
                      pipVideoRef.current!.muted = videoMuted; 
                    } catch {}
                  }).catch(err => {
                    console.error('Erro no PiP:', err);
                    // Tentar novamente com mute (política de autoplay)
                    try {
                      pipVideoRef.current!.muted = true;
                      safePlay(pipVideoRef.current!).then(() => {
                        setPipVideoPlaying(true);
                        // Restaurar som após iniciar, se necessário
                        if (!videoMuted) {
                          setTimeout(() => {
                            try { pipVideoRef.current!.muted = false; } catch {}
                          }, 100);
                        }
                      });
                    } catch {}
                  });
                } catch (err) {
                  console.error('Erro ao preparar PiP:', err);
                }
              }
              
              handleGuideClick(e);
            }} className={styles.chatLink}>
              <svg className={styles.chatLinkIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12 C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 16H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{getInterfaceTexts().talkToRealGuide}</span>
            </button>
            <div className={styles.chatLinkCopyright} style={{ fontSize: '8px', color: 'white' }}>
              by <a href="http://inovpartner.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline' }}>Inov Partner</a>
            </div>
          </div>
        )}

        {/* Controladores de Vídeo - Desktop: só quando chats abertos | Mobile: só quando não há popups/chats e não é welcome */}
        {(
          // Desktop: mostrar quando chats estão abertos e não há popup do guia
          (isDesktop && (showChatbotPopup || ((guideVideos?.humanChatEnabled ?? true) && showHumanChat)) && !showGuidePopup) ||
          // Mobile: mostrar quando não há chats/popups abertos e não é welcome page
          (!isDesktop && !showChatbotPopup && ((guideVideos?.humanChatEnabled ?? true) ? !showHumanChat : true) && !showGuidePopup && !showStartButton)
        ) && (
          <div className={`${styles.glassmorphismControlBar} ${styles['page-module___8aEwW__glassmorphismControlBar']}`}>
            <div className={styles.controlButtonsRow}>
              <button type="button"
                className={styles.controlButton}
                onClick={handleRestart}
                title="Ver o vídeo novamente"
              >
                <RestartIcon />
              </button>
              <button type="button"
                className={styles.controlButton}
                onClick={handleRewind}
                title="Traz 10 segundos"
              >
                <RewindIcon />
              </button>
              <button type="button"
                className={styles.controlButton}
                onClick={handlePlayPause}
                title={videoPlaying ? "Pausar" : "Reproduzir"}
              >
                <PlayPauseIcon playing={videoPlaying} />
              </button>
              <button type="button"
                className={styles.controlButton}
                onClick={handleFastForward}
                title="Andar para a frente 10 segundos"
              >
                <FastForwardIcon />
              </button>
              <button type="button"
                className={styles.controlButton}
                onClick={handleToggleMute}
                title={videoMuted ? "Ativar som" : "Desativar som"}
              >
                <VolumeIcon muted={videoMuted} />
              </button>
              <button type="button"
                className={styles.controlButton}
                onClick={handleDownload}
                disabled={isDownloading}
                title={isDownloading ? "A descarregar..." : "Descarregar vídeo"}
                style={{ opacity: isDownloading ? 0.6 : 1, cursor: isDownloading ? 'not-allowed' : 'pointer' }}
              >
                <DownloadIcon />
              </button>
            </div>
          </div>
        )}
        {/* Popup do Chatbot */}
        {showChatbotPopup && (
          <div className={styles.chatbotPopupOverlay}>
            <div className={`${styles.chatbotPopup} ${showChatbotPopup ? styles.fullscreenPopup : ''}`}>
              <div className={styles.chatbotHeader}>
                {!isDesktop && (
                  <div className={styles.headerButtonsContainerMobile}>
                    <button 
                      className={styles.backButton} 
                      onClick={handleCloseChatbot}
                      aria-label={getInterfaceTexts().back}
                    >
                      <BackIcon />
                      <span>{getInterfaceTexts().back.toLowerCase()}</span>
                    </button>
                  </div>
                )}
                <div className={styles.chatbotHeaderTitle}>
                  {isDesktop ? (
                    <>
                  <h3>{getWelcomeTitle()}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {(() => {
                            const src = (guideVideos?.companyIconURL as string) || "/iconbrindicis.jpg";
                            if (src.startsWith('http')) {
                              // eslint-disable-next-line @next/next/no-img-element
                              return <img src={src} alt="Ícone" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />;
                            }
                            return <Image src={src} alt="Ícone" width={40} height={40} style={{ borderRadius: '50%' }} />;
                          })()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p className={styles.chatbotHeaderSubtitle} style={{ margin: 0 }}>{companyName || guideSlug}</p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              aria-label={getInterfaceTexts().followAria}
                              title={getInterfaceTexts().follow}
                              onClick={() => {
                                setShowSimpleContact(true);
                              }}
                              style={{
                                background: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: isDesktop ? '14px' : '12px'
                              }}
                            >
                              {getInterfaceTexts().follow}
                            </button>
                            {budgetConfig?.enabled && (
                            <button
                              aria-label={getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                              title={getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                              onClick={() => {
                                handleOpenBudgetForm();
                              }}
                              style={{
                                background: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: isDesktop ? '14px' : '12px'
                              }}
                            >
                              {getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                            </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ width: '100%' }}>
                      {/* Título acima em smartphone */}
                      <h3 style={{ margin: 0 }}>{getWelcomeTitle()}</h3>
                      {/* Ícone + nome + seguir abaixo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {(() => {
                            const src = (guideVideos?.companyIconURL as string) || "/iconbrindicis.jpg";
                            if (src.startsWith('http')) {
                              // eslint-disable-next-line @next/next/no-img-element
                              return <img src={src} alt="Ícone" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />;
                            }
                            return <Image src={src} alt="Ícone" width={40} height={40} style={{ borderRadius: '50%' }} />;
                          })()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p className={styles.chatbotHeaderSubtitle} style={{ margin: 0 }}>{companyName || guideSlug}</p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              aria-label={getInterfaceTexts().followAria}
                              title={getInterfaceTexts().follow}
                              onClick={() => {
                                setShowSimpleContact(true);
                              }}
                              style={{
                                background: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: isDesktop ? '14px' : '12px'
                              }}
                            >
                              {getInterfaceTexts().follow}
                            </button>
                            {budgetConfig?.enabled && (
                            <button
                              aria-label={getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                              title={getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                              onClick={() => {
                                handleOpenBudgetForm();
                              }}
                              style={{
                                background: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: isDesktop ? '14px' : '12px'
                              }}
                            >
                              {getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                            </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className={`${styles.chatbotContent} ${isAndroid ? styles['android-adjusted'] : ''}`}>
                {showChatbotWelcome && (
                  <div className={`${styles.chatbotWelcome} ${isAndroid && androidWelcomeHidden ? styles['android-hidden'] : ''}`}>
                    <h3>{getWelcomeTitle()}</h3>
                    {/* Em smartphone, evitar duplicação do bloco de ícone+seguir. Mostrar em desktop e tablet. */}
                    {(isDesktop || isTablet) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {(() => {
                            const src = (guideVideos?.companyIconURL as string) || "/iconbrindicis.jpg";
                            if (src.startsWith('http')) {
                              // eslint-disable-next-line @next/next/no-img-element
                              return <img src={src} alt="Ícone" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />;
                            }
                            return <Image src={src} alt="Ícone" width={40} height={40} style={{ borderRadius: '50%' }} />;
                          })()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p className={styles.chatbotSubtitle} style={{ margin: 0 }}>{companyName || guideSlug}</p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              aria-label={getInterfaceTexts().followAria}
                              title={getInterfaceTexts().follow}
                              onClick={() => {
                                setShowSimpleContact(true);
                              }}
                              style={{
                                background: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: isDesktop ? '14px' : '12px'
                              }}
                            >
                              {getInterfaceTexts().follow}
                            </button>
                            {budgetConfig?.enabled && (
                            <button
                              aria-label={getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                              title={getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                              onClick={() => {
                                handleOpenBudgetForm();
                              }}
                              style={{
                                background: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: isDesktop ? '14px' : '12px'
                              }}
                            >
                              {getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                            </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className={styles.chatbotMessages}>
                  {/* Welcome como primeira mensagem do bot */}
                  {showInstructions && (
                    <div className={styles.chatbotBotMessage}>
                      <Image 
                        src={guideVideos?.chatIconURL || "/Imagemchat.png"} 
                        alt="Chat AI" 
                        width={40}
                        height={40}
                        className={styles.messageAvatar}
                      />
                      <div className={styles.messageContent}>
                        <p style={{ margin: '0 0 16px 0', lineHeight: '1.6' }}>
                          <b>{getInterfaceTexts().aiWelcomeMessage}</b><br/>
                          <span style={{ display: 'block' }}>
                            {getInterfaceTexts().aiHelpText} <span 
                              style={{ 
                                color: '#0066cc', 
                                cursor: 'pointer', 
                                textDecoration: 'underline',
                                fontWeight: 500
                              }}
                              onClick={(e) => {
                                handleGuideClick(e as unknown as React.MouseEvent);
                              }}
                            >
                              {getInterfaceTexts().talkToRealGuide.toLowerCase()}
                            </span>{getInterfaceTexts().aiHelpTextOr} <span 
                              style={{ 
                                color: '#0066cc', 
                                cursor: 'pointer', 
                                textDecoration: 'underline',
                                fontWeight: 500
                              }}
                              onClick={handleOpenFaqModal}
                            >
                              {getInterfaceTexts().faqButton.toLowerCase()}
                            </span>{getInterfaceTexts().aiHelpTextEnd}
                          </span>
                        </p>
                        {(() => {
                          const buttonTexts = getButtonTexts();
                          // Mostrar SEMPRE imagem se existir URL configurado
                          if ((guideVideos as any)?.quickAreaImageURL || (guideVideos as any)?.quickAreaImageTabletURL || (guideVideos as any)?.quickAreaImageMobileURL) {
                            return (
                              <div className={styles.chatConfigButtons}>
                                {(() => {
                                  const pickUrl = (() => {
                                    const gv: any = guideVideos || {};
                                    if (isMobile && gv.quickAreaImageMobileURL) return gv.quickAreaImageMobileURL;
                                    if (isTablet && gv.quickAreaImageTabletURL) return gv.quickAreaImageTabletURL;
                                    return gv.quickAreaImageURL;
                                  })();
                                  const img = (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={pickUrl} alt="" style={{ width: '100%', height: 'auto', borderRadius: 12 }} />
                                  );
                                  const href = (guideVideos as any)?.quickAreaImageLink;
                                  if (href && typeof href === 'string' && href.trim()) {
                                    return (
                                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                        {img}
                                      </a>
                                    );
                                  }
                                  return img;
                                })()}
                              </div>
                            );
                          }
                          if ((guideVideos as any)?.quickButtonsDisabled) {
                            return (
                              <div className={styles.chatConfigButtons}>
                                {((guideVideos as any)?.quickAreaImageURL) && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={(guideVideos as any).quickAreaImageURL} alt="" style={{ width: '100%', height: 'auto', borderRadius: 12 }} />
                                )}
                              </div>
                            );
                          }
                          return (
                          <div className={styles.chatConfigButtons}>
                            {buttonTexts.button1Text && buttonTexts.button1Function && (
                              <button 
                                className={styles.chatConfigButton}
                                onClick={() => {
                                  const input = chatbotInputRef.current;
                                  if (input && buttonTexts.button1Function) {
                                    input.value = buttonTexts.button1Function;
                                    const fake = new Event('submit') as unknown as React.FormEvent;
                                    handleChatbotSend(fake);
                                  }
                                }}
                              >
                                {buttonTexts.button1Text}
                              </button>
                            )}
                            {buttonTexts.button2Text && buttonTexts.button2Function && (
                              <button 
                                className={styles.chatConfigButton}
                                onClick={() => {
                                  const input = chatbotInputRef.current;
                                  if (input && buttonTexts.button2Function) {
                                    input.value = buttonTexts.button2Function;
                                    const fake = new Event('submit') as unknown as React.FormEvent;
                                    handleChatbotSend(fake);
                                  }
                                }}
                              >
                                {buttonTexts.button2Text}
                              </button>
                            )}
                            {buttonTexts.button3Text && buttonTexts.button3Function && (
                              <button 
                                className={styles.chatConfigButton}
                                onClick={() => {
                                  const input = chatbotInputRef.current;
                                  if (input && buttonTexts.button3Function) {
                                    input.value = buttonTexts.button3Function;
                                    const fake = new Event('submit') as unknown as React.FormEvent;
                                    handleChatbotSend(fake);
                                  }
                                }}
                              >
                                {buttonTexts.button3Text}
                              </button>
                            )}
                          </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* Mensagens do chat */}
                  {chatbotMessages.length > 0 && (
                    <>
                      {chatbotMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={msg.from === 'bot' ? styles.chatbotBotMessage : styles.chatbotUserMessage}
                      >
                        {msg.from === 'bot' ? (
                          <>
                            <Image 
                              src={guideVideos?.chatIconURL || "/Imagemchat.png"} 
                              alt="Chat AI" 
                              width={40}
                              height={40}
                              className={styles.messageAvatar}
                            />
                            <div 
                              className={styles.messageContent}
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                // Link de compra (exemplo existente)
                                if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
                                  e.preventDefault();
                                  alert('Botão COMPRAR BILHETES ONLINE clicado!');
                                  const href = target.getAttribute('href');
                                  if (href) {
                                    window.open(href, '_blank', 'noopener,noreferrer');
                                  }
                                  return;
                                }
                                // CTA para abrir chat humano inserida na resposta
                                const btn = target.closest('.vg-open-human-chat-btn') as HTMLElement | null;
                                if (btn && (guideVideos?.humanChatEnabled === true)) {
                                  e.preventDefault();
                                  handleGuideClick(e as unknown as React.MouseEvent);
                                }
                              }}
                            >
                              {msg.metadata?.isThinking ? (
                                <div className={styles.thinkingMessage}>
                                  <span className={`${styles.thinkingText} ${isTextTransitioning ? styles.textTransitioning : ''}`}>
                                    {thinkingText}
                                  </span>
                                  <div className={styles.thinkingDots}>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                {/* Remover marcador [[OPEN_HUMAN_CHAT]] quando intenção for comercial e há contactos */}
                                {(() => {
                                  try {
                                    let html = String(msg.text || '');
                                    // Remover sempre o marcador [[OPEN_HUMAN_CHAT]] para não ser exibido como texto
                                    if (html.includes('[[OPEN_HUMAN_CHAT]]')) {
                                      html = '';
                                    } else {
                                      // Caso especial comercial: se houver intent e contactos comerciais, também suprimir marcador se existir
                                      const phones = (budgetConfig?.enabled && budgetConfig?.commercialSectionEnabled && Array.isArray(budgetConfig?.commercialPhones)) ? budgetConfig.commercialPhones : [];
                                      const lastUserAskedBudget = chatbotMessages.slice().reverse().find(m => m.from === 'user' && detectBudgetIntent(String(m.text || '')));
                                      const lastUserAskedSales = chatbotMessages.slice().reverse().find(m => m.from === 'user' && detectSalesIntent(String(m.text || '')));
                                      const shouldSuppress = (lastUserAskedBudget || lastUserAskedSales) && phones.length > 0;
                                      if (shouldSuppress) {
                                        html = html.replace('[[OPEN_HUMAN_CHAT]]', '');
                                      }
                                    }
                                    // Remover textos entre parênteses retos antes dos links e manter URLs limpos
                                    try {
                                      // Remover padrões [texto] antes de URLs
                                      html = html.replace(/\[[^\]]+\]\s*(https?:\/\/[^\s<>")']+)/gi, '$1');
                                      // Normalizar: mostrar só o URL como texto do link e manter o resto da mensagem
                                      // 1) Converter markdown [texto](url) -> <a href="url">url</a>
                                      html = html.replace(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/gi, (_m, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
                                      // 2) Converter <a href="url">qualquer texto</a> -> <a href="url">url</a>
                                      html = html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_m, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
                                      // 3) Corrigir casos "quebrados" onde atributos surgem no texto: https://..." target="_blank" ...>Texto
                                      html = html.replace(/(https?:\/\/[^\s"<>]+)\"[^>]*>[^<]*/gi, (_m, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
                                      // 3.1) Remover atributos soltos (target/rel) que aparecem como texto, não dentro de <a>
                                      html = html.replace(/(^|[^<])\s*\"?\s*target=['"][^'\"]+['\"]\s+rel=['"][^'\"]+['"][\s]*>/gi, '$1');
                                      html = html.replace(/(^|[^<])\s*target=['"][^'\"]+['\"]/gi, '$1');
                                      html = html.replace(/(^|[^<])\s*rel=['"][^'\"]+['\"]/gi, '$1');
                                      // 4) Autolink de URLs "crus" que restem (ignorar URLs já em href="...")
                                      html = html.replace(/(?<!href=["'])(https?:\/\/[^\s<>"')]+)/gi, (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`);
                                    } catch {}
                                    // Remover quaisquer asteriscos (ex.: markdown *lista*)
                                    try { html = html.replace(/\*/g, ''); } catch {}
                                    // Remover parênteses isolados que restem depois da limpeza de links
                                    try { html = html.replace(/[()]/g, ''); } catch {}
                                    return <div dangerouslySetInnerHTML={useSanitizedHtml(html)} />;
                                  } catch {
                                    return <div dangerouslySetInnerHTML={useSanitizedHtml(msg.text)} />;
                                  }
                                })()}
                                {(() => {
                                  try {
                                    const allButtons = (((msg as any).metadata?.buttons as Array<{ label: string; href?: string }>) || []);
                                    const isBudgetLabel = (lbl: string) => /orçamento|orcamento|budget|presupuesto|devis/i.test(lbl);
                                    const isOpenHumanLabel = (lbl: string) => /chat\s*real|guia\s*real|guía\s*real|real\s*chat/i.test(lbl);
                                    const filtered = allButtons.filter((b) => {
                                      const lbl = String(b?.label || '');
                                      return !isBudgetLabel(lbl) && !isOpenHumanLabel(lbl);
                                    });
                                    if (filtered.length === 0) return null;
                                    return (
                                      <div className={styles.aiButtonsRow}>
                                        {filtered.map((b, i) => (
                                          <button
                                            key={`ai-btn-${index}-${i}`}
                                            className={styles.aiSecondaryButton}
                                            onClick={() => {
                                              try {
                                                const isOpenHuman = /chat\s*real|guia\s*real|guía\s*real|real\s*chat|chat\s*r[eé]al/i.test(String(b?.label || ''));
                                                if (isOpenHuman && (guideVideos?.humanChatEnabled === true)) {
                                                  setShowChatbotPopup(false);
                                                  // Abrir chat humano
                                                  const fakeEvt = { preventDefault() {}, stopPropagation() {} } as unknown as React.MouseEvent;
                                                  handleGuideClick(fakeEvt);
                                                  if (videoRef.current && !isDesktop) {
                                                    try { videoRef.current.pause(); setVideoPlaying(false); } catch {}
                                                  }
                                                  return;
                                                }

                                                if (b.href) {
                                                  if (b.href.startsWith('tel:')) {
                                                    window.location.href = b.href;
                                                  } else {
                                                    window.open(b.href, '_blank', 'noopener,noreferrer');
                                                  }
                                                } else {
                                                  const input = chatbotInputRef.current;
                                                  if (input) {
                                                    input.value = b.label;
                                                    const fake = new Event('submit') as unknown as React.FormEvent;
                                                    handleChatbotSend(fake);
                                                  }
                                                }
                                              } catch {}
                                            }}
                                            title={b.label}
                                          >
                                            {b.label}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  } catch { return null; }
                                })()}
                                {/* Botão para abrir chat humano quando a IA sinaliza [[OPEN_HUMAN_CHAT]] */}
                                {(() => {
                                  try {
                                    const hasMarker = String(msg.text || '').includes('[[OPEN_HUMAN_CHAT]]');
                                    if (hasMarker && guideVideos?.humanChatEnabled === true) {
                                      return (
                                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                          <button
                                            className={styles.aiSecondaryButton}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setShowChatbotPopup(false);
                                              handleGuideClick(e as unknown as React.MouseEvent);
                                              if (videoRef.current && !isDesktop) {
                                                try { videoRef.current.pause(); setVideoPlaying(false); } catch {}
                                              }
                                            }}
                                          >
                                            {getInterfaceTexts().talkToRealGuide}
                                          </button>
                                          {budgetConfig?.enabled && (
                                            <button
                                              className={styles.aiSecondaryButton}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                handleOpenBudgetForm();
                                              }}
                                                title={getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                                            >
                                                {getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }
                                  } catch {}
                                  return null;
                                })()}
                                {/* Botões "Ligar" quando o utilizador pede orçamento/comercial e existem contactos - só mostrar se não há CTA automática E ainda não foram mostrados */}
                                {(() => {
                                  try {
                                    // Mostrar APENAS na resposta imediatamente a seguir à pergunta com intenção
                                    const prevMsg = chatbotMessages[index - 1];
                                    const userAskedBudget = prevMsg?.from === 'user' && detectBudgetIntent(String(prevMsg?.text || ''));
                                    const userAskedSales = prevMsg?.from === 'user' && detectSalesIntent(String(prevMsg?.text || ''));
                                    const phones = (budgetConfig?.enabled && budgetConfig?.commercialSectionEnabled && Array.isArray(budgetConfig?.commercialPhones)) ? budgetConfig.commercialPhones : [];
                                    
                                    // Só mostrar se há intenção E não há CTA automática nesta resposta E ainda não foram mostrados
                                    const hasAutoCTA = detectBudgetIntent(String(msg.text || '')) || detectSalesIntent(String(msg.text || ''));
                                    if ((userAskedBudget || userAskedSales) && phones.length > 0 && !hasAutoCTA && !commercialButtonsShown) {
                                      return (
                                        <div className={styles.aiButtonsRow}>
                                          {phones.map((phone: any) => {
                                            const label = String(phone?.label || translatedTexts?.budgetModal?.commercialButton || budgetConfig?.commercialButtonText || 'Falar com Comercial');
                                            const number = String(phone?.phone || '').replace(/\s+/g, '');
                                            if (!number) return null;
                                            return (
                                              <button
                                                key={`ai-call-${index}-${label}-${number}`}
                                                className={styles.aiSecondaryButton}
                                                onClick={() => { 
                                                  try { 
                                                    window.location.href = `tel:${number}`;
                                                    setCommercialButtonsShown(true); // Marcar como mostrado
                                                  } catch {} 
                                                }}
                                                title={label}
                                              >
                                                📞 {label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      );
                                    }
                                  } catch {}
                                  return null;
                                })()}
                                  {/* CTA automática para orçamento - sempre mostrar quando detecta intenção */}
                                  {(() => {
                                    try {
                                      // Mostrar APENAS na resposta imediatamente a seguir à pergunta com intenção
                                      const prevMsg = chatbotMessages[index - 1];
                                      const userAskedBudget = prevMsg?.from === 'user' && detectBudgetIntent(String(prevMsg?.text || ''));
                                      const userAskedSales = prevMsg?.from === 'user' && detectSalesIntent(String(prevMsg?.text || ''));
                                      const phones = (budgetConfig?.enabled && budgetConfig?.commercialSectionEnabled && Array.isArray(budgetConfig?.commercialPhones)) ? budgetConfig.commercialPhones : [];
                                      
                                      if (userAskedBudget || userAskedSales) {
                                        // Evitar duplicação: se já existir um botão de orçamento nos botões extraídos do HTML, não mostrar o automático
                                        const extractedButtons = ((msg as any)?.metadata?.buttons || []) as Array<{ label?: string }>;
                                        const hasBudgetButtonAlready = Array.isArray(extractedButtons) && extractedButtons.some((b: any) => /orçamento|orcamento|budget|presupuesto|devis/i.test(String(b?.label || '')));
                                        return (
                                          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {/* Botão formulário de orçamento - evitar duplicação com extraídos (permitir coexistir com [[OPEN_HUMAN_CHAT]]) */}
                                            {budgetConfig?.enabled && !hasBudgetButtonAlready && (
                                              <button
                                                className={styles.aiSecondaryButton}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  handleOpenBudgetForm();
                                                }}
                                                title={getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                                              >
                                                {getBudgetText('button', translatedTexts?.budgetModal?.title || "Pedir orçamento")}
                                              </button>
                                            )}
                                            
                                            {/* Botão falar com guia real - mostrar apenas se NÃO houver marcador [[OPEN_HUMAN_CHAT]] nesta mesma resposta */}
                                            {guideVideos?.humanChatEnabled === true && !String(msg.text || '').includes('[[OPEN_HUMAN_CHAT]]') && (
                                              <button
                                                className={styles.aiSecondaryButton}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  setShowChatbotPopup(false);
                                                  handleGuideClick(e as unknown as React.MouseEvent);
                                                  if (videoRef.current && !isDesktop) {
                                                    videoRef.current.pause();
                                                    setVideoPlaying(false);
                                                  }
                                                }}
                                              >
                                                {getInterfaceTexts().talkToRealGuide}
                                              </button>
                                            )}
                                            
                                            {/* Botões de chamada comercial - mostrar se existem contactos E ainda não foram mostrados */}
                                            {phones.length > 0 && !commercialButtonsShown && phones.map((phone: any) => {
                                              const label = String(phone?.label || translatedTexts?.budgetModal?.commercialButton || budgetConfig?.commercialButtonText || 'Falar com Comercial');
                                              const number = String(phone?.phone || '').replace(/\s+/g, '');
                                              if (!number) return null;
                                              return (
                                                <button
                                                  key={`cta-call-${label}-${number}`}
                                                  className={styles.aiSecondaryButton}
                                                  onClick={() => { 
                                                    try { 
                                                      window.location.href = `tel:${number}`;
                                                      setCommercialButtonsShown(true); // Marcar como mostrado
                                                    } catch {} 
                                                  }}
                                                  title={label}
                                                >
                                                  📞 {label}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        );
                                      }
                                      return null;
                                    } catch {
                                      return null;
                                    }
                                  })()}
                                  {/* Pré-visualização de links (Open Graph) */}
                                  {(() => {
                                    try {
                                      const urls = extractUrlsFromText(String(msg.text || ''));
                                      if (!urls || urls.length === 0) return null;
                                      return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                          {urls.slice(0, 1).map((u, i) => (
                                            <LinkPreviewCard key={`lp-${index}-${i}`} url={u} />
                                          ))}
                                        </div>
                                      );
                                    } catch {
                                      return null;
                                    }
                                  })()}
                                </>
                              )}
                              {/* Sugestões inline: mostrar apenas abaixo da última mensagem do bot */}
                              {msg.from === 'bot' && index === chatbotMessages.length - 1 && !msg.metadata?.isThinking && chatSuggestions.length > 0 && (
                                <div className={styles.inlineSuggestions}>
                                  {chatSuggestions.slice(0, 2).map((sug, i) => (
                                    <button
                                      key={`inline-sug-${i}`}
                                      className={styles.quickSuggestionBtn}
                                      disabled={suggestionsBlocked}
                                      onClick={() => {
                                        const input = chatbotInputRef.current;
                                        if (input) {
                                          input.value = sug;
                                          const fake = new Event('submit') as unknown as React.FormEvent;
                                          handleChatbotSend(fake);
                                        }
                                      }}
                                      title={sug}
                                    >
                                      {sug}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <Image 
                              src="/user.png" 
                              alt="Utilizador" 
                              width={40}
                              height={40}
                              className={styles.messageAvatar}
                            />
                            <div className={styles.messageContent}>
                              {msg.text}
                            </div>
                          </>
                        )}
                      </div>
                      ))}
                      <div ref={chatbotEndRef} />
                    </>
                  )}
                </div>
              </div>
              {/* Container fixo com form e botão FALAR COM O GUIA REAL */}
              <div className={`${styles.fixedBottomContainer} ${!(guideVideos?.humanChatEnabled ?? true) ? styles.humanChatDisabled : ''}`}>
                {/* Barra compacta com sugestões rápidas (sempre visível) */}
                <div className={styles.quickSuggestionsBar}>
                    <button
                     id="perguntas-frequentes-ai"
                      className={`${styles.quickSuggestionBtn} ${styles.faqGradientBtn}`}
                      onClick={handleOpenFaqModal}
                    >
                      <img 
                        src="/pergunta5.svg" 
                        alt="Pergunta" 
                        className={styles.faqIcon}
                      />
                      {getInterfaceTexts().faqButton}
                    </button>
                  </div>
                <form className={styles.chatbotInputBar} onSubmit={handleChatbotSend} id="chatbotInputForm">
                  <div className={styles.chatbotInputRow}>
                    <input
                      ref={chatbotInputRef}
                      type="text"
                      placeholder={getInterfaceTexts().chatPlaceholder}
                      className={styles.chatbotInput}
                      onChange={handleChatbotInputChange}
                      onClick={() => {
                        // Em mobile, focar apenas quando o utilizador clicar explicitamente
                        if (!isDesktop) {
                          setTimeout(() => {
                            chatbotInputRef.current?.focus();
                          }, 100);
                        }
                      }}
                    />
                    <button type="submit" className={styles.chatbotSendButton}>
                      <SendIcon />
                    </button>
                  </div>
                  <div
                    className={styles.chatbotDisclaimer}
                    style={{ textAlign: 'center' }}
                  >
                    {getInterfaceTexts().disclaimer}
                  </div>
                </form>
                
                {/* Botão para falar com guia real - só quando ativado */}
                {(guideVideos?.humanChatEnabled ?? true) && (
                  <div className={styles.guideRealLinkContainer} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button 
                      className={styles.guideRealLink}
                      onClick={(e) => {
                        setShowChatbotPopup(false);
                        handleGuideClick(e);
                        // Garantir que em mobile o vídeo fica sempre em pausa
                        if (videoRef.current && !isDesktop) {
                          videoRef.current.pause();
                          setVideoPlaying(false);
                        }
                      }}
                      style={{ width: '100%', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
                    >
                      <span>{getInterfaceTexts().talkToRealGuide}</span>
                    </button>
                    <div style={{ marginLeft: 'auto', fontWeight: 500, fontSize: isDesktop ? '10px' : '8px', color: '#666', paddingTop: '5px' }}>
                      by <a href="http://inovpartner.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#666', textDecoration: 'underline' }}>Inov Partner</a>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Popup para falar com guia real */}
        {showGuidePopup && (
          <div className={styles.guidePopupOverlay}>
            <div className={styles.guidePopup}>
              <div className={styles.guidePopupHeader}>
                {isPromoMode ? (
                  <div>
                    <h3 style={{ color: 'red'}}>FUNCIONALIDADE EXTRA</h3>
                    <h3>{getInterfaceTexts().talkToRealGuideTitle}</h3>
                  </div>
                ) : (
                  <h3>{getInterfaceTexts().talkToRealGuide}</h3>
                )}
                <button 
                  className={styles.closeChatbotButton} 
                  onClick={() => {
                    // Fechar o formulário de contacto
                    setShowGuidePopup(false);
                    // Garantir que o chat humano fica fechado
                    if (showHumanChat) {
                      setShowHumanChat(false);
                    }
                    // Em desktop, manter comportamento anterior (abrir chat com AI);
                    // em smartphone/tablet, se o utilizador já esteve no chat de IA,
                    // voltar para o chat de IA em vez da página inicial
                    if (isDesktop) {
                      setShowChatbotPopup(true);
                      // Sempre mostrar o título de boas-vindas
                      setShowChatbotWelcome(true);
                      // Manter instruções sempre visíveis (glassmorphismBox)
                      setShowInstructions(true);
                    } else {
                      if (hasVisitedAiChat) {
                        // Reabrir chat com IA
                        setShowChatbotPopup(true);
                        // Manter welcome/instruções se ainda não houve conversa
                        if (chatbotMessages.length === 0) {
                          setShowChatbotWelcome(true);
                          setShowInstructions(true);
                        }
                      } else {
                        // Sem visita prévia ao chat de IA: voltar ao vídeo
                        setShowChatbotPopup(false);
                        if (chatbotMessages.length === 0) {
                          setShowChatbotWelcome(true);
                          setShowInstructions(true);
                        }
                      }
                    }
                    setAndroidWelcomeHidden(false);
                    // Restaurar o scroll da página quando o popup for fechado
                // document.body.style.overflow = 'auto'; // Removido conforme pedido
    // No Android, forçar um reflow para garantir que o scroll seja restaurado
    if (/android/i.test(navigator.userAgent)) {
      void document.body.offsetHeight; // Trigger reflow
    }
                    // Retomar vídeo principal ao fechar o formulário sem entrar no chat humano
                    if (videoRef.current) {
                      videoRef.current.muted = videoMuted; // Respeitar preferência salva
                      setVideoMuted(videoMuted);
                      try { lastUserGestureAtRef.current = Date.now(); desiredStateRef.current = 'playing'; } catch {}
                      maybePlay(videoRef.current).then((ok) => {
                          if (ok) { setVideoPlaying(true); return; }
                          try { videoRef.current!.play().then(() => setVideoPlaying(true)).catch(() => {}); } catch {}
                      }).catch(error => console.error('Erro ao retomar vídeo principal:', error));
                    }
                  }}
                  aria-label="Fechar"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.guidePopupContent}>
                <p>{getInterfaceTexts().fillDataToStart}</p>
                
                <form className={styles.guideForm} onSubmit={handleGuideFormSubmit}>
                  {formError && (
                    <div className={styles.formError}>
                      {formError}
                    </div>
                  )}
                  <div className={styles.formField}>
                    <input 
                      type="text" 
                      id="name" 
                      placeholder={getInterfaceTexts().yourName} 
                      value={formName}
                      onChange={(e) => updateFormName(e.target.value)}
                      disabled={formSubmitting}
                      required
                      onFocus={() => {
                        if (isPromoMode) {
                          setShowPromoPopup(true);
                          setShowGuidePopup(false);
                        }
                      }}
                      style={{
                        cursor: 'text',
                        opacity: 1
                      }}
                    />
                  </div>
                  <div className={styles.formField}>
                    <input 
                      type="email" 
                      id="contact" 
                      placeholder={getInterfaceTexts().yourEmail} 
                      value={formContact}
                      onChange={(e) => updateFormContact(e.target.value)}
                      disabled={formSubmitting}
                      required
                      // Removido pattern incompatível com alguns motores (erro de regex)
                      // A validação já é feita por isValidEmail() no submit
                      title={getInterfaceTexts().validEmail}
                      onFocus={() => {
                        if (isPromoMode) {
                          setShowPromoPopup(true);
                          setShowGuidePopup(false);
                        }
                      }}
                      style={{
                        cursor: 'text',
                        opacity: 1
                      }}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className={styles.guideSubmitButton}
                    disabled={formSubmitting}
                    onClick={(e) => {
                      if (isPromoMode) {
                        e.preventDefault();
                        setShowPromoPopup(true);
                        setShowGuidePopup(false);
                      }
                    }}
                  >
                    {formSubmitting ? getInterfaceTexts().sending : getInterfaceTexts().startConversationForm}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de seguir (independente) */}
      {showSimpleContact && (
        <div className={styles.guidePopupOverlay}>
          <div className={styles.guidePopup} style={{ background: '#ffffff', color: '#000000' }}>
            <div className={styles.guidePopupHeader}>
              <h3>{`${getInterfaceTexts().followTitle} ${companyName || (guideVideos as any)?.company || guideSlug}`}</h3>
              <button 
                className={styles.closeChatbotButton} 
                onClick={handleCloseSimpleContact}
                aria-label={getInterfaceTexts().close}
              >
                <CloseIcon />
              </button>
            </div>
            <div className={styles.guidePopupContent}>
              <p style={{ margin: '0 0 12px 0', lineHeight: '1.5', fontWeight: 500 }}>
                {getInterfaceTexts().followDescription}
              </p>
              <form 
                className={styles.guideForm} 
                onSubmit={async (e) => {
                  e.preventDefault();
                  
                  if (!simpleContactName.trim() || !simpleContactEmail.trim()) {
                    return;
                  }
                  
                  try {
                    console.log('A tentar importar followerServices...');
                    // Importar o serviço de seguidores
                    const { addFollower } = await import('../../../firebase/followerServices');
                    console.log('followerServices importado com sucesso');
                    
                    const followerData = {
                      guideId: guideSlug,
                      guideSlug: guideSlug,
                      name: simpleContactName.trim(),
                      email: simpleContactEmail.trim(),
                      timestamp: new Date().toISOString(),
                      source: 'follow_form',
                      userAgent: navigator.userAgent,
                    };
                    
                    console.log('Dados do seguidor:', followerData);
                    console.log('A tentar guardar no Firebase...');
                    
                    // Guardar no Firebase
                    const followerId = await addFollower(followerData);
                    console.log('Seguidor guardado com ID:', followerId);
                    
                    // Fechar modal e limpar campos
                    setShowSimpleContact(false);
                    setSimpleContactName("");
                    setSimpleContactEmail("");
                    
                    // Mostrar mensagem de sucesso (opcional)
                    alert(getInterfaceTexts().followSuccess);
                    
                  } catch (error) {
                    console.error('Erro ao guardar seguidor:', error);
                    console.error('Detalhes do erro:', {
                      message: error instanceof Error ? error.message : 'Erro desconhecido',
                      stack: error instanceof Error ? error.stack : undefined,
                      name: error instanceof Error ? error.name : undefined
                    });
                    alert(`${getInterfaceTexts().followError}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                  }
                }}
              >
                <div className={styles.formField}>
                  <input 
                    type="text" 
                    id="simple-name" 
                    placeholder={getInterfaceTexts().namePlaceholder} 
                    value={simpleContactName}
                    onChange={(e) => setSimpleContactName(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formField}>
                  <input 
                    type="email" 
                    id="simple-email" 
                    placeholder={getInterfaceTexts().emailPlaceholder} 
                    value={simpleContactEmail}
                    onChange={(e) => setSimpleContactEmail(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formActions}>
                  <button 
                    type="submit"
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 16px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {getInterfaceTexts().followButton}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* Chat Humano */}
      {showHumanChat && (
        <div className={styles.chatbotPopupOverlay}>
          <div className={styles.chatbotPopup}>
            <div className={`${styles.chatbotHeader} ${styles.humanChatHeader}`}>
              {isDesktop ? (
                /* Versão Desktop: Título primeiro, botões depois */
                <>
                  <div className={styles.chatbotTitle}>
                    <div>
                      <h2>{getInterfaceTexts().realGuideChat}</h2>
                      <p>
                        {currentConversation?.userName
                          ? `${getInterfaceTexts().conversationWith} ${currentConversation.userName}`
                          : (formName ? `${getInterfaceTexts().conversationWith} ${formName}` : getInterfaceTexts().realTimeConversation)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.headerButtonsContainer}>
                    <button 
                      className={styles.backButton} 
                      onClick={handleHumanChatClose}
                      aria-label={getInterfaceTexts().back}
                    >
                      <BackIcon />
                      <span>{getInterfaceTexts().back.toLowerCase()}</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Versão Mobile: Botões primeiro, título depois */
                <>
                  <div className={styles.headerButtonsContainerMobile}>
                    <button 
                      className={styles.backButton} 
                      onClick={handleHumanChatClose}
                      aria-label={getInterfaceTexts().back}
                    >
                      <BackIcon />
                      <span>{getInterfaceTexts().back.toLowerCase()}</span>
                    </button>
                  </div>
                  <div className={styles.chatbotTitleMobile}>
                    <div>
                      <h2>{getInterfaceTexts().realGuideChat}</h2>
                      <p>
                        {currentConversation?.userName
                          ? `${getInterfaceTexts().conversationWith} ${currentConversation.userName}`
                          : (formName ? `${getInterfaceTexts().conversationWith} ${formName}` : getInterfaceTexts().realTimeConversation)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className={styles.chatbotMessages}>
              {humanChatMessages.map((message, index) => {
                // Mostrar a barra "Guia Real" quando a mensagem de transição surge
                // ou imediatamente na primeira resposta do guia após essa transição.
                const transitionText = formatMessage(getInterfaceTexts().transitionMessage, { 
            guide: getInterfaceTexts().talkToRealGuide.toLowerCase() 
          });
                const isTransition = message.metadata?.isTransitionMessage === true || (typeof message.text === 'string' && message.text.trim() === transitionText);
                const prevMsg = index > 0 ? humanChatMessages[index - 1] : undefined;
                const previousWasTransition = Boolean(
                  prevMsg && (
                    prevMsg.metadata?.isTransitionMessage === true ||
                    (typeof prevMsg.text === 'string' && prevMsg.text.trim() === transitionText)
                  )
                );
                const isFirstGuideMessageAfterTransition =
                  message.from === 'agent' &&
                  message.metadata?.guideResponse === true &&
                  previousWasTransition;

                return (
                  <React.Fragment key={index}>
                    {(isTransition || isFirstGuideMessageAfterTransition) && (
                      <div className={styles.transitionLine}>
                        <hr />
                        <span>Guia Real</span>
                        <hr />
                      </div>
                    )}
                    <div 
                      className={`${styles.chatbotMessage} ${
                        message.from === 'user' ? styles.chatbotUserMessage : styles.chatbotBotMessage
                      } ${message.text.includes('[Bot]') ? styles.botMessage : ''}`}
                      data-from={message.from}
                    >
                      {message.from === 'user' ? (
                        <>
                          <div 
                            className={styles.messageContent} 
                            dangerouslySetInnerHTML={useSanitizedHtml(message.text)}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              // botão/link para abrir IA vindo de mensagens HTML
                              if (target && (target.getAttribute('data-open-ai') === '1' || target.matches('button[data-open-ai="1"], a[data-open-ai="1"]'))) {
                                e.preventDefault();
                                try { setShowChatbotPopup(true); setReturnedFromAiAfterHuman(true); } catch {}
                                return;
                              }
                              if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
                                e.preventDefault();
                                const href = target.getAttribute('href');
                                if (href) {
                                  window.open(href, '_blank', 'noopener,noreferrer');
                                }
                              }
                            }}
                          />
                          {message?.metadata?.closingMessage === true && (
                            <div style={{ marginTop: 8 }}>
                              <button
                                type="button"
                                onClick={() => { try { setShowChatbotPopup(true); setReturnedFromAiAfterHuman(true); } catch {} }}
                                style={{
                                  padding: '8px 14px',
                                  border: 'none',
                                  borderRadius: 8,
                                  background: '#0b79d0',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                {getInterfaceTexts().openAiChat}
                              </button>
                            </div>
                          )}
                          <Image 
                            src="/user.png" 
                            alt="Utilizador" 
                            width={40}
                            height={40}
                            className={styles.messageAvatar}
                          />
                        </>
                      ) : (
                        <>
                          <Image 
                            src={guideVideos?.chatIconURL || "/Imagemchat.png"} 
                            alt="Guia Real" 
                            width={40}
                            height={40}
                            className={styles.messageAvatar}
                          />
                          <div 
                            className={styles.messageContent} 
                            dangerouslySetInnerHTML={useSanitizedHtml(
                              message?.metadata?.closingMessage === true
                                ? `✅ ${getInterfaceTexts().closingMessage} <br/><button data-open-ai="1" style="margin-top:10px;padding:8px 14px;border:none;border-radius:8px;background:#000;color:#fff;cursor:pointer;font-weight:600">${getInterfaceTexts().openAiChat}</button>`
                                : message.text
                            )}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              // botão/link para abrir IA vindo de mensagens HTML
                              if (target && (target.getAttribute('data-open-ai') === '1' || target.matches('button[data-open-ai="1"], a[data-open-ai="1"]'))) {
                                e.preventDefault();
                                try { setShowHumanChat(false); } catch {}
                                try { setShowChatbotPopup(true); setReturnedFromAiAfterHuman(true); } catch {}
                                return;
                              }
                              if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
                                e.preventDefault();
                                const href = target.getAttribute('href');
                                if (href) {
                                  window.open(href, '_blank', 'noopener,noreferrer');
                                }
                              }
                            }}
                          />
                        </>
                      )}
                      <div className={styles.messageTime}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={humanEndRef} />
            </div>

            <form id="humanChatForm" className={styles.chatbotInputBar} style={{ flexDirection: 'row' }} onSubmit={handleHumanChatSend}>
              <input
                ref={chatbotInputRef}
                type="text"
                className={styles.chatbotInput}
                                  placeholder={getInterfaceTexts().searchPlaceholder}
                value={humanChatInput}
                onChange={handleHumanChatInputChange}
                disabled={humanChatSubmitting || currentConversation?.status === 'closed'}
              />
              <button 
                type="submit" 
                className={styles.chatbotSendButton}
                disabled={humanChatSubmitting || !humanChatInput.trim() || currentConversation?.status === 'closed'}
              >
                <SendIcon />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Popup de Confirmação para Fechar Chat */}
      {showCloseConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '25px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            maxWidth: '350px',
            width: '90%',
            textAlign: 'center',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              fontSize: '18px',
              color: '#333',
              fontWeight: '600'
            }}>
              {getInterfaceTexts().confirmExitTitle}
            </h3>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: '#666',
              lineHeight: '1.4'
            }}>
              {getInterfaceTexts().confirmExit}
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button 
                onClick={handleCancelClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
              >
                {getInterfaceTexts().cancel}
              </button>
              <button 
                onClick={handleConfirmClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
              >
                {getInterfaceTexts().yesExit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picture-in-Picture Video para Mobile - sempre montado para pré-carregamento */}
      {!isDesktop && (
        <div 
          className={`${styles.pipVideoContainer} ${isDragging ? styles.dragging : ''} ${pipExpanded ? styles.expanded : ''} ${(showFaqModal || showImageModal) ? styles.behindModal : ''}`}
          style={{
            visibility: (showChatbotPopup || showHumanChat) && pipVisible ? 'visible' : 'hidden',
            pointerEvents: (showChatbotPopup || showHumanChat) && pipVisible ? 'auto' : 'none',
            left: `${pipPosition.x}px`,
            top: `${pipPosition.y}px`,
            right: 'auto'
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={handlePipBackToHome}
        >
          <PiPOptimizedVideo
            ref={pipVideoRef}
            className={styles.pipVideo}
            src={toStreamUrl(guideVideos?.welcomeVideoURL, guideVideos?.videoProvider) || "/VirtualGuide_PortugaldosPequeninos.webm"}
            loop
            preload={pipOptimization.getPiPOptimizations().preload}
            playsInline
            muted={preFormMutedRef.current ?? videoMuted} /* Usar o estado guardado ao abrir o chat */
            crossOrigin="anonymous"
            onError={(e: any) => {
              // Suavizar erros transitórios do Android/HLS. Se o MobileOptimizedVideo recuperar,
              // evitamos trocar de src. Só fazer fallback local se falhar repetidamente.
              try {
                const video = e.currentTarget as HTMLVideoElement;
                const occurredAt = Date.now();
                // Guardar num atributo para contar falhas curtas
                const key = '__pipErrCount';
                const lastKey = '__pipErrLast';
                const prev = (video as any)[key] || 0;
                const last = (video as any)[lastKey] || 0;
                const within = occurredAt - last < 3000; // janela de 3s
                const next = within ? prev + 1 : 1;
                (video as any)[key] = next;
                (video as any)[lastKey] = occurredAt;
                if (next <= 2) {
                  // Deixar o MobileOptimizedVideo tentar recuperar; não fazer nada aqui
                  return;
                }
                // Fallback após 3 erros rápidos
                if (video.src !== "/VirtualGuide_PortugaldosPequeninos.webm") {
                  console.warn('🔄 Fallback local para PiP após múltiplos erros');
                  video.src = "/VirtualGuide_PortugaldosPequeninos.webm";
                }
              } catch {}
            }}
          />
          <div className={`${styles.pipDragHandle} ${isDragging ? styles.dragging : ''}`} />
          <div className={styles.pipControls}>
            <button 
              className={styles.pipPlayPauseButton}
              onClick={(e) => {
                e.stopPropagation();
                const pip = pipVideoRef.current;
                if (!pip) return;

                if (pipVideoPlaying) {
                  pip.pause();
                  setPipVideoPlaying(false);
                } else {
                  // Evitar poluir o console com AbortError quando o estado muda rápido
                  pip.play()
                    .then(() => setPipVideoPlaying(true))
                    .catch(() => { /* ignorar AbortError/play interrompido */ });
                }
              }}
              aria-label={pipVideoPlaying ? "Pausar" : "Reproduzir"}
            >
              <PlayPauseIcon playing={pipVideoPlaying} />
            </button>
            <button 
              className={styles.pipMuteButton}
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePiPMute();
              }}
              aria-label={videoMuted ? "Ativar som" : "Silenciar"}
            >
              <VolumeIcon muted={videoMuted} />
            </button>
          </div>
          <button 
            className={styles.pipCloseButtonExterior}
            onClick={(e) => {
              e.stopPropagation();
              handleClosePiP();
            }}
            aria-label="Fechar PiP"
            style={{ fontSize: '12px', color: 'white', fontWeight: 'bold' }}
          >
            X
          </button>
        </div>
      )}

      {/* Espaço para não ficar escondido pelo container fixo do chat no fundo
          Mostrar apenas quando algum popup/chat está aberto. Quando o footer
          está visível, não adicionamos este espaçamento para o footer encostar
          à última secção. */}
      {/* Div com altura 120px removida conforme pedido */}

      {/* Barra fixa com links (Livro de Reclamações / Política de Privacidade) na welcome page */}
      {!showChatbotPopup && !showHumanChat && !showGuidePopup && showStartButton && (
        <footer style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '6px 0px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666',
          zIndex: 2002,
          background: 'rgba(0, 0, 0, 0.95)',
          borderTop: '1px solid rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '0px' }}>
            <a
              href="https://www.livroreclamacoes.pt/Inicio/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.welcomeFooterLink}
              style={{ color: 'white', textDecoration: 'none', paddingTop: '3px'}}
            >
              {getInterfaceTexts().complaintsBook}
            </a>
            <span style={{ color: '#666' }}>|</span>
            <a
              href="/politica-privacidade"
              className={styles.welcomeFooterLink}
              style={{ color: 'white', textDecoration: 'none', paddingTop: '3px'}}
            >
              {getInterfaceTexts().privacyPolicy}
            </a>
          </div>
        </footer>
      )}

      {/* Footer antigo junto ao vídeo removido */}

      {/* Popup de Promoção */}
      {showPromoPopup && (
        <div className={styles.guidePopupOverlay}>
          <div className={styles.guidePopup} style={{ maxWidth: '450px', textAlign: 'center' }}>
            <div className={styles.guidePopupHeader}>
              <h3 style={{ color: 'red', margin: '0 0 8px 0', fontSize: '20px' }}>FUNCIONALIDADE EXTRA</h3>
              <button 
                className={styles.closeChatbotButton} 
                onClick={() => setShowPromoPopup(false)}
                aria-label="Fechar"
              >
                <CloseIcon />
              </button>
            </div>
            <div className={styles.guidePopupContent}>
              <p style={{ fontSize: '16px', margin: '8px 0' }}>
                Esta é uma funcionalidade extra
              </p>
              <button 
                className={styles.guideSubmitButton}
                onClick={() => setShowPromoPopup(false)}
                style={{ marginTop: '8px' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Formulário de Orçamento (Dinâmico baseado no backoffice) */}
      {showBudgetForm && budgetConfig.enabled && (
        <div className={styles.guidePopupOverlay}>
          <div className={styles.guidePopup} style={{ maxWidth: '560px' }}>
            <div className={styles.guidePopupHeader}>
              <h3 style={{ margin: 0 }}>{getBudgetText('title', translatedTexts?.budgetModal?.title || 'Pedir Orçamento')}</h3>
              <button 
                className={styles.closeChatbotButton} 
                onClick={handleCloseBudgetForm}
                aria-label={translatedTexts?.budgetModal?.close || "Fechar"}
              >
                <CloseIcon />
              </button>
            </div>
            <div className={styles.guidePopupContent}>
              <form onSubmit={handleBudgetSubmit} className={styles.guideForm}>
                {(((budgetConfig as any).fieldOrder && (budgetConfig as any).fieldOrder.length)
                  ? (budgetConfig as any).fieldOrder.map((k: string) => [k, getTranslatedFields()[k]]).filter(([,v]: any[]) => !!v)
                  : Object.entries(getTranslatedFields()))
                  .map(([fieldKey, fieldConfig]: any) => {
                  const isRequired = fieldConfig.required;
                  const fieldValue = budgetForm[fieldKey] || '';
                  
                  return (
                    <div key={fieldKey} className={styles.formField}>
                      <label>
                        {fieldConfig.label} {isRequired && <span style={{ color: 'red' }}>*</span>}
                      </label>
                      {fieldConfig.type === 'textarea' ? (
                        <textarea
                          value={fieldValue}
                          onChange={(e) => handleBudgetChange(fieldKey, e.target.value)}
                          placeholder={`${translatedTexts?.budgetModal?.placeholderPrefix || 'Ex:'} ${fieldConfig.label.toLowerCase()}`}
                          rows={3}
                          required={isRequired}
                        />
                      ) : fieldConfig.type === 'file' ? (
                        <input
                          type="file"
                          required={isRequired}
                          accept={fieldConfig.accept || '.pdf,.jpg,.jpeg,.png,.webp'}
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0] || null;
                            if (file) {
                              try {
                                const maxMb = Number((fieldConfig as any)?.maxSizeMb) || 10;
                                const limit = maxMb * 1024 * 1024;
                                if (file.size > limit) {
                                  alert((translatedTexts?.budgetModal?.fileTooLarge || 'O ficheiro selecionado ultrapassa o tamanho suportado') + ` (${maxMb} MB).`);
                                  try { e.currentTarget.value = ''; } catch {}
                                  return;
                                }
                              } catch {}
                            }
                            setBudgetFiles(prev => ({ ...prev, [fieldKey]: file }));
                          }}
                        />
                      ) : (
                        <input
                          type={fieldConfig.type}
                          value={fieldValue}
                          onChange={(e) => handleBudgetChange(fieldKey, e.target.value)}
                          placeholder={`${translatedTexts?.budgetModal?.placeholderPrefix || 'Ex:'} ${fieldConfig.label.toLowerCase()}`}
                          required={isRequired}
                          min={fieldConfig.type === 'number' ? '1' : undefined}
                        />
                      )}
                  </div>
                  );
                })}
                <div className={styles.formActions}>
                  {budgetConfig.commercialSectionEnabled && budgetConfig.commercialPhones && Array.isArray(budgetConfig.commercialPhones) && budgetConfig.commercialPhones.length > 0 && (
                    <div className={styles.commercialSection}>
                      <h4 className={styles.commercialTitle}>{translatedTexts?.budgetModal?.commercialTitle || 'Se precisares de informação contacta algum dos comerciais'}</h4>
                      <div className={styles.commercialButtonsContainer}>
                        {budgetConfig.commercialPhones.map((phone: any) => (
                        <button 
                          key={phone.id}
                          type="button" 
                          className={styles.commercialCallButton}
                          onClick={() => {
                            const phoneNumber = phone.phone.replace(/\s/g, '');
                            window.location.href = `tel:${phoneNumber}`;
                          }}
                        >
                          📞 {phone.label || translatedTexts?.budgetModal?.commercialButton || budgetConfig.commercialButtonText}
                        </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="submit" className={styles.submitButton} disabled={budgetSubmitting}>
                    {budgetSubmitting 
                      ? (translatedTexts?.budgetModal?.submittingButton || 'A enviar…') 
                      : (translatedTexts?.budgetModal?.submitButton || 'Enviar Pedido')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Cookies */}
      {(() => {
        console.log('Cookie bar render check:', { cookieBarMounted, showCookieBar });
        return cookieBarMounted && showCookieBar;
      })() && (
        <div className={styles.cookieBar}>
          <div className={styles.cookieBarContent}>
            <div className={styles.cookieBarText}>
              <span className={styles.cookieBarIcon}>🍪</span>
              <span className={styles.cookieBarMessage}>
                Utilizamos cookies e recolhemos dados pessoais para melhorar a sua experiência. Ao continuar a navegar, aceita a nossa{' '}
                <a href="/politica-privacidade" className={styles.cookieBarLink}>
                  Política de Privacidade
                </a>
                .
              </span>
            </div>
            <div className={styles.cookieBarButtons}>
              <button 
                onClick={handleAcceptCookies}
                className={styles.cookieBarAccept}
              >
                Aceitar
              </button>
              <button 
                onClick={handleDeclineCookies}
                className={styles.cookieBarDecline}
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Perguntas Rápidas (FAQ) */}
      {showFaqModal && (
        <div className={styles.faqModalOverlay} onClick={(e) => { if (e.target === e.currentTarget) handleCloseFaqModal(); }}>
          <div className={styles.faqModal}>
            <div className={styles.faqModalHeader}>
              <h3>{getInterfaceTexts().faqTitle}</h3>
              <button
                type="button"
                className={`${styles.faqHeaderClose} ${styles.chatbotSendButton}`}
                onClick={handleCloseFaqModal}
                aria-label={getInterfaceTexts().close}
              >
                <CloseIcon />
              </button>
            </div>
            
            <div className={styles.faqModalContent}>
              {(() => {
                // Selecionar FAQs baseadas no idioma atual
                const currentFaqs = (() => {
                  if (guideVideos?.faqByLang?.[selectedLanguage]) {
                    return guideVideos.faqByLang[selectedLanguage];
                  }
                  return guideVideos?.faq || null;
                })();
                
                return currentFaqs && currentFaqs.length > 0 ? (
                <div className={styles.faqModalLayout}>
                  {/* Layout Mobile: Acordeão */}
                  <div className={styles.faqMobileAccordion}>
                    {currentFaqs.map((category: any, index: number) => (
                      <div key={index} className={styles.faqMobileCategory}>
                        <button
                          type="button"
                          className={`${styles.faqMobileCategoryButton} ${activeFaqCategory === category.name ? styles.active : ''}`}
                          onClick={() => handleCategoryChange(category.name)}
                        >
                          <span>{category.name}</span>
                          <span className={styles.faqMobileToggle}>
                            {activeFaqCategory === category.name ? '−' : '+'}
                          </span>
                        </button>
                        
                        {activeFaqCategory === category.name && (
                          <div className={styles.faqMobileQuestions}>
                            {category.questions?.map((faq: any, questionIndex: number) => (
                              <div key={questionIndex} className={styles.faqItem}>
                                <div className={styles.faqQuestionRow}>
                                  <button
                                    type="button"
                                    className={styles.faqQuestion}
                                    onClick={() => handleFaqToggle(questionIndex)}
                                  >
                                    <span>{faq.question}</span>
                                    <span className={`${styles.faqToggle} ${expandedFaq[questionIndex] ? styles.expanded : ''}`}>
                                      ▼
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.faqAskIcon}
                                    title="Perguntar ao chat"
                                    aria-label="Perguntar ao chat"
                                    onClick={() => {
                                      const input = chatbotInputRef.current;
                                      if (input) {
                                        input.value = faq.question || '';
                                        setShowChatbotPopup(true);
                                        // setShowInstructions(false); // Manter instruções visíveis
                                        setShowFaqModal(false);
                                        handleChatbotSend(new Event('submit') as unknown as React.FormEvent);
                                      }
                                    }}
                                  >
                                    <Image src="/icons/chat-discuss.svg" alt="Perguntar ao chat" width={18} height={18} />
                                  </button>
                                </div>
                                {expandedFaq[questionIndex] && (
                                  <div className={styles.faqAnswer}>
                                    <div dangerouslySetInnerHTML={useSanitizedHtml(faq.answer || '')} />
                                    {faq.images && faq.images.length > 0 && (
                                      <div className={styles.faqImages}>
                                        {faq.images.length > 1 ? (
                                          <div className={styles.faqImageCarousel}>
                                            <button
                                              className={styles.faqImageNav}
                                              onClick={() => {
                                                const key = `mobile-${questionIndex}`;
                                                const currentIndex = faqImageIndex[key] || 0;
                                                const newIndex = currentIndex > 0 ? currentIndex - 1 : faq.images.length - 1;
                                                setFaqImageIndex(prev => ({ ...prev, [key]: newIndex }));
                                              }}
                                            >
                                              ←
                                            </button>
                                            <div className={styles.faqImageContainer}>
                                              <img 
                                                src={faq.images[faqImageIndex[`mobile-${questionIndex}`] || 0]} 
                                                alt={`Imagem ${(faqImageIndex[`mobile-${questionIndex}`] || 0) + 1}`}
                                                className={styles.faqImage}
                                                onClick={() => handleImageClick(faq.images, faqImageIndex[`mobile-${questionIndex}`] || 0)}
                                              />
                                              <div className={styles.faqImageCounter}>
                                                {(faqImageIndex[`mobile-${questionIndex}`] || 0) + 1} / {faq.images.length}
                                              </div>
                                            </div>
                                            <button
                                              className={styles.faqImageNav}
                                              onClick={() => {
                                                const key = `mobile-${questionIndex}`;
                                                const currentIndex = faqImageIndex[key] || 0;
                                                const newIndex = currentIndex < faq.images.length - 1 ? currentIndex + 1 : 0;
                                                setFaqImageIndex(prev => ({ ...prev, [key]: newIndex }));
                                              }}
                                            >
                                              →
                                            </button>
                                          </div>
                                        ) : (
                                          <img 
                                            src={faq.images[0]} 
                                            alt="Imagem"
                                            className={styles.faqImage}
                                            onClick={() => handleImageClick(faq.images, 0)}
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Layout Desktop: Duas Colunas */}
                  <div className={styles.faqCategoriesColumn}>
                    <h4 className={styles.faqCategoriesTitle}>{getInterfaceTexts().categories}</h4>
                    <div className={styles.faqCategoriesList}>
                      {currentFaqs.map((category: any, index: number) => (
                        <button
                          type="button"
                          key={index}
                          data-category={category.name}
                          className={`${styles.faqCategory} ${activeFaqCategory === category.name ? styles.active : ''}`}
                          onClick={() => handleCategoryChange(category.name)}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Layout Desktop: Coluna das Perguntas */}
                  <div className={styles.faqQuestionsColumn}>
                    {activeFaqCategory && (() => {
                      const questions = currentFaqs
                        .find((cat: any) => cat.name === activeFaqCategory)
                        ?.questions || [];
                      const totalPages = Math.ceil(questions.length / faqItemsPerPage);
                      const startIndex = (faqCurrentPage - 1) * faqItemsPerPage;
                      const endIndex = startIndex + faqItemsPerPage;
                      const currentQuestions = questions.slice(startIndex, endIndex);
                      
                      return (
                        <div className={styles.faqQuestions}>
                          <h4 className={styles.faqQuestionsTitle}>
                            {getInterfaceTexts().questions} - {activeFaqCategory}
                          </h4>
                        {currentQuestions.map((faq: any, questionIndex: number) => {
                          const globalIndex = startIndex + questionIndex;
                          return (
                            <div key={globalIndex} className={styles.faqItem}>
                              <div className={styles.faqQuestionRow}>
                                <button
                                  type="button"
                                  className={styles.faqQuestion}
                                  onClick={() => handleFaqToggle(globalIndex)}
                                >
                                  <span>{faq.question}</span>
                                  <span className={`${styles.faqToggle} ${expandedFaq[globalIndex] ? styles.expanded : ''}`}>
                                    ▼
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className={styles.faqAskIcon}
                                  title="Perguntar ao chat"
                                  aria-label="Perguntar ao chat"
                                  onClick={() => {
                                    const input = chatbotInputRef.current;
                                    if (input) {
                                      input.value = faq.question || '';
                                      setShowChatbotPopup(true);
                                      // setShowInstructions(false); // Manter instruções visíveis
                                      setShowFaqModal(false);
                                      handleChatbotSend(new Event('submit') as unknown as React.FormEvent);
                                    }
                                  }}
                                >
                                  <Image src="/icons/chat-discuss.svg" alt="Perguntar ao chat" width={18} height={18} />
                                </button>
                              </div>
                              {expandedFaq[globalIndex] && (
                                <div className={styles.faqAnswer}>
                                  <div dangerouslySetInnerHTML={useSanitizedHtml(faq.answer || '')} />
                                  {faq.images && faq.images.length > 0 && (
                                    <div className={styles.faqImages}>
                                      {faq.images.length > 1 ? (
                                        <div className={styles.faqImageCarousel}>
                                          <button
                                            className={styles.faqImageNav}
                                            onClick={() => {
                                              const key = `desktop-${globalIndex}`;
                                              const currentIndex = faqImageIndex[key] || 0;
                                              const newIndex = currentIndex > 0 ? currentIndex - 1 : faq.images.length - 1;
                                              setFaqImageIndex(prev => ({ ...prev, [key]: newIndex }));
                                            }}
                                          >
                                            ←
                                          </button>
                                          <div className={styles.faqImageContainer}>
                                            <img 
                                              src={faq.images[faqImageIndex[`desktop-${globalIndex}`] || 0]} 
                                              alt={`Imagem ${(faqImageIndex[`desktop-${globalIndex}`] || 0) + 1}`}
                                              className={styles.faqImage}
                                              onClick={() => handleImageClick(faq.images, faqImageIndex[`desktop-${globalIndex}`] || 0)}
                                            />
                                            <div className={styles.faqImageCounter}>
                                              {(faqImageIndex[`desktop-${globalIndex}`] || 0) + 1} / {faq.images.length}
                                            </div>
                                          </div>
                                          <button
                                            className={styles.faqImageNav}
                                            onClick={() => {
                                              const key = `desktop-${globalIndex}`;
                                              const currentIndex = faqImageIndex[key] || 0;
                                              const newIndex = currentIndex < faq.images.length - 1 ? currentIndex + 1 : 0;
                                              setFaqImageIndex(prev => ({ ...prev, [key]: newIndex }));
                                            }}
                                          >
                                            →
                                          </button>
                                        </div>
                                      ) : (
                                        <img 
                                          src={faq.images[0]} 
                                          alt="Imagem"
                                          className={styles.faqImage}
                                          onClick={() => handleImageClick(faq.images, 0)}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Paginação */}
                        {totalPages > 1 && (
                          <div className={styles.faqPagination}>
                            <button
                              type="button"
                              className={styles.faqPageButton}
                              onClick={() => setFaqCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={faqCurrentPage === 1}
                            >
                              ‹ Anterior
                            </button>
                            
                            <div className={styles.faqPageNumbers}>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                  key={page}
                                  type="button"
                                  className={`${styles.faqPageNumber} ${faqCurrentPage === page ? styles.active : ''}`}
                                  onClick={() => setFaqCurrentPage(page)}
                                >
                                  {page}
                                </button>
                              ))}
                            </div>
                            
                            <button
                              type="button"
                              className={styles.faqPageButton}
                              onClick={() => setFaqCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={faqCurrentPage === totalPages}
                            >
                              Próxima ›
                            </button>
                          </div>
                        )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className={styles.faqEmpty}>
                  <p>Nenhuma pergunta frequente disponível.</p>
                </div>
              );
              })()}
            </div>
            
            {/* Rodapé sem botão (fecho no header) */}
            <div className={styles.faqModalFooter}></div>
          </div>
        </div>
      )}

      {/* Modal de visualização de imagem */}
      {showImageModal && (
        <div className={styles.imageModalOverlay}>
          <div className={styles.imageModalContent}>
            <button 
              className={styles.imageModalClose}
              onClick={handleCloseImageModal}
            >
              ×
            </button>
            
            {modalImages.length > 1 && (
              <button 
                className={styles.imageModalNavLeft}
                onClick={() => handleImageNavigation('prev')}
              >
                ←
              </button>
            )}
            
            <div className={styles.imageModalImageContainer}>
              <img 
                src={modalImages[modalCurrentIndex]} 
                alt={`Imagem ${modalCurrentIndex + 1}`}
                className={styles.imageModalImage}
              />
              {modalImages.length > 1 && (
                <div className={styles.imageModalCounter}>
                  {modalCurrentIndex + 1} / {modalImages.length}
                </div>
              )}
            </div>
            
            {modalImages.length > 1 && (
              <button 
                className={styles.imageModalNavRight}
                onClick={() => handleImageNavigation('next')}
              >
                →
              </button>
            )}
          </div>
        </div>
      )}

    </>
  );
}