import { INK, LIGHT, SKY, STEEL } from './palette';
import styles from './backProps.module.css';

/** A glowing energy sword, drawn upright with its hilt end at the origin. Turn it with a transform. */
export function EnergySword() {
  return (
    <g aria-hidden="true">
      <rect className={styles.pulse} x="-4.6" y="-82" width="9.2" height="68" rx="4.6" fill={SKY} opacity="0.4" />
      <rect x="-2" y="-80" width="4" height="66" rx="2" fill={SKY} />
      <rect x="-0.8" y="-78" width="1.6" height="62" rx="0.8" fill={LIGHT} />
      <rect x="-5" y="-15" width="10" height="3" rx="1" fill={STEEL} />
      <rect x="-2.2" y="-12" width="4.4" height="12" rx="1" fill={INK} />
      <path d="M-2.2 -8 h4.4 M-2.2 -4 h4.4" stroke={STEEL} strokeWidth="1" />
    </g>
  );
}
