let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let enabled = true;

const C5 = 523.25;

const ensureCtx = () => {
  if (ctx) return ctx;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
};

export const primeAudio = () => {
  const c = ensureCtx();
  if (c && c.state === 'suspended') void c.resume();
};

export const setAudioEnabled = (v: boolean) => {
  enabled = v;
};

export const isAudioEnabled = () => enabled;

export const playTone = (semitonesFromC5: number, when = 0) => {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const freq = C5 * Math.pow(2, semitonesFromC5 / 12);
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(1, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + 0.22);
};

export const playClearSequence = (steps: number) => {
  for (let i = 0; i < steps; i++) {
    playTone(i, i * 0.05);
  }
};

export const playBad = () => {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.4, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + 0.14);
};
