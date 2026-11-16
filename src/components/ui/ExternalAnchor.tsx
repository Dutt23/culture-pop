import type { ReactNode } from 'react';
import { safeHref } from './safeHref';

interface ExternalAnchorProps {
  href: string;
  className?: string;
  children: ReactNode;
}

/** A link to another site: https only, new tab, no referrer. Renders nothing for an unsafe URL. */
export function ExternalAnchor({ href, className, children }: ExternalAnchorProps) {
  const safe = safeHref(href);
  if (!safe) return null;
  return (
    <a
      className={className}
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
    >
      {children}
      <span className="sr-only"> (opens a new tab)</span>
    </a>
  );
}
