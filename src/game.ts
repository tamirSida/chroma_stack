import {
  BOARD_SIZE,
  type Board,
  type Cell,
  type ClearResult,
  type Color,
  type GameState,
  type NearMissReport,
  type Piece,
  cellKey,
} from './types';
import { spawnTray } from './pieces';

export const emptyBoard = (): Board => {
  const b: Board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) row.push(null);
    b.push(row);
  }
  return b;
};

export const cloneBoard = (b: Board): Board => b.map((row) => row.slice());

export const newGameState = (best: number, coins: number): GameState => {
  const [a, b, c] = spawnTray(1);
  return {
    board: emptyBoard(),
    tray: [a, b, c],
    score: 0,
    combo: 1,
    best,
    coins,
    pieceCounter: 4,
    snapshot: null,
  };
};

export const refillTray = (s: GameState): void => {
  if (s.tray.every((p) => p === null)) {
    const [a, b, c] = spawnTray(s.pieceCounter);
    s.tray = [a, b, c];
    s.pieceCounter += 3;
  }
};

export const canPlace = (
  board: Board,
  piece: Piece,
  r: number,
  c: number,
): boolean => {
  for (const [dr, dc] of piece.cells) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return false;
    if (board[nr]![nc] !== null) return false;
  }
  return true;
};

export const placeOnBoard = (
  board: Board,
  piece: Piece,
  r: number,
  c: number,
): void => {
  for (const [dr, dc] of piece.cells) {
    board[r + dr]![c + dc] = { color: piece.color };
  }
};

export const detectClears = (board: Board): ClearResult => {
  const cells = new Set<string>();
  const fullRows: number[] = [];
  const fullCols: number[] = [];
  let monoLines = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    let firstColor: Color | null = null;
    let mono = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r]![c];
      if (cell === null) {
        full = false;
        break;
      }
      if (firstColor === null) firstColor = cell.color;
      else if (cell.color !== firstColor) mono = false;
    }
    if (full) {
      fullRows.push(r);
      if (mono) monoLines++;
      for (let c = 0; c < BOARD_SIZE; c++) cells.add(cellKey(r, c));
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    let firstColor: Color | null = null;
    let mono = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      const cell = board[r]![c];
      if (cell === null) {
        full = false;
        break;
      }
      if (firstColor === null) firstColor = cell.color;
      else if (cell.color !== firstColor) mono = false;
    }
    if (full) {
      fullCols.push(c);
      if (mono) monoLines++;
      for (let r = 0; r < BOARD_SIZE; r++) cells.add(cellKey(r, c));
    }
  }

  return { cells, fullRows, fullCols, monoLines };
};

export const scoreClears = (result: ClearResult, combo: number): number => {
  let base = result.cells.size * 10;
  base += (result.fullRows.length + result.fullCols.length) * 50;
  base += result.monoLines * 150;
  return base * combo;
};

export const clearCells = (board: Board, cells: Set<string>): void => {
  for (const key of cells) {
    const [r, c] = key.split(',').map(Number) as [number, number];
    board[r]![c] = null;
  }
};

export const simulateClears = (
  board: Board,
  piece: Piece,
  r: number,
  c: number,
): Set<string> => {
  if (!canPlace(board, piece, r, c)) return new Set();
  const sim = cloneBoard(board);
  placeOnBoard(sim, piece, r, c);
  const result = detectClears(sim);
  return result.cells;
};

export const findNearMiss = (board: Board): NearMissReport => {
  const cells = new Set<string>();
  let nearLines = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    let filled = 0;
    let emptyAt = -1;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r]![c] !== null) {
        filled++;
      } else {
        emptyAt = c;
      }
    }
    if (filled === BOARD_SIZE - 1 && emptyAt >= 0) {
      cells.add(cellKey(r, emptyAt));
      nearLines++;
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let filled = 0;
    let emptyAt = -1;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r]![c] !== null) {
        filled++;
      } else {
        emptyAt = r;
      }
    }
    if (filled === BOARD_SIZE - 1 && emptyAt >= 0) {
      cells.add(cellKey(emptyAt, c));
      nearLines++;
    }
  }

  return { cells, nearLines };
};

export const isGameOver = (state: GameState): boolean => {
  for (const slot of state.tray) {
    if (!slot) continue;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlace(state.board, slot, r, c)) return false;
      }
    }
  }
  return true;
};
