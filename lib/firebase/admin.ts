import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK — privileged server-side access to Firestore.
 * Only used on route handlers when `NEXT_PUBLIC_MOCK_MODE=false`.
 *
 * Credentials come from a Google Cloud service account. The private key is
 * stored in `FIREBASE_ADMIN_PRIVATE_KEY` as an escaped string; we re-expand
 * `\\n` → `\n` so PEM parses correctly.
 */
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) {
    const first = existing[0];
    if (first) return first;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin environment variables (FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY). Required only when NEXT_PUBLIC_MOCK_MODE=false.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

/**
 * Lazily-resolved Firestore Admin handle. Throws at first call-site if the
 * service account env vars are missing — never at module-load time.
 */
export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
