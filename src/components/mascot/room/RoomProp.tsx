import { useContext, type KeyboardEvent, type ReactNode } from 'react';
import { classNames } from '../../ui/classNames';
import { RoomContext, shownProps, type PropElement, type RoomState } from './roomContext';
import { ROOM_PROPS, type RoomPropId } from './roomProps';
import styles from './room.module.css';

const STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

function onKey(event: KeyboardEvent<PropElement>, id: RoomPropId, room: RoomState) {
  if (event.key === 'Enter') {
    event.preventDefault();
    room.open(id, event.currentTarget);
    return;
  }
  // Like a real button, Space acts when it's let go; here it only stops the page scrolling.
  if (event.key === ' ') {
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape' && room.openId) {
    room.close();
    return;
  }
  const step = STEPS[event.key];
  if (!step) return;
  event.preventDefault();
  const props = shownProps(event.currentTarget);
  const next = props[step(props.indexOf(event.currentTarget), props.length)];
  next?.focus();
}

/**
 * A prop in the mascot's room that is secretly a button: tap it and the mascot says what it
 * references. Named by what it looks like, so screen readers keep the secret too. An SVG group in
 * the drawings, or a `div` (`as="div"`) for the lights across the top.
 */
export function RoomProp({
  id,
  as = 'g',
  className,
  children,
}: {
  id: RoomPropId;
  as?: 'g' | 'div';
  className?: string;
  children: ReactNode;
}) {
  const room = useContext(RoomContext);
  const button = {
    role: 'button',
    'aria-haspopup': 'dialog' as const,
    'aria-label': ROOM_PROPS[id].thing,
    tabIndex: room.tabStop === id ? 0 : -1,
    className: classNames(styles.prop, className),
    'data-room-prop': id,
    'data-open': room.openId === id || undefined,
    onClick: (event: { currentTarget: PropElement }) => room.open(id, event.currentTarget),
    onKeyDown: (event: KeyboardEvent<PropElement>) => onKey(event, id, room),
    onKeyUp: (event: KeyboardEvent<PropElement>) => {
      if (event.key === ' ') room.open(id, event.currentTarget);
    },
    onFocus: () => room.setTabStop(id),
  };
  return as === 'div' ? <div {...button}>{children}</div> : <g {...button}>{children}</g>;
}
