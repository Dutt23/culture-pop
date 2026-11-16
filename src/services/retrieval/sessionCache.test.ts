import { Subject, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { withSessionCache } from './sessionCache';
import type { ProviderOutcome, RetrievalResult } from './types';

const MINUTE = 60 * 1000;

function result(status: ProviderOutcome['status'] = 'ok'): RetrievalResult {
  return { candidates: [], outcomes: [{ provider: 'wikipedia', status }] };
}

/** A fake `retrieve$` whose lookups finish only when the test says so. */
function controllable() {
  const lookups: Subject<RetrievalResult>[] = [];
  const retrieve = vi.fn<(query: string) => Observable<RetrievalResult>>(() => {
    const lookup = new Subject<RetrievalResult>();
    lookups.push(lookup);
    return lookup.asObservable();
  });
  const finish = (index: number, value: RetrievalResult = result()) => {
    lookups[index].next(value);
    lookups[index].complete();
  };
  return { retrieve, finish };
}

function collect(source: Observable<RetrievalResult>): RetrievalResult[] {
  const seen: RetrievalResult[] = [];
  source.subscribe((value) => seen.push(value));
  return seen;
}

describe('withSessionCache', () => {
  it('shares one lookup between identical searches running at the same time', () => {
    const { retrieve, finish } = controllable();
    const cached = withSessionCache(retrieve);
    const first = collect(cached('the matrix'));
    const second = collect(cached('  The Matrix '));
    finish(0);
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it('replays a finished search for ten minutes, then looks it up again', () => {
    let clock = 0;
    const { retrieve, finish } = controllable();
    const cached = withSessionCache(retrieve, () => clock);
    collect(cached('point break'));
    finish(0);

    clock = 10 * MINUTE;
    expect(collect(cached('point break'))).toEqual([result()]);
    expect(retrieve).toHaveBeenCalledTimes(1);

    clock = 10 * MINUTE + 1;
    collect(cached('point break'));
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it('never keeps a lookup where a provider failed, so Retry goes online', () => {
    const { retrieve, finish } = controllable();
    const cached = withSessionCache(retrieve, () => 0);
    collect(cached('no cap'));
    finish(0, result('failed'));
    collect(cached('no cap'));
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it('never keeps a cancelled lookup', () => {
    const { retrieve } = controllable();
    const cached = withSessionCache(retrieve, () => 0);
    cached('gigachad').subscribe().unsubscribe();
    collect(cached('gigachad'));
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it('keeps only the 20 most recently used searches', () => {
    const { retrieve, finish } = controllable();
    const cached = withSessionCache(retrieve, () => 0);
    for (let i = 0; i < 21; i += 1) {
      collect(cached(`query ${i}`));
      finish(i);
    }
    collect(cached('query 20'));
    expect(retrieve).toHaveBeenCalledTimes(21);
    collect(cached('query 0'));
    expect(retrieve).toHaveBeenCalledTimes(22);
  });
});
