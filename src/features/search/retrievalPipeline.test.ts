import { of, throwError, type Observable } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  RetrievalError,
  type ProviderOutcome,
  type RetrievalResult,
} from '../../services/retrieval/types';
import {
  retrievalStates,
  type KeyedRetrievalState,
  type RetrievalRequest,
  type RetrievalState,
} from './retrievalPipeline';

const DEBOUNCE_MS = 500;

function result(wikidata: ProviderOutcome['status']): RetrievalResult {
  return {
    candidates: [],
    outcomes: [
      { provider: 'wikipedia', status: 'ok' },
      wikidata === 'failed'
        ? { provider: 'wikidata', status: 'failed', failure: 'timeout' }
        : { provider: 'wikidata', status: wikidata },
    ],
  };
}

const EARLY = result('pending');
const FINAL = result('ok');
const UNCLASSIFIED = result('failed');

const request = (text: string, attempt = 0): RetrievalRequest => ({
  key: `${attempt}\n${text}`,
  text,
});
const keyed = (text: string, state: RetrievalState, attempt = 0): KeyedRetrievalState => ({
  key: `${attempt}\n${text}`,
  state,
});
const partial = (r: RetrievalResult): RetrievalState => ({ status: 'partial', result: r });
const done = (r: RetrievalResult, cached: boolean): RetrievalState => ({
  status: 'done',
  result: r,
  cached,
});

function testScheduler() {
  return new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
}

/** A service whose lookups are the given cold observables, one per query text. */
function serviceOf(lookups: Record<string, Observable<RetrievalResult>>) {
  return {
    retrieve$: vi.fn((text: string) => lookups[text]),
    debounceMs: DEBOUNCE_MS,
  };
}

const saveOk = () => of(undefined);

describe('retrievalStates', () => {
  it('streams partial states, then saves and reports the final one as done', () => {
    testScheduler().run(({ cold, hot, expectObservable }) => {
      const lookup = cold('10ms e 9ms (f|)', { e: EARLY, f: FINAL });
      const requests = hot('a', { a: request('point break') });
      const save = vi.fn(saveOk);
      const states = retrievalStates(requests, serviceOf({ 'point break': lookup }), save);

      expectObservable(states).toBe('510ms e 9ms (fd)', {
        e: keyed('point break', partial(EARLY)),
        f: keyed('point break', partial(FINAL)),
        d: keyed('point break', done(FINAL, true)),
      });
    });
  });

  it('debounces typing: only the last query within the window is looked up', () => {
    testScheduler().run(({ cold, hot, expectObservable, flush }) => {
      const service = serviceOf({
        poin: cold('(f|)', { f: FINAL }),
        'point break': cold('(f|)', { f: FINAL }),
      });
      const requests = hot('a 99ms b', { a: request('poin'), b: request('point break') });
      const states = retrievalStates(requests, service, saveOk);

      expectObservable(states).toBe('600ms (fd)', {
        f: keyed('point break', partial(FINAL)),
        d: keyed('point break', done(FINAL, true)),
      });
      flush();
      expect(service.retrieve$.mock.calls).toEqual([['point break']]);
    });
  });

  it('cancels a running lookup as soon as the query changes, without waiting for the debounce', () => {
    testScheduler().run(({ cold, hot, expectObservable, expectSubscriptions }) => {
      const first = cold('10ms e 30ms (f|)', { e: EARLY, f: FINAL });
      const second = cold('10ms (f|)', { f: FINAL });
      const requests = hot('a 514ms b', { a: request('the matrix'), b: request('swat kats') });
      const states = retrievalStates(
        requests,
        serviceOf({ 'the matrix': first, 'swat kats': second }),
        saveOk,
      );

      expectObservable(states).toBe('510ms e 514ms (fd)', {
        e: keyed('the matrix', partial(EARLY)),
        f: keyed('swat kats', partial(FINAL)),
        d: keyed('swat kats', done(FINAL, true)),
      });
      expectSubscriptions(first.subscriptions).toBe('500ms ^ 14ms !');
      expectSubscriptions(second.subscriptions).toBe('1015ms ^ 9ms !');
    });
  });

  it('stops at once when there is nothing to look up (offline, consent withdrawn)', () => {
    testScheduler().run(({ cold, hot, expectObservable, expectSubscriptions }) => {
      const lookup = cold('10ms e 30ms (f|)', { e: EARLY, f: FINAL });
      const requests = hot('a 514ms n', { a: request('the matrix'), n: null });
      const states = retrievalStates(requests, serviceOf({ 'the matrix': lookup }), saveOk);

      expectObservable(states).toBe('510ms e', { e: keyed('the matrix', partial(EARLY)) });
      expectSubscriptions(lookup.subscriptions).toBe('500ms ^ 14ms !');
    });
  });

  it('runs the same query again on retry (a new attempt key)', () => {
    testScheduler().run(({ cold, hot, expectObservable }) => {
      const lookup = cold('(f|)', { f: FINAL });
      const requests = hot('a 999ms b', { a: request('ok boomer'), b: request('ok boomer', 1) });
      const states = retrievalStates(requests, serviceOf({ 'ok boomer': lookup }), saveOk);

      expectObservable(states).toBe('500ms (fd) 996ms (FD)', {
        f: keyed('ok boomer', partial(FINAL)),
        d: keyed('ok boomer', done(FINAL, true)),
        F: keyed('ok boomer', partial(FINAL), 1),
        D: keyed('ok boomer', done(FINAL, true), 1),
      });
    });
  });

  it('reports a lookup that fails outright as an error state', () => {
    testScheduler().run(({ cold, hot, expectObservable }) => {
      const lookup = cold<RetrievalResult>(
        '10ms #',
        undefined,
        new RetrievalError('rate_limited', 'slow down'),
      );
      const requests = hot('a', { a: request('the matrix') });
      const states = retrievalStates(requests, serviceOf({ 'the matrix': lookup }), saveOk);

      expectObservable(states).toBe('510ms x', {
        x: keyed('the matrix', { status: 'error', failure: 'rate_limited' }),
      });
    });
  });

  it('does not cache a result Wikidata could not classify', () => {
    testScheduler().run(({ cold, hot, expectObservable, flush }) => {
      const lookup = cold('(f|)', { f: UNCLASSIFIED });
      const requests = hot('a', { a: request('the matrix') });
      const save = vi.fn(saveOk);
      const states = retrievalStates(requests, serviceOf({ 'the matrix': lookup }), save);

      expectObservable(states).toBe('500ms (fd)', {
        f: keyed('the matrix', partial(UNCLASSIFIED)),
        d: keyed('the matrix', done(UNCLASSIFIED, false)),
      });
      flush();
      expect(save).not.toHaveBeenCalled();
    });
  });

  it('still shows the result when saving it fails', () => {
    testScheduler().run(({ cold, hot, expectObservable }) => {
      const lookup = cold('(f|)', { f: FINAL });
      const requests = hot('a', { a: request('the matrix') });
      const states = retrievalStates(requests, serviceOf({ 'the matrix': lookup }), () =>
        throwError(() => new Error('QuotaExceededError')),
      );

      expectObservable(states).toBe('500ms (fd)', {
        f: keyed('the matrix', partial(FINAL)),
        d: keyed('the matrix', done(FINAL, false)),
      });
    });
  });
});
