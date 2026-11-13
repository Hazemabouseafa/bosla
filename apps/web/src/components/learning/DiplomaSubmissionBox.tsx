'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AlertBanner, Button, Field, inputClassName } from '@/components/ui/primitives';

export function DiplomaSubmissionBox({ assessmentId }: { assessmentId: string }) {
  const { user, pushToast } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="rounded-xl bg-indigo-50/70 p-3 text-xs text-bosla-ink flex items-center justify-between gap-2">
        <span>سجّل الدخول بحساب مشترك لتسليم مشروع الدبلومة</span>
        <Link href="/login">
          <Button variant="primary" size="sm">
            تسجيل الدخول
          </Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      await apiFetch(`/learning/diplomas/assessments/${assessmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ submissionText: text }),
      });
      setResult('تم استلام تسليمك بنجاح وإرساله لمراجعة المدربين والإدارة.');
      setText('');
      pushToast('تم تسليم مشروع الدبلومة', 'success');
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال التسليم — تأكد من نشاط عضويتك.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-bosla-line">
      {result && <AlertBanner tone="success">{result}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      <Field id={`ass-${assessmentId}`} label="رابط أو ملخص المشروع العملي" required>
        <textarea
          id={`ass-${assessmentId}`}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب خطة التقييم أو الصق رابط ملف المشروع التطبيقي..."
          className={inputClassName}
          required
          minLength={20}
        />
      </Field>
      <Button type="submit" variant="navy" size="sm" disabled={busy}>
        {busy ? 'جاري التسليم...' : 'تسليم التقييم الآن'}
      </Button>
    </form>
  );
}
