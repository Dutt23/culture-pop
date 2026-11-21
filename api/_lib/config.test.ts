// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { loadConfig, readModel } from './config.js';

const quiet = () => vi.fn<(message: string) => void>();

describe('loadConfig', () => {
  it("keeps today's values when no env var is set, without warnings", () => {
    const warn = quiet();
    const config = loadConfig({}, warn);
    expect(config.wiki).toMatchObject({ timeoutMs: 4_000, maxBytes: 512 * 1024, maxTitles: 20 });
    expect(config.wiki.url).toBe('https://en.wikipedia.org/w/api.php');
    expect(config.providers).toMatchObject({
      openAiUrl: 'https://api.openai.com/v1/responses',
      openAiModel: 'gpt-6-luna',
      maxOutputTokens: 800,
      maxTopicOutputTokens: 1_600,
      fallbackAfterMs: 11_000,
    });
    expect(config.search).toMatchObject({
      maxResults: 10,
      maxRequestBytes: 2_048,
      timeoutMs: 8_000,
    });
    expect(config.draft).toMatchObject({ maxRequestBytes: 80 * 1024, deadlineMs: 23_000 });
    expect(config.supabase.timeoutMs).toBe(10_000);
    expect(warn).not.toHaveBeenCalled();
  });

  it('uses a valid override', () => {
    const warn = quiet();
    const config = loadConfig(
      {
        PCD_WIKI_TIMEOUT_MS: ' 2500 ',
        PCD_DRAFT_DEADLINE_MS: '20000',
        PCD_SEARCH_URL: 'https://search.example.test/v1',
        PCD_WIKI_USER_AGENT: 'TestAgent/1.0',
      },
      warn,
    );
    expect(config.wiki.timeoutMs).toBe(2_500);
    expect(config.draft.deadlineMs).toBe(20_000);
    expect(config.search.url).toBe('https://search.example.test/v1');
    expect(config.wiki.userAgent).toBe('TestAgent/1.0');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the default for a non-integer, naming only the variable', () => {
    for (const bad of ['abc', '1.5', '4e3', 'NaN', 'Infinity', '9007199254740993']) {
      const warn = quiet();
      expect(loadConfig({ PCD_WIKI_TIMEOUT_MS: bad }, warn).wiki.timeoutMs).toBe(4_000);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('PCD_WIKI_TIMEOUT_MS');
      expect(warn.mock.calls[0]?.[0]).not.toContain(bad);
    }
  });

  it('refuses an out-of-bounds size cap, so no env value makes it unlimited', () => {
    const warn = quiet();
    const config = loadConfig(
      {
        PCD_DRAFT_MAX_REQUEST_BYTES: String(1024 ** 3),
        PCD_SEARCH_MAX_REQUEST_BYTES: '0',
        PCD_DRAFT_DEADLINE_MS: '60000',
      },
      warn,
    );
    expect(config.draft.maxRequestBytes).toBe(80 * 1024);
    expect(config.search.maxRequestBytes).toBe(2_048);
    expect(config.draft.deadlineMs).toBe(23_000);
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('accepts the bounds themselves', () => {
    const config = loadConfig(
      { PCD_WIKI_MAX_TITLES: '1', PCD_FALLBACK_AFTER_MS: '22000' },
      quiet(),
    );
    expect(config.wiki.maxTitles).toBe(1);
    expect(config.providers.fallbackAfterMs).toBe(22_000);
  });

  it('refuses a URL that is not https or carries credentials', () => {
    for (const bad of [
      'http://api.openai.com/v1/responses',
      'not a url',
      'https://user:pw@evil.test/',
    ]) {
      const warn = quiet();
      expect(loadConfig({ PCD_OPENAI_URL: bad }, warn).providers.openAiUrl).toBe(
        'https://api.openai.com/v1/responses',
      );
      expect(warn.mock.calls[0]?.[0]).not.toContain(bad);
    }
  });

  it('refuses a user agent that could break the header', () => {
    const warn = quiet();
    expect(loadConfig({ PCD_WIKI_USER_AGENT: 'A\r\nX-Evil: 1' }, warn).wiki.userAgent).toBe(
      'PopCultureDecoder/0.2 (https://culture-pop.vercel.app)',
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('readModel', () => {
  it('returns a model id, and undefined when unset or malformed', () => {
    const warn = quiet();
    expect(readModel({ M: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' }, 'M', warn)).toBe(
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    );
    expect(readModel({}, 'M', warn)).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    expect(readModel({ M: 'gpt 6; drop' }, 'M', warn)).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
