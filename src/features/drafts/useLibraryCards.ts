import { useLiveQuery } from 'dexie-react-hooks';
import type { ToneCard } from '../../../shared/cardTypes.js';
import { useRepositories } from '../../app/useRepositories';
import type { DraftCardRecord } from '../../data/repositories/draftRepository';
import type { Interpretation, Reference } from '../../domain/types';
import { keptName } from './curationLook';

interface AppCard {
  reference: Reference;
  interpretation: Interpretation;
  own: boolean;
}

const fromFavourite = ({ reference, interpretation: i }: AppCard): ToneCard => ({
  label: reference.title,
  gist: i.gist ?? i.summary,
  means: i.socialMove ?? i.context,
  reply: i.reply ?? '',
  summary: i.summary,
});

const fromKept = ({ card, search }: DraftCardRecord, reveal: boolean): ToneCard => ({
  label: keptName(card, search, reveal),
  gist: card.gist,
  means: card.means,
  reply: card.reply,
  summary: card.summary.map((l) => l.text).join(' '),
});

/**
 * The reader's favourites (frames and tone cards) and kept drafts (tone cards). `realLabels` maps
 * a hidden spoiler's shown name back to its own label, which is what the AI gets.
 */
export function useLibraryCards(revealSpoilers: boolean) {
  const { favourites, references, drafts } = useRepositories();
  return useLiveQuery(async () => {
    // All four reads at once, and two for the whole library, not one read per card (D69).
    const [favouriteRows, saved, interpretations, kept] = await Promise.all([
      favourites.list(),
      references.getAll(),
      references.getAllInterpretations(),
      drafts.list(),
    ]);
    const favouriteIds = new Set(favouriteRows.map((f) => f.referenceId));
    // Each card's first interpretation by ID, as `getInterpretations` ordered them.
    const firstOf = new Map<string, Interpretation>();
    for (const i of interpretations) {
      const held = firstOf.get(i.referenceId);
      if (!held || i.id < held.id) firstOf.set(i.referenceId, i);
    }
    const appCards = saved.flatMap((reference) => {
      const interpretation = firstOf.get(reference.id);
      return interpretation && (revealSpoilers || interpretation.spoiler !== 'major')
        ? [{ reference, interpretation, own: false }]
        : [];
    });
    const realLabels = new Map(
      kept.map((k): [string, string] => [keptName(k.card, k.search, revealSpoilers), k.card.label]),
    );
    const tones = [
      ...appCards.filter((card) => favouriteIds.has(card.reference.id)).map(fromFavourite),
      ...kept.map((k) => fromKept(k, revealSpoilers)),
    ];
    // A filter is keyed by its label: the first card with a label wins.
    const toneCards = tones.filter((t, i) => tones.findIndex((u) => u.label === t.label) === i);
    return { appCards, toneCards, realLabels, kept };
  }, [favourites, references, drafts, revealSpoilers]);
}

