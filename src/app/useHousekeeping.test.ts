import { describe, expect, it, vi } from 'vitest';
import { MAX_CACHED_ONLINE } from '../data/repositories/retrievalRepository';
import { runHousekeeping } from './useHousekeeping';

const NOW = Date.UTC(2026, 10, 21, 12);

function stubRepos() {
  return {
    curationJobs: { prune: vi.fn().mockResolvedValue(0) },
    retrieval: { pruneOnline: vi.fn().mockResolvedValue(0) },
    webResults: { sweepExpired: vi.fn().mockResolvedValue(0) },
  };
}
const asRepos = (repos: ReturnType<typeof stubRepos>) =>
  repos as unknown as Parameters<typeof runHousekeeping>[0];

describe('runHousekeeping', () => {
  it('runs all three prunes with the clock and the cache cap', async () => {
    const repos = stubRepos();
    await runHousekeeping(asRepos(repos), NOW);
    expect(repos.curationJobs.prune).toHaveBeenCalledWith(NOW);
    expect(repos.retrieval.pruneOnline).toHaveBeenCalledWith(MAX_CACHED_ONLINE);
    expect(repos.webResults.sweepExpired).toHaveBeenCalledWith(NOW);
  });

  it.each(['curationJobs', 'retrieval', 'webResults'] as const)(
    'still runs the others when %s rejects, and does not throw',
    async (failing) => {
      const repos = stubRepos();
      const boom = new Error('storage full');
      if (failing === 'curationJobs') repos.curationJobs.prune.mockRejectedValue(boom);
      if (failing === 'retrieval') repos.retrieval.pruneOnline.mockRejectedValue(boom);
      if (failing === 'webResults') repos.webResults.sweepExpired.mockRejectedValue(boom);

      await expect(runHousekeeping(asRepos(repos), NOW)).resolves.toBeUndefined();

      expect(repos.curationJobs.prune).toHaveBeenCalledTimes(1);
      expect(repos.retrieval.pruneOnline).toHaveBeenCalledTimes(1);
      expect(repos.webResults.sweepExpired).toHaveBeenCalledTimes(1);
    },
  );
});
