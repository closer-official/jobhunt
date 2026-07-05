// cloud/firebaseConfig.ts — Firebase公開設定

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

declare const __JOBHUNT_FIREBASE_CONFIG__: FirebasePublicConfig;

export const FIREBASE_CONFIG = __JOBHUNT_FIREBASE_CONFIG__;

export function hasFirebaseConfig(): boolean {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.authDomain &&
      FIREBASE_CONFIG.projectId &&
      FIREBASE_CONFIG.appId
  );
}

export function missingFirebaseConfigFields(): string[] {
  return [
    ["apiKey", FIREBASE_CONFIG.apiKey],
    ["authDomain", FIREBASE_CONFIG.authDomain],
    ["projectId", FIREBASE_CONFIG.projectId],
    ["appId", FIREBASE_CONFIG.appId],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
}
