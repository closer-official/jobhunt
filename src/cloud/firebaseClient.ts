// cloud/firebaseClient.ts — Firebase初期化と認証基盤
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { FIREBASE_CONFIG, hasFirebaseConfig } from "./firebaseConfig";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig()) return null;
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
  }
  return app;
}

export function isCloudEnabled(): boolean {
  return hasFirebaseConfig();
}

export function getFirestoreDb(): Firestore | null {
  const fbApp = getFirebaseApp();
  if (!fbApp) return null;
  if (!db) db = getFirestore(fbApp);
  return db;
}

export function getFirebaseAuth(): Auth | null {
  const fbApp = getFirebaseApp();
  if (!fbApp) return null;
  if (!auth) auth = getAuth(fbApp);
  return auth;
}

export function getCurrentUserFast(): User | null {
  return getFirebaseAuth()?.currentUser ?? null;
}

export async function ensureAuthPersistence(): Promise<void> {
  const instance = getFirebaseAuth();
  if (!instance) return;
  try {
    await setPersistence(instance, browserLocalPersistence);
  } catch {
    // 端末や拡張の制約で永続化設定に失敗しても、同期自体は継続する
  }
}

export function watchAuthState(callback: (user: User | null) => void): () => void {
  const instance = getFirebaseAuth();
  if (!instance) return () => {};
  return onAuthStateChanged(instance, callback);
}

export async function waitForAuthReady(timeoutMs = 2000): Promise<User | null> {
  const instance = getFirebaseAuth();
  if (!instance) return null;
  if (instance.currentUser !== null) return instance.currentUser;
  return await new Promise((resolve) => {
    let unsub = () => {};
    const timer = setTimeout(() => {
      unsub();
      resolve(null);
    }, timeoutMs);
    unsub = onAuthStateChanged(instance, (user) => {
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}

export async function signInWithGoogle(): Promise<User> {
  const instance = getFirebaseAuth();
  if (!instance) {
    throw new Error("Firebase設定が不足しています");
  }
  await ensureAuthPersistence();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(instance, provider);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  const instance = getFirebaseAuth();
  if (!instance) return;
  await signOut(instance);
}
