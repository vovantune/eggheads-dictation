import { openExternalLink } from "../utils/externalLinks";

export const AUTH_URL = import.meta.env.VITE_EGGHEADS_AUTH_URL || "https://eggheads.solutions";

type AuthResult = { error?: { message?: string } };
type AuthEmailPayload = { email: string; password: string; name?: string };
type AuthSsoPayload = { email: string };
type AuthSocialPayload = { provider: SocialProvider };
type VerificationPayload = { email: string };

const authDisabled = async (_message: string): Promise<AuthResult> => ({
  error: { message: "This auth flow is disabled in EGGHEADS Dictation" },
});

export const authClient = {
  useSession: undefined,
  signOut: async (): Promise<AuthResult> => ({}),
  signIn: {
    social: async (_payload: AuthSocialPayload): Promise<AuthResult> => authDisabled("social"),
    sso: async (_payload: AuthSsoPayload): Promise<AuthResult> => authDisabled("sso"),
    email: async (_payload: AuthEmailPayload): Promise<AuthResult> => authDisabled("email"),
  },
  signUp: {
    email: async (_payload: AuthEmailPayload): Promise<AuthResult> => authDisabled("signup"),
  },
  sendVerificationEmail: async (_payload: VerificationPayload): Promise<AuthResult> =>
    authDisabled("verification"),
  requestPasswordReset: async (_payload: VerificationPayload): Promise<AuthResult> =>
    authDisabled("password-reset"),
};

export type SocialProvider = "eggheads" | "google" | "microsoft" | "apple";

const LAST_SIGN_IN_STORAGE_KEY = "eggheads:lastSignInTime";
const GRACE_PERIOD_MS = 60_000;
const GRACE_RETRY_COUNT = 6;
const INITIAL_GRACE_RETRY_DELAY_MS = 500;

let lastSignInTime: number | null = null;

function getLocalStorageSafe(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function persistLastSignInTime(value: number | null): void {
  const storage = getLocalStorageSafe();
  if (!storage) return;
  if (value === null) {
    storage.removeItem(LAST_SIGN_IN_STORAGE_KEY);
  } else {
    storage.setItem(LAST_SIGN_IN_STORAGE_KEY, String(value));
  }
}

function loadLastSignInTimeFromStorage(): number | null {
  const storage = getLocalStorageSafe();
  if (!storage) return null;
  const raw = storage.getItem(LAST_SIGN_IN_STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    storage.removeItem(LAST_SIGN_IN_STORAGE_KEY);
    return null;
  }
  return parsed;
}

function getLastSignInTime(): number | null {
  const stored = loadLastSignInTimeFromStorage();
  if (stored !== null) lastSignInTime = stored;
  return lastSignInTime;
}

function createAuthExpiredError(originalError: unknown): Error {
  const error = originalError instanceof Error ? originalError : new Error("Session expired");
  Object.assign(error, {
    code: "AUTH_EXPIRED",
    messageKey: "hooks.audioRecording.errorDescriptions.sessionExpired",
  });
  return error;
}

function clearLastSignInTime(): void {
  lastSignInTime = null;
  persistLastSignInTime(null);
}

function markSignedOutState(): void {
  const storage = getLocalStorageSafe();
  storage?.setItem("isSignedIn", "false");
  clearLastSignInTime();
}

export function updateLastSignInTime(): void {
  const now = Date.now();
  lastSignInTime = now;
  persistLastSignInTime(now);
}

export function isWithinGracePeriod(): boolean {
  const startedAt = getLastSignInTime();
  if (!startedAt) return false;
  return Math.max(0, Date.now() - startedAt) < GRACE_PERIOD_MS;
}

export async function deleteAccount(): Promise<{ error?: Error }> {
  return { error: new Error("Account management is handled in EGGHEADS") };
}

export async function signOut(): Promise<void> {
  try {
    await window.electronAPI?.authClearSession?.();
  } finally {
    markSignedOutState();
  }
}

export async function withSessionRefresh<T>(operation: () => Promise<T>): Promise<T> {
  const startedInGracePeriod = isWithinGracePeriod();
  let graceRetriesUsed = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      const isAuthExpired =
        error?.code === "AUTH_EXPIRED" ||
        error?.code === "AUTH_REQUIRED" ||
        error?.message?.toLowerCase().includes("session expired") ||
        error?.message?.toLowerCase().includes("not authenticated") ||
        error?.message?.toLowerCase().includes("auth expired");

      if (!isAuthExpired) throw error;

      if (startedInGracePeriod && graceRetriesUsed < GRACE_RETRY_COUNT) {
        const delayMs = INITIAL_GRACE_RETRY_DELAY_MS * Math.pow(2, graceRetriesUsed);
        graceRetriesUsed += 1;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw createAuthExpiredError(error);
    }
  }
}

export async function signInWithSocial(_provider?: SocialProvider): Promise<{ error?: Error }> {
  try {
    const result = await window.electronAPI?.authStart?.();
    if (result?.success === false) {
      return { error: new Error(result.error || "Failed to start EGGHEADS sign-in") };
    }
    updateLastSignInTime();
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("EGGHEADS sign-in failed") };
  }
}

export async function signInWithSSO(_email: string): Promise<{ error?: Error }> {
  return signInWithSocial("eggheads");
}

export async function requestPasswordReset(_email: string): Promise<{ error?: Error }> {
  openExternalLink(`${AUTH_URL}/authorization/goToService`);
  return {};
}
