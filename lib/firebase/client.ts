import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { publicEnv, hasFirebase } from "@/lib/env";

/**
 * Firebase client SDK wiring.
 *
 * Firebase is the production backend for:
 *  - Firestore realtime crowd density + orders
 *  - Firebase Auth (Google sign-in) for fan identity upgrade
 *  - Firebase Cloud Messaging for order-ready push notifications
 *
 * In the demo build (`NEXT_PUBLIC_MOCK_MODE=true`) Firebase is lazily imported
 * only when a component explicitly calls `getFirebaseApp()`. Missing env vars
 * in mock mode do NOT crash the app — `getFirebaseApp()` throws with a clear
 * message that should only ever be seen by the engineer wiring real Firestore.
 */
function buildConfig() {
  return {
    apiKey: publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: publicEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/** Lazy-initialize the Firebase App. Throws if config is missing. */
export function getFirebaseApp(): FirebaseApp {
  if (!hasFirebase) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars or leave NEXT_PUBLIC_MOCK_MODE=true for the demo build.",
    );
  }
  return getApps().length ? getApp() : initializeApp(buildConfig());
}

/** Firestore database handle. */
export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

/** Firebase Auth handle (Google sign-in provider is configured at call site). */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/**
 * Firebase Cloud Messaging handle. Returns `null` in environments where FCM
 * is unsupported (SSR, in-app browsers, some mobile Safari versions).
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  try {
    const supported = await isSupported();
    if (!supported) return null;
    return getMessaging(getFirebaseApp());
  } catch {
    return null;
  }
}
