import { PHYS, TILE } from './config';
import { BuiltLevel, HAZARD, SOLID, UNSHIFTED, cellAt, type ShiftMode } from './level';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean; // held
  jumpPressed: boolean; // pressed this frame
}

export type PlayerEvent = 'jump' | 'land' | 'step' | 'bonk' | 'die' | 'goal';

/**
 * Platformer body on a tile grid. Custom instead of Arcade Physics so we get exact control over
 * step-up, corner nudging and being pushed out of letters that grow into us.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  grounded = false;
  facing = 1;
  dead = false;
  /** Visual-only vertical offset, eases out step-ups and push-outs so they don't look like teleports. */
  smoothY = 0;
  private coyote = 0;
  private buffer = 0;
  private jumping = false;
  events: PlayerEvent[] = [];

  mode: ShiftMode = UNSHIFTED;

  constructor(private level: BuiltLevel) {}

  reset(x: number, y: number, mode: ShiftMode) {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    this.grounded = false;
    this.dead = false;
    this.smoothY = 0;
    this.coyote = this.buffer = 0;
    this.jumping = false;
    this.mode = mode;
  }

  update(dt: number, input: InputState) {
    if (this.dead) return;
    const wasGrounded = this.grounded;

    // Horizontal: quick acceleration with a little slide so it never feels stiff.
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir;
    const target = dir * PHYS.run;
    const accel = dir === 0 ? (this.grounded ? PHYS.decelGround : PHYS.accelAir * 0.6) : this.grounded ? PHYS.accelGround : PHYS.accelAir;
    this.vx = approach(this.vx, target, accel * dt);

    // Jump: buffered presses and coyote time.
    if (input.jumpPressed) this.buffer = PHYS.jumpBuffer;
    else this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? PHYS.coyote : Math.max(0, this.coyote - dt);

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -Math.sqrt(2 * PHYS.gravity * PHYS.jumpHeight);
      this.buffer = this.coyote = 0;
      this.grounded = false;
      this.jumping = true;
      this.events.push('jump');
    }
    if (this.jumping && !input.jump && this.vy < 0) {
      this.vy *= PHYS.jumpCut;
      this.jumping = false;
    }
    if (this.vy >= 0) this.jumping = false;

    let g = PHYS.gravity;
    if (input.jump && Math.abs(this.vy) < PHYS.apexThreshold) g *= PHYS.apexGravityScale;
    this.vy = Math.min(PHYS.maxFall, this.vy + g * dt);

    this.moveX(this.vx * dt);
    this.moveY(this.vy * dt);

    this.grounded = this.vy >= 0 && this.collides(this.x, this.y + 1);
    if (this.grounded && !wasGrounded) this.events.push('land');

    this.smoothY *= Math.exp(-dt * 22);
    if (Math.abs(this.smoothY) < 0.05) this.smoothY = 0;

    this.checkDanger();
  }

  /** Called when Shift flips the world. Pushes the player out of anything that grew into them. */
  setMode(mode: ShiftMode) {
    this.mode = mode;
    if (this.dead || !this.collides(this.x, this.y)) {
      this.checkDanger();
      return;
    }
    // Find a free spot. Prefer being lifted (feels like the letter carrying you), then sliding
    // sideways, and only nudge down a little: never push the player through a floor.
    const tries: [number, number][] = [];
    for (let d = 1; d <= 24; d++) tries.push([0, -d]);
    for (let d = 1; d <= 16; d++) tries.push([-d, 0], [d, 0], [-d, -d], [d, -d]);
    for (let d = 1; d <= 4; d++) tries.push([0, d]);
    for (const [dx, dy] of tries) {
      if (!this.collides(this.x + dx, this.y + dy)) {
        this.x += dx;
        this.y += dy;
        this.smoothY -= dy;
        if (dy < 0) this.vy = Math.min(this.vy, 0);
        this.checkDanger();
        return;
      }
    }
    this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.events.push('die');
  }

  private checkDanger() {
    if (this.dead) return;
    // Hazards use a slightly smaller box so grazing a spike corner is forgiven.
    if (this.overlaps(this.x + 2, this.y + 3, PHYS.w - 4, PHYS.h - 4, HAZARD)) this.die();
    if (this.y > this.level.heightPx + 40) this.die();
    const g = this.level.goal;
    if (!this.dead && this.x < g.x + g.w && this.x + PHYS.w > g.x && this.y < g.y + g.h && this.y + PHYS.h > g.y)
      this.events.push('goal');
  }

  private moveX(dx: number) {
    const steps = Math.ceil(Math.abs(dx) / 2);
    const sx = dx / Math.max(steps, 1);
    for (let i = 0; i < steps; i++) {
      const nx = this.x + sx;
      if (!this.collides(nx, this.y)) {
        this.x = nx;
        continue;
      }
      // Step up small ledges while on the ground (walking over letter bumps).
      if (this.grounded || this.coyote > 0) {
        let stepped = false;
        for (let up = 1; up <= PHYS.stepUp; up++) {
          if (!this.collides(nx, this.y - up)) {
            this.x = nx;
            this.y -= up;
            this.smoothY += up;
            stepped = true;
            this.events.push('step');
            break;
          }
        }
        if (stepped) continue;
      }
      this.vx = 0;
      break;
    }
    // Keep inside the page horizontally.
    const max = this.level.widthPx - PHYS.w;
    if (this.x < 0) (this.x = 0), (this.vx = 0);
    if (this.x > max) (this.x = max), (this.vx = 0);
  }

  private moveY(dy: number) {
    const steps = Math.ceil(Math.abs(dy) / 2);
    const sy = dy / Math.max(steps, 1);
    for (let i = 0; i < steps; i++) {
      const ny = this.y + sy;
      if (!this.collides(this.x, ny)) {
        this.y = ny;
        continue;
      }
      if (sy < 0) {
        // Rising into a ceiling: slide around a corner if we only clipped its edge.
        for (let n = 1; n <= PHYS.cornerNudge; n++) {
          for (const s of [-1, 1]) {
            if (!this.collides(this.x + s * n, ny)) {
              this.x += s * n;
              this.y = ny;
              return;
            }
          }
        }
        this.events.push('bonk');
      } else {
        // Snap flush to the floor.
        this.y = Math.floor(this.y);
        while (!this.collides(this.x, this.y + 1)) this.y += 1;
      }
      this.vy = 0;
      this.jumping = false;
      break;
    }
  }

  collides(x: number, y: number) {
    return this.overlaps(x, y, PHYS.w, PHYS.h, SOLID);
  }

  private overlaps(x: number, y: number, w: number, h: number, kind: number) {
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + w - 0.001) / TILE);
    const r0 = Math.floor(y / TILE);
    const r1 = Math.floor((y + h - 0.001) / TILE);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) if (cellAt(this.level, this.mode, c, r) === kind) return true;
    return false;
  }
}

function approach(v: number, target: number, amount: number) {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
}
