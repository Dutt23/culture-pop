import { useId, useState, type FormEvent } from 'react';
import { LIMITS } from '../../../shared/cardTypes.js';
import { safeHref } from '../../components/ui/safeHref';
import styles from './UserAdditions.module.css';

export interface UserLink {
  url: string;
  title: string;
}

interface UserAdditionsProps {
  context: string;
  onContextChange: (context: string) => void;
  links: readonly UserLink[];
  onAddLink: (link: UserLink) => void;
  onRemoveLink: (url: string) => void;
}

export function UserAdditions({
  context,
  onContextChange,
  links,
  onAddLink,
  onRemoveLink,
}: UserAdditionsProps) {
  const id = useId();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const add = (event: FormEvent) => {
    event.preventDefault();
    const href = safeHref(url.trim());
    if (!href) {
      setError('Enter an HTTPS link without a username or password.');
      return;
    }
    if (links.some((link) => safeHref(link.url) === href)) {
      setError('You already added this link.');
      return;
    }
    if (links.length >= LIMITS.webSources) {
      setError(`You can add up to ${LIMITS.webSources} links. Remove one to add another.`);
      return;
    }
    onAddLink({ url: href, title: title.trim() || href });
    setUrl('');
    setTitle('');
    setError('');
  };

  return (
    <section className={styles.additions} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>Add your own material</h3>
      <p className={styles.note}>Added by you · context has not been verified</p>
      <label htmlFor={`${id}-context`}>Your context or text</label>
      <textarea
        id={`${id}-context`}
        className={styles.input}
        maxLength={LIMITS.itemChars}
        value={context}
        onChange={(event) => onContextChange(event.target.value)}
      />
      <form onSubmit={add} className={styles.form}>
        <label htmlFor={`${id}-url`}>Your source link</label>
        <input
          id={`${id}-url`}
          className={styles.input}
          type="url"
          maxLength={2048}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          required
        />
        <label htmlFor={`${id}-title`}>Link title (optional)</label>
        <input
          id={`${id}-title`}
          className={styles.input}
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit" className={styles.button}>
          Add link
        </button>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </form>
      {links.length > 0 && (
        <ul className={styles.links} aria-label="Links added by you">
          {links.map((link) => (
            <li key={link.url}>
              <span className={styles.linkText}>{link.title}</span>
              <button
                type="button"
                className={styles.button}
                onClick={() => onRemoveLink(link.url)}
                aria-label={`Remove ${link.title}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
