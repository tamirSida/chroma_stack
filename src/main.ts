import './style.css';
import {
  initRender,
  renderBoard,
  renderTray,
  renderScore,
  flashScore,
  shakeBoard,
  animateClear,
  spawnFloat,
  setNearMiss,
} from './render';
import { initInput, handleTrayPointerDown } from './input';
import {
  newGameState,
  placeOnBoard,
  canPlace,
  detectClears,
  scoreClears,
  clearCells,
  refillTray,
  findNearMiss,
  isGameOver,
} from './game';
import type { Color, GameState } from './types';
import { primeAudio, playClearSequence, playBad } from './audio';
import { buzz } from './haptics';

const BEST_KEY = 'cascade.best.v1';

let state: GameState;
let busy = false;
let lastNearLines = 0;
let onGameOver: ((score: number, best: number, nearLines: number, isNewBest: boolean) => void) | null = null;
let onScoreCommitted: ((score: number, best: number, isNewBest: boolean) => void) | null = null;

const loadBest = (): number => {
  try {
    const v = localStorage.getItem(BEST_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const saveBest = (best: number) => {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    /* no-op */
  }
};

const wireTray = () => {
  renderTray(state, handleTrayPointerDown);
};

const commitPlace = (idx: number, r: number, c: number) => {
  if (busy) return;
  const piece = state.tray[idx];
  if (!piece) return;
  if (!canPlace(state.board, piece, r, c)) return;

  placeOnBoard(state.board, piece, r, c);
  state.tray[idx] = null;
  renderBoard(state);
  wireTray();

  const result = detectClears(state.board);

  if (result.cells.size > 0) {
    state.combo += 1;
    const prevBest = state.best;
    const points = scoreClears(result, state.combo);
    state.score += points;
    let isNewBest = false;
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
      isNewBest = state.score > prevBest;
    }

    const colorMap = new Map<string, Color>();
    for (const key of result.cells) {
      const [rr, cc] = key.split(',').map(Number) as [number, number];
      const cell = state.board[rr]![cc];
      if (cell) colorMap.set(key, cell.color);
    }

    const steps = Math.min(
      8,
      1 + result.fullRows.length + result.fullCols.length + result.clusters.length,
    );
    playClearSequence(steps);
    buzz(state.combo >= 3 ? [20, 30, 20] : 10);
    spawnFloat(state.combo);
    if (state.combo >= 3) shakeBoard();

    busy = true;
    animateClear(result.cells, colorMap);

    setTimeout(() => {
      clearCells(state.board, result.cells);
      renderBoard(state);
      renderScore(state);
      busy = false;
      afterTurn(isNewBest);
    }, 220);
  } else {
    state.combo = 1;
    renderScore(state);
    flashScore();
    playBad();
    afterTurn(false);
  }
};

const afterTurn = (isNewBest: boolean) => {
  refillTray(state);
  wireTray();
  const nm = findNearMiss(state.board);
  setNearMiss(nm.cells);
  lastNearLines = nm.nearLines;

  if (onScoreCommitted) {
    onScoreCommitted(state.score, state.best, isNewBest);
  }

  if (isGameOver(state)) {
    const finalScore = state.score;
    const best = state.best;
    if (onGameOver) onGameOver(finalScore, best, lastNearLines, isNewBest);
  }
};

const onDragStart = () => {
  primeAudio();
};

export const restart = () => {
  state = newGameState(state?.best ?? loadBest());
  state.combo = 1;
  busy = false;
  renderBoard(state);
  renderScore(state);
  wireTray();
  setNearMiss(findNearMiss(state.board).cells);
};

export const getStateRef = () => state;

export const setOnGameOver = (
  cb: (score: number, best: number, nearLines: number, isNewBest: boolean) => void,
) => {
  onGameOver = cb;
};

export const setOnScoreCommitted = (
  cb: (score: number, best: number, isNewBest: boolean) => void,
) => {
  onScoreCommitted = cb;
};

export const boot = () => {
  initRender();
  state = newGameState(loadBest());
  renderBoard(state);
  renderScore(state);
  wireTray();
  initInput(() => state, commitPlace, onDragStart);
  setNearMiss(findNearMiss(state.board).cells);

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
};

boot();
