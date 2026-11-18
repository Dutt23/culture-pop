import { useMemo, useState } from 'react';
import { flagSources, type FlagReason } from '../../../api/_lib/cardCurate.js';
import {
  type DraftRequestBody,
  type DraftSourceInput,
  LIMITS,
  type ToneCard,
} from '../../../api/_lib/cardTypes.js';
import type { Frame } from './frames';

const cut = (s: string, n: number) => Array.from(s).slice(0, n).join('');

const toSource = (f: Frame): DraftSourceInput => ({
  kind: f.kind,
  from: f.from,
  title: cut(f.title, LIMITS.itemChars),
  text: cut(f.text ?? f.line, LIMITS.itemChars),
  ...(f.kind === 'web' ? { url: f.url } : {}),
});

const cutTone = (t: ToneCard): ToneCard => ({
  label: cut(t.label, LIMITS.toneFieldChars),
  gist: cut(t.gist, LIMITS.toneFieldChars),
  means: cut(t.means, LIMITS.toneFieldChars),
  reply: cut(t.reply, LIMITS.toneFieldChars),
  summary: cut(t.summary, LIMITS.toneFieldChars),
});

export function useCurationTray(search: string) {
  const [picked, setPicked] = useState<Frame[]>([]);
  const [tones, setTones] = useState<ToneCard[]>([]);
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());

  const flags = useMemo(() => {
    const list = flagSources(picked.map(toSource), search);
    return Object.fromEntries(picked.map((f, i) => [f.key, list[i]])) as Record<
      string,
      FlagReason | null
    >;
  }, [picked, search]);

  const toggleFrame = (frame: Frame): 'added' | 'removed' | 'limit_total' | 'limit_web' => {
    if (picked.some((f) => f.key === frame.key)) {
      setPicked(picked.filter((f) => f.key !== frame.key));
      setKept((k) => new Set([...k].filter((key) => key !== frame.key)));
      return 'removed';
    }
    if (picked.length >= LIMITS.sources) return 'limit_total';
    const webCount = picked.filter((f) => f.kind === 'web').length;
    if (frame.kind === 'web' && webCount >= LIMITS.webSources) return 'limit_web';
    setPicked([...picked, frame]);
    return 'added';
  };

  const toggleTone = (card: ToneCard): 'added' | 'removed' | 'limit' => {
    if (tones.some((t) => t.label === card.label)) {
      setTones(tones.filter((t) => t.label !== card.label));
      return 'removed';
    }
    if (tones.length >= LIMITS.tones) return 'limit';
    setTones([...tones, cutTone(card)]);
    return 'added';
  };

  const keepFlagged = (key: string) => setKept((k) => new Set(k).add(key));

  const body = (about?: string[]): DraftRequestBody => ({
    search: cut(search, LIMITS.searchChars),
    ...(about?.length ? { about } : {}),
    sources: picked.map(toSource),
    ...(tones.length ? { tones } : {}),
  });

  const canMake = picked.length > 0 && picked.every((f) => !flags[f.key] || kept.has(f.key));

  return { picked, tones, flags, toggleFrame, toggleTone, keepFlagged, body, canMake };
}
