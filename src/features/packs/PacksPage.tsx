import { useId, useMemo, useState } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { Tour } from '../../components/tour/Tour';
import { useTour } from '../../components/tour/useTour';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { CEILING_HINT } from '../../domain/labels';
import { groupHits, searchPacks } from '../../domain/packs';
import type { PackCeiling } from '../../domain/types';
import { useSearchQuery } from '../search/useSearchQuery';
import { PackHits } from './PackHits';
import { PACKS_TOUR } from './packTours';
import { PackRow } from './PackRow';
import styles from './Packs.module.css';
import { PackSearchField } from './PackSearchField';
import { CARDS_PER_GROUP, CEILING_OPTIONS, useAttempt, usePackData } from './usePacks';

export function PacksPage() {
  const data = usePackData();
  const [query, setQuery] = useSearchQuery();
  const groups = useMemo(
    () => (data ? groupHits(searchPacks(query, { kind: 'all' }, data.index)) : []),
    [data, query],
  );
  const searching = query.trim() !== '';
  const tour = useTour('packs', data !== undefined);

  return (
    <Page title="Packs" intro="Folders of cards you file yourself. Saved on this device only." wide>
      <NewPackForm />
      <div data-tour="pack-search">
        <PackSearchField label="Search all packs" value={query} onChange={setQuery} />
      </div>
      {data && searching && groups.length === 0 && <EmptyState title="Nothing in your packs." />}
      {data && searching && groups.length > 0 && (
        <PackHits
          groups={groups}
          packsByReference={data.packsByReference}
          query={query}
          limit={CARDS_PER_GROUP}
        />
      )}
      {data && !searching && data.index.packs.length === 0 && (
        <EmptyState title="No packs yet">
          <p>Name a pack above, then file cards into it from any reference.</p>
        </EmptyState>
      )}
      {data && !searching && data.index.packs.length > 0 && (
        <ul className={styles.list}>
          {data.index.packs.map((pack) => (
            <PackRow key={pack.id} pack={pack} count={data.counts.get(pack.id) ?? 0} />
          ))}
        </ul>
      )}
      {tour.open && <Tour steps={PACKS_TOUR} onClose={tour.close} />}
    </Page>
  );
}

function NewPackForm() {
  const { packs } = useRepositories();
  const { error, attempt } = useAttempt();
  const [name, setName] = useState('');
  const [ceiling, setCeiling] = useState<PackCeiling>('before_watching');
  const nameId = useId();

  return (
    <Section title="New pack">
      <form
        className={styles.form}
        data-tour="new-pack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void attempt(() => packs.create({ name, ceiling })).then((created) => {
            if (created) setName('');
          });
        }}
      >
        <label htmlFor={nameId} className={styles.label}>
          Pack name
        </label>
        <input
          id={nameId}
          className={styles.textInput}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Before the movie"
          autoComplete="off"
          required
        />
        <div data-tour="pack-spoilers">
          <SegmentedControl
            legend="Spoilers"
            name="new-pack-ceiling"
            options={CEILING_OPTIONS}
            value={ceiling}
            onChange={setCeiling}
          />
          <p className={styles.muted}>{CEILING_HINT[ceiling]}</p>
        </div>
        <button type="submit" className={styles.primary}>
          Create pack
        </button>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Section>
  );
}
