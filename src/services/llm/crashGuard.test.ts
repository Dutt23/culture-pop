import type { Remote } from 'comlink';
import { firstValueFrom, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { LlmWorkerApi, WorkerConnection } from './client';
import { createLlmClient } from './client';
import { createCrashGuard, type CrashStore } from './crashGuard';
import { MODEL_FAMILIES } from './models';

/** Stands in for `localStorage`, which survives the "crash" between two clients. */
function memoryStore(): CrashStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const family = MODEL_FAMILIES[0]!;
const variant = family.f16;
const consent = { modelId: variant.modelId, bytes: variant.downloadBytes };
const job = { system: 's', user: 'u', schema: {}, maxTokens: 10 };

function connection(api: Partial<LlmWorkerApi>): WorkerConnection {
  return {
    api: api as unknown as Remote<LlmWorkerApi>,
    terminate: () => {},
    onCrash: () => () => {},
  };
}

const loads: LlmWorkerApi['load'] = async () => ({ ms: 1, fromCache: true });
const runs: LlmWorkerApi['run'] = async () => ({
  text: '{}',
  promptTokens: 1,
  completionTokens: 1,
  firstTokenMs: 1,
  totalMs: 1,
  decodeTokensPerSecond: 1,
  finishReason: 'stop',
});

describe('crash guard', () => {
  it('writes a marker before a load and a run, and clears it when they finish', async () => {
    const store = memoryStore();
    let seenDuringLoad: string | undefined;
    const client = createLlmClient(
      () =>
        connection({
          load: async (...args) => {
            seenDuringLoad = store.data.get('pcd.llm.attempt');
            return loads(...args);
          },
          run: runs,
        }),
      1000,
      createCrashGuard(store),
    );
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    expect(JSON.parse(seenDuringLoad ?? '{}')).toMatchObject({
      modelId: variant.modelId,
      phase: 'load',
    });
    expect(store.data.has('pcd.llm.attempt')).toBe(false);
    await firstValueFrom(client.run(job));
    expect(store.data.has('pcd.llm.attempt')).toBe(false);
    client.dispose();
  });

  it('after a crash, the next visit is unavailable and does not load by itself', () => {
    const store = memoryStore();
    createCrashGuard(store).begin(variant.modelId, 'run'); // the page died here
    let connects = 0;
    const client = createLlmClient(
      () => {
        connects++;
        return connection({ load: loads });
      },
      1000,
      createCrashGuard(store),
    );
    expect(client.status()).toEqual({ state: 'unavailable', reason: 'crashed_last_time' });
    expect(client.previousCrash).toMatchObject({
      modelId: variant.modelId,
      phase: 'run',
      crashes: 1,
    });
    client.start(family, variant, consent);
    expect(connects).toBe(0);
  });

  it('allows an explicit retry after one crash', async () => {
    const store = memoryStore();
    createCrashGuard(store).begin(variant.modelId, 'load');
    const client = createLlmClient(
      () => connection({ load: loads }),
      1000,
      createCrashGuard(store),
    );
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    expect(client.status()).toEqual({ state: 'ready', modelId: variant.modelId });
    client.dispose();
  });

  it('keeps a model off after its second crash until the user resets it', async () => {
    const store = memoryStore();
    for (let visit = 0; visit < 2; visit++) {
      createCrashGuard(store).takePreviousCrash();
      createCrashGuard(store).begin(variant.modelId, 'load');
    }
    const client = createLlmClient(
      () => connection({ load: loads }),
      1000,
      createCrashGuard(store),
    );
    expect(client.status()).toEqual({ state: 'unavailable', reason: 'disabled_after_crashes' });
    expect(client.crashes(variant.modelId)).toBe(2);
    await expect(firstValueFrom(client.load(family, variant, consent))).rejects.toThrow(
      'stopped the page twice',
    );
    client.resetCrashes(variant.modelId);
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    expect(client.status().state).toBe('ready');
    client.dispose();
  });

  it('degrades to no crash memory when storage is blocked', () => {
    const blocked: CrashStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const guard = createCrashGuard(blocked);
    expect(() => guard.begin('m', 'load')).not.toThrow();
    expect(guard.takePreviousCrash()).toBeUndefined();
    expect(guard.isDisabled('m')).toBe(false);
  });
});
