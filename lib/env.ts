import { z } from "zod";

/**
 * Server-side environment variables, validated once at module load.
 * Never access `process.env.*` directly in server code — import from here so we
 * get fail-fast startup on misconfiguration and a single source of truth.
 */
const ServerEnvSchema = z.object({
  GROQ_API_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/**
 * Public environment variables. These are inlined into the client bundle at
 * build time — never put secrets here.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_MOCK_MODE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type PublicEnv = z.infer<typeof PublicEnvSchema>;

function parseServerEnv(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Surface the specific field so ops can fix it fast.
    throw new Error(
      `Invalid server environment: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

function parsePublicEnv(): PublicEnv {
  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_MOCK_MODE: process.env.NEXT_PUBLIC_MOCK_MODE,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

export const serverEnv: ServerEnv = parseServerEnv();
export const publicEnv: PublicEnv = parsePublicEnv();

/** Whether the app is running in mock-data demo mode. */
export const isMockMode: boolean = publicEnv.NEXT_PUBLIC_MOCK_MODE;

/** Whether Google Analytics is configured. */
export const hasAnalytics: boolean = Boolean(publicEnv.NEXT_PUBLIC_GA_ID);

/** Whether Firebase client config is fully populated. */
export const hasFirebase: boolean = Boolean(
  publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY &&
    publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
);
