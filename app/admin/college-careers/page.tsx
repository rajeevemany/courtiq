'use client';

import { useState, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOL LIST  (ordered by priority — top programs first)
// ─────────────────────────────────────────────────────────────────────────────

const D1_SCHOOLS = [
  // Ivy League
  'Columbia', 'Harvard', 'Princeton', 'Yale', 'Cornell', 'Penn', 'Dartmouth', 'Brown',
  // ACC
  'Duke', 'North Carolina', 'Virginia', 'NC State', 'Wake Forest', 'Notre Dame',
  'Florida State', 'Clemson', 'Georgia Tech', 'Louisville', 'Miami (FL)',
  'Pittsburgh', 'Syracuse', 'Boston College', 'Virginia Tech',
  // SEC
  'Florida', 'Georgia', 'Tennessee', 'Alabama', 'Kentucky', 'LSU',
  'Ole Miss', 'Mississippi State', 'Vanderbilt', 'South Carolina', 'Arkansas',
  'Auburn', 'Texas A&M',
  // Big 12
  'Texas', 'Oklahoma', 'TCU', 'Baylor', 'Kansas', 'Iowa State',
  // Big Ten
  'Michigan', 'Illinois', 'Ohio State', 'Northwestern', 'Minnesota', 'Indiana',
  // Pac-12 / West
  'Stanford', 'California', 'UCLA', 'USC', 'Washington', 'Arizona', 'Arizona State', 'Oregon', 'Utah',
  // WCC
  'Pepperdine', 'BYU', 'San Diego', "Saint Mary's",
  // AAC
  'Tulsa', 'Memphis', 'UCF',
  // Other
  'Virginia Commonwealth', 'Richmond', 'UC Santa Barbara', 'UC Irvine',
  'Army', 'Navy',
];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type LogEntry = { type: 'info' | 'success' | 'warn' | 'error'; msg: string; ts: string };

interface SchoolResult {
  school: string;
  roster_size: number;
  total_juniors: number;
  upserted: number;
  matched_exact: number;
  matched_high: number;
  ambiguous: number;
  no_match: number;
  errors: number;
  elapsed_ms: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CollegeCareersPage() {
  const [running, setRunning]       = useState(false);
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [results, setResults]       = useState<SchoolResult[]>([]);
  const [delayMs, setDelayMs]       = useState(700);
  const [startIdx, setStartIdx]     = useState(0);
  const [dryRun, setDryRun]         = useState(false);
  const stopRef                     = useRef(false);

  // Cumulative stats
  const totals = results.reduce(
    (acc, r) => ({
      upserted:      acc.upserted      + r.upserted,
      matched_exact: acc.matched_exact + r.matched_exact,
      matched_high:  acc.matched_high  + r.matched_high,
      ambiguous:     acc.ambiguous     + r.ambiguous,
      no_match:      acc.no_match      + r.no_match,
      errors:        acc.errors        + r.errors,
    }),
    { upserted: 0, matched_exact: 0, matched_high: 0, ambiguous: 0, no_match: 0, errors: 0 },
  );

  function log(type: LogEntry['type'], msg: string) {
    setLogs(prev => [...prev, { type, msg, ts: new Date().toLocaleTimeString() }]);
  }

  async function runAll() {
    stopRef.current = false;
    setRunning(true);
    setLogs([]);
    setResults([]);

    const schools = D1_SCHOOLS.slice(startIdx);
    log('info', `Starting college careers scrape for ${schools.length} schools (idx ${startIdx}–${D1_SCHOOLS.length - 1})${dryRun ? ' [DRY RUN]' : ''}`);

    for (let i = 0; i < schools.length; i++) {
      if (stopRef.current) {
        log('warn', `Stopped by user after ${i} schools.`);
        break;
      }

      const school = schools[i];
      log('info', `[${startIdx + i + 1}/${D1_SCHOOLS.length}] Processing ${school}...`);

      try {
        const res = await fetch('/api/admin/scrape-college-careers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}`,
          },
          body: JSON.stringify({ school, delay_ms: delayMs, dry_run: dryRun }),
        });

        if (!res.ok) {
          const err = await res.text();
          log('error', `${school}: HTTP ${res.status} — ${err}`);
          setResults(prev => [...prev, {
            school, roster_size: 0, total_juniors: 0,
            upserted: 0, matched_exact: 0, matched_high: 0,
            ambiguous: 0, no_match: 0, errors: 1, elapsed_ms: 0,
          }]);
          continue;
        }

        const json = await res.json();
        const r: SchoolResult = json.result;
        setResults(prev => [...prev, r]);

        const parts = [
          `roster=${r.roster_size}`,
          `juniors=${r.total_juniors}`,
          `upserted=${r.upserted}`,
          r.ambiguous   > 0 ? `ambiguous=${r.ambiguous}`   : null,
          r.no_match    > 0 ? `no_match=${r.no_match}`     : null,
          r.errors      > 0 ? `errors=${r.errors}`          : null,
        ].filter(Boolean).join(' | ');

        const type = r.errors > 0 ? 'warn' : r.upserted > 0 ? 'success' : 'info';
        log(type, `${school}: ${parts} (${(r.elapsed_ms / 1000).toFixed(1)}s)`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log('error', `${school}: ${msg}`);
        setResults(prev => [...prev, {
          school, roster_size: 0, total_juniors: 0,
          upserted: 0, matched_exact: 0, matched_high: 0,
          ambiguous: 0, no_match: 0, errors: 1, elapsed_ms: 0,
        }]);
      }
    }

    log('info', `Done. Total upserted: ${totals.upserted}`);
    setRunning(false);
  }

  const logColor: Record<LogEntry['type'], string> = {
    info:    'text-slate-400',
    success: 'text-green-400',
    warn:    'text-yellow-400',
    error:   'text-red-400',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-mono">
      <h1 className="text-2xl font-bold mb-2">College Careers Scraper</h1>
      <p className="text-slate-400 text-sm mb-6">
        Scrapes roster + career stats for D1 committed players. One API call per school.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Delay between bio fetches (ms)</label>
          <input
            type="number"
            value={delayMs}
            onChange={e => setDelayMs(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm w-28"
            disabled={running}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Start from school index</label>
          <input
            type="number"
            value={startIdx}
            onChange={e => setStartIdx(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm w-24"
            disabled={running}
            min={0}
            max={D1_SCHOOLS.length - 1}
          />
          <span className="text-slate-500 text-xs ml-2">{D1_SCHOOLS[startIdx] ?? '—'}</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            disabled={running}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-300">Dry run (no upserts)</span>
        </label>

        {!running ? (
          <button
            onClick={runAll}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-semibold transition-colors"
          >
            ▶ Start
          </button>
        ) : (
          <button
            onClick={() => { stopRef.current = true; }}
            className="px-5 py-2 bg-red-700 hover:bg-red-600 rounded text-sm font-semibold transition-colors"
          >
            ■ Stop
          </button>
        )}
      </div>

      {/* Stats bar */}
      {results.length > 0 && (
        <div className="flex gap-6 text-sm mb-6 p-3 bg-slate-900 rounded border border-slate-800">
          <span className="text-green-400">✓ upserted {totals.upserted}</span>
          <span className="text-slate-300">exact {totals.matched_exact}</span>
          <span className="text-slate-300">high {totals.matched_high}</span>
          <span className="text-yellow-400">ambiguous {totals.ambiguous}</span>
          <span className="text-slate-500">no_match {totals.no_match}</span>
          <span className="text-red-400">errors {totals.errors}</span>
          <span className="text-slate-500 ml-auto">{results.length} / {D1_SCHOOLS.length - startIdx} schools</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Log panel */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 h-96 overflow-y-auto text-xs leading-6">
          {logs.length === 0 && (
            <span className="text-slate-600">Log output will appear here...</span>
          )}
          {logs.map((entry, i) => (
            <div key={i} className={logColor[entry.type]}>
              <span className="text-slate-600 mr-2">{entry.ts}</span>
              {entry.msg}
            </div>
          ))}
        </div>

        {/* Results table */}
        <div className="bg-slate-900 border border-slate-800 rounded overflow-auto h-96">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-slate-400">School</th>
                <th className="text-right px-2 py-2 text-slate-400">Roster</th>
                <th className="text-right px-2 py-2 text-slate-400">Juniors</th>
                <th className="text-right px-2 py-2 text-slate-400">Upserted</th>
                <th className="text-right px-2 py-2 text-slate-400">Ambig</th>
                <th className="text-right px-2 py-2 text-slate-400">No Match</th>
                <th className="text-right px-2 py-2 text-slate-400">Err</th>
                <th className="text-right px-3 py-2 text-slate-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
                  <td className="px-3 py-1.5 text-slate-200">{r.school}</td>
                  <td className="text-right px-2 py-1.5 text-slate-400">{r.roster_size}</td>
                  <td className="text-right px-2 py-1.5 text-slate-400">{r.total_juniors}</td>
                  <td className={`text-right px-2 py-1.5 ${r.upserted > 0 ? 'text-green-400' : 'text-slate-500'}`}>{r.upserted}</td>
                  <td className={`text-right px-2 py-1.5 ${r.ambiguous > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{r.ambiguous}</td>
                  <td className={`text-right px-2 py-1.5 ${r.no_match > 0 ? 'text-slate-400' : 'text-slate-600'}`}>{r.no_match}</td>
                  <td className={`text-right px-2 py-1.5 ${r.errors > 0 ? 'text-red-400' : 'text-slate-600'}`}>{r.errors}</td>
                  <td className="text-right px-3 py-1.5 text-slate-500">{(r.elapsed_ms / 1000).toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && (
            <div className="text-slate-600 text-xs p-4">Results will appear here...</div>
          )}
        </div>
      </div>
    </div>
  );
}
