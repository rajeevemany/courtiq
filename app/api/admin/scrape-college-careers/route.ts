import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processSchool, JuniorProfileRow, SchoolResult } from '@/scraper/orchestrator/processSchool';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  // Bearer token auth
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    school: string;
    delay_ms?: number;
    dry_run?: boolean;
    max_players?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { school, delay_ms = 700, dry_run = false, max_players } = body;

  if (!school) {
    return NextResponse.json({ error: 'Missing required field: school' }, { status: 400 });
  }

  // Fetch committed D1 juniors for this school (last 5 years)
  const currentYear = new Date().getFullYear();
  const cutoffYear  = currentYear - 5;

  const { data: juniors, error: fetchError } = await supabase
    .from('junior_profiles')
    .select('id, name, committed_school, committed_year, division, peak_ranking')
    .eq('committed_school', school)
    .gte('committed_year', cutoffYear);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!juniors || juniors.length === 0) {
    return NextResponse.json({
      ok:     true,
      school,
      result: {
        school,
        roster_size:   0,
        total_juniors: 0,
        upserted:      0,
        matched_exact: 0,
        matched_high:  0,
        ambiguous:     0,
        no_match:      0,
        errors:        0,
        players:       [],
        elapsed_ms:    0,
      } as SchoolResult,
    });
  }

  const result = await processSchool(
    supabase,
    school,
    juniors as JuniorProfileRow[],
    { delay_ms, dry_run, max_players },
  );

  return NextResponse.json({ ok: true, school, result });
}
