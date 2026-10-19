import {
  COLORS, CORNER_MOVES, Color, Cube, EDGES, MOVES, ROTATIONS, Rotation, applyMoves,
  parseAlgorithm, rotateCube, solvedCube,
} from './cube';
import { EdgeCoordinates, Pattern, PatternTables } from './patterns';

export type Mode = 'cross' | 'xcross' | 'block' | 'xxcross';
export type PairRelation = 'any' | 'adjacent' | 'diagonal';
export interface Settings {
  mode: Mode;
  cross: Color | 'any';
  pair: string;
  secondPair: string;
  relation: PairRelation;
  minimum: number;
  maximum: number;
  count: number;
}
export const DEFAULT_SETTINGS: Settings = {
  mode: 'xcross', cross: 'any', pair: 'any', secondPair: 'any',
  relation: 'any', minimum: 0, maximum: 20, count: 20,
};
export const MODE_LABELS: Record<Mode, string> = {
  cross: 'Cross', xcross: 'X-Cross', block: '2×2×2 block', xxcross: 'XX-Cross',
};
export const pairLabel = (edge: number) => EDGES[edge].map(f => COLORS[f]).join(' / ');
const findEdge = (faces: number[]) =>
  EDGES.findIndex(edge => edge.every(f => faces.includes(f)));
const originalPair = (rotation: Rotation, pair: number) =>
  findEdge(EDGES[pair].map(f => rotation.inverse[f]));

export interface Goal {
  rotation: Rotation;
  secondRotation?: Rotation;
  cross: number;
  pairs: number[];
}

export function goalsFor(settings: Settings): Goal[] {
  const goals: Goal[] = [], seen = new Set<string>();
  for (const rotation of ROTATIONS) {
    const cross = rotation.inverse[3];
    if (settings.cross !== 'any' && COLORS[cross] !== settings.cross) continue;
    const first = originalPair(rotation, 8);
    const seconds = settings.mode === 'xxcross' ? [9, 10, 11] : [-1];
    for (const slot of seconds) {
      if (slot !== -1 && settings.relation === 'adjacent' && slot === 10) continue;
      if (slot !== -1 && settings.relation === 'diagonal' && slot !== 10) continue;
      const pairs = settings.mode === 'cross' ? [] : [first];
      if (slot !== -1) pairs.push(originalPair(rotation, slot));
      if (settings.mode !== 'cross' && settings.pair !== 'any' && !pairs.includes(Number(settings.pair))) continue;
      if (settings.mode === 'xxcross' && settings.secondPair !== 'any' &&
          !pairs.includes(Number(settings.secondPair))) continue;
      const key = `${cross}:${pairs.slice().sort((a, b) => a - b).join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const secondRotation = slot === -1 ? undefined : ROTATIONS.find(r =>
        r.inverse[3] === cross && originalPair(r, 8) === pairs[1]);
      goals.push({ rotation, secondRotation, cross, pairs });
    }
  }
  return goals;
}

export function validateSettings(settings: Settings): void {
  if (!Object.prototype.hasOwnProperty.call(MODE_LABELS, settings.mode)) throw new Error('Choose a valid solve mode.');
  if (settings.cross !== 'any' && !COLORS.some(color => color === settings.cross)) throw new Error('Choose a valid cross color.');
  if (!['any', 'adjacent', 'diagonal'].includes(settings.relation)) throw new Error('Choose a valid pair relationship.');
  for (const pair of [settings.pair, settings.secondPair]) {
    if (pair !== 'any' && !/^(?:[0-9]|1[01])$/.test(pair)) throw new Error('Choose a valid F2L pair.');
  }
  if (!Number.isSafeInteger(settings.count) || settings.count < 1)
    throw new Error('The number of scrambles must be a positive whole number.');
  if (!Number.isInteger(settings.minimum) || !Number.isInteger(settings.maximum) ||
      settings.minimum < 0 || settings.maximum > 20 || settings.minimum > settings.maximum)
    throw new Error('Turn bounds must be whole numbers with 0 ≤ minimum ≤ maximum ≤ 20.');
  if (settings.mode === 'xxcross' && settings.pair !== 'any' && settings.pair === settings.secondPair)
    throw new Error('XX-Cross requires two different F2L pairs.');
  if (!goalsFor(settings).length)
    throw new Error('These colors and pairs cannot form this target. F2L pair colors must be on the sides of the cross; check the pair relationship too.');
}

interface SearchPattern {
  coordinates: EdgeCoordinates;
  pattern: Pattern;
  edge: number;
  corner: number;
  moveMap: Uint8Array;
  hasCorner: boolean;
}
interface SearchGoal { goal: Goal; patterns: SearchPattern[]; lowerBound: number }
export interface Solution {
  moves: number[];
  algorithm: string;
  cross: Color;
  pairs: string[];
  nodes: number;
  elapsedMs: number;
}
export class SearchTimeout extends Error {
  constructor() {
    super('The exact search reached its time limit. No approximate solution was substituted. Try a fixed cross color or pair, fewer rows, or a different target.');
    this.name = 'SearchTimeout';
  }
}

export class Solver {
  readonly tables: PatternTables;
  constructor(tables = new PatternTables()) { this.tables = tables; }

  private prepare(cube: Cube, settings: Settings): SearchGoal[] {
    const rotated = new Map<Rotation, Cube>();
    const canonical = (r: Rotation) => {
      let result = rotated.get(r);
      if (!result) { result = rotateCube(cube, r); rotated.set(r, result); }
      return result;
    };
    const addPattern = (r: Rotation, coordinates: EdgeCoordinates, pattern: Pattern,
      pieces: number[], corner?: number): SearchPattern => {
      const state = canonical(r);
      return {
        coordinates, pattern, edge: coordinates.index(pieces.map(p => state.edges[p])),
        corner: corner === undefined ? 0 : state.corners[corner],
        hasCorner: corner !== undefined,
        moveMap: Uint8Array.from(MOVES, (_, m) => r.faces[Math.floor(m / 3)] * 3 + m % 3),
      };
    };
    return goalsFor(settings).map(goal => {
      const patterns: SearchPattern[] = [];
      if (settings.mode === 'block') {
        const { three, block } = this.tables.block;
        patterns.push(addPattern(goal.rotation, three, block, [4, 5, 8], 4));
      } else {
        patterns.push(addPattern(goal.rotation, this.tables.four, this.tables.cross, [4, 5, 6, 7]));
        if (settings.mode !== 'cross') {
          const { a, b } = this.tables.pairs;
          for (const r of goal.secondRotation ? [goal.rotation, goal.secondRotation] : [goal.rotation]) {
            patterns.push(addPattern(r, this.tables.four, a, [4, 5, 6, 8], 4));
            patterns.push(addPattern(r, this.tables.four, b, [4, 5, 7, 8], 4));
          }
        }
      }
      const lowerBound = Math.max(...patterns.map(p =>
        p.pattern.distances[p.edge * (p.hasCorner ? 24 : 1) + p.corner]));
      return { goal, patterns, lowerBound };
    }).sort((a, b) => a.lowerBound - b.lowerBound);
  }

  solve(scramble: string, settings: Settings, timeoutMs = 30000): Solution | null {
    validateSettings(settings);
    const started = performance.now(), deadline = started + timeoutMs;
    const goals = this.prepare(applyMoves(solvedCube(), parseAlgorithm(scramble)), settings);
    const stats = { nodes: 0 };
    const path: number[] = [];
    for (let bound = goals[0].lowerBound; bound <= settings.maximum; bound++) {
      for (const candidate of goals) {
        if (candidate.lowerBound > bound) break;
        if (performance.now() > deadline) throw new SearchTimeout();
        const { patterns } = candidate, width = patterns.length;
        const edges = new Uint32Array((bound + 1) * width);
        const corners = new Uint8Array((bound + 1) * width);
        patterns.forEach((p, i) => { edges[i] = p.edge; corners[i] = p.corner; });
        const search = (level: number, remaining: number, lastFace: number): boolean => {
          if ((++stats.nodes & 16383) === 0 && performance.now() > deadline) throw new SearchTimeout();
          if (remaining === 0) return true;
          const current = level * width, next = current + width, allowance = remaining - 1;
          for (let move = 0; move < 18; move++) {
            const face = Math.floor(move / 3);
            if (face === lastFace) { move += 2; continue; }
            if (lastFace >= 0 && (face + 3) % 6 === lastFace && face < lastFace) { move += 2; continue; }
            let valid = true;
            for (let i = 0; i < width; i++) {
              const p = patterns[i], m = p.moveMap[move];
              const edge = p.coordinates.moves[edges[current + i] * 18 + m];
              const corner = p.hasCorner ? CORNER_MOVES[corners[current + i] * 18 + m] : 0;
              const distance = p.pattern.distances[edge * (p.hasCorner ? 24 : 1) + corner];
              if (distance > allowance) { valid = false; break; }
              edges[next + i] = edge;
              corners[next + i] = corner;
            }
            if (valid) {
              path[level] = move;
              if (search(level + 1, allowance, face)) return true;
            }
          }
          return false;
        };
        if (search(0, bound, -1)) {
          const moves = path.slice(0, bound);
          return {
            moves, algorithm: moves.map(m => MOVES[m]).join(' '),
            cross: COLORS[candidate.goal.cross], pairs: candidate.goal.pairs.map(pairLabel),
            nodes: stats.nodes, elapsedMs: performance.now() - started,
          };
        }
      }
    }
    return null;
  }
}
