'use client';

import React, { useRef, useState } from 'react';
import { Check, Image as ImageIcon, Loader2, UploadCloud } from 'lucide-react';
import { uploadCourseImage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Field, inputClassName } from '@/components/ui/primitives';

export interface ImagePresetOption {
  label: string;
  url: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function ImageUploadField({
  inputId,
  urlInputId,
  label = 'صورة غلاف الكورس',
  value,
  onChange,
  presets = [],
  compact = false,
}: {
  inputId: string;
  urlInputId: string;
  label?: string;
  value: string;
  onChange: (nextUrl: string) => void;
  presets?: ImagePresetOption[];
  compact?: boolean;
}) {
  const { pushToast } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFromDevice, setUploadedFromDevice] = useState(false);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) {
      pushToast('الرجاء اختيار صورة بصيغة JPG أو PNG أو WebP أو GIF', 'error');
      return;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      pushToast('حجم الصورة يجب أن يكون أقل من 10 ميجابايت', 'error');
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadCourseImage(file);
      onChange(uploaded.url);
      setUploadedFromDevice(true);
      pushToast('تم رفع صورة الغلاف من جهازك بنجاح', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر رفع الصورة', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#EEF0FF] flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-[#8CA2FF]" />
          {label}
        </p>
        {uploadedFromDevice && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#77E2B5]/40 bg-[#77E2B5]/15 px-2.5 py-0.5 text-xs font-bold text-[#77E2B5]">
            <Check className="h-3.5 w-3.5" />
            مرفوعة من جهازك
          </span>
        )}
      </div>

      {/* Live Preview + Local Device Dropzone */}
      <div
        className={`grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-[180px_1fr]'} items-stretch`}
      >
        <div className="overflow-hidden rounded-xl border border-[#22307A] bg-[#0B1440] aspect-video sm:aspect-auto min-h-[116px] flex items-center justify-center">
          {value ? (
            <img
              src={value}
              alt="معاينة صورة الغلاف"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 p-3 text-center text-xs text-[#A9B1E0]">
              <ImageIcon className="h-6 w-6 text-[#8CA2FF]" />
              <span>لا توجد صورة غلاف حالياً</span>
            </div>
          )}
        </div>

        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-[#8CA2FF] bg-[#7C95FF]/15'
              : 'border-[#22307A] bg-[#0B1440] hover:border-[#8CA2FF]'
          }`}
        >
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-[#8CA2FF]" />
              <span className="text-sm font-bold text-[#EEF0FF]">جاري رفع الصورة إلى المنصة...</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-[#8CA2FF]" />
              <span className="text-sm font-extrabold text-[#EEF0FF]">
                رفع صورة من جهازك (اضغط للاختيار أو اسحب الصورة هنا)
              </span>
              <span className="text-xs text-[#A9B1E0]">
                يدعم JPG / PNG / WebP / GIF حتى 10 ميجابايت
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#7C95FF] px-3 py-1.5 text-xs font-extrabold text-[#070D2B]">
                اختيار صورة من الجهاز
              </span>
            </>
          )}
        </label>
      </div>

      {/* Approved Quick Presets */}
      {presets.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-[#A9B1E0]">أو اختر من الصور الجاهزة المعتمدة:</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto rounded-xl border border-[#22307A] p-2 bg-[#0B1440]">
            {presets.map((preset) => {
              const selected = value === preset.url;
              return (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => {
                    onChange(preset.url);
                    setUploadedFromDevice(false);
                  }}
                  className={`relative rounded-xl overflow-hidden border-2 text-start transition-all cursor-pointer ${
                    selected
                      ? 'border-[#8CA2FF] ring-2 ring-[#8CA2FF]/30'
                      : 'border-transparent hover:border-[#22307A]'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.label}
                    className="h-12 w-full object-cover"
                  />
                  <span className="block truncate bg-[#070D2B]/95 px-1.5 py-1 text-[11px] font-bold text-[#EEF0FF]">
                    {preset.label}
                  </span>
                  {selected && (
                    <span className="absolute top-1 end-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#7C95FF] text-[#070D2B]">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional direct URL input */}
      <Field id={urlInputId} label="أو أدخل رابط الصورة يدوياً (اختياري)">
        <input
          id={urlInputId}
          dir="ltr"
          className={inputClassName}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setUploadedFromDevice(false);
          }}
          placeholder="/images/brand/course-farm-management.webp"
        />
      </Field>
    </div>
  );
}
