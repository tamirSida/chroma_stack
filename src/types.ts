export type Color = 'r' | 'b' | 'g' | 'y';

export const COLORS: ReadonlyArray<Color> = ['r', 'b', 'g', 'y'];

export const BOARD_SIZE = 8;

export type Cell = { color: Color } | null;

export type Board = Cell[][];

export type ShapeOffset = readonly [number, number];

export type PieceShape = ReadonlyArray<ShapeOffset>;

export type Piece = {
  id: number;
  shapeId: number;
  color: Color;
  cells: PieceShape;
  width: number;
  height: number;
};

export type TraySlot = Piece | null;

export type GameState = {
  board: Board;
  tray: [TraySlot, TraySlot, TraySlot];
  score: number;
  combo: number;
  best: number;
  pieceCounter: number;
};

export type ClusterInfo = { color: Color; size: number };

export type ClearResult = {
  cells: Set<string>;
  fullRows: number[];
  fullCols: number[];
  clusters: ClusterInfo[];
};

export type NearMissReport = {
  cells: Set<string>;
  nearLines: number;
};

export const cellKey = (r: number, c: number) => `${r},${c}`;

export const parseKey = (k: string): [number, number] => {
  const [r, c] = k.split(',').map(Number);
  return [r as number, c as number];
};
