import { useId, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useRepositories } from '../../app/RepositoriesContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { CEILING_LABEL } from '../../domain/labels';
import { groupHits, searchPacks, type PackSearchScope } from '../../domain/packs';
import type { Pack } from '../../domain/types';
import { useSearch } from '../search/useSearch';
import { useSearchQuery } from '../search/useSearchQuery';
import { PackDoneList } from './PackDoneList';
import { PackHits } from './PackHits';
import { PackMemberItem } from './PackMemberItem';
import { PackRow } from './PackRow';
import styles from './Packs.module.css';
import { PackSearchField } from './PackSearchField';
import {
  acceptsCard,
  CARDS_PER_GROUP,
  cardCount,
  CEILING_OPTIONS,
  REFERENCE_DRAG_TYPE,
  useAttempt,
  useFinePointer,
  usePack,
  usePackData,
  usePackMembers,
} from './usePacks';

type Scope = 'pack' | 'all';

const SCOPE_OPTIONS: readonly SegmentedOption<Scope>[] = [
  { value: 'pack', label: 'This pack' },
  { value: 'all', label: 'All packs' },
];

// shortcut: the first few library matches only; add paging if readers file from long result lists.
const LIBRARY_RESULTS = 5;

/** Keyed on the pack, so every pack opens fresh on "This pack" even when one links to another. */
export function PackPage() {
  const { packId = '' } = useParams();
  return <PackView key={packId} packId={packId} />;
}

function PackView({ packId }: { packId: string }) {
  const pack = usePack(packId);
  const cards = usePackMembers(packId);
  const data = usePackData();
  const { packs } = useRepositories();
  const [query, setQuery] = useSearchQuery();
  const [scope, setScope] = useState<Scope>('pack');
  const finePointer = useFinePointer();
  const { error, attempt } = useAttempt();
  const groups = useMemo(() => {
    if (!data) return [];
    const where: PackSearchScope = scope === 'pack' ? { kind: 'pack', packId } : { kind: 'all' };
    return groupHits(searchPacks(query, where, data.index));
  }, [data, query, scope, packId]);

  if (pack === undefined || cards === undefined) {
    return (
      <p className={styles.muted} role="status">
        Loading…
      </p>
    );
  }

  if (pack === null) {
    return (
      <Page title="Pack not found">
        <EmptyState title="This pack isn't on this device">
          <Link to="/packs">See your packs</Link>
        </EmptyState>
      </Page>
    );
  }

  const searching = query.trim() !== '';
  const members = cards.active;
  const eyebrow = [cardCount(members.length), CEILING_LABEL[pack.ceiling], pack.now && 'Now']
    .filter(Boolean)
    .join(' · ');
  const otherPacks = (data?.index.packs ?? []).filter((other) => other.id !== pack.id);

  return (
    <Page title={pack.name} eyebrow={eyebrow}>
      <div className={styles.stack}>
        <SegmentedControl
          legend="Search in"
          name="pack-scope"
          options={SCOPE_OPTIONS}
          value={scope}
          onChange={setScope}
        />
        <PackSearchField
          label={scope === 'pack' ? 'Search this pack' : 'Search all packs'}
          value={query}
          onChange={setQuery}
        />
        {/* Online lookup happens on the Search page only, never from here. */}
        {searching && (
          <Link to={`/search?q=${encodeURIComponent(query)}`} className={styles.more}>
            Look up
          </Link>
        )}
      </div>

      {searching && data && groups.length === 0 && (
        <EmptyState title={scope === 'pack' ? 'Nothing in this pack.' : 'Nothing in your packs.'} />
      )}
      {searching && data && groups.length > 0 && (
        <PackHits
          groups={groups}
          packsByReference={data.packsByReference}
          query={query}
          limit={scope === 'all' ? CARDS_PER_GROUP : undefined}
        />
      )}

      {!searching && members.length === 0 && cards.done.length > 0 && (
        <EmptyState title="You get every card in this pack." />
      )}
      {!searching && members.length === 0 && cards.done.length === 0 && (
        <EmptyState title="Nothing in this pack.">
          <p>Add cards from your library below, or use “File in pack…” on any reference.</p>
        </EmptyState>
      )}
      {!searching && members.length > 0 && (
        <ol
          className={styles.list}
          onDragOver={acceptsCard}
          onDrop={(event) => {
            if (!acceptsCard(event)) return;
            const dropped = event.dataTransfer.getData(REFERENCE_DRAG_TYPE);
            void attempt(() => packs.fileCard(dropped, pack.id, Infinity));
          }}
        >
          {members.map((reference, index) => (
            <PackMemberItem
              key={reference.id}
              reference={reference}
              packId={pack.id}
              index={index}
              count={members.length}
              otherPacks={(data?.packsByReference.get(reference.id) ?? []).filter(
                (other) => other.id !== pack.id,
              )}
              draggable={finePointer}
            />
          ))}
        </ol>
      )}
      {!searching && <PackDoneList packId={pack.id} cards={cards.done} />}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {/* Done cards are offered too: adding one puts it back. */}
      <AddFromLibrary packId={pack.id} memberIds={new Set(members.map((m) => m.id))} />

      <PackSettings key={pack.id} pack={pack} />

      {otherPacks.length > 0 && (
        <Section
          title="Other packs"
          description={finePointer ? 'Drop a card on a pack to file it there.' : undefined}
        >
          <ul className={styles.list}>
            {otherPacks.map((other) => (
              <PackRow key={other.id} pack={other} count={data?.counts.get(other.id) ?? 0} />
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}

function PackSettings({ pack }: { pack: Pack }) {
  const { packs } = useRepositories();
  const navigate = useNavigate();
  const { error, attempt } = useAttempt();
  const [name, setName] = useState(pack.name);
  const nameId = useId();

  const deletePack = async () => {
    const question = `Delete the pack “${pack.name}”? Its cards stay in your library.`;
    if (!window.confirm(question)) return;
    if (await attempt(() => packs.deletePack(pack.id))) void navigate('/packs');
  };

  return (
    <Section title="Pack settings">
      <form
        className={styles.inline}
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) void attempt(() => packs.rename(pack.id, name));
        }}
      >
        <label htmlFor={nameId} className={styles.label}>
          Name
        </label>
        <input
          id={nameId}
          className={styles.textInput}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          required
        />
        <button type="submit" className={styles.button}>
          Rename
        </button>
      </form>
      <SegmentedControl
        legend="Spoilers"
        name="pack-ceiling"
        options={CEILING_OPTIONS}
        value={pack.ceiling}
        onChange={(ceiling) => void attempt(() => packs.setCeiling(pack.id, ceiling))}
      />
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={pack.now}
          onClick={() => void attempt(() => (pack.now ? packs.clearNow() : packs.setNow(pack.id)))}
        >
          {pack.now ? 'Now' : 'Set as Now'}
        </button>
        <button type="button" className={styles.danger} onClick={() => void deletePack()}>
          Delete pack
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}

/** Files library cards (Search's curated split) into the pack. Offline: no cached web results. */
function AddFromLibrary({ packId, memberIds }: { packId: string; memberIds: ReadonlySet<string> }) {
  const { packs } = useRepositories();
  const { error, attempt } = useAttempt();
  const [text, setText] = useState('');
  const { matches } = useSearch(text);
  const shown = matches.filter((m) => !memberIds.has(m.reference.id)).slice(0, LIBRARY_RESULTS);

  return (
    <Section title="Add from library">
      <PackSearchField label="Add from library" value={text} onChange={setText} />
      {shown.length > 0 && (
        <ul className={styles.sheetList}>
          {shown.map(({ reference }) => (
            <li key={reference.id}>
              <button
                type="button"
                className={styles.sheetButton}
                onClick={() => void attempt(() => packs.fileCard(reference.id, packId, Infinity))}
              >
                Add {reference.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {text.trim() !== '' && shown.length === 0 && (
        <p className={styles.muted}>No other library card matches.</p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}
