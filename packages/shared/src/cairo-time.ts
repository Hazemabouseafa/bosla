/**
 * Africa/Cairo timezone and Daylight Saving Time (DST) safe business date utilities.
 * Stored timestamps remain UTC; hold periods and month-end cutoffs follow Africa/Cairo wall-clock rules.
 */

export const CAIRO_TIMEZONE = 'Africa/Cairo';

export interface CairoWallClockParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  millisecond: number;
}

const cairoFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function getCairoWallClockParts(utcDate: Date): CairoWallClockParts {
  const parts = cairoFormatter.formatToParts(utcDate);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = Number(p.value);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
    millisecond: utcDate.getUTCMilliseconds(),
  };
}

/**
 * Resolves a Cairo wall-clock tuple (year, month 1..12, day, hour, minute, second, ms)
 * back into its exact UTC instant, preserving local wall-clock time across DST transitions.
 */
export function cairoWallClockToUtc(parts: CairoWallClockParts): Date {
  // Initial guess in UTC assuming standard +02:00 offset
  const targetLocalUtcEquivalent = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );

  // Iterate 3 times using measured Cairo offset at candidate UTC instant to converge exactly even on DST boundary days
  let candidate = targetLocalUtcEquivalent - 2 * 3600_000;
  for (let i = 0; i < 3; i++) {
    const actualParts = getCairoWallClockParts(new Date(candidate));
    const actualLocalUtcEquivalent = Date.UTC(
      actualParts.year,
      actualParts.month - 1,
      actualParts.day,
      actualParts.hour,
      actualParts.minute,
      actualParts.second,
      actualParts.millisecond,
    );
    const diffMs = targetLocalUtcEquivalent - actualLocalUtcEquivalent;
    if (diffMs === 0) break;
    candidate += diffMs;
  }
  return new Date(candidate);
}

/**
 * Adds exact calendar days in Africa/Cairo timezone while keeping the SAME wall-clock hour/minute/second
 * (handles Egypt spring-forward +1h and fall-back -1h DST shifts accurately, AT-082).
 */
export function addCairoCalendarDays(utcDate: Date, calendarDays: number): Date {
  const local = getCairoWallClockParts(utcDate);
  const shiftedCalendar = new Date(Date.UTC(local.year, local.month - 1, local.day + calendarDays));
  return cairoWallClockToUtc({
    year: shiftedCalendar.getUTCFullYear(),
    month: shiftedCalendar.getUTCMonth() + 1,
    day: shiftedCalendar.getUTCDate(),
    hour: local.hour,
    minute: local.minute,
    second: local.second,
    millisecond: local.millisecond,
  });
}

/**
 * Computes exact UTC start (00:00:00.000) and end (23:59:59.999) of a given calendar month
 * in Africa/Cairo timezone (AT-083).
 */
export function getCairoMonthBoundsUtc(year: number, month: number): {
  startUtc: Date;
  endUtc: Date;
} {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startUtc = cairoWallClockToUtc({
    year,
    month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const endUtc = cairoWallClockToUtc({
    year,
    month,
    day: lastDay,
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
  });
  return { startUtc, endUtc };
}
