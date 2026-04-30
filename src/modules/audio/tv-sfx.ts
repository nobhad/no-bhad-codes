/**
 * ===============================================
 * TV SOUND EFFECTS
 * ===============================================
 * @file src/modules/audio/tv-sfx.ts
 *
 * Procedural sound effects for the projects-page vintage TV. Uses
 * WebAudio synthesis (no asset files):
 *   - static(): white-noise burst with band-pass coloring + envelope,
 *     fired when a channel changes (matches the visual static flash).
 *   - beep(): short sine tone, fired on channel-up (▲) cycle.
 *
 * Volume is shared between both effects via a single master gain node.
 * Levels persist to localStorage so the next visit remembers. AudioContext
 * is lazily created on first use and resumed if suspended (modern browsers
 * require a user gesture to start audio).
 *
 * Singleton because there's only ever one TV; multiple instances would
 * each pay the AudioContext setup cost and fight over the gain node.
 */

const STORAGE_KEY = 'tv-sfx-volume';
const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1.0];
const DEFAULT_VOLUME = 0.5;

const STATIC_DURATION_S = 0.18;
const BEEP_DURATION_S = 0.08;
const BEEP_FREQUENCY_HZ = 880;

class TvSfx {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = DEFAULT_VOLUME;
  // Cached noise buffer — reused for every static() call. ~1s of pink-ish
  // noise at sample-rate; static() picks a random offset and slices a
  // short window so each crackle sounds distinct.
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    this.volume = this.loadVolume();
  }

  /** Current volume level (0..1). */
  getVolume(): number {
    return this.volume;
  }

  /** Step volume up to next level; clamps at 1.0. */
  stepUp(): number {
    const next = this.nextStep(+1);
    this.setVolume(next);
    return next;
  }

  /** Step volume down to next level; clamps at 0. */
  stepDown(): number {
    const next = this.nextStep(-1);
    this.setVolume(next);
    return next;
  }

  /** Set volume directly to a discrete step (snapped to nearest). */
  setVolume(level: number): void {
    const snapped = this.snapToStep(level);
    this.volume = snapped;
    if (this.masterGain) {
      // ramp to avoid pops on abrupt change.
      const now = this.ctx?.currentTime ?? 0;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(snapped, now + 0.02);
    }
    this.saveVolume(snapped);
  }

  /** Channel-change static crackle. Filtered white noise with fast attack
      and slow release, ~180ms total. No-op when volume is 0. */
  async static(): Promise<void> {
    if (this.volume === 0) return;
    const ctx = await this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const buffer = this.getNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Random start offset so each crackle differs.
    const maxOffset = Math.max(0, buffer.duration - STATIC_DURATION_S);
    source.start(0, Math.random() * maxOffset);

    // Band-pass filter so the noise sounds like CRT static rather than
    // pure white noise — center around 1.5kHz with moderate Q.
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.7;

    // Per-shot envelope: very fast attack, gentle release.
    const env = ctx.createGain();
    const now = ctx.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.6, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, now + STATIC_DURATION_S);

    source.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    source.stop(now + STATIC_DURATION_S);
  }

  /** Channel-up beep — short sine tone. No-op when volume is 0. */
  async beep(): Promise<void> {
    if (this.volume === 0) return;
    const ctx = await this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = BEEP_FREQUENCY_HZ;

    // Soft envelope so the tone doesn't click.
    const env = ctx.createGain();
    const now = ctx.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.4, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + BEEP_DURATION_S);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + BEEP_DURATION_S);
  }

  // --------------------------------------------------------------------
  // internal helpers
  // --------------------------------------------------------------------

  private async ensureContext(): Promise<AudioContext | null> {
    if (this.ctx) {
      // Resume if suspended (autoplay policy may park it after user idle).
      if (this.ctx.state === 'suspended') {
        try {
          await this.ctx.resume();
        } catch {
          return null;
        }
      }
      return this.ctx;
    }
    try {
      // Webkit prefix kept in the constructor lookup for older Safari.
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const masterGain = ctx.createGain();
      masterGain.gain.value = this.volume;
      masterGain.connect(ctx.destination);
      this.ctx = ctx;
      this.masterGain = masterGain;
      // Some browsers create the context in 'suspended' state until the
      // first user gesture explicitly resumes it.
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // Resume may reject if no user gesture yet — that's fine; the
          // call still goes through silently and the next gesture will
          // unlock playback.
        }
      }
      return ctx;
    } catch {
      return null;
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = ctx.sampleRate; // 1 second of noise
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private snapToStep(level: number): number {
    let nearest = VOLUME_STEPS[0];
    let bestDist = Math.abs(level - nearest);
    for (const step of VOLUME_STEPS) {
      const d = Math.abs(level - step);
      if (d < bestDist) {
        bestDist = d;
        nearest = step;
      }
    }
    return nearest;
  }

  private nextStep(delta: 1 | -1): number {
    const idx = VOLUME_STEPS.indexOf(this.snapToStep(this.volume));
    const nextIdx = Math.max(0, Math.min(VOLUME_STEPS.length - 1, idx + delta));
    return VOLUME_STEPS[nextIdx];
  }

  private loadVolume(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null) return DEFAULT_VOLUME;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return DEFAULT_VOLUME;
      return this.snapToStep(parsed);
    } catch {
      return DEFAULT_VOLUME;
    }
  }

  private saveVolume(level: number): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(level));
    } catch {
      // localStorage may be unavailable (private browsing, full quota).
      // Volume just won't persist this session — non-fatal.
    }
  }
}

export const tvSfx = new TvSfx();
