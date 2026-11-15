import { externalSearchLinks } from '../../domain/externalSearch';
import styles from './ExternalSearchLinks.module.css';

interface ExternalSearchLinksProps {
  query: string;
  isOnline: boolean;
}

/** Only opens on an explicit tap; nothing is sent until then. */
export function ExternalSearchLinks({ query, isOnline }: ExternalSearchLinksProps) {
  return (
    <div className={styles.wrapper}>
      <ul className={styles.links}>
        {externalSearchLinks(query).map((link) => (
          <li key={link.label}>
            <a className={styles.link} href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
              <span className={styles.srOnly}> (opens a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        {isOnline
          ? 'Opens outside the app. Your search text is sent to that site only when you tap.'
          : "You're offline — these links need a connection."}
      </p>
    </div>
  );
}
