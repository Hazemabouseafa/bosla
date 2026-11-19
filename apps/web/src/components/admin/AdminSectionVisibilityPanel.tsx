'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutGrid,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  resolveSectionVisibility,
  SITE_SECTIONS_CATALOG,
  type SectionVisibilityMap,
  type SiteSectionKey,
} from '@/lib/section-visibility';
import { Badge, Button, Card, inputClassName } from '@/components/ui/primitives';

export function AdminSectionVisibilityPanel() {
  const { pushToast } = useAuth();
  const [visibility, setVisibility] = useState<SectionVisibilityMap>(() =>
    resolveSectionVisibility(null),
  );
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');

  const loadVisibility = useCallback(async () => {
    setLoading(true);
    try {
      const col = await apiFetch<{ settings?: Record<string, any> }>(
        '/admin/cms/collections',
      );
      const raw = col?.settings?.section_visibility ?? col?.settings?.platform?.sectionVisibility ?? null;
      setVisibility(resolveSectionVisibility(raw));
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل إعدادات ظهور الأقسام', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadVisibility();
  }, [loadVisibility]);

  const persistMap = async (nextMap: SectionVisibilityMap, toastText: string, busyKey: string) => {
    setSavingKey(busyKey);
    try {
      await apiFetch('/admin/settings/section_visibility', {
        method: 'PUT',
        body: JSON.stringify({ value: nextMap }),
      });
      setVisibility(nextMap);
      pushToast(toastText, 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ حالة القسم', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = async (key: SiteSectionKey, titleAr: string) => {
    const nextVisible = !visibility[key];
    const nextMap: SectionVisibilityMap = {
      ...visibility,
      [key]: nextVisible,
    };
    await persistMap(
      nextMap,
      nextVisible ? `تم إظهار "${titleAr}" للزوار بنجاح` : `تم إخفاء "${titleAr}" عن الزوار بنجاح`,
      key,
    );
  };

  const handleShowAll = async () => {
    const allVisible = resolveSectionVisibility({});
    await persistMap(allVisible, 'تم إظهار جميع أقسام المنصة الـ 15 بنجاح', '__all__');
  };

  const visibleCount = useMemo(
    () => SITE_SECTIONS_CATALOG.filter((s) => visibility[s.key]).length,
    [visibility],
  );
  const hiddenCount = SITE_SECTIONS_CATALOG.length - visibleCount;

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SITE_SECTIONS_CATALOG.filter((item) => {
      const isVisible = visibility[item.key];
      if (filterMode === 'VISIBLE' && !isVisible) return false;
      if (filterMode === 'HIDDEN' && isVisible) return false;
      if (!q) return true;
      return (
        item.titleAr.toLowerCase().includes(q) ||
        item.descriptionAr.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q)
      );
    });
  }, [search, filterMode, visibility]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-[#8CA2FF]" />
            التحكم في إظهار وإخفاء أقسام الموقع (Sections Control)
          </h2>
          <p className="text-sm text-[#A9B1E0] mt-0.5">
            أظهر أو أخفِ أي قسم في الصفحة الرئيسية أو التذييل بضغطة واحدة مع تطبيق فوري على واجهة الزوار.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" target="_blank">
            <Button type="button" variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" />
              معاينة الرئيسية
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadVisibility()}
            disabled={loading || savingKey !== null}
          >
            <RefreshCw className="h-4 w-4" />
            تحديث الحالة
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void handleShowAll()}
            disabled={savingKey !== null || hiddenCount === 0}
          >
            <RotateCcw className="h-4 w-4" />
            إظهار جميع الأقسام
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#8CA2FF]/30 bg-[#7C95FF]/15 text-[#8CA2FF]">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-[#A9B1E0]">إجمالي الأقسام القابلة للتحكم</p>
            <p className="text-xl font-extrabold text-[#EEF0FF]">{SITE_SECTIONS_CATALOG.length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#77E2B5]/30 bg-[#77E2B5]/15 text-[#77E2B5]">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-[#A9B1E0]">الأقسام الظاهرة حالياً</p>
            <p className="text-xl font-extrabold text-[#77E2B5]">{visibleCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#FF9CAA]/30 bg-[#FF9CAA]/15 text-[#FF9CAA]">
            <EyeOff className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-[#A9B1E0]">الأقسام المخفية حالياً</p>
            <p className="text-xl font-extrabold text-[#FF9CAA]">{hiddenCount}</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <label htmlFor="sec-search" className="visually-hidden">
            ابحث في أقسام الموقع
          </label>
          <input
            id="sec-search"
            type="search"
            className={`${inputClassName} ps-9`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم القسم أو المعرف (مثل: الدبلومات، hero...)"
          />
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-[#A9B1E0]" />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'ALL', label: `الكل (${SITE_SECTIONS_CATALOG.length})` },
              { id: 'VISIBLE', label: `الظاهرة (${visibleCount})` },
              { id: 'HIDDEN', label: `المخفية (${hiddenCount})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterMode(f.id)}
              className={`min-h-[40px] rounded-xl border px-3.5 text-xs font-extrabold transition-colors cursor-pointer ${
                filterMode === f.id
                  ? 'border-[#8CA2FF] bg-[#7C95FF] text-[#070D2B]'
                  : 'border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF] hover:text-[#EEF0FF]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections Grid */}
      {loading ? (
        <Card className="p-8 text-center text-sm text-[#A9B1E0]">
          جاري تحميل خريطة الأقسام وحالتها...
        </Card>
      ) : filteredSections.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[#A9B1E0]">
          لا توجد أقسام مطابقة لمعايير التصفية الحالية.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredSections.map((item) => {
            const isVisible = visibility[item.key];
            const isBusy = savingKey === item.key || savingKey === '__all__';
            return (
              <Card
                key={item.key}
                className={`p-5 flex flex-col justify-between gap-4 border transition-colors ${
                  isVisible
                    ? 'border-[#22307A] bg-[#0B1440]'
                    : 'border-[#FF9CAA]/35 bg-[#0B1440]/90'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={isVisible ? 'success' : 'danger'}>
                        {isVisible ? 'ظاهر للزوار' : 'مخفي عن الزوار'}
                      </Badge>
                      <Badge tone="info">{item.areaAr}</Badge>
                    </div>
                    <code
                      dir="ltr"
                      className="rounded-md border border-[#22307A] bg-[#0B1440] px-2 py-0.5 text-[11px] font-bold text-[#A9B1E0]"
                    >
                      {item.key}
                    </code>
                  </div>

                  <h3 className="text-base font-extrabold text-[#EEF0FF]">
                    {item.titleAr}
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#A9B1E0]">
                    {item.descriptionAr}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[#1E2B6F] pt-3">
                  <span className="text-xs font-semibold text-[#A9B1E0]">
                    الحالة:{' '}
                    <strong className={isVisible ? 'text-[#77E2B5]' : 'text-[#FF9CAA]'}>
                      {isVisible ? 'مفعّل على الموقع' : 'معطّل ومخفي'}
                    </strong>
                  </span>
                  <Button
                    id={`toggle-section-${item.key}`}
                    type="button"
                    variant={isVisible ? 'outline' : 'primary'}
                    size="sm"
                    aria-pressed={isVisible}
                    disabled={isBusy}
                    onClick={() => void handleToggle(item.key, item.titleAr)}
                  >
                    {isVisible ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        إخفاء القسم
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        إظهار القسم
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
