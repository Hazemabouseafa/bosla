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
  variant?: 'primary' | 'navy' | 'gold' | 'success' | 'outline' | 'glass' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}) {
  const hasCustomSurface = /(?:^|\s)!?(?:bg-|text-|!text-)/.test(className);
  const variants: Record<string, string> = {
    primary:
      'bg-[#7C95FF] text-[#070D2B] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_20px_-8px_rgba(124,149,255,0.45)] hover:bg-[#93A8FF] active:scale-[0.97] disabled:opacity-50',
    navy: 'border border-[#22307A] bg-[#0B1440] text-[#EEF0FF] font-semibold shadow-[inset_0_1px_0_rgba(238,240,255,0.06)] hover:border-[#8CA2FF] hover:bg-[#18266E] active:scale-[0.97] disabled:opacity-50',
    gold: 'border border-[#F5B94A]/45 bg-[#F5B94A]/14 text-[#F5B94A] font-semibold shadow-[inset_0_1px_0_rgba(245,185,74,0.18)] hover:bg-[#F5B94A]/22 active:scale-[0.97] disabled:opacity-50',
    success:
      'bg-[#77E2B5] text-[#070D2B] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-[#8CF0C5] active:scale-[0.97] disabled:opacity-50',
    outline: hasCustomSurface
      ? 'border border-[#22307A] font-semibold active:scale-[0.97] disabled:opacity-50'
      : 'border border-[#8CA2FF]/22 bg-[#0F1A4A]/90 text-[#EEF0FF] font-semibold shadow-[inset_0_1px_0_rgba(238,240,255,0.07)] hover:border-[#8CA2FF]/55 hover:bg-[#18266E] active:scale-[0.97] disabled:opacity-50',
    glass:
      'border border-[#8CA2FF]/22 bg-[#0F1A4A]/75 text-[#EEF0FF] font-semibold shadow-[inset_0_1px_0_rgba(238,240,255,0.08)] hover:border-[#8CA2FF]/55 hover:bg-[#18266E]/90 active:scale-[0.97] disabled:opacity-50',
    danger:
      'border border-[#FF9CAA]/40 bg-[#FF9CAA]/12 text-[#FF9CAA] font-semibold hover:bg-[#FF9CAA]/20 active:scale-[0.97] disabled:opacity-50',
    ghost:
      'text-[#A9B1E0] font-medium hover:bg-[#18266E] hover:text-[#EEF0FF] active:scale-[0.97]',
  };
  const sizes: Record<string, string> = {
    sm: 'min-h-[40px] px-3.5 py-2 text-xs sm:text-sm',
    md: 'min-h-[44px] px-4 py-2.5 text-sm',
    lg: 'min-h-[48px] px-6 py-3 text-base',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-crisp focus-visible:outline-none cursor-pointer disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
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
    neutral: 'bg-[#18266E]/80 text-[#A9B1E0] border-[#8CA2FF]/18',
    info: 'bg-[#7C95FF]/15 text-[#8CA2FF] border-[#8CA2FF]/35',
    warning: 'bg-[#F5B94A]/14 text-[#F5B94A] border-[#F5B94A]/35',
    success: 'bg-[#77E2B5]/14 text-[#77E2B5] border-[#77E2B5]/35',
    danger: 'bg-[#FF9CAA]/14 text-[#FF9CAA] border-[#FF9CAA]/35',
    purple: 'bg-[#18266E]/90 text-[#B4C4FF] border-[#8CA2FF]/30',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  id,
  className = '',
  spotlight = false,
  children,
}: {
  id?: string;
  className?: string;
  spotlight?: boolean;
  children: React.ReactNode;
}) {
  const hasCustomBg = /(?:^|\s)!?bg-/.test(className);
  const hasCustomBorder = /(?:^|\s)!?border-(?!t-|b-|s-|e-|x-|y-|\d)/.test(className);
  return (
    <div
      id={id}
      data-sc-spotlight={spotlight ? '' : undefined}
      className={`rounded-2xl border ${hasCustomBorder ? '' : 'border-[#8CA2FF]/16'} ${
        hasCustomBg ? '' : 'bosla-liquid-glass'
      } text-[#EEF0FF] transition-colors duration-200 ${className}`}
    >
      {children}
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-[#18266E]/70 ${className}`}
    />
  );
}

export function SkeletonDashboardGrid() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonBlock className="h-28 w-full" />
        <SkeletonBlock className="h-28 w-full" />
        <SkeletonBlock className="h-28 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonBlock className="h-64 w-full" />
        <SkeletonBlock className="h-64 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
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
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const autoId = React.useId();
  const fieldId = id || autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold text-[#EEF0FF]">
        {label}
        {required && <span className="text-[#FF9CAA] ms-1" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="text-xs sm:text-sm text-[#A9B1E0]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="text-xs sm:text-sm font-semibold text-[#FF9CAA]">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClassName =
  'w-full min-h-[44px] rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440]/90 px-3.5 py-2.5 text-sm sm:text-base text-[#EEF0FF] placeholder:text-[#A9B1E0]/65 transition-colors duration-150 focus:border-[#8CA2FF] focus:ring-2 focus:ring-[#7C95FF]/25 focus:outline-none';

export const textareaClassName = `${inputClassName} min-h-[96px] resize-y`;

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
        className="absolute end-1.5 inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#A9B1E0] hover:bg-[#18266E] hover:text-[#EEF0FF] cursor-pointer"
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
    info: 'border-[#8CA2FF]/35 bg-[#0F1A4A]/95 text-[#EEF0FF]',
    success: 'border-[#77E2B5]/40 bg-[#0F1A4A]/95 text-[#77E2B5]',
    warning: 'border-[#F5B94A]/40 bg-[#0F1A4A]/95 text-[#F5B94A]',
    danger: 'border-[#FF9CAA]/40 bg-[#0F1A4A]/95 text-[#FF9CAA]',
  };
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-xl border p-4 text-sm shadow-[inset_0_1px_0_rgba(238,240,255,0.06)] ${styles[tone]}`}
    >
      <div className="flex items-start gap-2.5">
        {tone === 'success' ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#77E2B5] mt-0.5" />
        ) : tone === 'danger' ? (
          <AlertCircle className="h-5 w-5 shrink-0 text-[#FF9CAA] mt-0.5" />
        ) : tone === 'warning' ? (
          <AlertCircle className="h-5 w-5 shrink-0 text-[#F5B94A] mt-0.5" />
        ) : (
          <Info className="h-5 w-5 shrink-0 text-[#8CA2FF] mt-0.5" />
        )}
        <div className="flex-1">
          {title && <p className="font-semibold mb-1">{title}</p>}
          <div className="text-[#EEF0FF]/90">{children}</div>
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
  const headingId = React.useId();

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
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      {...({ closedby: 'any' } as any)}
      aria-labelledby={headingId}
      className="w-[min(94vw,760px)] overflow-hidden rounded-2xl border border-[#8CA2FF]/20 bosla-liquid-glass p-0 text-[#EEF0FF]"
    >
      <div className="flex items-center justify-between border-b border-[#8CA2FF]/16 bg-[#0B1440] px-6 py-4 text-[#EEF0FF]">
        <h2 id={headingId} className="text-lg font-semibold text-[#EEF0FF]">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق النافذة"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] transition-colors hover:border-[#8CA2FF] hover:text-[#EEF0FF] cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6 max-h-[82dvh] overflow-y-auto text-[#EEF0FF]">{children}</div>
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
      <img
        src="/icons/bosla/empty-desk.svg"
        alt=""
        width={180}
        height={135}
        className="mx-auto mb-4 h-32 w-auto opacity-90"
      />
      <p className="text-lg font-semibold text-[#EEF0FF] mb-2">{title}</p>
      <p className="text-sm text-[#A9B1E0] max-w-md mx-auto mb-5">{description}</p>
      {action}
    </Card>
  );
}
