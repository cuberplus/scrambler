export function createSolverWorker(): Worker {
  return new Worker(new URL('./solver.worker.ts', import.meta.url));
}
