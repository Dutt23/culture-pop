import { API_USER_AGENT, createGetJson } from '../../services/retrieval/http';
import type { GetJson } from '../../services/retrieval/types';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `getJson` for the benchmarks. Node has no navigator.onLine, so the online check is stubbed. Node
 * also sends no browser User-Agent, and query.wikidata.org answers 403 without one (it ignores
 * Api-User-Agent), so the eval sends the app's own identifier, with no contact details, as a
 * browser would.
 */
export function createEvalGetJson(): GetJson {
  return createGetJson({
    fetch: (input, init) =>
      globalThis.fetch(input, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), 'User-Agent': API_USER_AGENT },
      }),
    sleep,
    isOnline: () => true,
  });
}

/** Wraps `getJson` to remember answers by URL and record every URL that really went out. */
export function cachedCounting(getJson: GetJson): {
  getJson: GetJson;
  sent: () => readonly string[];
} {
  const answers = new Map<string, Promise<unknown>>();
  const sent: string[] = [];
  return {
    getJson: (url, signal) => {
      let answer = answers.get(url);
      if (!answer) {
        sent.push(url);
        answer = getJson(url, signal);
        answers.set(url, answer);
        // A failed request is not kept, so a later run asks again.
        answer.catch(() => answers.delete(url));
      }
      return answer;
    },
    sent: () => sent,
  };
}
