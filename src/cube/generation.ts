import { randomScramble } from './cube';
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
  const start = performance.now(), seen = new Set<string>();
  const maxAttempts = options.maxAttempts ?? Math.max(200, settings.count * 100);
  const maxElapsedMs = options.maxElapsedMs ?? 180000;
  const nextScramble = options.scramble ?? randomScramble;
  const yieldControl = options.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  let accepted = 0;
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const remaining = maxElapsedMs - (performance.now() - start);
    if (remaining <= 0) throw new Error('Generation reached its three-minute time limit. Kept rows are still exact; widen the turn range or simplify the target to find more.');
    const scramble = nextScramble();
    if (!seen.has(scramble)) {
      seen.add(scramble);
      const solution = solver.solve(scramble, settings, Math.min(30000, remaining));
      if (solution && solution.moves.length >= settings.minimum) {
        emit({ type: 'row', row: { ...solution, scramble, id: ++accepted } });
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
