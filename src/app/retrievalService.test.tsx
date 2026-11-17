import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { unusedRetrievalService } from '../test/fakeRetrieval';
import { RetrievalProvider } from './RetrievalContext';
import { useRetrievalService } from './retrievalService';

describe('useRetrievalService', () => {
  it('uses an injected service', () => {
    const injected = unusedRetrievalService();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RetrievalProvider service={injected}>{children}</RetrievalProvider>
    );
    expect(renderHook(useRetrievalService, { wrapper }).result.current).toBe(injected);
  });

  it('builds the live service once and shares it, so the session cache survives screens', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RetrievalProvider>{children}</RetrievalProvider>
    );
    const first = renderHook(useRetrievalService, { wrapper }).result.current;
    const second = renderHook(useRetrievalService).result.current;
    expect(first.webSearch).toBeDefined();
    expect(second).toBe(first);
  });
});
