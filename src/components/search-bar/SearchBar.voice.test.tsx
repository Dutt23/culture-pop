import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SpeechErrorEvent,
  SpeechRecognitionLike,
  SpeechResultEvent,
} from '../../features/search/useVoiceInput';
import { SearchBar } from './SearchBar';

/** A stand-in for the browser's speech engine: the test says what it "hears". */
class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((event: SpeechResultEvent) => void) | null = null;
  onerror: ((event: SpeechErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;

  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
  abort() {
    this.aborted = true;
  }

  hear(words: string[], isFinal: boolean) {
    const results = words.map((transcript) =>
      Object.assign([{ transcript }], { isFinal, length: 1 }),
    );
    this.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: results.length }) });
  }
  fail(error: string) {
    this.onerror?.({ error });
    this.onend?.();
  }
  end() {
    this.onend?.();
  }
}

const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];
const micButton = () => screen.queryByRole('button', { name: 'Search by voice' });
const searchBox = () => screen.getByRole('searchbox', { name: 'Search references' });

function Harness({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <SearchBar value={value} onChange={setValue} onSubmit={onSubmit} />;
}

function installSpeech(key: 'SpeechRecognition' | 'webkitSpeechRecognition' = 'SpeechRecognition') {
  Object.defineProperty(window, key, { configurable: true, writable: true, value: FakeRecognition });
}

function removeSpeech() {
  for (const key of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    Reflect.deleteProperty(window, key);
  }
}

beforeEach(() => {
  FakeRecognition.instances = [];
});
afterEach(removeSpeech);

describe('SearchBar voice search', () => {
  it('hides the microphone where the browser has no speech recognition', () => {
    removeSpeech();
    render(<Harness onSubmit={vi.fn()} />);
    expect(micButton()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decode' })).toBeInTheDocument();
  });

  it('shows the microphone with the prefixed Chrome/Safari engine', () => {
    installSpeech('webkitSpeechRecognition');
    render(<Harness onSubmit={vi.fn()} />);
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('listens on tap, shows words as they come, then fills the box and searches', async () => {
    installSpeech();
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(micButton()!);
    const engine = latest();
    expect(engine.started).toBe(true);
    expect(engine.interimResults).toBe(true);
    expect(engine.continuous).toBe(false);
    expect(micButton()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/Listening/);

    act(() => engine.hear(['hakuna'], false));
    expect(searchBox()).toHaveValue('hakuna');
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => engine.hear(['hakuna matata'], true));
    act(() => engine.end());
    expect(searchBox()).toHaveValue('hakuna matata');
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('hakuna matata');
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    // What was heard stays editable, like typed text.
    await user.type(searchBox(), ' song');
    expect(searchBox()).toHaveValue('hakuna matata song');
  });

  it('a second tap stops listening and keeps what was heard', async () => {
    installSpeech();
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(micButton()!);
    act(() => latest().hear(['no cap'], false));
    await user.click(micButton()!);
    expect(latest().stopped).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith('no cap');
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('works from the keyboard', async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    micButton()!.focus();
    await user.keyboard('{Enter}');
    expect(micButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['not-allowed', /microphone is blocked.*allow it/i],
    ['audio-capture', /No microphone was found/],
    ['no-speech', /Didn’t hear anything/],
    ['network', /speech service couldn’t be reached/],
    ['service-not-allowed', /speech service couldn’t be reached/],
  ])('explains the %s error in plain words', async (code, message) => {
    installSpeech();
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(micButton()!);
    act(() => latest().fail(code));
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
    expect(onSubmit).not.toHaveBeenCalled();

    // Typing clears the message.
    await user.type(searchBox(), 'r');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('says nothing was heard when listening ends empty without an error (Safari)', async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    await user.click(micButton()!);
    act(() => latest().end());
    expect(screen.getByRole('status')).toHaveTextContent(/Didn’t hear anything/);
  });

  it('says voice is unavailable when the engine refuses to start', async () => {
    installSpeech();
    vi.spyOn(FakeRecognition.prototype, 'start').mockImplementationOnce(() => {
      throw new Error('InvalidStateError');
    });
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    await user.click(micButton()!);
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent(/speech service couldn’t be reached/);
  });

  it('typing while listening stops listening and edits what was heard without searching', async () => {
    installSpeech();
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(micButton()!);
    act(() => latest().hear(['eat tea'], false));
    await user.type(searchBox(), 'm');
    expect(latest().aborted).toBe(true);
    expect(latest().onend).toBeNull();
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
    expect(searchBox()).toHaveValue('eat team');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('stops listening and lets go of the engine on unmount', async () => {
    installSpeech();
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { unmount } = render(<Harness onSubmit={onSubmit} />);
    await user.click(micButton()!);
    const engine = latest();
    unmount();
    expect(engine.aborted).toBe(true);
    expect(engine.onresult).toBeNull();
    expect(engine.onerror).toBeNull();
    expect(engine.onend).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('stops listening when the tab is hidden', async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    await user.click(micButton()!);
    const engine = latest();

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Reflect.deleteProperty(document, 'visibilityState');
    expect(engine.aborted).toBe(true);
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
  });
});
