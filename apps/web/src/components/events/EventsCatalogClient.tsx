'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Search,
  Ticket,
  Users,
} from 'lucide-react';
import { formatDate, formatEgp, formatTimeOnly } from '@/lib/api';
import { Badge, Button, EmptyState } from '@/components/ui/primitives';

export interface PublicOfflineEvent {
  id: string;
  slug: string;
  titleAr: string;
  subtitleAr?: string | null;
  descriptionAr: string;
  thumbnailUrl?: string | null;
  categoryLabelAr: string;
  cityAr: string;
  venueNameAr: string;
  venueAddressAr: string;
  startsAt: string;
  endsAt?: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  currency: string;
  capacity: number;
  seatsBooked: number;
  remainingSeats: number;
  status: string;
  highlights: string[];
  speakerNameAr?: string | null;
  instructor?: {
    id: string;
    fullName: string;
    headlineAr?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export function EventsCatalogClient({ initialEvents }: { initialEvents: PublicOfflineEvent[] }) {
  const [query, setQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const ev of initialEvents) {
      if (ev.cityAr) set.add(ev.cityAr);
    }
    return Array.from(set);
  }, [initialEvents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialEvents.filter((ev) => {
      if (selectedCity !== 'ALL' && ev.cityAr !== selectedCity) return false;
      if (!q) return true;
      return (
        ev.titleAr.toLowerCase().includes(q) ||
        (ev.subtitleAr || '').toLowerCase().includes(q) ||
        ev.cityAr.toLowerCase().includes(q) ||
        ev.venueNameAr.toLowerCase().includes(q) ||
        (ev.speakerNameAr || ev.instructor?.fullName || '').toLowerCase().includes(q)
      );
    });
  }, [initialEvents, query, selectedCity]);

  return (
    <div className="space-y-8">
      <search>
        <div className="rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-4 sm:p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="events-search" className="visually-hidden">
              ابحث في الفعاليات والكورسات الأوفلاين
            </label>
            <input
              id="events-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الورشة، المدينة، أو المدرب..."
              className="w-full min-h-[44px] rounded-xl border border-[#22307A] bg-[#0B1440] ps-10 pe-3.5 text-sm text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 focus:border-[#8CA2FF] focus:outline-none"
            />
            <Search className="pointer-events-none absolute start-3.5 top-3.5 h-4 w-4 text-[#A9B1E0]" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCity('ALL')}
              className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer tabular-nums ${
                selectedCity === 'ALL'
                  ? 'border-[#C084FC]/60 bg-[#6B21A8] text-white'
                  : 'border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:border-[#C084FC]/45 hover:text-[#EEF0FF]'
              }`}
            >
              جميع المدن ({initialEvents.length})
            </button>
            {cities.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  selectedCity === city
                    ? 'border-[#C084FC]/60 bg-[#6B21A8] text-white'
                    : 'border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:border-[#C084FC]/45 hover:text-[#EEF0FF]'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </search>

      {filtered.length === 0 ? (
        <EmptyState
          title="لا توجد فعاليات أوفلاين مطابقة لبحثك"
          description="جرّب تغيير المدينة أو البحث بكلمة أخرى أو تصفح كل الفعاليات القادمة."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ev) => {
            const speaker = ev.speakerNameAr || ev.instructor?.fullName || 'فريق خبراء بوصلة';
            const formattedDate = formatDate(ev.startsAt, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
            const formattedTime = formatTimeOnly(ev.startsAt, {
              hour: '2-digit',
              minute: '2-digit',
            });
            const isSoldOut = ev.remainingSeats <= 0;

            return (
              <article
                key={ev.id}
                className="bosla-card-hover group overflow-hidden rounded-2xl border border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF] flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#0B1440]">
                    <img
                      src={ev.thumbnailUrl || '/images/brand/course-farm-management.webp'}
                      alt={ev.titleAr}
                      className="bosla-card-media h-full w-full object-cover"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0F1A4A] via-transparent to-transparent"
                    />
                    <div className="absolute top-3 start-3 flex flex-wrap gap-1.5">
                      <Badge tone="info">{ev.categoryLabelAr}</Badge>
                      <Badge tone="purple">حضوري أوفلاين</Badge>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C084FC]/40 bg-[#6B21A8]/18 px-3 py-1 text-sm font-bold text-[#E9D5FF] tabular-nums">
                        <Ticket className="h-4 w-4 text-[#C084FC]" />
                        {ev.priceCents === 0 ? 'مجاناً' : formatEgp(ev.priceCents)}
                      </span>
                      {ev.compareAtPriceCents && ev.compareAtPriceCents > ev.priceCents && (
                        <span className="text-xs line-through text-[#A9B1E0] tabular-nums">
                          {formatEgp(ev.compareAtPriceCents)}
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold leading-snug text-[#EEF0FF]">
                      <Link
                        href={`/events/${ev.slug}`}
                        className="hover:text-[#E9D5FF] transition-colors"
                      >
                        <bdi>{ev.titleAr}</bdi>
                      </Link>
                    </h2>

                    {ev.subtitleAr && (
                      <p className="text-sm leading-[1.6] text-[#A9B1E0] line-clamp-2">
                        {ev.subtitleAr}
                      </p>
                    )}

                    <dl className="space-y-2 border-t border-[#22307A] pt-3 text-xs sm:text-sm text-[#A9B1E0]">
                      <div className="flex items-start gap-2">
                        <dt className="visually-hidden">التاريخ والوقت</dt>
                        <Calendar className="h-4 w-4 shrink-0 mt-0.5 text-[#8CA2FF]" />
                        <dd className="text-[#EEF0FF] font-semibold">
                          {formattedDate} • {formattedTime}
                        </dd>
                      </div>
                      <div className="flex items-start gap-2">
                        <dt className="visually-hidden">الموقع</dt>
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[#8CA2FF]" />
                        <dd>
                          {ev.cityAr} — {ev.venueNameAr}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-[#77E2B5]" />
                          <span className="font-bold text-[#EEF0FF]">{speaker}</span>
                        </div>
                        <Badge tone={isSoldOut ? 'danger' : ev.remainingSeats <= 5 ? 'warning' : 'success'}>
                          {isSoldOut ? 'مكتمل العدد' : `متاح ${ev.remainingSeats} مقعد`}
                        </Badge>
                      </div>
                    </dl>
                  </div>
                </div>

                <footer className="px-5 pb-5">
                  <Link href={`/events/${ev.slug}`}>
                    <Button variant={isSoldOut ? 'outline' : 'primary'} className="w-full">
                      {isSoldOut
                        ? 'عرض تفاصيل الفعالية'
                        : ev.priceCents === 0
                          ? 'التفاصيل وحجز مقعدك مجاناً'
                          : `احجز مقعدك الآن (${formatEgp(ev.priceCents)})`}
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
