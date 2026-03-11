import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import React from 'react';
import {
  getToken as readToken,
  setToken as writeToken,
  clearToken as removeToken,
  isAuthenticated as checkAuth,
  TOKEN_STORAGE_KEY,
} from '../lib/auth';
import { pair as apiPair, getPublicHealth } from '../lib/api';
import { describeRuntimeTarget, RuntimeConfigError } from '../lib/runtimeConfig';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface AuthState {
  /** The current bearer token, or null if not authenticated. */
  token: string | null;
  /** Whether the user is currently authenticated. */
  isAuthenticated: boolean;
  /** True while the initial auth check is in progress. */
  loading: boolean;
  /** Startup/runtime connectivity error shown before the app can boot. */
  startupError: string | null;
  /** Resolved runtime target used by the current app instance. */
  runtimeTarget: string;
  /** Pair with the agent using a pairing code. Stores the token on success. */
  pair: (code: string) => Promise<void>;
  /** Re-run startup validation against the runtime health endpoint. */
  retryStartupCheck: () => Promise<void>;
  /** Clear the stored token and sign out. */
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const mountedRef = useRef(true);
  const [token, setTokenState] = useState<string | null>(readToken);
  const [authenticated, setAuthenticated] = useState<boolean>(checkAuth);
  const [loading, setLoading] = useState<boolean>(true);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [runtimeTarget, setRuntimeTarget] = useState<string>(describeRuntimeTarget);

  const checkRuntime = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) {
      return;
    }

    setLoading(true);
    setStartupError(null);
    setRuntimeTarget(describeRuntimeTarget());

    try {
      const health = await getPublicHealth();
      if (!mountedRef.current) {
        return;
      }

      setRuntimeTarget(describeRuntimeTarget());

      if (!checkAuth() && !health.require_pairing) {
        setAuthenticated(true);
      } else {
        setAuthenticated(checkAuth());
      }
    } catch (err: unknown) {
      if (!mountedRef.current) {
        return;
      }

      const message = err instanceof RuntimeConfigError
        ? err.message
        : `Unable to reach runtime health endpoint at ${describeRuntimeTarget()}. ${err instanceof Error ? err.message : String(err)}`;
      setStartupError(message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // On mount: validate runtime config and discover whether pairing is required.
  useEffect(() => {
    mountedRef.current = true;

    checkRuntime().catch(() => {
      // checkRuntime handles state updates itself
    });

    return () => {
      mountedRef.current = false;
    };
  }, [checkRuntime]);

  // Keep state in sync if token storage is changed from another browser context.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TOKEN_STORAGE_KEY) {
        const t = readToken();
        setTokenState(t);
        setAuthenticated(t !== null && t.length > 0);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const pair = useCallback(async (code: string): Promise<void> => {
    const { token: newToken } = await apiPair(code);
    writeToken(newToken);
    setTokenState(newToken);
    setAuthenticated(true);
  }, []);

  const logout = useCallback((): void => {
    removeToken();
    setTokenState(null);
    setAuthenticated(false);
  }, []);

  const value: AuthState = {
    token,
    isAuthenticated: authenticated,
    loading,
    startupError,
    runtimeTarget,
    pair,
    retryStartupCheck: checkRuntime,
    logout,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the authentication state from any component inside `<AuthProvider>`.
 * Throws if used outside the provider.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
