/** Procedural sound effects via Web Audio (no audio files needed). */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private engine?: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode };
  volume = 0.8;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }

  suspend(on: boolean) {
    if (!this.ctx) return;
    if (on) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'lowpass', sweepTo?: number, delay = 0) {
    const c = this.ctx;
    if (!c || gain < 0.01) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private thump(freq: number, dur: number, gain: number, delay = 0) {
    const c = this.ctx;
    if (!c || gain < 0.01) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.4);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Volume falloff by distance from the listener. */
  static att(dist: number, ref = 25) {
    return Math.min(1, ref / Math.max(ref, dist));
  }

  cannon(att = 1) {
    this.thump(45, 0.7, 0.9 * att);
    this.burst(0.5, 1800, 0.7, 0.8 * att, 'lowpass', 200);
    this.burst(0.08, 5000, 0.5, 0.4 * att, 'highpass');
  }

  enemyCannon(att = 1) {
    this.thump(55, 0.5, 0.6 * att);
    this.burst(0.4, 1400, 0.7, 0.55 * att, 'lowpass', 180);
  }

  mg(att = 1) {
    this.burst(0.05, 2400, 1.2, 0.35 * att, 'bandpass');
    this.thump(120, 0.05, 0.2 * att);
  }

  explosion(size = 1, att = 1) {
    this.thump(35, 1.2 * size, Math.min(1, 0.9 * size) * att);
    this.burst(1.4 * size, 900, 0.6, Math.min(1, 0.9 * size) * att, 'lowpass', 80);
    this.burst(0.25, 3000, 0.4, 0.4 * att, 'highpass', undefined, 0.02);
  }

  collapse(att = 1) {
    this.burst(2.5, 600, 0.5, 0.9 * att, 'lowpass', 60);
    for (let i = 0; i < 5; i++) this.burst(0.3, 400 + Math.random() * 400, 1, 0.4 * att, 'lowpass', 100, 0.2 + i * 0.3 + Math.random() * 0.2);
  }

  hit(att = 1) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(900 + Math.random() * 300, t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.18 * att, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
    this.burst(0.12, 3000, 1, 0.3 * att, 'bandpass');
  }

  rocketLaunch(att = 1) {
    this.burst(0.9, 1200, 0.8, 0.5 * att, 'bandpass', 300);
  }

  ui() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.value = 660;
    const g = c.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }

  private laser?: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode };
  /** Continuous laser hum. */
  laserUpdate(on: boolean) {
    const c = this.ctx;
    if (!c) return;
    if (!this.laser) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 180;
      const lfo = c.createOscillator();
      lfo.frequency.value = 28;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 40;
      lfo.connect(lfoGain).connect(osc.frequency);
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 2;
      const gain = c.createGain();
      gain.gain.value = 0;
      osc.connect(f).connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.laser = { osc, lfo, gain };
    }
    this.laser.gain.gain.setTargetAtTime(on ? 0.12 : 0, c.currentTime, 0.04);
  }

  /** Continuous engine rumble; speed 0..1. */
  engineUpdate(speed: number, on: boolean) {
    const c = this.ctx;
    if (!c) return;
    if (!this.engine) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      const osc2 = c.createOscillator();
      osc2.type = 'square';
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      const gain = c.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain).connect(this.master);
      osc.start();
      osc2.start();
      this.engine = { osc, osc2, gain, filter };
    }
    const e = this.engine;
    const t = c.currentTime;
    e.osc.frequency.setTargetAtTime(38 + speed * 30, t, 0.2);
    e.osc2.frequency.setTargetAtTime(19 + speed * 15, t, 0.2);
    e.filter.frequency.setTargetAtTime(160 + speed * 260, t, 0.2);
    e.gain.gain.setTargetAtTime(on ? 0.07 + speed * 0.08 : 0, t, 0.15);
  }
}

export const sfx = new Sfx();
