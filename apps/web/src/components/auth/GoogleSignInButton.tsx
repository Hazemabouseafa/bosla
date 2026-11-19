'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AlertBanner } from '@/components/ui/primitives';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, any>) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({
  endpoint = '/auth/google',
  onSuccess,
  mode = 'signin',
}: {
  endpoint?: '/auth/google' | '/auth/google/link';
  onSuccess?: () => void;
  mode?: 'signin' | 'signup' | 'link';
}) {
  const { refreshSession, pushToast } = useAuth();
  const btnContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  const isConfigured =
    Boolean(googleClientId) && !googleClientId.includes('placeholder');

  useEffect(() => {
    if (!isConfigured) return;

    let cancelled = false;
    const initGoogle = () => {
      if (cancelled || !window.google?.accounts?.id || !btnContainerRef.current) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp) => {
          if (!resp?.credential) return;
          setError(null);
          setBusy(true);
          try {
            await apiFetch(endpoint, {
              method: 'POST',
              skipCsrf: endpoint === '/auth/google',
              body: JSON.stringify({ credential: resp.credential }),
            });
            await refreshSession();
            pushToast(
              mode === 'link'
                ? 'تم ربط حساب جوجل بنجاح'
                : 'تم تسجيل الدخول عبر حساب جوجل بنجاح',
              'success',
            );
            onSuccess?.();
          } catch (err: any) {
            setError(err?.message || 'تعذر التحقق من حساب جوجل');
          } finally {
            setBusy(false);
          }
        },
      });
      btnContainerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(btnContainerRef.current, {
        theme: 'outline',
        size: 'large',
        width: 340,
        text: mode === 'signup' ? 'signup_with' : 'continue_with',
        locale: 'ar',
      });
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const existing = document.getElementById('google-gis-script');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'google-gis-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', initGoogle);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [isConfigured, googleClientId, endpoint, mode, refreshSession, pushToast, onSuccess]);

  if (!isConfigured) {
    if (mode !== 'link') {
      return null;
    }
    return (
      <p className="rounded-xl border border-bosla-line bg-bosla-bg/60 px-3 py-2.5 text-xs text-bosla-muted">
        خدمة ربط حساب Google غير مفعّلة حالياً.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      <div className="flex flex-col items-center">
        <div ref={btnContainerRef} className="min-h-[44px]" />
        {busy && (
          <p className="mt-2 text-xs font-bold text-bosla-tealText">
            جاري التحقق من حساب جوجل...
          </p>
        )}
      </div>
    </div>
  );
}
