// All sound is synthesized with WebAudio: no asset files, tiny build, and it can react to Shift
// (the music moves up a fourth while Shift is held).

type Wave = OscillatorType;

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]; // major pentatonic over two octaves
const ROOT = 57; // A3

class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private delay!: DelayNode;
  private muted = false;
  private musicOn = false;
  private nextNote = 0;
  private beatIndex = 0;
  private transpose = 0;
  private timer: number | null = null;

  /** Must be called from a user gesture (browsers block audio before one). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.5;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.16;
    this.delay = this.ctx.createDelay(1);
    this.delay.delayTime.value = 0.375;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.35;
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.delay);
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.master);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  isMuted() {
    return this.muted;
  }

  private tone(freq: number, dur: number, opts: { wave?: Wave; to?: number; vol?: number; delay?: number; bus?: GainNode } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.delay ?? 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.wave ?? 'square';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.vol ?? 0.3, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(opts.bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq = 2000) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
  }

  jump() { this.tone(330, 0.12, { to: 620, vol: 0.18 }); }
  land() { this.noise(0.05, 0.35, 900); }
  step() { this.noise(0.025, 0.12, 2400); }
  bonk() { this.tone(160, 0.08, { wave: 'triangle', vol: 0.3 }); }
  /** The typewriter-ish clack of a Shift key, pitched by direction. */
  shift(on: boolean) {
    this.noise(0.04, 0.5, on ? 3200 : 2200);
    this.tone(on ? 440 : 330, 0.09, { wave: 'triangle', to: on ? 660 : 220, vol: 0.2 });
  }
  die() {
    this.tone(420, 0.35, { wave: 'sawtooth', to: 60, vol: 0.22 });
    this.noise(0.25, 0.3, 600);
  }
  goal() {
    [0, 4, 7, 12].forEach((s, i) => this.tone(midi(69 + s), 0.4, { wave: 'triangle', vol: 0.25, delay: i * 0.08 }));
  }
  type() { this.noise(0.03, 0.4, 2800 + Math.random() * 800); }
  select() { this.tone(660, 0.06, { wave: 'square', vol: 0.12 }); }
  confirm() { this.tone(523, 0.08, { wave: 'square', vol: 0.15 }); this.tone(784, 0.12, { wave: 'square', vol: 0.15, delay: 0.07 }); }

  setShift(on: boolean) {
    this.transpose = on ? 5 : 0;
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  // Gentle generative arpeggio: a slow walk over the pentatonic scale with a bass note per bar.
  private schedule() {
    if (!this.ctx) return;
    const beat = 0.375;
    while (this.nextNote < this.ctx.currentTime + 0.2) {
      const delay = this.nextNote - this.ctx.currentTime;
      const bar = Math.floor(this.beatIndex / 8) % 4;
      const chord = [0, 5, 3, 4][bar]; // I vi IV V-ish, as scale offsets
      const pattern = [0, 2, 4, 2, 5, 4, 2, 4];
      const idx = (chord + pattern[this.beatIndex % 8]) % SCALE.length;
      const note = ROOT + 12 + SCALE[idx] + this.transpose;
      if (Math.random() > 0.12) this.tone(midi(note), 0.5, { wave: 'triangle', vol: 0.22, delay, bus: this.musicBus });
      if (this.beatIndex % 8 === 0) this.tone(midi(ROOT - 12 + SCALE[chord % 5] + this.transpose), 1.6, { wave: 'sine', vol: 0.5, delay, bus: this.musicBus });
      this.nextNote += beat;
      this.beatIndex++;
    }
  }
}

function midi(n: number) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

export const sound = new Sound();
