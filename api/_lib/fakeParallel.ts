/**
 * A stand-in for Parallel's Search API when `WEB_SEARCH_FAKE=1` on a local machine (`devFlags.ts`).
 * It answers in Parallel's own shape, including fields the real function must strip (an image,
 * Markdown, HTML), so the same validation, caps and storage level apply as to real answers.
 */
export const fakeParallelFetch: typeof fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body ?? '{}')) as { search_queries?: unknown };
  const [first]: unknown[] = Array.isArray(body.search_queries) ? body.search_queries : [];
  const q = typeof first === 'string' ? first : '';
  const results = [1, 2, 3].map((n) => ({
    url: `https://example.com/local-test/${n}`,
    title: `Local test result ${n}`,
    publish_date: null,
    image: `https://example.com/local-test/${n}.png`,
    excerpts: [
      `![picture](https://example.com/${n}.png) **Fake answer ${n}** for <i>${q}</i>. ` +
        'No real search was made, so nothing was spent.',
    ],
  }));
  return new Response(JSON.stringify({ search_id: 'local-test', results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
