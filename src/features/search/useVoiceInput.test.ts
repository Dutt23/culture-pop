import { describe, expect, it } from 'vitest';
import { pickSpeechLang } from './useVoiceInput';

describe('pickSpeechLang', () => {
  it('uses the browser’s English variant, so local accents and names are heard better', () => {
    expect(pickSpeechLang('en', ['en-IN', 'hi-IN'])).toBe('en-IN');
    expect(pickSpeechLang('en', ['fr-FR', 'en-GB'])).toBe('en-GB');
  });

  it('keeps the app’s language when the browser has no English one', () => {
    expect(pickSpeechLang('en', ['hi-IN', 'fr-FR'])).toBe('en');
    expect(pickSpeechLang('en', [])).toBe('en');
  });

  it('falls back to English when the page has no language', () => {
    expect(pickSpeechLang('', ['de-DE'])).toBe('en');
  });
});
