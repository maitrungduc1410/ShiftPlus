import type { LevelDef } from '../src/level';

// Big multi-line levels can exceed the solver's search budget. Most solve with a bigger budget
// (see README), but level 29 is verified here in overlapping segments instead: each segment moves
// the spawn (¤) or the goal (¶) partway in.
// Run: LEVELS_MODULE=../scripts/lab-levels.ts MAX_NODES=20000000 npx tsx scripts/solve.ts
export const LEVELS: LevelDef[] = [
  { title: '29 start to the 8s', split: true, letter: '', lines: ['¤soon___`````888¶'] },
  { title: '29 the 8s to line 1', split: true, letter: '', lines: ['soon___`````88¤8___`````', '                     ___¶'] },
  { title: '29 line 1 to the end', split: true, letter: '', lines: ['soon___`````888___`````', '                     _¤__', '¶888````````````___`````____'] },
];
