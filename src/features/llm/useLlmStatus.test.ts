import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLlmClient, type WorkerConnection } from '../../services/llm/client';
import { MODEL_FAMILIES } from '../../services/llm/models';
import { useLlmStatus } from './useLlmStatus';

// The crash guard keeps its marker in localStorage; every test starts without one.
beforeEach(() => localStorage.clear());

describe('useLlmStatus', () => {
  it('follows the client status, so a screen can show the AI part only when ready', async () => {
    const family = MODEL_FAMILIES[0]!;
    const variant = family.f16;
    let finishLoad: () => void = () => {};
    const connection = {
      api: {
        load: () =>
          new Promise((resolve) => (finishLoad = () => resolve({ ms: 1, fromCache: true }))),
      },
      terminate: () => {},
      onCrash: () => () => {},
    } as unknown as WorkerConnection;
    const client = createLlmClient(() => connection);
    const { result } = renderHook(() => useLlmStatus(client));
    expect(result.current).toEqual({ state: 'off' });
    act(() =>
      client.start(family, variant, { modelId: variant.modelId, bytes: variant.downloadBytes }),
    );
    expect(result.current).toEqual({ state: 'loading', progress: 0 });
    await act(async () => finishLoad());
    expect(result.current).toEqual({ state: 'ready', modelId: variant.modelId });
    act(() => client.dispose());
    expect(result.current).toEqual({ state: 'off' });
  });
});
