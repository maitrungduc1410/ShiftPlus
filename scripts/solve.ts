// Breadth-first search over player inputs using the real Player physics, to prove each level is
// beatable and to measure how long the shortest solution is.
// Usage: npm run solve [-- <levelNumber>]
import type { LevelDef } from '../src/level';
// LEVELS_MODULE lets you test experimental levels without touching the game's level list.
const { LEVELS } = (await import(process.env.LEVELS_MODULE ?? '../src/levels')) as { LEVELS: LevelDef[] };
import { ALL, LEFT, NONE, RIGHT, UNSHIFTED, buildLevel, charIndexAt, type ShiftKind, type ShiftMode } from '../src/level';
import { PHYS } from '../src/config';
import { Player } from '../src/player';

const STEP = 1 / 120;
const SUB = 6; // physics steps per decision (20 decisions per second)
const MAX_NODES = Number(process.env.MAX_NODES ?? 6_000_000);

interface Node {
  p: Player;
  mode: ShiftMode;
  jumpHeld: boolean;
  parent: Node | null;
  action: string;
  depth: number;
  cost: number;
  /** Shift changes since the player last stood on the ground (humans manage one per jump). */
  airToggles: number;
}

const KIND_LABEL = ['.', 'S', '<', '>'];
function actionsFor(kinds: ShiftKind[]) {
  const out: { dir: -1 | 0 | 1; jump: boolean; kind: ShiftKind }[] = [];
  for (const dir of [-1, 0, 1] as const) for (const jump of [false, true]) for (const kind of kinds) out.push({ dir, jump, kind });
  return out;
}

function clone(p: Player): Player {
  const c = Object.assign(Object.create(Object.getPrototypeOf(p)), p) as Player;
  c.events = [];
  return c;
}

function key(n: Node) {
  const p = n.p;
  return `${Math.round(p.x / 3)},${Math.round(p.y / 3)},${Math.round(p.vx / 55)},${Math.round(p.vy / 90)},${n.mode.kind}:${n.mode.at},${n.jumpHeld ? 1 : 0},${p.grounded ? 1 : 0},${n.airToggles}`;
}

/** Minimal binary heap keyed by f. */
class Heap<T> {
  private a: { f: number; v: T }[] = [];
  get size() {
    return this.a.length;
  }
  push(f: number, v: T) {
    const a = this.a;
    a.push({ f, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): T {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.v;
  }
}

function solve(i: number, kinds: ShiftKind[]) {
  const ACTIONS = actionsFor(kinds);
  const def = LEVELS[i];
  const lv = buildLevel(def);
  const start = new Player(lv);
  start.reset(lv.spawn.x, lv.spawn.y, UNSHIFTED);
  const gx = lv.goal.x + lv.goal.w / 2;
  const gy = lv.goal.y + lv.goal.h / 2;
  // Heuristic in seconds: horizontal run time plus falling time. Weighted for speed over optimality.
  // On other lines the route may go either way first, so horizontal distance only counts fully
  // once the player is on the goal's line.
  // HEUR=direct uses plain distance to the goal, which suits levels that mostly head toward it.
  const h =
    process.env.HEUR === 'direct'
      ? (p: Player) => Math.abs(p.x - gx) / 165 + Math.abs(p.y - gy) / 400
      : (p: Player) => (Math.abs(p.x - gx) / 165) * (Math.abs(p.y - gy) < 48 ? 1 : 0.35) + Math.abs(p.y - gy) / 300;
  const root: Node = { airToggles: 0, p: start, mode: UNSHIFTED, jumpHeld: false, parent: null, action: '', depth: 0, cost: 0 };
  const seen = new Set<string>([key(root)]);
  const open = new Heap<Node>();
  open.push(h(start), root);
  let nodes = 0;
  let best = Infinity;
  let bestNode = root;
  while (open.size && nodes < MAX_NODES) {
    const n = open.pop();
    for (const a of ACTIONS) {
      const changing = a.kind !== n.mode.kind;
      if (changing && !n.p.grounded && n.airToggles >= 1) continue;
      nodes++;
      const p = clone(n.p);
      let mode = n.mode;
      if (changing) {
        // The split point is fixed where the player stands when the key goes down.
        mode = { kind: a.kind, at: a.kind === LEFT || a.kind === RIGHT ? charIndexAt(p.x + PHYS.w / 2) : 0 };
        p.setMode(mode);
      }
      let won = false;
      let dead = p.dead;
      for (let s = 0; s < SUB && !dead; s++) {
        p.update(STEP, { left: a.dir < 0, right: a.dir > 0, jump: a.jump, jumpPressed: a.jump && !n.jumpHeld && s === 0 });
        if (p.events.includes('goal')) won = true;
        if (p.dead) dead = true;
        p.events.length = 0;
        if (won) break;
      }
      const label = `${a.dir < 0 ? 'L' : a.dir > 0 ? 'R' : '.'}${a.jump ? 'J' : '.'}${KIND_LABEL[a.kind]}`;
      const toggled = a.kind !== n.mode.kind ? 1 : 0;
      const child: Node = { airToggles: p.grounded ? 0 : n.airToggles + (changing && !n.p.grounded ? 1 : 0), p, mode, jumpHeld: a.jump, parent: n, action: label, depth: n.depth + 1, cost: n.cost + SUB * STEP + toggled * 0.25 };
      if (won) return { child, nodes };
      if (dead) continue;
      const k = key(child);
      if (seen.has(k)) continue;
      seen.add(k);
      const hv = h(p);
      if (hv < best) (best = hv), (bestNode = child);
      open.push(child.cost + 2.5 * hv, child);
    }
  }
  if (process.env.VERBOSE) console.log(`   closest: x=${Math.round(bestNode.p.x)} y=${Math.round(bestNode.p.y)} (goal ${Math.round(gx)},${Math.round(gy)})`);
  return { child: null, nodes, exhausted: open.size === 0 };
}

const only = process.argv[2] ? Number(process.argv[2]) - 1 : -1;
function fmt(child: Node) {
  const path: string[] = [];
  for (let n: Node | null = child; n && n.parent; n = n.parent) path.unshift(n.action);
  const runs: string[] = [];
  for (const a of path) {
    const last = runs[runs.length - 1];
    const m = last?.match(/^(...)x(\d+)$/);
    if (m && m[1] === a) runs[runs.length - 1] = `${a}x${Number(m[2]) + 1}`;
    else runs.push(`${a}x1`);
  }
  const toggles = path.reduce((acc, a, i) => acc + (i > 0 && a[2] !== path[i - 1][2] ? 1 : 0), path[0]?.[2] !== '.' ? 1 : 0);
  return { secs: (path.length / 20).toFixed(2), toggles, runs: runs.join(' ') };
}
// For each level: it must be impossible without Shift, solvable with it, and (split levels)
// which side keys the solution uses.
let problems = 0;
LEVELS.forEach((def, i) => {
  if (only >= 0 && i !== only) return;
  const tutorial = i === 0 && !process.env.LEVELS_MODULE;
  const free = solve(i, [NONE]);
  const plain = def.split ? null : solve(i, [NONE, ALL]);
  const split = def.split ? solve(i, [NONE, LEFT, RIGHT]) : null;
  const f = free.child ? fmt(free.child) : null;
  if (f && process.env.VERBOSE) console.log('   no-shift path: ' + f.runs);
  const p = plain?.child ? fmt(plain.child) : null;
  if (p && process.env.VERBOSE) console.log('   shift path: ' + p.runs);
  const sp = split?.child ? fmt(split.child) : null;
  const lines = [`${i + 1}. ${def.title}${def.split ? ' [split]' : ''}`];
  lines.push(`   no shift    : ${f ? `solvable in ${f.secs}s` : 'impossible'}`);
  if (!def.split) lines.push(`   shift       : ${p ? `solvable in ${p.secs}s, ${p.toggles} toggles` : 'impossible'}`);
  if (def.split) lines.push(`   split shift : ${sp ? `solvable in ${sp.secs}s, ${sp.toggles} toggles, uses ${[...new Set(sp.runs.match(/[<>]/g) ?? [])].join(' ') || 'nothing'}` : 'impossible'}`);
  let bad = '';
  if (!tutorial && f) bad = 'beatable without shift';
  const failed = def.split ? split : plain;
  if (def.split ? !sp : !p) bad = failed && !failed.exhausted ? 'gave up (search budget hit, try MAX_NODES=20000000)' : 'NOT BEATABLE';
  if (bad) {
    problems++;
    lines.push(`   !! ${bad}`);
  }
  const best = def.split ? sp : p;
  if (best && process.env.VERBOSE) lines.push('   ' + best.runs);
  console.log(lines.join('\n'));
});
console.log(problems ? `\n${problems} level(s) need work` : '\nall levels ok');
