import Phaser from 'phaser';
import { COLORS, H, W } from '../config';
import { input } from '../input';
import { sound } from '../audio';
import { LEVELS } from '../levels';
import { load, save } from '../save';
import { Menu, PixelText, addPaper, ensureTextures } from '../ui';

export class TitleScene extends Phaser.Scene {
  private title!: PixelText;
  private menu!: Menu;
  private hint!: PixelText;
  private paperTint!: (t: number, dt: number) => void;
  private shift = false;
  private t = 0;

  constructor() {
    super('title');
  }

  create() {
    ensureTextures(this);
    this.paperTint = addPaper(this);
    const data = load();
    sound.setMuted(data.muted);

    this.title = new PixelText(this, W / 2, 70, 'shift+', 8, COLORS.ink, 'center');
    this.hint = new PixelText(this, W / 2, 150, 'try holding shift', 1, COLORS.uiMuted, 'center');

    const started = Object.keys(data.best).length > 0;
    this.menu = new Menu(
      this,
      [
        {
          label: () => (started ? 'continue' : 'play'),
          action: () => this.start('game', { index: Math.min(load().unlocked, LEVELS.length) - 1 }),
        },
        { label: () => 'levels', action: () => this.start('levels') },
        {
          label: () => `sound ${sound.isMuted() ? 'off' : 'on'}`,
          action: () => {
            const d = load();
            d.muted = !sound.isMuted();
            save(d);
            sound.setMuted(d.muted);
          },
        },
      ],
      W / 2,
      200,
      24,
      2,
      0,
      () => sound.select(),
    );

    new PixelText(this, W / 2, H - 20, 'a game for github game off 2026', 1, COLORS.uiMuted, 'center');
    this.cameras.main.fadeIn(300, 244, 239, 228);
  }

  private start(key: string, data?: object) {
    sound.unlock();
    sound.confirm();
    this.cameras.main.fadeOut(220, 244, 239, 228);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs / 1000, 0.05);
    this.t += dt;
    const s = input.isDown('shift');
    if (s !== this.shift) {
      this.shift = s;
      sound.shift(s);
      this.title.setShift(s);
      this.hint.setText(s ? 'everything changes. let go to change it back' : 'try holding shift');
    }
    this.paperTint(s ? 1 : 0, dt);
    this.title.y = 70 + Math.sin(this.t * 1.6) * 2;
    this.title.setShift(s);

    if (input.wasPressed('up')) this.menu.move(-1);
    if (input.wasPressed('down')) this.menu.move(1);
    if (input.wasPressed('confirm')) this.menu.activate();
    if (input.wasPressed('mute')) {
      this.menu.index = 2;
      this.menu.activate();
    }
    this.menu.update(dt, s);
    input.endFrame();
  }
}
