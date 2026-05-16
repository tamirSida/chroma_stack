import {
  BOARD_SIZE,
  cellKey,
  parseKey,
  type Color,
  type GameState,
  type Piece,
} from './types';

let boardEl: HTMLElement;
let trayEl: HTMLElement;
let scoreEl: HTMLElement;
let bestEl: HTMLElement;
let comboEl: HTMLElement;

const cellEls: HTMLElement[][] = [];
let activeParticles = 0;

const PARTICLE_CAP = 50;

export const initRender = () => {
  boardEl = document.getElementById('board')!;
  trayEl = document.getElementById('tray')!;
  scoreEl = document.getElementById('score')!;
  bestEl = document.getElementById('best')!;
  comboEl = document.getElementById('combo')!;
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

export const renderScore = (state: GameState) => {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = `Best ${state.best}`;
  comboEl.textContent = `×${state.combo}`;
  comboEl.classList.remove('hot', 'hotter');
  if (state.combo >= 5) comboEl.classList.add('hotter');
  else if (state.combo >= 3) comboEl.classList.add('hot');
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

export const spawnFloat = (combo: number) => {
  const idx = Math.min(FLOAT_TIERS.length - 1, Math.max(0, combo - 1));
  const text = FLOAT_TIERS[idx]!;
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.fontSize = `${28 + Math.min(combo, 6) * 2}px`;
  el.style.color = combo >= 5 ? 'var(--c-r)' : combo >= 3 ? 'var(--c-y)' : '#fff';
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
