'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MoreVertical,
  Play,
  Star,
  TrendingUp,
} from 'lucide-react';
import { formatDate, formatNumber } from '@/lib/api';
import { Badge, Button } from '@/components/ui/primitives';

/**
 * KPI Metric Card:
 * Clean figure with tabular numerals + label + subtle delta on start, quiet icon frame on end.
 */
export function BentoKpiCard({
  value,
  label,
  delta,
  deltaTone = 'success',
  icon,
  iconBgClass = 'border border-[#22307A] bg-[#0B1440] text-[#8CA2FF]',
}: {
  value: string | number;
  label: string;
  delta?: string;
  deltaTone?: 'success' | 'warning' | 'danger' | 'info';
  icon: React.ReactNode;
  iconBgClass?: string;
}) {
  const deltaColor =
    deltaTone === 'success'
      ? 'text-[#77E2B5]'
      : deltaTone === 'warning'
        ? 'text-[#F5B94A]'
        : deltaTone === 'danger'
          ? 'text-[#FF9CAA]'
          : 'text-[#8CA2FF]';

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-4 sm:p-5 transition-colors duration-150 hover:border-[#8CA2FF]/45">
      <div className="min-w-0 space-y-1">
        <p className="text-2xl sm:text-[28px] leading-tight font-semibold text-[#EEF0FF] tabular-nums truncate">
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
        <p className="text-xs sm:text-[13px] font-medium text-[#A9B1E0] truncate">{label}</p>
        {delta && <p className={`text-xs font-medium tabular-nums ${deltaColor} truncate`}>{delta}</p>}
      </div>
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBgClass}`}
      >
        {icon}
      </span>
    </div>
  );
}

/**
 * Course / Program Spotlight Card with quiet raised thumbnail frame, progress bar & action button.
 */
export function BentoCourseSpotlightCard({
  title,
  subtitle,
  thumbnailUrl,
  progressPercent,
  ctaLabel,
  highlighted = false,
  tintIndex: _tintIndex = 0,
  href,
  onClick,
  badgeText,
}: {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  progressPercent: number;
  ctaLabel: string;
  highlighted?: boolean;
  tintIndex?: number;
  href?: string;
  onClick?: () => void;
  badgeText?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progressPercent || 0)));

  const ctaBtn = (
    <Button
      type="button"
      variant={highlighted ? 'primary' : 'outline'}
      size="sm"
      onClick={onClick}
      className="w-full rounded-lg"
    >
      {ctaLabel}
    </Button>
  );

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors duration-150 bg-[#0F1A4A] ${
        highlighted
          ? 'border-[#8CA2FF]/65'
          : 'border-[#22307A] hover:border-[#8CA2FF]/45'
      }`}
    >
      <div className="space-y-3">
        <div className="relative h-28 w-full overflow-hidden rounded-lg border border-[#22307A] bg-[#0B1440] flex items-center justify-center">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#22307A] bg-[#0F1A4A] text-[#8CA2FF]">
              <Play className="h-5 w-5" />
            </div>
          )}
          {badgeText && (
            <span className="absolute top-2 start-2 rounded-md border border-[#22307A] bg-[#070D2B]/90 px-2 py-0.5 text-[11px] font-medium text-[#EEF0FF]">
              {badgeText}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[#EEF0FF] line-clamp-1">{title}</h3>
          {subtitle && <p className="text-xs text-[#A9B1E0] truncate">{subtitle}</p>}
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#18266E]">
              <div
                className="h-full rounded-full bg-[#77E2B5] transition-[width] duration-300"
                style={{ width: `${Math.max(4, pct)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[#A9B1E0] tabular-nums">{formatNumber(pct)}%</span>
          </div>
        </div>
      </div>

      <div className="pt-3">{href ? <Link href={href}>{ctaBtn}</Link> : ctaBtn}</div>
    </div>
  );
}

export interface MonthlyChartPoint {
  label: string;
  current: number;
  previous: number;
}

/**
 * Dual-Series Smooth Cubic Bezier SVG Area Chart
 * (Indigo current series + Coral-Pink previous series + floating peak badge)
 */
export function MonthlyProgressSplineChart({
  title = 'النمو والتقدم الشهري',
  currentLabel = 'الحالي',
  previousLabel = 'السابق',
  valueUnit = '',
  seriesByFilter,
}: {
  title?: string;
  currentLabel?: string;
  previousLabel?: string;
  valueUnit?: string;
  seriesByFilter: Record<string, MonthlyChartPoint[]>;
}) {
  const filterKeys = Object.keys(seriesByFilter);
  const [selectedFilter, setSelectedFilter] = useState(filterKeys[0] || 'الكل');
  const points = useMemo(
    () => seriesByFilter[selectedFilter] ?? seriesByFilter[filterKeys[0]] ?? [],
    [seriesByFilter, selectedFilter, filterKeys],
  );

  // Peak index defaults to highest current point
  const defaultPeakIdx = useMemo(() => {
    if (points.length === 0) return 0;
    let maxIdx = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].current >= points[maxIdx].current) maxIdx = i;
    }
    return maxIdx;
  }, [points]);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const activeIdx = hoveredIdx !== null && points[hoveredIdx] ? hoveredIdx : defaultPeakIdx;

  // Compute SVG coordinates
  const W = 680;
  const H = 220;
  const PAD_L = 42;
  const PAD_R = 16;
  const PAD_T = 36;
  const PAD_B = 30;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const maxVal = useMemo(() => {
    const rawMax = Math.max(
      10,
      ...points.flatMap((p) => [Number(p.current || 0), Number(p.previous || 0)]),
    );
    return Math.ceil(rawMax * 1.15);
  }, [points]);

  const getCoord = (idx: number, val: number) => {
    const stepX = points.length > 1 ? chartW / (points.length - 1) : chartW;
    const x = PAD_L + idx * stepX;
    const y = PAD_T + chartH - (Math.max(0, val) / maxVal) * chartH;
    return { x, y };
  };

  const buildSmoothPath = (coords: Array<{ x: number; y: number }>) => {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cx = ((p0.x + p1.x) / 2).toFixed(1);
      d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const buildAreaPath = (linePath: string, coords: Array<{ x: number; y: number }>) => {
    if (!linePath || coords.length === 0) return '';
    const first = coords[0];
    const last = coords[coords.length - 1];
    const baseY = (PAD_T + chartH).toFixed(1);
    return `${linePath} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
  };

  const currentCoords = points.map((p, i) => getCoord(i, p.current));
  const prevCoords = points.map((p, i) => getCoord(i, p.previous));
  const currentLine = buildSmoothPath(currentCoords);
  const prevLine = buildSmoothPath(prevCoords);
  const currentArea = buildAreaPath(currentLine, currentCoords);
  const prevArea = buildAreaPath(prevLine, prevCoords);

  const activePoint = points[activeIdx];
  const activeCoord = currentCoords[activeIdx];
  const tooltipText = activePoint
    ? `${formatNumber(activePoint.current)}${valueUnit ? ` ${valueUnit}` : ''}`
    : '';

  return (
    <div className="rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[#EEF0FF] flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#8CA2FF]" />
          {title}
        </h3>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#EEF0FF]">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#7C95FF]" />
            {currentLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#A9B1E0]">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#F2498D]" />
            {previousLabel}
          </span>

          {filterKeys.length > 0 && (
            <select
              aria-label="تصفية المخطط الشهري"
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="rounded-lg border border-[#22307A] bg-[#0B1440] px-3 py-1 text-xs font-medium text-[#EEF0FF] focus:outline-none cursor-pointer"
            >
              {filterKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label={title}>
          <defs>
            <linearGradient id="boslaCurrentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C95FF" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#7C95FF" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="boslaPrevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F2498D" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#F2498D" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines + Y-axis Ticks */}
          {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = PAD_T + chartH * (1 - ratio);
            const tickVal = Math.round(maxVal * ratio);
            return (
              <g key={idx}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke="#22307A"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
                <text
                  x={PAD_L - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#A9B1E0"
                  fontSize="10"
                  fontWeight="700"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Previous Series Area & Line */}
          {prevArea && <path d={prevArea} fill="url(#boslaPrevFill)" />}
          {prevLine && (
            <path d={prevLine} fill="none" stroke="#F2498D" strokeWidth="2.2" strokeLinecap="round" />
          )}

          {/* Current Series Area & Line */}
          {currentArea && <path d={currentArea} fill="url(#boslaCurrentFill)" />}
          {currentLine && (
            <path
              d={currentLine}
              fill="none"
              stroke="#7C95FF"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          )}

          {/* Active Point Vertical Guide + Dot + Pill Tooltip */}
          {activeCoord && activePoint && (
            <g>
              <line
                x1={activeCoord.x}
                y1={activeCoord.y}
                x2={activeCoord.x}
                y2={PAD_T + chartH}
                stroke="#8CA2FF"
                strokeDasharray="3 3"
                strokeWidth="1.2"
                opacity="0.7"
              />
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="5.5"
                fill="#EEF0FF"
                stroke="#4A43D9"
                strokeWidth="2.5"
              />
              {(() => {
                const pillW = Math.max(66, tooltipText.length * 7.2 + 20);
                const pillX = Math.min(
                  W - pillW - 6,
                  Math.max(PAD_L, activeCoord.x - pillW / 2),
                );
                const pillY = Math.max(4, activeCoord.y - 32);
                return (
                  <g>
                    <rect
                      x={pillX}
                      y={pillY}
                      width={pillW}
                      height="22"
                      rx="11"
                      fill="#4A43D9"
                    />
                    <text
                      x={pillX + pillW / 2}
                      y={pillY + 14.5}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10.5"
                      fontWeight="800"
                    >
                      {tooltipText}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Interactive Hit Targets & X-Axis Labels */}
          {points.map((p, i) => {
            const c = currentCoords[i];
            if (!c) return null;
            return (
              <g
                key={p.label}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => setHoveredIdx(i)}
              >
                <rect
                  x={c.x - 16}
                  y={PAD_T}
                  width="32"
                  height={chartH + 22}
                  fill="transparent"
                />
                <text
                  x={c.x}
                  y={H - 8}
                  textAnchor="middle"
                  fill={i === activeIdx ? '#EEF0FF' : '#A9B1E0'}
                  fontSize="10"
                  fontWeight={i === activeIdx ? '800' : '600'}
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Real Interactive Monthly Calendar Card for Side Insights Rail
 * Highlights live scheduled events/sessions in glowing indigo pills.
 */
export function EventDatesCalendarCard({
  title = 'مواعيد الفعاليات والجلسات',
  events,
  seeAllHref = '/events',
  onSeeAllClick,
}: {
  title?: string;
  events: Array<{ id: string; titleAr: string; startsAt: string | Date; cityAr?: string }>;
  seeAllHref?: string;
  onSeeAllClick?: () => void;
}) {
  const initialDate = useMemo(() => {
    if (events.length > 0 && events[0].startsAt) {
      const d = new Date(events[0].startsAt);
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [events]);

  const [viewMonth, setViewMonth] = useState<Date>(initialDate);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const eventDaysMap = useMemo(() => {
    const map = new Map<number, Array<{ id: string; titleAr: string; cityAr?: string }>>();
    for (const ev of events) {
      const d = new Date(ev.startsAt);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
        const list = map.get(d.getDate()) ?? [];
        list.push({ id: ev.id, titleAr: ev.titleAr, cityAr: ev.cityAr });
        map.set(d.getDate(), list);
      }
    }
    // Highlight today subtly if no events exist in month
    if (map.size === 0) {
      const today = new Date();
      if (today.getFullYear() === year && today.getMonth() === month) {
        map.set(today.getDate(), [{ id: 'today', titleAr: 'يوم العمل النشط', cityAr: 'مباشر' }]);
      }
    }
    return map;
  }, [events, year, month]);

  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    const firstKey = Array.from(eventDaysMap.keys())[0];
    return firstKey ?? new Date().getDate();
  });

  const cells: Array<{ day: number; currentMonth: boolean }> = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, currentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - (firstWeekday + daysInMonth) + 1, currentMonth: false });
  }

  const monthLabel = formatDate(viewMonth, { month: 'long', year: 'numeric' });
  const activeDayEvents = selectedDay ? eventDaysMap.get(selectedDay) ?? [] : [];

  return (
    <div className="rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#EEF0FF] flex items-center gap-1.5">
          <CalendarIcon className="h-4 w-4 text-[#8CA2FF]" />
          {title}
        </h3>
        {onSeeAllClick ? (
          <button
            type="button"
            onClick={onSeeAllClick}
            className="text-xs font-medium text-[#A9B1E0] hover:text-[#EEF0FF] cursor-pointer"
          >
            عرض الكل
          </button>
        ) : (
          <Link href={seeAllHref} className="text-xs font-medium text-[#A9B1E0] hover:text-[#EEF0FF]">
            عرض الكل
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[#22307A] bg-[#0B1440] px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          aria-label="الشهر السابق"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#A9B1E0] hover:bg-[#18266E] hover:text-[#EEF0FF] cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold text-[#EEF0FF] tabular-nums">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          aria-label="الشهر التالي"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#A9B1E0] hover:bg-[#18266E] hover:text-[#EEF0FF] cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] tabular-nums">
        {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((wd) => (
          <span key={wd} className="py-1 font-medium text-[#A9B1E0]">
            {wd}
          </span>
        ))}
        {cells.map((cell, idx) => {
          const hasEvent = cell.currentMonth && eventDaysMap.has(cell.day);
          const isSelected = cell.currentMonth && selectedDay === cell.day;
          return (
            <button
              key={idx}
              type="button"
              disabled={!cell.currentMonth}
              onClick={() => cell.currentMonth && setSelectedDay(cell.day)}
              className={`h-8 rounded-md text-xs font-medium transition-colors ${
                !cell.currentMonth
                  ? 'text-[#7D88BD] cursor-default'
                  : hasEvent || isSelected
                    ? 'bg-[#7C95FF] text-[#070D2B] font-semibold cursor-pointer'
                    : 'text-[#EEF0FF] hover:bg-[#18266E] cursor-pointer'
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {activeDayEvents.length > 0 && (
        <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-2.5 text-xs space-y-1">
          {activeDayEvents.slice(0, 2).map((ev) => (
            <div key={ev.id} className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#EEF0FF] truncate">{ev.titleAr}</span>
              {ev.cityAr && (
                <Badge tone="info" className="shrink-0 !text-[10px]">
                  {ev.cityAr}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-Segment Semi-Circular Activity Gauge Card
 * Mirrors "Today's Activity" with 3 color segments & centered bold metric.
 */
export function ActivityGaugeCard({
  title = 'النشاط اليومي وتوزيع المنصة',
  centerValue,
  segments,
}: {
  title?: string;
  centerValue: string;
  segments: Array<{ label: string; percent: number; color: string; dotClass: string }>;
}) {
  // Semi-circle path circumference (radius = 74, semi-circle length = PI * 74 ≈ 232.48)
  const r = 74;
  const semiLen = Math.PI * r;
  const totalWeight = Math.max(
    1,
    segments.reduce((s, seg) => s + Math.max(8, seg.percent), 0),
  );

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const segLen = (Math.max(8, seg.percent) / totalWeight) * (semiLen - 16);
    const dashOffset = -cumulative;
    cumulative += segLen + 8;
    return {
      ...seg,
      segLen,
      dashOffset,
    };
  });

  return (
    <div className="rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-[#EEF0FF]">{title}</h3>
        <MoreVertical className="h-4 w-4 text-[#A9B1E0]" />
      </div>

      <div className="relative flex flex-col items-center pt-1">
        <svg viewBox="0 0 200 112" className="w-48 h-auto overflow-visible" aria-label={title}>
          <path
            d="M 26 98 A 74 74 0 0 1 174 98"
            fill="none"
            stroke="#1C2864"
            strokeWidth="15"
            strokeLinecap="round"
          />
          {arcs.map((arc) => (
            <path
              key={arc.label}
              d="M 26 98 A 74 74 0 0 1 174 98"
              fill="none"
              stroke={arc.color}
              strokeWidth="15"
              strokeLinecap="round"
              strokeDasharray={`${arc.segLen.toFixed(1)} ${semiLen.toFixed(1)}`}
              strokeDashoffset={arc.dashOffset.toFixed(1)}
            />
          ))}
        </svg>
        <div className="absolute bottom-2 text-center">
          <p className="text-2xl font-extrabold text-[#EEF0FF] tabular-nums">{centerValue}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-[#22307A] pt-3 text-center">
        {segments.map((seg) => (
          <div key={seg.label} className="space-y-0.5 min-w-0">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#A9B1E0] font-bold">
              <span className={`h-2 w-2 rounded-full shrink-0 ${seg.dotClass}`} />
              <span className="truncate">{seg.label}</span>
            </div>
            <p className="text-xs font-extrabold text-[#EEF0FF] tabular-nums">{seg.percent}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Ranked Top Performers Card (White rank circles 1-3 + avatar initials + score)
 */
export function TopPerformersCard({
  title = 'أعلى البرامج والخبراء أداءً',
  items,
}: {
  title?: string;
  items: Array<{ id: string; name: string; subtitle: string; score: string }>;
}) {
  return (
    <div className="rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#EEF0FF]">{title}</h3>
        <Star className="h-4 w-4 text-[#A9B1E0]" strokeWidth={1.5} />
      </div>

      <div className="space-y-2.5">
        {items.length === 0 ? (
          <p className="text-xs text-[#A9B1E0]">ستظهر البيانات فور تسجيل التفاعلات.</p>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2.5 rounded-xl border border-[#22307A] bg-[#0B1440] p-2.5 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#22307A] bg-[#0F1A4A] text-[11px] font-medium text-[#A9B1E0] tabular-nums">
                  {idx + 1}
                </span>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#22307A] bg-[#18266E] text-xs font-semibold text-[#EEF0FF]">
                  {item.name.trim().slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-[#EEF0FF] truncate">{item.name}</p>
                  <p className="text-[11px] text-[#A9B1E0] truncate">{item.subtitle}</p>
                </div>
              </div>
              <span className="shrink-0 font-medium text-[#8CA2FF] tabular-nums">
                {item.score}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
