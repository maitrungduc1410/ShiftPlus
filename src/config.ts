// Internal render size (scaled up to the window with crisp pixels). Everything in the world is built from TILE x TILE cells.
export const W = 640;
export const H = 360;
export const TILE = 8;

// A text line in a level is LINE_ROWS tall: 7 rows of glyph, 2 rows of descender, 3 rows of air.
export const LINE_ROWS = 12;

export const COLORS = {
  paper: 0xf4efe4,
  paperShift: 0xe9edf5,
  margin: 0xe7a4a0,
  dot: 0xd9d2c3,
  ink: 0x2b2d3a,
  inkShift: 0x23409a,
  ghost: 0x2b2d3a,
  hazard: 0xd8463f,
  player: 0xef6a2e,
  playerDark: 0xb44619,
  goal: 0xe0a21d,
  ui: 0x2b2d3a,
  uiMuted: 0x8b8678,
  accent: 0x23409a,
  white: 0xffffff,
};

// Player physics, in pixels and seconds. Tuned for a "tight but forgiving" feel.
export const PHYS = {
  w: 10,
  h: 14,
  run: 165,
  accelGround: 2200,
  accelAir: 1400,
  decelGround: 2600,
  gravity: 1500,
  apexGravityScale: 0.55, // floatier apex while jump is held
  apexThreshold: 70,
  jumpHeight: 34, // ~4.25 tiles: reaches a ~ bridge from a _ floor, but not the ` marks
  jumpCut: 0.45, // velocity kept when jump released early
  maxFall: 560,
  coyote: 0.09,
  jumpBuffer: 0.13,
  stepUp: 8, // auto climb ledges up to one tile
  cornerNudge: 4, // slide around ceiling corners when jumping
};
