import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { FavouriteButton } from '../../components/favourite-button/FavouriteButton';
import { InterpretationCard } from '../../components/interpretation-card/InterpretationCard';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { SearchBar } from '../../components/search-bar/SearchBar';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExternalSearchLinks } from '../../components/ui/ExternalSearchLinks';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { buildSeed } from '../../data/seed';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import styles from './DevComponentsPage.module.css';

const SAMPLE = buildSeed();
const STAGGER_DEMO = ['one', 'two', 'three', 'four'] as const;

/** Development-only gallery of every component variant and motion preset. */
export default function DevComponentsPage() {
  const { reveal, expand } = useMotionPresets();
  const [query, setQuery] = useState('hakuna matata');
  const [favourite, setFavourite] = useState(false);
  const [chip, setChip] = useState(true);
  const [segment, setSegment] = useState<'a' | 'b'>('a');
  const [replay, setReplay] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [present, setPresent] = useState(true);

  const spoilerInterpretation = SAMPLE.interpretations.find((i) => i.spoiler === 'major');
  const plainInterpretation = SAMPLE.interpretations[0];

  return (
    <Page title="Component gallery" eyebrow="Development only">
      <Section title="ReferenceCard — compact / feature">
        <div className={styles.stack}>
          <ReferenceCard
            reference={SAMPLE.references[0]}
            teaser={plainInterpretation.summary}
            meaningsCount={1}
          />
          <ReferenceCard reference={SAMPLE.references[2]} variant="feature" teaser="Feature variant" />
        </div>
      </Section>

      <Section title="InterpretationCard — plain / spoiler">
        <div className={styles.stack}>
          <InterpretationCard interpretation={plainInterpretation} index={0} revealSpoilers={false} />
          {spoilerInterpretation && (
            <InterpretationCard
              interpretation={spoilerInterpretation}
              index={1}
              revealSpoilers={false}
            />
          )}
        </div>
      </Section>

      <Section title="SearchBar">
        <SearchBar value={query} onChange={setQuery} />
      </Section>

      <Section title="FavouriteButton, Chip, SegmentedControl">
        <div className={styles.row}>
          <FavouriteButton isFavourite={favourite} onToggle={() => setFavourite((v) => !v)} />
          <Chip selected={chip} onClick={() => setChip((v) => !v)}>
            Toggle chip
          </Chip>
          <Chip to="/search?q=bazinga">Link chip</Chip>
        </div>
        <SegmentedControl
          legend="Segmented"
          name="dev-segment"
          options={[
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Section>

      <Section title="EmptyState & ExternalSearchLinks">
        <EmptyState title="Nothing here yet">
          <ExternalSearchLinks query={query} isOnline />
        </EmptyState>
      </Section>

      <Section
        title="Motion presets"
        description="Switch Motion in Settings to compare the reduced variants."
      >
        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={() => setReplay((n) => n + 1)}>
            Replay enter + stagger
          </button>
          <button type="button" className={styles.button} onClick={() => setPresent((v) => !v)}>
            Toggle exit
          </button>
          <button type="button" className={styles.button} onClick={() => setExpanded((v) => !v)}>
            Toggle expand
          </button>
        </div>
        <ul key={replay} className={styles.row}>
          {STAGGER_DEMO.map((label, index) => (
            <AnimatedItem key={label} index={index} className={styles.swatch}>
              {label}
            </AnimatedItem>
          ))}
        </ul>
        <AnimatePresence>
          {present && (
            <motion.p
              key="exit-demo"
              className={styles.swatch}
              variants={reveal}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              Enter / exit
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div key="expand-demo" className={styles.clip} {...expand}>
              <p className={styles.swatch}>Expanded content</p>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>
    </Page>
  );
}
