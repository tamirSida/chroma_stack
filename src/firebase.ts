import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

type Env = {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
};

const env = import.meta.env as unknown as Env;

const required: (keyof Env)[] = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

const hasConfig = required.every((k) => typeof env[k] === 'string' && env[k]!.length > 0);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (hasConfig) {
  app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY!,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!,
    projectId: env.VITE_FIREBASE_PROJECT_ID!,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID!,
  });
  auth = getAuth(app);
  db = getFirestore(app);
}

export const firebaseEnabled = (): boolean => app !== null;
export const getAuthOrNull = (): Auth | null => auth;
export const getDbOrNull = (): Firestore | null => db;
