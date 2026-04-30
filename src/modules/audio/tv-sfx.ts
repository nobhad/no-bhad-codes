/**
 * ===============================================
 * TV SOUND EFFECTS
 * ===============================================
 * @file src/modules/audio/tv-sfx.ts
 *
 * Two sounds on two independent gain stages:
 *
 *   - click(): mechanical click sample. Fires on any press of a TV
 *     button (.crt-tv__btn — POWER, CHANNEL ▼▲, VOLUME ▼▲) via a
 *     delegated document listener. Routes through a FIXED clickGain —
 *     the VOLUME ▼▲ buttons do NOT change its level. Tactile feedback
 *     should always be present and consistent regardless of the user's
 *     volume preference. Sample: "Button" by Mike Koenig
 *     (soundbible.com/772-Button.html), CC Attribution 3.0.
 *   - static(): TV static sample. Fires on TV channel changes AND on
 *     TV power-on (off → on). Plays a short slice from a 4s recording
 *     with a fade-in/out envelope so the cut feels natural. Routes
 *     through masterGain which IS governed by VOLUME ▼▲. Sample: "TV
 *     Static" by Mike Koenig (soundbible.com/1611-TV-Static.html),
 *     CC Attribution 3.0.
 *
 * Both samples require ATTRIBUTION somewhere user-visible (footer /
 * about / credits) — they're both Mike Koenig under CC BY 3.0.
 *
 * Volume persists to localStorage. AudioContext is lazily created on
 * first use and resumed if suspended (browsers require a user gesture).
 *
 * Singleton — one TV, one of each gain stage.
 */

const STORAGE_KEY = 'tv-sfx-volume';
const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1.0];
const DEFAULT_VOLUME = 0.5;

const CLICK_SAMPLE_URL = '/audio/channel-click.mp3';
const TV_BUTTON_SELECTOR = '.crt-tv__btn';

// Fixed gain for the mechanical click. NOT controlled by VOLUME ▼▲ —
// see the file header. Set well under 1.0 because the raw button
// sample is loud and we want a soft tactile feel, not a clack.
const CLICK_FIXED_GAIN = 0.22;

// Debounce window — guards against double-fire if click() is called
// twice in quick succession from the same gesture.
const CLICK_DEBOUNCE_MS = 30;

// TV static sample params. Plays a slice from the 4s recording (random
// offset so each play differs slightly). Envelope = ATTACK → HOLD →
// RELEASE; total duration is the sum. Tuned subtle — the static is an
// ambient detail under the visual flash, not a foreground sound.
//
// Defaults below are the power-on shape (gentle ease, brief hold, long
// trail). Channel-change callers pass a short / zero hold so the fade
// starts right after the attack — a snappier "wipe" feel that matches
// the faster visual flash on channel cycles.
const STATIC_SAMPLE_URL = '/audio/tv-static.mp3';
const STATIC_DEFAULT_ATTACK_S = 0.18;
const STATIC_DEFAULT_HOLD_S = 0.27;
const STATIC_DEFAULT_RELEASE_S = 0.55;
const STATIC_DEFAULT_PEAK_GAIN = 0.05;

interface StaticOptions {
  attackS?: number;
  holdS?: number;
  releaseS?: number;
  peakGain?: number;
  // Optional "step-down" stage between hold and release: after the
  // initial peak hold, drop to peakGain * dropToFraction over
  // dropDurationS, then sustain at the quieter level for sustainS
  // before the release fade. Used by channel-change to feel like
  // "loud burst → quiet residual hiss → fade out". Omit for the
  // simple attack/hold/release shape.
  dropToFraction?: number;
  dropDurationS?: number;
  sustainS?: number;
}

class TvSfx {
  private ctx: AudioContext | null = null;
  // Diegetic-TV-audio gain — controlled by VOLUME ▼▲ via setVolume().
  // static() routes through this so the user can dial the channel
  // crackle without affecting the button-click feedback.
  private masterGain: GainNode | null = null;
  // Fixed-level gain for the mechanical click — not user-adjustable.
  // click() routes through this directly to ctx.destination.
  private clickGain: GainNode | null = null;
  private volume: number = DEFAULT_VOLUME;
  // Decoded click sample — fetched + decoded once, reused on every play.
  // Stays null until the first click() call (lazy load) so we don't pay
  // the network/decode cost for visitors who never trigger SFX.
  private clickBuffer: AudioBuffer | null = null;
  private clickLoadPromise: Promise<AudioBuffer | null> | null = null;
  private lastClickAt: number = -Infinity;
  private globalListenerBound: boolean = false;
  // Decoded TV-static sample (~4s). static() plays a short slice from
  // a random offset so back-to-back channel changes don't sound identical.
  private staticBuffer: AudioBuffer | null = null;
  private staticLoadPromise: Promise<AudioBuffer | null> | null = null;

  constructor() {
    this.volume = this.loadVolume();
    if (typeof document !== 'undefined') {
      this.bindGlobalClickListener();
    }
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

  /** Tactile click — fired by the delegated TV-button listener. Routes
      through the FIXED clickGain so the VOLUME ▼▲ buttons don't change
      its level. Debounced so overlapping triggers can't double-fire.
      Always plays regardless of volume setting (the click is also the
      confirmation that VOLUME ▼▲ registered, so it can't be muted). */
  async click(): Promise<void> {
    const now = performance.now();
    if (now - this.lastClickAt < CLICK_DEBOUNCE_MS) return;
    this.lastClickAt = now;

    const ctx = await this.ensureContext();
    if (!ctx || !this.clickGain) return;
    const buffer = await this.loadClickBuffer(ctx);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.clickGain);
    source.start(0);
  }

  /** Channel-change / power-on TV static. Plays a slice from the 4s
      sample with a configurable ATTACK → HOLD → RELEASE envelope.
      Routes through masterGain so the user can dial it down (or mute
      at volume:0) without losing the button click. No-op at volume:0. */
  async static(opts: StaticOptions = {}): Promise<void> {
    if (this.volume === 0) return;
    const ctx = await this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const buffer = await this.loadStaticBuffer(ctx);
    if (!buffer) return;

    const attackS = opts.attackS ?? STATIC_DEFAULT_ATTACK_S;
    const holdS = opts.holdS ?? STATIC_DEFAULT_HOLD_S;
    const releaseS = opts.releaseS ?? STATIC_DEFAULT_RELEASE_S;
    const peakGain = opts.peakGain ?? STATIC_DEFAULT_PEAK_GAIN;
    const dropDurationS = opts.dropDurationS ?? 0;
    const sustainS = opts.sustainS ?? 0;
    const dropFraction = opts.dropToFraction;
    const usesDropStage = dropFraction !== undefined && dropFraction >= 0 && dropFraction < 1;
    const sustainGain = usesDropStage ? peakGain * (dropFraction as number) : peakGain;
    const totalS = attackS + holdS + (usesDropStage ? dropDurationS + sustainS : 0) + releaseS;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Random offset — keep at least totalS of audio left so we don't
    // run off the end of the buffer.
    const maxOffset = Math.max(0, buffer.duration - totalS);
    const offset = Math.random() * maxOffset;
    source.start(0, offset);

    // Envelope shape:
    //   simple: attack → peak hold → linear release
    //   with drop: attack → peak hold → drop ramp → sustain hold → release
    const env = ctx.createGain();
    const now = ctx.currentTime;
    let t = now;
    env.gain.setValueAtTime(0, t);
    t += attackS;
    env.gain.linearRampToValueAtTime(peakGain, t);
    if (holdS > 0) {
      t += holdS;
      env.gain.setValueAtTime(peakGain, t);
    }
    if (usesDropStage) {
      t += dropDurationS;
      env.gain.linearRampToValueAtTime(sustainGain, t);
      if (sustainS > 0) {
        t += sustainS;
        env.gain.setValueAtTime(sustainGain, t);
      }
    }
    t += releaseS;
    env.gain.linearRampToValueAtTime(0, t);

    source.connect(env);
    env.connect(this.masterGain);
    source.stop(now + totalS);
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
      // masterGain — diegetic TV audio (static). Tracks VOLUME ▼▲.
      const masterGain = ctx.createGain();
      masterGain.gain.value = this.volume;
      masterGain.connect(ctx.destination);
      // clickGain — fixed-level mechanical click. Independent of VOLUME
      // so the button click stays present even at volume:0.
      const clickGain = ctx.createGain();
      clickGain.gain.value = CLICK_FIXED_GAIN;
      clickGain.connect(ctx.destination);
      this.ctx = ctx;
      this.masterGain = masterGain;
      this.clickGain = clickGain;
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

  private async loadClickBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.clickBuffer) return this.clickBuffer;
    // Reuse an in-flight load promise if click() is called multiple times
    // in rapid succession — without this, two simultaneous calls would
    // both fetch + decode the same file.
    if (this.clickLoadPromise) return this.clickLoadPromise;
    this.clickLoadPromise = (async () => {
      try {
        const res = await fetch(CLICK_SAMPLE_URL);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(data);
        this.clickBuffer = decoded;
        return decoded;
      } catch {
        return null;
      }
    })();
    return this.clickLoadPromise;
  }

  private async loadStaticBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.staticBuffer) return this.staticBuffer;
    if (this.staticLoadPromise) return this.staticLoadPromise;
    this.staticLoadPromise = (async () => {
      try {
        const res = await fetch(STATIC_SAMPLE_URL);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(data);
        this.staticBuffer = decoded;
        return decoded;
      } catch {
        return null;
      }
    })();
    return this.staticLoadPromise;
  }

  /** Bind a delegated document-level click listener that fires the click
      SFX on TV buttons only (.crt-tv__btn — POWER, CHANNEL ▼▲, VOLUME
      ▼▲). Other <button> elements on the site are unaffected. The TV-
      button selector keeps the sound scoped to the physical-feeling TV
      controls without leaking into form submits, nav, etc. Idempotent. */
  private bindGlobalClickListener(): void {
    if (this.globalListenerBound) return;
    this.globalListenerBound = true;
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tvButton = target.closest(TV_BUTTON_SELECTOR);
      if (!tvButton) return;
      void this.click();
    });
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
