/** @jest-environment node */
import { GenerationEvent, generateWorksheet } from './generation';
import { MOVES, applyMoves, parseAlgorithm, solvedCube } from './cube';
import { DEFAULT_SETTINGS, Solution } from './solver';

const result = (length: number): Solution => ({
  moves: Array(length).fill(0), algorithm: Array(length).fill('U').join(' '),
  cross: 'White', pairs: ['Blue / Red'], nodes: 1, elapsedMs: 1,
});
const immediate = () => Promise.resolve();

test('inclusive bounds balance optimal lengths, duplicate seeds are skipped, and IDs are consecutive', async () => {
  const events: GenerationEvent[] = [];
  const scrambles = ['R', 'R', 'F', 'L', 'B', 'D'];
  const solve = jest.fn().mockReturnValueOnce(result(1)).mockReturnValueOnce(result(2))
    .mockReturnValueOnce(null).mockReturnValueOnce(result(4));
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum: 2, maximum: 3, count: 2 },
    { solve }, event => events.push(event),
    { scramble: () => scrambles.shift()!, yieldControl: immediate });
  const rows = events.filter((e): e is Extract<GenerationEvent, { type: 'row' }> => e.type === 'row');
  expect(rows.map(e => e.row.moves.length)).toEqual([2, 3]);
  expect(rows.map(e => e.row.id)).toEqual([1, 2]);
  expect(rows.map(e => e.row.scramble)).toEqual(['F', 'B U']);
  expect(solve).toHaveBeenCalledTimes(4);
  expect(solve.mock.calls.every(([, settings]) => settings.maximum === 20)).toBe(true);
  expect(events[events.length - 1]).toMatchObject({ type: 'done', attempts: 5 });
});

test.each([
  [4, 5, 20, [10, 10]],
  [3, 6, 20, [5, 5, 5, 5]],
  [4, 5, 21, [11, 10]],
  [4, 8, 3, [1, 1, 1, 0, 0]],
  [4, 4, 3, [3]],
])('balances %i–%i turns across %i rows', async (minimum, maximum, count, expected) => {
  const events: GenerationEvent[] = [];
  let sequence = 0;
  const solve = jest.fn(() => result(9));
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum, maximum, count },
    { solve }, event => events.push(event),
    { scramble: () => `R ${Array(++sequence).fill('F U').join(' ')}`, yieldControl: immediate });
  const rows = events.flatMap(event => event.type === 'row' ? [event.row] : []);
  expect(Array.from({ length: maximum - minimum + 1 }, (_, i) =>
    rows.filter(row => row.moves.length === minimum + i).length)).toEqual(expected);
  expect(rows.map(row => row.id)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
  expect(rows.every(row => row.algorithm.split(' ').length === row.moves.length)).toBe(true);
  expect(solve).toHaveBeenCalledTimes(count);
  expect(events[events.length - 1]).toMatchObject({ type: 'done', attempts: count });
});

test('a broad range balances attainable lengths without waiting for impossible upper lengths', async () => {
  const events: GenerationEvent[] = [];
  let sequence = 0;
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum: 0 }, { solve: () => result(6) }, event => events.push(event),
    { scramble: () => `R ${Array(++sequence).fill('F U').join(' ')}`, yieldControl: immediate });
  const rows = events.flatMap(event => event.type === 'row' ? [event.row] : []);
  expect(Array.from({ length: 7 }, (_, i) => rows.filter(row => row.moves.length === i).length))
    .toEqual([3, 3, 3, 3, 3, 3, 2]);
  expect(rows.find(row => !row.moves.length)?.algorithm).toBe('');
  expect(events[events.length - 1]).toMatchObject({ type: 'done', attempts: 20 });
});

test('biased seeds get bounded retries instead of overfilling easy lengths', async () => {
  const events: GenerationEvent[] = [];
  let sequence = 0;
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum: 3, maximum: 6 },
    { solve: () => result(sequence % 4 === 1 ? 6 : 5) }, event => events.push(event),
    { scramble: () => `R ${Array(++sequence).fill('F U').join(' ')}`, yieldControl: immediate });
  const rows = events.flatMap(event => event.type === 'row' ? [event.row] : []);
  expect(Array.from({ length: 4 }, (_, i) => rows.filter(row => row.moves.length === i + 3).length))
    .toEqual([5, 5, 5, 5]);
  expect(sequence).toBeGreaterThan(20);
  expect(sequence).toBeLessThan(80);
});

test('an exceptionally hard seed does not make a worksheet wait forever for more of that length', async () => {
  const events: GenerationEvent[] = [];
  let sequence = 0;
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum: 3, maximum: 8 },
    { solve: () => result(sequence === 1 ? 8 : 6) }, event => events.push(event),
    { maxAttempts: 200, scramble: () => `R ${Array(++sequence).fill('F U').join(' ')}`, yieldControl: immediate });
  const rows = events.flatMap(event => event.type === 'row' ? [event.row] : []);
  expect(rows).toHaveLength(20);
  expect(rows.every(row => row.moves.length >= 3 && row.moves.length <= 8)).toBe(true);
  expect(events[events.length - 1]).toMatchObject({ type: 'done' });
  expect(sequence).toBeLessThan(200);
});

test('duplicate adjusted scrambles do not consume a row or a length allocation', async () => {
  const events: GenerationEvent[] = [];
  const scrambles = ['R', 'R U', 'F'];
  const solve = jest.fn().mockReturnValueOnce(result(5)).mockReturnValue(result(4));
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum: 4, maximum: 4, count: 2 },
    { solve }, event => events.push(event),
    { scramble: () => scrambles.shift()!, yieldControl: immediate });
  const rows = events.flatMap(event => event.type === 'row' ? [event.row] : []);
  expect(rows.map(row => row.scramble)).toEqual(['R U', 'F']);
  expect(rows.map(row => row.id)).toEqual([1, 2]);
  expect(events[events.length - 1]).toMatchObject({ type: 'done', attempts: 3 });
});

test.each([
  ['U', 'U U', 'U2'],
  ["F'", 'F2 U', 'F'],
  ['L R', 'L U', 'L2 R'],
  ['U D', 'U U', 'U2 D'],
  ['B F', 'B U', 'B2 F'],
  ['R U', "U' R' U", ''],
])('simplifies the join between seed %s and its solution prefix', async (seed, algorithm, expected) => {
  const events: GenerationEvent[] = [], moves = parseAlgorithm(algorithm);
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum: 1, maximum: 1, count: 1 },
    { solve: () => ({ ...result(moves.length), moves, algorithm }) }, event => events.push(event),
    { scramble: () => seed, yieldControl: immediate });
  const rows = events.flatMap(event => event.type === 'row' ? [event.row] : []);
  expect(rows).toHaveLength(1);
  expect(rows[0].scramble).toBe(expected);
  expect(rows[0].moves).toEqual(moves.slice(-1));
  expect(rows[0].algorithm).toBe(MOVES[moves[moves.length - 1]]);
  expect(applyMoves(solvedCube(), parseAlgorithm(rows[0].scramble)))
    .toEqual(applyMoves(solvedCube(), [...parseAlgorithm(seed), ...moves.slice(0, -1)]));
});

test('equivalent simplified scrambles do not consume a row or length allocation', async () => {
  const events: GenerationEvent[] = [], scrambles = ['U U', 'U2', 'F'];
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum: 1, maximum: 1, count: 2 },
    { solve: () => result(1) }, event => events.push(event),
    { scramble: () => scrambles.shift()!, yieldControl: immediate });
  const rows = events.flatMap(event => event.type === 'row' ? [event.row] : []);
  expect(rows.map(row => row.scramble)).toEqual(['U2', 'F']);
  expect(rows.map(row => row.id)).toEqual([1, 2]);
  expect(events[events.length - 1]).toMatchObject({ type: 'done', attempts: 3 });
});

test('unproductive filters stop with a clear error instead of spinning forever', async () => {
  const events: GenerationEvent[] = [];
  await expect(generateWorksheet({ ...DEFAULT_SETTINGS, count: 2 },
    { solve: () => null }, event => events.push(event),
    { maxAttempts: 3, scramble: () => 'R', yieldControl: immediate }))
    .rejects.toThrow('Only 0 of 2 rows matched after 3 attempts');
  expect(events.filter(e => e.type === 'done')).toHaveLength(0);
  await expect(generateWorksheet(DEFAULT_SETTINGS, { solve: () => result(3) }, () => {},
    { maxElapsedMs: -1 })).rejects.toThrow('time limit');
});

test('search failures propagate without manufacturing an approximate row', async () => {
  const events: GenerationEvent[] = [];
  await expect(generateWorksheet(DEFAULT_SETTINGS,
    { solve: () => { throw new Error('Search failed'); } }, event => events.push(event),
    { scramble: () => 'R', yieldControl: immediate }))
    .rejects.toThrow('Search failed');
  expect(events).toEqual([]);
});
