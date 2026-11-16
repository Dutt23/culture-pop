import { useCallback, useSyncExternalStore } from 'react';
import type { LlmClient, LlmStatus } from '../../services/llm/client';

/**
 * The on-device model's status for a screen: render the AI part only when `ready`, never wait for
 * it. Not used by any user-facing screen yet (D39: off until the phone benchmark passes).
 */
export function useLlmStatus(client: LlmClient): LlmStatus {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = client.status$.subscribe(onChange);
      return () => subscription.unsubscribe();
    },
    [client],
  );
  return useSyncExternalStore(subscribe, client.status);
}
