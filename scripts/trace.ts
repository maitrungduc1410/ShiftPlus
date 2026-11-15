// Replays the solver's no-shift path for a level and prints where the player is every 0.25s.
// Usage: npx tsx scripts/trace.ts <level> "<runs from VERBOSE solve>"
import { LEVELS } from '../src/levels';
import { UNSHIFTED, buildLevel } from '../src/level';
import { Player } from '../src/player';
const [lvlArg, runs] = process.argv.slice(2);
const lv = buildLevel(LEVELS[Number(lvlArg) - 1]);
const p = new Player(lv);
p.reset(lv.spawn.x, lv.spawn.y, UNSHIFTED);
let held = false;
let t = 0;
for (const r of runs.split(' ')) {
  const [a, n] = r.split('x');
  for (let k = 0; k < Number(n); k++) {
    for (let s = 0; s < 6; s++) {
      p.update(1 / 120, { left: a[0] === 'L', right: a[0] === 'R', jump: a[1] === 'J', jumpPressed: a[1] === 'J' && !held && s === 0 });
      if (s === 0) held = a[1] === 'J';
    }
    t++;
    if (t % 5 === 0) console.log(`t=${(t / 20).toFixed(2)} char=${(p.x / 48).toFixed(1)} line=${(p.y / 96).toFixed(2)} g=${p.grounded}`);
  }
}
