import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'perfect-volt-1t3g1';
export const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DB || 'ai-studio-ommap-35e1d76e-1974-492e-9fa3-d390344288d8';

export const adminApp = !getApps().length
  ? initializeApp({ projectId: FIREBASE_PROJECT_ID })
  : getApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
try {
  adminDb.settings({ ignoreUndefinedProperties: true });
} catch (_) {}


