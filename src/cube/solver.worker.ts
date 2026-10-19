/// <reference lib="webworker" />
import { generateWorksheet, GenerationEvent } from './generation';
import { Settings, Solver, validateSettings } from './solver';

declare const self: DedicatedWorkerGlobalScope;
// eslint-disable-next-line no-restricted-globals
const scope = self;
let solver: Solver | undefined;
scope.onmessage = async (event: MessageEvent<Settings>) => {
  const emit = (message: GenerationEvent) => scope.postMessage(message);
  try {
    validateSettings(event.data);
    emit({ type: 'initializing', message: 'Building exact-search tables on your device. The first batch takes a little longer.' });
    if (!solver) solver = new Solver();
    await generateWorksheet(event.data, solver, emit);
  } catch (error) {
    emit({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
export {};
