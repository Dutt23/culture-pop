import type { CSSProperties } from 'react';

/** The room's colours, from the app's dark palette. */
export const NIGHT = '#0a0820';
export const FRAME = '#3a3270';
export const WOOD = '#4a3a8a';
export const SHADE = '#3a2d70';
export const LIGHT = '#f3efff';
export const LILAC = '#b29bff';
export const MIST = '#c9c2ee';
export const PEACH = '#ffb27a';
export const CREAM = '#ffd9a8';
export const LAMP = '#ffd27a';
export const CORAL = '#e8604c';
export const INK = '#0d0b1f';
export const PURPLE = '#6a3df0';
export const MINT = '#7be0a8';
export const SKY = '#6fd3ff';
export const STEEL = '#9aa0b8';
export const LEATHER = '#8a5a3c';

/** Starts a looping animation part-way, so things in a row don't move in step. */
export const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });
