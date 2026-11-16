import { formatDate } from '../../domain/dates';
import type { Source } from '../../domain/types';
import { ExternalAnchor } from '../ui/ExternalAnchor';
import { safeHref } from '../ui/safeHref';
import styles from './SourceList.module.css';

interface SourceListProps {
  sources: readonly Source[];
}

/** Citations with the attribution each licence asks for: link, publisher and licence. */
export function SourceList({ sources }: SourceListProps) {
  return (
    <ol className={styles.list}>
      {sources.map((source) => {
        const retrieved = formatDate(source.retrievedAt);
        return (
          <li key={source.id} className={styles.item}>
            {source.excerpt && <blockquote className={styles.excerpt}>{source.excerpt}</blockquote>}
            <p className={styles.citation}>
              {/* An unsafe URL keeps the citation as plain text. */}
              {safeHref(source.url) ? (
                <ExternalAnchor href={source.url}>
                  {source.publisher}: {source.title}
                </ExternalAnchor>
              ) : (
                `${source.publisher}: ${source.title}`
              )}
            </p>
            <p className={styles.meta}>
              {retrieved && `Retrieved ${retrieved} · `}
              {source.license}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
