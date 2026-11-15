// Prints every level as ASCII in both states, for designing levels without running the game.
// Usage: npm run levels [-- <levelNumber>]
import { LEVELS } from '../src/levels';
import { buildLevel, HAZARD, SOLID } from '../src/level';
import { PHYS, TILE } from '../src/config';

const only = process.argv[2] ? Number(process.argv[2]) - 1 : -1;
LEVELS.forEach((def, i) => {
  if (only >= 0 && i !== only) return;
  const lv = buildLevel(def);
  console.log(`\n=== ${i + 1}. ${def.title} (${lv.cols}x${lv.rows} tiles) ===`);
  const sx = Math.floor(lv.spawn.x / TILE), sy = Math.round((lv.spawn.y + PHYS.h) / TILE) - 1;
  const gx = Math.floor(lv.goal.x / TILE), gy = Math.floor(lv.goal.y / TILE);
  for (let r = 0; r < lv.rows; r++) {
    let out = '';
    for (const s of [0, 1] as const) {
      for (let c = 0; c < lv.cols; c++) {
        const v = lv.grids[s][r * lv.cols + c];
        let ch = v === SOLID ? '#' : v === HAZARD ? 'x' : v ? '`' : '.';
        if (c === sx && r === sy) ch = 'S';
        if (c >= gx && c < gx + 5 && r >= gy && r < gy + 6 && ch === '.') ch = 'G';
        out += ch;
      }
      out += '   ';
    }
    console.log(String(r % 12).padStart(2) + ' ' + out);
  }
});
