import { MOVES, parseAlgorithm, randomScramble, simplifyMoves } from './cube';
import { Settings, Solution, Solver, validateSettings } from './solver';

export interface WorksheetRow extends Solution { id: number; scramble: string }
export type GenerationEvent =
  | { type: 'initializing'; message: string }
  | { type: 'progress'; attempts: number; accepted: number; elapsedMs: number }
  | { type: 'row'; row: WorksheetRow }
  | { type: 'done'; attempts: number; elapsedMs: number }
  | { type: 'error'; message: string };
export interface GenerateOptions {
  maxAttempts?: number;
  maxElapsedMs?: number;
  scramble?: () => string;
  yieldControl?: () => Promise<void>;
}

export async function generateWorksheet(settings: Settings, solver: Pick<Solver, 'solve'>,
  emit: (event: GenerationEvent) => void, options: GenerateOptions = {}): Promise<void> {
  validateSettings(settings);
  const start = performance.now(), seen = new Set<string>(), emitted = new Set<string>();
  const counts: number[] = Array(settings.maximum - settings.minimum + 1).fill(0);
  const searchSettings = { ...settings, maximum: 20 };
  const maxAttempts = options.maxAttempts ?? Math.max(200, settings.count * 100);
  const maxElapsedMs = options.maxElapsedMs ?? 180000;
  const nextScramble = options.scramble ?? randomScramble;
  const yieldControl = options.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  let accepted = 0, highest = settings.minimum, balancingMisses = 0;
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const remaining = maxElapsedMs - (performance.now() - start);
    if (remaining <= 0) throw new Error('Generation reached its three-minute time limit. Kept rows are still exact; widen the turn range or simplify the target to find more.');
    const seed = nextScramble();
    if (!seen.has(seed)) {
      seen.add(seed);
      const solution = solver.solve(seed, searchSettings, Math.min(30000, remaining));
      if (solution && solution.moves.length >= settings.minimum) {
        highest = Math.max(highest, Math.min(solution.moves.length, settings.maximum));
        const least = Math.min(...counts.slice(0, highest - settings.minimum + 1));
        let length = settings.minimum;
        for (let candidate = length + 1; candidate <= Math.min(solution.moves.length, settings.maximum); candidate++) {
          if (counts[candidate - settings.minimum] < counts[length - settings.minimum]) length = candidate;
        }
        const prefix = solution.moves.length - length;
        // Every suffix of a globally shortest solution is itself globally shortest.
        const scramble = simplifyMoves([...parseAlgorithm(seed), ...solution.moves.slice(0, prefix)])
          .map(move => MOVES[move]).join(' ');
        // Retry easy seeds briefly when a harder length is behind, without stalling on rare lengths.
        if (!emitted.has(scramble) &&
            (counts[length - settings.minimum] === least || ++balancingMisses >= 8)) {
          emitted.add(scramble);
          const moves = solution.moves.slice(prefix);
          counts[length - settings.minimum]++;
          balancingMisses = 0;
          emit({ type: 'row', row: {
            ...solution, moves, algorithm: moves.map(move => MOVES[move]).join(' '), scramble, id: ++accepted,
          } });
        }
      }
    }
    emit({ type: 'progress', attempts, accepted, elapsedMs: performance.now() - start });
    if (accepted === settings.count) {
      emit({ type: 'done', attempts, elapsedMs: performance.now() - start });
      return;
    }
    await yieldControl();
  }
  throw new Error(`Only ${accepted} of ${settings.count} rows matched after ${maxAttempts} attempts. Widen the turn range and generate again.`);
}
