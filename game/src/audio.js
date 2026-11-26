// Meridian Ring Run — sound, all synthesised in the browser with the
// Web Audio API. No audio files, no network: an engine hum that follows
// the throttle, wind that rises with speed, a chime for each ring and a
// thud for a crash. Silent until the player first interacts, as browsers
// require, and safe to call before that: every method guards itself.
export function createAudio() {
  return {
    context: null,
    engine: null,
    engineGain: null,
    wind: null,
    windGain: null,
    muted: false,
    /** Start the audio graph on the first user gesture. */
    ensure() {
      if (this.context || typeof window === 'undefined') return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        this.context = ctx;
        // Engine: a low sawtooth plus a sub sine, through a low-pass.
        const engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        const saw = ctx.createOscillator();
        saw.type = 'sawtooth';
        saw.frequency.value = 62;
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 31;
        saw.connect(filter);
        sub.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(ctx.destination);
        saw.start();
        sub.start();
        this.engine = saw;
        this.engineSub = sub;
        this.engineGain = engineGain;
        // Wind: looped filtered noise, gain follows airspeed.
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 640;
        windFilter.Q.value = 0.6;
        const windGain = ctx.createGain();
        windGain.gain.value = 0;
        noise.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(ctx.destination);
        noise.start();
        this.windGain = windGain;
      } catch {
        this.context = null;
      }
    },
    /** Call every frame with the live flight state. */
    update(throttle, speed, flying) {
      if (!this.context || this.muted) return;
      try {
        const t = this.context.currentTime;
        const target = flying ? 0.05 + throttle * 0.09 : 0;
        this.engineGain.gain.setTargetAtTime(target, t, 0.1);
        this.engine.frequency.setTargetAtTime(52 + throttle * 68, t, 0.1);
        this.engineSub.frequency.setTargetAtTime(26 + throttle * 34, t, 0.1);
        const windTarget = flying ? Math.min(0.14, (speed / 96) * 0.14) : 0;
        this.windGain.gain.setTargetAtTime(windTarget, t, 0.15);
      } catch {
        // Audio is decoration; a failure never stops the game.
      }
    },
    /** Two-note chime when a ring is flown. */
    ring() {
      this.note(659.25, 0.14, 0.16);
      window.setTimeout(() => this.note(987.77, 0.22, 0.2), 90);
    },
    /** Three-note fanfare for a landing. */
    fanfare() {
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        window.setTimeout(() => this.note(freq, 0.3, 0.2), i * 120);
      });
    },
    /** A low thud for a crash. */
    thud() {
      if (!this.context || this.muted) return;
      try {
        const ctx = this.context;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.3);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch {
        // Ignore.
      }
    },
    note(freq, duration, volume) {
      if (!this.context || this.muted) return;
      try {
        const ctx = this.context;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.05);
      } catch {
        // Ignore.
      }
    },
    toggleMute() {
      this.muted = !this.muted;
      if (this.context && this.engineGain) {
        this.engineGain.gain.value = 0;
        this.windGain.gain.value = 0;
      }
      return this.muted;
    },
  };
}
