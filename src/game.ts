import {
  BOARD_SIZE,
  type Board,
  type Cell,
  type ClearResult,
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

export const newGameState = (best: number): GameState => {
  const [a, b, c] = spawnTray(1);
  return {
    board: emptyBoard(),
    tray: [a, b, c],
    score: 0,
    combo: 1,
    best,
    pieceCounter: 4,
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

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const detectClears = (board: Board): ClearResult => {
  const cells = new Set<string>();
  const fullRows: number[] = [];
  const fullCols: number[] = [];
  const clusters: ClearResult['clusters'] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r]![c] === null) {
        full = false;
        break;
      }
    }
    if (full) {
      fullRows.push(r);
      for (let c = 0; c < BOARD_SIZE; c++) cells.add(cellKey(r, c));
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r]![c] === null) {
        full = false;
        break;
      }
    }
    if (full) {
      fullCols.push(c);
      for (let r = 0; r < BOARD_SIZE; r++) cells.add(cellKey(r, c));
    }
  }

  const visited = new Set<string>();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r]![c];
      const key = cellKey(r, c);
      if (!cell || visited.has(key)) continue;
      const component: [number, number][] = [];
      const queue: [number, number][] = [[r, c]];
      while (queue.length) {
        const [cr, cc] = queue.shift()!;
        const k = cellKey(cr, cc);
        if (visited.has(k)) continue;
        const cur = board[cr]![cc];
        if (!cur || cur.color !== cell.color) continue;
        visited.add(k);
        component.push([cr, cc]);
        for (const [dr, dc] of NEIGHBORS) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
          if (visited.has(cellKey(nr, nc))) continue;
          queue.push([nr, nc]);
        }
      }
      if (component.length >= 3) {
        clusters.push({ color: cell.color, size: component.length });
        for (const [cr, cc] of component) cells.add(cellKey(cr, cc));
      }
    }
  }

  return { cells, fullRows, fullCols, clusters };
};

export const scoreClears = (result: ClearResult, combo: number): number => {
  let base = result.cells.size * 10;
  base += (result.fullRows.length + result.fullCols.length) * 50;
  for (const cl of result.clusters) {
    if (cl.size > 3) base += (cl.size - 3) * 15;
  }
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

  const visited = new Set<string>();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r]![c];
      const key = cellKey(r, c);
      if (!cell || visited.has(key)) continue;
      const component: [number, number][] = [];
      const queue: [number, number][] = [[r, c]];
      while (queue.length) {
        const [cr, cc] = queue.shift()!;
        const k = cellKey(cr, cc);
        if (visited.has(k)) continue;
        const cur = board[cr]![cc];
        if (!cur || cur.color !== cell.color) continue;
        visited.add(k);
        component.push([cr, cc]);
        for (const [dr, dc] of NEIGHBORS) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
          if (visited.has(cellKey(nr, nc))) continue;
          queue.push([nr, nc]);
        }
      }
      if (component.length === 2) {
        for (const [cr, cc] of component) {
          for (const [dr, dc] of NEIGHBORS) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
            if (board[nr]![nc] === null) cells.add(cellKey(nr, nc));
          }
        }
      }
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
