import type { ModelRecord } from '@mlc-ai/web-llm';
import { proxy, wrap, type Remote } from 'comlink';
import { BehaviorSubject, defer, finalize, Observable, throwError } from 'rxjs';
import { createCrashGuard, type CrashGuard, type PreviousCrash } from './crashGuard';
import type { ChatJob } from './jobs';
import type { ModelFamily, ModelVariant } from './models';

/**
 * Main-thread side of the on-device model. WebLLM, its WASM, tokenising and inference live only
 * in `src/workers/llm.worker.ts`, reached through Comlink; the main thread imports no WebLLM code.
 * One worker per loaded model, created after consent, terminated on failure, when idle, or when
 * the caller is done. Weights go to the Cache API (WebLLM's default), never IndexedDB.
 */

// ── Device budget ───────────────────────────────────────────────────────────

export type Support =
  | {
      ok: true;
      shaderF16: boolean;
      adapter: string;
      maxBufferSize: number;
      maxStorageBufferBindingSize: number;
      /** GPU memory a model may use on this device (see `MEMORY_SHARE`). */
      memoryBudgetMB: number;
    }
  | { ok: false; reason: 'no_webgpu' | 'no_adapter' | 'low_memory' | 'gpu_limits' };

/** The few WebGPU and Device Memory API members used here, so no global WebGPU types are needed. */
export interface NavigatorLike {
  gpu?: {
    requestAdapter(): Promise<{
      features: ReadonlySet<string>;
      limits: { maxBufferSize: number; maxStorageBufferBindingSize: number };
      info?: { vendor?: string; architecture?: string };
    } | null>;
  };
  deviceMemory?: number;
}

/** `navigator.deviceMemory` rounds down to a power of two, so a 6 GB phone reports 4. */
export const MIN_DEVICE_MEMORY_GB = 4;
/** Assumed where the browser doesn't say (Safari, Firefox): the smallest device we allow. */
const ASSUMED_DEVICE_MEMORY_GB = 4;
/** Share of device memory a model may take; phones share RAM between CPU and GPU. */
export const MEMORY_SHARE = 0.4;
/** WebLLM's own minimums (its runtime falls back to these, then refuses): 256 MiB and 128 MiB. */
const MIN_MAX_BUFFER = 256 * 2 ** 20;
const MIN_STORAGE_BINDING = 128 * 2 ** 20;

/** No WebGPU, no adapter, too little memory or too small GPU limits means no model: curator only. */
export async function detectSupport(
  nav: NavigatorLike = navigator as NavigatorLike,
): Promise<Support> {
  if (nav.deviceMemory !== undefined && nav.deviceMemory < MIN_DEVICE_MEMORY_GB) {
    return { ok: false, reason: 'low_memory' };
  }
  if (!nav.gpu) return { ok: false, reason: 'no_webgpu' };
  const adapter = await nav.gpu.requestAdapter().catch(() => null);
  if (!adapter) return { ok: false, reason: 'no_adapter' };
  const { maxBufferSize, maxStorageBufferBindingSize } = adapter.limits;
  if (maxBufferSize < MIN_MAX_BUFFER || maxStorageBufferBindingSize < MIN_STORAGE_BINDING) {
    return { ok: false, reason: 'gpu_limits' };
  }
  return {
    ok: true,
    shaderF16: adapter.features.has('shader-f16'),
    adapter: [adapter.info?.vendor, adapter.info?.architecture].filter(Boolean).join(' '),
    maxBufferSize,
    maxStorageBufferBindingSize,
    memoryBudgetMB: Math.floor(
      (nav.deviceMemory ?? ASSUMED_DEVICE_MEMORY_GB) * 1024 * MEMORY_SHARE,
    ),
  };
}

/**
 * q4f16 where the GPU has `shader-f16`, q4f32 otherwise; undefined when that build's GPU memory
 * doesn't fit this device's budget, so nothing is offered or downloaded.
 */
export function pickVariant(
  family: ModelFamily,
  support: Extract<Support, { ok: true }>,
): ModelVariant | undefined {
  const variant = support.shaderF16 ? family.f16 : family.f32;
  return variant.vramMB <= support.memoryBudgetMB ? variant : undefined;
}

// ── Worker API (Comlink) ────────────────────────────────────────────────────

export interface LoadProgress {
  progress: number;
  text: string;
}

export interface LoadResult {
  ms: number;
  fromCache: boolean;
}

export interface RunResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  /** WebLLM's own measure: request received to first token (mostly prefill). */
  firstTokenMs: number;
  /** Request received to full answer, in the worker. */
  totalMs: number;
  decodeTokensPerSecond: number;
  /** "length" means the answer hit `maxTokens` and was cut off. */
  finishReason: string;
}

/** What `llm.worker.ts` exposes. */
export interface LlmWorkerApi {
  load(
    record: ModelRecord,
    thinking: boolean,
    onProgress: (p: LoadProgress) => void,
  ): Promise<LoadResult>;
  run(job: ChatJob): Promise<RunResult>;
  /** Stops the generation in progress; its `run` then settles early. */
  interrupt(): Promise<void>;
  remove(record: ModelRecord): Promise<void>;
  /** The worker's JS heap where the browser reports it (Chromium), else undefined. */
  heapBytes(): Promise<number | undefined>;
}

export interface WorkerConnection {
  api: Remote<LlmWorkerApi>;
  terminate(): void;
  /** An uncaught error in the worker (e.g. an allocation failure outside a call). */
  onCrash(listener: (error: Error) => void): () => void;
}

function connectWorker(): WorkerConnection {
  const worker = new Worker(new URL('../../workers/llm.worker.ts', import.meta.url), {
    type: 'module',
  });
  return {
    api: wrap<LlmWorkerApi>(worker),
    terminate: () => worker.terminate(),
    onCrash(listener) {
      const onError = (event: ErrorEvent) =>
        listener(new Error(event.message || 'The on-device model stopped'));
      worker.addEventListener('error', onError);
      return () => worker.removeEventListener('error', onError);
    },
  };
}

// ── Client ──────────────────────────────────────────────────────────────────

export type LoadEvent = ({ type: 'progress' } & LoadProgress) | ({ type: 'loaded' } & LoadResult);

/**
 * What screens read. Nothing waits on the model: a caller uses it only when `ready` and otherwise
 * carries on with the curator. `unavailable` is sticky: `start` won't try again and `dispose`
 * doesn't clear it; only an explicit `load` (a user action) does, so a failing device never loops.
 * Reasons include `crashed_last_time` (the page died during the last attempt) and
 * `disabled_after_crashes` (it died twice with this model: `load` refuses until `resetCrashes`).
 */
export type LlmStatus =
  | { state: 'off' }
  | { state: 'loading'; progress: number }
  | { state: 'ready'; modelId: string }
  | { state: 'unavailable'; reason: string };

/** What the user agreed to download, as the consent prompt stated it; `load` refuses anything else. */
export interface DownloadConsent {
  modelId: string;
  bytes: number;
}

/** A stuck GPU or a lost device must not hang the caller. */
export const RUN_TIMEOUT_MS = 120_000;
/** A whole download and compile; generous for a slow connection, but never unbounded. */
export const LOAD_TIMEOUT_MS = 20 * 60_000;
const HEAP_TIMEOUT_MS = 2000;
/** An unused model gives its memory back after this long (kept warm in between). */
export const IDLE_MS = 5 * 60_000;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface LlmClient {
  readonly status$: Observable<LlmStatus>;
  /** The attempt the last visit died during, if any (see `crashGuard.ts`). */
  readonly previousCrash: PreviousCrash | undefined;
  crashes(modelId: string): number;
  /** The user's explicit "let this model try again" after two crashes. */
  resetCrashes(modelId: string): void;
  status(): LlmStatus;
  /** First need: starts loading in the background if the model is off; never waits, never retries. */
  start(family: ModelFamily, variant: ModelVariant, consent: DownloadConsent): void;
  /** Downloads (first time) and compiles the model in a fresh worker; unsubscribing before `loaded` cancels it. */
  load(family: ModelFamily, variant: ModelVariant, consent: DownloadConsent): Observable<LoadEvent>;
  /**
   * One answer, only when `ready` (otherwise an immediate error, never a wait); unsubscribing early
   * interrupts the generation (D35 teardown). WebLLM answers one request at a time: run jobs one
   * after another.
   */
  run(job: ChatJob): Observable<RunResult>;
  /** Deletes the downloaded files from the Cache API (nothing is fetched if none are there). */
  remove(variant: ModelVariant): Promise<void>;
  heapBytes(): Promise<number | undefined>;
  /** Terminates the worker, which frees its memory; status goes `off`. */
  dispose(): void;
}

/**
 * Comlink carries the calls; this adds only what it doesn't do: timeouts, a crash listener, the
 * status stream, and terminating the worker on any failure (no automatic retry), so a failed
 * allocation can't linger.
 */
export function createLlmClient(
  connect: () => WorkerConnection = connectWorker,
  idleMs = IDLE_MS,
  guard: CrashGuard = createCrashGuard(),
): LlmClient {
  let connection: WorkerConnection | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const previousCrash = guard.takePreviousCrash();
  const status$ = new BehaviorSubject<LlmStatus>(
    previousCrash
      ? {
          state: 'unavailable',
          reason: guard.isDisabled(previousCrash.modelId)
            ? 'disabled_after_crashes'
            : 'crashed_last_time',
        }
      : { state: 'off' },
  );
  // Closing or leaving the page normally is not a crash.
  globalThis.addEventListener?.('pagehide', () => guard.end());
  /** Calls in flight: a terminated worker never answers them, so `dispose` ends them. */
  const pending = new Set<(error: Error, byDispose: boolean) => void>();

  const dispose = () => {
    clearTimeout(idleTimer);
    connection?.terminate();
    connection = undefined;
    const { state } = status$.value;
    if (state === 'loading' || state === 'ready') status$.next({ state: 'off' });
    for (const fail of [...pending]) fail(new Error('The on-device model was unloaded'), true);
  };
  const restartIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(dispose, idleMs);
  };

  function call<T>(
    work: (api: Remote<LlmWorkerApi>) => Promise<T>,
    timeoutMs: number,
    onCancel: (api: Remote<LlmWorkerApi>) => void,
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      const current = connection;
      if (!current) {
        subscriber.error(new Error('No model loaded'));
        return;
      }
      let settled = false;
      const fail = (error: unknown, byDispose = false) => {
        if (settled) return;
        settled = true;
        pending.delete(fail);
        if (!byDispose) {
          dispose();
          status$.next({ state: 'unavailable', reason: errorMessage(error) });
        }
        subscriber.error(error instanceof Error ? error : new Error(String(error)));
      };
      pending.add(fail);
      const stopListening = current.onCrash(fail);
      const timer = setTimeout(
        () => fail(new Error('The on-device model did not answer in time')),
        timeoutMs,
      );
      work(current.api).then((value) => {
        if (settled) return;
        settled = true;
        pending.delete(fail);
        subscriber.next(value);
        subscriber.complete();
      }, fail);
      return () => {
        clearTimeout(timer);
        stopListening();
        pending.delete(fail);
        if (!settled) onCancel(current.api);
      };
    });
  }

  function load(
    family: ModelFamily,
    variant: ModelVariant,
    consent: DownloadConsent,
  ): Observable<LoadEvent> {
    if (consent.modelId !== variant.modelId || consent.bytes !== variant.downloadBytes) {
      return throwError(() => new Error('No consent for this download'));
    }
    if (guard.isDisabled(variant.modelId)) {
      return throwError(
        () => new Error('This model stopped the page twice on this device; reset it to try again'),
      );
    }
    return new Observable<LoadEvent>((subscriber) => {
      dispose(); // one model at a time
      guard.begin(variant.modelId, 'load');
      connection = connect();
      status$.next({ state: 'loading', progress: 0 });
      const onProgress = proxy((p: LoadProgress) => {
        // Progress has its own channel and can land after the load result: never undo `ready`.
        if (status$.value.state !== 'loading') return;
        status$.next({ state: 'loading', progress: p.progress });
        subscriber.next({ type: 'progress', ...p });
      });
      // Terminating is the only way to stop a download WebLLM has started.
      return call(
        (api) => api.load(variant.record, family.thinking, onProgress),
        LOAD_TIMEOUT_MS,
        dispose,
      )
        .pipe(finalize(() => guard.end()))
        .subscribe({
          next: (result) => {
            status$.next({ state: 'ready', modelId: variant.modelId });
            restartIdleTimer();
            subscriber.next({ type: 'loaded', ...result });
            subscriber.complete();
          },
          error: (error: unknown) => subscriber.error(error),
        });
    });
  }

  return {
    status$: status$.asObservable(),
    status: () => status$.value,
    previousCrash,
    crashes: (modelId) => guard.crashes(modelId),
    resetCrashes: (modelId) => guard.reset(modelId),
    start(family, variant, consent) {
      if (status$.value.state !== 'off') return;
      // Failures land in `status$`; nothing else needs the error.
      load(family, variant, consent).subscribe({ error: () => undefined });
    },
    load,
    run(job) {
      return defer(() => {
        const status = status$.value;
        if (status.state !== 'ready') return throwError(() => new Error('Model not ready'));
        clearTimeout(idleTimer);
        guard.begin(status.modelId, 'run');
        return call(
          (api) => api.run(job),
          RUN_TIMEOUT_MS,
          (api) => void api.interrupt().catch(() => undefined),
        ).pipe(finalize(() => guard.end()));
      }).pipe(
        finalize(() => {
          if (status$.value.state === 'ready') restartIdleTimer();
        }),
      );
    },
    async remove(variant) {
      dispose();
      connection = connect();
      try {
        await new Promise<void>((resolve, reject) =>
          call(
            (api) => api.remove(variant.record),
            RUN_TIMEOUT_MS,
            () => {},
          ).subscribe({
            complete: resolve,
            error: reject,
          }),
        );
      } finally {
        dispose();
      }
    },
    async heapBytes() {
      if (!connection) return undefined;
      const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, HEAP_TIMEOUT_MS));
      return Promise.race([connection.api.heapBytes().catch(() => undefined), timeout]);
    },
    dispose,
  };
}
