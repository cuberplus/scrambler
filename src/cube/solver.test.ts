/** @jest-environment node */
import { COLORS, applyMoves, parseAlgorithm, randomScramble, solvedCube } from './cube';
import { PatternTables } from './patterns';
import { DEFAULT_SETTINGS, Mode, Settings, Solver, goalsFor, validateSettings } from './solver';
import { bruteDistance, seededRandom, verifySolution } from './testHelpers';

jest.setTimeout(60000);
let solver: Solver;
beforeAll(() => { solver = new Solver(); });
const options = (changes: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...changes });

test('goal enumeration covers all colors, pairs, and XX-Cross relationships without duplicates', () => {
  expect(goalsFor(options({ mode: 'cross' }))).toHaveLength(6);
  expect(goalsFor(options())).toHaveLength(24);
  expect(goalsFor(options({ mode: 'block' }))).toHaveLength(24);
  expect(goalsFor(options({ mode: 'xxcross' }))).toHaveLength(36);
  expect(goalsFor(options({ mode: 'xxcross', relation: 'adjacent' }))).toHaveLength(24);
  expect(goalsFor(options({ mode: 'xxcross', relation: 'diagonal' }))).toHaveLength(12);
  expect(goalsFor(options({ mode: 'xxcross', cross: 'White', pair: '11', relation: 'diagonal' }))).toHaveLength(1);
});

test.each(['cross', 'xcross', 'block', 'xxcross'] as Mode[])('%s returns zero moves for an already solved target', mode => {
  const result = solver.solve('', options({ mode }));
  expect(result?.moves).toEqual([]);
});

test('pattern databases are complete, exact at the goal, and use compact byte distances', () => {
  const tables: PatternTables = solver.tables;
  for (const pattern of [tables.cross, tables.block.block, tables.pairs.a, tables.pairs.b]) {
    expect(pattern.distances[pattern.goal]).toBe(0);
    expect(pattern.distances.includes(255)).toBe(false);
    expect(pattern.distances.filter(d => d === 0)).toHaveLength(1);
    expect(pattern.distances.BYTES_PER_ELEMENT).toBe(1);
  }
  expect(tables.cross.distances).toHaveLength(190080);
  expect(tables.pairs.a.distances).toHaveLength(4561920);
  expect(tables.block.block.distances).toHaveLength(253440);
});

test.each(['cross', 'xcross', 'block', 'xxcross'] as Mode[])('%s matches independent breadth-first optimality for shallow scrambles', mode => {
  for (const scramble of ['R', 'F2 R', "R U F'", "R2 L' B"]) {
    for (const cross of ['any', 'White'] as const) {
      const settings = options({ mode, cross, maximum: 3 });
      const expected = bruteDistance(applyMoves(solvedCube(), parseAlgorithm(scramble)), settings, 3);
      const result = solver.solve(scramble, settings);
      expect(result?.moves.length ?? null).toBe(expected);
      if (result) verifySolution(applyMoves(solvedCube(), parseAlgorithm(scramble)), result, settings);
    }
  }
});

test('all six base colors and fixed Blue/Red pair are solved in original scramble orientation', () => {
  const random = seededRandom(223);
  for (const color of COLORS) {
    for (const mode of ['cross', 'xcross', 'block'] as Mode[]) {
      const scramble = randomScramble(25, random), settings = options({ mode, cross: color });
      const result = solver.solve(scramble, settings);
      expect(result).not.toBeNull();
      if (result) verifySolution(applyMoves(solvedCube(), parseAlgorithm(scramble)), result, settings);
    }
  }
  const settings = options({ cross: 'White', pair: '11' });
  const scramble = randomScramble(25, random);
  const result = solver.solve(scramble, settings);
  expect(result?.pairs).toEqual(['Blue / Red']);
  if (result) verifySolution(applyMoves(solvedCube(), parseAlgorithm(scramble)), result, settings);
});

test.each(['any', 'adjacent', 'diagonal'] as const)('XX-Cross respects %s pair constraints on long scrambles', relation => {
  const settings = options({ mode: 'xxcross', cross: 'White', relation, pair: '11' });
  const scramble = randomScramble(25, seededRandom(901));
  const result = solver.solve(scramble, settings);
  expect(result).not.toBeNull();
  if (result) verifySolution(applyMoves(solvedCube(), parseAlgorithm(scramble)), result, settings);
});

test('two specifically required pairs and color-neutral pair searches are supported', () => {
  const settings = options({ mode: 'xxcross', cross: 'White', pair: '8', secondPair: '10', relation: 'diagonal' });
  const result = solver.solve("F R U' L2", settings);
  expect(result).not.toBeNull();
  if (result) verifySolution(applyMoves(solvedCube(), parseAlgorithm("F R U' L2")), result, settings);
  const neutral = options({ pair: '11' });
  const second = solver.solve("R2 U B' F D", neutral);
  expect(second).not.toBeNull();
  if (second) verifySolution(applyMoves(solvedCube(), parseAlgorithm("R2 U B' F D")), second, neutral);
});

test('upper bounds exclude unsolved targets, while lower bounds never pad an optimal solve', () => {
  expect(solver.solve('R', options({ cross: 'White', pair: '8', minimum: 0, maximum: 0 }))).toBeNull();
  expect(solver.solve('R', options({ cross: 'White', pair: '8', minimum: 5 }))?.moves).toHaveLength(1);
  expect(() => solver.solve('R', options(), -1)).toThrow('time limit');
});

test('incompatible constraints and invalid numeric settings are rejected explicitly', () => {
  expect(() => validateSettings(options({ minimum: 5, maximum: 3 }))).toThrow('bounds');
  expect(() => validateSettings(options({ maximum: 21 }))).toThrow('bounds');
  expect(() => validateSettings(options({ count: NaN }))).toThrow('scrambles');
  expect(() => validateSettings(options({ count: 0 }))).toThrow('scrambles');
  expect(() => validateSettings(options({ count: 1.5 }))).toThrow('scrambles');
  expect(() => validateSettings(options({ count: Infinity }))).toThrow('scrambles');
  expect(() => validateSettings(options({ count: 201 }))).not.toThrow();
  expect(() => validateSettings(options({ cross: 'White', pair: '0' }))).toThrow('cannot form');
  expect(() => validateSettings(options({ mode: 'xxcross', pair: '8', secondPair: '8' }))).toThrow('different');
  expect(() => validateSettings(options({ mode: 'xxcross', cross: 'White', pair: '8', secondPair: '9', relation: 'diagonal' }))).toThrow('cannot form');
});
