import type { ExternalLink } from './types';
import { safeUrl } from './validate';

interface ExternalIdProperty {
  property: string;
  label: string;
  /** Wikidata formatter URL (P1630); `$1` is the ID. */
  template: string;
  /** Stricter than Wikidata's own format constraint: IDs are untrusted. */
  pattern: RegExp;
}

/**
 * Exact-page link-outs from Wikidata external IDs, in display order. Formatter URLs read from
 * each property's P1630 on 2026-11-15 (anonymous wbgetentities):
 * https://www.wikidata.org/wiki/Property:P13484 https://www.wikidata.org/wiki/Property:P6760
 * https://www.wikidata.org/wiki/Property:P6839 https://www.wikidata.org/wiki/Property:P13553
 * https://www.wikidata.org/wiki/Property:P4086 https://www.wikidata.org/wiki/Property:P8729
 * https://www.wikidata.org/wiki/Property:P6262 (preferred-rank formatter).
 * Know Your Meme has two current properties with one formatter: P13484 (slug, most items) and
 * P6760 (numeric ID, now also accepting slugs); the first one found wins.
 */
export const EXTERNAL_ID_PROPERTIES: readonly ExternalIdProperty[] = [
  {
    property: 'P13484',
    label: 'Know Your Meme',
    template: 'https://knowyourmeme.com/memes/$1',
    pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  },
  {
    property: 'P6760',
    label: 'Know Your Meme',
    template: 'https://knowyourmeme.com/memes/$1',
    pattern: /^([1-9][0-9]{0,9}|[a-z0-9]+(-[a-z0-9]+)*)$/,
  },
  {
    property: 'P6839',
    label: 'TV Tropes',
    template: 'https://tvtropes.org/pmwiki/pmwiki.php/$1',
    pattern: /^[A-Za-z]{2,50}\/[A-Za-z0-9]{1,100}$/,
  },
  {
    property: 'P13553',
    label: 'Urban Dictionary',
    template: 'https://www.urbandictionary.com/define.php?term=$1',
    // shortcut: drops the rare percent-encoded IDs Wikidata allows; decode-and-check if they matter.
    pattern: /^[A-Za-z0-9.][A-Za-z0-9. -]{0,99}$/,
  },
  {
    property: 'P4086',
    label: 'MyAnimeList',
    template: 'https://myanimelist.net/anime/$1',
    pattern: /^[1-9][0-9]{0,9}$/,
  },
  {
    property: 'P8729',
    label: 'AniList',
    template: 'https://anilist.co/anime/$1',
    pattern: /^[1-9][0-9]{0,9}$/,
  },
  {
    property: 'P6262',
    label: 'Fandom',
    template: 'https://community.fandom.com/wiki/w:c:$1',
    // `wiki:Page_title`, English wikis only (no `lang.` prefix); the title may contain `/` and
    // `:` but no spaces, `%` or markup.
    pattern: /^[a-z0-9][a-z0-9-]{0,69}:[^\s<>[\]{}|#?%\\]{1,255}$/,
  },
];

/** Encodes each `/` segment, keeping `:` like Wikibase does; `.` and `..` segments are refused. */
function encodePath(id: string): string | undefined {
  const segments = id.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return undefined;
  return segments.map((s) => encodeURIComponent(s).replace(/%3A/g, ':')).join('/');
}

/** Builds the link for one ID, or nothing if the ID or the resulting URL looks wrong. */
export function externalLink(property: string, id: string): ExternalLink | undefined {
  const spec = EXTERNAL_ID_PROPERTIES.find((p) => p.property === property);
  if (!spec || !spec.pattern.test(id)) return undefined;
  const encoded = encodePath(id);
  if (encoded === undefined) return undefined;
  const url = safeUrl(spec.template.replace('$1', () => encoded), new URL(spec.template).hostname);
  return url ? { label: spec.label, url } : undefined;
}

/**
 * One link per site, in display order. SPARQL rows come back in no fixed order, so IDs of the
 * same property are sorted to keep the chosen link stable.
 */
export function pickExternalLinks(ids: ReadonlyMap<string, ReadonlySet<string>>): ExternalLink[] {
  const links = new Map<string, ExternalLink>();
  for (const { property, label } of EXTERNAL_ID_PROPERTIES) {
    if (links.has(label)) continue;
    for (const id of [...(ids.get(property) ?? [])].sort()) {
      const link = externalLink(property, id);
      if (link) {
        links.set(label, link);
        break;
      }
    }
  }
  return [...links.values()];
}
