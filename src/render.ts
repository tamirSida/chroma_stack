import {
  BOARD_SIZE,
  cellKey,
  parseKey,
  COLORS,
  type Color,
  type GameState,
  type Piece,
} from './types';
import { POWER_DEFS, canUse, type PowerId } from './powers';

let boardEl: HTMLElement;
let trayEl: HTMLElement;
let scoreEl: HTMLElement;
let bestEl: HTMLElement;
let comboEl: HTMLElement;
let coinsEl: HTMLElement;
let coinsNumEl: HTMLElement;
let powersEl: HTMLElement;
let targetingEl: HTMLElement;

const cellEls: HTMLElement[][] = [];
let activeParticles = 0;

const PARTICLE_CAP = 50;

export const initRender = () => {
  boardEl = document.getElementById('board')!;
  trayEl = document.getElementById('tray')!;
  scoreEl = document.getElementById('score')!;
  bestEl = document.getElementById('best')!;
  comboEl = document.getElementById('combo')!;
  coinsEl = document.getElementById('coins')!;
  coinsNumEl = document.getElementById('coins-num')!;
  powersEl = document.getElementById('powers')!;
  targetingEl = document.getElementById('targeting-bar')!;
  mountBoard();
};

const mountBoard = () => {
  boardEl.innerHTML = '';
  cellEls.length = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: HTMLElement[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.r = String(r);
      el.dataset.c = String(c);
      boardEl.appendChild(el);
      row.push(el);
    }
    cellEls.push(row);
  }
};

export const boardElement = () => boardEl;
export const trayElement = () => trayEl;
export const getCell = (r: number, c: number) => cellEls[r]![c]!;

const colorVar = (c: Color) => `var(--c-${c})`;

export const renderBoard = (state: GameState) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = state.board[r]![c];
      const el = cellEls[r]![c]!;
      el.classList.remove('ghost', 'ghost-invalid', 'telegraph');
      if (cell) {
        el.classList.add('filled');
        el.style.setProperty('--c', colorVar(cell.color));
      } else {
        el.classList.remove('filled');
        el.style.removeProperty('--c');
      }
    }
  }
};

const buildPieceEl = (piece: Piece, large: boolean): HTMLElement => {
  const el = document.createElement('div');
  el.className = large ? 'drag-preview' : 'tray-piece';
  el.style.gridTemplateColumns = `repeat(${piece.width}, ${large ? 'var(--cell)' : 'var(--tray-cell)'})`;
  el.style.gridTemplateRows = `repeat(${piece.height}, ${large ? 'var(--cell)' : 'var(--tray-cell)'})`;
  const filled = new Set<string>();
  for (const [r, c] of piece.cells) filled.add(`${r},${c}`);
  for (let r = 0; r < piece.height; r++) {
    for (let c = 0; c < piece.width; c++) {
      const cell = document.createElement('div');
      cell.className = 'tray-cell';
      if (filled.has(`${r},${c}`)) {
        cell.style.setProperty('--c', colorVar(piece.color));
      } else {
        cell.classList.add('empty');
      }
      el.appendChild(cell);
    }
  }
  return el;
};

export const buildDragPreview = (piece: Piece): HTMLElement => buildPieceEl(piece, true);

export const renderTray = (state: GameState, onPointerDown: (idx: number, e: PointerEvent) => void) => {
  trayEl.innerHTML = '';
  state.tray.forEach((piece, idx) => {
    const slot = document.createElement('div');
    slot.className = 'tray-slot';
    if (piece) {
      const pieceEl = buildPieceEl(piece, false);
      pieceEl.dataset.trayIdx = String(idx);
      pieceEl.addEventListener('pointerdown', (e) => onPointerDown(idx, e));
      slot.appendChild(pieceEl);
    }
    trayEl.appendChild(slot);
  });
};

export const setTrayDragging = (idx: number, dragging: boolean) => {
  const piece = trayEl.querySelectorAll<HTMLElement>('.tray-piece')[idx];
  if (!piece) return;
  piece.classList.toggle('dragging', dragging);
};

export const snapBackTray = (idx: number) => {
  const piece = trayEl.querySelectorAll<HTMLElement>('.tray-piece')[idx];
  if (!piece) return;
  piece.classList.remove('dragging');
  piece.classList.add('snap-back');
  setTimeout(() => piece.classList.remove('snap-back'), 260);
};

let displayedScore = 0;
let scoreAnim: number | null = null;
let bumpTimer: number | null = null;

const animateScoreTo = (target: number) => {
  if (target === displayedScore) {
    scoreEl.textContent = String(target);
    return;
  }
  if (scoreAnim !== null) cancelAnimationFrame(scoreAnim);
  const from = displayedScore;
  const diff = Math.abs(target - from);
  const duration = Math.min(700, 200 + diff * 0.4);
  const startTime = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(from + (target - from) * eased);
    scoreEl.textContent = String(current);
    if (t < 1) {
      scoreAnim = requestAnimationFrame(step);
    } else {
      scoreAnim = null;
      displayedScore = target;
    }
  };
  scoreAnim = requestAnimationFrame(step);
};

const bumpScore = () => {
  scoreEl.classList.remove('bump');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('bump');
  if (bumpTimer !== null) window.clearTimeout(bumpTimer);
  bumpTimer = window.setTimeout(() => {
    scoreEl.classList.remove('bump');
    bumpTimer = null;
  }, 480);
};

export const renderScore = (state: GameState) => {
  if (state.score > displayedScore) bumpScore();
  if (state.score < displayedScore) {
    displayedScore = state.score;
    scoreEl.textContent = String(state.score);
  } else {
    animateScoreTo(state.score);
  }
  bestEl.textContent = `Best ${state.best}`;
  comboEl.textContent = `×${state.combo}`;
  comboEl.classList.remove('hot', 'hotter');
  if (state.combo >= 5) comboEl.classList.add('hotter');
  else if (state.combo >= 3) comboEl.classList.add('hot');
};

export const renderCoins = (state: GameState, bump = false) => {
  coinsNumEl.textContent = String(state.coins);
  if (bump) {
    coinsEl.classList.remove('bump');
    void coinsEl.offsetWidth;
    coinsEl.classList.add('bump');
    setTimeout(() => coinsEl.classList.remove('bump'), 250);
  }
};

export const renderPowers = (
  state: GameState,
  onUse: (id: PowerId, btn: HTMLElement) => void,
) => {
  powersEl.innerHTML = '';
  for (const def of POWER_DEFS) {
    const btn = document.createElement('button');
    btn.className = 'power-btn';
    btn.dataset.powerId = def.id;
    btn.setAttribute('aria-label', `${def.label} (${def.cost} coins)`);
    if (!canUse(state, def.id)) btn.classList.add('disabled');

    const icon = document.createElement('span');
    icon.className = 'power-icon';
    icon.textContent = def.icon;
    btn.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'power-label';
    label.textContent = def.label;
    btn.appendChild(label);

    const cost = document.createElement('span');
    cost.className = 'power-cost';
    cost.textContent = String(def.cost);
    btn.appendChild(cost);

    btn.addEventListener('click', () => onUse(def.id, btn));
    powersEl.appendChild(btn);
  }
};

export const flashPower = (id: PowerId) => {
  const btn = powersEl.querySelector<HTMLElement>(`.power-btn[data-power-id="${id}"]`);
  if (!btn) return;
  btn.classList.remove('flash');
  void btn.offsetWidth;
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 420);
};

export type TargetingState = { axis: 'row' | 'col'; color: Color };

export const showTargetingBar = (
  initial: TargetingState,
  handlers: {
    onAxisChange: (axis: 'row' | 'col') => void;
    onColorChange: (color: Color) => void;
    onCancel: () => void;
  },
) => {
  targetingEl.innerHTML = '';
  targetingEl.hidden = false;
  powersEl.classList.add('disabled');
  boardEl.classList.add('targeting');

  const axisWrap = document.createElement('div');
  axisWrap.className = 'axis';
  const axisBtns: { axis: 'row' | 'col'; el: HTMLButtonElement }[] = [];
  for (const axis of ['row', 'col'] as const) {
    const b = document.createElement('button');
    b.textContent = axis === 'row' ? 'Row' : 'Col';
    if (axis === initial.axis) b.classList.add('active');
    b.addEventListener('click', () => {
      axisBtns.forEach((x) => x.el.classList.toggle('active', x.axis === axis));
      handlers.onAxisChange(axis);
      hint.textContent = `Tap a ${axis} on the board`;
    });
    axisBtns.push({ axis, el: b });
    axisWrap.appendChild(b);
  }
  targetingEl.appendChild(axisWrap);

  const swatchWrap = document.createElement('div');
  swatchWrap.className = 'swatches';
  const swatchBtns: { color: Color; el: HTMLButtonElement }[] = [];
  for (const color of COLORS) {
    const s = document.createElement('button');
    s.className = 'swatch';
    s.style.setProperty('--c', `var(--c-${color})`);
    s.setAttribute('aria-label', color);
    if (color === initial.color) s.classList.add('active');
    s.addEventListener('click', () => {
      swatchBtns.forEach((x) => x.el.classList.toggle('active', x.color === color));
      handlers.onColorChange(color);
    });
    swatchBtns.push({ color, el: s });
    swatchWrap.appendChild(s);
  }
  targetingEl.appendChild(swatchWrap);

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = `Tap a ${initial.axis} on the board`;
  targetingEl.appendChild(hint);

  const cancel = document.createElement('button');
  cancel.className = 'cancel';
  cancel.setAttribute('aria-label', 'Cancel');
  cancel.textContent = '×';
  cancel.addEventListener('click', handlers.onCancel);
  targetingEl.appendChild(cancel);
};

export const hideTargetingBar = () => {
  targetingEl.hidden = true;
  targetingEl.innerHTML = '';
  powersEl.classList.remove('disabled');
  boardEl.classList.remove('targeting');
};

export const flashScore = () => {
  scoreEl.classList.remove('flash');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('flash');
  setTimeout(() => scoreEl.classList.remove('flash'), 260);
};

export const shakeBoard = () => {
  boardEl.classList.remove('shake');
  void boardEl.offsetWidth;
  boardEl.classList.add('shake');
  setTimeout(() => boardEl.classList.remove('shake'), 260);
};

export const setGhost = (piece: Piece, r: number, c: number, valid: boolean) => {
  clearGhost();
  for (const [dr, dc] of piece.cells) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
    const el = cellEls[nr]![nc]!;
    if (el.classList.contains('filled')) continue;
    el.classList.add(valid ? 'ghost' : 'ghost-invalid');
    el.style.setProperty('--c', colorVar(piece.color));
  }
};

export const clearGhost = () => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const el = cellEls[r]![c]!;
      if (el.classList.contains('ghost') || el.classList.contains('ghost-invalid')) {
        el.classList.remove('ghost', 'ghost-invalid');
        if (!el.classList.contains('filled')) el.style.removeProperty('--c');
      }
    }
  }
};

export const setTelegraph = (cells: Set<string>) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const el = cellEls[r]![c]!;
      const key = cellKey(r, c);
      if (cells.has(key)) el.classList.add('telegraph');
      else el.classList.remove('telegraph');
    }
  }
};

export const clearTelegraph = () => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      cellEls[r]![c]!.classList.remove('telegraph');
    }
  }
};

export const setNearMiss = (cells: Set<string>) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const el = cellEls[r]![c]!;
      const key = cellKey(r, c);
      if (cells.has(key)) el.classList.add('near-miss');
      else el.classList.remove('near-miss');
    }
  }
};

export const animateClear = (cells: Set<string>, colorMap: Map<string, Color>): (() => void) => {
  const targets: { r: number; c: number; color: Color }[] = [];
  for (const key of cells) {
    const [r, c] = parseKey(key);
    const color = colorMap.get(key);
    if (!color) continue;
    targets.push({ r, c, color });
  }
  const anims: Animation[] = [];
  for (const { r, c, color } of targets) {
    const el = cellEls[r]![c]!;
    const anim = el.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.2)', opacity: 0 },
      ],
      { duration: 200, easing: 'ease-out', fill: 'forwards' },
    );
    anims.push(anim);
    spawnParticles(r, c, color);
  }
  return () => {
    for (const a of anims) a.cancel();
  };
};

const spawnParticles = (r: number, c: number, color: Color) => {
  if (activeParticles >= PARTICLE_CAP) return;
  const cellRect = cellEls[r]![c]!.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();
  const cx = cellRect.left - boardRect.left + cellRect.width / 2;
  const cy = cellRect.top - boardRect.top + cellRect.height / 2;
  const count = Math.min(6, PARTICLE_CAP - activeParticles);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.background = `var(--c-${color})`;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    boardEl.appendChild(p);
    activeParticles++;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 30 + Math.random() * 30;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const anim = p.animate(
      [
        { transform: 'translate3d(-50%, -50%, 0) scale(1)', opacity: 1 },
        {
          transform: `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0) scale(0.3)`,
          opacity: 0,
        },
      ],
      { duration: 500 + Math.random() * 200, easing: 'cubic-bezier(0.2, 0.6, 0.2, 1)' },
    );
    anim.onfinish = () => {
      p.remove();
      activeParticles--;
    };
  }
};

const FLOAT_TIERS = ['Good!', 'Nice!', 'Sweet!', 'Amazing!', 'Insane!', 'Godlike!'];

export const spawnFloat = (combo: number, monoLines = 0) => {
  let text: string;
  let color: string;
  if (monoLines >= 2) {
    text = `PURE × ${monoLines}!`;
    color = 'var(--c-y)';
  } else if (monoLines === 1) {
    text = 'PURE!';
    color = 'var(--c-y)';
  } else {
    const idx = Math.min(FLOAT_TIERS.length - 1, Math.max(0, combo - 1));
    text = FLOAT_TIERS[idx]!;
    color = combo >= 5 ? 'var(--c-r)' : combo >= 3 ? 'var(--c-y)' : '#fff';
  }
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.fontSize = `${28 + Math.min(combo + monoLines, 6) * 2}px`;
  el.style.color = color;
  boardEl.appendChild(el);
  const anim = el.animate(
    [
      { transform: 'translate3d(-50%, -50%, 0) scale(0.7)', opacity: 0 },
      { transform: 'translate3d(-50%, -90%, 0) scale(1.1)', opacity: 1, offset: 0.4 },
      { transform: 'translate3d(-50%, -180%, 0) scale(1)', opacity: 0 },
    ],
    { duration: 800, easing: 'cubic-bezier(0.2, 0.6, 0.2, 1)' },
  );
  anim.onfinish = () => el.remove();
};

export const spawnHype = (text: string, color: string, delay = 0) => {
  const el = document.createElement('div');
  el.className = 'float hype';
  el.textContent = text;
  el.style.color = color;
  boardEl.appendChild(el);
  const anim = el.animate(
    [
      { transform: 'translate3d(-50%, 40%, 0) scale(0.5)', opacity: 0 },
      { transform: 'translate3d(-50%, 30%, 0) scale(1.25)', opacity: 1, offset: 0.35 },
      { transform: 'translate3d(-50%, 10%, 0) scale(1)', opacity: 1, offset: 0.75 },
      { transform: 'translate3d(-50%, -10%, 0) scale(1)', opacity: 0 },
    ],
    { duration: 1100, delay, easing: 'cubic-bezier(0.2, 0.6, 0.2, 1)', fill: 'forwards' },
  );
  anim.onfinish = () => el.remove();
};

export const spawnComboLoss = (prevCombo: number) => {
  const el = document.createElement('div');
  el.className = 'float combo-loss';
  el.textContent = `−COMBO × ${prevCombo}`;
  boardEl.appendChild(el);
  const anim = el.animate(
    [
      { transform: 'translate3d(-50%, -50%, 0) scale(0.9)', opacity: 0 },
      { transform: 'translate3d(-50%, -65%, 0) scale(1.05)', opacity: 1, offset: 0.3 },
      { transform: 'translate3d(-50%, -120%, 0) scale(0.95)', opacity: 0 },
    ],
    { duration: 700, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
  );
  anim.onfinish = () => el.remove();
};
