/** @jest-environment node */
import { GenerationEvent, generateWorksheet } from './generation';
import { DEFAULT_SETTINGS, Solution } from './solver';

const result = (length: number): Solution => ({
  moves: Array(length).fill(0), algorithm: Array(length).fill('U').join(' '),
  cross: 'White', pairs: ['Blue / Red'], nodes: 1, elapsedMs: 1,
});
const immediate = () => Promise.resolve();

test('inclusive bounds filter optimal lengths, duplicate scrambles are skipped, and IDs are consecutive', async () => {
  const events: GenerationEvent[] = [];
  const scrambles = ['R', 'R', 'F', 'L', 'B', 'D'];
  const solve = jest.fn().mockReturnValueOnce(result(1)).mockReturnValueOnce(result(2))
    .mockReturnValueOnce(null).mockReturnValueOnce(result(4));
  await generateWorksheet({ ...DEFAULT_SETTINGS, minimum: 2, maximum: 4, count: 2 },
    { solve }, event => events.push(event),
    { scramble: () => scrambles.shift()!, yieldControl: immediate });
  const rows = events.filter((e): e is Extract<GenerationEvent, { type: 'row' }> => e.type === 'row');
  expect(rows.map(e => e.row.moves.length)).toEqual([2, 4]);
  expect(rows.map(e => e.row.id)).toEqual([1, 2]);
  expect(rows.map(e => e.row.scramble)).toEqual(['F', 'B']);
  expect(solve).toHaveBeenCalledTimes(4);
  expect(events[events.length - 1]).toMatchObject({ type: 'done', attempts: 5 });
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
