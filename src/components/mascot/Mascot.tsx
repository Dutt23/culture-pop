/**
 * The app's TV mascot (public/icon.svg) dressed as a character type. Original drawings of generic
 * costumes, never a real character's look.
 */
export type Costume = 'plain' | 'hero' | 'wizard' | 'villain' | 'royal' | 'outlaw' | 'meme';

const INK = '#0d0b1f';
const LIGHT = '#f3efff';
const PEACH = '#ffb27a';

export function Antennae() {
  return (
    <>
      <path d="M50 30 L40 14 M70 30 L82 12" stroke={LIGHT} strokeWidth="5" strokeLinecap="round" />
      <circle cx="40" cy="14" r="4.5" fill={PEACH} />
      <circle cx="82" cy="12" r="4.5" fill={PEACH} />
    </>
  );
}

export function Body() {
  return (
    <>
      <rect x="34" y="98" width="12" height="8" rx="4" fill="#6a3df0" />
      <rect x="74" y="98" width="12" height="8" rx="4" fill="#6a3df0" />
      <rect x="16" y="30" width="88" height="72" rx="20" fill="#6a3df0" />
      <rect x="24" y="38" width="72" height="56" rx="14" fill="#b29bff" />
      <circle cx="35" cy="76" r="5" fill="#e8604c" opacity="0.55" />
      <circle cx="85" cy="76" r="5" fill="#e8604c" opacity="0.55" />
    </>
  );
}

function Eyes() {
  return (
    <>
      <circle cx="46" cy="60" r="11" fill={LIGHT} />
      <circle cx="74" cy="60" r="11" fill={LIGHT} />
      <circle cx="49" cy="62" r="5" fill={INK} />
      <circle cx="71" cy="63" r="5" fill={INK} />
    </>
  );
}

export function Smile() {
  return (
    <path d="M44 78 q16 12 32 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
  );
}

function Outfit({ costume }: { costume: Costume }) {
  switch (costume) {
    case 'plain':
      return (
        <>
          <Eyes />
          <Smile />
        </>
      );
    case 'hero':
      return (
        <>
          <rect x="26" y="50" width="68" height="18" rx="9" fill={INK} />
          <circle cx="46" cy="59" r="6" fill={LIGHT} />
          <circle cx="74" cy="59" r="6" fill={LIGHT} />
          <Smile />
        </>
      );
    case 'wizard':
      return (
        <>
          <Eyes />
          <Smile />
          <path d="M60 -12 L28 34 L92 34 Z" fill="#221d4a" />
          <rect x="18" y="30" width="84" height="8" rx="4" fill="#221d4a" />
          <circle cx="62" cy="14" r="3" fill={PEACH} />
          <circle cx="46" cy="60" r="13" fill="none" stroke={INK} strokeWidth="3.5" />
          <circle cx="74" cy="60" r="13" fill="none" stroke={INK} strokeWidth="3.5" />
          <path d="M59 60 h2" stroke={INK} strokeWidth="3.5" />
        </>
      );
    case 'villain':
      return (
        <>
          <Eyes />
          <path
            d="M40 76 q10 -8 20 0 q10 -8 20 0 q-4 10 -12 6 q-4 -4 -8 -1 q-4 -3 -8 1 q-8 4 -12 -6 Z"
            fill={INK}
          />
          <path d="M36 48 l18 6 M84 48 l-18 6" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case 'royal':
      return (
        <>
          <Eyes />
          <Smile />
          <path d="M30 34 L34 10 L46 24 L60 4 L74 24 L86 10 L90 34 Z" fill={PEACH} />
          <circle cx="60" cy="18" r="3.5" fill="#e8604c" />
        </>
      );
    case 'outlaw':
      return (
        <>
          <Eyes />
          <Smile />
          <ellipse cx="60" cy="32" rx="58" ry="8" fill="#b4501f" />
          <path d="M34 32 Q36 6 60 8 Q84 6 86 32 Z" fill="#b4501f" />
          <rect x="34" y="24" width="52" height="5" fill="#2a1206" />
        </>
      );
    case 'meme':
      return (
        <>
          <Smile />
          <path
            d="M26 52 h68 v6 h-4 q0 14 -14 14 q-12 0 -13 -12 h-6 q-1 12 -13 12 q-14 0 -14 -14 h-4 Z"
            fill={INK}
          />
          <path
            d="M34 58 l8 -4 M66 58 l8 -4"
            stroke="#6a6595"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
  }
}

/** Hats replace the antennae; the hero's cape sits behind the body. */
const KEEPS_ANTENNAE: ReadonlySet<Costume> = new Set(['plain', 'hero', 'villain', 'meme']);

export function Mascot({ costume, size = 150 }: { costume: Costume; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-10 -14 140 134" aria-hidden="true">
      {costume === 'hero' && <path d="M18 40 L-4 112 L60 98 L124 112 L102 40 Z" fill="#e8604c" />}
      {KEEPS_ANTENNAE.has(costume) && <Antennae />}
      <Body />
      <Outfit costume={costume} />
    </svg>
  );
}
