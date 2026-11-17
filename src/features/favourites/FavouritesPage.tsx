import { Link } from 'react-router';
import { FavouriteButton } from '../../components/favourite-button/FavouriteButton';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExternalAnchor } from '../../components/ui/ExternalAnchor';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { hostOf } from '../../components/ui/safeHref';
import styles from './FavouritesPage.module.css';
import { useFavourites, useFavouriteReferences } from './useFavourites';
import { useSavedLinks } from './useSavedLinks';

export function FavouritesPage() {
  const references = useFavouriteReferences();
  const favourites = useFavourites();
  const savedLinks = useSavedLinks();
  const links = savedLinks.links;
  const hasReferences = references !== undefined && references.length > 0;
  const hasLinks = links !== undefined && links.length > 0;

  return (
    <Page title="Favourites" intro="Saved on this device only." wide>
      {references && links && references.length === 0 && links.length === 0 && (
        <EmptyState title="No favourites yet">
          <p>Tap “Favourite” on any reference to keep it here. You can save web links too.</p>
          <Link to="/discover">Start exploring</Link>
        </EmptyState>
      )}
      {favourites.error && (
        <p className={styles.error} role="alert">
          {favourites.error}
        </p>
      )}
      {hasReferences && (
        <ul className={styles.list}>
          {references.map((reference, index) => (
            <AnimatedItem key={reference.id} index={index}>
              <ReferenceCard
                reference={reference}
                favourite={{
                  isFavourite: favourites.ids.has(reference.id),
                  onToggle: () => void favourites.toggle(reference.id),
                }}
              />
            </AnimatedItem>
          ))}
        </ul>
      )}
      {hasLinks && (
        <Section title="Saved web links">
          {savedLinks.error && (
            <p className={styles.error} role="alert">
              {savedLinks.error}
            </p>
          )}
          <ul className={styles.list}>
            {links.map((link) => (
              <li key={link.url} className={styles.link}>
                <div className={styles.linkText}>
                  <ExternalAnchor href={link.url} className={styles.linkTitle}>
                    {link.title}
                  </ExternalAnchor>
                  <span className={styles.linkMeta}>{hostOf(link.url)} · Web link, unverified</span>
                </div>
                <FavouriteButton
                  iconOnly
                  label={`Save link ${link.title}`}
                  isFavourite
                  onToggle={() => void savedLinks.toggle(link)}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
