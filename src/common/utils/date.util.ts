/**
 * Date and Time Utilities for UTC enforcement.
 */

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
