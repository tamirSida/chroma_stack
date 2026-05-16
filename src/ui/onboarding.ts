import { BOARD_SIZE, cellKey, type Color, type GameState } from '../types';
import { cloneBoard, findNearMiss } from '../game';
import {
  animateClear,
  getCell,
  renderBoard,
  setNearMiss,
  shakeBoard,
  spawnFloat,
  spawnHype,
} from '../render';
import { playClearSequence, playMono, primeAudio } from '../audio';

let active = false;
let cancelRequested = false;

type Variant = 'first-run' | 'manual';

type DemoUI = {
  setStep: (idx: number, title: string, caption: string) => void;
  setButton: (label: string, enabled: boolean) => void;
  awaitClick: () => Promise<void>;
  dismiss: () => void;
};

const STEPS_TOTAL = 3;
const ROW = 3;

const buildUI = (variant: Variant, onSkip: () => void): DemoUI => {
  const backdrop = document.createElement('div');
  backdrop.className = 'demo-backdrop';
  document.body.appendChild(backdrop);

  const wrap = document.createElement('div');
  wrap.className = 'demo-banner';

  const skip = document.createElement('button');
  skip.className = 'demo-skip';
  skip.textContent = variant === 'first-run' ? 'Skip' : 'Close';
  wrap.appendChild(skip);

  const title = document.createElement('div');
  title.className = 'demo-banner-title';
  wrap.appendChild(title);

  const caption = document.createElement('div');
  caption.className = 'demo-banner-caption';
  wrap.appendChild(caption);

  const dots = document.createElement('div');
  dots.className = 'demo-progress';
  const dotEls: HTMLElement[] = [];
  for (let i = 0; i < STEPS_TOTAL; i++) {
    const d = document.createElement('span');
    d.className = 'demo-progress-dot';
    dotEls.push(d);
    dots.appendChild(d);
  }
  wrap.appendChild(dots);

  const button = document.createElement('button');
  button.className = 'btn demo-next';
  button.textContent = 'Next';
  button.disabled = true;
  wrap.appendChild(button);

  document.body.appendChild(wrap);
  requestAnimationFrame(() => {
    backdrop.classList.add('shown');
    wrap.classList.add('shown');
  });

  let resolveClick: (() => void) | null = null;
  const trigger = () => {
    if (resolveClick) {
      const r = resolveClick;
      resolveClick = null;
      r();
    }
  };
  button.addEventListener('click', () => {
    if (!button.disabled) trigger();
  });
  skip.addEventListener('click', () => {
    onSkip();
    trigger();
  });

  return {
    setStep(idx, t, cap) {
      title.textContent = t;
      caption.textContent = cap;
      dotEls.forEach((d, i) => d.classList.toggle('active', i === idx));
    },
    setButton(label, enabled) {
      button.textContent = label;
      button.disabled = !enabled;
    },
    awaitClick() {
      return new Promise<void>((res) => {
        resolveClick = res;
      });
    },
    dismiss() {
      backdrop.classList.remove('shown');
      wrap.classList.remove('shown');
      window.setTimeout(() => {
        backdrop.remove();
        wrap.remove();
      }, 280);
    },
  };
};

let pendingCancels: Array<() => void> = [];

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    const t = window.setTimeout(resolve, ms);
    pendingCancels.push(() => {
      window.clearTimeout(t);
      resolve();
    });
  });

const flushCancels = () => {
  const list = pendingCancels;
  pendingCancels = [];
  for (const fn of list) fn();
};

const dropCell = async (state: GameState, c: number, color: Color, gap: number) => {
  if (cancelRequested) return;
  state.board[ROW]![c] = { color };
  renderBoard(state);
  const el = getCell(ROW, c);
  el.animate(
    [
      { transform: 'translateY(-14px) scale(0.55)', opacity: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ],
    { duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  );
  await wait(gap);
};

const triggerClear = async (state: GameState, mono: boolean) => {
  if (cancelRequested) return;
  const cells = new Set<string>();
  const colorMap = new Map<string, Color>();
  for (let c = 0; c < BOARD_SIZE; c++) {
    const key = cellKey(ROW, c);
    cells.add(key);
    const cell = state.board[ROW]![c];
    if (cell) colorMap.set(key, cell.color);
  }
  if (mono) {
    spawnFloat(1, 1);
    spawnHype('PURE!', 'var(--c-y)');
    shakeBoard();
    playMono(2, 0);
  } else {
    spawnFloat(1, 0);
    playClearSequence(3, 1);
  }
  const finalize = animateClear(cells, colorMap);
  await wait(240);
  for (let c = 0; c < BOARD_SIZE; c++) state.board[ROW]![c] = null;
  renderBoard(state);
  finalize();
};

const spotlight = (id: string, on: boolean) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('demo-spotlight', on);
};

export const runOnboardingDemo = async (opts: {
  state: GameState;
  variant: Variant;
  onDone: () => void;
}) => {
  if (active) return;
  active = true;
  cancelRequested = false;
  pendingCancels = [];

  const snapshot = cloneBoard(opts.state.board);
  primeAudio();
  document.body.classList.add('demo-running');

  const ui = buildUI(opts.variant, () => {
    cancelRequested = true;
    flushCancels();
  });

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      opts.state.board[r]![c] = null;
    }
  }
  renderBoard(opts.state);
  setNearMiss(new Set());

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    spotlight('powers', false);
    opts.state.board = cloneBoard(snapshot);
    renderBoard(opts.state);
    setNearMiss(findNearMiss(opts.state.board).cells);
    ui.dismiss();
    document.body.classList.remove('demo-running');
    active = false;
    pendingCancels = [];
    opts.onDone();
  };

  try {
    // Step 1 — Objective + regular clear
    ui.setStep(
      0,
      'OBJECTIVE',
      'Drop pieces to fill a row or column. A full line clears for points.',
    );
    ui.setButton('Next', false);
    const mixed: Color[] = ['r', 'b', 'g', 'y', 'r', 'g', 'b', 'y'];
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cancelRequested) return finish();
      await dropCell(opts.state, c, mixed[c]!, 75);
    }
    await wait(260);
    if (cancelRequested) return finish();
    await triggerClear(opts.state, false);
    await wait(500);
    if (cancelRequested) return finish();
    ui.setButton('Next', true);
    await ui.awaitClick();
    if (cancelRequested) return finish();

    // Step 2 — PURE
    ui.setStep(
      1,
      'PURE',
      'Match colors — a same-color line scores way more. This is the big bonus to chase.',
    );
    ui.setButton('Next', false);
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cancelRequested) return finish();
      await dropCell(opts.state, c, 'r', 85);
    }
    await wait(360);
    if (cancelRequested) return finish();
    await triggerClear(opts.state, true);
    await wait(900);
    if (cancelRequested) return finish();
    ui.setButton('Next', true);
    await ui.awaitClick();
    if (cancelRequested) return finish();

    // Step 3 — Powers
    ui.setStep(
      2,
      'POWERS',
      'Earn coins from score, then spend them on powers below the tray to recover when stuck or set up combos.',
    );
    ui.setButton('Got it', false);
    spotlight('powers', true);
    await wait(500);
    if (cancelRequested) return finish();
    ui.setButton('Got it', true);
    await ui.awaitClick();
    spotlight('powers', false);
  } finally {
    finish();
  }
};
