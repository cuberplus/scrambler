export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = typeof FACES[number];
export const COLORS = ['White', 'Red', 'Green', 'Yellow', 'Orange', 'Blue'] as const;
export type Color = typeof COLORS[number];
export const HEX = ['#f5f5ef', '#e64b49', '#32aa75', '#f4d34b', '#f89842', '#428de0'];
export const EDGES = [[0, 1], [0, 2], [0, 4], [0, 5], [3, 1], [3, 2],
  [3, 4], [3, 5], [2, 1], [2, 4], [5, 4], [5, 1]];
export const CORNERS = [[0, 1, 2], [0, 2, 4], [0, 4, 5], [0, 5, 1],
  [3, 2, 1], [3, 4, 2], [3, 5, 4], [3, 1, 5]];
export const NORMALS = [[0, 1, 0], [1, 0, 0], [0, 0, 1],
  [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
export const MOVES = FACES.flatMap(face => [face, `${face}2`, `${face}'`]);
export interface Cube { edges: Uint8Array; corners: Uint8Array }
export interface Rotation { faces: number[]; inverse: number[] }

export function solvedCube(): Cube {
  return {
    edges: Uint8Array.from(EDGES, (_, i) => i * 2),
    corners: Uint8Array.from(CORNERS, (_, i) => i * 3),
  };
}

const dot = (a: number[], b: number[]) => a.reduce((n, x, i) => n + x * b[i], 0);
const cross = (a: number[], b: number[]) =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const faceOf = (normal: number[]) => NORMALS.findIndex(n => dot(n, normal) === 1);
const sameFaces = (a: number[], b: number[]) => a.length === b.length && a.every(x => b.includes(x));

function quarterTurn(face: number, normal: number[]): number[] {
  const axis = NORMALS[face];
  const c = cross(axis, normal);
  const d = dot(axis, normal);
  return normal.map((_, i) => axis[i] * d - c[i]);
}

function makeMoves(pieces: number[][]): Uint8Array {
  const size = pieces[0].length;
  const table = new Uint8Array(24 * 18);
  for (let state = 0; state < 24; state++) {
    for (let face = 0; face < 6; face++) {
      let current = state;
      for (let turn = 0; turn < 3; turn++) {
        const p = Math.floor(current / size), orientation = current % size;
        if (pieces[p].includes(face)) {
          const nextFaces = pieces[p].map(f => faceOf(quarterTurn(face, NORMALS[f])));
          const nextPosition = pieces.findIndex(piece => sameFaces(piece, nextFaces));
          current = nextPosition * size + pieces[nextPosition].indexOf(nextFaces[orientation]);
        }
        table[state * 18 + face * 3 + turn] = current;
      }
    }
  }
  return table;
}

export const EDGE_MOVES = makeMoves(EDGES);
export const CORNER_MOVES = makeMoves(CORNERS);

export function parseAlgorithm(algorithm: string): number[] {
  if (!algorithm.trim()) return [];
  return algorithm.trim().split(/\s+/).map(token => {
    const move = MOVES.indexOf(token);
    if (move < 0) throw new Error(`Invalid move "${token}". Use U R F D L B, optionally followed by 2 or '.`);
    return move;
  });
}

export function applyMoves(cube: Cube, moves: readonly number[]): Cube {
  const edges = cube.edges.slice(), corners = cube.corners.slice();
  for (const move of moves) {
    if (!Number.isInteger(move) || move < 0 || move >= 18) throw new Error('Invalid move index.');
    for (let i = 0; i < 12; i++) edges[i] = EDGE_MOVES[edges[i] * 18 + move];
    for (let i = 0; i < 8; i++) corners[i] = CORNER_MOVES[corners[i] * 18 + move];
  }
  return { edges, corners };
}

export function inverseMoves(moves: readonly number[]): number[] {
  return moves.slice().reverse().map(m => Math.floor(m / 3) * 3 + 2 - m % 3);
}

export function simplifyMoves(moves: readonly number[]): number[] {
  const result: number[] = [];
  for (const move of moves) {
    const face = Math.floor(move / 3);
    let index = result.length - 1;
    while (index >= 0 && Math.floor(result[index] / 3) % 3 === face % 3) {
      if (Math.floor(result[index] / 3) === face) break;
      index--;
    }
    if (index >= 0 && Math.floor(result[index] / 3) === face) {
      const turns = (result[index] % 3 + move % 3 + 2) % 4;
      if (turns) result[index] = face * 3 + turns - 1;
      else result.splice(index, 1);
    } else {
      result.push(move);
    }
  }
  return result;
}

export const ROTATIONS: Rotation[] = [];
for (let up = 0; up < 6; up++) {
  for (let front = 0; front < 6; front++) {
    if (dot(NORMALS[up], NORMALS[front]) !== 0) continue;
    const right = cross(NORMALS[up], NORMALS[front]);
    const faces = NORMALS.map(n => faceOf([dot(n, right), dot(n, NORMALS[up]), dot(n, NORMALS[front])]));
    ROTATIONS.push({ faces, inverse: FACES.map((_, i) => faces.indexOf(i)) });
  }
}

export function rotateCube(cube: Cube, rotation: Rotation): Cube {
  function transform(pieces: number[][], states: Uint8Array): Uint8Array {
    const size = pieces[0].length, result = new Uint8Array(pieces.length);
    pieces.forEach((piece, identity) => {
      const newIdentity = pieces.findIndex(p => sameFaces(p, piece.map(f => rotation.faces[f])));
      const position = Math.floor(states[identity] / size), orientation = states[identity] % size;
      const newPosition = pieces.findIndex(p => sameFaces(p, pieces[position].map(f => rotation.faces[f])));
      const marker = piece.findIndex(f => rotation.faces[f] === pieces[newIdentity][0]);
      const newMarkerFace = rotation.faces[pieces[position][(orientation + marker) % size]];
      result[newIdentity] = newPosition * size + pieces[newPosition].indexOf(newMarkerFace);
    });
    return result;
  }
  return { edges: transform(EDGES, cube.edges), corners: transform(CORNERS, cube.corners) };
}

export function randomInteger(limit: number): number {
  const buffer = new Uint32Array(1), ceiling = Math.floor(0x100000000 / limit) * limit;
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return buffer[0] % limit;
}

export function randomScramble(length = 25, random = randomInteger): string {
  const moves: number[] = [];
  while (moves.length < length) {
    const move = random(18), face = Math.floor(move / 3);
    const previous = moves.length ? Math.floor(moves[moves.length - 1] / 3) : -1;
    if (face === previous) continue;
    if (previous >= 0 && (face + 3) % 6 === previous && face < previous) continue;
    moves.push(move);
  }
  return moves.map(m => MOVES[m]).join(' ');
}

export interface Sticker { face: number; row: number; col: number; color: number }
export function stickers(cube: Cube): Sticker[] {
  const result: Sticker[] = [];
  const rights = [[1, 0, 0], [0, 0, -1], [1, 0, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
  const ups = [[0, 0, -1], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
  const add = (piece: number[], state: number) => {
    const size = piece.length, positions = size === 2 ? EDGES : CORNERS;
    const position = positions[Math.floor(state / size)], orientation = state % size;
    const location = [0, 1, 2].map(axis => position.reduce((sum, f) => sum + NORMALS[f][axis], 0));
    piece.forEach((color, i) => {
      const face = position[(orientation + i) % size];
      result.push({ face, row: 1 - dot(location, ups[face]), col: 1 + dot(location, rights[face]), color });
    });
  };
  EDGES.forEach((p, i) => add(p, cube.edges[i]));
  CORNERS.forEach((p, i) => add(p, cube.corners[i]));
  FACES.forEach((_, face) => result.push({ face, row: 1, col: 1, color: face }));
  return result;
}
