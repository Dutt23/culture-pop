import type { TourStep } from '../../components/tour/Tour';

/** The mascot's walk around the Packs page (`data-tour` targets live in PacksPage). */
export const PACKS_TOUR: readonly TourStep[] = [
  {
    text: 'Hi! Packs are folders of cards you pick yourself, like everything to know before a movie night.',
  },
  { target: 'new-pack', text: 'Name a pack here: “Before the movie”, “Office chat”, anything.' },
  {
    target: 'pack-spoilers',
    text: '“Before you watch” hides the twists on every card opened from that pack, even if your Settings show spoilers. “My spoiler setting” just follows Settings.',
  },
  {
    target: 'pack-search',
    text: 'Search inside all your packs here. It only looks in your packs and never goes online.',
  },
  {
    text: 'Open a pack and I’ll show you what’s inside. You can replay this tour from Settings.',
  },
];

/** The walk around one pack (`data-tour` targets live in PackPage). */
export const PACK_TOUR: readonly TourStep[] = [
  {
    target: 'pack-search-in',
    text: '“This pack” searches only this folder. “All packs” searches every pack you’ve made.',
  },
  {
    target: 'pack-cards',
    text: 'Each card has buttons: Move sends it to another pack, Up and Down change the order, and “I get this now” folds it into “Cards you get”.',
  },
  {
    target: 'pack-spoilers',
    text: 'This pack’s spoiler choice. “Before you watch” keeps the twists hidden on every card you open from here.',
  },
  {
    target: 'pack-pin',
    text: 'Pin the pack you’re using most, say for this week’s watch, so it’s always first.',
  },
];
