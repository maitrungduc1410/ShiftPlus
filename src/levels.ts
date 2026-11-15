import type { LevelDef } from './level';

// Levels are written in their unshifted state. Holding Shift turns every character into its
// shifted twin (a -> A, 8 -> *, 0 -> ), ` -> ~, - -> _, \ -> |, ...). Uppercase letters and
// already-shifted symbols never change, so they are the "fixed" pieces of a level.
//
// Quick reference for terrain heights (tile rows from the top of a line):
//   row 0  caps, ascenders (b d f h k l t), digits
//   row 2  x-height (a c e m n o r s u v w x z), and the top of a ~ bridge
//   row 3  -  (bridge)          row 6  _  (floor)
//   `  tiny marks at rows 0-1, too high to reach from a _ floor
//   8 -> *  and  6 -> ^  turn into spikes while Shift is held
//   0 -> )  opens a cage on its left side
//
// The player jumps ~4.6 tiles high and ~10 tiles far. One space is a jumpable gap, two spaces
// are not. Walking off the end of a line drops you onto the line below.

export const CHAPTERS = [{ title: 'the night shift' }, { title: 'mornings' }, { title: 'left and right' }];

export const LEVELS: LevelDef[] = [
  {
    title: 'dear you',
    lines: [
      '¤dear you,',
      '       writing this',
      '                 late at night.¶',
    ],
    letter: 'dear you,',
    hint: 'arrows / a d  move     space / w  jump',
  },
  {
    title: 'let me out',
    lines: [
      'let me ¤0ut',
      '     free now.¶',
    ],
    letter: 'i work the night shift now.',
    hint: 'hold shift to change everything',
  },
  {
    title: 'hold on',
    lines: [
      '¤hold on___`````___tight.¶',
    ],
    letter: 'the bus home is cold and late,',
    hint: 'hold shift, then jump',
  },
  {
    title: 'eights',
    lines: [
      '¤i ate___`````888 ok.¶',
    ],
    letter: 'but i count the stops like stars.',
    hint: 'spikes only exist while shift is held',
  },
  {
    title: 'downhill',
    lines: [
      '¤down\\\\\\\\___`````////88 up.¶',
    ],
    letter: 'some nights the whole city tilts,',
  },
  {
    // Bridge needs Shift, but the slopes right after it turn into walls: jump, then let go mid-air.
    title: 'slide',
    lines: [
      '¤slide___`````\\\\\\\\\\ on.¶',
    ],
    letter: 'and i slide along with it.',
    hint: 'let go of shift in the air',
  },
  {
    // The cage opens to the left. While Shift is held the - bridges sink to the floor between
    // tall letters, so you must let go before you land.
    title: 'drop',
    lines: [
      '¶ ok---T---T---¤0',
    ],
    letter: 'i drop my keys. i drop my fears.',
  },
  {
    // Two bridges with a row of 6s between them: Shift on, off, on, off.
    title: 'puddles',
    lines: [
      '¤one___`````666`````___on and on.¶',
    ],
    letter: 'i dodge the puddles, one by one,',
  },
  {
    // A long way down the page, mixing everything so far.
    title: 'stairs',
    lines: [
      '¤up the___`````88',
      '              stairs___`````\\\\\\',
      '                      to  you',
      '                    ¶ ok---T---0',
    ],
    letter: 'and climb the stairs to where you sleep.',
  },
  {
    title: 'sunrise',
    lines: [
      '¤i watch___`````888___`````\\\\\\',
      '                           so---T---T---',
      '                           ¶ 6666`````___',
    ],
    letter: 'i never wake you. i just watch.',
  },
  // ---------------------------------------------------------------------------------------------
  // Chapter 2: mornings. Everything from chapter 1, combined and stretched down the page.
  {
    title: 'school',
    lines: [
      '¤you___`````////888 go.¶',
    ],
    letter: 'in the morning you leave for school',
    hint: '/ is a slope going up',
  },
  {
    // Exit the cage left, then on, off, on, off.
    title: 'the door',
    lines: [
      '¶ in___`````___we___¤0',
    ],
    letter: 'just as i come through the door.',
  },
  {
    // Right, then back left, then right again.
    title: 'two hands',
    lines: [
      '¤pass___`````888',
      ' \\\\\\__`````````___T',
      '¶666',
    ],
    letter: 'we pass like two hands on a clock,',
  },
  {
    title: 'one up',
    lines: [
      '¤a sun___`````___a---T---T---house.¶',
    ],
    letter: 'one going up, one coming down.',
  },
  {
    title: 'the drawing',
    lines: [
      '  gray___¤0',
      ' \\\\\\\\___`````___me.¶',
    ],
    letter: 'you left a drawing on the fridge:',
  },
  {
    // Spikes inside a bridge: jump them while Shift is held.
    title: 'tall gray me',
    lines: [
      '¤laugh___`````8`````8`````___stop.¶',
    ],
    letter: 'a sun, a house, a tall gray me.',
    hint: 'jump the spikes on the bridge',
  },
  {
    title: 'locker',
    lines: [
      '   ¤0',
      '  ---T---T---888',
      '               ___`````___night.¶',
    ],
    letter: 'i taped it to my locker at work.',
  },
  {
    title: 'again',
    lines: [
      '¤and___`````88___`````88___`````88 on.¶',
    ],
    letter: 'the others laughed. then they didn\'t.',
  },
  {
    title: 'hard for me',
    lines: [
      '¤hard___`````\\\\\\---T---666___`````___me.¶',
    ],
    letter: 'at three a.m. i read your notes',
  },
  {
    title: 'shine',
    lines: [
      '¤so___`````888___`````\\\\\\',
      '             ___`````---T---',
      '          666___`````___shine.¶',
    ],
    letter: 'again, again, until they shine.',
  },
  // ---------------------------------------------------------------------------------------------
  // Chapter 3: left and right. Left Shift changes only what is left of you, Right Shift only what
  // is right of you, and the letter under your feet never changes.
  {
    title: 'the right side',
    split: true,
    lines: [
      '¤go___`````___on.¶',
    ],
    letter: 'i know it\'s hard. it\'s hard for me.',
    hint: 'right shift only changes what is right of you',
  },
  {
    title: 'the left side',
    split: true,
    lines: [
      '¶ on___`````___¤go',
    ],
    letter: 'the left side of my day is yours,',
    hint: 'left shift only changes what is left of you',
  },
  {
    title: 'my own letter',
    split: true,
    lines: [
      '¤i 888`````___ok.¶',
    ],
    letter: 'the right side goes to the machines.',
    hint: 'the letter under you never changes',
  },
  {
    title: 'stay',
    split: true,
    lines: [
      '¶ ok___`````888 ¤so',
    ],
    letter: 'i keep trying to move the line.',
  },
  {
    title: 'there and back',
    split: true,
    lines: [
      '¤so___`````888',
      '¶ ok````````___',
    ],
    letter: 'i asked my boss for days, not nights.',
  },
  {
    title: 'maybe',
    split: true,
    lines: [
      '¤hi---T---T---___`````___ok.¶',
    ],
    letter: 'she said maybe. maybe is a door.',
  },
  {
    title: 'downstairs',
    split: true,
    lines: [
      '¤down\\\\\\\\',
      '¶ 8`````___',
    ],
    letter: 'so here\'s my plan, my little star:',
  },
  {
    title: 'one by one',
    split: true,
    lines: [
      '¤so888___`````666___`````\\\\\\\\\\\\ on.¶',
    ],
    letter: 'i\'ll shift the hours, one by one,',
  },
  {
    title: 'line up',
    split: true,
    lines: [
      '¤soon___`````888___`````',
      '                     ___',
      '¶888````````````___`````____',
    ],
    letter: 'until our days line up again.',
  },
  {
    title: 'walk you to school',
    split: true,
    lines: [
      '¤so___`````666___`````\\\\\\\\',
      '                       H___`````888',
      '                      ¶go_```666``___',
    ],
    letter: 'and then i\'ll walk you to school.',
  },
];
