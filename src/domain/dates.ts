// en-GB, like the rest of the copy: "15 Nov 2026".
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

/** "15 Nov 2026", or undefined when the date is invalid (stored rows may be tampered or legacy). */
export function formatDate(iso: string): string | undefined {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : DATE_FORMAT.format(date);
}
