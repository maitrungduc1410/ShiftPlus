import Phaser from 'phaser';
import { COLORS, H, PHYS, TILE, W } from '../config';
import { ALL, DECO, HAZARD, LEFT, NONE, RIGHT, UNSHIFTED, buildLevel, charIndexAt, stateAt, type BuiltLevel, type ShiftKind, type ShiftMode } from '../level';
import { ADVANCE } from '../font';
import { LEVELS } from '../levels';
import { Player } from '../player';
import { input } from '../input';
import { sound } from '../audio';
import { load, save } from '../save';
import { Menu, PixelText, addPaper, ensureTextures, textWidth } from '../ui';

const STEP = 1 / 120;
const GHOST_ALPHA = 0.13;

type Mode = 'play' | 'dead' | 'won' | 'paused';

const PILCROW = ['.####', '###.#', '###.#', '.##.#', '..#.#', '..#.#', '..#.#'];

export class GameScene extends Phaser.Scene {
  private index = 0;
  private level!: BuiltLevel;
  private player!: Player;
  private shift: ShiftMode = UNSHIFTED;
  private mode: Mode = 'play';
  private acc = 0;
  private pendingJump = false;
  private time0 = 0;
  private elapsed = 0;
  private stepSoundCd = 0;
  private runT = 0;
  /** Seconds left in the level intro, where the camera starts on the goal and glides to the player. */
  private intro = 0;

  private terrain!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private splitLine!: Phaser.GameObjects.Graphics;
  private sprite!: Phaser.GameObjects.Image;
  private goal!: Phaser.GameObjects.Container;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private paperTint!: (target: number, dt: number) => void;

  private hudTitle!: PixelText;
  private hudDeaths!: PixelText;
  private hint?: PixelText;
  private keycap!: Phaser.GameObjects.Graphics;
  private keycapTexts: PixelText[] = [];

  private pauseLayer!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: PixelText;
  private pauseMenu!: Menu;
  private winLayer: Phaser.GameObjects.GameObject[] = [];
  private winLetter?: PixelText;
  private typed = 0;
  private typeTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('game');
  }

  init(data: { index?: number }) {
    this.index = data.index ?? 0;
    this.mode = 'play';
    this.acc = 0;
    this.pendingJump = false;
    this.winLayer = [];
    this.winLetter = undefined;
    this.typed = 0;
  }

  create() {
    ensureTextures(this);
    this.paperTint = addPaper(this);
    const def = LEVELS[this.index];
    this.level = buildLevel(def);
    this.shift = UNSHIFTED;
    this.terrain = this.add.graphics().setDepth(2);
    this.ghost = this.add.graphics().setDepth(1).setAlpha(GHOST_ALPHA);
    this.splitLine = this.add.graphics().setDepth(4);
    this.createGoal();

    this.sprite = this.add.image(0, 0, 'player').setOrigin(0.5, 1).setDepth(10);
    const particle = (tint: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, 'px', { emitting: false, tint, ...cfg }).setDepth(11);
    this.dust = particle(COLORS.ink, { speed: { min: 10, max: 45 }, angle: { min: 200, max: 340 }, lifespan: 300, scale: { start: 1, end: 0 }, gravityY: 120 });
    this.burst = particle(COLORS.player, { speed: { min: 40, max: 160 }, lifespan: 600, scale: { start: 1.5, end: 0 }, gravityY: 350 });
    this.sparkle = particle(COLORS.goal, { speed: { min: 30, max: 140 }, lifespan: 900, scale: { start: 1.5, end: 0 }, gravityY: 120 });

    this.player = new Player(this.level);
    this.createHud(def.title, def.hint);
    this.createPause();
    this.spawn();
    this.applyShiftVisuals(true);

    sound.setMuted(load().muted);
    sound.startMusic();
    this.cameras.main.fadeIn(220, 244, 239, 228);
    // Show where the goal is first when it starts off-screen.
    const g = this.level.goal;
    const sp = this.level.spawn;
    this.intro = Math.abs(g.x - sp.x) > W * 0.6 || Math.abs(g.y - sp.y) > H * 0.5 ? 1.5 : 0;
    this.snapCamera();
  }

  // ---------------------------------------------------------------------------------------------
  // Building

  /** Redraws the terrain for the current shift mode, plus a faint ghost of the opposite state. */
  private drawTerrain() {
    const lv = this.level;
    const t = this.terrain.clear();
    const g = this.ghost.clear();
    for (let c = 0; c < lv.cols; c++) {
      const s = stateAt(this.shift, c);
      const ink = s === 0 ? COLORS.ink : COLORS.inkShift;
      for (let r = 0; r < lv.rows; r++) {
        const v = lv.grids[s][r * lv.cols + c];
        if (v) {
          t.fillStyle(v === HAZARD ? COLORS.hazard : ink, v === DECO ? 0.45 : 1);
          t.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
        const o = lv.grids[1 - s][r * lv.cols + c];
        if (o) {
          g.fillStyle(o === HAZARD ? COLORS.hazard : COLORS.ghost, 1);
          g.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
    }
    // Split levels: a dashed line marks where the shifted side begins.
    const sl = this.splitLine.clear();
    const k = this.shift.kind;
    if (k === LEFT || k === RIGHT) {
      const x = (k === LEFT ? this.shift.at : this.shift.at + 1) * ADVANCE * TILE - TILE / 2;
      sl.fillStyle(COLORS.accent, 0.5);
      for (let y = -TILE * 2; y < lv.heightPx + TILE * 2; y += 6) sl.fillRect(x - 0.5, y, 1, 3);
      // Soft tint over the side that changed.
      sl.fillStyle(COLORS.accent, 0.04);
      if (k === LEFT) sl.fillRect(-W, -TILE * 2, x + W, lv.heightPx + TILE * 4);
      else sl.fillRect(x, -TILE * 2, lv.widthPx - x + W, lv.heightPx + TILE * 4);
    }
  }

  private createGoal() {
    const g = this.add.graphics();
    const glow = this.add.circle(TILE * 2.5, TILE * 3.5, 22, COLORS.goal, 0.18);
    g.fillStyle(COLORS.goal, 1);
    PILCROW.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && g.fillRect(c * TILE, r * TILE, TILE, TILE)));
    const { x, y } = this.level.goal;
    this.goal = this.add.container(x, y - TILE * 0.5, [glow, g]).setDepth(3);
    this.tweens.add({ targets: this.goal, y: y - TILE * 0.5 - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: glow, scale: 1.25, alpha: 0.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private createHud(title: string, hint?: string) {
    const d = 50;
    // The level counter stays put; only the title shifts with the world.
    const counter = new PixelText(this, 40, 13, `${this.index + 1}/${LEVELS.length}`, 1, COLORS.uiMuted).setScrollFactor(0).setDepth(d);
    this.hudTitle = new PixelText(this, 40 + counter.width + 12, 13, title, 1, COLORS.ui).setScrollFactor(0).setDepth(d);
    this.hudDeaths = new PixelText(this, W - 70, 13, '', 1, COLORS.uiMuted, 'right').setScrollFactor(0).setDepth(d);
    this.keycap = this.add.graphics().setScrollFactor(0).setDepth(d);
    const labels = this.level.split ? ['l shift', 'r shift'] : ['shift'];
    this.keycapTexts = labels.map((l, i) => new PixelText(this, this.keycapX(i) + 24, 12, l, 1, COLORS.ui, 'center').setScrollFactor(0).setDepth(d + 1));
    if (this.level.split) this.hudDeaths.x = W - 126;
    if (hint) this.hint = new PixelText(this, W / 2, H - 18, hint, 1, COLORS.uiMuted, 'center').setScrollFactor(0).setDepth(d);
    this.updateDeaths();
  }

  private keycapX(i: number) {
    return this.level.split ? W - 112 + i * 54 : W - 60;
  }

  private drawKeycap() {
    const k = this.shift.kind;
    const g = this.keycap.clear();
    this.keycapTexts.forEach((txt, i) => {
      const on = this.level.split ? (i === 0 ? k === LEFT : k === RIGHT) : k !== NONE;
      const x = this.keycapX(i);
      const y = 8;
      const w = 48;
      const h = 16;
      g.fillStyle(COLORS.ui, 1);
      g.fillRect(x, y + 2, w, h); // key side
      g.fillStyle(on ? COLORS.accent : COLORS.paper, 1);
      g.fillRect(x, y + (on ? 2 : 0), w, h - 2);
      g.lineStyle(1, COLORS.ui, 1);
      g.strokeRect(x + 0.5, y + (on ? 2 : 0) + 0.5, w - 1, h - 3);
      txt.y = on ? 14 : 12;
      txt.setColor(on ? COLORS.white : COLORS.ui).setShift(on);
    });
  }

  private updateDeaths() {
    const n = load().deaths[this.index] ?? 0;
    this.hudDeaths.setText(n ? `deaths ${n}` : '');
  }

  private createPause() {
    const d = 80;
    this.pauseLayer = this.add.rectangle(0, 0, W, H, COLORS.paper, 0.94).setOrigin(0).setScrollFactor(0).setDepth(d).setVisible(false);
    this.pauseTitle = new PixelText(this, W / 2, 90, 'paused', 3, COLORS.ui, 'center').setScrollFactor(0).setDepth(d + 1).setVisible(false);
    this.pauseMenu = new Menu(
      this,
      [
        { label: () => 'resume', action: () => this.setPaused(false) },
        { label: () => 'restart level', action: () => (this.setPaused(false), this.respawn(false)) },
        { label: () => 'level select', action: () => this.goTo('levels') },
        { label: () => `sound ${sound.isMuted() ? 'off' : 'on'}`, action: () => this.toggleMute() },
      ],
      W / 2,
      150,
      24,
      2,
      d + 1,
      () => sound.select(),
    );
    this.pauseMenu.setVisible(false);
  }

  // ---------------------------------------------------------------------------------------------
  // Flow

  private spawn() {
    const { x, y } = this.level.spawn;
    this.player.reset(x, y, UNSHIFTED);
    this.shift = this.wantedShift();
    this.player.setMode(this.shift);
    this.drawTerrain();
    this.player.events.length = 0;
    this.sprite.setVisible(true).setScale(1);
    this.time0 = this.time.now;
    this.elapsed = 0;
  }

  private respawn(fromDeath: boolean) {
    this.mode = 'play';
    this.spawn();
    this.sprite.setScale(0.4, 1.6);
    this.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
    if (!fromDeath) this.cameras.main.flash(120, 244, 239, 228);
  }

  private die() {
    this.mode = 'dead';
    sound.die();
    const cx = this.player.x + PHYS.w / 2;
    const cy = this.player.y + PHYS.h / 2;
    this.burst.explode(26, cx, cy);
    this.sprite.setVisible(false);
    this.cameras.main.shake(140, 0.006);
    const data = load();
    data.deaths[this.index] = (data.deaths[this.index] ?? 0) + 1;
    save(data);
    this.updateDeaths();
    this.time.delayedCall(520, () => this.mode === 'dead' && this.respawn(true));
  }

  private win() {
    this.mode = 'won';
    this.elapsed = this.time.now - this.time0;
    sound.goal();
    const { x, y, w, h } = this.level.goal;
    this.sparkle.explode(40, x + w / 2, y + h / 2);
    this.tweens.add({ targets: this.goal, scale: 1.6, alpha: 0, duration: 400, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: this.sprite, y: this.sprite.y - 10, duration: 180, yoyo: true, ease: 'Quad.easeOut' });

    const data = load();
    data.unlocked = Math.max(data.unlocked, Math.min(LEVELS.length, this.index + 2));
    const prev = data.best[this.index];
    if (!prev || this.elapsed < prev) data.best[this.index] = Math.round(this.elapsed);
    save(data);

    this.time.delayedCall(550, () => this.showWinPanel());
  }

  private showWinPanel() {
    const d = 70;
    const def = LEVELS[this.index];
    const layer = this.add.rectangle(0, 0, W, H, COLORS.paper, 0).setOrigin(0).setScrollFactor(0).setDepth(d);
    this.tweens.add({ targets: layer, fillAlpha: 0.94, duration: 250 });
    const label = new PixelText(this, W / 2, 110, `line ${this.index + 1} of the letter`, 1, COLORS.uiMuted, 'center').setScrollFactor(0).setDepth(d + 1);
    const scale = textWidth(def.letter, 2) > W - 60 ? 1 : 2;
    this.winLetter = new PixelText(this, W / 2, 150, '', scale, COLORS.ink, 'center').setScrollFactor(0).setDepth(d + 1);
    const deaths = load().deaths[this.index] ?? 0;
    const stats = new PixelText(this, W / 2, 200, `time ${(this.elapsed / 1000).toFixed(1)}s     deaths ${deaths}`, 1, COLORS.uiMuted, 'center').setScrollFactor(0).setDepth(d + 1);
    const last = this.index === LEVELS.length - 1;
    const prompt = new PixelText(this, W / 2, 250, `space  ${last ? 'read the letter' : 'next'}      r  replay      esc  levels`, 1, COLORS.accent, 'center')
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setAlpha(0);
    this.winLayer = [layer, label.g, stats.g, prompt.g, this.winLetter.g];

    // Type the letter out one character at a time, like it's being written right now.
    const full = def.letter;
    this.typed = 0;
    this.typeTimer = this.time.addEvent({
      delay: 38,
      repeat: full.length - 1,
      startAt: -300,
      callback: () => {
        this.typed++;
        this.winLetter?.setText(full.slice(0, this.typed));
        if (full[this.typed - 1] !== ' ') sound.type();
        if (this.typed >= full.length) this.tweens.add({ targets: prompt.g, alpha: 1, duration: 300 });
      },
    });
  }

  private nextLevel() {
    if (this.index >= LEVELS.length - 1) return this.goTo('end');
    sound.confirm();
    this.cameras.main.fadeOut(200, 244, 239, 228);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ index: this.index + 1 }));
  }

  private goTo(key: string) {
    sound.confirm();
    this.cameras.main.fadeOut(200, 244, 239, 228);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key));
  }

  private setPaused(p: boolean) {
    this.mode = p ? 'paused' : 'play';
    this.pauseLayer.setVisible(p);
    this.pauseTitle.setVisible(p);
    this.pauseMenu.setVisible(p);
    if (p) this.pauseMenu.index = 0;
    this.pauseMenu.refresh();
    sound.select();
  }

  private toggleMute() {
    const data = load();
    data.muted = !sound.isMuted();
    save(data);
    sound.setMuted(data.muted);
    this.pauseMenu.refresh();
  }

  // ---------------------------------------------------------------------------------------------
  // Shift

  /** The shift mode the keys ask for. Split points are taken from where the player stands. */
  private wantedShift(): ShiftMode {
    let kind: ShiftKind = NONE;
    if (!this.level.split) kind = input.isDown('shift') ? ALL : NONE;
    else {
      const l = input.isDown('shiftLeft');
      const r = input.isDown('shiftRight');
      // Both held: keep whichever side was already active (there is no "shift everything" here).
      kind = l && r ? (this.shift.kind === NONE ? LEFT : this.shift.kind) : l ? LEFT : r ? RIGHT : NONE;
    }
    if (kind === this.shift.kind) return this.shift;
    const at = kind === LEFT || kind === RIGHT ? charIndexAt(this.player.x + PHYS.w / 2) : 0;
    return { kind, at };
  }

  private setShift(mode: ShiftMode) {
    const wasOn = this.shift.kind !== NONE;
    this.shift = mode;
    if (this.mode === 'play') this.player.setMode(mode);
    else this.player.mode = mode;
    const on = mode.kind !== NONE;
    if (on !== wasOn || this.level.split) sound.shift(on);
    sound.setShift(on);
    this.drawTerrain();
    this.applyShiftVisuals(false);
  }

  private applyShiftVisuals(instant: boolean) {
    this.tweens.killTweensOf(this.terrain);
    if (instant) this.terrain.setAlpha(1);
    else {
      // Gameplay already changed this frame; the new shapes just fade in over a few frames.
      this.terrain.setAlpha(0.45);
      this.tweens.add({ targets: this.terrain, alpha: 1, duration: 70 });
    }
    const on = this.shift.kind !== NONE;
    this.drawKeycap();
    this.hudTitle.setShift(on);
    this.hint?.setShift(on);
    this.pauseTitle.setShift(on);
  }

  // ---------------------------------------------------------------------------------------------
  // Frame

  update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs / 1000, 1 / 20);
    this.frame(dt);
    input.endFrame();
  }

  private frame(dt: number) {
    if (input.wasPressed('mute')) this.toggleMute();

    const want = this.wantedShift();
    if (want !== this.shift) this.setShift(want);
    this.paperTint(this.shift.kind === NONE ? 0 : 1, dt);

    if (this.mode === 'paused') {
      if (input.wasPressed('pause')) return this.setPaused(false);
      if (input.wasPressed('up')) this.pauseMenu.move(-1);
      if (input.wasPressed('down')) this.pauseMenu.move(1);
      if (input.wasPressed('confirm')) this.pauseMenu.activate();
      this.pauseMenu.update(dt, this.shift.kind !== NONE);
      return;
    }

    if (this.mode === 'won') {
      const done = this.winLetter && this.typed >= LEVELS[this.index].letter.length;
      if (input.wasPressed('confirm')) {
        if (done) this.nextLevel();
        else if (this.winLetter) {
          // Skip the typing animation.
          this.typeTimer?.remove();
          this.typed = LEVELS[this.index].letter.length;
          this.winLetter.setText(LEVELS[this.index].letter);
          this.winLayer.forEach((o) => this.tweens.add({ targets: o, alpha: 1, duration: 150 }));
        }
      } else if (input.wasPressed('restart') && this.winLetter) this.scene.restart({ index: this.index });
      else if (input.wasPressed('back') && this.winLetter) this.goTo('levels');
      this.renderPlayer(dt);
      this.followCamera(dt);
      return;
    }

    if (input.wasPressed('pause')) return this.setPaused(true);
    if (input.wasPressed('restart')) this.respawn(false);

    if (this.intro > 0) {
      this.intro -= dt;
      if (input.isDown('left') || input.isDown('right') || input.wasPressed('jump')) this.intro = Math.min(this.intro, 0.0);
    }

    if (this.mode === 'play') {
      if (input.wasPressed('jump')) this.pendingJump = true;
      const inp = { left: input.isDown('left'), right: input.isDown('right'), jump: input.isDown('jump'), jumpPressed: false };
      this.acc += dt;
      while (this.acc >= STEP) {
        inp.jumpPressed = this.pendingJump;
        this.pendingJump = false;
        this.player.update(STEP, inp);
        this.acc -= STEP;
        if (this.player.dead) break;
      }
      if (this.hint && (inp.left || inp.right) && this.index > 0) this.tweens.add({ targets: this.hint.g, alpha: 0.5, duration: 400 });
    }
    this.handleEvents();
    this.renderPlayer(dt);
    this.followCamera(dt);
  }

  private handleEvents() {
    const p = this.player;
    const cx = p.x + PHYS.w / 2;
    const feet = p.y + PHYS.h;
    for (const e of p.events) {
      switch (e) {
        case 'jump':
          sound.jump();
          this.dust.explode(5, cx, feet);
          this.tweens.killTweensOf(this.sprite);
          this.sprite.setScale(0.7, 1.35);
          this.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 220, ease: 'Quad.easeOut' });
          break;
        case 'land':
          sound.land();
          this.dust.explode(6, cx, feet);
          this.tweens.killTweensOf(this.sprite);
          this.sprite.setScale(1.35, 0.7);
          this.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' });
          break;
        case 'step':
          if (this.stepSoundCd <= 0) {
            sound.step();
            this.stepSoundCd = 0.09;
          }
          break;
        case 'bonk':
          sound.bonk();
          break;
        case 'die':
          if (this.mode === 'play') this.die();
          break;
        case 'goal':
          if (this.mode === 'play') this.win();
          break;
      }
    }
    p.events.length = 0;
  }

  private renderPlayer(dt: number) {
    const p = this.player;
    this.stepSoundCd -= dt;
    const running = p.grounded && Math.abs(p.vx) > 30 && this.mode === 'play';
    this.runT = running ? this.runT + dt : 0;
    const bob = running ? -Math.abs(Math.sin(this.runT * 18)) * 1.5 : 0;
    this.sprite.setPosition(Math.round(p.x + PHYS.w / 2), Math.round(p.y + PHYS.h + p.smoothY + bob));
    this.sprite.setFlipX(p.facing < 0);
    this.sprite.setRotation(p.grounded ? 0 : Phaser.Math.Clamp(p.vx / PHYS.run, -1, 1) * 0.08);
  }

  private camTarget() {
    const p = this.player;
    const lv = this.level;
    const padX = 72;
    const onGoal = this.intro > 0.7;
    const fx = onGoal ? lv.goal.x + lv.goal.w / 2 : p.x + PHYS.w / 2 + p.facing * 40;
    const fy = onGoal ? lv.goal.y + lv.goal.h / 2 : p.y + PHYS.h / 2;
    let tx = fx - W / 2;
    const minX = -padX;
    const maxX = lv.widthPx + padX - W;
    tx = maxX < minX ? (lv.widthPx - W) / 2 : Phaser.Math.Clamp(tx, minX, maxX);
    let ty = fy - H / 2 + 20;
    const minY = -70;
    const maxY = lv.heightPx + 60 - H;
    ty = maxY < minY ? (lv.heightPx - H) / 2 + 10 : Phaser.Math.Clamp(ty, minY, maxY);
    return { tx, ty };
  }

  private snapCamera() {
    const { tx, ty } = this.camTarget();
    this.cameras.main.setScroll(tx, ty);
  }

  private followCamera(dt: number) {
    const cam = this.cameras.main;
    const { tx, ty } = this.camTarget();
    const k = 1 - Math.exp(-dt * 4.5);
    cam.setScroll(cam.scrollX + (tx - cam.scrollX) * k, cam.scrollY + (ty - cam.scrollY) * k);
  }
}
