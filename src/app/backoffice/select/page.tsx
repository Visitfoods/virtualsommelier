'use client';

export const dynamic = 'force-dynamic';
import { useEffect, useState, useMemo, useRef } from 'react';
import NextDynamic from 'next/dynamic';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExt from '@tiptap/extension-link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from '../backoffice.module.css';
import { sanitizeHtml } from '../../../utils/htmlSanitizer';

// Removido ReactQuill; vamos usar TipTap (EditorContent)
// CSS base do Quill é carregado via global se necessário; para Next 13+ pode ser importado globalmente

// Componente para item arrastável
function SortableItem({ 
  id, 
  fieldKey, 
  fieldConfig, 
  isEssential, 
  updateFieldConfig, 
  removeCustomField,
  updateFieldLabel
}: {
  id: string;
  fieldKey: string;
  fieldConfig: { required: boolean; label: string; type: string; labels?: { pt?: string; en?: string; es?: string; fr?: string } };
  isEssential: boolean;
  updateFieldConfig: (fieldId: string, property: 'label' | 'required' | 'type' | 'accept' | 'maxSizeMb', value: any) => void;
  removeCustomField: (fieldId: string) => void;
  updateFieldLabel: (fieldId: string, language: string, value: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 12,
        alignItems: 'center',
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        backgroundColor: '#000000',
        // o cursor de grab ficará apenas no handle
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
              Rótulo do Campo (PT)
            </label>
            <input
              type="text"
              value={fieldConfig.label}
              onChange={(e) => updateFieldConfig(fieldKey, 'label', e.target.value)}
              className={styles.formInput}
              style={{ fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
              Tipo de Campo
            </label>
            <select
              value={fieldConfig.type}
              onChange={(e) => updateFieldConfig(fieldKey, 'type', e.target.value)}
              className={styles.formInput}
              style={{ fontSize: 14 }}
            >
              <option value="text">Texto</option>
              <option value="email">Email</option>
              <option value="tel">Telefone</option>
              <option value="date">Data</option>
              <option value="number">Número</option>
              <option value="textarea">Área de Texto</option>
              <option value="file">Upload de Ficheiro</option>
            </select>
          </div>
        </div>
        
        {/* Rótulos multilíngues - PT é o default, não precisa de input extra */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
              🇬🇧 Inglês
            </label>
            <input
              type="text"
              value={fieldConfig.labels?.en || ''}
              onChange={(e) => updateFieldLabel(fieldKey, 'en', e.target.value)}
              className={styles.formInput}
              style={{ fontSize: 12 }}
              placeholder="Label in EN"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
              🇪🇸 Espanhol
            </label>
            <input
              type="text"
              value={fieldConfig.labels?.es || ''}
              onChange={(e) => updateFieldLabel(fieldKey, 'es', e.target.value)}
              className={styles.formInput}
              style={{ fontSize: 12 }}
              placeholder="Etiqueta en ES"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
              🇫🇷 Francês
            </label>
            <input
              type="text"
              value={fieldConfig.labels?.fr || ''}
              onChange={(e) => updateFieldLabel(fieldKey, 'fr', e.target.value)}
              className={styles.formInput}
              style={{ fontSize: 12 }}
              placeholder="Étiquette en FR"
            />
          </div>
        </div>

        {/* Opções adicionais quando o tipo é ficheiro */}
        {fieldConfig.type === 'file' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                Tipos permitidos (accept)
              </label>
              <input
                type="text"
                value={(fieldConfig as any).accept || '.pdf,.jpg,.jpeg,.png,.webp'}
                onChange={(e) => updateFieldConfig(fieldKey, 'accept', e.target.value)}
                className={styles.formInput}
                placeholder=".pdf,.jpg,.jpeg,.png,.webp"
                style={{ fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                Tamanho máximo (MB)
              </label>
              <input
                type="number"
                min={1}
                value={(fieldConfig as any).maxSizeMb ?? 10}
                onChange={(e) => updateFieldConfig(fieldKey, 'maxSizeMb', Number(e.target.value || 10))}
                className={styles.formInput}
                style={{ fontSize: 12 }}
              />
            </div>
          </div>
        )}
        {isEssential && (
          <div style={{ fontSize: 12, color: '#ffffff', fontStyle: 'italic' }}>
            Campo essencial (não pode ser removido)
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 4, 
          color: '#ffffff',
          fontSize: 12,
          cursor: 'grab'
        }}
        {...attributes}
        {...listeners}
        role="button"
        aria-label="Arrastar para reordenar"
        tabIndex={0}
        >
          ⋮⋮
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: '#ffffff' }}>
          <input
            type="checkbox"
            checked={fieldConfig.required}
            onChange={(e) => updateFieldConfig(fieldKey, 'required', e.target.checked)}
          />
          Obrigatório
        </label>
      </div>
      <div>
        {!isEssential && (
          <button
            type="button"
            onClick={() => removeCustomField(fieldKey)}
            style={{
              padding: '6px 12px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}
import Link from 'next/link';
import BackofficeAuthGuard from '../../../components/BackofficeAuthGuard';
import { useAuth } from '../../../hooks/useAuth';
import { doc, setDoc, serverTimestamp, collection, onSnapshot, query, orderBy, deleteDoc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db as targetDb } from '../../../firebase/config';
// Removido: import { mainDb } from '../../../firebase/mainConfig';
import { uploadVideo, UploadProgress } from '../../../utils/videoUpload';
import { copyImageToPublic } from '../../../utils/imageUpload';
import { copyCaptionsToPublic } from '../../../utils/captionsUpload';

export default function SelectDataSource() {
  const router = useRouter();
  const { user, logout } = useAuth();
  // Base de dados unificada do Firebase (virtualchat)
  
  

  const [showCreateGuideModal, setShowCreateGuideModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingGuide, setEditingGuide] = useState<{ slug: string; targetProject?: { projectId?: string; apiKey?: string; authDomain?: string; storageBucket?: string; messagingSenderId?: string; appId?: string; measurementId?: string | null } | null } | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [guides, setGuides] = useState<Array<{
    id: string;
    slug: string;
    name: string;
    company?: string;
    isActive?: boolean;
    targetProject?: { projectId?: string; apiKey?: string; authDomain?: string; storageBucket?: string; messagingSenderId?: string; appId?: string; measurementId?: string | null } | null;
  }>>([]);
  const [creating, setCreating] = useState<boolean>(false);
  const [deletingGuideId, setDeletingGuideId] = useState<string | null>(null);
  const [togglingGuideId, setTogglingGuideId] = useState<string | null>(null);
  const [backgroundVideoFile, setBackgroundVideoFile] = useState<File | null>(null);
  const [mobileTabletBackgroundVideoFile, setMobileTabletBackgroundVideoFile] = useState<File | null>(null);
  const [welcomeVideoFile, setWelcomeVideoFile] = useState<File | null>(null);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState<number>(0);
  const [mobileTabletBackgroundUploadProgress, setMobileTabletBackgroundUploadProgress] = useState<number>(0);
  const [welcomeUploadProgress, setWelcomeUploadProgress] = useState<number>(0);
  const [chatIconFile, setChatIconFile] = useState<File | null>(null);
  const [companyIconFile, setCompanyIconFile] = useState<File | null>(null);
  const [chatIconUploadProgress, setChatIconUploadProgress] = useState<number>(0);
  // Opções da área de botões rápidos do chat
  const [disableQuickButtons, setDisableQuickButtons] = useState<boolean>(false);
  const [quickAreaImageFile, setQuickAreaImageFile] = useState<File | null>(null);
  const [quickAreaImageUrl, setQuickAreaImageUrl] = useState<string>('');
  const [quickAreaImageLink, setQuickAreaImageLink] = useState<string>('');
  const [quickAreaImageTabletFile, setQuickAreaImageTabletFile] = useState<File | null>(null);
  const [quickAreaImageTabletUrl, setQuickAreaImageTabletUrl] = useState<string>('');
  const [quickAreaImageMobileFile, setQuickAreaImageMobileFile] = useState<File | null>(null);
  const [quickAreaImageMobileUrl, setQuickAreaImageMobileUrl] = useState<string>('');
  const [existingAssets, setExistingAssets] = useState<{ background?: string | null; mobileTabletBackground?: string | null; welcome?: string | null; chatIcon?: string | null; companyIcon?: string | null; captions?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null; captionsByLang?: { pt?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null; en?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null; es?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null; fr?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null } | null }>({});
  // Removido: contactsEnabled (Configuração de Contactos)
  const [captionsDesktopFile, setCaptionsDesktopFile] = useState<File | null>(null);
  const [captionsTabletFile, setCaptionsTabletFile] = useState<File | null>(null);
  const [captionsMobileFile, setCaptionsMobileFile] = useState<File | null>(null);
  const [captionsUploadProgress, setCaptionsUploadProgress] = useState<{ desktop: number; tablet: number; mobile: number }>({ desktop: 0, tablet: 0, mobile: 0 });
  const [faqImageUploadProgress, setFaqImageUploadProgress] = useState<{ [key: string]: number }>({});
  const [faqImageIndex, setFaqImageIndex] = useState<{ [key: string]: number }>({});
  // Novas legendas por idioma (EN/ES/FR)
  const [captionsEnDesktopFile, setCaptionsEnDesktopFile] = useState<File | null>(null);
  const [captionsEnTabletFile, setCaptionsEnTabletFile] = useState<File | null>(null);
  const [captionsEnMobileFile, setCaptionsEnMobileFile] = useState<File | null>(null);
  const [captionsEsDesktopFile, setCaptionsEsDesktopFile] = useState<File | null>(null);
  const [captionsEsTabletFile, setCaptionsEsTabletFile] = useState<File | null>(null);
  const [captionsEsMobileFile, setCaptionsEsMobileFile] = useState<File | null>(null);
  const [captionsFrDesktopFile, setCaptionsFrDesktopFile] = useState<File | null>(null);
  const [captionsFrTabletFile, setCaptionsFrTabletFile] = useState<File | null>(null);
  const [captionsFrMobileFile, setCaptionsFrMobileFile] = useState<File | null>(null);
  const [guideData, setGuideData] = useState({
    name: '',
    slug: '',
    company: '',
    websiteUrl: '',
    metaTitle: '',
    metaDescription: '',
    companyIconURL: '',
    gradientStartColor: '#ff6b6b',
    gradientEndColor: '#4ecdc4',
    humanChatNotificationEmail: ''
  });
  const [chatConfig, setChatConfig] = useState({
    welcomeTitle: 'BEM-VINDO AO GUIA VIRTUAL',
    aiWelcomeMessage: 'Olá! Sou o teu guia virtual e estou aqui para ajudar.',
    aiWelcomeMessageEn: 'Hello! I am your virtual guide and I am here to help.',
    aiWelcomeMessageEs: '¡Hola! Soy tu guía virtual y estoy aquí para ayudar.',
    aiWelcomeMessageFr: 'Bonjour ! Je suis votre guide virtuel et je suis là pour vous aider.',
    button1Text: 'O que visitar',
    button1Function: 'O que visitar no parque?',
    button2Text: 'O que comer',
    button2Function: 'O que comer no parque?',
    button3Text: '',
    button3Function: ''
  });
  // Traduções dos botões rápidos por idioma
  const [chatConfigEn, setChatConfigEn] = useState({
    welcomeTitle: 'WELCOME TO THE VIRTUAL GUIDE',
    aiWelcomeMessage: 'Hello! I am your virtual guide and I am here to help.',
    button1Text: 'What to visit',
    button1Function: 'What should I visit in the park?',
    button2Text: 'Where to eat',
    button2Function: 'Where can I eat in the park?',
    button3Text: '',
    button3Function: ''
  });
  const [chatConfigEs, setChatConfigEs] = useState({
    welcomeTitle: 'BIENVENIDO AL GUÍA VIRTUAL',
    aiWelcomeMessage: '¡Hola! Soy tu guía virtual y estoy aquí para ayudar.',
    button1Text: 'Qué visitar',
    button1Function: '¿Qué debo visitar en el parque?',
    button2Text: 'Dónde comer',
    button2Function: '¿Dónde puedo comer en el parque?',
    button3Text: '',
    button3Function: ''
  });
  const [chatConfigFr, setChatConfigFr] = useState({
    welcomeTitle: 'BIENVENUE DANS LE GUIDE VIRTUEL',
    aiWelcomeMessage: 'Bonjour ! Je suis votre guide virtuel et je suis là pour vous aider.',
    button1Text: 'Que visiter',
    button1Function: 'Que dois-je visiter dans le parc ?',
    button2Text: 'Où manger',
    button2Function: 'Où puis-je manger dans le parc ?',
    button3Text: '',
    button3Function: ''
  });
  const [humanChatEnabled, setHumanChatEnabled] = useState<boolean>(true);
  const quickAreaImageInputRef = useRef<HTMLInputElement | null>(null);
  
  // Sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Configurações do formulário de orçamento
  const [budgetConfig, setBudgetConfig] = useState<{
    enabled: boolean;
    title: string;
    titleLabels?: {
      pt?: string;
      en?: string;
      es?: string;
      fr?: string;
    };
    budgetButtonText?: string;
    budgetButtonTextLabels?: {
      pt?: string;
      en?: string;
      es?: string;
      fr?: string;
    };
    email: string;
    emailSubject?: string;
    emailSubjectLabels?: {
      pt?: string;
      en?: string;
      es?: string;
      fr?: string;
    };
    emailTextTitle?: string;
    emailTextTitleLabels?: {
      pt?: string;
      en?: string;
      es?: string;
      fr?: string;
    };
    emailText?: string;
    emailTextLabels?: {
      pt?: string;
      en?: string;
      es?: string;
      fr?: string;
    };
    commercialSectionEnabled: boolean;
    commercialPhones: Array<{ id: string; phone: string; label: string }>;
    commercialButtonText: string;
    confirmationMessage: string;
    fields: Record<string, { 
      required: boolean; 
      label: string; 
      type: string; // text | email | tel | date | number | textarea | file
      labels?: {
        pt?: string;
        en?: string;
        es?: string;
        fr?: string;
      };
      accept?: string; // apenas para file
      maxSizeMb?: number; // apenas para file
    }>;
    fieldOrder?: string[];
  }>({
    enabled: true,
    title: 'Pedir orçamento',
    budgetButtonText: 'Pedir orçamento',
    email: '',
    emailSubject: 'Novo Pedido de Orçamento',
    emailTextTitle: 'Detalhes do Pedido',
    emailText: 'Recebeu um novo pedido de orçamento através do seu guia virtual. Seguem os detalhes:',
    commercialSectionEnabled: true,
    commercialPhones: [],
    commercialButtonText: 'Falar com Comercial',
    confirmationMessage: 'Obrigado pelo seu pedido de orçamento! Entraremos em contacto consigo brevemente.',
    fields: {
      name: { 
        required: true, 
        label: 'Nome', 
        type: 'text',
        labels: {
          pt: 'Nome',
          en: 'Name',
          es: 'Nombre',
          fr: 'Nom'
        }
      },
      email: { 
        required: true, 
        label: 'Email', 
        type: 'email',
        labels: {
          pt: 'Email',
          en: 'Email',
          es: 'Email',
          fr: 'Email'
        }
      },
      phone: { 
        required: false, 
        label: 'Telefone', 
        type: 'tel',
        labels: {
          pt: 'Telefone',
          en: 'Phone',
          es: 'Teléfono',
          fr: 'Téléphone'
        }
      },
      date: { 
        required: false, 
        label: 'Data pretendida', 
        type: 'date',
        labels: {
          pt: 'Data pretendida',
          en: 'Preferred Date',
          es: 'Fecha Preferida',
          fr: 'Date Préférée'
        }
      },
      people: { 
        required: false, 
        label: 'Número de pessoas', 
        type: 'number',
        labels: {
          pt: 'Número de pessoas',
          en: 'Number of People',
          es: 'Número de Personas',
          fr: 'Nombre de Personnes'
        }
      },
      notes: { 
        required: false, 
        label: 'Notas', 
        type: 'textarea',
        labels: {
          pt: 'Notas',
          en: 'Notes',
          es: 'Notas',
          fr: 'Notes'
        }
      },
      attachments: {
        required: false,
        label: 'Anexos',
        type: 'file',
        accept: '.pdf,.jpg,.jpeg,.png,.webp',
        maxSizeMb: 10,
        labels: {
          pt: 'Anexos',
          en: 'Attachments',
          es: 'Adjuntos',
          fr: 'Pièces jointes'
        }
      }
    },
    fieldOrder: ['name','email','phone','date','people','notes','attachments']
  });

  // Guarda a versão original dos campos para ajudar em difs/remoções
  const [originalBudgetFields, setOriginalBudgetFields] = useState<Record<string, { required: boolean; label: string; type: string }>>({});

  // Debug: Log quando budgetConfig muda
  useEffect(() => {
    console.log('🔄 budgetConfig alterado:', budgetConfig);
    console.log('📊 Campos atuais:', Object.keys(budgetConfig.fields || {}));
  }, [budgetConfig]);
  
  // Funções para gerir campos dinâmicos do formulário de orçamento
  const addCustomField = () => {
    const fieldId = `custom_${Date.now()}`;
    setBudgetConfig(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldId]: { 
          required: false, 
          label: 'Novo Campo', 
          type: 'text',
          labels: {
            pt: 'Novo Campo',
            en: 'New Field',
            es: 'Nuevo Campo',
            fr: 'Nouveau Champ'
          }
        }
      },
      fieldOrder: [...(prev.fieldOrder || Object.keys(prev.fields)), fieldId]
    }));
  };

  // Funções para gerir números de telefone comerciais
  const addCommercialPhone = () => {
    const phoneId = `phone_${Date.now()}`;
    setBudgetConfig(prev => ({
      ...prev,
      commercialPhones: [...(prev.commercialPhones || []), { id: phoneId, phone: '', label: 'Comercial' }]
    }));
  };

  const removeCommercialPhone = (phoneId: string) => {
    setBudgetConfig(prev => ({
      ...prev,
      commercialPhones: (prev.commercialPhones || []).filter(phone => phone.id !== phoneId)
    }));
  };

  const updateCommercialPhone = (phoneId: string, field: 'phone' | 'label', value: string) => {
    setBudgetConfig(prev => ({
      ...prev,
      commercialPhones: (prev.commercialPhones || []).map(phone => 
        phone.id === phoneId ? { ...phone, [field]: value } : phone
      )
    }));
  };

  // Função para atualizar rótulos multilíngues dos campos
  const updateFieldLabel = (fieldId: string, language: string, value: string) => {
    setBudgetConfig(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldId]: {
          ...prev.fields[fieldId],
          labels: {
            ...prev.fields[fieldId].labels,
            [language]: value
          }
        }
      }
    }));
  };

  const removeCustomField = (fieldId: string) => {
    console.log('🗑️ Tentando remover campo:', fieldId);
    console.log('📊 Campos antes da remoção:', Object.keys(budgetConfig.fields));
    
    // Não permitir remover campos essenciais
    const essentialFields = ['name', 'email'];
    if (essentialFields.includes(fieldId)) {
      console.log('❌ Campo essencial não pode ser removido:', fieldId);
      return;
    }
    
    setBudgetConfig(prev => {
      const newFields = { ...prev.fields };
      delete newFields[fieldId];
      console.log('✅ Campo removido:', fieldId);
      console.log('📊 Campos após remoção:', Object.keys(newFields));
      const newOrder = (prev.fieldOrder || Object.keys(prev.fields)).filter(k => k !== fieldId);
      return { ...prev, fields: newFields, fieldOrder: newOrder };
    });
  };

  const updateFieldConfig = (fieldId: string, property: 'label' | 'required' | 'type' | 'accept' | 'maxSizeMb', value: any) => {
    setBudgetConfig(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldId]: {
          ...prev.fields[fieldId],
          [property]: value
        }
      }
    }));
  };

  // Função para lidar com o reordenamento dos campos
  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const fieldEntries = Object.entries(budgetConfig.fields);
      const oldIndex = fieldEntries.findIndex(([key]) => key === active.id);
      const newIndex = fieldEntries.findIndex(([key]) => key === over.id);

      const reorderedFields = arrayMove(fieldEntries, oldIndex, newIndex);
      
      // Converter de volta para objeto mantendo a ordem
      const newFields: Record<string, any> = {};
      reorderedFields.forEach(([key, value]) => {
        newFields[key] = value;
      });

      setBudgetConfig(prev => ({
        ...prev,
        fields: newFields,
        fieldOrder: Object.keys(newFields)
      }));
    }
  };

  // Removido: configuração do formulário de seguidores (funcionalidade desativada)
  // Estado de Pontos de Ajuda
  const [helpPoints, setHelpPoints] = useState<{ point1?: string; point2?: string; point3?: string; point4?: string; point5?: string }>({
    point1: '',
    point2: '',
    point3: '',
    point4: '',
    point5: ''
  });
  const [faqData, setFaqData] = useState<Array<{
    name: string;
    questions: Array<{
      question: string;
      answer: string;
      images: string[];
    }>;
  }>>([
    {
      name: "Sobre o Parque",
      questions: [
        {
          question: "O que é este parque?",
          answer: "Este é um parque temático que oferece uma experiência única de aprendizagem e diversão para toda a família.",
          images: []
        },
        {
          question: "Quando foi fundado?",
          answer: "O parque foi fundado para proporcionar momentos inesquecíveis aos visitantes de todas as idades.",
          images: []
        },
        {
          question: "Qual é a missão?",
          answer: "A missão é educar e divertir, criando experiências memoráveis para todos os visitantes.",
          images: []
        }
      ]
    },
    {
      name: "Horários & Bilhetes",
      questions: [
        {
          question: "Quais são os horários?",
          answer: "O parque está aberto todos os dias, com horários que variam consoante a época do ano.",
          images: []
        },
        {
          question: "Como comprar bilhetes?",
          answer: "Pode comprar bilhetes na bilheteira do parque ou online no site oficial.",
          images: []
        },
        {
          question: "Quanto custa a entrada?",
          answer: "Os preços variam consoante a idade e existem descontos para grupos e famílias.",
          images: []
        }
      ]
    },
    {
      name: "Como Chegar",
      questions: [
        {
          question: "Onde fica localizado?",
          answer: "O parque está situado numa localização central e acessível.",
          images: []
        },
        {
          question: "Como chegar de carro?",
          answer: "Existe estacionamento gratuito nas proximidades do parque.",
          images: []
        },
        {
          question: "Como chegar de transportes?",
          answer: "Pode chegar de comboio, autocarro ou táxi até ao parque.",
          images: []
        }
      ]
    },
    {
      name: "Monumentos & Atrações",
      questions: [
        {
          question: "Que atrações existem?",
          answer: "O parque oferece diversas atrações educativas e divertidas para todas as idades.",
          images: []
        },
        {
          question: "Há atividades para crianças?",
          answer: "Sim! Existem várias atividades educativas e workshops para crianças.",
          images: []
        },
        {
          question: "Quanto tempo demora a visita?",
          answer: "Uma visita completa demora aproximadamente 2 a 3 horas.",
          images: []
        }
      ]
    },
    {
      name: "Serviços & Instalações",
      questions: [
        {
          question: "Há restaurantes no parque?",
          answer: "Sim, o parque dispõe de cafetaria e restaurante com refeições tradicionais.",
          images: []
        },
        {
          question: "O parque tem loja?",
          answer: "Sim, existe uma loja oficial com lembranças e artigos relacionados.",
          images: []
        },
        {
          question: "O parque é acessível?",
          answer: "Sim, o parque está preparado para receber visitantes com mobilidade reduzida.",
          images: []
        }
      ]
    },
    {
      name: "Informações Úteis",
      questions: [
        {
          question: "Posso levar comida?",
          answer: "Sim, pode levar a sua própria comida e existem áreas de piquenique disponíveis.",
          images: []
        },
        {
          question: "O parque está aberto todo o ano?",
          answer: "Sim, o parque está aberto todos os dias do ano, incluindo feriados.",
          images: []
        },
        {
          question: "Posso tirar fotografias?",
          answer: "Sim, é permitido tirar fotografias para uso pessoal.",
          images: []
        }
      ]
    }
  ]);
  // FAQs por idioma
  const [faqLang, setFaqLang] = useState<'pt'|'en'|'es'|'fr'>('pt');
  const [faqDataEn, setFaqDataEn] = useState<typeof faqData>([]);
  const [faqDataEs, setFaqDataEs] = useState<typeof faqData>([]);
  const [faqDataFr, setFaqDataFr] = useState<typeof faqData>([]);

  // Refs para garantir leitura do estado mais recente durante o guardar
  const faqDataRef = useRef(faqData);
  const faqDataEnRef = useRef(faqDataEn);
  const faqDataEsRef = useRef(faqDataEs);
  const faqDataFrRef = useRef(faqDataFr);
  useEffect(() => { faqDataRef.current = faqData; }, [faqData]);
  useEffect(() => { faqDataEnRef.current = faqDataEn; }, [faqDataEn]);
  useEffect(() => { faqDataEsRef.current = faqDataEs; }, [faqDataEs]);
  useEffect(() => { faqDataFrRef.current = faqDataFr; }, [faqDataFr]);
  // Removido: contactInfo (Configuração de Contactos)
  // Removido: firebaseConfig state - usando sempre FIXED_FIREBASE_CONFIG

  useEffect(() => {
    // Verificação de autenticação agora feita pelo BackofficeAuthGuard
    // Esta verificação é redundante e pode ser removida
  }, []);

  // Abrir modal automaticamente se vier com ?create=1
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === '1') {
      handleCreateGuide();
    }
  }, []);

  // Listagem de guias do projeto virtualchat-b0e17
  useEffect(() => {
    // Verificação de role agora feita pelo BackofficeAuthGuard
    // Esta verificação é redundante

    // Usar o projeto virtualchat-b0e17 em vez do mainDb
    const q = query(collection(targetDb, 'guides'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items = snapshot.docs.map((d: any) => {
        const data = d.data() as any;
        return {
          id: data.id || d.id,
          slug: data.slug || d.id,
          name: data.name || '(sem nome)',
          company: data.company || '',
          isActive: data.isActive ?? true,
          targetProject: data.targetProject || null,
        };
      });
      setGuides(items);
    });

    return () => unsubscribe();
  }, []);

  // Removido: seleção de origem de dados (Portugal dos Pequenitos / Página Principal)

  const handleCreateGuide = () => {
    setIsEditMode(false);
    setEditingGuide(null);
    setShowCreateGuideModal(true);
    setCurrentStep(1);
    setGuideData({ name: '', slug: '', company: '', websiteUrl: '', metaTitle: '', metaDescription: '', companyIconURL: '', gradientStartColor: '#ff6b6b', gradientEndColor: '#4ecdc4', humanChatNotificationEmail: '' });
    setSystemPrompt('');
    setBackgroundVideoFile(null);
    setMobileTabletBackgroundVideoFile(null);
    setWelcomeVideoFile(null);
    setBackgroundUploadProgress(0);
    setMobileTabletBackgroundUploadProgress(0);
    setWelcomeUploadProgress(0);
    setChatIconFile(null);
    setChatIconUploadProgress(0);
    setCaptionsDesktopFile(null);
    setCaptionsTabletFile(null);
    setCaptionsMobileFile(null);
    setCaptionsUploadProgress({ desktop: 0, tablet: 0, mobile: 0 });
    setBackgroundUploadProgress(0);
    setMobileTabletBackgroundUploadProgress(0);
    setWelcomeUploadProgress(0);
    setChatIconUploadProgress(0);
    setExistingAssets({});
            setChatConfig({
          welcomeTitle: 'BEM-VINDO AO GUIA VIRTUAL',
          aiWelcomeMessage: 'Olá! Sou o teu guia virtual e estou aqui para ajudar.',
          aiWelcomeMessageEn: 'Hello! I am your virtual guide and I am here to help.',
          aiWelcomeMessageEs: '¡Hola! Soy tu guía virtual y estoy aquí para ayudar.',
          aiWelcomeMessageFr: 'Bonjour ! Je suis votre guide virtuel et je suis là pour vous aider.',
          button1Text: 'O que visitar',
          button1Function: 'O que visitar no parque?',
          button2Text: 'O que comer',
          button2Function: 'O que comer no parque?',
          button3Text: '',
          button3Function: ''
        });
    // Reset traduções de chat
    setChatConfigEn({
      welcomeTitle: 'WELCOME TO THE VIRTUAL GUIDE',
      aiWelcomeMessage: 'Hello! I am your virtual guide and I am here to help.',
      button1Text: 'What to visit',
      button1Function: 'What should I visit in the park?',
      button2Text: 'Where to eat',
      button2Function: 'Where can I eat in the park?',
      button3Text: '',
      button3Function: ''
    });
    setChatConfigEs({
      welcomeTitle: 'BIENVENIDO AL GUÍA VIRTUAL',
      aiWelcomeMessage: '¡Hola! Soy tu guía virtual y estoy aquí para ayudar.',
      button1Text: 'Qué visitar',
      button1Function: '¿Qué debo visitar en el parque?',
      button2Text: 'Dónde comer',
      button2Function: '¿Dónde puedo comer en el parque?',
      button3Text: '',
      button3Function: ''
    });
    setChatConfigFr({
      welcomeTitle: 'BIENVENUE DANS LE GUIDE VIRTUEL',
      aiWelcomeMessage: 'Bonjour ! Je suis votre guide virtuel et je suis là pour vous aider.',
      button1Text: 'Que visiter',
      button1Function: 'Que dois-je visiter dans le parc ?',
      button2Text: 'Où manger',
      button2Function: 'Où puis-je manger dans le parc ?',
      button3Text: '',
      button3Function: ''
    });
    setHumanChatEnabled(true);
    
    // Reset configurações de orçamento
    setBudgetConfig({
      enabled: true,
      title: 'Pedir orçamento',
      budgetButtonText: 'Pedir orçamento',
      email: '',
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
    
    setHelpPoints({
      point1: '',
      point2: '',
      point3: '',
      point4: '',
      point5: ''
    });
    setFaqData([]);
    setFaqDataEn([]);
    setFaqDataEs([]);
    setFaqDataFr([]);
  };

  // Abrir modal em modo edição e carregar dados do guia
  const handleEditGuide = async (guide: { slug: string; targetProject?: any | null }) => {
    try {
      setIsEditMode(true);
      setEditingGuide({ slug: guide.slug, targetProject: guide.targetProject || null });
      setShowCreateGuideModal(true);
      setCurrentStep(2); // Ir diretamente ao formulário principal
      setCreating(false);

      // Usar sempre o projeto virtualchat-b0e17
      const db = targetDb;

      // Ler documento do guia
      const snap = await getDoc(doc(targetDb, 'guides', guide.slug));
      if (!snap.exists()) {
        alert('Não foi possível carregar os dados do guia para edição.');
        return;
      }
      const data = snap.data() as any;

      // Preencher estados com dados existentes
      setGuideData({
        name: data?.name || '',
        slug: data?.slug || guide.slug,
        company: data?.company || '',
        websiteUrl: data?.websiteUrl || '',
        metaTitle: data?.metaTitle || '',
        metaDescription: data?.metaDescription || '',
        companyIconURL: data?.companyIconURL || '',
        gradientStartColor: data?.gradientStartColor || '#ff6b6b',
        gradientEndColor: data?.gradientEndColor || '#4ecdc4',
        humanChatNotificationEmail: String((data as any)?.humanChatNotificationEmail || '')
      });
      setSystemPrompt(data?.systemPrompt || '');
        setChatConfig({
          welcomeTitle: data?.chatConfig?.welcomeTitle || 'BEM-VINDO AO GUIA VIRTUAL',
          aiWelcomeMessage: data?.chatConfig?.aiWelcomeMessage || 'Olá! Sou o teu guia virtual e estou aqui para ajudar.',
          aiWelcomeMessageEn: data?.chatConfig?.aiWelcomeMessageEn || 'Hello! I am your virtual guide and I am here to help.',
          aiWelcomeMessageEs: data?.chatConfig?.aiWelcomeMessageEs || '¡Hola! Soy tu guía virtual y estoy aquí para ayudar.',
          aiWelcomeMessageFr: data?.chatConfig?.aiWelcomeMessageFr || 'Bonjour ! Je suis votre guide virtuel et je suis là pour vous aider.',
          button1Text: data?.chatConfig?.button1Text || '',
          button1Function: data?.chatConfig?.button1Function || '',
          button2Text: data?.chatConfig?.button2Text || '',
          button2Function: data?.chatConfig?.button2Function || '',
          button3Text: data?.chatConfig?.button3Text || '',
          button3Function: data?.chatConfig?.button3Function || ''
        });
      setHumanChatEnabled(!!data?.humanChatEnabled);
      
      // Carregar configurações de orçamento
      if (data?.budgetConfig) {
        console.log('🔄 Carregando budgetConfig do Firebase:', data.budgetConfig);
        console.log('📊 Campos carregados:', Object.keys(data.budgetConfig.fields || {}));
        if (!data.budgetConfig.budgetButtonText) data.budgetConfig.budgetButtonText = data.budgetConfig.title || 'Pedir Orçamento';
        setBudgetConfig(data.budgetConfig);
        setOriginalBudgetFields(data.budgetConfig.fields || {});
      } else {
        console.log('❌ Nenhum budgetConfig encontrado no Firebase');
        setOriginalBudgetFields({});
      }
      
      const cbl = (data as any)?.chatConfigByLang || null;
      if (cbl?.en) setChatConfigEn({ ...chatConfigEn, ...cbl.en });
      if (cbl?.es) setChatConfigEs({ ...chatConfigEs, ...cbl.es });
      if (cbl?.fr) setChatConfigFr({ ...chatConfigFr, ...cbl.fr });
      // Novos campos: carregar flags/URL existentes
      try {
        setDisableQuickButtons(!!(data as any)?.quickButtonsDisabled);
        setQuickAreaImageUrl((data as any)?.quickAreaImageURL || '');
        setQuickAreaImageLink((data as any)?.quickAreaImageLink || '');
      } catch {}
      // Removido: carregamento de helpPoints
      setFaqData(Array.isArray(data?.faq) ? data.faq.map((category: any) => ({
        ...category,
        questions: category.questions.map((q: any) => ({
          ...q,
          images: q.images || []
        }))
      })) : []);
      
      // Carregar FAQs multi-idioma
      const fbl = (data as any)?.faqByLang || null;
      if (fbl?.pt) setFaqData(Array.isArray(fbl.pt) ? fbl.pt.map((category: any) => ({
        ...category,
        questions: category.questions.map((q: any) => ({
          ...q,
          images: q.images || []
        }))
      })) : []);
      if (fbl?.en) setFaqDataEn(Array.isArray(fbl.en) ? fbl.en.map((category: any) => ({
        ...category,
        questions: category.questions.map((q: any) => ({
          ...q,
          images: q.images || []
        }))
      })) : []);
      if (fbl?.es) setFaqDataEs(Array.isArray(fbl.es) ? fbl.es.map((category: any) => ({
        ...category,
        questions: category.questions.map((q: any) => ({
          ...q,
          images: q.images || []
        }))
      })) : []);
      if (fbl?.fr) setFaqDataFr(Array.isArray(fbl.fr) ? fbl.fr.map((category: any) => ({
        ...category,
        questions: category.questions.map((q: any) => ({
          ...q,
          images: q.images || []
        }))
      })) : []);
      // Removido: carregamento de contactInfo
      setExistingAssets({
        background: data?.backgroundVideoURL || null,
        mobileTabletBackground: data?.mobileTabletBackgroundVideoURL || null,
        welcome: data?.welcomeVideoURL || null,
        chatIcon: data?.chatIconURL || null,
        companyIcon: data?.companyIconURL || null,
        captions: data?.captions || null,
        captionsByLang: (data as any)?.captionsByLang || null
      });
    } catch (err) {
      console.error('Erro ao carregar guia para edição:', err);
      alert('Erro ao preparar edição do guia.');
    }
  };

  const handleNextStep = async () => {
    if (currentStep === 1) {
      // Passo 2: Informações do Guia
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!isEditMode) {
        // Validar slug único antes de avançar (apenas na criação)
        const exists = await slugExists(guideData.slug);
        if (exists) {
          alert(`Já existe um guia com o link "/${guideData.slug}". Escolha outro nome de link.`);
          return;
        }
      }
      // Passo 3: System Prompt
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Passo 4: Upload de Vídeos
      setCurrentStep(4);
    } else if (currentStep === 4) {
      // Passo 5: Ícone do Chat
      setCurrentStep(5);
    } else if (currentStep === 5) {
      // Passo 6: Configuração do Chat
      setCurrentStep(6);
    } else if (currentStep === 6) {
      // Passo 7: Configuração do Formulário de Orçamento
      setCurrentStep(7);
    } else if (currentStep === 7) {
      // Ir diretamente para FAQs (passo 9) – formulário de seguidores removido
      setCurrentStep(9);
    } else if (currentStep === 9) {
      if (isEditMode) {
        await handleSaveGuideEdits();
      } else {
        handleCreateGuideSubmit();
      }
    }
  };

  const handleBackStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 4) {
      setCurrentStep(3);
    } else if (currentStep === 5) {
      setCurrentStep(4);
    } else if (currentStep === 6) {
      setCurrentStep(5);
    } else if (currentStep === 7) {
      setCurrentStep(6);
    } else if (currentStep === 9) {
      // Voltar de FAQs para Configuração do Formulário de Orçamento (7)
      setCurrentStep(7);
    }
  };

  // Função para extrair o nome do ficheiro de um URL
  const extractFileNameFromUrl = (url: string | null): string | null => {
    if (!url) return null;
    try {
      const path = url.split('/').pop();
      return path || null;
    } catch {
      return null;
    }
  };

  // Função para apagar ficheiros antigos específicos
  const deleteOldFiles = async (oldUrls: (string | null)[], guideSlug: string) => {
    const filesToDelete = oldUrls
      .map(url => extractFileNameFromUrl(url))
      .filter((fileName): fileName is string => fileName !== null);

    if (filesToDelete.length === 0) return;

    try {
      
      
      // Apagar cada ficheiro individualmente
      for (const fileName of filesToDelete) {
        try {
          const response = await fetch('/api/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              guideSlug, 
              fileName 
            })
          });
          
          if (response.ok) {
            
          } else {
            console.warn(`⚠️ Falha ao apagar ficheiro: ${fileName}`);
          }
        } catch (error) {
          console.warn(`⚠️ Erro ao apagar ficheiro ${fileName}:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro geral ao apagar ficheiros antigos:', error);
    }
  };

  // Guardar alterações em modo edição
  const handleSaveGuideEdits = async () => {
    if (!editingGuide?.slug) return;
    try {
      setCreating(true);
      // Usar sempre o projeto virtualchat-b0e17
      const db = targetDb;

      // Guardar URLs antigos para limpeza posterior
      const oldBackgroundURL = existingAssets.background ?? null;
      const oldWelcomeURL = existingAssets.welcome ?? null;
      const oldChatIconURL = existingAssets.chatIcon ?? null;
      const oldCaptionsDesktopURL = existingAssets.captions?.desktop ?? null;
      const oldCaptionsTabletURL = existingAssets.captions?.tablet ?? null;
      const oldCaptionsMobileURL = existingAssets.captions?.mobile ?? null;
      const oldCaptionsByLang = existingAssets.captionsByLang || null;

      // Fazer upload de novos ficheiros, mantendo os existentes quando não houver novos
      let finalBackgroundURL = existingAssets.background ?? null;
      let finalMobileTabletBackgroundURL = existingAssets.mobileTabletBackground ?? null;
      let finalWelcomeURL = existingAssets.welcome ?? null;
      let finalChatIconURL = existingAssets.chatIcon ?? null;
      let finalCompanyIconURL = existingAssets.companyIcon ?? null;
      let finalCaptionsDesktopURL = existingAssets.captions?.desktop ?? null;
      let finalCaptionsTabletURL = existingAssets.captions?.tablet ?? null;
      let finalCaptionsMobileURL = existingAssets.captions?.mobile ?? null;
      let finalCaptionsByLang: any = oldCaptionsByLang ? { ...oldCaptionsByLang } : {};

      if (backgroundVideoFile) {
        const backgroundResult = await uploadVideo(backgroundVideoFile, guideData.slug.trim(), 'background', 
          (progress: UploadProgress) => {
            setBackgroundUploadProgress(progress.percentage);
          });
        finalBackgroundURL = backgroundResult.path;
      }
      if (mobileTabletBackgroundVideoFile) {
        const mobileTabletBackgroundResult = await uploadVideo(mobileTabletBackgroundVideoFile, guideData.slug.trim(), 'mobileTabletBackground', 
          (progress: UploadProgress) => {
            setMobileTabletBackgroundUploadProgress(progress.percentage);
          });
        finalMobileTabletBackgroundURL = mobileTabletBackgroundResult.path;
      }
      if (welcomeVideoFile) {
        const welcomeResult = await uploadVideo(welcomeVideoFile, guideData.slug.trim(), 'welcome',
          (progress: UploadProgress) => {
            setWelcomeUploadProgress(progress.percentage);
          });
        finalWelcomeURL = welcomeResult.path;
      }
      if (chatIconFile) {
        setChatIconUploadProgress(50);
        finalChatIconURL = await copyImageToPublic(chatIconFile, guideData.slug.trim(), 'chatIcon');
        setChatIconUploadProgress(100);
      }
      if (companyIconFile) {
        finalCompanyIconURL = await copyImageToPublic(companyIconFile, guideData.slug.trim(), 'companyIcon');
      }
      if (captionsDesktopFile) {
        setCaptionsUploadProgress(prev => ({ ...prev, desktop: 50 }));
        finalCaptionsDesktopURL = await copyCaptionsToPublic(captionsDesktopFile, guideData.slug.trim(), 'desktop', 'pt');
        setCaptionsUploadProgress(prev => ({ ...prev, desktop: 100 }));
      }
      if (captionsTabletFile) {
        setCaptionsUploadProgress(prev => ({ ...prev, tablet: 50 }));
        finalCaptionsTabletURL = await copyCaptionsToPublic(captionsTabletFile, guideData.slug.trim(), 'tablet', 'pt');
        setCaptionsUploadProgress(prev => ({ ...prev, tablet: 100 }));
      }
      if (captionsMobileFile) {
        setCaptionsUploadProgress(prev => ({ ...prev, mobile: 50 }));
        finalCaptionsMobileURL = await copyCaptionsToPublic(captionsMobileFile, guideData.slug.trim(), 'mobile', 'pt');
        setCaptionsUploadProgress(prev => ({ ...prev, mobile: 100 }));
      }

      // Upload de EN
      if (captionsEnDesktopFile) {
        finalCaptionsByLang.en = finalCaptionsByLang.en || {};
        finalCaptionsByLang.en.desktop = await copyCaptionsToPublic(captionsEnDesktopFile, guideData.slug.trim(), 'desktop', 'en');
      }
      if (captionsEnTabletFile) {
        finalCaptionsByLang.en = finalCaptionsByLang.en || {};
        finalCaptionsByLang.en.tablet = await copyCaptionsToPublic(captionsEnTabletFile, guideData.slug.trim(), 'tablet', 'en');
      }
      if (captionsEnMobileFile) {
        finalCaptionsByLang.en = finalCaptionsByLang.en || {};
        finalCaptionsByLang.en.mobile = await copyCaptionsToPublic(captionsEnMobileFile, guideData.slug.trim(), 'mobile', 'en');
      }

      // Upload de ES
      if (captionsEsDesktopFile) {
        finalCaptionsByLang.es = finalCaptionsByLang.es || {};
        finalCaptionsByLang.es.desktop = await copyCaptionsToPublic(captionsEsDesktopFile, guideData.slug.trim(), 'desktop', 'es');
      }
      if (captionsEsTabletFile) {
        finalCaptionsByLang.es = finalCaptionsByLang.es || {};
        finalCaptionsByLang.es.tablet = await copyCaptionsToPublic(captionsEsTabletFile, guideData.slug.trim(), 'tablet', 'es');
      }
      if (captionsEsMobileFile) {
        finalCaptionsByLang.es = finalCaptionsByLang.es || {};
        finalCaptionsByLang.es.mobile = await copyCaptionsToPublic(captionsEsMobileFile, guideData.slug.trim(), 'mobile', 'es');
      }

      // Upload de FR
      if (captionsFrDesktopFile) {
        finalCaptionsByLang.fr = finalCaptionsByLang.fr || {};
        finalCaptionsByLang.fr.desktop = await copyCaptionsToPublic(captionsFrDesktopFile, guideData.slug.trim(), 'desktop', 'fr');
      }
      if (captionsFrTabletFile) {
        finalCaptionsByLang.fr = finalCaptionsByLang.fr || {};
        finalCaptionsByLang.fr.tablet = await copyCaptionsToPublic(captionsFrTabletFile, guideData.slug.trim(), 'tablet', 'fr');
      }
      if (captionsFrMobileFile) {
        finalCaptionsByLang.fr = finalCaptionsByLang.fr || {};
        finalCaptionsByLang.fr.mobile = await copyCaptionsToPublic(captionsFrMobileFile, guideData.slug.trim(), 'mobile', 'fr');
      }

      console.log('💾 Guardando dados do guia...');
      console.log('📊 budgetConfig atual:', budgetConfig);
      console.log('🔧 Campos do budgetConfig:', Object.keys(budgetConfig.fields || {}));

      const updatePayload: any = {
        name: guideData.name.trim(),
        // slug não é alterado em edição para simplificar
        company: guideData.company.trim(),
        websiteUrl: (() => { const v = String((guideData as any).websiteUrl || '').trim(); if (!v) return ''; return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/*/, '')}`; })(),
        metaTitle: (guideData as any).metaTitle?.trim?.() || '',
        metaDescription: (guideData as any).metaDescription?.trim?.() || '',
        gradientStartColor: (guideData as any).gradientStartColor || '#ff6b6b',
        gradientEndColor: (guideData as any).gradientEndColor || '#4ecdc4',
        systemPrompt: systemPrompt.trim(),
        // Email de notificação quando chat humano é iniciado
        humanChatNotificationEmail: String((guideData as any).humanChatNotificationEmail || '').trim(),
        chatConfig: {
          welcomeTitle: chatConfig.welcomeTitle.trim(),
          aiWelcomeMessage: chatConfig.aiWelcomeMessage.trim(),
          aiWelcomeMessageEn: chatConfig.aiWelcomeMessageEn.trim(),
          aiWelcomeMessageEs: chatConfig.aiWelcomeMessageEs.trim(),
          aiWelcomeMessageFr: chatConfig.aiWelcomeMessageFr.trim(),
          button1Text: chatConfig.button1Text.trim(),
          button1Function: chatConfig.button1Function.trim(),
          button2Text: chatConfig.button2Text.trim(),
          button2Function: chatConfig.button2Function.trim(),
          button3Text: chatConfig.button3Text.trim(),
          button3Function: chatConfig.button3Function.trim()
        },
        chatConfigByLang: {
          en: chatConfigEn,
          es: chatConfigEs,
          fr: chatConfigFr,
          pt: chatConfig,
        },
        budgetConfig: budgetConfig,
        chatIconURL: finalChatIconURL,
        companyIconURL: finalCompanyIconURL,
        backgroundVideoURL: finalBackgroundURL,
        mobileTabletBackgroundVideoURL: finalMobileTabletBackgroundURL,
        welcomeVideoURL: finalWelcomeURL,
        captions: { desktop: finalCaptionsDesktopURL, tablet: finalCaptionsTabletURL, mobile: finalCaptionsMobileURL },
        captionsByLang: Object.keys(finalCaptionsByLang).length ? finalCaptionsByLang : null,
        // Removido: helpPoints
        humanChatEnabled: !!humanChatEnabled,
        // Novas flags do chat
        quickButtonsDisabled: !!disableQuickButtons,
        quickAreaImageURL: quickAreaImageUrl || '',
        faq: faqDataRef.current.map(category => ({
          name: category.name,
          questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
        })),
        faqByLang: {
          pt: faqDataRef.current.map(category => ({
            name: category.name,
            questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
          })),
          en: faqDataEnRef.current.map(category => ({
            name: category.name,
            questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
          })),
          es: faqDataEsRef.current.map(category => ({
            name: category.name,
            questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
          })),
          fr: faqDataFrRef.current.map(category => ({
            name: category.name,
            questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
          }))
        },
        // Removido: contactInfo,
        updatedAt: serverTimestamp()
      };

      // Persistir todo o budgetConfig para garantir remoções de chaves
      // setDoc com merge:true não remove chaves antigas; por isso, fazemos updateDoc explícito do budgetConfig
      await setDoc(doc(db, 'guides', editingGuide.slug), updatePayload, { merge: true });
      // Forçar persistência explícita dos campos novos mesmo que o merge não os escreva por algum motivo
      await updateDoc(doc(db, 'guides', editingGuide.slug), {
        budgetConfig: budgetConfig,
        quickAreaImageURL: quickAreaImageUrl || '',
        quickAreaImageLink: quickAreaImageLink || '',
        quickButtonsDisabled: !!disableQuickButtons,
      });
      
      console.log('✅ Dados guardados no Firebase com sucesso!');
      console.log('🔍 Verificando dados guardados...');
      
      // Verificar se os dados foram guardados corretamente
      const verifyDoc = await getDoc(doc(db, 'guides', editingGuide.slug));
      if (verifyDoc.exists()) {
        const savedData = verifyDoc.data();
        console.log('📊 Dados guardados no Firebase:', savedData);
        console.log('💰 budgetConfig guardado:', savedData.budgetConfig);
        console.log('🔧 Campos guardados:', Object.keys(savedData.budgetConfig?.fields || {}));
      }

      alert('Alterações guardadas com sucesso!');
      // Manter modal aberta após guardar (não fechar automaticamente)
      // setShowCreateGuideModal(false);
      // setIsEditMode(false);
      // setEditingGuide(null);

      // Limpar os campos de upload
      setBackgroundVideoFile(null);
      setMobileTabletBackgroundVideoFile(null);
      setWelcomeVideoFile(null);
      setChatIconFile(null);
      setCaptionsDesktopFile(null);
      setCaptionsTabletFile(null);
      setCaptionsMobileFile(null);
      setCaptionsUploadProgress({ desktop: 0, tablet: 0, mobile: 0 });
      setBackgroundUploadProgress(0);
      setMobileTabletBackgroundUploadProgress(0);
      setWelcomeUploadProgress(0);
      setChatIconUploadProgress(0);
      setQuickAreaImageFile(null);
      setQuickAreaImageFile(null);

      // Apagar ficheiros antigos APENAS se foram substituídos nesta edição
      const filesToMaybeDelete: (string | null)[] = [];
      if (backgroundVideoFile && oldBackgroundURL && oldBackgroundURL !== finalBackgroundURL) {
        filesToMaybeDelete.push(oldBackgroundURL);
      }
      if (welcomeVideoFile && oldWelcomeURL && oldWelcomeURL !== finalWelcomeURL) {
        filesToMaybeDelete.push(oldWelcomeURL);
      }
      if (chatIconFile && oldChatIconURL && oldChatIconURL !== finalChatIconURL) {
        filesToMaybeDelete.push(oldChatIconURL);
      }
      if (captionsDesktopFile && oldCaptionsDesktopURL && oldCaptionsDesktopURL !== finalCaptionsDesktopURL) {
        filesToMaybeDelete.push(oldCaptionsDesktopURL);
      }
      if (captionsTabletFile && oldCaptionsTabletURL && oldCaptionsTabletURL !== finalCaptionsTabletURL) {
        filesToMaybeDelete.push(oldCaptionsTabletURL);
      }
      if (captionsMobileFile && oldCaptionsMobileURL && oldCaptionsMobileURL !== finalCaptionsMobileURL) {
        filesToMaybeDelete.push(oldCaptionsMobileURL);
      }

      if (filesToMaybeDelete.length > 0) {
        deleteOldFiles(filesToMaybeDelete, guideData.slug);
      }
    } catch (error) {
      console.error('Erro ao guardar alterações do guia:', error);
      alert('Falha ao guardar alterações do guia.');
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setGuideData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Removido: handleFirebaseChange - usando sempre FIXED_FIREBASE_CONFIG

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Verificar se já existe um guia com este slug (apenas no projeto virtualchat-b0e17)
  const slugExists = async (slug: string): Promise<boolean> => {
    const clean = slug.trim();
    if (!clean) return false;
    try {
      // Verificar apenas no projeto virtualchat-b0e17
      const targetDoc = await getDoc(doc(targetDb, 'guides', clean));
      return targetDoc.exists();
    } catch (err) {
      console.error('Erro ao verificar duplicação de slug:', err);
      // Em caso de erro, bloquear criação por segurança
      return true;
    }
  };

  const handleNameChange = (value: string) => {
    setGuideData(prev => ({
      ...prev,
      name: value
    }));
  };

  const handleCreateGuideSubmit = async () => {
    if (creating) return;
    try {
      setCreating(true);
      
      // Verificação final anti-duplicação
      const exists = await slugExists(guideData.slug);
      if (exists) {
        alert(`Não é possível criar. O link "/${guideData.slug}" já existe.`);
        setCreating(false);
        return;
      }
      // Usar sempre o projeto virtualchat-b0e17
      const db = targetDb;

      // Guardar o guia na coleção 'guides' (doc id = slug)
      const guideId = (globalThis as any).crypto?.randomUUID?.() ? (globalThis as any).crypto.randomUUID() : `guide_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      // Fazer upload dos vídeos se fornecidos
      let uploadedBackgroundURL: string | null = null;
      let uploadedMobileTabletBackgroundURL: string | null = null;
      let uploadedWelcomeURL: string | null = null;
      let uploadedChatIconURL: string | null = null;
      let uploadedCompanyIconURL: string | null = null;
      let uploadedCaptionsDesktopURL: string | null = null;
      let uploadedCaptionsTabletURL: string | null = null;
      let uploadedCaptionsMobileURL: string | null = null;

      // Processar vídeo principal
      const toStreamUrl = (url: string) => {
        // Guardar sempre o URL "real" (sem proxy). O proxy será aplicado no frontoffice se necessário.
        try {
          const u = new URL(url);
          // Se o utilizador colar já uma URL proxied, extraímos o valor do parâmetro `file` para persistir o alvo real
          if (u.pathname.includes('/vg-video/') && u.searchParams.get('file')) {
            const file = u.searchParams.get('file') as string;
            // Reconstruir URL absoluto para visitfoods caso `file` seja um caminho absoluto
            if (file.startsWith('/')) return `https://visitfoods.pt${file}`;
            return file;
          }
        } catch {}
        return url;
      };

      if (backgroundVideoFile) {
        try {
          const backgroundResult = await uploadVideo(backgroundVideoFile, guideData.slug.trim(), 'background',
            (progress: UploadProgress) => {
              setBackgroundUploadProgress(progress.percentage);
            });
          const relativePath = backgroundResult.path;
          // Guardar exatamente o URL devolvido pelo upload (sem proxy)
          uploadedBackgroundURL = toStreamUrl(relativePath);
          
        } catch (error) {
          console.error('Erro ao processar vídeo principal:', error);
          alert('Erro ao processar vídeo principal. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar vídeo de fundo para mobile/tablet
      if (mobileTabletBackgroundVideoFile) {
        try {
          const mobileTabletBackgroundResult = await uploadVideo(mobileTabletBackgroundVideoFile, guideData.slug.trim(), 'mobileTabletBackground',
            (progress: UploadProgress) => {
              setMobileTabletBackgroundUploadProgress(progress.percentage);
            });
          const relativePath = mobileTabletBackgroundResult.path;
          // Guardar exatamente o URL devolvido pelo upload (sem proxy)
          uploadedMobileTabletBackgroundURL = toStreamUrl(relativePath);
          
        } catch (error) {
          console.error('Erro ao processar vídeo mobile/tablet:', error);
          alert('Erro ao processar vídeo mobile/tablet. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar vídeo de boas‑vindas
      if (welcomeVideoFile) {
        try {
          const welcomeResult = await uploadVideo(welcomeVideoFile, guideData.slug.trim(), 'welcome',
            (progress: UploadProgress) => {
              setWelcomeUploadProgress(progress.percentage);
            });
          const relativePath = welcomeResult.path;
          // Guardar exatamente o URL devolvido pelo upload (sem proxy)
          uploadedWelcomeURL = toStreamUrl(relativePath);
          
        } catch (error) {
          console.error('Erro ao processar vídeo de boas‑vindas:', error);
          alert('Erro ao processar vídeo de boas‑vindas. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar ícone do chat
      if (chatIconFile) {
        try {
          setChatIconUploadProgress(50);
          const relativePath = await copyImageToPublic(chatIconFile, guideData.slug.trim(), 'chatIcon');
          uploadedChatIconURL = relativePath;
          setChatIconUploadProgress(100);
          
        } catch (error) {
          console.error('Erro ao processar ícone do chat:', error);
          alert('Erro ao processar a imagem do ícone do chat. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar ícone da empresa
      if (companyIconFile) {
        try {
          const relativePath = await copyImageToPublic(companyIconFile, guideData.slug.trim(), 'companyIcon');
          uploadedCompanyIconURL = relativePath;
        } catch (error) {
          console.error('Erro ao processar ícone da empresa:', error);
          alert('Erro ao processar a imagem do ícone da empresa. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar legendas (.vtt) - opcionais (PT)
      if (captionsDesktopFile) {
        try {
          setCaptionsUploadProgress(prev => ({ ...prev, desktop: 50 }));
          const relativePath = await copyCaptionsToPublic(captionsDesktopFile, guideData.slug.trim(), 'desktop', 'pt');
          uploadedCaptionsDesktopURL = relativePath;
          setCaptionsUploadProgress(prev => ({ ...prev, desktop: 100 }));
        } catch (error) {
          console.error('Erro ao processar legendas desktop:', error);
          alert('Erro ao processar legendas desktop. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      if (captionsTabletFile) {
        try {
          setCaptionsUploadProgress(prev => ({ ...prev, tablet: 50 }));
          const relativePath = await copyCaptionsToPublic(captionsTabletFile, guideData.slug.trim(), 'tablet', 'pt');
          uploadedCaptionsTabletURL = relativePath;
          setCaptionsUploadProgress(prev => ({ ...prev, tablet: 100 }));
        } catch (error) {
          console.error('Erro ao processar legendas tablet:', error);
          alert('Erro ao processar legendas tablet. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      if (captionsMobileFile) {
        try {
          setCaptionsUploadProgress(prev => ({ ...prev, mobile: 50 }));
          const relativePath = await copyCaptionsToPublic(captionsMobileFile, guideData.slug.trim(), 'mobile', 'pt');
          uploadedCaptionsMobileURL = relativePath;
          setCaptionsUploadProgress(prev => ({ ...prev, mobile: 100 }));
        } catch (error) {
          console.error('Erro ao processar legendas mobile:', error);
          alert('Erro ao processar legendas mobile. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar legendas EN/ES/FR
      const uploadedByLang: any = {};
      const slugTrim = guideData.slug.trim();
      // EN
      if (captionsEnDesktopFile) uploadedByLang.en = { ...(uploadedByLang.en || {}), desktop: await copyCaptionsToPublic(captionsEnDesktopFile, slugTrim, 'desktop', 'en') };
      if (captionsEnTabletFile)  uploadedByLang.en = { ...(uploadedByLang.en || {}), tablet:  await copyCaptionsToPublic(captionsEnTabletFile,  slugTrim, 'tablet',  'en') };
      if (captionsEnMobileFile)  uploadedByLang.en = { ...(uploadedByLang.en || {}), mobile:  await copyCaptionsToPublic(captionsEnMobileFile,  slugTrim, 'mobile',  'en') };
      // ES
      if (captionsEsDesktopFile) uploadedByLang.es = { ...(uploadedByLang.es || {}), desktop: await copyCaptionsToPublic(captionsEsDesktopFile, slugTrim, 'desktop', 'es') };
      if (captionsEsTabletFile)  uploadedByLang.es = { ...(uploadedByLang.es || {}), tablet:  await copyCaptionsToPublic(captionsEsTabletFile,  slugTrim, 'tablet',  'es') };
      if (captionsEsMobileFile)  uploadedByLang.es = { ...(uploadedByLang.es || {}), mobile:  await copyCaptionsToPublic(captionsEsMobileFile,  slugTrim, 'mobile',  'es') };
      // FR
      if (captionsFrDesktopFile) uploadedByLang.fr = { ...(uploadedByLang.fr || {}), desktop: await copyCaptionsToPublic(captionsFrDesktopFile, slugTrim, 'desktop', 'fr') };
      if (captionsFrTabletFile)  uploadedByLang.fr = { ...(uploadedByLang.fr || {}), tablet:  await copyCaptionsToPublic(captionsFrTabletFile,  slugTrim, 'tablet',  'fr') };
      if (captionsFrMobileFile)  uploadedByLang.fr = { ...(uploadedByLang.fr || {}), mobile:  await copyCaptionsToPublic(captionsFrMobileFile,  slugTrim, 'mobile',  'fr') };

      console.log('🆕 Criando novo guia...');
      console.log('📊 budgetConfig para criação:', budgetConfig);
      console.log('🔧 Campos do budgetConfig:', Object.keys(budgetConfig.fields || {}));

      const guideDoc = {
        id: guideId,
        name: guideData.name.trim(),
        slug: guideData.slug.trim(),
        company: guideData.company.trim(),
        websiteUrl: (() => { const v = String((guideData as any).websiteUrl || '').trim(); if (!v) return ''; return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/*/, '')}`; })(),
        metaTitle: guideData.metaTitle.trim(),
        metaDescription: guideData.metaDescription.trim(),
        gradientStartColor: (guideData as any).gradientStartColor || '#ff6b6b',
        gradientEndColor: (guideData as any).gradientEndColor || '#4ecdc4',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        backgroundVideoURL: uploadedBackgroundURL,
        mobileTabletBackgroundVideoURL: uploadedMobileTabletBackgroundURL,
        welcomeVideoURL: uploadedWelcomeURL,
        captions: {
          desktop: uploadedCaptionsDesktopURL,
          tablet: uploadedCaptionsTabletURL,
          mobile: uploadedCaptionsMobileURL,
        },
        // Prompt do sistema específico deste guia (apenas na BD de destino)
        systemPrompt: systemPrompt.trim(),
        // Configuração do chat
        chatConfig: {
          welcomeTitle: chatConfig.welcomeTitle.trim(),
          aiWelcomeMessage: chatConfig.aiWelcomeMessage.trim(),
          aiWelcomeMessageEn: chatConfig.aiWelcomeMessageEn.trim(),
          aiWelcomeMessageEs: chatConfig.aiWelcomeMessageEs.trim(),
          aiWelcomeMessageFr: chatConfig.aiWelcomeMessageFr.trim(),
          button1Text: chatConfig.button1Text.trim(),
          button1Function: chatConfig.button1Function.trim(),
          button2Text: chatConfig.button2Text.trim(),
          button2Function: chatConfig.button2Function.trim(),
          button3Text: chatConfig.button3Text.trim(),
          button3Function: chatConfig.button3Function.trim()
        },
        // Traduções dos botões rápidos do chat
        chatConfigByLang: {
          en: {
            welcomeTitle: chatConfigEn.welcomeTitle.trim(),
            aiWelcomeMessage: chatConfigEn.aiWelcomeMessage.trim(),
            button1Text: chatConfigEn.button1Text.trim(),
            button1Function: chatConfigEn.button1Function.trim(),
            button2Text: chatConfigEn.button2Text.trim(),
            button2Function: chatConfigEn.button2Function.trim(),
            button3Text: chatConfigEn.button3Text.trim(),
            button3Function: chatConfigEn.button3Function.trim()
          },
          es: {
            welcomeTitle: chatConfigEs.welcomeTitle.trim(),
            aiWelcomeMessage: chatConfigEs.aiWelcomeMessage.trim(),
            button1Text: chatConfigEs.button1Text.trim(),
            button1Function: chatConfigEs.button1Function.trim(),
            button2Text: chatConfigEs.button2Text.trim(),
            button2Function: chatConfigEs.button2Function.trim(),
            button3Text: chatConfigEs.button3Text.trim(),
            button3Function: chatConfigEs.button3Function.trim()
          },
          fr: {
            welcomeTitle: chatConfigFr.welcomeTitle.trim(),
            aiWelcomeMessage: chatConfigFr.aiWelcomeMessage.trim(),
            button1Text: chatConfigFr.button1Text.trim(),
            button1Function: chatConfigFr.button1Function.trim(),
            button2Text: chatConfigFr.button2Text.trim(),
            button2Function: chatConfigFr.button2Function.trim(),
            button3Text: chatConfigFr.button3Text.trim(),
            button3Function: chatConfigFr.button3Function.trim()
          },
          pt: {
            welcomeTitle: chatConfig.welcomeTitle.trim(),
            aiWelcomeMessage: chatConfig.aiWelcomeMessage.trim(),
            button1Text: chatConfig.button1Text.trim(),
            button1Function: chatConfig.button1Function.trim(),
            button2Text: chatConfig.button2Text.trim(),
            button2Function: chatConfig.button2Function.trim(),
            button3Text: chatConfig.button3Text.trim(),
            button3Function: chatConfig.button3Function.trim()
          }
        },
        // Configurações do formulário de orçamento
        budgetConfig: budgetConfig,
        // Ícone do chat (avatar do guia real)
        chatIconURL: uploadedChatIconURL,
        // Ícone da empresa para header do chat
        companyIconURL: uploadedCompanyIconURL,
        // Pontos de ajuda que aparecem abaixo de "Como posso ajudar hoje?"
        // Removido: helpPoints,
        // Flag para ativar/desativar chat com guia real
        humanChatEnabled: !!humanChatEnabled,
        // Email de notificação quando chat humano é iniciado
        humanChatNotificationEmail: String((guideData as any).humanChatNotificationEmail || '').trim(),
        // FAQs
        faq: faqData.map(category => ({
          name: category.name,
          questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
        })),
        faqByLang: {
          pt: faqData.map(category => ({
            name: category.name,
            questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
          })),
          en: faqDataEn.map(category => ({
            name: category.name,
            questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
          })),
          es: faqDataEs.map(category => ({
            name: category.name,
            questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
          })),
          fr: faqDataFr.map(category => ({
            name: category.name,
            questions: category.questions.map(q => ({ question: q.question, answer: q.answer, images: q.images || [] }))
          }))
        },
        // Removido: contactInfo
      };

      await setDoc(doc(db, 'guides', guideDoc.slug), guideDoc);

      

      // Guardar o guia completo no projeto virtualchat-b0e17 (coleção 'guides')
      // Usar o guideDoc completo em vez de criar um novo documento reduzido
      await setDoc(doc(targetDb, 'guides', guideDoc.slug), guideDoc);
      
      console.log('✅ Guia criado no Firebase com sucesso!');
      console.log('🔍 Verificando dados criados...');
      
      // Verificar se os dados foram guardados corretamente
      const verifyDoc = await getDoc(doc(targetDb, 'guides', guideDoc.slug));
      if (verifyDoc.exists()) {
        const savedData = verifyDoc.data();
        console.log('📊 Dados criados no Firebase:', savedData);
        console.log('💰 budgetConfig criado:', savedData.budgetConfig);
        console.log('🔧 Campos criados:', Object.keys(savedData.budgetConfig?.fields || {}));
      }
      
      // Simular criação bem-sucedida
      alert('Guia criado com sucesso!');
      setShowCreateGuideModal(false);
      setCurrentStep(1);
      setCreating(false);
      // Limpar estados de upload para evitar re-uploads sem refresh
      setBackgroundVideoFile(null);
      setMobileTabletBackgroundVideoFile(null);
      setWelcomeVideoFile(null);
      setChatIconFile(null);
      setCompanyIconFile(null);
      setCaptionsDesktopFile(null);
      setCaptionsTabletFile(null);
      setCaptionsMobileFile(null);
      setCaptionsEnDesktopFile(null);
      setCaptionsEnTabletFile(null);
      setCaptionsEnMobileFile(null);
      setCaptionsEsDesktopFile(null);
      setCaptionsEsTabletFile(null);
      setCaptionsEsMobileFile(null);
      setCaptionsFrDesktopFile(null);
      setCaptionsFrTabletFile(null);
      setCaptionsFrMobileFile(null);
      setBackgroundUploadProgress(0);
      setMobileTabletBackgroundUploadProgress(0);
      setWelcomeUploadProgress(0);
      setChatIconUploadProgress(0);
      setCaptionsUploadProgress({ desktop: 0, tablet: 0, mobile: 0 });
      
      // Opcional: atualizar assets existentes em memória para refletir o novo estado
      setExistingAssets({
        background: uploadedBackgroundURL,
        mobileTabletBackground: uploadedMobileTabletBackgroundURL,
        welcome: uploadedWelcomeURL,
        chatIcon: uploadedChatIconURL,
        companyIcon: uploadedCompanyIconURL,
        captions: {
          desktop: uploadedCaptionsDesktopURL,
          tablet: uploadedCaptionsTabletURL,
          mobile: uploadedCaptionsMobileURL
        },
        captionsByLang: uploadedByLang
      });

      // Redirecionar para a página de teste
      window.open(`http://localhost:3000/${guideData.slug}`, '_blank');
    } catch (error) {
      console.error('Erro ao criar guia:', error);
      alert('Erro ao criar guia. Verifique a consola para detalhes.');
      setCreating(false);
    }
  };

  // Apagar guia (projeto principal + projeto de destino, se existir)
  const handleDeleteGuide = async (guide: { slug: string; targetProject?: any | null }) => {
    if (!guide?.slug) return;
    
    // Verificar se o utilizador está autenticado
    if (!user || !user.id) {
      alert('Erro: Utilizador não autenticado. Faça login novamente.');
      return;
    }
    
    const confirmed = window.confirm(`Tem a certeza que pretende apagar o guia "${guide.slug}"? Esta ação é irreversível.`);
    if (!confirmed) return;
    
    try {
      setDeletingGuideId(guide.slug);
      
      
      

      // Nota: A autenticação é verificada no projeto principal (virtualguide-83bc3)
      // Não precisamos de verificar autenticação no projeto virtualchat-b0e17
      

      // Recuperar sessão para autenticação das APIs protegidas
      let sessionId: string | null = null;
      let token: string | null = null;
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('sessionData') : null;
        if (raw) {
          const parsed = JSON.parse(raw) as { sessionId?: string; token?: string };
          sessionId = parsed.sessionId || null;
          token = parsed.token || null;
        }
      } catch {}

      // 1) Remover do projeto virtualchat-b0e17 via API
      
      try {
        const response = await fetch('/api/delete-guide', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
          },
          body: JSON.stringify({
            slug: guide.slug,
            userId: user.id,
            userRole: user.role
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
      } catch (error) {
        console.error('❌ Erro ao remover do projeto virtualchat-b0e17:', error);
        throw new Error(`Falha ao remover do projeto virtualchat-b0e17: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }

      // 3) Remover também os ficheiros locais em /public/virtualchat/<slug>
      
      try {
        // Usar fetchWithAuth para enviar automaticamente x-api-key
        const { fetchWithAuth } = await import('../../../services/apiKeyService');
        const response = await fetchWithAuth('/api/delete-guide-assets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
          },
          body: JSON.stringify({ slug: guide.slug })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
      } catch (err) {
        console.error('⚠️ Aviso: falha ao remover assets locais do guia:', err);
        // Não interromper o processo se falhar nos assets locais
      }

      
      alert('Guia apagado com sucesso. Os ficheiros associados foram removidos.');
      
      // Recarregar a lista de guias
      // window.location.reload();
      
    } catch (error) {
      console.error('❌ Erro ao apagar guia:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      alert(`Falha ao apagar o guia: ${errorMessage}\n\nVerifique a consola para mais detalhes.`);
    } finally {
      setDeletingGuideId(null);
    }
  };

  // Ativar/Desativar guia (apenas no projeto virtualchat-b0e17)
  const handleToggleGuideActive = async (
    guide: { slug: string; targetProject?: any | null },
    newActive: boolean
  ) => {
    if (!guide?.slug) return;
    try {
      setTogglingGuideId(guide.slug);
      
      // Atualizar via API
      const response = await fetch('/api/toggle-guide-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: guide.slug,
          newActive,
          userId: user?.id || '',
          userRole: user?.role || 'user'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      
    } catch (error) {
      console.error('Erro ao atualizar estado do guia:', error);
      alert('Falha ao atualizar estado do guia.');
    } finally {
      setTogglingGuideId(null);
    }
  };

  const isFirebaseValid = () => {
    return true;
  };

  const isGuideFormValid = () => {
    return guideData.name.trim() !== '' && guideData.slug.trim() !== '';
  };

  // Funções para gerir as FAQs
  const addFaqCategory = () => {
    setFaqData(prev => [...prev, {
      name: "Nova Categoria",
      questions: [
        {
          question: "Nova Pergunta",
          answer: "Nova Resposta",
          images: []
        }
      ]
    }]);
  };

  const removeFaqCategory = (categoryIndex: number) => {
    setFaqData(prev => prev.filter((_, index) => index !== categoryIndex));
  };

  const updateFaqCategoryName = (categoryIndex: number, newName: string) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex ? { ...category, name: newName } : category
    ));
  };

  const addFaqQuestion = (categoryIndex: number) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex 
        ? { ...category, questions: [...category.questions, { question: "Nova Pergunta", answer: "Nova Resposta", images: [] }] }
        : category
    ));
  };

  const removeFaqQuestion = (categoryIndex: number, questionIndex: number) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex 
        ? { ...category, questions: category.questions.filter((_, qIndex) => qIndex !== questionIndex) }
        : category
    ));
  };

  const updateFaqQuestion = (categoryIndex: number, questionIndex: number, field: 'question' | 'answer', value: string) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex 
        ? { 
            ...category, 
            questions: category.questions.map((q, qIndex) => 
              qIndex === questionIndex 
                ? { ...q, [field]: value }
                : q
            )
          }
        : category
    ));
  };

  const uploadFaqImage = async (categoryIndex: number, questionIndex: number, file: File) => {
    const uploadKey = `${categoryIndex}-${questionIndex}`;
    try {
      setFaqImageUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
      
      const imageUrl = await copyImageToPublic(file, guideData.slug, 'faqImage');
      
      setFaqData(prev => prev.map((category, index) => 
        index === categoryIndex 
          ? { ...category, questions: category.questions.map((q, qIndex) => 
              qIndex === questionIndex 
                ? { ...q, images: [...(q.images || []), imageUrl] }
                : q
            )}
          : category
      ));
      
      setFaqImageUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
    } catch (error) {
      console.error('Erro ao fazer upload da imagem da FAQ:', error);
      setFaqImageUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
    }
  };

  const removeFaqImage = (categoryIndex: number, questionIndex: number, imageIndex: number) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex 
        ? { ...category, questions: category.questions.map((q, qIndex) => 
            qIndex === questionIndex 
              ? { ...q, images: (q.images || []).filter((_, imgIndex) => imgIndex !== imageIndex) }
              : q
          )}
        : category
    ));
  };

  // Componente interno para editar FAQs por idioma
  function FaqEditor(props: {
    lang: 'pt'|'en'|'es'|'fr';
    faqPt: typeof faqData; setFaqPt: typeof setFaqData;
    faqEn: typeof faqData; setFaqEn: React.Dispatch<React.SetStateAction<typeof faqData>>;
    faqEs: typeof faqData; setFaqEs: React.Dispatch<React.SetStateAction<typeof faqData>>;
    faqFr: typeof faqData; setFaqFr: React.Dispatch<React.SetStateAction<typeof faqData>>;
  }) {
    const { lang, faqPt, setFaqPt, faqEn, setFaqEn, faqEs, setFaqEs, faqFr, setFaqFr } = props;
    const isPt = lang === 'pt';
    const [localFaq, setLocalFaq] = useState<typeof faqData>(() => JSON.parse(JSON.stringify(isPt ? faqPt : lang==='en'?faqEn:lang==='es'?faqEs:faqFr)));
    const [isTranslating, setIsTranslating] = useState(false);
    const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const selectionRefs = useRef<Record<string, Range | null>>({});
    // Guardar rascunhos de respostas sem provocar re-render
    const draftAnswersRef = useRef<Record<string, string>>({});
    const preventBlurMouseDown = (e: React.MouseEvent) => { e.preventDefault(); };

    // Item ordenável para cada pergunta
    function SortableQuestion({ id, children }: { id: string; children: React.ReactNode }) {
      const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
      const style = {
        transform: CSS.Transform.toString(transform),
        transition,
      } as React.CSSProperties;
      return (
        <div ref={setNodeRef} style={style} {...attributes}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
            <div
              {...listeners}
              title="Arraste para reordenar"
              style={{ cursor: 'grab', userSelect: 'none', padding: 4, display: 'flex', alignItems: 'center' }}
            >
              ⋮⋮
            </div>
            <div style={{ flex: 1 }}>
              {children}
            </div>
          </div>
        </div>
      );
    }

    // Reordenar perguntas dentro de uma categoria
    const handleQuestionDragEnd = (categoryIndex: number, event: any) => {
      const { active, over } = event || {};
      if (!over || !active || active.id === over.id) return;
      const items = (localFaq?.[categoryIndex]?.questions || []).map((_, qIdx) => `q-${categoryIndex}-${qIdx}`);
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = (localFaq || []).map((c, i) => i === categoryIndex ? { ...c, questions: arrayMove(c.questions, oldIndex, newIndex) } : c);
      setLocalFaq(next);
      setTarget(next);
    };

    useEffect(() => {
      const source = isPt ? faqPt : lang==='en'?faqEn:lang==='es'?faqEs:faqFr;
      setLocalFaq(JSON.parse(JSON.stringify(source)));
    }, [lang, faqPt, faqEn, faqEs, faqFr, isPt]);

    const setTarget = (next: typeof faqData) => {
      if (isPt) { setFaqPt(next); faqDataRef.current = next; }
      else if (lang==='en') { setFaqEn(next as any); faqDataEnRef.current = next as any; }
      else if (lang==='es') { setFaqEs(next as any); faqDataEsRef.current = next as any; }
      else { setFaqFr(next as any); faqDataFrRef.current = next as any; }
    };

    // Componente TipTap local para o editor de resposta
    function TipTapFaqEditor({ cIdx, qIdx, value, onCommit }: { cIdx: number; qIdx: number; value: string; onCommit: (finalHtml: string) => void }) {
      // Evitar sobrescrever o conteúdo do editor a cada tecla: memorizar último HTML emitido pelo próprio editor
      const lastFromEditorRef = useRef<string>('');
      const editor = useEditor({
        extensions: [
          StarterKit.configure({
            heading: { levels: [3] }
          }),
          LinkExt.configure({ openOnClick: true, autolink: true, protocols: ['http', 'https', 'mailto', 'tel'] })
        ],
        content: value || '',
        immediatelyRender: false,
        editorProps: {
          attributes: {
            // Evitar saltos visuais e garantir área estável enquanto escreve
            // e forçar a cor do texto para preto
            style: 'min-height:120px; outline: none; color: #000;'
          }
        },
        onUpdate: ({ editor }) => {
          const html = editor.getHTML();
          const safe = sanitizeHtml(html);
          lastFromEditorRef.current = safe;
          // Guardar apenas em rascunho, sem atualizar estado (evita re-render e perda de foco)
          draftAnswersRef.current[`${cIdx}-${qIdx}`] = safe;
        }
      });

      useEffect(() => {
        if (!editor) return;
        // Se o valor externo mudou (troca de pergunta/categoria), sincronizar sem interferir com digitação
        const current = editor.getHTML();
        const safe = sanitizeHtml(value || '');
        // Ignorar atualizações que são reflexo do próprio editor (evita setContent a cada tecla)
        if (lastFromEditorRef.current === safe) return;
        if (safe !== current) {
          editor.commands.setContent(safe, { emitUpdate: false });
        }
      }, [value, editor]);

      return (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().undo().run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>↶</button>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().redo().run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>↷</button>
            <span style={{ width: 8 }} />
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().toggleBold().run()} style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>B</button>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().toggleItalic().run()} style={{ padding: '4px 8px', fontSize: 12, fontStyle: 'italic', cursor: 'pointer' }}>I</button>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Limpar</button>
            <span style={{ width: 8 }} />
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>H3</button>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().setParagraph().run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>P</button>
            <span style={{ width: 8 }} />
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().toggleBulletList().run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>• Lista</button>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().toggleOrderedList().run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>1. Lista</button>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().sinkListItem('listItem').run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>↦</button>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().liftListItem('listItem').run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>↤</button>
            <span style={{ width: 8 }} />
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => {
              const url = (window.prompt('URL do link (https://...)') || '').trim();
              if (!url) return;
              const safeUrl = /^https?:\/\/|^mailto:|^tel:/.test(url) ? url : `https://${url.replace(/^\/*/, '')}`;
              editor?.chain().focus().setLink({ href: safeUrl, target: '_blank', rel: 'noopener noreferrer' }).run();
            }} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Link</button>
            <button type="button" onMouseDown={preventBlurMouseDown} onClick={() => editor?.chain().focus().unsetLink().run()} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Remover Link</button>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: 6, background: '#fff', maxHeight: 260, minHeight: 120, overflow: 'auto', padding: 8 }}>
            <EditorContent
              editor={editor}
              onBlur={() => {
                try {
                  const key = `${cIdx}-${qIdx}`;
                  const current = draftAnswersRef.current[key] ?? sanitizeHtml(editor?.getHTML() || '');
                  onCommit(current);
                } catch {}
              }}
            />
          </div>
        </div>
      );
    }

    const addCategory = () => {
      const next = [...(localFaq||[]), { name: 'Nova Categoria', questions: [{ question: 'Nova Pergunta', answer: 'Nova Resposta', images: [] }] }];
      setLocalFaq(next);
      setTarget(next);
    };
    const removeCategory = (idx: number) => {
      const next = (localFaq||[]).filter((_, i) => i !== idx);
      setLocalFaq(next);
      setTarget(next);
    };
    const updateCategoryName = (idx: number, name: string) => {
      const next = (localFaq||[]).map((c, i) => i===idx?{...c, name}:c);
      setLocalFaq(next);
    };
    const addQuestion = (cIdx: number) => {
      const next = (localFaq||[]).map((c,i)=>i===cIdx?{...c, questions:[...c.questions,{question:'Nova Pergunta', answer:'Nova Resposta', images:[]}]}:c);
      setLocalFaq(next);
      setTarget(next);
    };
    const removeQuestion = (cIdx: number, qIdx: number) => {
      const next = (localFaq||[]).map((c,i)=>i===cIdx?{...c, questions:c.questions.filter((_,j)=>j!==qIdx)}:c);
      setLocalFaq(next);
      setTarget(next);
    };
    const updateQuestion = (cIdx: number, qIdx: number, field: 'question'|'answer', value: string) => {
      const next = (localFaq||[]).map((c,i)=>i===cIdx?{...c, questions:c.questions.map((q,j)=>j===qIdx?{...q, [field]: value}:q)}:c);
      setLocalFaq(next);
      // Só propagar para o estado pai no onBlur para evitar re-renderização durante digitação
    };

    // Mini editor: aplicar formatação via execCommand na seleção do editor
    const applyFormat = (
      cIdx: number,
      qIdx: number,
      action: 'bold'|'italic'|'h3'|'p'|'ul'|'ol'|'indent'|'outdent'|'link'|'unlink'|'removeFormat'|'undo'|'redo'
    ) => {
      const key = `${cIdx}-${qIdx}`;
      const el = editorRefs.current[key];
      if (!el) return;
      // Restaurar foco e seleção anterior
      try { el.focus(); } catch {}
      try {
        const sel = window.getSelection && window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          let range = selectionRefs.current[key];
          // Se não houver range válido, posicionar cursor no fim do editor
          if (!range || !el.contains(range.startContainer)) {
            try {
              const r = document.createRange();
              r.selectNodeContents(el);
              r.collapse(false);
              range = r;
              selectionRefs.current[key] = r;
            } catch {}
          }
          if (range) sel.addRange(range);
        }
      } catch {}

      try {
        // Helper: garantir seleção dentro do editor
        const ensureSelectionInside = () => {
          const sel = window.getSelection && window.getSelection();
          if (!sel) return null;
          let range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
          if (!range || !el.contains(range.commonAncestorContainer)) {
            const r = document.createRange();
            r.selectNodeContents(el);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
            range = r;
          }
          return { sel, range } as const;
        };
        // Helper: envolver seleção com tag
        const wrapSelection = (tag: 'strong'|'em') => {
          const ctx = ensureSelectionInside();
          if (!ctx) return false;
          const { sel, range } = ctx;
          if (!range || range.collapsed) return false;
          try {
            const wrapper = document.createElement(tag);
            range.surroundContents(wrapper);
            // Atualizar seleção para depois do wrapper
            sel.removeAllRanges();
            const after = document.createRange();
            after.selectNodeContents(wrapper);
            after.collapse(false);
            sel.addRange(after);
            return true;
          } catch {
            return false;
          }
        };

        if (action === 'h3') {
          document.execCommand('formatBlock', false, 'h3');
        } else if (action === 'p') {
          document.execCommand('formatBlock', false, 'p');
        } else if (action === 'ul') {
          document.execCommand('insertUnorderedList');
        } else if (action === 'ol') {
          document.execCommand('insertOrderedList');
        } else if (action === 'indent') {
          document.execCommand('indent');
        } else if (action === 'outdent') {
          document.execCommand('outdent');
        } else if (action === 'link') {
          const url = (window.prompt('URL do link (https://...)') || '').trim();
          if (url) {
            const safeUrl = /^https?:\/\/|^mailto:|^tel:/.test(url) ? url : `https://${url.replace(/^\/*/, '')}`;
            document.execCommand('createLink', false, safeUrl);
            // Opcional: abrir em nova aba, sanitizador mantém target/rel
          }
        } else if (action === 'unlink') {
          document.execCommand('unlink');
        } else if (action === 'removeFormat') {
          document.execCommand('removeFormat');
        } else if (action === 'undo') {
          document.execCommand('undo');
        } else if (action === 'redo') {
          document.execCommand('redo');
        } else if (action === 'bold' || action === 'italic') {
          // Tentar execCommand; se não aplicar, envolver manualmente a seleção
          const before = el.innerHTML;
          document.execCommand(action);
          const afterExec = el.innerHTML;
          if (before === afterExec) {
            // fallback manual
            if (action === 'bold') {
              wrapSelection('strong');
            } else {
              wrapSelection('em');
            }
          }
        }
      } catch {}

      // Sincronizar e sanitizar o HTML após a ação
      try {
        const raw = el.innerHTML;
        const safe = sanitizeHtml(raw);
        if (safe !== raw) {
          el.innerHTML = safe;
        }
        updateQuestion(cIdx, qIdx, 'answer', safe);
        setTarget((localFaq||[]));
        // Guardar seleção atualizada após a mudança
        try {
          const sel = window.getSelection && window.getSelection();
          if (sel && sel.rangeCount > 0) {
            selectionRefs.current[key] = sel.getRangeAt(0).cloneRange();
          }
        } catch {}
      } catch {}
    };

    const handleAutoTranslate = async () => {
      if (isPt || !faqPt || faqPt.length === 0) return;
      
      setIsTranslating(true);
      try {
        const response = await fetch('/api/translate-faqs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            faqData: faqPt,
            targetLanguage: lang
          })
        });

        if (!response.ok) {
          throw new Error('Falha na tradução');
        }

        const { translatedFaqs } = await response.json();
        setTarget(translatedFaqs);
      } catch (error) {
        console.error('Erro na tradução:', error);
        alert('Erro ao traduzir FAQs. Tente novamente.');
      } finally {
        setIsTranslating(false);
      }
    };

    // Upload de imagem para a FAQ respeitando o idioma atual
    const uploadImage = async (categoryIndex: number, questionIndex: number, file: File) => {
      const uploadKey = `${categoryIndex}-${questionIndex}`;
      try {
        setFaqImageUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
        const imageUrl = await copyImageToPublic(file, guideData.slug, 'faqImage');
        const next = (localFaq || []).map((category, cIdx) =>
          cIdx === categoryIndex
            ? {
                ...category,
                questions: category.questions.map((q, qIdx) =>
                  qIdx === questionIndex ? { ...q, images: [...(q.images || []), imageUrl] } : q
                ),
              }
            : category
        );
        setLocalFaq(next);
        setTarget(next);
        setFaqImageUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
      } catch (error) {
        console.error('Erro ao fazer upload da imagem da FAQ:', error);
        setFaqImageUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
      }
    };

    // Remoção de imagem respeitando o idioma atual
    const removeImage = async (categoryIndex: number, questionIndex: number, imageIndex: number) => {
      const currentImageUrl = (localFaq?.[categoryIndex]?.questions?.[questionIndex]?.images || [])[imageIndex] || null;
      const next = (localFaq || []).map((category, cIdx) =>
        cIdx === categoryIndex
          ? {
              ...category,
              questions: category.questions.map((q, qIdx) =>
                qIdx === questionIndex ? { ...q, images: (q.images || []).filter((_, i) => i !== imageIndex) } : q
              ),
            }
          : category
      );
      setLocalFaq(next);
      setTarget(next);

      // Tentar apagar do FTP se houver URL conhecida
      try {
        if (!currentImageUrl) return;
        const fileName = currentImageUrl.split('/').pop();
        if (!fileName) return;
        const { fetchWithAuth } = await import('../../../services/apiKeyService');
        await fetchWithAuth('/api/delete-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guideSlug: guideData.slug, fileName })
        });
      } catch (e) {
        console.warn('Falha ao apagar imagem do FTP:', e);
      }
    };

    return (
      <>
        {/* Botão de tradução automática (apenas para idiomas não-PT) */}
        {!isPt && faqPt && faqPt.length > 0 && (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <button
              onClick={handleAutoTranslate}
              disabled={isTranslating}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#ffffff',
                background: isTranslating ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                border: 'none',
                borderRadius: '8px',
                cursor: isTranslating ? 'not-allowed' : 'pointer',
                opacity: isTranslating ? 0.7 : 1,
                transition: 'all 0.2s ease',
                boxShadow: isTranslating ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!isTranslating) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isTranslating) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              {isTranslating ? 'A traduzir...' : `🔄 Traduzir automaticamente do português`}
            </button>
          </div>
        )}

        <div className={styles.faqCategories}>
          {(localFaq||[]).map((category, categoryIndex) => (
            <div key={categoryIndex} className={styles.faqCategory}>
              <div className={styles.faqCategoryHeader}>
                <input
                  type="text"
                  value={category.name}
                  onChange={(e) => updateCategoryName(categoryIndex, e.target.value)}
                  onBlur={() => setTarget(localFaq || [])}
                  placeholder="Nova Categoria"
                  className={styles.faqCategoryNameInput}
                />
                <button onClick={() => removeCategory(categoryIndex)} className={styles.removeFaqCategoryButton}>×</button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(evt) => handleQuestionDragEnd(categoryIndex, evt)}
              >
                <SortableContext
                  items={category.questions.map((_, qIdx) => `q-${categoryIndex}-${qIdx}`)}
                  strategy={verticalListSortingStrategy}
                >
              {category.questions.map((question, questionIndex) => (
                <SortableQuestion key={`q-${categoryIndex}-${questionIndex}`} id={`q-${categoryIndex}-${questionIndex}`}>
                <div className={styles.faqQuestion}>
                  <input type="text" value={question.question} onChange={(e) => updateQuestion(categoryIndex, questionIndex, 'question', e.target.value)} onBlur={() => setTarget(localFaq || [])} placeholder="Nova Pergunta" className={styles.faqQuestionInput} />
                  {/* Editor TipTap (WYSIWYG robusto) */}
                  <TipTapFaqEditor
                    cIdx={categoryIndex}
                    qIdx={questionIndex}
                    value={question.answer || ''}
                    onCommit={(finalHtml) => {
                      const safe = sanitizeHtml(finalHtml || '');
                      const next = (localFaq||[]).map((c,i)=> i===categoryIndex ? {
                        ...c,
                        questions: c.questions.map((q,j)=> j===questionIndex ? { ...q, answer: safe } : q)
                      } : c);
                      setLocalFaq(next);
                      setTarget(next);
                    }}
                  />
                  
                  {/* Upload de imagens para a FAQ */}
                  <div style={{ marginTop: 8, padding: 8, border: '1px solid #ddd', borderRadius: 4, backgroundColor: '#f9f9f9' }}>
                    <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 4, display: 'block' }}>
                      Imagens da Resposta:
                    </label>
                    
                    {/* Input de upload */}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadImage(categoryIndex, questionIndex, file);
                        }
                      }}
                      style={{ fontSize: 12, marginBottom: 8 }}
                    />
                    
                    {/* Barra de progresso */}
                    {faqImageUploadProgress[`${categoryIndex}-${questionIndex}`] > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
                          Upload: {faqImageUploadProgress[`${categoryIndex}-${questionIndex}`]}%
                        </div>
                        <div style={{ width: '100%', height: 4, backgroundColor: '#eee', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${faqImageUploadProgress[`${categoryIndex}-${questionIndex}`]}%`, 
                            height: '100%', 
                            backgroundColor: '#1f6feb', 
                            transition: 'width 200ms ease' 
                          }} />
                        </div>
                      </div>
                    )}
                    
                    {/* Lista de imagens com carrossel */}
                    {question.images && question.images.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 8 }}>
                          Imagens ({question.images.length}):
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 8,
                          padding: 8,
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          backgroundColor: '#f9f9f9'
                        }}>
                          <button
                            onClick={() => {
                              const currentIndex = faqImageIndex[`${categoryIndex}-${questionIndex}`] || 0;
                              const newIndex = currentIndex > 0 ? currentIndex - 1 : question.images.length - 1;
                              setFaqImageIndex(prev => ({ ...prev, [`${categoryIndex}-${questionIndex}`]: newIndex }));
                            }}
                            style={{
                              padding: '4px 8px',
                              fontSize: 12,
                              border: '1px solid #ccc',
                              borderRadius: 4,
                              backgroundColor: 'white',
                              cursor: 'pointer',
                              color: 'black'
                            }}
                          >
                            ←
                          </button>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <img 
                              src={question.images[faqImageIndex[`${categoryIndex}-${questionIndex}`] || 0]} 
                              alt={`Imagem ${(faqImageIndex[`${categoryIndex}-${questionIndex}`] || 0) + 1}`}
                              style={{ 
                                maxWidth: 120, 
                                maxHeight: 80, 
                                objectFit: 'cover', 
                                borderRadius: 4, 
                                border: '1px solid #ddd' 
                              }}
                            />
                            <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                              {(faqImageIndex[`${categoryIndex}-${questionIndex}`] || 0) + 1} / {question.images.length}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const currentIndex = faqImageIndex[`${categoryIndex}-${questionIndex}`] || 0;
                              const newIndex = currentIndex < question.images.length - 1 ? currentIndex + 1 : 0;
                              setFaqImageIndex(prev => ({ ...prev, [`${categoryIndex}-${questionIndex}`]: newIndex }));
                            }}
                            style={{
                              padding: '4px 8px',
                              fontSize: 12,
                              border: '1px solid #ccc',
                              borderRadius: 4,
                              backgroundColor: 'white',
                              cursor: 'pointer',
                              color: 'black'
                            }}
                          >
                            →
                          </button>
                          <button
                            onClick={() => removeImage(categoryIndex, questionIndex, faqImageIndex[`${categoryIndex}-${questionIndex}`] || 0)}
                            style={{
                              padding: '4px 8px',
                              fontSize: 12,
                              border: '1px solid #ff4444',
                              borderRadius: 4,
                              backgroundColor: '#ff4444',
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button onClick={() => removeQuestion(categoryIndex, questionIndex)} className={styles.removeFaqButton}>×</button>
                </div>
                </SortableQuestion>
              ))}
                </SortableContext>
              </DndContext>
              <button onClick={() => addQuestion(categoryIndex)}>+ Adicionar Pergunta</button>
            </div>
          ))}
          <button onClick={addCategory}>+ Adicionar Categoria</button>
        </div>

        <div className={styles.previewBox}>
          <h4>Pré-visualização da FAQ ({lang.toUpperCase()}):</h4>
          <div className={styles.previewContent}>
            {(localFaq||[]).map((category, categoryIndex) => (
              <div key={categoryIndex} style={{ marginBottom: 20 }}>
                <h5>{category.name}</h5>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {category.questions.map((question, questionIndex) => (
                    <li key={questionIndex}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{question.question}</div>
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.answer || '') }} />
                      {question.images && question.images.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {question.images.map((imageUrl, imageIndex) => (
                            <img 
                              key={imageIndex}
                              src={imageUrl} 
                              alt={`Imagem ${imageIndex + 1}`}
                              style={{ 
                                width: 40, 
                                height: 40, 
                                objectFit: 'cover', 
                                borderRadius: 4, 
                                border: '1px solid #ddd' 
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');

  const filteredGuides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = guides.filter((g) => {
      const name = (g.name || '').toLowerCase();
      const slug = (g.slug || '').toLowerCase();
      const company = (g.company || '').toLowerCase();
      return !q || name.includes(q) || slug.includes(q) || company.includes(q);
    });
    const getTime = (x: any) => (x && (x.toMillis?.() ?? (x.seconds ? x.seconds * 1000 : Date.parse(x)))) || 0;
    list.sort((a, b) => {
      if (sortMode === 'az' || sortMode === 'za') {
        const an = (a.name || a.slug || '').toLowerCase();
        const bn = (b.name || b.slug || '').toLowerCase();
        return sortMode === 'az' ? an.localeCompare(bn) : bn.localeCompare(an);
      }
      const ta = getTime((a as any).createdAt);
      const tb = getTime((b as any).createdAt);
      return sortMode === 'newest' ? tb - ta : ta - tb;
    });
    return list;
  }, [guides, searchQuery, sortMode]);

  return (
    <BackofficeAuthGuard requiredRole="admin">
      <div className={styles.backofficeHome}>
        {/* Top nav reutilizada */}
      <nav className={styles.topNav}>
        <div className={styles.navContainer}>
          <div className={styles.navLeft}></div>
          <div className={styles.navRight}>
            <Link href="/backoffice" className={styles.navLink}>Administração</Link>
            <Link href="/backoffice/select" className={styles.navLink}>Guias</Link>
            <Link href="/backoffice/conversations" className={styles.navLink}>Conversas & Contactos</Link>
            <Link href="/backoffice/followers" className={styles.navLink}>Seguidores</Link>
            <Link href="/backoffice/users" className={styles.navLink}>Utilizadores</Link>
            <button 
              className={styles.navLink}
              onClick={() => router.push('/backoffice/users?create=1')}
              style={{ 
                background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
                border: 'none',
                cursor: 'pointer',
                color: 'white',
                fontWeight: '600'
              }}
            >
              Adicionar Utilizador
            </button>
            <button 
              className={styles.navLink}
              onClick={handleCreateGuide}
              style={{ 
                background: 'linear-gradient(135deg, #4ecdc4, #45b7aa)',
                border: 'none',
                cursor: 'pointer',
                color: 'white',
                fontWeight: '600'
              }}
            >
              Adicionar Guias
            </button>
            <div className={styles.userInfo}>
              <span className={styles.userIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z"/>
                </svg>
              </span>
              <span className={styles.userName}>{user?.username ? String(user.username) : 'Admin'}</span>
            </div>
            <button 
              className={styles.logoutButton}
              onClick={async () => {
                try {
                  await logout();
                  router.push('/backoffice/login');
                } catch (error) {
                  console.error('Erro ao fazer logout:', error);
                  // Mesmo com erro, limpar dados locais e redirecionar
                  localStorage.removeItem('sessionData');
                  localStorage.removeItem('userData');
                  document.cookie = 'sessionData=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax';
                  router.push('/backoffice/login');
                }
              }}
            >
              <span className={styles.logoutIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </span>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </nav>
      <div className={styles.mainContent}>
        <div className={styles.selectToolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.searchWrapper}>
              <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L20.71,20L19.29,21.41L13,15.14C11.86,16.1 10.38,16.69 8.77,16.69A6.5,6.5 0 0,1 2.27,10.19A6.5,6.5 0 0,1 8.77,3.69M8.77,5.19A5,5 0 0,0 3.77,10.19A5,5 0 0,0 8.77,15.19A5,5 0 0,0 13.77,10.19A5,5 0 0,0 8.77,5.19Z"/>
              </svg>
              <input
                type="text"
                placeholder="Procurar guia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>
          <div className={styles.toolbarRight}>
            <select
              className={styles.sortSelect}
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
            >
              <option value="newest">Mais recente</option>
              <option value="oldest">Mais antigo</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
            </select>
            <button className={styles.newGuideButton} onClick={handleCreateGuide}>+ Criar Guia</button>
          </div>
        </div>

        <div style={{ width: '90%', margin: '0 auto', marginTop: 24 }}>
          {filteredGuides.length === 0 ? (
            <div style={{ padding: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 12, textAlign: 'center', color: '#fff' }}>
              Nenhum guia encontrado.
            </div>
          ) : (
            <div className={styles.guidesGrid}>
              {filteredGuides.map((g) => (
                  <div key={g.id} className={styles.guideCard}>
                     <div className={styles.cardHeader}>
                      <div className={styles.statusIndicator}>
                        <span className={`${styles.statusDot} ${g.isActive ? styles.active : styles.inactive}`}></span>
                      </div>
                       <div style={{ marginLeft: 'auto' }}>
                         <button
                           onClick={() => handleEditGuide(g)}
                           title="Definições do guia"
                           style={{
                             background: 'transparent',
                             border: 'none',
                             color: '#fff',
                             cursor: 'pointer',
                             padding: 6,
                             borderRadius: 6
                           }}
                         >
                           <svg width="18" height="18" viewBox="0 0 649.61 649.63" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                             <path fill="#fff" d="m233.15,648.7c-25.21-7.14-49.5-17.21-72.37-30-8.33-4.72-13.27-13.77-12.73-23.33l4.4-68.9c.09-1.44-.45-2.85-1.47-3.87l-23.57-23.6c-.94-.93-2.21-1.44-3.53-1.43h-.33l-69.17,4.3h-1.57c-9.05,0-17.38-4.9-21.8-12.8-12.8-22.92-22.87-47.27-30-72.53-2.56-9.25.36-19.16,7.53-25.53l51.97-45.87c1.07-.96,1.68-2.33,1.67-3.77v-33.03c0-1.44-.6-2.81-1.67-3.77l-52.07-45.87c-7.18-6.37-10.11-16.28-7.53-25.53,7.14-25.27,17.21-49.63,30-72.57,4.43-7.87,12.77-12.74,21.8-12.73h1.57l69.17,4.3h.33c1.32-.01,2.59-.54,3.53-1.47l23.33-23.33c1.01-1.02,1.53-2.43,1.43-3.87l-4.23-69.1c-.55-9.57,4.39-18.62,12.73-23.33,22.94-12.79,47.29-22.86,72.57-30,9.25-2.6,19.17.33,25.53,7.53l45.87,51.83c.96,1.07,2.33,1.67,3.77,1.67h32.93c1.44.02,2.81-.59,3.77-1.67l45.9-51.97c6.36-7.2,16.28-10.13,25.53-7.53,25.27,7.13,49.61,17.2,72.53,30,8.37,4.7,13.32,13.75,12.77,23.33l-4.3,69.17c-.1,1.43.43,2.84,1.43,3.87l23.33,23.33c.96.93,2.23,1.46,3.57,1.47h.3l69.17-4.3h1.4c9.03,0,17.36,4.87,21.8,12.73,12.8,22.93,22.87,47.29,30,72.57,2.58,9.25-.34,19.16-7.53,25.53l-51.73,45.93c-1.08.96-1.69,2.33-1.7,3.77v32.93c0,1.44.62,2.81,1.7,3.77l51.97,45.87c7.19,6.37,10.11,16.28,7.53,25.53-7.12,25.27-17.19,49.62-30,72.53-4.42,7.89-12.75,12.79-21.8,12.8h-1.57l-69.17-4.3h-.33c-1.32-.01-2.59.5-3.53,1.43l-23.33,23.33c-1,1.03-1.52,2.43-1.43,3.87l4.3,69.17c.63,9.6-4.35,18.69-12.77,23.33-22.86,12.81-47.15,22.88-72.37,30-9.26,2.65-19.22-.28-25.57-7.53l-45.7-51.9c-.95-1.09-2.32-1.71-3.77-1.7h-33.33c-1.44,0-2.81.62-3.77,1.7l-45.87,52c-6.36,7.2-16.28,10.13-25.53,7.53h0Zm-70.4-185.13l23.6,23.57c11.19,11.18,17.02,26.65,16,42.43l-3.33,52.73c10.68,5.24,21.68,9.8,32.93,13.63l35.17-39.8c10.45-11.83,25.48-18.6,41.27-18.6h33.33c15.8,0,30.83,6.8,41.27,18.67l34.97,39.7c11.27-3.85,22.28-8.42,32.97-13.67l-3.33-53c-.97-15.76,4.87-31.17,16.03-42.33l23.33-23.33c10.35-10.27,24.32-16.05,38.9-16.1h3.33l53,3.33c5.28-10.74,9.87-21.81,13.73-33.13l-39.8-35.17c-11.83-10.45-18.6-25.48-18.6-41.27v-32.9c0-15.79,6.77-30.81,18.6-41.27l39.8-35.17c-3.85-11.33-8.44-22.4-13.73-33.13l-53,3.33h-3.33c-14.62.04-28.65-5.77-38.97-16.13l-23.33-23.33c-11.16-11.15-17-26.55-16.03-42.3l3.33-53c-10.75-5.26-21.82-9.86-33.13-13.77l-35.17,40c-10.45,11.83-25.48,18.6-41.27,18.6h-32.97c-15.79,0-30.81-6.77-41.27-18.6l-35.13-39.9c-11.32,3.91-22.38,8.51-33.13,13.77l3.33,53c.97,15.75-4.87,31.15-16.03,42.3l-23.33,23.33c-10.3,10.37-24.32,16.18-38.93,16.13h-3.33l-53-3.33c-5.26,10.75-9.86,21.82-13.77,33.13l40,35.17c11.72,10.47,18.4,25.45,18.37,41.17v32.93c0,15.79-6.77,30.81-18.6,41.27l-40,35.17c3.9,11.32,8.5,22.38,13.77,33.13l53-3.33h3.33c14.68-.13,28.8,5.66,39.17,16.07Zm3.53-138.93c0-87.45,70.89-158.33,158.33-158.33s158.33,70.89,158.33,158.33-70.89,158.33-158.33,158.33c-87.4-.11-158.22-70.93-158.33-158.33h0Zm50,0c0,59.83,48.5,108.33,108.33,108.33s108.33-48.5,108.33-108.33-48.5-108.33-108.33-108.33c-59.8.07-108.26,48.53-108.33,108.33h0Z"/>
                           </svg>
                         </button>
                       </div>
                    </div>
                    <div className={styles.guideInfo}>
                      <h3 className={styles.guideName}>{g.company || g.name}</h3>
                      <p className={styles.guideType}>Guia Virtual</p>
                    </div>
                    <div className={styles.guideDetails}>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Slug:</span>
                        <span className={styles.detailValue}>{g.slug}</span>
                      </div>
                      {g.targetProject?.projectId && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Projeto:</span>
                          <span className={styles.detailValue}>{g.targetProject.projectId}</span>
                        </div>
                      )}
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Status:</span>
                        <span className={`${styles.detailValue} ${g.isActive ? styles.statusActive : styles.statusInactive}`}>
                          {g.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                    <button
                      className={styles.viewDetailsButton}
                      onClick={() => window.open(`/${g.slug}`, '_blank')}
                    >
                      ABRIR GUIA
                    </button>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        className={g.isActive ? styles.deleteAllButton : styles.filterButton}
                        onClick={() => handleToggleGuideActive(g, !g.isActive)}
                        disabled={togglingGuideId === g.slug}
                      >
                        {togglingGuideId === g.slug
                          ? (g.isActive ? 'A desativar...' : 'A ativar...')
                          : (g.isActive ? 'Desativar' : 'Ativar')}
                      </button>
                      <button
                        className={styles.deleteAllButton}
                        onClick={() => handleDeleteGuide(g)}
                        disabled={deletingGuideId === g.slug}
                      >
                        {deletingGuideId === g.slug ? 'A apagar...' : 'Apagar'}
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal para criar novo guia virtual */}
      {showCreateGuideModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
               <h2>{isEditMode ? `Editar Guia Virtual — ${editingGuide?.slug || ''}` : 'Criar Novo Guia Virtual'}</h2>
              <button 
                className={styles.closeModalButton}
                onClick={() => setShowCreateGuideModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {creating && (
                <div style={{
                  background: '#f6f8fa',
                  border: '1px solid #d0d7de',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>A criar guia…</div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#57606a' }}>
                      <span>Upload vídeo principal</span>
                      <span>{backgroundUploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${backgroundUploadProgress}%`, height: '100%', background: '#1f6feb', transition: 'width 200ms ease' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#57606a' }}>
                      <span>Upload vídeo de boas‑vindas</span>
                      <span>{welcomeUploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${welcomeUploadProgress}%`, height: '100%', background: '#1f6feb', transition: 'width 200ms ease' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#57606a' }}>
                      <span>Upload vídeo mobile/tablet</span>
                      <span>{mobileTabletBackgroundUploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${mobileTabletBackgroundUploadProgress}%`, height: '100%', background: '#1f6feb', transition: 'width 200ms ease' }} />
                    </div>
                  </div>
                </div>
              )}
              {/* Passo 1: Introdução simples */}
              {currentStep === 1 && (
                <div className={styles.formStep}>
                  <h3>Criar Novo Guia Virtual</h3>
                  <p className={styles.stepDescription}>
                    Este assistente irá criar um novo guia no projeto padrão. Clique em "Seguir para Informações do Guia" para começar.
                  </p>
                </div>
              )}

              {/* Passo 2 removido: o guia é sempre criado no projeto Firebase fixo */}

              {/* Passo 2: Formulário de dados do guia */}
              {currentStep === 2 && (
                <div className={styles.formStep}>
                   <h3>{isEditMode ? 'Editar Informações do Guia' : 'Informações do Guia'}</h3>
                  <p className={styles.stepDescription}>
                    Preencha as informações básicas do novo guia virtual.
                  </p>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="guideName">Nome do Guia *</label>
                    <input
                      type="text"
                      id="guideName"
                      value={guideData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ex: Licor Beirão"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Este será o nome que aparece no título e cabeçalho do guia.
                    </small>
                  </div>

                  {/* Gradiente do Tema */}
                  <div className={styles.formGroup}>
                    <label>Gradiente do Tema</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span style={{ fontSize: 12, color: '#8b949e' }}>Cor Inicial</span>
                        <input
                          type="color"
                          value={(guideData as any).gradientStartColor || '#ff6b6b'}
                          onChange={(e) => handleInputChange('gradientStartColor', e.target.value)}
                          style={{ width: 48, height: 32, border: '1px solid #30363d', borderRadius: 6, background: 'transparent' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span style={{ fontSize: 12, color: '#8b949e' }}>Cor Final</span>
                        <input
                          type="color"
                          value={(guideData as any).gradientEndColor || '#4ecdc4'}
                          onChange={(e) => handleInputChange('gradientEndColor', e.target.value)}
                          style={{ width: 48, height: 32, border: '1px solid #30363d', borderRadius: 6, background: 'transparent' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ height: 32, borderRadius: 6, border: '1px solid #30363d', background: `linear-gradient(90deg, ${(guideData as any).gradientStartColor || '#ff6b6b'} 0%, ${(guideData as any).gradientEndColor || '#4ecdc4'} 100%)` }} />
                        <small className={styles.formHelp}>Pré-visualização</small>
                      </div>
                    </div>
                    <small className={styles.formHelp}>
                      Este gradiente será aplicado em todas as áreas da interface que usam o tema.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="guideSlug">Nome do Link *</label>
                    <div className={styles.slugInput}>
                      <span className={styles.slugPrefix}>localhost:3000/</span>
                       <input
                        type="text"
                        id="guideSlug"
                        value={guideData.slug}
                        onChange={(e) => handleInputChange('slug', e.target.value)}
                        placeholder="licor-beirao"
                         className={styles.formInput}
                         disabled={isEditMode}
                      />
                    </div>
                    <small className={styles.formHelp}>
                      Este será o endereço URL do guia. Use apenas letras minúsculas, números e hífens.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="guideCompany">Nome da Empresa</label>
                    <input
                      type="text"
                      id="guideCompany"
                      value={guideData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      placeholder="Ex: Licor Beirão, Lda."
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Nome completo da empresa ou organização.
                    </small>
                  </div>

                <div className={styles.formGroup}>
                  <label htmlFor="websiteUrl">Website da Empresa</label>
                  <input
                    type="url"
                    id="websiteUrl"
                    value={(guideData as any).websiteUrl || ''}
                    onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                    placeholder="https://inovpartner.com"
                    className={styles.formInput}
                  />
                  <small className={styles.formHelp}>
                    URL do website oficial da empresa (usado como contexto nas respostas da IA).
                  </small>
                </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="companyIcon">Ícone da Empresa (JPG/PNG/SVG/WebP)</label>
                    <input
                      type="file"
                      id="companyIcon"
                      accept="image/*"
                      onChange={(e) => setCompanyIconFile(e.target.files?.[0] || null)}
                      className={styles.formInput}
                    />
                    {companyIconFile && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(companyIconFile)}
                          alt="Pré-visualização ícone"
                          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid #ddd' }}
                        />
                        <span style={{ fontSize: 13, color: '#666' }}>{companyIconFile.name}</span>
                      </div>
                    )}
                    <small className={styles.formHelp}>
                      Será apresentado ao lado do nome da empresa no chat. É enviado por FTP para a pasta do guia.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="metaTitle">Meta Title</label>
                    <input
                      type="text"
                      id="metaTitle"
                      value={guideData.metaTitle}
                      onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                      placeholder="Título SEO da página"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Título usado nos motores de busca e no separador do navegador.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="metaDescription">Meta Description</label>
                    <textarea
                      id="metaDescription"
                      value={guideData.metaDescription}
                      onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                      placeholder="Descrição SEO da página (ideal 50–160 caracteres)"
                      className={styles.formInput}
                      style={{ minHeight: 90 }}
                    />
                    <small className={styles.formHelp}>
                      Breve descrição apresentada nos resultados de pesquisa.
                    </small>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Pré-visualização:</h4>
                    <div className={styles.previewContent}>
                      <p><strong>Nome do Guia:</strong> {guideData.name || 'Nome do Guia'}</p>
                      <p><strong>URL:</strong> localhost:3000/{guideData.slug || 'nome-do-link'}</p>
                      <p><strong>Empresa:</strong> {guideData.company || 'Nome da Empresa'}</p>
                      <p><strong>Meta Title:</strong> {guideData.metaTitle || '(vazio)'}</p>
                      <p><strong>Meta Description:</strong> {guideData.metaDescription || '(vazio)'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Passo 3: Definir System Prompt */}
              {currentStep === 3 && (
                <div className={styles.formStep}>
                  <h3>System Prompt do Chat (IA)</h3>
                  <p className={styles.stepDescription}>
                    Escreva o prompt de sistema para orientar o comportamento do assistente deste guia.
                    Este texto ficará guardado apenas no projeto Firebase do guia.
                  </p>
                  <div className={styles.formGroup}>
                    <label htmlFor="systemPrompt">System Prompt *</label>
                    <textarea
                      id="systemPrompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Defina aqui o papel, objetivos, limites e estilo do assistente para este guia..."
                      className={styles.formInput}
                      style={{ minHeight: 180, fontFamily: 'monospace' }}
                    />
                    <small className={styles.formHelp}>
                      Dica: Inclua identidade do agente, objetivo, fontes, tom, limites e instruções para ignorar pedidos indevidos.
                    </small>
                  </div>
                </div>
              )}

              {/* Passo 4: Upload de Vídeos e Legendas */}
              {currentStep === 4 && (
                <div className={styles.formStep}>
                  <h3>Upload de Vídeos e Legendas {isEditMode ? '(Opcional - Manter existentes)' : '(Opcional)'}</h3>
                  <p className={styles.stepDescription}>
                    {isEditMode 
                      ? 'Faça upload de novos vídeos para substituir os existentes, ou deixe em branco para manter os vídeos atuais. Opcionalmente, faça upload de legendas (.vtt) específicas por dispositivo.'
                      : 'Faça upload dos vídeos e, opcionalmente, de três ficheiros de legendas (.vtt) específicos por dispositivo.'
                    }
                  </p>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="backgroundVideo">Vídeo de Loading</label>
                    {isEditMode && existingAssets.background && (
                      <div style={{ 
                        background: '#f0f8ff', 
                        border: '1px solid #b3d9ff', 
                        borderRadius: 4, 
                        padding: 8, 
                        marginBottom: 8,
                        fontSize: 13,
                        color: '#0066cc'
                      }}>
                        📹 Vídeo atual: {existingAssets.background.split('/').pop()}
                      </div>
                    )}
                    <input
                      type="file"
                      id="backgroundVideo"
                      accept="video/*"
                      onChange={(e) => setBackgroundVideoFile(e.target.files?.[0] || null)}
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      {isEditMode 
                        ? 'Selecione um novo vídeo para substituir o atual, ou deixe em branco para manter o vídeo existente.'
                        : 'Vídeo que será reproduzido em loop no fundo da página do guia.'
                      }
                    </small>
                    {backgroundVideoFile && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                        Selecionado: {backgroundVideoFile.name} ({(backgroundVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                    {backgroundUploadProgress > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{
                          width: '100%',
                          height: 8,
                          background: '#eee',
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${backgroundUploadProgress}%`,
                            height: '100%',
                            background: '#1f6feb',
                            transition: 'width 200ms ease',
                          }} />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>{backgroundUploadProgress}%</div>
                      </div>
                    )}
                    {backgroundUploadProgress === 100 && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>
                        ✅ Vídeo processado e pronto para uso
                      </div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="mobileTabletBackgroundVideo">Vídeo Loading Mobile/Tablet</label>
                    {isEditMode && existingAssets.mobileTabletBackground && (
                      <div style={{ 
                        background: '#f0f8ff', 
                        border: '1px solid #b3d9ff', 
                        borderRadius: 4, 
                        padding: 8, 
                        marginBottom: 8,
                        fontSize: 13,
                        color: '#0066cc'
                      }}>
                        📱 Vídeo atual para mobile/tablet: {existingAssets.mobileTabletBackground.split('/').pop()}
                      </div>
                    )}
                    <input
                      type="file"
                      id="mobileTabletBackgroundVideo"
                      accept="video/*"
                      onChange={(e) => setMobileTabletBackgroundVideoFile(e.target.files?.[0] || null)}
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      {isEditMode 
                        ? 'Selecione um novo vídeo para substituir o atual, ou deixe em branco para manter o vídeo existente.'
                        : 'Vídeo específico para smartphones e tablets. Se não for fornecido, será usado o vídeo principal.'
                      }
                    </small>
                    {mobileTabletBackgroundVideoFile && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                        Selecionado: {mobileTabletBackgroundVideoFile.name} ({(mobileTabletBackgroundVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                    {mobileTabletBackgroundUploadProgress > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{
                          width: '100%',
                          height: 8,
                          background: '#eee',
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${mobileTabletBackgroundUploadProgress}%`,
                            height: '100%',
                            background: '#1f6feb',
                            transition: 'width 200ms ease',
                          }} />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>{mobileTabletBackgroundUploadProgress}%</div>
                      </div>
                    )}
                    {mobileTabletBackgroundUploadProgress === 100 && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>
                        ✅ Vídeo processado e pronto para uso
                      </div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="welcomeVideo">Vídeo Principal</label>
                    {isEditMode && existingAssets.welcome && (
                      <div style={{ 
                        background: '#f0f8ff', 
                        border: '1px solid #b3d9ff', 
                        borderRadius: 4, 
                        padding: 8, 
                        marginBottom: 8,
                        fontSize: 13,
                        color: '#0066cc'
                      }}>
                        📹 Vídeo atual: {existingAssets.welcome.split('/').pop()}
                      </div>
                    )}
                    <input
                      type="file"
                      id="welcomeVideo"
                      accept="video/*"
                      onChange={(e) => setWelcomeVideoFile(e.target.files?.[0] || null)}
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      {isEditMode 
                        ? 'Selecione um novo vídeo para substituir o atual, ou deixe em branco para manter o vídeo existente.'
                        : 'Vídeo de apresentação que será reproduzido quando o utilizador entrar na página.'
                      }
                    </small>
                    {welcomeVideoFile && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                        Selecionado: {welcomeVideoFile.name} ({(welcomeVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                    {welcomeUploadProgress > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{
                          width: '100%',
                          height: 8,
                          background: '#eee',
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${welcomeUploadProgress}%`,
                            height: '100%',
                            background: '#1f6feb',
                            transition: 'width 200ms ease',
                          }} />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>{welcomeUploadProgress}%</div>
                      </div>
                    )}
                    {welcomeUploadProgress === 100 && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>
                        ✅ Vídeo processado e pronto para uso
                      </div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label>Legendas (.vtt) por dispositivo</label>
                    <div style={{ display: 'grid', gap: 16 }}>
                      <div>
                        <label htmlFor="captionsDesktop">Desktop</label>
                        <input
                          type="file"
                          id="captionsDesktop"
                          accept=".vtt,text/vtt"
                          onChange={(e) => setCaptionsDesktopFile(e.target.files?.[0] || null)}
                          className={styles.formInput}
                        />
                        {captionsDesktopFile && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                            Selecionado: {captionsDesktopFile.name} ({(captionsDesktopFile.size / 1024).toFixed(1)} KB)
                          </div>
                        )}
                        {captionsUploadProgress.desktop === 100 && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Legendas desktop processadas</div>
                        )}
                      </div>
                      <div>
                        <label htmlFor="captionsTablet">Tablet</label>
                        <input
                          type="file"
                          id="captionsTablet"
                          accept=".vtt,text/vtt"
                          onChange={(e) => setCaptionsTabletFile(e.target.files?.[0] || null)}
                          className={styles.formInput}
                        />
                        {captionsTabletFile && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                            Selecionado: {captionsTabletFile.name} ({(captionsTabletFile.size / 1024).toFixed(1)} KB)
                          </div>
                        )}
                        {captionsUploadProgress.tablet === 100 && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Legendas tablet processadas</div>
                        )}
                      </div>
                      <div>
                        <label htmlFor="captionsMobile">Mobile</label>
                        <input
                          type="file"
                          id="captionsMobile"
                          accept=".vtt,text/vtt"
                          onChange={(e) => setCaptionsMobileFile(e.target.files?.[0] || null)}
                          className={styles.formInput}
                        />
                        {captionsMobileFile && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                            Selecionado: {captionsMobileFile.name} ({(captionsMobileFile.size / 1024).toFixed(1)} KB)
                          </div>
                        )}
                        {captionsUploadProgress.mobile === 100 && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Legendas mobile processadas</div>
                        )}
                      </div>
                    </div>
                    <small className={styles.formHelp}>Formatos suportados: .vtt. Estes ficheiros serão servidos a partir de /virtualsommelier/{guideData.slug}/</small>
                  </div>

                <div className={styles.formGroup}>
                  <label>Legendas EN (.vtt) por dispositivo</label>
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                      <label htmlFor="captionsEnDesktop">Desktop (EN)</label>
                      <input type="file" id="captionsEnDesktop" accept=".vtt,text/vtt" onChange={(e) => setCaptionsEnDesktopFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                    <div>
                      <label htmlFor="captionsEnTablet">Tablet (EN)</label>
                      <input type="file" id="captionsEnTablet" accept=".vtt,text/vtt" onChange={(e) => setCaptionsEnTabletFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                    <div>
                      <label htmlFor="captionsEnMobile">Mobile (EN)</label>
                      <input type="file" id="captionsEnMobile" accept=".vtt,text/vtt" onChange={(e) => setCaptionsEnMobileFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Legendas ES (.vtt) por dispositivo</label>
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                      <label htmlFor="captionsEsDesktop">Desktop (ES)</label>
                      <input type="file" id="captionsEsDesktop" accept=".vtt,text/vtt" onChange={(e) => setCaptionsEsDesktopFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                    <div>
                      <label htmlFor="captionsEsTablet">Tablet (ES)</label>
                      <input type="file" id="captionsEsTablet" accept=".vtt,text/vtt" onChange={(e) => setCaptionsEsTabletFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                    <div>
                      <label htmlFor="captionsEsMobile">Mobile (ES)</label>
                      <input type="file" id="captionsEsMobile" accept=".vtt,text/vtt" onChange={(e) => setCaptionsEsMobileFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Legendas FR (.vtt) por dispositivo</label>
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                      <label htmlFor="captionsFrDesktop">Desktop (FR)</label>
                      <input type="file" id="captionsFrDesktop" accept=".vtt,text/vtt" onChange={(e) => setCaptionsFrDesktopFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                    <div>
                      <label htmlFor="captionsFrTablet">Tablet (FR)</label>
                      <input type="file" id="captionsFrTablet" accept=".vtt,text/vtt" onChange={(e) => setCaptionsFrTabletFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                    <div>
                      <label htmlFor="captionsFrMobile">Mobile (FR)</label>
                      <input type="file" id="captionsFrMobile" accept=".vtt,text/vtt" onChange={(e) => setCaptionsFrMobileFile(e.target.files?.[0] || null)} className={styles.formInput} />
                    </div>
                  </div>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Resumo das Legendas:</h4>
                    <div className={styles.previewContent}>
                      <p><strong>Desktop:</strong> {captionsDesktopFile ? captionsDesktopFile.name : 'Nenhum (opcional)'}</p>
                      <p><strong>Tablet:</strong> {captionsTabletFile ? captionsTabletFile.name : 'Nenhum (opcional)'}</p>
                      <p><strong>Mobile:</strong> {captionsMobileFile ? captionsMobileFile.name : 'Nenhum (opcional)'}</p>
                    </div>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Resumo dos Vídeos:</h4>
                    <div className={styles.previewContent}>
                      <p><strong>Vídeo Principal:</strong> {backgroundVideoFile ? backgroundVideoFile.name : 'Nenhum selecionado (opcional)'}</p>
                      <p><strong>Vídeo de Boas‑vindas:</strong> {welcomeVideoFile ? welcomeVideoFile.name : 'Nenhum selecionado (opcional)'}</p>
                      <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                        💡 <strong>Nota:</strong> Os vídeos são opcionais. Podes criar o guia sem vídeos e adicioná-los depois.
                      </p>
                    </div>
                  </div>

                {/* (Formulário de traduções dos botões movido para a etapa 6 - Configuração do Chat) */}
                </div>
              )}

              {/* Passo 5: Upload do Ícone do Chat */}
              {currentStep === 5 && (
                <div className={styles.formStep}>
                  <h3>Ícone do Chat (avatar do guia real)</h3>
                  <p className={styles.stepDescription}>
                    Faça upload da imagem que será usada como ícone do guia real no chat. Recomenda-se uma imagem quadrada com fundo transparente.
                  </p>
                  <div className={styles.formGroup}>
                    <label htmlFor="chatIcon">Imagem do Ícone do Chat (PNG/JPG/SVG)</label>
                    <input
                      type="file"
                      id="chatIcon"
                      accept="image/*"
                      onChange={(e) => setChatIconFile(e.target.files?.[0] || null)}
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Tamanho recomendado: 80x80px ou superior, formato quadrado. Fundo transparente (PNG) preferível.
                    </small>
                    {chatIconFile && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img
                          src={URL.createObjectURL(chatIconFile)}
                          alt="Pré-visualização do ícone"
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }}
                        />
                        <span style={{ fontSize: 13, color: '#666' }}>{chatIconFile.name}</span>
                      </div>
                    )}
                    {chatIconUploadProgress === 100 && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>
                        ✅ Ícone processado e pronto para uso
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Passo 6: Configuração do Chat (botões e título abaixo do bem-vindo) */}
              {currentStep === 6 && (
                <div className={styles.formStep}>
                  <h3>Configuração do Chat (IA)</h3>
                  <p className={styles.stepDescription}>
                    Define o título que aparece abaixo de "BEM-VINDO AO GUIA VIRTUAL" e configura os botões rápidos que enviam perguntas para o chat com AI.
                  </p>

                  <div className={styles.formGroup}>
                    <label htmlFor="welcomeTitle">Título abaixo do Bem‑vindo *</label>
                    <input
                      type="text"
                      id="welcomeTitle"
                      value={chatConfig.welcomeTitle}
                      onChange={(e) => setChatConfig(prev => ({ ...prev, welcomeTitle: e.target.value }))}
                      placeholder="Ex: PORTUGAL DOS PEQUENITOS"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Este texto aparecerá abaixo de "BEM-VINDO AO GUIA VIRTUAL" no cabeçalho e ecrã de boas-vindas.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="aiWelcomeMessage">Mensagem padrão do Chat AI (Português) *</label>
                    <textarea
                      id="aiWelcomeMessage"
                      value={chatConfig.aiWelcomeMessage}
                      onChange={(e) => setChatConfig(prev => ({ ...prev, aiWelcomeMessage: e.target.value }))}
                      placeholder="Ex: Olá! Sou o teu guia virtual e estou aqui para ajudar."
                      className={styles.formInput}
                      rows={3}
                    />
                    <small className={styles.formHelp}>
                      Esta mensagem será exibida como primeira mensagem do chat com a IA quando o utilizador iniciar uma conversa.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="aiWelcomeMessageEn">Mensagem padrão do Chat AI (Inglês)</label>
                    <textarea
                      id="aiWelcomeMessageEn"
                      value={chatConfig.aiWelcomeMessageEn}
                      onChange={(e) => setChatConfig(prev => ({ ...prev, aiWelcomeMessageEn: e.target.value }))}
                      placeholder="Ex: Hello! I am your virtual guide and I am here to help."
                      className={styles.formInput}
                      rows={3}
                    />
                    <small className={styles.formHelp}>
                      Tradução em inglês da mensagem padrão do chat AI.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="aiWelcomeMessageEs">Mensagem padrão do Chat AI (Espanhol)</label>
                    <textarea
                      id="aiWelcomeMessageEs"
                      value={chatConfig.aiWelcomeMessageEs}
                      onChange={(e) => setChatConfig(prev => ({ ...prev, aiWelcomeMessageEs: e.target.value }))}
                      placeholder="Ex: ¡Hola! Soy tu guía virtual y estoy aquí para ayudar."
                      className={styles.formInput}
                      rows={3}
                    />
                    <small className={styles.formHelp}>
                      Tradução em espanhol da mensagem padrão do chat AI.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="aiWelcomeMessageFr">Mensagem padrão do Chat AI (Francês)</label>
                    <textarea
                      id="aiWelcomeMessageFr"
                      value={chatConfig.aiWelcomeMessageFr}
                      onChange={(e) => setChatConfig(prev => ({ ...prev, aiWelcomeMessageFr: e.target.value }))}
                      placeholder="Ex: Bonjour ! Je suis votre guide virtuel et je suis là pour vous aider."
                      className={styles.formInput}
                      rows={3}
                    />
                    <small className={styles.formHelp}>
                      Tradução em francês da mensagem padrão do chat AI.
                    </small>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Botões Rápidos do Chat (AI)</h4>
                    <div className={styles.formGroup}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={disableQuickButtons} onChange={(e) => setDisableQuickButtons(e.target.checked)} />
                        Desativar botões rápidos do chat (mostrar imagem personalizada)
                      </label>
                      <small className={styles.formHelp}>Quando ativado, os botões desaparecem e é mostrada a imagem abaixo.</small>
                    </div>

                    {disableQuickButtons && (
                      <div className={styles.formGroup}>
                        <label>Imagem (Desktop) para o espaço dos botões</label>
                    <input
                          ref={quickAreaImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0] || null;
                            setQuickAreaImageFile(f);
                            if (f) {
                              try {
                                const url = await copyImageToPublic(f, guideData.slug.trim(), 'quickAreaImage');
                                setQuickAreaImageUrl(url);
                            // Persistir imediatamente no Firestore ao fazer upload (sem esperar pelo Guardar)
                            try {
                              const db = targetDb;
                              await updateDoc(doc(db, 'guides', guideData.slug.trim()), {
                                quickAreaImageURL: url
                              });
                            } catch {}
                              } catch (err) {
                                alert('Falha no upload da imagem dos botões: ' + (err instanceof Error ? err.message : String(err)));
                              }
                            }
                          }}
                          className={styles.formInput}
                        />
                        {quickAreaImageFile && (
                          <div style={{ marginTop: 8 }}>
                            <img src={URL.createObjectURL(quickAreaImageFile)} alt="Pré‑visualização" style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, border: '1px solid #eee' }} />
                          </div>
                        )}
                        {quickAreaImageUrl && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Imagem carregada: {quickAreaImageUrl}</div>
                        )}

                        <div style={{ marginTop: 16 }} />
                        <label>Imagem (Tablet) para o espaço dos botões</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0] || null;
                            setQuickAreaImageTabletFile(f);
                            if (f) {
                              try {
                                const url = await copyImageToPublic(f, guideData.slug.trim(), 'quickAreaImageTablet');
                                setQuickAreaImageTabletUrl(url);
                                try {
                                  const db = targetDb;
                                  await updateDoc(doc(db, 'guides', guideData.slug.trim()), {
                                    quickAreaImageTabletURL: url
                                  });
                                } catch {}
                              } catch (err) {
                                alert('Falha no upload da imagem (Tablet): ' + (err instanceof Error ? err.message : String(err)));
                              }
                            }
                          }}
                          className={styles.formInput}
                        />
                        {quickAreaImageTabletUrl && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Imagem (Tablet) carregada: {quickAreaImageTabletUrl}</div>
                        )}

                        <div style={{ marginTop: 16 }} />
                        <label>Imagem (Telemóvel) para o espaço dos botões</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0] || null;
                            setQuickAreaImageMobileFile(f);
                            if (f) {
                              try {
                                const url = await copyImageToPublic(f, guideData.slug.trim(), 'quickAreaImageMobile');
                                setQuickAreaImageMobileUrl(url);
                                try {
                                  const db = targetDb;
                                  await updateDoc(doc(db, 'guides', guideData.slug.trim()), {
                                    quickAreaImageMobileURL: url
                                  });
                                } catch {}
                              } catch (err) {
                                alert('Falha no upload da imagem (Telemóvel): ' + (err instanceof Error ? err.message : String(err)));
                              }
                            }
                          }}
                          className={styles.formInput}
                        />
                        {quickAreaImageMobileUrl && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Imagem (Telemóvel) carregada: {quickAreaImageMobileUrl}</div>
                        )}
                        <div style={{ marginTop: 12 }}>
                          <label>Link ao clicar na imagem (opcional)</label>
                          <input
                            type="text"
                            value={quickAreaImageLink}
                            onChange={(e) => setQuickAreaImageLink(e.target.value)}
                            placeholder="https://…"
                            className={styles.formInput}
                          />
                          <small className={styles.formHelp}>Se preencher, o clique na imagem abre este URL (nova janela).</small>
                        </div>
                      </div>
                    )}
                    <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                      Estes botões enviam perguntas diretamente para o chat com AI. O utilizador clica e a pergunta é automaticamente enviada.
                    </p>
                    {!disableQuickButtons && (
                    <div className={styles.previewContent}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <label>Texto do Botão 1 *</label>
                          <input
                            type="text"
                            value={chatConfig.button1Text}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button1Text: e.target.value }))}
                            placeholder="O que visitar"
                            className={styles.formInput}
                          />
                          <small className={styles.formHelp}>Texto que aparece no botão</small>
                          <label style={{ marginTop: 12, display: 'block' }}>Pergunta a enviar *</label>
                          <input
                            type="text"
                            value={chatConfig.button1Function}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button1Function: e.target.value }))}
                            placeholder="O que visitar no parque?"
                            className={styles.formInput}
                            style={{ marginTop: 6 }}
                          />
                          <small className={styles.formHelp}>Pergunta que será enviada ao chat quando clicar</small>
                        </div>
                        <div>
                          <label>Texto do Botão 2 *</label>
                          <input
                            type="text"
                            value={chatConfig.button2Text}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button2Text: e.target.value }))}
                            placeholder="O que comer"
                            className={styles.formInput}
                          />
                          <small className={styles.formHelp}>Texto que aparece no botão</small>
                          <label style={{ marginTop: 12, display: 'block' }}>Pergunta a enviar *</label>
                          <input
                            type="text"
                            value={chatConfig.button2Function}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button2Function: e.target.value }))}
                            placeholder="O que comer no parque?"
                            className={styles.formInput}
                            style={{ marginTop: 6 }}
                          />
                          <small className={styles.formHelp}>Pergunta que será enviada ao chat quando clicar</small>
                        </div>
                        <div>
                          <label>Texto do Botão 3 *</label>
                          <input
                            type="text"
                            value={chatConfig.button3Text}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button3Text: e.target.value }))}
                            placeholder="Texto do botão 3"
                            className={styles.formInput}
                          />
                          <small className={styles.formHelp}>Texto que aparece no botão</small>
                          <label style={{ marginTop: 12, display: 'block' }}>Pergunta a enviar *</label>
                          <input
                            type="text"
                            value={chatConfig.button3Function}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button3Function: e.target.value }))}
                            placeholder="Pergunta para o chat"
                            className={styles.formInput}
                            style={{ marginTop: 6 }}
                          />
                          <small className={styles.formHelp}>Pergunta que será enviada ao chat quando clicar</small>
                        </div>
                      </div>
                    </div>
                    )}
                  </div>

                  {/* Traduções dos Botões Rápidos do Chat (EN/ES/FR) */}
                  <div className={styles.formGroup}>
                    <h3 style={{ marginTop: 24 }}>Traduções dos Botões Rápidos do Chat</h3>
                    <p className={styles.stepDescription}>Preencha os textos/funções em inglês, espanhol e francês. Se deixar vazio, será usado o texto em português.</p>

                  <div className={styles.previewBox}>
                      <h4>Inglês (EN)</h4>
                    <div className={styles.previewContent}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <label>Título abaixo do Bem‑vindo</label>
                            <input type="text" value={chatConfigEn.welcomeTitle} onChange={(e) => setChatConfigEn(prev => ({ ...prev, welcomeTitle: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Mensagem padrão do Chat AI</label>
                            <textarea value={chatConfigEn.aiWelcomeMessage} onChange={(e) => setChatConfigEn(prev => ({ ...prev, aiWelcomeMessage: e.target.value }))} className={styles.formInput} rows={2} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 1 (texto)</label>
                            <input type="text" value={chatConfigEn.button1Text} onChange={(e) => setChatConfigEn(prev => ({ ...prev, button1Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 1 (pergunta)</label>
                            <input type="text" value={chatConfigEn.button1Function} onChange={(e) => setChatConfigEn(prev => ({ ...prev, button1Function: e.target.value }))} className={styles.formInput} />
                    </div>
                          <div>
                            <label>Botão 2 (texto)</label>
                            <input type="text" value={chatConfigEn.button2Text} onChange={(e) => setChatConfigEn(prev => ({ ...prev, button2Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 2 (pergunta)</label>
                            <input type="text" value={chatConfigEn.button2Function} onChange={(e) => setChatConfigEn(prev => ({ ...prev, button2Function: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 3 (texto)</label>
                            <input type="text" value={chatConfigEn.button3Text} onChange={(e) => setChatConfigEn(prev => ({ ...prev, button3Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 3 (pergunta)</label>
                            <input type="text" value={chatConfigEn.button3Function} onChange={(e) => setChatConfigEn(prev => ({ ...prev, button3Function: e.target.value }))} className={styles.formInput} />
                  </div>
                </div>
                  </div>
                  </div>

                  <div className={styles.previewBox}>
                      <h4>Espanhol (ES)</h4>
                    <div className={styles.previewContent}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <label>Título abaixo do Bem‑vindo</label>
                            <input type="text" value={chatConfigEs.welcomeTitle} onChange={(e) => setChatConfigEs(prev => ({ ...prev, welcomeTitle: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Mensagem padrão do Chat AI</label>
                            <textarea value={chatConfigEs.aiWelcomeMessage} onChange={(e) => setChatConfigEs(prev => ({ ...prev, aiWelcomeMessage: e.target.value }))} className={styles.formInput} rows={2} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 1 (texto)</label>
                            <input type="text" value={chatConfigEs.button1Text} onChange={(e) => setChatConfigEs(prev => ({ ...prev, button1Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 1 (pergunta)</label>
                            <input type="text" value={chatConfigEs.button1Function} onChange={(e) => setChatConfigEs(prev => ({ ...prev, button1Function: e.target.value }))} className={styles.formInput} />
                    </div>
                          <div>
                            <label>Botão 2 (texto)</label>
                            <input type="text" value={chatConfigEs.button2Text} onChange={(e) => setChatConfigEs(prev => ({ ...prev, button2Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 2 (pergunta)</label>
                            <input type="text" value={chatConfigEs.button2Function} onChange={(e) => setChatConfigEs(prev => ({ ...prev, button2Function: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 3 (texto)</label>
                            <input type="text" value={chatConfigEs.button3Text} onChange={(e) => setChatConfigEs(prev => ({ ...prev, button3Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 3 (pergunta)</label>
                            <input type="text" value={chatConfigEs.button3Function} onChange={(e) => setChatConfigEs(prev => ({ ...prev, button3Function: e.target.value }))} className={styles.formInput} />
                  </div>
                </div>
                  </div>
                  </div>

                  <div className={styles.previewBox}>
                      <h4>Francês (FR)</h4>
                    <div className={styles.previewContent}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label>Título abaixo do Bem‑vindo</label>
                            <input type="text" value={chatConfigFr.welcomeTitle} onChange={(e) => setChatConfigFr(prev => ({ ...prev, welcomeTitle: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Mensagem padrão do Chat AI</label>
                            <textarea value={chatConfigFr.aiWelcomeMessage} onChange={(e) => setChatConfigFr(prev => ({ ...prev, aiWelcomeMessage: e.target.value }))} className={styles.formInput} rows={2} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 1 (texto)</label>
                            <input type="text" value={chatConfigFr.button1Text} onChange={(e) => setChatConfigFr(prev => ({ ...prev, button1Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 1 (pergunta)</label>
                            <input type="text" value={chatConfigFr.button1Function} onChange={(e) => setChatConfigFr(prev => ({ ...prev, button1Function: e.target.value }))} className={styles.formInput} />
                        </div>
                        <div>
                            <label>Botão 2 (texto)</label>
                            <input type="text" value={chatConfigFr.button2Text} onChange={(e) => setChatConfigFr(prev => ({ ...prev, button2Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 2 (pergunta)</label>
                            <input type="text" value={chatConfigFr.button2Function} onChange={(e) => setChatConfigFr(prev => ({ ...prev, button2Function: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 3 (texto)</label>
                            <input type="text" value={chatConfigFr.button3Text} onChange={(e) => setChatConfigFr(prev => ({ ...prev, button3Text: e.target.value }))} className={styles.formInput} />
                            <label style={{ marginTop: 12, display: 'block' }}>Botão 3 (pergunta)</label>
                            <input type="text" value={chatConfigFr.button3Function} onChange={(e) => setChatConfigFr(prev => ({ ...prev, button3Function: e.target.value }))} className={styles.formInput} />
                        </div>
                        </div>
                        </div>
                    </div>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Chat com Guia Real</h4>
                    <div className={styles.previewContent}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                          checked={humanChatEnabled}
                          onChange={(e) => setHumanChatEnabled(e.target.checked)}
                        />
                        Ativar chat com guia real neste guia
                          </label>
                      <small className={styles.formHelp}>
                        Quando desativado, o botão para falar com guia real e o popup não serão mostrados.
                      </small>
                      <div className={styles.formGroup} style={{ marginTop: 12 }}>
                        <label>Email de notificação do chat humano</label>
                        <input
                          type="email"
                          placeholder="ex: operador@empresa.com"
                          value={(guideData as any).humanChatNotificationEmail || ''}
                          onChange={(e) => setGuideData(prev => ({ ...prev, humanChatNotificationEmail: e.target.value }))}
                          className={styles.formInput}
                        />
                        <span className={styles.formHelp}>
                          Todas as notificações são enviadas para notificacoes@inovpartner.com e reencaminhadas para este email específico do guia.
                        </span>
                      </div>
                        </div>
                      </div>
                    </div>
              )}

              {/* Passo 7: Configuração do Formulário de Orçamento */}
              {currentStep === 7 && (
                <div className={styles.formStep}>
                  <h3>Configuração do Formulário de Orçamento</h3>
                  <p className={styles.stepDescription}>
                    Configure o formulário de orçamento que será apresentado aos utilizadores quando solicitarem informações sobre preços.
                  </p>
                  
                  <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={budgetConfig.enabled}
                        onChange={(e) => setBudgetConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      />
                      Ativar formulário de orçamento
                    </label>
                    <small className={styles.formHelp}>
                      Quando ativado, os utilizadores poderão solicitar orçamentos através de um formulário.
                    </small>
                  </div>

                  {budgetConfig.enabled && (
                    <>

                      {/* Traduções do Título */}
                      <div className={styles.formGroup}>
                        <label>Traduções do Título</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Português (PT)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.titleLabels?.pt || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                titleLabels: { ...prev.titleLabels, pt: e.target.value }
                              }))}
                              placeholder="Pedir Orçamento"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              English (EN)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.titleLabels?.en || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                titleLabels: { ...prev.titleLabels, en: e.target.value }
                              }))}
                              placeholder="Request Quote"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Español (ES)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.titleLabels?.es || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                titleLabels: { ...prev.titleLabels, es: e.target.value }
                              }))}
                              placeholder="Solicitar Presupuesto"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Français (FR)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.titleLabels?.fr || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                titleLabels: { ...prev.titleLabels, fr: e.target.value }
                              }))}
                              placeholder="Demander un Devis"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                        </div>
                        <small className={styles.formHelp}>
                          Traduções do título do formulário para diferentes idiomas.
                        </small>
                      </div>

                      {/* Traduções do Botão */}
                      <div className={styles.formGroup}>
                        <label>Traduções do Botão</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Português (PT)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.budgetButtonTextLabels?.pt || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                budgetButtonTextLabels: { ...prev.budgetButtonTextLabels, pt: e.target.value }
                              }))}
                              placeholder="Pedir Orçamento"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              English (EN)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.budgetButtonTextLabels?.en || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                budgetButtonTextLabels: { ...prev.budgetButtonTextLabels, en: e.target.value }
                              }))}
                              placeholder="Request Quote"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Español (ES)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.budgetButtonTextLabels?.es || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                budgetButtonTextLabels: { ...prev.budgetButtonTextLabels, es: e.target.value }
                              }))}
                              placeholder="Solicitar Presupuesto"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Français (FR)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.budgetButtonTextLabels?.fr || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                budgetButtonTextLabels: { ...prev.budgetButtonTextLabels, fr: e.target.value }
                              }))}
                              placeholder="Demander un Devis"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                        </div>
                        <small className={styles.formHelp}>
                          Traduções do texto do botão para diferentes idiomas.
                        </small>
                      </div>

                      {/* Configurações do Email */}
                      <div className={styles.formGroup}>
                        <label htmlFor="emailSubject">Título do Email</label>
                        <input
                          type="text"
                          id="emailSubject"
                          value={budgetConfig.emailSubject || ''}
                          onChange={(e) => setBudgetConfig(prev => ({ ...prev, emailSubject: e.target.value }))}
                          placeholder="Ex: Novo Pedido de Orçamento"
                          className={styles.formInput}
                        />
                        <small className={styles.formHelp}>
                          Título que aparece no assunto do email enviado.
                        </small>
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="emailTextTitle">Título do Texto do Email</label>
                        <input
                          type="text"
                          id="emailTextTitle"
                          value={budgetConfig.emailTextTitle || ''}
                          onChange={(e) => setBudgetConfig(prev => ({ ...prev, emailTextTitle: e.target.value }))}
                          placeholder="Ex: Detalhes do Pedido"
                          className={styles.formInput}
                        />
                        <small className={styles.formHelp}>
                          Título que aparece no corpo do email antes dos dados do formulário.
                        </small>
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="emailText">Texto do Email</label>
                        <textarea
                          id="emailText"
                          value={budgetConfig.emailText || ''}
                          onChange={(e) => setBudgetConfig(prev => ({ ...prev, emailText: e.target.value }))}
                          placeholder="Ex: Recebeu um novo pedido de orçamento através do seu guia virtual. Seguem os detalhes:"
                          className={styles.formInput}
                          rows={4}
                        />
                        <small className={styles.formHelp}>
                          Texto que aparece no corpo do email antes dos dados do formulário.
                        </small>
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="budgetEmail">Email de Destino</label>
                        <input
                          type="email"
                          id="budgetEmail"
                          value={budgetConfig.email}
                          onChange={(e) => setBudgetConfig(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="exemplo@empresa.com"
                          className={styles.formInput}
                        />
                        <small className={styles.formHelp}>
                          <strong>Sistema de Reencaminhamento:</strong> Todos os pedidos vão primeiro para orcamento@visitchat.info (email central). 
                          Adicione aqui emails adicionais para reencaminhamento automático (ex: operador1@empresa.com, operador2@empresa.com).
                        </small>
                      </div>

                      {/* Traduções do Assunto do Email */}
                      <div className={styles.formGroup}>
                        <label>Traduções do Assunto do Email</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Português (PT)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.emailSubjectLabels?.pt || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailSubjectLabels: { ...prev.emailSubjectLabels, pt: e.target.value }
                              }))}
                              placeholder="Novo Pedido de Orçamento"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              English (EN)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.emailSubjectLabels?.en || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailSubjectLabels: { ...prev.emailSubjectLabels, en: e.target.value }
                              }))}
                              placeholder="New Budget Request"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Español (ES)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.emailSubjectLabels?.es || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailSubjectLabels: { ...prev.emailSubjectLabels, es: e.target.value }
                              }))}
                              placeholder="Nueva Solicitud de Presupuesto"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Français (FR)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.emailSubjectLabels?.fr || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailSubjectLabels: { ...prev.emailSubjectLabels, fr: e.target.value }
                              }))}
                              placeholder="Nouvelle Demande de Devis"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                        </div>
                        <small className={styles.formHelp}>
                          Traduções do assunto do email para diferentes idiomas.
                        </small>
                      </div>

                      {/* Traduções do Título do Texto do Email */}
                      <div className={styles.formGroup}>
                        <label>Traduções do Título do Texto do Email</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Português (PT)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.emailTextTitleLabels?.pt || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailTextTitleLabels: { ...prev.emailTextTitleLabels, pt: e.target.value }
                              }))}
                              placeholder="Detalhes do Pedido"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              English (EN)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.emailTextTitleLabels?.en || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailTextTitleLabels: { ...prev.emailTextTitleLabels, en: e.target.value }
                              }))}
                              placeholder="Request Details"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Español (ES)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.emailTextTitleLabels?.es || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailTextTitleLabels: { ...prev.emailTextTitleLabels, es: e.target.value }
                              }))}
                              placeholder="Detalles de la Solicitud"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Français (FR)
                            </label>
                            <input
                              type="text"
                              value={budgetConfig.emailTextTitleLabels?.fr || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailTextTitleLabels: { ...prev.emailTextTitleLabels, fr: e.target.value }
                              }))}
                              placeholder="Détails de la Demande"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                            />
                          </div>
                        </div>
                        <small className={styles.formHelp}>
                          Traduções do título que aparece no corpo do email.
                        </small>
                      </div>

                      {/* Traduções do Texto do Email */}
                      <div className={styles.formGroup}>
                        <label>Traduções do Texto do Email</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Português (PT)
                            </label>
                            <textarea
                              value={budgetConfig.emailTextLabels?.pt || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailTextLabels: { ...prev.emailTextLabels, pt: e.target.value }
                              }))}
                              placeholder="Recebeu um novo pedido de orçamento através do seu guia virtual. Seguem os detalhes:"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                              rows={3}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              English (EN)
                            </label>
                            <textarea
                              value={budgetConfig.emailTextLabels?.en || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailTextLabels: { ...prev.emailTextLabels, en: e.target.value }
                              }))}
                              placeholder="You have received a new budget request through your virtual guide. Here are the details:"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                              rows={3}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Español (ES)
                            </label>
                            <textarea
                              value={budgetConfig.emailTextLabels?.es || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailTextLabels: { ...prev.emailTextLabels, es: e.target.value }
                              }))}
                              placeholder="Ha recibido una nueva solicitud de presupuesto a través de su guía virtual. Aquí están los detalles:"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                              rows={3}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: '500', color: '#ffffff', marginBottom: 4, display: 'block' }}>
                              Français (FR)
                            </label>
                            <textarea
                              value={budgetConfig.emailTextLabels?.fr || ''}
                              onChange={(e) => setBudgetConfig(prev => ({ 
                                ...prev, 
                                emailTextLabels: { ...prev.emailTextLabels, fr: e.target.value }
                              }))}
                              placeholder="Vous avez reçu une nouvelle demande de devis via votre guide virtuel. Voici les détails:"
                              className={styles.formInput}
                              style={{ fontSize: 14 }}
                              rows={3}
                            />
                          </div>
                        </div>
                        <small className={styles.formHelp}>
                          Traduções do texto que aparece no corpo do email.
                        </small>
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={budgetConfig.commercialSectionEnabled}
                            onChange={(e) => setBudgetConfig(prev => ({ ...prev, commercialSectionEnabled: e.target.checked }))}
                            className={styles.checkbox}
                          />
                          Ativar Seção de Comerciais
                        </label>
                        <small className={styles.formHelp}>
                          Quando ativado, mostra os botões de contacto comercial na modal de orçamento.
                        </small>
                      </div>

                      {budgetConfig.commercialSectionEnabled && (
                        <div className={styles.formGroup}>
                          <label>Telefones Comerciais</label>
                        <div className={styles.phoneList}>
                          {(budgetConfig.commercialPhones || []).map((phone) => (
                            <div key={phone.id} className={styles.phoneItem}>
                              <input
                                type="text"
                                value={phone.label}
                                onChange={(e) => updateCommercialPhone(phone.id, 'label', e.target.value)}
                                placeholder="Ex: Comercial, Vendas, Suporte"
                                className={styles.formInput}
                                style={{ width: '30%', marginRight: '8px' }}
                              />
                              <input
                                type="tel"
                                value={phone.phone}
                                onChange={(e) => updateCommercialPhone(phone.id, 'phone', e.target.value)}
                                placeholder="+351 123 456 789"
                                className={styles.formInput}
                                style={{ width: '60%', marginRight: '8px' }}
                              />
                              <button
                                type="button"
                                onClick={() => removeCommercialPhone(phone.id)}
                                className={styles.removeButton}
                                style={{ width: '10%' }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addCommercialPhone}
                            className={styles.addButton}
                          >
                            + Adicionar Telefone
                          </button>
                        </div>
                          <small className={styles.formHelp}>
                            Adicione números de telefone que aparecerão como botões na modal de orçamento do frontend.
                          </small>
                        </div>
                      )}

                      <div className={styles.formGroup}>
                        <label htmlFor="commercialButtonText">Texto do Botão</label>
                        <input
                          type="text"
                          id="commercialButtonText"
                          value={budgetConfig.commercialButtonText}
                          onChange={(e) => setBudgetConfig(prev => ({ ...prev, commercialButtonText: e.target.value }))}
                          placeholder="Falar com Comercial"
                          className={styles.formInput}
                        />
                        <small className={styles.formHelp}>
                          Texto que aparecerá nos botões de chamada na modal de orçamento.
                        </small>
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="confirmationMessage">Mensagem de Confirmação</label>
                        <textarea
                          id="confirmationMessage"
                          value={budgetConfig.confirmationMessage}
                          onChange={(e) => setBudgetConfig(prev => ({ ...prev, confirmationMessage: e.target.value }))}
                          placeholder="Mensagem mostrada após envio do formulário"
                          className={styles.formInput}
                          style={{ minHeight: 80 }}
                        />
                        <small className={styles.formHelp}>
                          Mensagem de agradecimento mostrada após o utilizador submeter o formulário.
                        </small>
                      </div>

                      <div className={styles.formGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <label>Configuração dos Campos</label>
                          <button
                            type="button"
                            onClick={addCustomField}
                            style={{
                              padding: '8px 16px',
                              background: '#1f6feb',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: 14,
                              fontWeight: '500'
                            }}
                          >
                            + Adicionar Campo
                          </button>
                        </div>
                        <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext
                              items={Object.keys(budgetConfig.fields)}
                              strategy={verticalListSortingStrategy}
                            >
                              {(budgetConfig.fieldOrder && budgetConfig.fieldOrder.length
                                ? budgetConfig.fieldOrder.map(k => [k, budgetConfig.fields[k] as any]).filter(([,v]) => !!v)
                                : Object.entries(budgetConfig.fields))
                                .map(([fieldKey, fieldConfig]) => {
                                const isEssential = ['name', 'email'].includes(fieldKey);
                                return (
                                  <SortableItem
                                    key={fieldKey}
                                    id={fieldKey}
                                    fieldKey={fieldKey}
                                    fieldConfig={fieldConfig}
                                    isEssential={isEssential}
                                    updateFieldConfig={updateFieldConfig}
                                    removeCustomField={removeCustomField}
                                    updateFieldLabel={updateFieldLabel}
                                  />
                                );
                              })}
                            </SortableContext>
                          </DndContext>
                        </div>
                        <small className={styles.formHelp}>
                          Configure os campos do formulário. Pode adicionar novos campos personalizados ou editar os existentes.
                        </small>
                      </div>

                      <div className={styles.previewBox}>
                        <h4>Pré-visualização do Formulário:</h4>
                        <div className={styles.previewContent}>
                          <h5 style={{ margin: '0 0 12px 0', color: '#1f6feb' }}>{budgetConfig.title}</h5>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {(budgetConfig.fieldOrder && budgetConfig.fieldOrder.length
                              ? budgetConfig.fieldOrder.map(k => [k, budgetConfig.fields[k] as any]).filter(([,v]) => !!v)
                              : Object.entries(budgetConfig.fields))
                              .map(([fieldKey, fieldConfig]) => (
                              <div key={fieldKey}>
                                <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
                                  {fieldConfig.label} {fieldConfig.required && <span style={{ color: 'red' }}>*</span>}
                                </label>
                                {fieldConfig.type === 'textarea' ? (
                                  <textarea
                                    placeholder={`Ex: ${fieldConfig.label.toLowerCase()}`}
                                    disabled
                                    rows={3}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: 4,
                                      fontSize: 14,
                                      backgroundColor: '#f9fafb',
                                      resize: 'vertical'
                                    }}
                                  />
                                ) : (
                                  fieldConfig.type === 'file' ? (
                                    <input
                                      type="file"
                                      disabled
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        fontSize: 14,
                                        backgroundColor: '#f9fafb'
                                      }}
                                    />
                                  ) : (
                                    <input
                                      type={fieldConfig.type}
                                      placeholder={`Ex: ${fieldConfig.label.toLowerCase()}`}
                                      disabled
                                      min={fieldConfig.type === 'number' ? '1' : undefined}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        fontSize: 14,
                                        backgroundColor: '#f9fafb'
                                      }}
                                    />
                                  )
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Passo 8 removido: Pontos de Ajuda */}

              {/* Passo 9 removido: Formulário de Seguidores */}

              {/* Passo 9: Configuração das FAQs (multi-idioma) */}
              {currentStep === 9 && (
                <div className={styles.formStep}>
                  <h3>Configuração das FAQs</h3>
                  <p className={styles.stepDescription}>
                    Selecione o idioma para editar as FAQs específicas desse idioma. Se não preencher, usa o conteúdo em português.
                  </p>

                  {/* Menu de idiomas */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {(['pt','en','es','fr'] as const).map((lng) => (
                          <button 
                        key={lng}
                        onClick={() => setFaqLang(lng)}
                        style={{
                          padding: '8px 16px',
                          border: faqLang === lng ? '2px solid #1f6feb' : '1px solid #d1d5db',
                          background: faqLang === lng ? '#e7f1ff' : '#ffffff',
                          color: faqLang === lng ? '#1f6feb' : '#374151',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '14px',
                          transition: 'all 0.2s ease',
                          boxShadow: faqLang === lng ? '0 2px 4px rgba(31, 111, 235, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (faqLang !== lng) {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (faqLang !== lng) {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = '#d1d5db';
                          }
                        }}
                      >
                        {lng === 'pt' ? 'Português' : lng === 'en' ? 'Inglês' : lng === 'es' ? 'Espanhol' : 'Francês'}
                          </button>
                    ))}
                  </div>

                  {/* Editor por idioma (usa faqData base para PT e estados dedicados para outros idiomas) */}
                  <FaqEditor
                    lang={faqLang}
                    faqPt={faqData}
                    setFaqPt={setFaqData}
                    faqEn={faqDataEn}
                    setFaqEn={setFaqDataEn}
                    faqEs={faqDataEs}
                    setFaqEs={setFaqDataEs}
                    faqFr={faqDataFr}
                    setFaqFr={setFaqDataFr}
                  />
                </div>
              )}

              {/* Passo 10 removido: Configuração de Contactos - funcionalidade descontinuada */}
            </div>
            
            <div className={styles.modalFooter}>
              {(currentStep === 2 || currentStep === 3 || currentStep === 4 || currentStep === 5 || currentStep === 6 || currentStep === 7 || currentStep === 9) && (
                <button 
                  className={styles.secondaryButton}
                  onClick={handleBackStep}
                >
                  Voltar
                </button>
              )}
              
               <button 
                className={styles.secondaryButton}
                onClick={() => setShowCreateGuideModal(false)}
              >
                Cancelar
              </button>
              
               <button 
                className={styles.primaryButton}
                onMouseDown={() => { try { (document.activeElement as HTMLElement | null)?.blur(); } catch {} }}
                onClick={handleNextStep}
                disabled={creating 
                  || (currentStep === 2 && !isGuideFormValid()) 
                  || (currentStep === 3 && systemPrompt.trim() === '')
                  || (currentStep === 4 && !isEditMode && !backgroundVideoFile && !welcomeVideoFile)
                  || (currentStep === 4 && isEditMode && !backgroundVideoFile && !welcomeVideoFile && !existingAssets.background && !existingAssets.welcome)
                || (currentStep === 6 && (!chatConfig.welcomeTitle.trim() || !chatConfig.button1Text.trim() || !chatConfig.button1Function.trim() || !chatConfig.button2Text.trim() || !chatConfig.button2Function.trim() || (!chatConfig.button3Text.trim() || !chatConfig.button3Function.trim())))
                || (currentStep === 7 && budgetConfig.enabled && (!budgetConfig.title.trim() || !budgetConfig.email.trim() || !budgetConfig.confirmationMessage.trim()))
                  
                  || (currentStep === 9 && faqData.length === 0)
                  || (currentStep === 9 && faqData.some(category => category.questions.length === 0))
                  || (currentStep === 9 && faqData.some(category => category.name.trim() === ''))
                  || (currentStep === 9 && faqData.some(category => category.questions.some(q => q.question.trim() === '')))
                  || (currentStep === 9 && faqData.some(category => category.questions.some(q => q.answer.trim() === '')))
                  
                  }
              >
                 {isEditMode
                  ? (currentStep === 2 ? 'Seguir para System Prompt'
                      : currentStep === 3 ? 'Seguir para Vídeos'
                      : currentStep === 4 ? 'Seguir para Ícone do Chat'
                      : currentStep === 5 ? 'Seguir para Configuração do Chat'
                      : currentStep === 6 ? 'Seguir para Configuração do Formulário de Orçamento'
                      : currentStep === 7 ? 'Seguir para Configuração das FAQs'
                      : currentStep === 8 ? 'Seguir para Configuração das FAQs'
                      : (creating ? 'A guardar...' : 'Guardar Alterações'))
                  : (currentStep === 1
                    ? 'Seguir para Informações do Guia'
                    : currentStep === 2
                    ? 'Seguir para System Prompt'
                    : currentStep === 3
                    ? 'Seguir para Vídeos'
                    : currentStep === 4
                    ? 'Seguir para Ícone do Chat'
                    : currentStep === 5
                    ? 'Seguir para Configuração do Chat'
                    : currentStep === 6
                    ? 'Seguir para Configuração do Formulário de Orçamento'
                    : currentStep === 7
                    ? 'Seguir para Configuração das FAQs'
                    : currentStep === 8
                    ? 'Seguir para Configuração das FAQs'
                    : (creating ? 'A criar...' : 'Criar Guia'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </BackofficeAuthGuard>
  );
}

