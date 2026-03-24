import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processSchool, processAllHistorical, JuniorProfileRow } from '@/scraper/orchestrator/processSchool';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── In-memory log ─────────────────────────────────────────────────────────────
const scrapeLog: string[] = [];

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  scrapeLog.push(line);
  if (scrapeLog.length > 500) scrapeLog.shift();
}

// ── Background job ────────────────────────────────────────────────────────────
async function runScrapeJob(body: {
  schools?: string[];
  delay_ms: number;
  dry_run: boolean;
  max_players?: number;
  historical_mode: boolean;
  startFrom?: string;
}) {
  const { schools, delay_ms, dry_run, max_players, historical_mode, startFrom } = body;

  try {
    // Batch historical: hand off to processAllHistorical (handles SCHOOL_MAP
    // iteration + browser restart every 10 schools internally)
    if (!schools?.length && historical_mode) {
      log(`Starting batch historical scrape${startFrom ? ` from "${startFrom}"` : ''}`);
      const results = await processAllHistorical(supabase, {
        delay_ms, dry_run, max_players, historical_mode: true, startFrom,
      });
      const totalUpserted = results.reduce((sum, r) => sum + r.upserted, 0);
      log(`Batch complete — ${results.length} schools processed, ${totalUpserted} total upserted`);
      return;
    }

    if (!schools?.length) {
      log('ERROR: No schools specified');
      return;
    }

    log(`Starting scrape for ${schools.length} school(s)${historical_mode ? ' [HISTORICAL]' : ''}${dry_run ? ' [DRY RUN]' : ''}`);

    for (let i = 0; i < schools.length; i++) {
      const schoolName = schools[i];
      log(`[${i + 1}/${schools.length}] Processing ${schoolName}...`);

      try {
        let juniorQuery = supabase
          .from('junior_profiles')
          .select('id, name, committed_school, committed_year, division, peak_ranking')
          .eq('committed_school', schoolName);

        if (!historical_mode) {
          const cutoffYear = new Date().getFullYear() - 5;
          juniorQuery = juniorQuery.gte('committed_year', cutoffYear);
        }

        const { data: juniors, error: fetchError } = await juniorQuery;

        if (fetchError) {
          log(`  ERROR fetching juniors: ${fetchError.message}`);
          continue;
        }

        if (!juniors || juniors.length === 0) {
          log(`  No juniors found — skipping`);
          continue;
        }

        const result = await processSchool(
          supabase,
          schoolName,
          juniors as JuniorProfileRow[],
          { delay_ms, dry_run, max_players, historical_mode, startFrom },
        );

        log(`  upserted=${result.upserted} exact=${result.matched_exact} high=${result.matched_high} ambiguous=${result.ambiguous} no_match=${result.no_match} errors=${result.errors} (${(result.elapsed_ms / 1000).toFixed(1)}s)`);
      } catch (err) {
        log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    log(`All done — ${schools.length} school(s) processed`);
  } catch (err) {
    log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    schools?: string[];
    delay_ms?: number;
    dry_run?: boolean;
    max_players?: number;
    historical_mode?: boolean;
    startFrom?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { schools, delay_ms = 700, dry_run = false, max_players, historical_mode = false, startFrom } = body;

  runScrapeJob({ schools, delay_ms, dry_run, max_players, historical_mode, startFrom });

  return NextResponse.json({ success: true, message: 'Scrape job started in background' });
}

export async function GET() {
  return NextResponse.json({ log: scrapeLog.slice(-100) });
}
