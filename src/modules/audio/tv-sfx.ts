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
// Includes both the on-frame TV chassis buttons and the external mobile
// channel up/down buttons rendered below the TV. Both classes get the
// tactile click + serve as user-gesture entry points for the
// AudioContext (iOS Safari requires audio to start inside a gesture).
const TV_BUTTON_SELECTOR = '.crt-tv__btn, .projects-tv-channel-btn';

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
// Peak gain for the power-on crackle. Calibrated relative to
// CLICK_FIXED_GAIN (0.22) — the click is the loudest reference the
// user has, and the static should sit clearly below it but still be
// audible on average laptop speakers. Earlier value (0.05) was inaudible
// on anything quieter than studio monitors after passing through
// masterGain (default 0.5).
const STATIC_DEFAULT_PEAK_GAIN = 0.18;

// Per-track gain for channel music — multiplied by masterGain so the
// final effective amplitude at default volume is 0.7 * 0.5 = 0.35.
// Set under 1.0 so the music sits "behind" UI feedback (click 0.22 +
// static crackle ~0.18) instead of competing with it on tune-in.
const MUSIC_DEFAULT_GAIN = 0.7;
const MUSIC_FADE_IN_S = 0.8;
const MUSIC_FADE_OUT_S = 0.45;

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
  // Currently-playing channel music: source + its envelope gain (used
  // to fade the track in/out without affecting masterGain). musicCurrentUrl
  // is the truth source for "which track is on" — also used to ignore
  // late-arriving decode promises if the user has tuned away mid-load.
  // ReturnType of createBufferSource avoids referencing the
  // AudioBufferSourceNode global directly, which our eslint config
  // doesn't include in its DOM globals list (other Web Audio types
  // happen to be there but this one isn't).
  private musicSource: ReturnType<AudioContext['createBufferSource']> | null = null;
  private musicGain: GainNode | null = null;
  private musicCurrentUrl: string | null = null;
  // Decoded buffers per-URL — first play of a track pays fetch+decode,
  // subsequent plays of the same track are instant.
  private musicBufferCache: Map<string, AudioBuffer> = new Map();
  private musicLoadPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  // Eagerly-fetched raw bytes for both samples. Decoding into an
  // AudioBuffer requires a live AudioContext (which we can't create
  // until the first user gesture), so we keep the encoded bytes around
  // and decode lazily on first use. Prefetch turns the first call's
  // critical path from "fetch + decode" (~200-300ms) into "decode only"
  // (~10-50ms), which is the difference between the static crackle
  // landing on the visual cue vs. arriving long after it.
  private clickBytesPromise: Promise<ArrayBuffer | null> | null = null;
  private staticBytesPromise: Promise<ArrayBuffer | null> | null = null;

  constructor() {
    this.volume = this.loadVolume();
    if (typeof document !== 'undefined') {
      this.bindGlobalClickListener();
      this.prefetchSamples();
    }
  }

  /** Fire-and-forget fetch of both audio samples so the bytes are in
      memory before the user's first TV-button click. fetch() doesn't
      need a user gesture or an AudioContext — only decodeAudioData
      does, and that runs lazily inside loadClickBuffer/loadStaticBuffer
      once the ctx exists. Failures are silent: the loaders fall back
      to a normal fetch if the prefetched promise resolves to null. */
  private prefetchSamples(): void {
    const fetchBytes = (url: string): Promise<ArrayBuffer | null> =>
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
    this.clickBytesPromise = fetchBytes(CLICK_SAMPLE_URL);
    this.staticBytesPromise = fetchBytes(STATIC_SAMPLE_URL);
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
    // Broadcast the change so UI affordances (mute indicator on the TV
    // screen, disabled-state on VOLUME ▼/▲ at the extremes) can react
    // without polling.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tv-sfx:volume-change', { detail: { level: snapped } })
      );
    }
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

    // Envelope shape:
    //   simple: attack → peak hold → linear release
    //   with drop: attack → peak hold → drop ramp → sustain hold → release
    // Schedule ramps relative to `now`, then start the source at the
    // same `now` so the source playback head and the envelope are in
    // lock-step. The previous implementation called source.start(0)
    // BEFORE wiring + capturing `now`, which silently dropped the
    // attack ramp on the floor (the source advanced unconnected for a
    // few audio frames, and by the time the connect happened the
    // envelope was already past the linearRamp's anchor — net result:
    // no audible static at all).
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

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(env);
    env.connect(this.masterGain);
    // Random offset — keep at least totalS of audio left so we don't
    // run off the end of the buffer.
    const maxOffset = Math.max(0, buffer.duration - totalS);
    const offset = Math.random() * maxOffset;
    source.start(now, offset);
    source.stop(now + totalS);
  }

  /** Start looping background music for a channel. Idempotent on the
      same URL — calling repeatedly with the same track is a no-op. A
      different URL fades the current track out first. Routes through
      masterGain so VOLUME ▼/▲ and the mute state already control it
      (no separate volume slider needed). Lazy-loads + caches each
      track on first play. */
  async playMusic(url: string): Promise<void> {
    if (this.musicCurrentUrl === url) return;

    // Mark intent immediately so a re-entrant playMusic() (different
    // URL) during the await chain knows we're switching, and so a
    // simultaneous stopMusic() can clear it. Stopping any prior track
    // first ensures only one is audible at a time.
    if (this.musicSource) this.stopMusic();
    this.musicCurrentUrl = url;

    const ctx = await this.ensureContext();
    if (!ctx || !this.masterGain) return;
    // Bail if the user already tuned away (or hit POWER) during the
    // ensureContext await.
    if (this.musicCurrentUrl !== url) return;

    const buffer = await this.loadMusicBuffer(ctx, url);
    if (!buffer) return;
    if (this.musicCurrentUrl !== url) return;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(MUSIC_DEFAULT_GAIN, now + MUSIC_FADE_IN_S);
    gain.connect(this.masterGain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(now);

    this.musicSource = source;
    this.musicGain = gain;
  }

  /** Fade the current music out + stop the source. No-op if no track
      is playing. Safe to call from POWER off, channel-back-to-guide,
      or anywhere else the music should end. */
  stopMusic(): void {
    const src = this.musicSource;
    const gain = this.musicGain;
    this.musicSource = null;
    this.musicGain = null;
    this.musicCurrentUrl = null;
    if (!src || !gain || !this.ctx) return;

    const now = this.ctx.currentTime;
    const stopAt = now + MUSIC_FADE_OUT_S + 0.05;
    // Capture the current envelope value so the fade-out starts from
    // wherever we are (mid fade-in, full gain, etc.) instead of jumping.
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE_OUT_S);
    try {
      src.stop(stopAt);
    } catch {
      // .stop() throws if the source already stopped — ignore.
    }
    // Disconnect after the source actually stops so we don't truncate
    // the fade. Time-based since AudioBufferSourceNode has no clean
    // 'ended' guarantee across browsers when stopped early.
    setTimeout(() => {
      try { src.disconnect(); } catch { /* already disconnected */ }
      try { gain.disconnect(); } catch { /* already disconnected */ }
    }, (MUSIC_FADE_OUT_S + 0.1) * 1000);
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

  /** Get raw audio bytes — preferring the prefetch kicked off in the
      constructor, falling back to a fresh fetch if prefetch failed or
      hasn't been wired up. decodeAudioData may detach the underlying
      buffer in some browsers, so callers should clone via .slice(0)
      before decoding. */
  private async getSampleBytes(
    prefetched: Promise<ArrayBuffer | null> | null,
    url: string
  ): Promise<ArrayBuffer | null> {
    if (prefetched) {
      const bytes = await prefetched;
      if (bytes) return bytes;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.arrayBuffer();
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
        const bytes = await this.getSampleBytes(this.clickBytesPromise, CLICK_SAMPLE_URL);
        if (!bytes) return null;
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
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
        const bytes = await this.getSampleBytes(this.staticBytesPromise, STATIC_SAMPLE_URL);
        if (!bytes) return null;
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        this.staticBuffer = decoded;
        return decoded;
      } catch {
        return null;
      }
    })();
    return this.staticLoadPromise;
  }

  /** Lazy fetch + decode a per-channel music track. Cached by URL —
      re-tuning to the same channel within a session is instant. We do
      NOT eager-prefetch like the click/static samples because music
      files are 1-7 MB each and most visitors only listen to one
      channel; paying the bandwidth up front for tracks they may never
      hear isn't worth it. */
  private async loadMusicBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    const cached = this.musicBufferCache.get(url);
    if (cached) return cached;
    const inFlight = this.musicLoadPromises.get(url);
    if (inFlight) return inFlight;
    const promise = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(data);
        this.musicBufferCache.set(url, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.musicLoadPromises.delete(url);
      }
    })();
    this.musicLoadPromises.set(url, promise);
    return promise;
  }

  /** Bind a delegated document-level click listener that fires the click
      SFX on TV buttons only (.crt-tv__btn — POWER, CHANNEL ▼▲, VOLUME
      ▼▲). Other <button> elements on the site are unaffected. The TV-
      button selector keeps the sound scoped to the physical-feeling TV
      controls without leaking into form submits, nav, etc. Idempotent.

      Also synchronously kicks ctx.resume() on every TV-button click —
      iOS Safari only honors AudioContext resume inside a user gesture
      and only the SYNCHRONOUS portion counts. Any await in the chain
      (loadClickBuffer, decodeAudioData, etc.) puts the resume outside
      the gesture window, so we fire it here without awaiting before any
      other work happens. */
  private bindGlobalClickListener(): void {
    if (this.globalListenerBound) return;
    this.globalListenerBound = true;
    // CAPTURE phase, not bubble: this listener has to run BEFORE the
    // .crt-tv element's own click handler in projects.ts, because that
    // bubble-phase handler synchronously calls cycleTvChannel ->
    // setTvChannel -> tvSfx.static(). If the AudioContext doesn't exist
    // yet at that moment, static()'s ensureContext() ends up creating
    // the ctx outside the original gesture frame and (on stricter
    // browsers) the ramps land before the source actually produces
    // audio — net result: silent first-channel-change static. Capture
    // phase guarantees primeContextSync() lands first so the ctx is
    // alive and resumed by the time .crt-tv's handler runs.
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tvButton = target.closest(TV_BUTTON_SELECTOR);
      if (!tvButton) return;
      // CHANNEL / VOLUME (and the external mobile channel buttons) stay
      // silent when the TV is powered off — a real CRT's controls don't
      // make their tactile click when the set is dead. POWER is the
      // exception: its click is the audible feedback that the set just
      // turned back on, so it always plays.
      const isPowerBtn = tvButton.matches('.crt-tv__btn--power');
      if (!isPowerBtn) {
        const tv = document.querySelector('.crt-tv');
        if (tv?.classList.contains('is-powered-off')) return;
      }
      // Sync prime — must happen before any await so iOS counts it as
      // gesture-driven. If no ctx yet, create one now (sync) and resume
      // sync. If one exists but is suspended, just resume sync. Either
      // way, by the time click() runs its async chain, the ctx is in a
      // resumed state from inside the gesture.
      this.primeContextSync();
      void this.click();
    }, true);
  }

  /** Synchronously create + resume the AudioContext from inside a user
      gesture. iOS Safari requires the resume call to be in the
      synchronous portion of a gesture handler — any await before the
      resume puts it outside the gesture window and the context stays
      suspended. Safe to call multiple times: idempotent. */
  private primeContextSync(): void {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const masterGain = ctx.createGain();
        masterGain.gain.value = this.volume;
        masterGain.connect(ctx.destination);
        const clickGain = ctx.createGain();
        clickGain.gain.value = CLICK_FIXED_GAIN;
        clickGain.connect(ctx.destination);
        this.ctx = ctx;
        this.masterGain = masterGain;
        this.clickGain = clickGain;
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') {
      // Don't await — keep this sync so iOS sees the resume inside the
      // gesture stack frame. Errors are silent (resume rejects if the
      // gesture window already closed; next gesture will retry).
      void this.ctx.resume();
    }
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
