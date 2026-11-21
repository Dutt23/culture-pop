// Shared by the server function (api/) and the app (src/): types and limits only.

export const CARD_KINDS = ['reference', 'topic', 'list', 'ranking'] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const isCardKind = (value: unknown): value is CardKind =>
  (CARD_KINDS as readonly unknown[]).includes(value);

/** Topic, list and ranking cards: a takeaway and context instead of a meaning and a reply. */
export const isStructured = (kind: CardKind | undefined): boolean =>
  kind !== undefined && kind !== 'reference';

export const CARD_COLORS = ['lavender', 'sage', 'peach'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export type SourceKind = 'wiki' | 'web' | 'app';

/** web: `url` required, `text` is the visible snippet; wiki/app: `text` required. */
export interface DraftSourceInput {
  kind: SourceKind;
  provenance?: 'user';
  from: string;
  title: string;
  text?: string;
  url?: string;
}

export interface ToneCard {
  label: string;
  gist: string;
  means: string;
  reply: string;
  summary: string;
}

export interface DraftRequestBody {
  search: string;
  kind?: CardKind;
  userContext?: string;
  retry?: { preserveSources: number[] };
  about?: string[];
  sources: DraftSourceInput[];
  tones?: ToneCard[];
  styleGuidance?: { tone: string; structure: string };
}

export type EvidenceRole = 'meaning' | 'origin' | 'usage';

export interface EvidenceItem {
  id: string;
  role: EvidenceRole;
  from: string;
  title: string;
  text: string;
  /** Index into the request's `sources`. */
  source: number;
}

export interface CitedLine {
  text: string;
  sources: number[];
}

export interface DraftCard {
  kind?: CardKind;
  partial?: boolean;
  label: string;
  gist: string;
  means: string;
  reply: string;
  summary: CitedLine[];
  context: CitedLine[];
  example: CitedLine | null;
  spoiler: 'none' | 'major';
}

export interface NotUsed {
  source: number;
  why: string;
}

export interface DraftResponse {
  card: DraftCard;
  notUsed: NotUsed[];
  provider: 'openai' | 'cloudflare' | 'fake';
  promptVersion: string;
}

export const LIMITS = {
  styleGuidanceChars: 280,
  sources: 10,
  webSources: 10,
  tones: 2,
  searchChars: 200,
  itemChars: 1200,
  totalChars: 6000,
  toneFieldChars: 280,
} as const;
