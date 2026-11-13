'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiFetch, setClientCsrfToken } from './api';

export interface SessionUser {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string | null;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  status: 'ENROLLMENT_PENDING' | 'ACTIVE' | 'LOCKED' | 'SUSPENDED';
  authProvider: 'GOOGLE' | 'PHONE_PASSWORD';
  avatarUrl?: string | null;
  headlineAr?: string | null;
  bioAr?: string | null;
  hasGoogleLinked?: boolean;
  passkeyCount?: number;
  unusedRecoveryCodesCount?: number;
}

interface ToastItem {
  id: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  requiresPasskeyEnrollment: boolean;
  refreshSession: () => Promise<SessionUser | null>;
  logout: () => Promise<void>;
  pushToast: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            retry: 1,
          },
        },
      }),
  );

  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresPasskeyEnrollment, setRequiresPasskeyEnrollment] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (text: string, tone: 'success' | 'error' | 'info' = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, tone, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch<{
        user: SessionUser;
        csrfToken: string;
        requiresPasskeyEnrollment: boolean;
      }>('/auth/me');
      setClientCsrfToken(data.csrfToken);
      setUser(data.user);
      setRequiresPasskeyEnrollment(Boolean(data.requiresPasskeyEnrollment));
      return data.user;
    } catch {
      setClientCsrfToken(null);
      setUser(null);
      setRequiresPasskeyEnrollment(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Clear local state regardless
    }
    setClientCsrfToken(null);
    setUser(null);
    setRequiresPasskeyEnrollment(false);
    queryClient.clear();
    pushToast('تم تسجيل الخروج بنجاح', 'info');
  }, [pushToast, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          isLoading,
          requiresPasskeyEnrollment,
          refreshSession,
          logout,
          pushToast,
        }}
      >
        {children}
        <div
          aria-live="polite"
          className="fixed bottom-4 start-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl border ${
                t.tone === 'success'
                  ? 'bg-emerald-950 text-emerald-50 border-emerald-700'
                  : t.tone === 'error'
                    ? 'bg-rose-950 text-rose-50 border-rose-700'
                    : 'bg-bosla-navy text-white border-indigo-700'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AppProviders');
  return ctx;
}
