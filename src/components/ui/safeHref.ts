/**
 * Last check before a link reaches the DOM: only absolute https URLs render. Stored data is
 * validated when it's saved too, but this keeps a tampered or legacy record from ever producing a
 * `javascript:`, `data:` or plain-http link.
 */
export function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
