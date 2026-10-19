import { CORNER_MOVES, EDGE_MOVES } from './cube';

export interface EdgeCoordinates {
  count: number;
  moves: Uint32Array;
  index: (edges: readonly number[]) => number;
}

export function edgeCoordinates(size: number): EdgeCoordinates {
  const count = size === 4 ? 190080 : 10560;
  const lookup = new Int32Array(24 ** size).fill(-1);
  const states = new Uint8Array(count * size);
  let countWritten = 0;
  const visit = (tuple: number[], occupied: number) => {
    if (tuple.length === size) {
      let key = 0;
      tuple.forEach((s, i) => { key = key * 24 + s; states[countWritten * size + i] = s; });
      lookup[key] = countWritten++;
      return;
    }
    for (let p = 0; p < 12; p++) {
      if (occupied & (1 << p)) continue;
      for (let flip = 0; flip < 2; flip++) visit([...tuple, p * 2 + flip], occupied | (1 << p));
    }
  };
  visit([], 0);
  const index = (edges: readonly number[]) => {
    let key = 0;
    for (let i = 0; i < size; i++) key = key * 24 + edges[i];
    const result = lookup[key];
    if (result < 0) throw new Error('Overlapping edges in pattern coordinate.');
    return result;
  };
  const moves = new Uint32Array(count * 18);
  for (let state = 0; state < count; state++) {
    for (let move = 0; move < 18; move++) {
      let key = 0;
      for (let i = 0; i < size; i++) key = key * 24 + EDGE_MOVES[states[state * size + i] * 18 + move];
      moves[state * 18 + move] = lookup[key];
    }
  }
  return { count, moves, index };
}

export interface Pattern {
  distances: Uint8Array;
  goal: number;
}

export function buildPattern(coordinates: EdgeCoordinates, edges: number[], corner?: number): Pattern {
  const hasCorner = corner !== undefined;
  const count = coordinates.count * (hasCorner ? 24 : 1);
  const distances = new Uint8Array(count).fill(255);
  const queue = new Uint32Array(count);
  const goal = coordinates.index(edges.map(p => p * 2)) * (hasCorner ? 24 : 1) + (corner ?? 0) * 3;
  distances[goal] = 0;
  queue[0] = goal;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const state = queue[head], depth = distances[state] + 1;
    const edge = hasCorner ? Math.floor(state / 24) : state, c = state % 24;
    const offset = edge * 18;
    for (let move = 0; move < 18; move++) {
      const next = hasCorner
        ? coordinates.moves[offset + move] * 24 + CORNER_MOVES[c * 18 + move]
        : coordinates.moves[offset + move];
      if (distances[next] !== 255) continue;
      distances[next] = depth;
      queue[tail++] = next;
    }
  }
  if (tail !== count) throw new Error(`Incomplete pattern database: ${tail}/${count}.`);
  return { distances, goal };
}

export class PatternTables {
  readonly four = edgeCoordinates(4);
  readonly cross = buildPattern(this.four, [4, 5, 6, 7]);
  private blockTables?: { three: EdgeCoordinates; block: Pattern };
  private pairTables?: { a: Pattern; b: Pattern };

  get block() {
    if (!this.blockTables) {
      const three = edgeCoordinates(3);
      this.blockTables = { three, block: buildPattern(three, [4, 5, 8], 4) };
    }
    return this.blockTables;
  }

  get pairs() {
    if (!this.pairTables) {
      this.pairTables = {
        a: buildPattern(this.four, [4, 5, 6, 8], 4),
        b: buildPattern(this.four, [4, 5, 7, 8], 4),
      };
    }
    return this.pairTables;
  }
}
