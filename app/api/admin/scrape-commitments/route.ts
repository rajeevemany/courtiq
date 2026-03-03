import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// GET /api/admin/scrape-commitments — return total junior_profiles count
// ---------------------------------------------------------------------------
export async function GET() {
  const { count } = await supabase
    .from('junior_profiles')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({ total: count ?? 0 })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ParsedPlayer {
  tennisrecruiting_id: string
  name: string
  state: string | null
  rating: string | null
  committed_school: string | null
  division: string | null
  conference: string | null
  committed_year: number
  ranking_yr1: number | null
  ranking_yr2: number | null
  ranking_yr3: number | null
  ranking_yr4: number | null
  rpi_yr1: number | null
  rpi_yr2: number | null
  rpi_yr3: number | null
  rpi_yr4: number | null
  peak_ranking: number | null
  peak_year: number | null
}

// ---------------------------------------------------------------------------
// POST /api/admin/scrape-commitments
// Body: { players: ParsedPlayer[] }
// Upserts a batch of players to junior_profiles.
// Protected by Authorization: Bearer <CRON_SECRET>.
// Called by scripts/scrape-commitments.ts running locally via Playwright.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const players: ParsedPlayer[] = body.players

  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json({ error: 'players array required' }, { status: 400 })
  }

  const rows = players.map(p => ({
    tennisrecruiting_id: p.tennisrecruiting_id,
    name:                p.name,
    state:               p.state               ?? null,
    rating:              p.rating              ?? null,
    committed_school:    p.committed_school    ?? null,
    division:            p.division            ?? null,
    conference:          p.conference          ?? null,
    committed_year:      p.committed_year,
    ranking_yr1:         p.ranking_yr1         ?? null,
    ranking_yr2:         p.ranking_yr2         ?? null,
    ranking_yr3:         p.ranking_yr3         ?? null,
    ranking_yr4:         p.ranking_yr4         ?? null,
    rpi_yr1:             p.rpi_yr1             ?? null,
    rpi_yr2:             p.rpi_yr2             ?? null,
    rpi_yr3:             p.rpi_yr3             ?? null,
    rpi_yr4:             p.rpi_yr4             ?? null,
    peak_ranking:        p.peak_ranking        ?? null,
    peak_year:           p.peak_year           ?? null,
    data_scraped_at:     new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('junior_profiles')
    .upsert(rows, { onConflict: 'tennisrecruiting_id' })

  if (error) {
    console.error('[scrape-commitments] upsert error:', error.message)
    return NextResponse.json({ error: error.message, upserted: 0, errors: rows.length }, { status: 500 })
  }

  console.log(`[scrape-commitments] upserted ${rows.length} players`)
  return NextResponse.json({ upserted: rows.length, errors: 0 })
}
