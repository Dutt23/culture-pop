import { useId, useState } from 'react';
import { useVoiceInput, VOICE_MESSAGES } from '../../features/search/useVoiceInput';
import { SearchIcon } from '../ui/icons';
import styles from './SearchBar.module.css';
import { VoiceButton } from './VoiceButton';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  autoFocus?: boolean;
}

const SEARCH_LABEL = 'Search references';

export function SearchBar({ value, onChange, onSubmit, autoFocus = false }: SearchBarProps) {
  const inputId = useId();
  const hintId = useId();
  // Words heard so far show in the box without searching on every word; the search runs once
  // listening ends, and the reader can still edit what was heard (slang and names get misheard).
  const [heard, setHeard] = useState<string | null>(null);
  const voice = useVoiceInput({
    onInterim: setHeard,
    onFinal: (text) => {
      setHeard(null);
      onChange(text);
      onSubmit?.(text);
    },
  });
  const listening = voice.listening;
  const shown = listening && heard !== null ? heard : value;

  return (
    <form
      role="search"
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        voice.cancel();
        setHeard(null);
        onSubmit?.(value);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {SEARCH_LABEL}
      </label>
      <div className={styles.field}>
        <SearchIcon />
        <input
          id={inputId}
          className={styles.input}
          type="search"
          value={shown}
          onChange={(event) => {
            if (listening || voice.error) voice.cancel();
            setHeard(null);
            onChange(event.target.value);
          }}
          placeholder={listening ? 'Listening…' : 'Quote, meme or show…'}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          aria-describedby={listening ? hintId : undefined}
        />
        {voice.supported && (
          <VoiceButton
            listening={listening}
            onToggle={() => {
              if (!listening) setHeard(null);
              voice.toggle();
            }}
          />
        )}
        <button type="submit" className={styles.submit}>
          Decode
        </button>
      </div>
      {voice.supported && (
        <>
          {/* Always in the page, so screen readers announce what changes inside it. */}
          <p className={voice.error ? styles.voiceError : styles.voiceStatus} role="status">
            {listening
              ? 'Listening… speak now. Tap the voice button again to stop.'
              : voice.error && VOICE_MESSAGES[voice.error]}
          </p>
          {listening && (
            <p id={hintId} className={styles.voiceHint}>
              Your browser’s speech service (Google in Chrome, Apple in Safari) turns what you say
              into text. Our server never hears it.
            </p>
          )}
        </>
      )}
    </form>
  );
}
