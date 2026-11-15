import { sound } from './audio';

// Keyboard state read straight from DOM events (by physical key code), so Shift never changes
// which key is reported, and losing focus can't leave a key stuck down.

const BINDS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ'],
  shift: ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyC'],
  shiftLeft: ['ShiftLeft', 'KeyX'],
  shiftRight: ['ShiftRight', 'KeyC'],
  confirm: ['Enter', 'Space', 'KeyZ'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
  mute: ['KeyM'],
} as const;

export type Action = keyof typeof BINDS;

const down = new Set<string>();
const pressed = new Set<string>();
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Tab']);

window.addEventListener('keydown', (e) => {
  sound.unlock();
  if (PREVENT.has(e.code)) e.preventDefault();
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
});
window.addEventListener('keyup', (e) => {
  down.delete(e.code);
});
window.addEventListener('blur', () => down.clear());
window.addEventListener('pointerdown', () => sound.unlock());

export const input = {
  isDown(a: Action) {
    return BINDS[a].some((k) => down.has(k));
  },
  /** True once per physical press. Call `endFrame()` after the frame has read its input. */
  wasPressed(a: Action) {
    return BINDS[a].some((k) => pressed.has(k));
  },
  endFrame() {
    pressed.clear();
  },
};

/** Debug helper for automated playtests: hold or release a key by its code. */
export function simulateKey(code: string, isDown: boolean) {
  if (isDown) {
    if (!down.has(code)) pressed.add(code);
    down.add(code);
  } else down.delete(code);
}
