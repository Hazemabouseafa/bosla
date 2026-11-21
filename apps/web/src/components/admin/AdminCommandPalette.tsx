'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Command,
  Search,
  User,
  X,
  Zap,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  category: 'تنقل سريع' | 'إجراءات فورية' | 'كورسات' | 'حسابات المستخدمين';
  icon?: React.ReactNode;
  onSelect: () => void;
}

/**
 * Modern Spotlight / Command Palette (Ctrl+K / Cmd+K) built on native top-layer <dialog>
 * following semantic HTML dialog accessibility & pointer backdrop dismissal rules.
 */
export function AdminCommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressedOutsideRef = useRef(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 14);
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.subtitle || '').toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q),
      )
      .slice(0, 16);
  }, [items, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setQuery('');
      setActiveIdx(0);
      if (!dialog.open) {
        dialog.showModal();
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const isPointerOutside = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dlg = dialogRef.current;
    if (!dlg) return false;
    const rect = dlg.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  if (!open) return null;

  const runItem = (item: CommandItem) => {
    onClose();
    item.onSelect();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onPointerDown={(e) => {
        pressedOutsideRef.current = isPointerOutside(e);
      }}
      onPointerUp={(e) => {
        if (pressedOutsideRef.current && isPointerOutside(e)) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
      {...({ closedby: 'any' } as any)}
      aria-label="لوحة الأوامر والوصول السريع"
      className="w-[min(94vw,680px)] overflow-hidden rounded-2xl border border-[#8CA2FF]/45 bg-[#0B1440] p-0 text-[#EEF0FF] shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-[#22307A] bg-[#0F1A4A] px-4 py-3">
        <Search className="h-5 w-5 shrink-0 text-[#8CA2FF]" />
        <input
          ref={inputRef}
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) =>
                filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0,
              );
            } else if (e.key === 'Enter' && filtered[activeIdx]) {
              e.preventDefault();
              runItem(filtered[activeIdx]);
            }
          }}
          placeholder="ابحث عن كورس، مستخدم، تبويب، أو إجراء فوري..."
          className="w-full bg-transparent py-1.5 text-sm sm:text-base text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 focus:outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق لوحة الأوامر"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[60dvh] overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#A9B1E0]">
            لا توجد أوامر أو نتائج مطابقة لـ «{query}»
          </div>
        ) : (
          filtered.map((item, idx) => {
            const isSelected = idx === activeIdx;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => runItem(item)}
                className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-start transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#7C95FF]/20 border border-[#8CA2FF]/50 text-[#EEF0FF]'
                    : 'border border-transparent hover:bg-[#0F1A4A] text-[#EEF0FF]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0F1A4A] border border-[#22307A] text-[#8CA2FF]">
                    {item.icon ||
                      (item.category === 'كورسات' ? (
                        <BookOpen className="h-4 w-4" />
                      ) : item.category === 'حسابات المستخدمين' ? (
                        <User className="h-4 w-4" />
                      ) : item.category === 'إجراءات فورية' ? (
                        <Zap className="h-4 w-4" />
                      ) : (
                        <Command className="h-4 w-4" />
                      ))}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#EEF0FF] truncate">{item.label}</p>
                    {item.subtitle && (
                      <p className="text-xs text-[#A9B1E0] truncate">{item.subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-md bg-[#0F1A4A] border border-[#22307A] px-2 py-0.5 text-[11px] font-bold text-[#A9B1E0]">
                    {item.category}
                  </span>
                  <ArrowLeft className="h-3.5 w-3.5 text-[#8CA2FF]" />
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#22307A] bg-[#0F1A4A] px-4 py-2 text-[11px] text-[#A9B1E0]">
        <span>استخدم الأسهم ↑↓ للتنقل و Enter للتنفيذ</span>
        <span dir="ltr" className="font-mono text-[#8CA2FF]">
          Ctrl + K / Esc
        </span>
      </div>
    </dialog>
  );
}
