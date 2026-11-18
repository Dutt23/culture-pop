// Shared by the server function (api/) and the app (src/): types and limits only.

export type SourceKind = 'wiki' | 'web' | 'app';

/** web: `url` required, `text` is the visible snippet; wiki/app: `text` required. */
export interface DraftSourceInput {
  kind: SourceKind;
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
  about?: string[];
  sources: DraftSourceInput[];
  tones?: ToneCard[];
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
  sources: 6,
  webSources: 3,
  tones: 2,
  searchChars: 200,
  itemChars: 1200,
  totalChars: 6000,
  toneFieldChars: 280,
} as const;
