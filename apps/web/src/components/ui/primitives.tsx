'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, X } from 'lucide-react';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'navy' | 'gold' | 'success' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-bosla-primary text-white hover:bg-bosla-navy shadow-sm disabled:opacity-50',
    navy: 'bg-bosla-navy text-white hover:bg-[#08206c] shadow-sm disabled:opacity-50',
    gold: 'bg-bosla-amber text-bosla-ink hover:bg-[#eab03e] font-bold shadow-sm disabled:opacity-50',
    success:
      'bg-bosla-success text-white hover:bg-[#198c61] shadow-sm disabled:opacity-50',
    outline:
      'border border-bosla-line bg-white text-bosla-ink hover:border-bosla-primary hover:text-bosla-primary disabled:opacity-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50',
    ghost: 'text-bosla-muted hover:bg-indigo-50 hover:text-bosla-ink',
  };
  const sizes: Record<string, string> = {
    sm: 'min-h-[38px] px-3 py-1.5 text-xs',
    md: 'min-h-[44px] px-5 py-2.5 text-sm',
    lg: 'min-h-[48px] px-6 py-3 text-base',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors focus-visible:outline-none cursor-pointer disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'purple';
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-indigo-50 text-bosla-primary border-indigo-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    purple: 'bg-purple-50 text-bosla-purple border-purple-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-bosla-line bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-bosla-ink">
        {label}
        {required && <span className="text-rose-600 ms-1" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-bosla-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClassName =
  'w-full min-h-[44px] rounded-xl border border-bosla-line bg-white px-3.5 py-2.5 text-sm text-bosla-ink placeholder:text-slate-400 focus:border-bosla-primary focus:outline-none';

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  name,
  ariaInvalid,
  ariaDescribedBy,
}: {
  id: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  name?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={`${inputClassName} pe-12`}
        dir="ltr"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        aria-pressed={visible}
        className="absolute end-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-bosla-muted hover:bg-indigo-50 hover:text-bosla-ink"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AlertBanner({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    info: 'border-indigo-200 bg-indigo-50/90 text-bosla-ink',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    danger: 'border-rose-200 bg-rose-50 text-rose-950',
  };
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-2xl border p-4 text-sm ${styles[tone]}`}
    >
      <div className="flex items-start gap-2.5">
        {tone === 'success' ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
        ) : tone === 'danger' || tone === 'warning' ? (
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
        ) : (
          <Info className="h-5 w-5 shrink-0 text-bosla-primary mt-0.5" />
        )}
        <div className="flex-1">
          {title && <p className="font-bold mb-1">{title}</p>}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function NativeModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="modal-heading"
      className="w-[min(92vw,720px)] rounded-3xl border border-bosla-line bg-white p-0 text-bosla-ink shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-bosla-line px-6 py-4">
        <h2 id="modal-heading" className="text-lg font-extrabold text-bosla-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق النافذة"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-bosla-muted hover:bg-indigo-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-8 text-center">
      <p className="text-lg font-extrabold text-bosla-ink mb-2">{title}</p>
      <p className="text-sm text-bosla-muted max-w-md mx-auto mb-5">{description}</p>
      {action}
    </Card>
  );
}
