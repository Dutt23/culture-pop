import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { FavouriteButton } from '../../components/favourite-button/FavouriteButton';
import { GlanceCard } from '../../components/glance-card/GlanceCard';
import { InterpretationCard } from '../../components/interpretation-card/InterpretationCard';
import { readOpenPack } from '../../components/reference-card/openPack';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { SourceList } from '../../components/source-list/SourceList';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCards } from '../../components/ui/SkeletonCards';
import { ExternalLinks } from '../../components/ui/ExternalLinks';
import { ExternalSearchLinks } from '../../components/ui/ExternalSearchLinks';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { CATEGORY_LABEL, ERA_LABEL, fromWorks } from '../../domain/labels';
import { linesForCeiling } from '../../domain/packs';
import { isFromOnline } from '../../domain/types';
import { PUBLISHER } from '../../domain/sources';
import { useFavourites } from '../favourites/useFavourites';
import { PackChips } from '../packs/PackChips';
import { PackSheet } from '../packs/PackSheet';
import { usePacksOf } from '../packs/usePacks';
import { useSettings } from '../settings/SettingsContext';
import styles from './ReferencePage.module.css';
import { SameWorldChips } from './SameWorldChips';
import { useReference } from './useReference';

export function ReferencePage() {
  const { id = '' } = useParams();
  const detail = useReference(id);
  const favourites = useFavourites();
  const { settings } = useSettings();
  const isOnline = useOnlineStatus();
  const location = useLocation();
  const inPacks = usePacksOf(id);
  // The reveal lasts one visit (history entry); the sheet stays with its reference.
  const [endingShownOn, setEndingShownOn] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  // Opened from a pack: the card's link says so. With no link state at all (typed or refreshed
  // without history), this tab's stored pack stands in.
  const state: unknown = location.state;
  const openPackId =
    typeof state === 'object' && state !== null && 'packId' in state
      ? typeof state.packId === 'string'
        ? state.packId
        : null
      : readOpenPack();

  // Until memberships load the ceiling is unknown; showing the page could flash a spoiler.
  if (detail === undefined || (openPackId !== null && inPacks === undefined)) {
    return (
      <div role="status">
        <span className="sr-only">Loading…</span>
        <SkeletonCards count={2} />
      </div>
    );
  }

  if (detail === null) {
    return (
      <Page title="Reference not found">
        <EmptyState title="This reference isn't in your library">
          <p>The link may be out of date.</p>
          <Link to="/search">Search instead</Link>
        </EmptyState>
      </Page>
    );
  }

  const { reference, interpretations, sources, otherMeanings, groups } = detail;
  const yearSource = sources.find((s) => s.id === reference.yearSourceId);
  const when =
    reference.year !== undefined && yearSource
      ? `${reference.year} (per ${yearSource.publisher})`
      : reference.decade && ERA_LABEL[reference.decade];
  const eyebrow = [CATEGORY_LABEL[reference.category], when].filter(Boolean).join(' · ');
  // The ceiling applies only when the card is filed in the pack it was opened from.
  const openPack = inPacks?.find((pack) => pack.id === openPackId);
  const endingShown = endingShownOn === location.key;
  const hidesEnding = openPack?.ceiling === 'before_watching' && !endingShown;
  const lines = linesForCeiling(interpretations, hidesEnding ? 'before_watching' : 'open');
  const shown = lines.interpretations;
  const revealSpoilers = !hidesEnding && (endingShown || settings.spoilers === 'show');
  const works = fromWorks(reference);
  const fromOnline = isFromOnline(reference.editorialState);
  const explained = interpretations.length > 0;
  const backed = interpretations.some((i) => i.provenance === 'source_supported');
  // Comics characters' Wikipedia pages carry their story under this heading; if a page doesn't,
  // the link still opens the article.
  const wikipedia = sources.find((s) => s.publisher === PUBLISHER.wikipedia);
  const storyLink =
    reference.kind === 'character' && reference.category === 'comics' && wikipedia
      ? [
          {
            label: 'Wikipedia: the character’s story',
            href: `${wikipedia.url}#Fictional_character_biography`,
          },
        ]
      : [];
  const otherSites = [
    ...storyLink,
    ...(reference.externalLinks ?? []).map((link) => ({ label: link.label, href: link.url })),
  ];

  return (
    <Page
      title={reference.title}
      eyebrow={eyebrow}
      intro={
        reference.origin ? (
          <p>From {reference.origin}</p>
        ) : (
          works.length > 0 && (
            <p>
              From:{' '}
              {works.map((work, index) => (
                <span key={work.qid}>
                  {index > 0 && ', '}
                  <Link to={`/search?q=${encodeURIComponent(work.label)}`}>{work.label}</Link>
                </span>
              ))}
            </p>
          )
        )
      }
    >
      {/* The ten-second answer first; the full story and sources follow below. */}
      {lines.glance && <GlanceCard interpretation={lines.glance} />}
      {lines.safeSummary && <p className={styles.safeSummary}>{lines.safeSummary}</p>}
      {lines.nothingSafe && (
        <p className={styles.note}>No spoiler-free line filed for this card yet.</p>
      )}
      {/* The pack travels with every hop; each card applies its ceiling only if filed there. */}
      <SameWorldChips groups={groups} packId={openPackId ?? undefined} />
      <PackChips label="In your packs:" packs={inPacks ?? []} />
      {hidesEnding && (
        <div className={styles.ceiling}>
          <p className={styles.note}>Filed for before you watch. The ending stays hidden.</p>
          {shown.length < interpretations.length && (
            <button
              type="button"
              className={styles.button}
              onClick={() => setEndingShownOn(location.key)}
            >
              Show the ending anyway
            </button>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <FavouriteButton
          isFavourite={favourites.ids.has(reference.id)}
          onToggle={() => void favourites.toggle(reference.id)}
        />
        <button
          type="button"
          className={styles.button}
          aria-expanded={sheetFor === id}
          onClick={() => setSheetFor(sheetFor === id ? null : id)}
        >
          File in pack…
        </button>
        {favourites.error && (
          <p className={styles.error} role="alert">
            {favourites.error}
          </p>
        )}
      </div>
      {sheetFor === id && (
        <PackSheet
          referenceId={reference.id}
          title={reference.title}
          onClose={() => setSheetFor(null)}
        />
      )}

      {fromOnline && !explained && (
        <Section
          title="Not explained yet"
          description="This was found online and hasn't been explained in plain language yet. Here's exactly what the sources say: unverified, quoted with credit."
        >
          <SourceList sources={sources} />
        </Section>
      )}

      {shown.length > 0 && (
        <Section
          title={
            fromOnline
              ? backed
                ? 'Explained from sources'
                : 'Explanation not verified'
              : shown.length === 1
                ? 'What it means'
                : `${shown.length} meanings`
          }
          description={
            fromOnline
              ? backed
                ? 'Built automatically, only from what the cited sources state. Nothing is guessed or written by hand.'
                : "A source this would rely on isn't on this device any more, so treat it as unverified."
              : shown.length > 1
                ? 'Different ways people use this reference.'
                : undefined
          }
        >
          <ol className={styles.interpretations}>
            {shown.map((interpretation, index) => (
              <AnimatedItem key={interpretation.id} index={index}>
                <InterpretationCard
                  interpretation={interpretation}
                  index={index}
                  revealSpoilers={revealSpoilers}
                  citations={sources.filter((s) => interpretation.sourceIds.includes(s.id))}
                />
              </AnimatedItem>
            ))}
          </ol>
        </Section>
      )}

      {fromOnline && explained && (
        <Section
          title="What the sources say"
          description="Quoted with credit, exactly as found online."
        >
          <SourceList sources={sources} />
        </Section>
      )}

      {otherMeanings.length > 0 && (
        <Section title="Same phrase, different meaning">
          <ul className={styles.related}>
            {otherMeanings.map((related, index) => (
              <AnimatedItem key={related.id} index={index}>
                <ReferenceCard reference={related} />
              </AnimatedItem>
            ))}
          </ul>
        </Section>
      )}

      {groups.map((group) => (
        <Section key={`${group.kind}:${group.label}`} title={group.label}>
          <ul className={styles.related}>
            {group.references.map((related, index) => (
              <AnimatedItem key={related.id} index={index}>
                <ReferenceCard reference={related} />
              </AnimatedItem>
            ))}
          </ul>
        </Section>
      ))}

      {fromOnline ? (
        <>
          {otherSites.length > 0 && (
            <Section
              title="Its page on other sites"
              description="Exact pages listed by Wikidata. They open outside the app, and nothing from them is copied here."
            >
              <ExternalLinks links={otherSites} />
            </Section>
          )}
          <Section title="Look further">
            <ExternalSearchLinks query={reference.title} isOnline={isOnline} />
          </Section>
        </>
      ) : (
        <Section
          title="Sources"
          description={
            sources.length > 0
              ? undefined
              : 'This is a demo entry written for the app. It has no external citations yet.'
          }
        >
          {sources.length > 0 && <SourceList sources={sources} />}
          <ExternalSearchLinks query={reference.title} isOnline={isOnline} />
        </Section>
      )}
    </Page>
  );
}
