import { BOARD_SIZE, type GameState, type Piece } from './types';
import {
  boardElement,
  buildDragPreview,
  clearGhost,
  clearTelegraph,
  setGhost,
  setTelegraph,
  setTrayDragging,
  snapBackTray,
} from './render';
import { canPlace, simulateClears } from './game';

const PREVIEW_OFFSET_Y = 60;

type Drag = {
  idx: number;
  piece: Piece;
  pointerId: number;
  previewEl: HTMLElement;
  pieceWidthPx: number;
  pieceHeightPx: number;
  cellSize: number;
  gap: number;
  pitch: number;
  lastSnap: { r: number; c: number; valid: boolean } | null;
};

let drag: Drag | null = null;
let getState: () => GameState;
let onCommit: (idx: number, r: number, c: number) => void;
let onDragStart: () => void;

export const initInput = (
  stateGetter: () => GameState,
  commit: (idx: number, r: number, c: number) => void,
  dragStart: () => void,
) => {
  getState = stateGetter;
  onCommit = commit;
  onDragStart = dragStart;
};

const measureGrid = () => {
  const board = boardElement();
  const first = board.querySelector<HTMLElement>('.cell');
  if (!first) return { cellSize: 0, gap: 0, originX: 0, originY: 0 };
  const cellRect = first.getBoundingClientRect();
  const cellSize = cellRect.width;
  const boardRect = board.getBoundingClientRect();
  const gapPx =
    parseFloat(getComputedStyle(board).gap) ||
    parseFloat(getComputedStyle(board).columnGap) ||
    3;
  return {
    cellSize,
    gap: gapPx,
    originX: cellRect.left - boardRect.left,
    originY: cellRect.top - boardRect.top,
    boardLeft: boardRect.left,
    boardTop: boardRect.top,
  };
};

export const handleTrayPointerDown = (idx: number, e: PointerEvent) => {
  if (drag) return;
  e.preventDefault();
  const state = getState();
  const piece = state.tray[idx];
  if (!piece) return;
  onDragStart();

  const m = measureGrid();
  const pitch = m.cellSize + m.gap;
  const pieceWidthPx = piece.width * m.cellSize + (piece.width - 1) * m.gap;
  const pieceHeightPx = piece.height * m.cellSize + (piece.height - 1) * m.gap;

  const previewEl = buildDragPreview(piece);
  document.body.appendChild(previewEl);

  setTrayDragging(idx, true);

  drag = {
    idx,
    piece,
    pointerId: e.pointerId,
    previewEl,
    pieceWidthPx,
    pieceHeightPx,
    cellSize: m.cellSize,
    gap: m.gap,
    pitch,
    lastSnap: null,
  };

  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  updateDrag(e.clientX, e.clientY);
};

const updateDrag = (clientX: number, clientY: number) => {
  if (!drag) return;
  const previewX = clientX - drag.pieceWidthPx / 2;
  const previewY = clientY - PREVIEW_OFFSET_Y - drag.pieceHeightPx;
  drag.previewEl.style.transform = `translate3d(${previewX}px, ${previewY}px, 0)`;

  const board = boardElement();
  const boardRect = board.getBoundingClientRect();
  const m = measureGrid();
  const localX = previewX - boardRect.left - m.originX;
  const localY = previewY - boardRect.top - m.originY;

  const snapCol = Math.round(localX / drag.pitch);
  const snapRow = Math.round(localY / drag.pitch);

  const maxRow = BOARD_SIZE - drag.piece.height;
  const maxCol = BOARD_SIZE - drag.piece.width;

  if (snapRow < -1 || snapRow > maxRow + 1 || snapCol < -1 || snapCol > maxCol + 1) {
    if (drag.lastSnap) {
      clearGhost();
      clearTelegraph();
      drag.lastSnap = null;
    }
    return;
  }

  const clampedRow = Math.max(0, Math.min(maxRow, snapRow));
  const clampedCol = Math.max(0, Math.min(maxCol, snapCol));

  const state = getState();
  const valid = canPlace(state.board, drag.piece, clampedRow, clampedCol);

  if (
    drag.lastSnap &&
    drag.lastSnap.r === clampedRow &&
    drag.lastSnap.c === clampedCol &&
    drag.lastSnap.valid === valid
  ) {
    return;
  }

  drag.lastSnap = { r: clampedRow, c: clampedCol, valid };
  setGhost(drag.piece, clampedRow, clampedCol, valid);
  if (valid) {
    setTelegraph(simulateClears(state.board, drag.piece, clampedRow, clampedCol));
  } else {
    clearTelegraph();
  }
};

const onPointerMove = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  e.preventDefault();
  updateDrag(e.clientX, e.clientY);
};

const onPointerUp = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  finishDrag(true);
};

const onPointerCancel = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  finishDrag(false);
};

const finishDrag = (commit: boolean) => {
  if (!drag) return;
  const snap = drag.lastSnap;
  const idx = drag.idx;
  drag.previewEl.remove();
  clearGhost();
  clearTelegraph();
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  const captured = drag;
  drag = null;

  if (commit && snap && snap.valid) {
    onCommit(idx, snap.r, snap.c);
  } else {
    setTrayDragging(idx, false);
    snapBackTray(idx);
  }
  void captured;
};
