import React, { useEffect, useRef, useState } from 'react';
import { COLORS, Color, EDGES, HEX } from '../cube/cube';
import { GenerationEvent, WorksheetRow } from '../cube/generation';
import {
  DEFAULT_SETTINGS, MODE_LABELS, Mode, PairRelation, Settings, pairLabel, validateSettings,
} from '../cube/solver';
import { createSolverWorker } from '../cube/workerClient';
import CubeNet from './CubeNet';
import '../CSS/App.css';

const BUILT_INS = [
  ['scramble', 'Scramble Algorithm'], ['visualization', 'Scramble Visualization'],
  ['turns', '# Turns Required'], ['solution', 'Solution Algorithm'],
  ['cross', 'Solution Cross Color'], ['pairs', 'Solution Pair Color'],
] as const;
type BuiltIn = typeof BUILT_INS[number][0];
interface CustomColumn { id: string; name: string }
type Status = 'working' | 'complete' | 'cancelled' | 'error' | 'idle';

function pairOptions(cross: Settings['cross']): number[] {
  const base = cross === 'any' ? -1 : COLORS.indexOf(cross);
  const opposite = (base + 3) % 6;
  return EDGES.flatMap((faces, pair) =>
    base < 0 || faces.every(face => face !== base && face !== opposite) ? [pair] : []);
}

function App() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [batchSettings, setBatchSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [rows, setRows] = useState<WorksheetRow[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('Ready to build your worksheet.');
  const [attempts, setAttempts] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<BuiltIn[]>(BUILT_INS.map(([key]) => key));
  const [custom, setCustom] = useState<CustomColumn[]>([]);
  const [customName, setCustomName] = useState('');
  const [ascending, setAscending] = useState(true);
  const worker = useRef<Worker>();
  const customId = useRef(0);
  const busy = status === 'working';

  const receive = (event: MessageEvent<GenerationEvent>) => {
    const data = event.data;
    if (data.type === 'initializing') setMessage(data.message);
    if (data.type === 'row') setRows(previous => [...previous, data.row]);
    if (data.type === 'progress') {
      setAttempts(data.attempts);
      setElapsed(data.elapsedMs);
      setMessage(`Finding exact solutions · ${data.accepted} kept / ${data.attempts} tried`);
    }
    if (data.type === 'done') {
      setStatus('complete');
      setElapsed(data.elapsedMs);
      setMessage(`Worksheet ready · ${data.attempts} scrambles tested`);
    }
    if (data.type === 'error') { setStatus('error'); setMessage(data.message); }
  };

  const generate = (options: Settings) => {
    try {
      validateSettings(options);
      if (!worker.current) {
        worker.current = createSolverWorker();
        worker.current.onmessage = receive;
        worker.current.onerror = event => {
          setStatus('error');
          setMessage(`The solver worker failed: ${event.message || 'Your browser could not load the solver.'}`);
          worker.current?.terminate();
          worker.current = undefined;
        };
      }
      setRows([]);
      setAttempts(0);
      setElapsed(0);
      setAscending(true);
      setBatchSettings({ ...options });
      setStatus('working');
      setMessage('Starting the local solver…');
      worker.current.postMessage(options);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    generate({ ...DEFAULT_SETTINGS });
    return () => { worker.current?.terminate(); worker.current = undefined; };
    // A worksheet is generated once on mount; edits are applied with Generate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings(previous => ({ ...previous, [key]: value }));
  const changeCross = (cross: Settings['cross']) => setSettings(previous => {
    const pairs = pairOptions(cross);
    const keepValidPair = (pair: string) => pair === 'any' || pairs.includes(Number(pair)) ? pair : 'any';
    return { ...previous, cross, pair: keepValidPair(previous.pair), secondPair: keepValidPair(previous.secondPair) };
  });
  const availablePairs = pairOptions(settings.cross);
  const sorted = rows.slice().sort((a, b) =>
    (ascending ? 1 : -1) * (a.moves.length - b.moves.length) || a.id - b.id);
  const visible = BUILT_INS.filter(([key]) => selected.includes(key));
  const hasPairs = settings.mode !== 'cross';
  const addColumn = (event: React.FormEvent) => {
    event.preventDefault();
    const name = customName.trim();
    if (!name) return;
    setCustom(previous => [...previous, { id: `custom-${++customId.current}`, name }]);
    setCustomName('');
  };
  const cell = (row: WorksheetRow, key: BuiltIn) => {
    switch (key) {
      case 'scramble': return <span className="algorithm">{row.scramble}</span>;
      case 'visualization': return <CubeNet algorithm={row.scramble} />;
      case 'turns': return <span className="turn-count">{row.moves.length}<small>HTM</small></span>;
      case 'solution': return <span className="algorithm solution">{row.algorithm || 'Already solved'}</span>;
      case 'cross': return <span className="color-tag"><i style={{ backgroundColor: HEX[COLORS.indexOf(row.cross)] }} />{row.cross}</span>;
      case 'pairs': return row.pairs.length
        ? <span className="pair-list">{row.pairs.map(pair => <span key={pair}>{pair}</span>)}</span>
        : <span className="not-applicable">Not applicable</span>;
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="./">CuberPlus - Scrambler</a>
        <div className="local-badge"><span />100% on your device</div>
      </header>
      <main>
        <div className="workspace">
          <aside className="settings-panel">
            <div className="panel-heading"><span className="section-number">01</span><h2>Set your challenge</h2></div>
            <form onSubmit={event => { event.preventDefault(); generate(settings); }}>
              <fieldset disabled={busy}>
                <legend className="sr-only">Solver settings</legend>
                <label htmlFor="mode">Solve target</label>
                <select id="mode" value={settings.mode} onChange={e => update('mode', e.target.value as Mode)}>
                  {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <p className="field-hint">{{
                  cross: 'Four edges, aligned with their centers.',
                  xcross: 'A full cross + one solved F2L pair.',
                  block: 'Two cross edges + the F2L pair between them.',
                  xxcross: 'A full cross + two solved F2L pairs.',
                }[settings.mode]}</p>
                <label htmlFor="cross">Cross / base color</label>
                <select id="cross" value={settings.cross} onChange={e => changeCross(e.target.value as Color | 'any')}>
                  <option value="any">Color neutral · any color</option>
                  {COLORS.map(color => <option key={color}>{color}</option>)}
                </select>
                {hasPairs && <>
                  <label htmlFor="pair">Required F2L pair</label>
                  <select id="pair" value={settings.pair} onChange={e => update('pair', e.target.value)}>
                    <option value="any">Any pair · find the shortest</option>
                    {availablePairs.map(i => <option key={i} value={i}>{pairLabel(i)}</option>)}
                  </select>
                </>}
                {settings.mode === 'xxcross' && <>
                  <label htmlFor="second-pair">Second required pair</label>
                  <select id="second-pair" value={settings.secondPair} onChange={e => update('secondPair', e.target.value)}>
                    <option value="any">Any other pair</option>
                    {availablePairs.map(i => <option key={i} value={i}>{pairLabel(i)}</option>)}
                  </select>
                  <label htmlFor="relation">Pair relationship</label>
                  <select id="relation" value={settings.relation} onChange={e => update('relation', e.target.value as PairRelation)}>
                    <option value="any">Any two pairs</option>
                    <option value="adjacent">Adjacent pairs</option>
                    <option value="diagonal">Diagonal pairs</option>
                  </select>
                </>}
                <div className="label-row"><label htmlFor="minimum">Solution length</label><span>HTM</span></div>
                <div className="range-inputs">
                  <div><input id="minimum" aria-label="Minimum turns" type="number" min="0" max={settings.maximum} required value={settings.minimum} onChange={e => update('minimum', e.target.valueAsNumber)} /><span>min</span></div>
                  <span className="range-dash">—</span>
                  <div><input id="maximum" aria-label="Maximum turns" type="number" min={settings.minimum} max="20" required value={settings.maximum} onChange={e => update('maximum', e.target.valueAsNumber)} /><span>max</span></div>
                </div>
                <p className="field-hint">Keep only scrambles whose shortest solution is in this inclusive range. A half turn counts as one move.</p>
                <label htmlFor="count">Number of scrambles</label>
                <input id="count" type="number" min="1" required value={settings.count} onChange={e => update('count', e.target.valueAsNumber)} />
                <button className="primary-button" type="submit">Generate worksheet <span aria-hidden="true">↗</span></button>
              </fieldset>
            </form>
            {busy && <button className="cancel-button" onClick={() => {
              worker.current?.terminate(); worker.current = undefined;
              setStatus('cancelled'); setMessage('Generation stopped. Completed rows are kept.');
            }}>Stop generation</button>}
            <div className="solver-note"><span aria-hidden="true">◎</span><p><strong>Optimal, not approximate.</strong> Every solution is the shortest for your selected target and constraints. Ties return one optimal choice. XX-Cross can take longer.</p></div>
          </aside>
          <section className="worksheet-panel" aria-labelledby="worksheet-title">
            <div className="worksheet-heading">
              <div><div className="panel-heading"><span className="section-number">02</span><h2 id="worksheet-title">Your practice sheet</h2></div>
                <p>{MODE_LABELS[batchSettings.mode]}<span className="separator">/</span>{batchSettings.cross === 'any' ? 'Color neutral' : `${batchSettings.cross} base`}<span className="separator">/</span>{batchSettings.minimum}–{batchSettings.maximum} HTM</p></div>
              <button className="print-button" disabled={!rows.length} onClick={() => window.print()}><span aria-hidden="true">▤</span> Print sheet</button>
            </div>
            <div className="sheet-toolbar">
              <div className="row-summary"><strong>{rows.length.toString().padStart(2, '0')}</strong><span> / {batchSettings.count} scrambles</span></div>
              <details className="columns-menu"><summary>Columns <span>{visible.length + custom.length}</span><span aria-hidden="true">⌄</span></summary>
                <div className="columns-popover">
                  <p className="popover-title">Make it your own</p>
                  {BUILT_INS.map(([key, label]) => <label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={e => setSelected(previous => e.target.checked ? [...previous, key] : previous.filter(c => c !== key))} />{label}</label>)}
                  {custom.map(column => <div className="custom-column" key={column.id}><span>{column.name}</span><button aria-label={`Remove ${column.name} column`} onClick={() => setCustom(previous => previous.filter(c => c.id !== column.id))}>×</button></div>)}
                  <form onSubmit={addColumn}><label htmlFor="custom-name">Add a blank column</label><div className="custom-input"><input id="custom-name" maxLength={80} placeholder="e.g. My solution" value={customName} onChange={e => setCustomName(e.target.value)} /><button type="submit" disabled={!customName.trim()} aria-label="Add custom column">+</button></div></form>
                  <p className="field-hint">Custom columns stay empty, ready for your notes on paper.</p>
                </div>
              </details>
            </div>
            <div className={`generation-status ${status === 'error' ? 'has-error' : ''}`} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">
              <span className={busy ? 'status-dot pulsing' : 'status-dot'} /><span>{message}</span>
              {elapsed > 0 && <span className="elapsed">{(elapsed / 1000).toFixed(1)}s</span>}
            </div>
            {busy && <progress value={rows.length} max={batchSettings.count} aria-label="Worksheet generation progress" />}
            <div className="table-scroll">
              {visible.length + custom.length > 0 ? <table className="worksheet">
                <caption className="sr-only">Optimal {MODE_LABELS[batchSettings.mode]} practice scrambles, sorted by solution length</caption>
                <thead><tr><th scope="col" className="row-number">No.</th>{visible.map(([key, label]) =>
                  <th key={key} scope="col" className={`column-${key}`}>{key === 'turns'
                    ? <button className="sort-button" onClick={() => setAscending(!ascending)}>{label} <span aria-hidden="true">{ascending ? '↑' : '↓'}</span></button>
                    : label}</th>)}{custom.map(c => <th key={c.id} scope="col" className="column-custom">{c.name}</th>)}</tr></thead>
                <tbody>{sorted.map((row, i) => <tr key={row.id}><td className="row-number">{String(i + 1).padStart(2, '0')}</td>
                  {visible.map(([key]) => <td key={key} className={`column-${key}`}>{cell(row, key)}</td>)}
                  {custom.map(c => <td key={c.id} className="column-custom" />)}
                </tr>)}</tbody>
              </table> : <div className="empty-state">Choose a column above to display your worksheet.</div>}
              {!rows.length && visible.length + custom.length > 0 && <div className="empty-state"><h3>{busy ? 'Good starts are worth finding.' : 'A fresh start awaits.'}</h3><p>{busy ? 'Your browser is searching for truly optimal solutions.' : 'Generate a worksheet to fill this space.'}</p>{busy && <small>You can stop at any time. No data leaves your device.</small>}</div>}
            </div>
            <div className="sheet-footer"><span>{attempts ? `${attempts} scrambles tested` : 'Made for deliberate practice'}</span><span>{ascending ? 'Shortest' : 'Longest'} first. Progress one turn at a time.</span></div>
          </section>
        </div>
        <footer className="page-footer"><span>SCRAMBLER<span className="brand-dot">.</span><span className="footer-divider">/</span>Less guessing. More solving.</span>
          <p>25-turn random-move scrambles, not WCA random-state scrambles.<br />Orientation: U white · F green · R red. Solutions use the scramble’s original orientation.</p></footer>
      </main>
    </div>
  );
}

export default App;
