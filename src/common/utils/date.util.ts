/**
 * Date and Time Utilities for UTC enforcement and Local Timezone Conversion.
 */

export interface FormattedDateResponse {
  utc: string;
  local: string;
  timezone: string;
}

/**
 * Returns a JS Date object representing the current moment in UTC.
 */
export function getUtcDate(): Date {
  return new Date();
}

/**
 * Formats a given date into an ISO 8601 UTC string (e.g. 2026-07-19T18:13:48.000Z).
 */
export function toUtcIsoString(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Converts a date or timestamp string to a UTC Date object.
 */
export function parseAsUtcDate(input: string | number | Date): Date {
  return new Date(input);
}

/**
 * Formats a UTC Date into both UTC ISO format and Local Timezone format.
 *
 * @param date The Date instance or date string to format
 * @param targetTimezone The target IANA timezone (defaults to 'Asia/Kolkata')
 * @returns Formatted object containing utc, local formatted string, and timezone name
 */
export function formatDateResponse(
  date: Date | string | null | undefined,
  targetTimezone = 'Asia/Kolkata',
): FormattedDateResponse | null {
  if (!date) {
    return null;
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return null;
  }

  const validTimezone = targetTimezone || 'Asia/Kolkata';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: validTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const localFormatted = `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`;

    return {
      utc: d.toISOString(),
      local: localFormatted,
      timezone: validTimezone,
    };
  } catch {
    return {
      utc: d.toISOString(),
      local: d.toISOString(),
      timezone: 'UTC',
    };
  }
}
