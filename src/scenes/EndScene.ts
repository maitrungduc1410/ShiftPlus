import Phaser from 'phaser';
import { COLORS, H, W } from '../config';
import { input } from '../input';
import { sound } from '../audio';
import { LEVELS } from '../levels';
import { load } from '../save';
import { PixelText, addPaper } from '../ui';

const LINE_H = 20;
const SIGN_OFF = ['things will shift. they always do.', 'see you at sunrise.', '', 'love, me'];

/** The whole letter, typed out line by line. */
export class EndScene extends Phaser.Scene {
  private lines: string[] = [];
  private texts: PixelText[] = [];
  private line = 0;
  private char = 0;
  private acc = 0;
  private done = false;
  private prompt!: PixelText;

  constructor() {
    super('end');
  }

  create() {
    addPaper(this);
    this.lines = [...LEVELS.map((l) => l.letter), ...SIGN_OFF];
    this.line = this.char = 0;
    this.acc = -0.6;
    this.done = false;
    // The letter is longer than the screen: it's laid out top to bottom and the camera follows the pen.
    this.texts = this.lines.map((_, i) => new PixelText(this, 60, 40 + i * LINE_H, '', 2, COLORS.ink));
    this.cameras.main.setScroll(0, 0);
    const deaths = Object.values(load().deaths).reduce((a, b) => a + b, 0);
    this.prompt = new PixelText(this, W / 2, H - 22, `thanks for playing.  deaths ${deaths}.  space to return`, 1, COLORS.accent, 'center')
      .setAlpha(0)
      .setScrollFactor(0);
    this.cameras.main.fadeIn(400, 244, 239, 228);
  }

  update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs / 1000, 0.05);
    const wasDone = this.done;
    if (!this.done) {
      this.acc += dt;
      const fast = input.wasPressed('confirm');
      while (this.acc > 0.04 || (fast && !this.done)) {
        this.acc -= 0.04;
        this.typeOne();
        if (this.done) break;
        if (fast) continue;
      }
    }
    const cam = this.cameras.main;
    const target = Math.max(0, 40 + Math.min(this.line, this.lines.length - 1) * LINE_H - H * 0.6);
    cam.scrollY += (target - cam.scrollY) * (1 - Math.exp(-dt * 4));
    if (wasDone && input.wasPressed('confirm')) {
      sound.confirm();
      this.cameras.main.fadeOut(300, 244, 239, 228);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('title'));
    }
    input.endFrame();
  }

  private typeOne() {
    const full = this.lines[this.line];
    if (this.char < full.length) {
      this.char++;
      this.texts[this.line].setText(full.slice(0, this.char));
      if (full[this.char - 1] !== ' ') sound.type();
      return;
    }
    this.line++;
    this.char = 0;
    this.acc = -0.25; // small pause between lines
    if (this.line >= this.lines.length) {
      this.done = true;
      this.tweens.add({ targets: this.prompt.g, alpha: 1, duration: 500 });
    }
  }
}
