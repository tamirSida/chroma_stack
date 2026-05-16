import { getAudioCtx, getDryBus } from './audio';

const BPM = 124;
const QUARTER = 60 / BPM;
const SIXTEENTH = QUARTER / 4;
const LOOKAHEAD_S = 0.1;
const TICK_MS = 25;
const BGM_GAIN = 0.1;

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Slot = number | null;
type Pattern = ReadonlyArray<Slot>;

const A2 = 45;
const C3 = 48;
const D3 = 50;
const E2 = 40;
const E3 = 52;
const FS2 = 42;
const G2 = 43;
const A3 = 57;
const G3 = 55;
const G4 = 67;
const A4 = 69;
const C5 = 72;
const D5 = 74;
const E5 = 76;
const FS5 = 78;
const G5 = 79;
const A5 = 81;

const BASS_PATTERNS: ReadonlyArray<Pattern> = [
  [A2, null, A2, null,  null, null, A2, null,  A3, null, null, null,  E2, null, G2, null],
  [A2, null, null, null,  A2, null, null, null,  E2, null, null, null,  FS2, null, E2, null],
  [A2, null, A3, null,  A2, null, null, null,  G2, null, null, null,  E2, null, null, null],
  [A2, null, A2, null,  A2, null, A2, null,  FS2, null, FS2, null,  E2, null, E2, null],
  [A2, null, null, null,  E2, null, A2, null,  D3, null, C3, null,  E2, null, null, null],
  [A2, null, A2, null,  G2, null, E2, null,  A2, null, A3, null,  D3, null, A2, null],
];

const PEDAL_BASS: Pattern =
  [A2, null, null, null,  null, null, null, null,  A2, null, null, null,  null, null, null, null];

const LEAD_PATTERNS: ReadonlyArray<Pattern> = [
  [A4, null, null, C5,  null, null, E5, null,  FS5, null, E5, null,  D5, null, C5, null],
  [E5, null, D5, null,  C5, null, A4, null,  C5, null, D5, null,  E5, null, null, null],
  [A5, null, G5, null,  E5, null, D5, null,  C5, null, D5, null,  E5, null, A4, null],
  [null, null, E5, null,  null, null, G5, null,  null, null, A5, null,  E5, null, C5, null],
  [C5, null, E5, null,  FS5, null, E5, null,  D5, null, C5, null,  A4, null, null, null],
  [A4, null, C5, FS5,  E5, null, D5, null,  C5, null, A4, null,  G4, null, A4, null],
];

const PAD_PATTERNS: ReadonlyArray<Pattern> = [
  [A3, null, null, null, null, null, null, null,  G3, null, null, null, null, null, null, null],
  [E3, null, null, null, null, null, null, null,  null, null, null, null, null, null, null, null],
  [A3, null, null, null, null, null, null, null,  D3, null, null, null, null, null, null, null],
  [C3, null, null, null, null, null, null, null,  E3, null, null, null, null, null, null, null],
];

const KICK_PATTERN: ReadonlyArray<number> =
  [1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 1, 0];
const SNARE_PATTERN: ReadonlyArray<number> =
  [0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0];
const HIHAT_PATTERN: ReadonlyArray<number> =
  [1, 0, 1, 1,  1, 0, 1, 0,  1, 0, 1, 1,  1, 0, 1, 0];

let enabled = false;
let playing = false;
let timer: number | null = null;
let bgmBus: GainNode | null = null;
let layerBus: GainNode | null = null;
let next16thTime = 0;
let currentBar = 0;
let slotInBar = 0;
let currentCombo = 1;

const ensureBus = (): GainNode | null => {
  const ctx = getAudioCtx();
  const dry = getDryBus();
  if (!ctx || !dry) return null;
  if (bgmBus) return bgmBus;
  bgmBus = ctx.createGain();
  bgmBus.gain.value = BGM_GAIN;
  bgmBus.connect(dry);
  layerBus = ctx.createGain();
  layerBus.gain.value = 0;
  layerBus.connect(bgmBus);
  return bgmBus;
};

const playBassNote = (t: number, midi: number) => {
  const ctx = getAudioCtx();
  const bus = ensureBus();
  if (!ctx || !bus) return;
  const freq = midiToFreq(midi);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = freq;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  filter.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(filter);
  filter.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + 0.24);
};

const playLeadNote = (t: number, midi: number) => {
  const ctx = getAudioCtx();
  const bus = ensureBus();
  if (!ctx || !bus) return;
  const freq = midiToFreq(midi);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  osc.connect(g);
  g.connect(bus);

  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = freq;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  filter.Q.value = 1;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(0.05, t + 0.005);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc2.connect(filter);
  filter.connect(g2);
  g2.connect(bus);

  osc.start(t);
  osc.stop(t + 0.2);
  osc2.start(t);
  osc2.stop(t + 0.17);
};

const playPadNote = (t: number, midi: number) => {
  const ctx = getAudioCtx();
  ensureBus();
  if (!ctx || !layerBus) return;
  const freq = midiToFreq(midi);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const detune = ctx.createOscillator();
  detune.type = 'triangle';
  detune.frequency.value = freq * 1.003;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const g = ctx.createGain();
  const halfBar = SIXTEENTH * 8;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.13, t + 0.06);
  g.gain.setValueAtTime(0.13, t + halfBar - 0.12);
  g.gain.exponentialRampToValueAtTime(0.001, t + halfBar + 0.05);
  osc.connect(filter);
  detune.connect(filter);
  filter.connect(g);
  g.connect(layerBus);
  osc.start(t);
  detune.start(t);
  osc.stop(t + halfBar + 0.1);
  detune.stop(t + halfBar + 0.1);
};

const noiseBuffer = (ctx: AudioContext, duration: number): AudioBufferSourceNode => {
  const len = Math.max(64, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
};

const playKick = (t: number) => {
  const ctx = getAudioCtx();
  const bus = ensureBus();
  if (!ctx || !bus) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.06);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(0.4, t + 0.008);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(og);
  og.connect(bus);
  osc.start(t);
  osc.stop(t + 0.1);

  const src = noiseBuffer(ctx, 0.025);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.1, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
  src.connect(ng);
  ng.connect(bus);
  src.start(t);
  src.stop(t + 0.03);
};

const playSnare = (t: number) => {
  const ctx = getAudioCtx();
  const bus = ensureBus();
  if (!ctx || !bus) return;

  const body = ctx.createOscillator();
  body.type = 'square';
  body.frequency.value = 200;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0, t);
  bg.gain.linearRampToValueAtTime(0.07, t + 0.003);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  body.connect(bg);
  bg.connect(bus);
  body.start(t);
  body.stop(t + 0.12);

  const lowNoise = noiseBuffer(ctx, 0.12);
  const lowFilter = ctx.createBiquadFilter();
  lowFilter.type = 'bandpass';
  lowFilter.frequency.value = 200;
  lowFilter.Q.value = 1.5;
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(0.22, t + 0.003);
  lg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  lowNoise.connect(lowFilter);
  lowFilter.connect(lg);
  lg.connect(bus);
  lowNoise.start(t);
  lowNoise.stop(t + 0.12);

  const hiNoise = noiseBuffer(ctx, 0.05);
  const hiFilter = ctx.createBiquadFilter();
  hiFilter.type = 'bandpass';
  hiFilter.frequency.value = 4000;
  hiFilter.Q.value = 0.8;
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0, t);
  hg.gain.linearRampToValueAtTime(0.12, t + 0.002);
  hg.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  hiNoise.connect(hiFilter);
  hiFilter.connect(hg);
  hg.connect(bus);
  hiNoise.start(t);
  hiNoise.stop(t + 0.05);
};

const playHihat = (t: number) => {
  const ctx = getAudioCtx();
  const bus = ensureBus();
  if (!ctx || !bus) return;
  const src = noiseBuffer(ctx, 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.08, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  src.connect(filter);
  filter.connect(g);
  g.connect(bus);
  src.start(t);
  src.stop(t + 0.05);
};

const scheduleSlot = (t: number, bar: number, slot: number) => {
  const isPedalBar = bar % 8 === 7;
  const bassPattern = isPedalBar
    ? PEDAL_BASS
    : BASS_PATTERNS[bar % BASS_PATTERNS.length]!;
  const bass = bassPattern[slot];
  const lead = LEAD_PATTERNS[(bar + 1) % LEAD_PATTERNS.length]![slot];
  const pad = PAD_PATTERNS[(bar + 2) % PAD_PATTERNS.length]![slot];

  if (bass !== null && bass !== undefined) playBassNote(t, bass);
  if (lead !== null && lead !== undefined) playLeadNote(t, lead);
  if (pad !== null && pad !== undefined) playPadNote(t, pad);
  if (KICK_PATTERN[slot]) playKick(t);
  if (SNARE_PATTERN[slot]) playSnare(t);
  if (HIHAT_PATTERN[slot]) playHihat(t);
};

const tick = () => {
  if (!playing) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  while (next16thTime < ctx.currentTime + LOOKAHEAD_S) {
    scheduleSlot(next16thTime, currentBar, slotInBar);
    slotInBar++;
    if (slotInBar >= 16) {
      slotInBar = 0;
      currentBar++;
    }
    next16thTime += SIXTEENTH;
  }
};

export const startBgm = () => {
  if (playing) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  ensureBus();
  next16thTime = ctx.currentTime + 0.08;
  slotInBar = 0;
  currentBar = 0;
  playing = true;
  if (timer === null) timer = window.setInterval(tick, TICK_MS);
};

export const stopBgm = () => {
  playing = false;
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
};

export const setBgmEnabled = (v: boolean) => {
  enabled = v;
  if (v) {
    const ctx = getAudioCtx();
    if (ctx && ctx.state !== 'suspended') startBgm();
  } else {
    stopBgm();
  }
};

export const isBgmEnabled = () => enabled;

export const primeBgmIfWanted = () => {
  if (enabled && !playing) startBgm();
};

export const setBgmCombo = (combo: number) => {
  if (combo === currentCombo) return;
  const wasActive = currentCombo >= 3;
  const isActive = combo >= 3;
  currentCombo = combo;
  if (!layerBus) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const currentGain = layerBus.gain.value;
  layerBus.gain.cancelScheduledValues(t);
  layerBus.gain.setValueAtTime(currentGain, t);
  if (isActive && !wasActive) {
    layerBus.gain.linearRampToValueAtTime(1, t + 0.5);
  } else if (!isActive && wasActive) {
    layerBus.gain.linearRampToValueAtTime(0, t + 2);
  }
};
