import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, Auth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app: any = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
export let isFirebaseConfigured = false;

try {
  const config = firebaseConfig as any;
  if (config && config.apiKey) {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app, config.firestoreDatabaseId || undefined);
    isFirebaseConfigured = true;
  }
} catch (e: any) {
  console.warn("Firebase config not available or incomplete. Mark Six Tracker running in Local Storage mode.", e);
  isFirebaseConfigured = false;
}

export { auth, db };

export const signInWithGoogle = async () => {
  if (!auth) throw new Error("Firebase Authentication is not configured.");
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const handleFirestoreError = (error: any, operation: string) => {
  console.error(`Firestore ${operation} error:`, error);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}
