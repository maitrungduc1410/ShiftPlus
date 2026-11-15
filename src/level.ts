import { ADVANCE, DECOR, GLYPH_H, GLYPH_W, GOAL, HAZARDS, SPAWN, glyph, shifted } from './font';
import { LINE_ROWS, PHYS, TILE } from './config';

export interface LevelDef {
  title: string;
  /** Terrain, written in its unshifted state. `¤` (zero width) marks the spawn, `¶` the goal. */
  lines: string[];
  /** The line of the letter revealed when the level is cleared. */
  letter: string;
  /** Short control hint shown at the bottom of the screen. */
  hint?: string;
  /**
   * Split levels: Left Shift only changes characters left of the player, Right Shift only those to
   * the right, and the character under the player never changes. There is no "shift everything".
   */
  split?: boolean;
}

/**
 * How the world is shifted right now.
 * NONE / ALL: every character unshifted / shifted.
 * LEFT / RIGHT: only characters left / right of character index `at` are shifted (split levels).
 */
export const NONE = 0;
export const ALL = 1;
export const LEFT = 2;
export const RIGHT = 3;
export type ShiftKind = typeof NONE | typeof ALL | typeof LEFT | typeof RIGHT;
export interface ShiftMode {
  kind: ShiftKind;
  at: number;
}
export const UNSHIFTED: ShiftMode = { kind: NONE, at: 0 };

/** Which grid (0 unshifted, 1 shifted) applies to a tile column under a shift mode. */
export function stateAt(mode: ShiftMode, col: number): 0 | 1 {
  switch (mode.kind) {
    case NONE:
      return 0;
    case ALL:
      return 1;
    case LEFT:
      return Math.floor(col / ADVANCE) < mode.at ? 1 : 0;
    default:
      return Math.floor(col / ADVANCE) > mode.at ? 1 : 0;
  }
}

/** Character index under a pixel x position. */
export function charIndexAt(x: number) {
  return Math.floor(x / (ADVANCE * TILE));
}

export const EMPTY = 0;
export const SOLID = 1;
export const HAZARD = 2;
/** Drawn but not solid. */
export const DECO = 3;

export interface PlacedChar {
  lower: string;
  upper: string;
  col: number; // tile column of glyph's left edge
  row: number; // tile row of glyph's top edge
}

export interface BuiltLevel {
  cols: number;
  rows: number;
  /** [unshifted, shifted] collision grids, row-major, cols*rows. */
  grids: [Uint8Array, Uint8Array];
  chars: PlacedChar[];
  spawn: { x: number; y: number };
  goal: { x: number; y: number; w: number; h: number };
  widthPx: number;
  heightPx: number;
  split: boolean;
}

export function buildLevel(def: LevelDef): BuiltLevel {
  let spawnAt: { line: number; index: number } | null = null;
  const lines = def.lines.map((raw, li) => {
    const idx = raw.indexOf(SPAWN);
    if (idx >= 0) spawnAt = { line: li, index: idx };
    return raw.replace(SPAWN, '');
  });

  const maxLen = Math.max(...lines.map((l) => l.length));
  const cols = maxLen * ADVANCE - 1;
  const LR = LINE_ROWS;
  const rows = (lines.length - 1) * LR + GLYPH_H;
  const grids: [Uint8Array, Uint8Array] = [new Uint8Array(cols * rows), new Uint8Array(cols * rows)];
  const chars: PlacedChar[] = [];
  let goal = { x: 0, y: 0, w: 0, h: 0 };

  lines.forEach((line, li) => {
    [...line].forEach((ch, i) => {
      const col = i * ADVANCE;
      const row = li * LR;
      if (ch === GOAL) {
        goal = { x: col * TILE, y: (row + 1) * TILE, w: GLYPH_W * TILE, h: 6 * TILE };
        return;
      }
      if (ch === ' ') return;
      const upper = shifted(ch);
      chars.push({ lower: ch, upper, col, row });
      [ch, upper].forEach((c, s) => {
        const g = glyph(c);
        if (!g) throw new Error(`No glyph for "${c}" in level "${def.title}"`);
        const val = HAZARDS.has(c) ? HAZARD : DECOR.has(c) ? DECO : SOLID;
        for (let r = 0; r < GLYPH_H; r++)
          for (let k = 0; k < GLYPH_W; k++)
            if (g[r][k] === '#') grids[s][(row + r) * cols + col + k] = val;
      });
    });
  });

  // Spawn on top of whatever is under the marked character (unshifted state).
  const sp = spawnAt as { line: number; index: number } | null;
  const sLine = sp?.line ?? 0;
  const sIndex = sp?.index ?? 0;
  const sx = sIndex * ADVANCE * TILE + (GLYPH_W * TILE - PHYS.w) / 2;
  const top = sLine * LR;
  let surface = top + GLYPH_H;
  const c0 = Math.floor(sx / TILE);
  const c1 = Math.floor((sx + PHYS.w - 1) / TILE);
  // A spawn on a cage (0) puts the player inside it, so skip the cage's lid.
  const startRow = lines[sLine][sIndex] === '0' ? top + 1 : top;
  outer: for (let r = startRow; r < top + GLYPH_H; r++)
    for (let c = c0; c <= c1; c++)
      if (grids[0][r * cols + c] === SOLID) {
        surface = r;
        break outer;
      }

  return {
    cols,
    rows,
    grids,
    chars,
    spawn: { x: sx, y: surface * TILE - PHYS.h },
    goal,
    widthPx: cols * TILE,
    heightPx: rows * TILE,
    split: !!def.split,
  };
}

/** Value of a cell under a shift mode, treating everything outside the grid as empty. */
export function cellAt(level: BuiltLevel, mode: ShiftMode, c: number, r: number): number {
  if (c < 0 || r < 0 || c >= level.cols || r >= level.rows) return EMPTY;
  return level.grids[stateAt(mode, c)][r * level.cols + c];
}
