import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { mainDb } from './mainConfig';

export type PromoSettings = {
  promoMode: {
    enabled: boolean;
    title?: string;
    message?: string;
  };
  updatedAt?: string;
  updatedBy?: string;
};

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'promo-settings';

export async function getPromoSettings(): Promise<PromoSettings | null> {
  const ref = doc(mainDb, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as PromoSettings) : null;
}

export async function ensurePromoSettings(): Promise<void> {
  const ref = doc(mainDb, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const initial: PromoSettings = {
      promoMode: { enabled: false, title: 'FUNCIONALIDADE EXTRA', message: 'FUNCIONALIDADE EXTRA' },
      updatedAt: new Date().toISOString(),
    };
    await setDoc(ref, initial);
  }
}

export async function updatePromoSettings(partial: Partial<PromoSettings>, userId: string): Promise<void> {
  const ref = doc(mainDb, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  // Usa setDoc com merge para criar o documento se não existir e atualizar os campos em segurança
  await setDoc(
    ref,
    {
      ...(partial as PromoSettings),
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    },
    { merge: true }
  );
}


