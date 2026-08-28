import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || 'AIzaSyD14vGu6jiO5qkAuKDIlPXcsheWurxJfFo',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || 'perfect-volt-1t3g1.firebaseapp.com',
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || 'perfect-volt-1t3g1',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || 'perfect-volt-1t3g1.firebasestorage.app',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '518397636928',
  appId: metaEnv.VITE_FIREBASE_APP_ID || '1:518397636928:web:7b708bba2ab7be69c14aa5',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
export default app;
