import type { TourStep } from '../../components/tour/Tour';

/** The mascot's walk around Search (`data-tour` targets live in SearchPage). */
export const SEARCH_TOUR: readonly TourStep[] = [
  {
    target: 'search-bar',
    text: 'Type a line, a meme or a show. You can also paste a whole message and I’ll find the line inside it.',
  },
  {
    target: 'search-tags',
    text: 'Tags put that kind first: tap Anime and anime comes to the top. “Add tag” saves your own, like Marvel.',
  },
  {
    target: 'search-tags',
    text: 'With a tag on, “Only these” appears after you search. It hides everything that doesn’t match.',
  },
  {
    text: '“Lean to my taste” in Settings puts the kinds you open most first. You can replay this tour from Settings.',
  },
];
