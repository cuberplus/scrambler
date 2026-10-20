/** @jest-environment node */
import {
  COLORS, CORNER_MOVES, CORNERS, EDGE_MOVES, EDGES, MOVES, ROTATIONS,
  applyMoves, inverseMoves, parseAlgorithm, randomScramble, rotateCube, simplifyMoves, solvedCube, stickers,
} from './cube';
import { referenceFacelets, seededRandom } from './testHelpers';

test('every move agrees with an independent 54-facelet implementation', () => {
  const random = seededRandom(203);
  const sequences = [[], ...MOVES.map((_, m) => [m]),
    ...Array.from({ length: 100 }, () => parseAlgorithm(randomScramble(25, random)))];
  for (const moves of sequences) {
    const actual = new Array<number>(54);
    for (const s of stickers(applyMoves(solvedCube(), moves))) actual[s.face * 9 + s.row * 3 + s.col] = s.color;
    expect(actual).toEqual(referenceFacelets(moves));
  }
});

test('quarter turns have order four and algorithms have exact inverses', () => {
  for (let face = 0; face < 6; face++) {
    expect(applyMoves(solvedCube(), Array(4).fill(face * 3))).toEqual(solvedCube());
    expect(applyMoves(solvedCube(), [face * 3, face * 3 + 2])).toEqual(solvedCube());
    expect(applyMoves(solvedCube(), [face * 3 + 1, face * 3 + 1])).toEqual(solvedCube());
  }
  const moves = parseAlgorithm(randomScramble(100, seededRandom(42)));
  expect(applyMoves(solvedCube(), [...moves, ...inverseMoves(moves)])).toEqual(solvedCube());
});

test('moves preserve orientation sums, permutation parity, and all 54 stickers', () => {
  const parity = (p: number[]) => p.reduce((sum, x, i) => sum + p.slice(i + 1).filter(y => x > y).length, 0) % 2;
  const random = seededRandom(71);
  for (let i = 0; i < 100; i++) {
    const cube = applyMoves(solvedCube(), parseAlgorithm(randomScramble(25, random)));
    expect(Array.from(cube.edges).reduce((s, e) => s + e % 2, 0) % 2).toBe(0);
    expect(Array.from(cube.corners).reduce((s, c) => s + c % 3, 0) % 3).toBe(0);
    expect(parity(Array.from(cube.edges, e => Math.floor(e / 2))))
      .toBe(parity(Array.from(cube.corners, c => Math.floor(c / 3))));
    const net = stickers(cube);
    expect(new Set(net.map(s => `${s.face}:${s.row}:${s.col}`)).size).toBe(54);
    COLORS.forEach((_, color) => expect(net.filter(s => s.color === color)).toHaveLength(9));
  }
  expect(EDGE_MOVES).toHaveLength(24 * 18);
  expect(CORNER_MOVES).toHaveLength(24 * 18);
  expect(EDGES).toHaveLength(12);
  expect(CORNERS).toHaveLength(8);
});

test('all 24 cube rotations preserve moves, solved states, and their inverses', () => {
  expect(ROTATIONS).toHaveLength(24);
  expect(new Set(ROTATIONS.map(r => r.faces.join(','))).size).toBe(24);
  const cube = applyMoves(solvedCube(), parseAlgorithm("R U2 F' L B D'"));
  for (const rotation of ROTATIONS) {
    expect(rotateCube(solvedCube(), rotation)).toEqual(solvedCube());
    expect(rotateCube(rotateCube(cube, rotation), { faces: rotation.inverse, inverse: rotation.faces })).toEqual(cube);
    for (let move = 0; move < 18; move++) {
      const transformed = rotation.faces[Math.floor(move / 3)] * 3 + move % 3;
      expect(rotateCube(applyMoves(cube, [move]), rotation))
        .toEqual(applyMoves(rotateCube(cube, rotation), [transformed]));
    }
  }
});

test('scrambles have 25 legal HTM moves and avoid reducible neighboring turns', () => {
  const random = seededRandom(822);
  const scrambles = Array.from({ length: 100 }, () => randomScramble(25, random));
  expect(new Set(scrambles).size).toBe(100);
  for (const scramble of scrambles) {
    const moves = parseAlgorithm(scramble);
    expect(moves).toHaveLength(25);
    moves.slice(1).forEach((move, i) => expect(Math.floor(move / 3)).not.toBe(Math.floor(moves[i] / 3)));
  }
  expect(parseAlgorithm(' \n ')).toEqual([]);
  expect(() => parseAlgorithm('R banana')).toThrow('Invalid move');
  expect(() => applyMoves(solvedCube(), [18])).toThrow('Invalid move');
});

test.each([
  ['U U', 'U2'],
  ["F' F2", 'F'],
  ['L R L', 'L2 R'],
  ["U D U'", 'D'],
  ['B F2 B', 'B2 F2'],
  ["R U D U' D' R'", ''],
  ['U2 U2', ''],
  ['R U R', 'R U R'],
  ['', ''],
])('simplifies %s to %s without changing the cube', (algorithm, expected) => {
  const moves = parseAlgorithm(algorithm), simplified = simplifyMoves(moves);
  expect(simplified.map(move => MOVES[move]).join(' ')).toBe(expected);
  expect(applyMoves(solvedCube(), simplified)).toEqual(applyMoves(solvedCube(), moves));
  expect(moves).toEqual(parseAlgorithm(algorithm));
});

test.each([
  ["R F U U' F' R'", ''],
  ["R L F B U D U' D' F' B' R' L'", ''],
  ["F R U U' R' F", 'F2'],
])('cascading cancellations in %s leave no further reductions', (algorithm, expected) => {
  const moves = parseAlgorithm(algorithm), simplified = simplifyMoves(moves);
  expect(simplified.map(move => MOVES[move]).join(' ')).toBe(expected);
  expect(applyMoves(solvedCube(), simplified)).toEqual(applyMoves(solvedCube(), moves));
  expect(simplifyMoves(simplified)).toEqual(simplified);
});

test('all three-move combinations simplify without changing state or leaving reducible turns', () => {
  for (let a = 0; a < 18; a++) {
    for (let b = 0; b < 18; b++) {
      for (let c = 0; c < 18; c++) {
        const moves = [a, b, c], simplified = simplifyMoves(moves);
        expect(applyMoves(solvedCube(), simplified)).toEqual(applyMoves(solvedCube(), moves));
        const faces = simplified.map(move => Math.floor(move / 3));
        expect(faces.every((face, i) => i === 0 || face !== faces[i - 1])).toBe(true);
        expect(faces.length < 3 || faces[0] !== faces[2] || faces[0] % 3 !== faces[1] % 3).toBe(true);
        expect(simplifyMoves(simplified)).toEqual(simplified);
      }
    }
  }
});
