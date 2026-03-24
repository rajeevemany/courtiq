'use client';

import { useState, useRef, useEffect } from 'react';

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
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CollegeCareersPage() {
  const [running, setRunning]               = useState(false);
  const [logLines, setLogLines]             = useState<string[]>([]);
  const [delayMs, setDelayMs]               = useState(700);
  const [startIdx, setStartIdx]             = useState(0);
  const [startFrom, setStartFrom]           = useState('');
  const [dryRun, setDryRun]                 = useState(false);
  const [historicalMode, setHistoricalMode] = useState(false);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const logAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll log to bottom when new lines arrive
  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight;
    }
  }, [logLines]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/scrape-college-careers', {
          headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
        });
        if (res.ok) {
          const { log } = await res.json();
          setLogLines((log as string[]).slice(-20));
        }
      } catch {
        // silently ignore transient poll errors
      }
    }, 5000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setRunning(false);
  }

  async function startJob() {
    // Resolve effective start: prefer name-based startFrom over numeric startIdx
    let effectiveStartIdx = startIdx;
    if (startFrom.trim()) {
      const nameIdx = D1_SCHOOLS.findIndex(
        s => s.toLowerCase() === startFrom.trim().toLowerCase(),
      );
      if (nameIdx !== -1) effectiveStartIdx = nameIdx;
    }

    const schools = D1_SCHOOLS.slice(effectiveStartIdx);

    setRunning(true);
    setLogLines([`[client] Dispatching job: ${schools.length} schools from index ${effectiveStartIdx}${startFrom.trim() ? ` ("${startFrom.trim()}")` : ''}${historicalMode ? ' [HISTORICAL]' : ''}${dryRun ? ' [DRY RUN]' : ''}`]);

    try {
      await fetch('/api/admin/scrape-college-careers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}`,
        },
        body: JSON.stringify({
          schools,
          delay_ms: delayMs,
          dry_run: dryRun,
          historical_mode: historicalMode,
          ...(startFrom.trim() ? { startFrom: startFrom.trim() } : {}),
        }),
      });
    } catch {
      // fire-and-forget — response doesn't matter
    }

    startPolling();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-mono">
      <h1 className="text-2xl font-bold mb-2">College Careers Scraper</h1>
      <p className="text-slate-400 text-sm mb-6">
        Dispatches a background scrape job and streams server logs every 5 s.
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
        <div>
          <label className="block text-xs text-slate-400 mb-1">Start from school (name)</label>
          <input
            type="text"
            value={startFrom}
            onChange={e => setStartFrom(e.target.value)}
            placeholder="e.g. Duke"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm w-40 placeholder:text-slate-600"
            disabled={running}
          />
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={historicalMode}
            onChange={e => setHistoricalMode(e.target.checked)}
            disabled={running}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-300">Historical mode (scrapes archived roster pages, slower)</span>
        </label>

        {!running ? (
          <button
            onClick={startJob}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-semibold transition-colors"
          >
            ▶ Start
          </button>
        ) : (
          <button
            onClick={stopPolling}
            className="px-5 py-2 bg-red-700 hover:bg-red-600 rounded text-sm font-semibold transition-colors"
          >
            ■ Stop polling
          </button>
        )}
      </div>

      {/* Log textarea */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Server log {running && <span className="text-indigo-400">(polling every 5 s)</span>}</span>
          <span className="text-xs text-slate-600">last 20 lines</span>
        </div>
        <textarea
          ref={logAreaRef}
          readOnly
          value={logLines.join('\n')}
          placeholder="Log output will appear here after job starts..."
          className="w-full h-96 bg-slate-900 border border-slate-800 rounded p-4 text-xs text-slate-300 leading-6 resize-none focus:outline-none placeholder:text-slate-600"
        />
      </div>
    </div>
  );
}
