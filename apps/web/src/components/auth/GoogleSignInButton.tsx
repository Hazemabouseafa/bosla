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

  return (
    <div className="space-y-3">
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {isConfigured ? (
        <div className="flex flex-col items-center">
          <div ref={btnContainerRef} className="min-h-[44px]" />
          {busy && (
            <p className="mt-2 text-xs font-bold text-bosla-primary">
              جاري التحقق من هوية جوجل على الخادم...
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-bosla-line bg-bosla-bg/60 p-4 text-center space-y-1.5">
          <p className="text-xs font-extrabold text-bosla-navy">
            تسجيل الدخول عبر Google (OpenID Connect)
          </p>
          <p className="text-xs text-bosla-muted leading-relaxed">
            التكامل جاهز في الخادم الخلفي والواجهة؛ أضف{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-[11px] font-bold">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID
            </code>{' '}
            و{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-[11px] font-bold">
              GOOGLE_CLIENT_ID
            </code>{' '}
            في متغيرات البيئة لتفعيل زر Google المباشر.
          </p>
        </div>
      )}
    </div>
  );
}
