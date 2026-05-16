import { BOARD_SIZE, COLORS, type Cell, type Color, type GameState } from './types';
import { cloneBoard, emptyBoard } from './game';
import { spawnTray } from './pieces';

export type PowerId = 'redo' | 'shufflePieces' | 'shuffleBoard' | 'colorLine' | 'clearBoard';

export type PowerDef = {
  id: PowerId;
  label: string;
  icon: string;
  cost: number;
  needsPicker: boolean;
};

export const POWER_DEFS: ReadonlyArray<PowerDef> = [
  { id: 'redo', label: 'Undo', icon: '↶', cost: 50, needsPicker: false },
  { id: 'shufflePieces', label: 'Reroll', icon: '🎲', cost: 80, needsPicker: false },
  { id: 'shuffleBoard', label: 'Recolor', icon: '🎨', cost: 100, needsPicker: false },
  { id: 'colorLine', label: 'Paint', icon: '⚡', cost: 120, needsPicker: true },
  { id: 'clearBoard', label: 'Wipe', icon: '💥', cost: 250, needsPicker: false },
];

export const POWER_BY_ID = new Map(POWER_DEFS.map((p) => [p.id, p] as const));

export type ColorLineParams = { axis: 'row' | 'col'; index: number; color: Color };
export type PowerParams = ColorLineParams | undefined;

export const canAfford = (state: GameState, id: PowerId): boolean => {
  const def = POWER_BY_ID.get(id);
  return !!def && state.coins >= def.cost;
};

export const canUse = (state: GameState, id: PowerId): boolean => {
  if (!canAfford(state, id)) return false;
  if (id === 'redo') return state.snapshot !== null;
  return true;
};

const randomColor = (): Color => COLORS[Math.floor(Math.random() * COLORS.length)]!;

export const applyPower = (
  state: GameState,
  id: PowerId,
  params?: PowerParams,
): boolean => {
  if (!canUse(state, id)) return false;
  const def = POWER_BY_ID.get(id)!;

  switch (id) {
    case 'redo': {
      const snap = state.snapshot!;
      state.board = cloneBoard(snap.board);
      state.tray = [snap.tray[0], snap.tray[1], snap.tray[2]];
      state.score = snap.score;
      state.combo = snap.combo;
      state.coins = snap.coins;
      state.snapshot = null;
      break;
    }
    case 'shufflePieces': {
      const fresh = spawnTray(state.pieceCounter);
      state.pieceCounter += 3;
      state.tray = [
        state.tray[0] === null ? null : fresh[0],
        state.tray[1] === null ? null : fresh[1],
        state.tray[2] === null ? null : fresh[2],
      ];
      state.coins -= def.cost;
      state.snapshot = null;
      break;
    }
    case 'shuffleBoard': {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (state.board[r]![c] !== null) {
            state.board[r]![c] = { color: randomColor() } as Cell;
          }
        }
      }
      state.coins -= def.cost;
      state.snapshot = null;
      break;
    }
    case 'colorLine': {
      const p = params as ColorLineParams | undefined;
      if (!p) return false;
      if (p.index < 0 || p.index >= BOARD_SIZE) return false;
      let touched = 0;
      if (p.axis === 'row') {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (state.board[p.index]![c] !== null) {
            state.board[p.index]![c] = { color: p.color };
            touched++;
          }
        }
      } else {
        for (let r = 0; r < BOARD_SIZE; r++) {
          if (state.board[r]![p.index] !== null) {
            state.board[r]![p.index] = { color: p.color };
            touched++;
          }
        }
      }
      if (touched === 0) return false;
      state.coins -= def.cost;
      state.snapshot = null;
      break;
    }
    case 'clearBoard': {
      state.board = emptyBoard();
      state.coins -= def.cost;
      state.snapshot = null;
      break;
    }
  }
  return true;
};

export const snapshotState = (state: GameState): void => {
  state.snapshot = {
    board: cloneBoard(state.board),
    tray: [state.tray[0], state.tray[1], state.tray[2]],
    score: state.score,
    combo: state.combo,
    coins: state.coins,
  };
};
