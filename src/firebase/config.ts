// Importar as funções necessárias do SDK
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuração unificada do Firebase para o projeto "virtualchat"
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_TARGET_FIREBASE_API_KEY as string,
  authDomain: process.env.NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN as string,
  projectId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID as string,
  storageBucket: process.env.NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_APP_ID as string,
  measurementId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_MEASUREMENT_ID || ''
} as const;

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore
const db = getFirestore(app);

export { app, db };