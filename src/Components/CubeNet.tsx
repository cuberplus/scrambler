import React, { memo, useMemo } from 'react';
import { FACES, HEX, applyMoves, parseAlgorithm, solvedCube, stickers } from '../cube/cube';

const OFFSETS = [[3, 0], [6, 3], [3, 3], [3, 6], [0, 3], [9, 3]];

function CubeNet({ algorithm }: { algorithm: string }) {
  const faces = useMemo(() => stickers(applyMoves(solvedCube(), parseAlgorithm(algorithm))), [algorithm]);
  return <svg className="cube-net" viewBox="-1 -1 126 96" role="img" aria-label={`Scrambled cube: ${algorithm}`}>
    <title>Scramble visualization · U white, F green, R red</title>
    {faces.map(({ face, row, col, color }) => <rect key={`${face}-${row}-${col}`}
      x={(OFFSETS[face][0] + col) * 10 + Math.floor(OFFSETS[face][0] / 3)}
      y={(OFFSETS[face][1] + row) * 10 + Math.floor(OFFSETS[face][1] / 3)}
      width="9" height="9" rx="1" fill={HEX[color]} stroke="#243c35" strokeWidth=".5">
      <title>{FACES[face]} {row + 1},{col + 1}</title>
    </rect>)}
  </svg>;
}
export default memo(CubeNet);
