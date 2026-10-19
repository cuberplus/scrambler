/** @jest-environment node */
import { applyMoves, parseAlgorithm, randomScramble, solvedCube } from './cube';
import { DEFAULT_SETTINGS, Solver } from './solver';
import { seededRandom, verifySolution } from './testHelpers';

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
