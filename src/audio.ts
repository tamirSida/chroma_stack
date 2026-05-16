let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let dryBus: GainNode | null = null;
let wetBus: GainNode | null = null;
let convolver: ConvolverNode | null = null;
let enabled = true;

const C5 = 523.25;

const makeImpulseResponse = (
  c: AudioContext,
  durationSec = 0.6,
  decay = 1.8,
): AudioBuffer => {
  const len = Math.floor(c.sampleRate * durationSec);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
};

const ensureCtx = (): AudioContext | null => {
  if (ctx) return ctx;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.45;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 6;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    dryBus = ctx.createGain();
    dryBus.gain.value = 1;
    dryBus.connect(masterGain);

    convolver = ctx.createConvolver();
    convolver.buffer = makeImpulseResponse(ctx, 0.65, 1.9);
    wetBus = ctx.createGain();
    wetBus.gain.value = 0.18;
    convolver.connect(wetBus);
    wetBus.connect(masterGain);
  } catch {
    ctx = null;
  }
  return ctx;
};

export const primeAudio = () => {
  const c = ensureCtx();
  if (c && c.state === 'suspended') void c.resume();
};

export const getAudioCtx = (): AudioContext | null => ensureCtx();

export const getDryBus = (): GainNode | null => {
  ensureCtx();
  return dryBus;
};

export const setAudioEnabled = (v: boolean) => {
  enabled = v;
};

export const isAudioEnabled = () => enabled;

type EnvelopeOpts = {
  attack?: number;
  decay?: number;
  peak: number;
  start?: number;
};

const makeEnv = (c: AudioContext, t: number, opts: EnvelopeOpts): GainNode => {
  const g = c.createGain();
  const a = opts.attack ?? 0.005;
  const d = opts.decay ?? 0.2;
  const start = opts.start ?? t;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(opts.peak, start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + a + d);
  return g;
};

const playOsc = (
  type: OscillatorType,
  freq: number | { from: number; to: number },
  start: number,
  duration: number,
  env: EnvelopeOpts,
  reverbSend = 0,
) => {
  if (!ctx || !dryBus) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  if (typeof freq === 'number') {
    osc.frequency.value = freq;
  } else {
    osc.frequency.setValueAtTime(freq.from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(0.001, freq.to), start + duration);
  }
  const g = makeEnv(ctx, start, { ...env, start });
  osc.connect(g);
  g.connect(dryBus);
  if (reverbSend > 0 && convolver && wetBus) {
    const sendGain = ctx.createGain();
    sendGain.gain.value = reverbSend;
    g.connect(sendGain);
    sendGain.connect(convolver);
  }
  osc.start(start);
  osc.stop(start + duration + 0.05);
};

const playNoiseBurst = (
  start: number,
  duration: number,
  filterFreq: number,
  filterQ: number,
  peak: number,
) => {
  if (!ctx || !dryBus) return;
  const len = Math.max(64, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const g = makeEnv(ctx, start, { peak, attack: 0.002, decay: duration, start });
  src.connect(filter);
  filter.connect(g);
  g.connect(dryBus);
  src.start(start);
  src.stop(start + duration + 0.05);
};

export const playPlace = () => {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  playNoiseBurst(t, 0.04, 1200, 5, 0.3);
  playOsc('sine', { from: 440, to: 120 }, t, 0.05, { peak: 0.15, attack: 0.002, decay: 0.05 });
};

const playClearStep = (semitonesFromC5: number, when = 0, combo = 1) => {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const base = C5 * Math.pow(2, semitonesFromC5 / 12);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = base;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(8000, t + 0.08);
  filter.Q.value = 4;
  const env = makeEnv(ctx, t, { peak: 0.3, attack: 0.004, decay: 0.25, start: t });
  osc.connect(filter);
  filter.connect(env);
  env.connect(dryBus!);
  if (convolver) {
    const send = ctx.createGain();
    send.gain.value = 0.12;
    env.connect(send);
    send.connect(convolver);
  }
  osc.start(t);
  osc.stop(t + 0.3);

  playOsc('sine', { from: 80, to: 40 }, t, 0.1, { peak: 0.5, attack: 0.002, decay: 0.12 });
  playOsc('triangle', base * 2, t, 0.15, { peak: 0.1, attack: 0.005, decay: 0.16 }, 0.25);

  if (combo >= 2) {
    playOsc('sawtooth', base * Math.pow(2, 7 / 12), t, 0.22, { peak: 0.15, attack: 0.005, decay: 0.22 }, 0.18);
  }
  if (combo >= 3) {
    playOsc('sine', { from: 50, to: 25 }, t, 0.15, { peak: 0.4, attack: 0.002, decay: 0.16 });
  }
  if (combo >= 4) {
    playNoiseBurst(t, 0.045, 4000, 1.5, 0.2);
  }
};

export const playClearSequence = (steps: number, combo = 1) => {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const comboBase = Math.min((combo - 1) * 2, 12);
  for (let i = 0; i < steps; i++) {
    playClearStep(comboBase + i, i * 0.055, combo);
  }
};

export const playMono = (combo: number, delay = 0) => {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  const root = C5;
  const intervals = [0, 4, 7, 12];
  intervals.forEach((semi, i) => {
    const start = t + i * 0.04;
    const freq = root * Math.pow(2, semi / 12);
    playOsc('triangle', freq, start, 0.6, { peak: 0.25, attack: 0.01, decay: 0.6 }, 0.4);
  });
  if (combo >= 2) {
    playOsc('sine', { from: 60, to: 30 }, t, 0.25, { peak: 0.7, attack: 0.002, decay: 0.28 });
  }
  if (combo >= 3) {
    playOsc('sine', root * 4, t, 0.5, { peak: 0.18, attack: 0.005, decay: 0.5 }, 0.55);
    playOsc('sine', root * 6, t + 0.03, 0.4, { peak: 0.14, attack: 0.005, decay: 0.4 }, 0.55);
    playNoiseBurst(t, 0.06, 5000, 2, 0.25);
  }
  if (combo >= 5) {
    playOsc('sawtooth', root * 1.5, t, 0.9, { peak: 0.12, attack: 0.18, decay: 0.9 }, 0.5);
  }
};

export const playPower = () => {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  playOsc('sine', C5, t, 0.5, { peak: 0.3, attack: 0.005, decay: 0.5 }, 0.6);
  playOsc('sine', C5 * 1.5, t + 0.05, 0.5, { peak: 0.25, attack: 0.005, decay: 0.5 }, 0.6);
};

export const playBad = () => {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  playOsc('sine', { from: 180, to: 120 }, t, 0.1, { peak: 0.15, attack: 0.005, decay: 0.1 });
};

export const playGameOver = () => {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  const notes = [523.25, 392.0, 311.13, 261.63];
  notes.forEach((freq, i) => {
    const start = t + i * 0.15;
    if (!ctx || !dryBus) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;
    const env = makeEnv(ctx, start, { peak: 0.2, attack: 0.02, decay: 0.7, start });
    osc.connect(filter);
    filter.connect(env);
    env.connect(dryBus);
    if (convolver) {
      const send = ctx.createGain();
      send.gain.value = 0.4;
      env.connect(send);
      send.connect(convolver);
    }
    osc.start(start);
    osc.stop(start + 0.75);
  });
};
