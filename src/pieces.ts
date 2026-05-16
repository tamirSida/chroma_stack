import { COLORS, type Color, type Piece, type PieceShape } from './types';

export const PIECE_SHAPES: ReadonlyArray<PieceShape> = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 1], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]],
  [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
];

const shapeBounds = (shape: PieceShape) => {
  let w = 0;
  let h = 0;
  for (const [r, c] of shape) {
    if (r + 1 > h) h = r + 1;
    if (c + 1 > w) w = c + 1;
  }
  return { w, h };
};

export const SHAPE_BOUNDS = PIECE_SHAPES.map(shapeBounds);

export const spawnPiece = (id: number): Piece => {
  const shapeId = Math.floor(Math.random() * PIECE_SHAPES.length);
  const color: Color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
  const cells = PIECE_SHAPES[shapeId]!;
  const { w, h } = SHAPE_BOUNDS[shapeId]!;
  return { id, shapeId, color, cells, width: w, height: h };
};

export const spawnTray = (startId: number): [Piece, Piece, Piece] => [
  spawnPiece(startId),
  spawnPiece(startId + 1),
  spawnPiece(startId + 2),
];
