import { AnimatePresence, m } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { SearchBar } from '../../components/search-bar/SearchBar';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import {
  filterByCategory,
  groupByEra,
  seededShuffle,
  type CategoryFilter,
} from '../../domain/discovery';
import { CATEGORIES, CATEGORY_PLURAL_LABEL, ERA_LABEL } from '../../domain/labels';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { useRecordSearch, useRegulars } from '../search/useSearchHistory';
import styles from './DiscoverPage.module.css';
import { useDiscovery } from './useDiscovery';

const REGULARS = 12;

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const data = useDiscovery();
  const regulars = useRegulars(REGULARS);
  const recordSearch = useRecordSearch();
  const { reveal } = useMotionPresets();
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  // Decorative randomness only: it changes which card is shown, never where controls are.
  const [seed] = useState(randomSeed);
  const [surpriseIndex, setSurpriseIndex] = useState(0);

  const deck = useMemo(() => seededShuffle(data?.references ?? [], seed), [data, seed]);
  const surprise = deck.length > 0 ? deck[surpriseIndex % deck.length] : undefined;
  const eras = useMemo(
    () => groupByEra(filterByCategory(data?.references ?? [], category)),
    [data, category],
  );

  return (
    <Page
      title="Decode any reference"
      eyebrow="Pop Culture Decoder"
      intro="Quotes, memes, shows and sayings — explained in plain language, spoiler-free."
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

      <Section
        title="Surprise me"
        description="A random pick from this app's library — not a trend."
      >
        <div className={styles.surprise}>
          <div className={styles.stage}>
            <AnimatePresence mode="popLayout" initial={false}>
              {surprise && (
                <m.div
                  key={surprise.id}
                  className={styles.stageCard}
                  variants={reveal}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <ReferenceCard
                    reference={surprise}
                    variant="feature"
                    teaser={data?.summaries.get(surprise.id)?.teaser}
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
      </Section>

      <Section title="Browse by era">
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
          <EmptyState title="Nothing here yet">
            <p>No references in this category so far. Try another one.</p>
          </EmptyState>
        )}

        {eras.map(({ era, references }) => (
          <Section key={era} title={ERA_LABEL[era]}>
            <ul className={styles.row}>
              {references.map((reference, index) => (
                <AnimatedItem key={reference.id} index={index} className={styles.rowItem}>
                  <ReferenceCard
                    reference={reference}
                    teaser={data?.summaries.get(reference.id)?.teaser}
                  />
                </AnimatedItem>
              ))}
            </ul>
          </Section>
        ))}
      </Section>
    </Page>
  );
}
