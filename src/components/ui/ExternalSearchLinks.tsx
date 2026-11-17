import { externalSearchLinks } from '../../domain/externalSearch';
import { ExternalLinks } from './ExternalLinks';
import styles from './ExternalSearchLinks.module.css';

/** The group "Where people talk about it" already shows, when that card is on the page. */
const COMMUNITY_GROUP = 'Memes and slang';

interface ExternalSearchLinksProps {
  query: string;
  isOnline: boolean;
  /** The community card above already offers the meme and slang sites. */
  skipCommunity?: boolean;
}

/** Grouped search links; only opens on an explicit tap, and nothing is sent until then. */
export function ExternalSearchLinks({ query, isOnline, skipCommunity }: ExternalSearchLinksProps) {
  // Offline, links that can't open would only look tappable.
  if (!isOnline) {
    return <p className={styles.note}>Search links to other sites need a connection.</p>;
  }
  const groups = externalSearchLinks(query).filter(
    (group) => !(skipCommunity && group.label === COMMUNITY_GROUP),
  );
  return (
    <div className={styles.wrapper}>
      {groups.map((group) => (
        <div key={group.label} className={styles.group}>
          <p className={styles.groupLabel}>{group.label}</p>
          <ExternalLinks
            accessiblePrefix="Search "
            links={group.links.map((link) => ({ label: link.site, href: link.href }))}
          />
        </div>
      ))}
      <p className={styles.note}>
        Opens outside the app. Your search text is sent to that site only when you tap.
      </p>
    </div>
  );
}
