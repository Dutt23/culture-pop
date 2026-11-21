import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Speak a search instead of typing it, with the browser's own speech recognition (Web Speech API).
 * The browser's speech provider (Google in Chrome, Apple in Safari) turns the audio into text; no
 * audio or text from here goes to our server. Where the API is missing (Firefox), `supported` is
 * false and the caller hides the button.
 */

/** The parts of the Web Speech API used here; TypeScript's DOM types don't ship it. */
interface SpeechAlternative {
  readonly transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}
export interface SpeechResultEvent {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}
export interface SpeechErrorEvent {
  readonly error: string;
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

/** What went wrong, in the reader's terms. Each has its own message in `VOICE_MESSAGES`. */
export type VoiceError = 'blocked' | 'no-mic' | 'no-speech' | 'unavailable' | 'unsupported';

export const VOICE_MESSAGES: Record<VoiceError, string> = {
  blocked:
    'The microphone is blocked for this site. To allow it, tap the icon next to the web address and turn Microphone on. On iPhone, also check Settings › Safari (or Settings › Screen Time) › Microphone. Or type your search.',
  'no-mic': 'No microphone was found. Connect one, or type your search.',
  'no-speech': 'Didn’t hear anything. Tap the voice button and try again, or type your search.',
  unavailable:
    'Voice search isn’t available right now: your browser’s speech service couldn’t be reached. Check your connection and try again, or type your search.',
  unsupported: 'This browser can’t turn speech into text. Type your search instead.',
};

/** Web Speech error codes → what the reader is told. `aborted` is ours (cancel), so it says nothing. */
const ERROR_CODES: Record<string, VoiceError | null> = {
  'not-allowed': 'blocked',
  'audio-capture': 'no-mic',
  'no-speech': 'no-speech',
  network: 'unavailable',
  'service-not-allowed': 'unavailable',
  'language-not-supported': 'unavailable',
  'bad-grammar': 'unavailable',
  aborted: null,
};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

/** True when this browser can turn speech into text. */
export function isVoiceSupported(): boolean {
  return recognitionCtor() !== null;
}

/**
 * The language to listen in. The app is written in English, so the browser's own locale is used
 * when it is an English one (en-IN, en-GB… hear accents and local names better); otherwise the
 * app's language, so a French or Hindi browser still hears English titles as English words.
 */
export function pickSpeechLang(appLang: string, browserLangs: readonly string[]): string {
  const app = appLang.trim() || 'en';
  const base = app.split('-')[0].toLowerCase();
  const match = browserLangs.find((lang) => lang.split('-')[0].toLowerCase() === base);
  return match ?? app;
}

function currentSpeechLang(): string {
  const appLang = typeof document === 'undefined' ? 'en' : document.documentElement.lang;
  const browserLangs =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return pickSpeechLang(appLang, browserLangs.filter(Boolean));
}

/** Everything heard so far: finals first, then whatever is still being decided. */
function transcriptOf(event: SpeechResultEvent): { text: string; isFinal: boolean } {
  let text = '';
  let isFinal = true;
  for (let i = 0; i < event.results.length; i += 1) {
    const result = event.results[i];
    text += result[0]?.transcript ?? '';
    if (!result.isFinal) isFinal = false;
  }
  return { text: text.replace(/\s+/g, ' ').trim(), isFinal };
}

interface VoiceInputOptions {
  /** Words heard so far, while listening. */
  onInterim: (text: string) => void;
  /** What was said, once listening ends with something heard. */
  onFinal: (text: string) => void;
}

export interface VoiceInput {
  supported: boolean;
  listening: boolean;
  error: VoiceError | null;
  /** Start listening, or stop early (keeping what was heard). */
  toggle: () => void;
  /** Stop without using what was heard and clear any message, e.g. when the reader types. */
  cancel: () => void;
}

export function useVoiceInput({ onInterim, onFinal }: VoiceInputOptions): VoiceInput {
  const [supported] = useState(isVoiceSupported);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<VoiceError | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbacks = useRef({ onInterim, onFinal });
  useEffect(() => {
    callbacks.current = { onInterim, onFinal };
  });

  /** Drop the engine without using its result: handlers off first, so nothing fires late. */
  const cancel = useCallback(() => {
    setError(null);
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognitionRef.current = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError('unsupported');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = currentSpeechLang();
    recognition.continuous = false; // ends on its own after a pause
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let heard = '';
    let failed = false;
    recognition.onresult = (event) => {
      heard = transcriptOf(event).text;
      callbacks.current.onInterim(heard);
    };
    recognition.onerror = (event) => {
      const code = event.error in ERROR_CODES ? ERROR_CODES[event.error] : 'unavailable';
      if (code === null) return;
      failed = true;
      setError(code);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setListening(false);
      if (failed) return;
      // Safari can end quietly without a "no-speech" error, and a second tap may end before the
      // last words are marked final: use whatever was heard.
      if (heard) callbacks.current.onFinal(heard);
      else setError('no-speech');
    };

    recognitionRef.current = recognition;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError('unavailable');
    }
  }, []);

  const toggle = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    else start();
  }, [start]);

  // Stop listening when the tab is hidden (switching apps, locking the phone) and on unmount.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancel();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cancel();
    };
  }, [cancel]);

  return { supported, listening, error, toggle, cancel };
}
