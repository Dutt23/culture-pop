import {
  asyncScheduler,
  catchError,
  connect,
  EMPTY,
  endWith,
  from,
  ignoreElements,
  last,
  map,
  merge,
  of,
  switchMap,
  timer,
  type Observable,
  type ObservableInput,
  type SchedulerLike,
} from 'rxjs';
import type { RetrievalService } from '../../app/RetrievalContext';
import {
  RetrievalError,
  type RetrievalFailure,
  type RetrievalResult,
  type RetrievedCandidate,
} from '../../services/retrieval/types';

export type RetrievalState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** Some providers have answered; the rest are still `pending` in `result.outcomes`. */
  | { status: 'partial'; result: RetrievalResult }
  | { status: 'done'; result: RetrievalResult; cached: boolean }
  | { status: 'error'; failure: RetrievalFailure };

/** One lookup to run; `key` changes whenever the text or the attempt does. */
export interface RetrievalRequest {
  key: string;
  text: string;
}

/** A state, tagged with the request it belongs to so a stale one is never shown. */
export interface KeyedRetrievalState {
  key: string;
  state: RetrievalState;
}

/** Without Wikidata, types and years are missing: caching would overwrite a good earlier copy. */
function isCacheable(result: RetrievalResult): boolean {
  return !result.outcomes.some((o) => o.provider === 'wikidata' && o.status === 'failed');
}

/**
 * Requests in, states out. A new request (or `null`, for "nothing to look up") cancels the running
 * lookup at once, then waits `debounceMs` before contacting anyone; that's `debounceTime` +
 * `switchMap`, but without letting a cancelled lookup run on through the debounce window. Each
 * snapshot is a `partial` state; the last one is saved for offline use (unless Wikidata failed)
 * and becomes `done`.
 */
export function retrievalStates(
  requests$: Observable<RetrievalRequest | null>,
  service: RetrievalService,
  save: (candidates: readonly RetrievedCandidate[]) => ObservableInput<unknown>,
  scheduler: SchedulerLike = asyncScheduler,
): Observable<KeyedRetrievalState> {
  const saved$ = (result: RetrievalResult): Observable<boolean> =>
    isCacheable(result)
      ? from(save(result.candidates)).pipe(
          ignoreElements(),
          endWith(true),
          catchError(() => of(false)),
        )
      : of(false);

  const lookUp = ({ key, text }: RetrievalRequest): Observable<KeyedRetrievalState> =>
    service.retrieve$(text).pipe(
      // `connect` subscribes both branches before the first snapshot, so neither misses one.
      connect((snapshots$) =>
        merge(
          snapshots$.pipe(map((result): RetrievalState => ({ status: 'partial', result }))),
          snapshots$.pipe(
            last(),
            switchMap((result) =>
              saved$(result).pipe(
                map((cached): RetrievalState => ({ status: 'done', result, cached })),
              ),
            ),
          ),
        ),
      ),
      catchError((error: unknown) =>
        of<RetrievalState>({
          status: 'error',
          failure: error instanceof RetrievalError ? error.failure : 'bad_response',
        }),
      ),
      map((state) => ({ key, state })),
    );

  return requests$.pipe(
    switchMap((request) =>
      request === null
        ? EMPTY
        : timer(service.debounceMs, scheduler).pipe(switchMap(() => lookUp(request))),
    ),
  );
}
