import { ExternalAnchor } from './ExternalAnchor';
import styles from './ExternalLinks.module.css';
import { safeHref } from './safeHref';

export interface ExternalLinkItem {
  label: string;
  href: string;
}

interface ExternalLinksProps {
  links: readonly ExternalLinkItem[];
  /** Read before the visible label by screen readers, e.g. "Search ". */
  accessiblePrefix?: string;
}

/** Tap-only links to other sites, each opening in a new tab without sending a referrer. */
export function ExternalLinks({ links, accessiblePrefix }: ExternalLinksProps) {
  const safe = links.flatMap((link) => {
    const href = safeHref(link.href);
    return href ? [{ ...link, href }] : [];
  });
  return (
    <ul className={styles.links}>
      {safe.map((link) => (
        <li key={link.href}>
          <ExternalAnchor className={styles.link} href={link.href}>
            {accessiblePrefix && <span className="sr-only">{accessiblePrefix}</span>}
            {link.label}
          </ExternalAnchor>
        </li>
      ))}
    </ul>
  );
}
