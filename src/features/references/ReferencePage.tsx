import { Link, useParams } from 'react-router';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { FavouriteButton } from '../../components/favourite-button/FavouriteButton';
import { InterpretationCard } from '../../components/interpretation-card/InterpretationCard';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { SourceList } from '../../components/source-list/SourceList';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExternalLinks } from '../../components/ui/ExternalLinks';
import { ExternalSearchLinks } from '../../components/ui/ExternalSearchLinks';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { CATEGORY_LABEL, ERA_LABEL } from '../../domain/labels';
import { isFromOnline } from '../../domain/types';
import { PUBLISHER } from '../../domain/sources';
import { useFavourites } from '../favourites/useFavourites';
import { useSettings } from '../settings/SettingsContext';
import styles from './ReferencePage.module.css';
import { useReference } from './useReference';

export function ReferencePage() {
  const { id = '' } = useParams();
  const detail = useReference(id);
  const favourites = useFavourites();
  const { settings } = useSettings();
  const isOnline = useOnlineStatus();

  if (detail === undefined) {
    return (
      <p className={styles.loading} role="status">
        Loading…
      </p>
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

  const { reference, interpretations, sources, otherMeanings, sameEra } = detail;
  const yearSource = sources.find((s) => s.id === reference.yearSourceId);
  const when =
    reference.year !== undefined && yearSource
      ? `${reference.year} (per ${yearSource.publisher})`
      : reference.decade && ERA_LABEL[reference.decade];
  const eyebrow = [CATEGORY_LABEL[reference.category], when].filter(Boolean).join(' · ');
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
          reference.presentIn &&
          reference.presentIn.length > 0 && (
            <p>
              From:{' '}
              {reference.presentIn.map((work, index) => (
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
      <div className={styles.actions}>
        <FavouriteButton
          isFavourite={favourites.ids.has(reference.id)}
          onToggle={() => void favourites.toggle(reference.id)}
        />
        {favourites.error && (
          <p className={styles.error} role="alert">
            {favourites.error}
          </p>
        )}
      </div>

      {fromOnline && !explained && (
        <Section
          title="Not explained yet"
          description="This was found online and hasn't been explained in plain language yet. Here's exactly what the sources say: unverified, quoted with credit."
        >
          <SourceList sources={sources} />
        </Section>
      )}

      {explained && (
        <Section
          title={
            fromOnline
              ? backed
                ? 'Explained from sources'
                : 'Explanation not verified'
              : interpretations.length === 1
                ? 'What it means'
                : `${interpretations.length} meanings`
          }
          description={
            fromOnline
              ? backed
                ? 'Built automatically, only from what the cited sources state. Nothing is guessed or written by hand.'
                : "A source this would rely on isn't on this device any more, so treat it as unverified."
              : interpretations.length > 1
                ? 'Different ways people use this reference.'
                : undefined
          }
        >
          <ol className={styles.interpretations}>
            {interpretations.map((interpretation, index) => (
              <AnimatedItem key={interpretation.id} index={index}>
                <InterpretationCard
                  interpretation={interpretation}
                  index={index}
                  revealSpoilers={settings.spoilers === 'show'}
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

      {sameEra.length > 0 && reference.decade && (
        <Section title={`More from the ${ERA_LABEL[reference.decade]}`}>
          <ul className={styles.related}>
            {sameEra.map((related, index) => (
              <AnimatedItem key={related.id} index={index}>
                <ReferenceCard reference={related} />
              </AnimatedItem>
            ))}
          </ul>
        </Section>
      )}

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
