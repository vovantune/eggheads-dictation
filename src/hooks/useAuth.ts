import { useCallback, useEffect, useState } from "react";
import logger from "../utils/logger";
import { useSettingsStore } from "../stores/settingsStore";

interface EggheadsUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  login?: string | null;
  display_name?: string | null;
}

interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: EggheadsUser | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoaded: false,
    isSignedIn: false,
    user: null,
  });

  const applySession = useCallback((session: any) => {
    const signedIn = Boolean(session?.signedIn && session?.user);
    const user = signedIn ? session.user : null;
    setState({ isLoaded: true, isSignedIn: signedIn, user });
    useSettingsStore.getState().setIsSignedIn(signedIn);
    if (typeof window !== "undefined") {
      localStorage.setItem("isSignedIn", String(signedIn));
      if (signedIn) {
        localStorage.setItem("onboardingCompleted", "true");
        localStorage.removeItem("authenticationSkipped");
        localStorage.removeItem("skipAuth");
      }
    }
    logger.debug("EGGHEADS auth state sync", { signedIn }, "auth");
  }, []);

  const refresh = useCallback(async () => {
    try {
      const session = await window.electronAPI?.authGetSession?.();
      applySession(session);
    } catch (error) {
      logger.warn(
        "Failed to load EGGHEADS auth session",
        { error: error instanceof Error ? error.message : String(error) },
        "auth"
      );
      applySession({ signedIn: false, user: null });
    }
  }, [applySession]);

  useEffect(() => {
    refresh();
    const dispose = window.electronAPI?.onAuthSessionChanged?.((user: EggheadsUser | null) => {
      applySession(user ? { signedIn: true, user } : { signedIn: false, user: null });
    });
    window.addEventListener("focus", refresh);
    return () => {
      dispose?.();
      window.removeEventListener("focus", refresh);
    };
  }, [applySession, refresh]);

  return {
    isSignedIn: state.isSignedIn,
    isGracePeriodOnly: false,
    isLoaded: state.isLoaded,
    session: state.user ? { user: state.user } : null,
    user: state.user,
  };
}
