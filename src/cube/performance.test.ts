/** @jest-environment node */
import { applyMoves, parseAlgorithm, randomScramble, solvedCube } from './cube';
import { WorksheetRow, generateWorksheet } from './generation';
import { DEFAULT_SETTINGS, Solver } from './solver';
import { bruteDistance, seededRandom, verifySolution } from './testHelpers';

jest.setTimeout(60000);
let solver: Solver;

test('cold startup builds complete reusable databases within 15 seconds and 32 MiB of table buffers', () => {
  const started = performance.now();
  solver = new Solver();
  const tables = solver.tables;
  const bytes = tables.four.moves.byteLength + tables.cross.distances.byteLength +
    tables.pairs.a.distances.byteLength + tables.pairs.b.distances.byteLength +
    tables.block.three.moves.byteLength + tables.block.block.distances.byteLength;
  const elapsed = performance.now() - started;
  console.info(`Cold databases: ${elapsed.toFixed(0)} ms; ${(bytes / 1024 / 1024).toFixed(1)} MiB of table buffers`);
  expect(elapsed).toBeLessThan(15000);
  expect(bytes).toBeLessThan(32 * 1024 * 1024);
});

test('20 color-neutral, optimal X-Cross solutions complete within 2 seconds with reusable tables', () => {
  const random = seededRandom(15414), started = performance.now();
  let nodes = 0;
  for (let i = 0; i < 20; i++) {
    const scramble = randomScramble(25, random);
    const solution = solver.solve(scramble, DEFAULT_SETTINGS, 10000);
    expect(solution).not.toBeNull();
    if (solution) {
      nodes += solution.nodes;
      verifySolution(applyMoves(solvedCube(), parseAlgorithm(scramble)), solution, DEFAULT_SETTINGS);
    }
  }
  const elapsed = performance.now() - started;
  console.info(`20 neutral X-Cross solves: ${elapsed.toFixed(0)} ms; ${nodes.toLocaleString()} searched nodes`);
  expect(elapsed).toBeLessThan(2000);
});

test.each(['any', 'adjacent', 'diagonal'] as const)('color-neutral XX-Cross (%s pairs) stays within a 2-second search budget', relation => {
  const settings = { ...DEFAULT_SETTINGS, mode: 'xxcross' as const, relation };
  const scramble = randomScramble(25, seededRandom(307));
  const started = performance.now(), solution = solver.solve(scramble, settings, 2000);
  expect(solution).not.toBeNull();
  if (solution) verifySolution(applyMoves(solvedCube(), parseAlgorithm(scramble)), solution, settings);
  console.info(`Neutral XX-Cross (${relation}): ${(performance.now() - started).toFixed(0)} ms`);
  expect(performance.now() - started).toBeLessThan(2000);
});

test('10 XX-Cross solves with two fixed diagonal pairs complete within 5 seconds', () => {
  const settings = {
    ...DEFAULT_SETTINGS, mode: 'xxcross' as const, cross: 'White' as const,
    pair: '8', secondPair: '10', relation: 'diagonal' as const,
  };
  const random = seededRandom(529371), started = performance.now();
  let nodes = 0;
  for (let i = 0; i < 10; i++) {
    const scramble = randomScramble(25, random);
    const solution = solver.solve(scramble, settings, 5000);
    expect(solution).not.toBeNull();
    if (solution) {
      nodes += solution.nodes;
      verifySolution(applyMoves(solvedCube(), parseAlgorithm(scramble)), solution, settings);
    }
  }
  console.info(`10 fixed-pair XX-Cross solves: ${(performance.now() - started).toFixed(0)} ms; ${nodes.toLocaleString()} nodes`);
  expect(performance.now() - started).toBeLessThan(5000);
});

test.each([
  { label: '4–5 X-Cross', settings: { ...DEFAULT_SETTINGS, minimum: 4, maximum: 5 } },
  { label: '3–6 X-Cross', settings: { ...DEFAULT_SETTINGS, minimum: 3, maximum: 6 } },
  { label: 'White Cross', settings: {
    ...DEFAULT_SETTINGS, mode: 'cross' as const, cross: 'White' as const, minimum: 3, maximum: 6,
  } },
  { label: 'fixed-pair block', settings: {
    ...DEFAULT_SETTINGS, mode: 'block' as const, cross: 'White' as const, pair: '8', minimum: 2, maximum: 4,
  } },
  { label: 'fixed diagonal XX-Cross', settings: {
    ...DEFAULT_SETTINGS, mode: 'xxcross' as const, cross: 'White' as const,
    pair: '8', secondPair: '10', relation: 'diagonal' as const, minimum: 4, maximum: 5,
  } },
])('$label generates 20 balanced, independently re-solved rows within 5 seconds', async ({ settings, label }) => {
  const rows: WorksheetRow[] = [], random = seededRandom(15414), started = performance.now();
  await generateWorksheet(settings, solver, event => {
    if (event.type === 'row') rows.push(event.row);
  }, { scramble: () => randomScramble(25, random), yieldControl: () => Promise.resolve() });
  const counts = Array.from({ length: settings.maximum - settings.minimum + 1 }, (_, i) =>
    rows.filter(row => row.moves.length === settings.minimum + i).length);
  expect(rows).toHaveLength(20);
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  expect(new Set(rows.map(row => row.scramble)).size).toBe(20);
  for (const row of rows) {
    verifySolution(applyMoves(solvedCube(), parseAlgorithm(row.scramble)), row, settings);
    expect(solver.solve(row.scramble, settings)?.moves.length).toBe(row.moves.length);
  }
  const elapsed = performance.now() - started;
  console.info(`${label} balanced worksheet: ${elapsed.toFixed(0)} ms; lengths ${counts.join('/')}`);
  expect(elapsed).toBeLessThan(5000);
});

test('zero-to-two-turn balanced cases agree with independent exhaustive search', async () => {
  const settings = { ...DEFAULT_SETTINGS, mode: 'cross' as const, cross: 'White' as const,
    minimum: 0, maximum: 2, count: 6 };
  const rows: WorksheetRow[] = [], random = seededRandom(307);
  await generateWorksheet(settings, solver, event => {
    if (event.type === 'row') rows.push(event.row);
  }, { scramble: () => randomScramble(25, random), yieldControl: () => Promise.resolve() });
  expect(rows.map(row => row.moves.length)).toEqual([0, 1, 2, 0, 1, 2]);
  for (const row of rows) {
    const scrambled = applyMoves(solvedCube(), parseAlgorithm(row.scramble));
    verifySolution(scrambled, row, settings);
    expect(bruteDistance(scrambled, settings, 2)).toBe(row.moves.length);
  }
});
