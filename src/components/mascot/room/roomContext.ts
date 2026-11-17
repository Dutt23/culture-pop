import { createContext } from 'react';
import type { RoomPropId } from './roomProps';

/** Props are SVG groups in the drawings, or HTML for the lights across the top. */
export type PropElement = SVGGElement | HTMLDivElement;

export const ROOM_ATTRIBUTE = 'data-room';
export const PROP_ATTRIBUTE = 'data-room-prop';

export interface RoomState {
  /** The prop the mascot is explaining, if any. */
  openId: RoomPropId | null;
  /** The one prop in the tab order; arrow keys move it. */
  tabStop: RoomPropId;
  open: (id: RoomPropId, element: PropElement) => void;
  close: () => void;
  setTabStop: (id: RoomPropId) => void;
}

export const RoomContext = createContext<RoomState>({
  openId: null,
  tabStop: 'signal',
  open: () => {},
  close: () => {},
  setTabStop: () => {},
});

/** Whether a prop is on screen: the wide-screen ones are hidden on phones and short screens. */
export function isShown(prop: Element): boolean {
  if (prop.checkVisibility) return prop.checkVisibility();
  // Older Safari: the wide-screen props are hidden by hiding their whole drawing.
  const box = prop instanceof SVGElement ? (prop.ownerSVGElement ?? prop) : prop;
  return getComputedStyle(box).display !== 'none';
}

export function propElement(room: Element, id: RoomPropId): PropElement | null {
  return room.querySelector<PropElement>(`[${PROP_ATTRIBUTE}="${id}"]`);
}

export function shownProps(from: Element): PropElement[] {
  const room = from.closest(`[${ROOM_ATTRIBUTE}]`);
  if (!room) return [];
  return [...room.querySelectorAll<PropElement>(`[${PROP_ATTRIBUTE}]`)].filter(isShown);
}
