/**
 * Remembers a model attempt across reloads. A tab killed by running out of memory, or by losing
 * the GPU device during warm-up (web-llm #836, Adreno), runs no error handler, so the attempt is
 * written down before it starts and cleared when it settles or the page is closed normally
 * (`pagehide`). A marker still there on the next visit means the page crashed during it.
 */

/** `localStorage`, written synchronously, so the marker exists even if the next line crashes. */
export type CrashStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type AttemptPhase = 'load' | 'run';

export interface Attempt {
  modelId: string;
  phase: AttemptPhase;
  at: string;
}

export interface PreviousCrash extends Attempt {
  /** Crashes recorded for this model so far, this one included. */
  crashes: number;
}

/** Two crashes for the same model keep it off until the user resets it. */
export const MAX_CRASHES = 2;
const ATTEMPT_KEY = 'pcd.llm.attempt';
const CRASHES_KEY = 'pcd.llm.crashes';

export interface CrashGuard {
  begin(modelId: string, phase: AttemptPhase): void;
  end(): void;
  /** Reads (once) and clears a marker left by the last visit, counting it as a crash. */
  takePreviousCrash(): PreviousCrash | undefined;
  crashes(modelId: string): number;
  isDisabled(modelId: string): boolean;
  reset(modelId: string): void;
}

function browserStore(): CrashStore | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // Blocked storage (private mode, policies): no crash memory, nothing breaks.
  }
}

export function createCrashGuard(
  store: CrashStore | undefined = browserStore(),
  now: () => string = () => new Date().toISOString(),
): CrashGuard {
  const read = <T>(key: string): T | undefined => {
    try {
      const raw = store?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  };
  const write = (key: string, value: unknown) => {
    try {
      store?.setItem(key, JSON.stringify(value));
    } catch {
      // Full or blocked storage: the guard degrades to in-memory handling only.
    }
  };
  const remove = (key: string) => {
    try {
      store?.removeItem(key);
    } catch {
      // As above.
    }
  };
  const counts = () => read<Record<string, number>>(CRASHES_KEY) ?? {};

  return {
    begin(modelId, phase) {
      write(ATTEMPT_KEY, { modelId, phase, at: now() } satisfies Attempt);
    },
    end() {
      remove(ATTEMPT_KEY);
    },
    takePreviousCrash() {
      const attempt = read<Attempt>(ATTEMPT_KEY);
      remove(ATTEMPT_KEY);
      if (!attempt || typeof attempt.modelId !== 'string') return undefined;
      const all = counts();
      const crashes = (all[attempt.modelId] ?? 0) + 1;
      write(CRASHES_KEY, { ...all, [attempt.modelId]: crashes });
      return { ...attempt, crashes };
    },
    crashes: (modelId) => counts()[modelId] ?? 0,
    isDisabled: (modelId) => (counts()[modelId] ?? 0) >= MAX_CRASHES,
    reset(modelId) {
      write(
        CRASHES_KEY,
        Object.fromEntries(Object.entries(counts()).filter(([id]) => id !== modelId)),
      );
    },
  };
}
