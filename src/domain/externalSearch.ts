export interface ExternalSearchLink {
  label: string;
  href: string;
}

/** Builds user-triggered links only; nothing here performs a request. */
export function externalSearchLinks(query: string): ExternalSearchLink[] {
  const q = encodeURIComponent(query.trim());
  return [
    { label: 'Search Wikipedia', href: `https://en.wikipedia.org/w/index.php?search=${q}` },
    { label: 'Search the web', href: `https://duckduckgo.com/?q=${q}` },
  ];
}
