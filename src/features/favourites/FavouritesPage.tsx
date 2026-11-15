import { Link } from 'react-router';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { Page } from '../../components/ui/Page';
import styles from './FavouritesPage.module.css';
import { useFavouriteReferences } from './useFavourites';

export function FavouritesPage() {
  const references = useFavouriteReferences();

  return (
    <Page title="Favourites" intro="Saved on this device only.">
      {references && references.length === 0 && (
        <EmptyState title="No favourites yet">
          <p>Tap “Favourite” on any reference to keep it here.</p>
          <Link to="/discover">Start exploring</Link>
        </EmptyState>
      )}
      {references && references.length > 0 && (
        <ul className={styles.list}>
          {references.map((reference, index) => (
            <AnimatedItem key={reference.id} index={index}>
              <ReferenceCard reference={reference} />
            </AnimatedItem>
          ))}
        </ul>
      )}
    </Page>
  );
}
