import { getAudioCtx, getDryBus } from './audio';

const BPM = 140;
const QUARTER = 60 / BPM;
const SIXTEENTH = QUARTER / 4;
const LOOKAHEAD_S = 0.1;
const TICK_MS = 25;
const BGM_GAIN = 0.1;

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Slot = number | null;
type Pattern = ReadonlyArray<Slot>;

const A2 = 45;
const E2 = 40;
const F2 = 41;
const G2 = 43;
const A3 = 57;

const A4 = 69;
const C5 = 72;
const D5 = 74;
const E5 = 76;
const G5 = 79;
const A5 = 81;

const BASS_PATTERNS: ReadonlyArray<Pattern> = [
  [A2, null, A2, null, null, null, A2, null,  A3, null, null, null,  E2, null, G2, null],
  [A2, null, null, null,  A2, null, null, null,  E2, null, null, null,  F2, null, E2, null],
  [A2, null, A3, null,  A2, null, null, null,  G2, null, null, null,  E2, null, null, null],
  [A2, null, A2, null,  A2, null, A2, null,  F2, null, F2, null,  E2, null, E2, null],
];

const LEAD_PATTERNS: ReadonlyArray<Pattern> = [
  [A4, null, C5, null,  E5, null, D5, null,  C5, null, E5, null,  G5, null, A5, null],
  [E5, null, D5, null,  C5, null, A4, null,  C5, null, D5, null,  E5, null, null, null],
  [A5, null, G5, null,  E5, null, D5, null,  C5, null, D5, null,  E5, null, A4, null],
  [null, null, E5, null,  null, null, G5, null,  null, null, A5, null,  E5, null, C5, null],
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
let next16thTime = 0;
let currentBar = 0;
let slotInBar = 0;

const ensureBus = (): GainNode | null => {
  const ctx = getAudioCtx();
  const dry = getDryBus();
  if (!ctx || !dry) return null;
  if (bgmBus) return bgmBus;
  bgmBus = ctx.createGain();
  bgmBus.gain.value = BGM_GAIN;
  bgmBus.connect(dry);
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
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(filter);
  filter.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + 0.2);
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
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
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
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc2.connect(filter);
  filter.connect(g2);
  g2.connect(bus);

  osc.start(t);
  osc.stop(t + 0.18);
  osc2.start(t);
  osc2.stop(t + 0.15);
};

const playKick = (t: number) => {
  const ctx = getAudioCtx();
  const bus = ensureBus();
  if (!ctx || !bus) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.45, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + 0.12);
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

const playSnare = (t: number) => {
  const ctx = getAudioCtx();
  const bus = ensureBus();
  if (!ctx || !bus) return;
  const src = noiseBuffer(ctx, 0.15);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1500;
  filter.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(filter);
  filter.connect(g);
  g.connect(bus);
  src.start(t);
  src.stop(t + 0.14);
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
  const bass = BASS_PATTERNS[bar % BASS_PATTERNS.length]![slot];
  const lead = LEAD_PATTERNS[(bar + 1) % LEAD_PATTERNS.length]![slot];
  if (bass !== null && bass !== undefined) playBassNote(t, bass);
  if (lead !== null && lead !== undefined) playLeadNote(t, lead);
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
