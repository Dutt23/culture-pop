import { AnimatePresence, m, type Variants } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { MascotDen } from '../../components/mascot/MascotDen';
import {
  ReferenceCard,
  type ReferenceCardFavourite,
} from '../../components/reference-card/ReferenceCard';
import { SearchBar } from '../../components/search-bar/SearchBar';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { savedOn } from '../../domain/dates';
import {
  emptyCategories,
  filterByCategory,
  groupByCategory,
  groupByEra,
  seededShuffle,
  surprisePool,
  type BrowsableCategory,
} from '../../domain/discovery';
import {
  CATEGORIES,
  CATEGORY_PLURAL_LABEL,
  emptyCategoryNote,
  ERA_LABEL,
  SEARCH_HINT,
  surpriseNote,
} from '../../domain/labels';
import type { CardSummary } from '../../domain/summaries';
import { isFromOnline, type Reference } from '../../domain/types';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { useFavourites } from '../favourites/useFavourites';
import { useRecordSearch, useRegulars } from '../search/useSearchHistory';
import styles from './DiscoverPage.module.css';
import { useDiscovery } from './useDiscovery';

const REGULARS = 12;

const OFFLINE_HINT =
  "You're offline. Browse what's on this device, or search when you're back online.";

type BrowseView = 'era' | 'type';

const BROWSE_OPTIONS: readonly SegmentedOption<BrowseView>[] = [
  { value: 'era', label: 'By era' },
  { value: 'type', label: 'By type' },
];

/**
 * "Show another" turns the card over: the old one turns to its edge while the new one, already in
 * place but edge-on, turns in once the old is out of sight.
 */
const FLIP_TURN_S = 0.24;
const FLIP: Variants = {
  hidden: { rotateY: -90 },
  visible: {
    rotateY: 0,
    transition: { duration: FLIP_TURN_S, delay: FLIP_TURN_S, ease: [0.2, 0.8, 0.2, 1] },
  },
  exit: { rotateY: 90, transition: { duration: FLIP_TURN_S, ease: [0.5, 0, 0.75, 0] } },
};

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** Online references are marked as such, with when they were saved, like on the search page. */
function foundOnlineNote(reference: Reference): string | undefined {
  if (!isFromOnline(reference.editorialState)) return undefined;
  const saved = savedOn(reference.updatedAt);
  return saved ? `Found online · ${saved}` : 'Found online';
}

interface ShelfProps {
  references: readonly Reference[];
  summaries?: Map<string, CardSummary>;
  favouriteOf: (referenceId: string) => ReferenceCardFavourite;
}

function Shelf({ references, summaries, favouriteOf }: ShelfProps) {
  return (
    <ul className={styles.row}>
      {references.map((reference, index) => (
        <AnimatedItem key={reference.id} index={index} className={styles.rowItem}>
          <ReferenceCard
            reference={reference}
            teaser={summaries?.get(reference.id)?.teaser}
            matchNote={foundOnlineNote(reference)}
            favourite={favouriteOf(reference.id)}
          />
        </AnimatedItem>
      ))}
    </ul>
  );
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const data = useDiscovery();
  const regulars = useRegulars(REGULARS);
  const recordSearch = useRecordSearch();
  const { reveal, reduced } = useMotionPresets();
  const [draft, setDraft] = useState('');
  const isOnline = useOnlineStatus();
  const favourites = useFavourites();
  const favouriteOf = (referenceId: string) => ({
    isFavourite: favourites.ids.has(referenceId),
    onToggle: () => void favourites.toggle(referenceId),
  });
  const [view, setView] = useState<BrowseView>('era');
  const [category, setCategory] = useState<BrowsableCategory | 'all'>('all');
  // Decorative randomness only: it changes which card is shown, never where controls are.
  const [seed] = useState(randomSeed);
  const [surpriseIndex, setSurpriseIndex] = useState(0);

  const { pool, fellBack } = useMemo(
    () => surprisePool(data?.references ?? [], category),
    [data, category],
  );
  const deck = useMemo(() => seededShuffle(pool, seed), [pool, seed]);
  const surprise = deck.length > 0 ? deck[surpriseIndex % deck.length] : undefined;
  const eras = useMemo(
    () => groupByEra(filterByCategory(data?.references ?? [], category)),
    [data, category],
  );
  const types = useMemo(() => groupByCategory(data?.references ?? []), [data]);
  const emptyTypes = useMemo(() => emptyCategories(data?.references ?? []), [data]);

  return (
    <Page
      title="Decode any reference"
      eyebrow="Pop Culture Decoder"
      intro="Quotes, memes, shows and sayings — explained in plain language, spoiler-free."
      wide
      scene={<MascotDen still={reduced} />}
    >
      <SearchBar
        value={draft}
        onChange={setDraft}
        onSubmit={(value) => {
          if (!value.trim()) return;
          recordSearch(value);
          navigate(`/search?q=${encodeURIComponent(value.trim())}`);
        }}
      />

      {regulars.length > 0 && (
        <Section
          title="Your regulars"
          description="Searches you keep coming back to, kept on this device."
        >
          <div className={styles.filters}>
            {regulars.map((entry) => (
              <Chip key={entry.id} to={`/search?q=${encodeURIComponent(entry.label)}`}>
                {entry.label}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      <Section title="Surprise me" description={surpriseNote(pool, category, fellBack)}>
        <div className={styles.surprise}>
          <div className={styles.stage}>
            <AnimatePresence mode="popLayout" initial={false}>
              {surprise && (
                <m.div
                  key={surprise.id}
                  className={styles.stageCard}
                  variants={reduced ? reveal : FLIP}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <ReferenceCard
                    reference={surprise}
                    variant="feature"
                    teaser={data?.summaries.get(surprise.id)?.teaser}
                    matchNote={foundOnlineNote(surprise)}
                    favourite={favouriteOf(surprise.id)}
                  />
                </m.div>
              )}
            </AnimatePresence>
          </div>
          <button
            type="button"
            className={styles.shuffle}
            onClick={() => setSurpriseIndex((index) => index + 1)}
          >
            Show another
          </button>
        </div>
        {favourites.error && (
          <p className={styles.error} role="alert">
            {favourites.error}
          </p>
        )}
      </Section>

      <Section title="Browse">
        <SegmentedControl
          legend="Browse by"
          name="discover-browse"
          options={BROWSE_OPTIONS}
          value={view}
          onChange={(next) => {
            setView(next);
            // The chips are hidden in the type view: reset them so the surprise follows what shows.
            if (next === 'type') setCategory('all');
          }}
        />

        {view === 'era' && (
          <>
            <div className={styles.filters} role="group" aria-label="Filter by category">
              <Chip selected={category === 'all'} onClick={() => setCategory('all')}>
                All
              </Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
                  {CATEGORY_PLURAL_LABEL[c]}
                </Chip>
              ))}
            </div>

            {data && eras.length === 0 && (
              <EmptyState
                title={
                  category === 'all'
                    ? 'Nothing here yet'
                    : `Nothing in ${CATEGORY_PLURAL_LABEL[category]} yet`
                }
              >
                <p>
                  {!isOnline
                    ? OFFLINE_HINT
                    : category === 'all'
                      ? 'Search for a reference to find one.'
                      : SEARCH_HINT[category]}
                </p>
              </EmptyState>
            )}

            {eras.map(({ era, references }) => (
              <Section key={era} title={ERA_LABEL[era]}>
                <Shelf
                  references={references}
                  summaries={data?.summaries}
                  favouriteOf={favouriteOf}
                />
              </Section>
            ))}
          </>
        )}

        {view === 'type' && (
          <>
            {types.map(({ category: c, references }) => (
              <Section key={c} title={`${CATEGORY_PLURAL_LABEL[c]} · ${references.length}`}>
                <Shelf
                  references={references}
                  summaries={data?.summaries}
                  favouriteOf={favouriteOf}
                />
              </Section>
            ))}

            {data && emptyTypes.length > 0 && !isOnline && (
              <p className={styles.note}>{OFFLINE_HINT}</p>
            )}
            {data &&
              isOnline &&
              emptyTypes.map((c) => (
                <p key={c} className={styles.note}>
                  {emptyCategoryNote(c)}
                </p>
              ))}
          </>
        )}
      </Section>
    </Page>
  );
}
