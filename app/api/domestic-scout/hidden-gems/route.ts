import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('domestic_rankings')
      .select('*')
      .eq('is_hidden_gem', true)
      .order('snapshot_date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Keep only the latest snapshot per player+country+age
    const seen = new Map<string, NonNullable<typeof data>[0]>()
    for (const row of data ?? []) {
      const key = `${row.player_name}|${row.country_code}|${row.age_category}`
      if (!seen.has(key)) seen.set(key, row)
    }

    const deduped = Array.from(seen.values())
      .sort((a, b) => a.domestic_rank - b.domestic_rank)

    return NextResponse.json({ success: true, data: deduped })
  } catch (error) {
    console.error('[domestic-scout/hidden-gems] error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 }
    )
  }
}
