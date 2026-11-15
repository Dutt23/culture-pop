import { externalSearchLinks } from '../../domain/externalSearch';
import { ExternalLinks } from './ExternalLinks';
import styles from './ExternalSearchLinks.module.css';

interface ExternalSearchLinksProps {
  query: string;
  isOnline: boolean;
}

/** Grouped search links; only opens on an explicit tap, and nothing is sent until then. */
export function ExternalSearchLinks({ query, isOnline }: ExternalSearchLinksProps) {
  return (
    <div className={styles.wrapper}>
      {externalSearchLinks(query).map((group) => (
        <div key={group.label} className={styles.group}>
          <p className={styles.groupLabel}>{group.label}</p>
          <ExternalLinks
            accessiblePrefix="Search "
            links={group.links.map((link) => ({ label: link.site, href: link.href }))}
          />
        </div>
      ))}
      <p className={styles.note}>
        {isOnline
          ? 'Opens outside the app. Your search text is sent to that site only when you tap.'
          : "You're offline — these links need a connection."}
      </p>
    </div>
  );
}
