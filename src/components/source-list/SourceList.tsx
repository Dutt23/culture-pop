import type { Source } from '../../domain/types';
import { safeHref } from '../ui/safeHref';
import styles from './SourceList.module.css';

interface SourceListProps {
  sources: readonly Source[];
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** Citations with the attribution each licence asks for: link, publisher and licence. */
export function SourceList({ sources }: SourceListProps) {
  return (
    <ol className={styles.list}>
      {sources.map((source) => (
        <li key={source.id} className={styles.item}>
          {source.excerpt && <blockquote className={styles.excerpt}>{source.excerpt}</blockquote>}
          <p className={styles.citation}>
            {safeHref(source.url) ? (
              <a
                href={safeHref(source.url)}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                {source.publisher}: {source.title}
                <span className={styles.srOnly}> (opens a new tab)</span>
              </a>
            ) : (
              `${source.publisher}: ${source.title}`
            )}
          </p>
          <p className={styles.meta}>
            Retrieved {DATE_FORMAT.format(new Date(source.retrievedAt))} · {source.license}
          </p>
        </li>
      ))}
    </ol>
  );
}
