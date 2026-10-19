import { COLORS, CORNERS, Cube, EDGES, MOVES, applyMoves } from './cube';
import { Settings, Solution } from './solver';

export function seededRandom(seed: number): (limit: number) => number {
  return limit => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) % limit;
  };
}

// Independent facelet model: clockwise face rotation and four explicitly ordered strips.
const strips = [
  [[18, 19, 20], [9, 10, 11], [45, 46, 47], [36, 37, 38]],
  [[2, 5, 8], [18 + 2, 18 + 5, 18 + 8], [27 + 2, 27 + 5, 27 + 8], [45 + 6, 45 + 3, 45]],
  [[6, 7, 8], [36 + 8, 36 + 5, 36 + 2], [27 + 2, 27 + 1, 27], [9, 9 + 3, 9 + 6]],
  [[24, 25, 26], [42, 43, 44], [51, 52, 53], [15, 16, 17]],
  [[0, 3, 6], [45 + 8, 45 + 5, 45 + 2], [27, 27 + 3, 27 + 6], [18, 18 + 3, 18 + 6]],
  [[0, 1, 2], [9 + 2, 9 + 5, 9 + 8], [27 + 8, 27 + 7, 27 + 6], [36 + 6, 36 + 3, 36]],
];

export function referenceFacelets(moves: readonly number[]): number[] {
  let state = Array.from({ length: 54 }, (_, i) => Math.floor(i / 9));
  for (const move of moves) {
    const face = Math.floor(move / 3);
    for (let turn = 0; turn <= move % 3; turn++) {
      const next = state.slice(), offset = face * 9;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) next[offset + col * 3 + 2 - row] = state[offset + row * 3 + col];
      }
      const cycle = strips[face];
      for (let side = 0; side < 4; side++) {
        for (let i = 0; i < 3; i++) next[cycle[side][i]] = state[cycle[(side + 1) % 4][i]];
      }
      state = next;
    }
  }
  return state;
}

export function targetSolved(cube: Cube, cross: number, pairs: number[], block: boolean): boolean {
  const sideFaces = pairs.length ? EDGES[pairs[0]] : [];
  const crossEdges = EDGES.map((piece, i) => ({ piece, i })).filter(({ piece }) =>
    piece.includes(cross) && (!block || piece.some(f => sideFaces.includes(f)))).map(({ i }) => i);
  const corners = pairs.map(p => CORNERS.findIndex(c =>
    c.includes(cross) && EDGES[p].every(f => c.includes(f))));
  return crossEdges.every(i => cube.edges[i] === i * 2) &&
    pairs.every(i => cube.edges[i] === i * 2) && corners.every(i => i >= 0 && cube.corners[i] === i * 3);
}

export function verifySolution(scrambled: Cube, solution: Solution, settings: Settings): void {
  const cross = COLORS.indexOf(solution.cross);
  const pairs = solution.pairs.map(label => EDGES.findIndex(e => e.map(f => COLORS[f]).join(' / ') === label));
  const expectedCount = settings.mode === 'cross' ? 0 : settings.mode === 'xxcross' ? 2 : 1;
  expect(solution.algorithm).toBe(solution.moves.map(m => MOVES[m]).join(' '));
  expect(pairs).toHaveLength(expectedCount);
  expect(new Set(pairs).size).toBe(expectedCount);
  if (settings.cross !== 'any') expect(solution.cross).toBe(settings.cross);
  if (settings.mode !== 'cross' && settings.pair !== 'any') expect(pairs).toContain(Number(settings.pair));
  if (settings.mode === 'xxcross' && settings.secondPair !== 'any') expect(pairs).toContain(Number(settings.secondPair));
  if (settings.mode === 'xxcross' && settings.relation !== 'any') {
    const shared = EDGES[pairs[0]].filter(face => EDGES[pairs[1]].includes(face)).length;
    expect(shared).toBe(settings.relation === 'adjacent' ? 1 : 0);
  }
  expect(targetSolved(applyMoves(scrambled, solution.moves), cross, pairs, settings.mode === 'block')).toBe(true);
}

export function anyTargetSolved(cube: Cube, settings: Settings): boolean {
  for (let cross = 0; cross < 6; cross++) {
    if (settings.cross !== 'any' && settings.cross !== COLORS[cross]) continue;
    const pairs = EDGES.map((edge, i) => ({ edge, i })).filter(({ edge }) =>
      edge.every(f => f !== cross && f !== (cross + 3) % 6)).map(({ i }) => i);
    let choices: number[][] = settings.mode === 'cross' ? [[]] : pairs.map(p => [p]);
    if (settings.mode === 'xxcross') choices = pairs.flatMap((p, i) => pairs.slice(i + 1).map(q => [p, q]));
    for (const choice of choices) {
      if (settings.mode !== 'cross' && settings.pair !== 'any' && !choice.includes(Number(settings.pair))) continue;
      if (settings.mode === 'xxcross') {
        if (settings.secondPair !== 'any' && !choice.includes(Number(settings.secondPair))) continue;
        const adjacent = EDGES[choice[0]].some(f => EDGES[choice[1]].includes(f));
        if (settings.relation === 'adjacent' && !adjacent) continue;
        if (settings.relation === 'diagonal' && adjacent) continue;
      }
      if (targetSolved(cube, cross, choice, settings.mode === 'block')) return true;
    }
  }
  return false;
}

export function bruteDistance(cube: Cube, settings: Settings, maximum: number): number | null {
  let layer = [cube];
  for (let depth = 0; depth <= maximum; depth++) {
    if (layer.some(c => anyTargetSolved(c, settings))) return depth;
    if (depth === maximum) break;
    layer = layer.flatMap(c => MOVES.map((_, m) => applyMoves(c, [m])));
  }
  return null;
}
