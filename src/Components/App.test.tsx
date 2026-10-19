import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import { GenerationEvent } from '../cube/generation';
import { createSolverWorker } from '../cube/workerClient';

jest.mock('../cube/workerClient', () => ({ createSolverWorker: jest.fn() }));
const factory = jest.mocked(createSolverWorker);
let postMessage: jest.Mock, terminate: jest.Mock;
let onmessage: ((event: MessageEvent<GenerationEvent>) => void) | null;
let onerror: ((event: ErrorEvent) => void) | null;

beforeEach(() => {
  postMessage = jest.fn(); terminate = jest.fn(); onmessage = null; onerror = null;
  factory.mockImplementation(() => ({
    postMessage, terminate,
    onmessageerror: null,
    addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
    get onmessage() { return onmessage; },
    set onmessage(value) { onmessage = value; },
    get onerror() { return onerror; },
    set onerror(value) { onerror = value; },
  }));
});

function emit(data: GenerationEvent) {
  act(() => { onmessage?.({ data } as MessageEvent<GenerationEvent>); });
}
function addRows() {
  for (const [id, count] of [[1, 7], [2, 3]]) {
    emit({ type: 'row', row: {
      id, scramble: 'R U F2', moves: Array(count).fill(0), algorithm: Array(count).fill('U').join(' '),
      cross: 'White', pairs: ['Blue / Red'], nodes: 50, elapsedMs: 2,
    } });
  }
  emit({ type: 'done', attempts: 2, elapsedMs: 30 });
}

test('branding is CuberPlus - Scrambler without a cube logo', () => {
  const { container } = render(<App />);
  const brand = screen.getByRole('link', { name: 'CuberPlus - Scrambler' });
  expect(brand).toHaveAttribute('href', './');
  expect(brand.querySelector('svg')).toBeNull();
  expect(container.querySelector('.empty-cube')).toBeNull();
});

test('the workspace starts below the header without a promotional intro', () => {
  render(<App />);
  expect(screen.getByRole('main').firstElementChild).toHaveClass('workspace');
  expect(screen.queryByText(/a better start to every solve/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/nothing sent to a server/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/from the first edge/i)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Set your challenge' })).toBeInTheDocument();
});

test('initial generation requests 20 optimal X-Cross scrambles in a worker and keeps controls responsive', () => {
  render(<App />);
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ mode: 'xcross', count: 20 }));
  expect(screen.getByRole('button', { name: /Generate worksheet/ })).toBeDisabled();
  expect(screen.getByText('Columns')).toBeEnabled();
  expect(screen.getByRole('progressbar')).toHaveAttribute('max', '20');
});

test('rows are sorted by HTM, diagrams are inline SVGs, and column subsets and blank custom columns work', () => {
  render(<App />);
  addRows();
  let rows = screen.getAllByRole('row').slice(1);
  expect(within(rows[0]).getByText('3')).toBeInTheDocument();
  expect(within(rows[1]).getByText('7')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /# Turns Required/ }));
  expect(within(screen.getAllByRole('row')[1]).getByText('7')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /# Turns Required/ }));
  expect(screen.getAllByRole('img', { name: /Scrambled cube/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Solution Algorithm' }));
  expect(screen.queryByRole('columnheader', { name: 'Solution Algorithm' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Add a blank column'), { target: { value: 'My first pair' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add custom column' }));
  expect(screen.getByRole('columnheader', { name: 'My first pair' })).toBeInTheDocument();
  rows = screen.getAllByRole('row').slice(1);
  rows.forEach(row => expect(row.lastElementChild).toBeEmptyDOMElement());
  fireEvent.click(screen.getByRole('button', { name: 'Remove My first pair column' }));
  expect(screen.queryByRole('columnheader', { name: 'My first pair' })).not.toBeInTheDocument();
});

test('XX-Cross options, fixed colors/pairs, turn bounds, printing, and cancellation are wired', () => {
  const print = jest.spyOn(window, 'print').mockImplementation(() => {});
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Stop generation' }));
  expect(terminate).toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Solve target'), { target: { value: 'xxcross' } });
  fireEvent.change(screen.getByLabelText('Cross / base color'), { target: { value: 'White' } });
  fireEvent.change(screen.getByLabelText('Required F2L pair'), { target: { value: '11' } });
  fireEvent.change(screen.getByLabelText('Pair relationship'), { target: { value: 'diagonal' } });
  fireEvent.change(screen.getByLabelText('Minimum turns'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Maximum turns'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /Generate worksheet/ }));
  expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
    mode: 'xxcross', cross: 'White', pair: '11', relation: 'diagonal', minimum: 4, maximum: 10,
  }));
  addRows();
  fireEvent.click(screen.getByRole('button', { name: /Print sheet/ }));
  expect(print).toHaveBeenCalledTimes(1);
  print.mockRestore();
});

test('invalid constraints and solver errors are visible, and a stopped worksheet retains finished rows', () => {
  render(<App />);
  emit({ type: 'row', row: { id: 1, scramble: 'R', moves: [2], algorithm: "R'", cross: 'White', pairs: ['Blue / Red'], nodes: 1, elapsedMs: 1 } });
  fireEvent.click(screen.getByRole('button', { name: 'Stop generation' }));
  expect(screen.getByRole('img', { name: 'Scrambled cube: R' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Solve target'), { target: { value: 'xxcross' } });
  fireEvent.change(screen.getByLabelText('Cross / base color'), { target: { value: 'White' } });
  fireEvent.change(screen.getByLabelText('Required F2L pair'), { target: { value: '11' } });
  fireEvent.change(screen.getByLabelText('Second required pair'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: /Generate worksheet/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('different');
  emit({ type: 'error', message: 'Exact search time limit' });
  expect(screen.getByRole('alert')).toHaveTextContent('Exact search time limit');
});

test('unmounting terminates the worker, and worker loading failures are explicit', () => {
  const { unmount } = render(<App />);
  act(() => { onerror?.({ message: 'Load failed' } as ErrorEvent); });
  expect(screen.getByRole('alert')).toHaveTextContent('Load failed');
  expect(terminate).toHaveBeenCalled();
  unmount();
});

test.each([
  ['White', ['Green / Red', 'Green / Orange', 'Blue / Orange', 'Blue / Red']],
  ['Yellow', ['Green / Red', 'Green / Orange', 'Blue / Orange', 'Blue / Red']],
  ['Red', ['White / Green', 'White / Blue', 'Yellow / Green', 'Yellow / Blue']],
  ['Orange', ['White / Green', 'White / Blue', 'Yellow / Green', 'Yellow / Blue']],
  ['Green', ['White / Red', 'White / Orange', 'Yellow / Red', 'Yellow / Orange']],
  ['Blue', ['White / Red', 'White / Orange', 'Yellow / Red', 'Yellow / Orange']],
])('%s base offers exactly its four valid pairs in every pair-solving mode', (color, expected) => {
  render(<App />);
  addRows();
  fireEvent.change(screen.getByLabelText('Cross / base color'), { target: { value: color } });
  for (const mode of ['xcross', 'block', 'xxcross']) {
    fireEvent.change(screen.getByLabelText('Solve target'), { target: { value: mode } });
    const selectors = [screen.getByLabelText('Required F2L pair')];
    if (mode === 'xxcross') selectors.push(screen.getByLabelText('Second required pair'));
    for (const selector of selectors) {
      const options = within(selector).getAllByRole('option');
      expect(options).toHaveLength(5);
      expect(options.slice(1).map(option => option.textContent)).toEqual(expected);
    }
  }
  fireEvent.change(screen.getByLabelText('Cross / base color'), { target: { value: 'any' } });
  for (const label of ['Required F2L pair', 'Second required pair']) {
    expect(within(screen.getByLabelText(label)).getAllByRole('option')).toHaveLength(13);
  }
});

test('changing the base preserves valid selected pairs and resets invalid selections to any', () => {
  render(<App />);
  addRows();
  fireEvent.change(screen.getByLabelText('Solve target'), { target: { value: 'xxcross' } });
  const cross = screen.getByLabelText('Cross / base color');
  const first = screen.getByLabelText('Required F2L pair');
  const second = screen.getByLabelText('Second required pair');
  fireEvent.change(first, { target: { value: '8' } });
  fireEvent.change(second, { target: { value: '10' } });
  for (const color of ['White', 'Yellow', 'any']) {
    fireEvent.change(cross, { target: { value: color } });
    expect(first).toHaveValue('8');
    expect(second).toHaveValue('10');
  }
  fireEvent.change(first, { target: { value: '0' } });
  fireEvent.change(cross, { target: { value: 'White' } });
  expect(first).toHaveValue('any');
  expect(second).toHaveValue('10');
  fireEvent.change(cross, { target: { value: 'Red' } });
  expect(first).toHaveValue('any');
  expect(second).toHaveValue('any');
  fireEvent.click(screen.getByRole('button', { name: /Generate worksheet/ }));
  expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
    cross: 'Red', pair: 'any', secondPair: 'any',
  }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
