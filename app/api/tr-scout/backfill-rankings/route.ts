import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('[backfill] body:', JSON.stringify(body))
    const { tennisrecruiting_id, ranking_yr1, ranking_yr2, ranking_yr3, ranking_yr4 } = body

    if (!tennisrecruiting_id) {
      return NextResponse.json({ success: false, error: 'tennisrecruiting_id required' }, { status: 400 })
    }

    const updates: Record<string, number> = {}
    const updated: string[] = []

    if (ranking_yr1 != null) { updates.ranking_yr1 = Number(ranking_yr1); updated.push('ranking_yr1') }
    if (ranking_yr2 != null) { updates.ranking_yr2 = Number(ranking_yr2); updated.push('ranking_yr2') }
    if (ranking_yr3 != null) { updates.ranking_yr3 = Number(ranking_yr3); updated.push('ranking_yr3') }
    if (ranking_yr4 != null) { updates.ranking_yr4 = Number(ranking_yr4); updated.push('ranking_yr4') }

    if (updated.length === 0) {
      return NextResponse.json({ success: false, error: 'No rankings provided' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('junior_profiles')
      .update(updates)
      .eq('tennisrecruiting_id', String(tennisrecruiting_id))
      .select('tennisrecruiting_id')

    console.log('[backfill] update result:', data, error)

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, reason: 'player not in DB' })
    }

    return NextResponse.json({ success: true, updated })
  } catch (error) {
    console.error('[backfill-rankings] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save rankings' }, { status: 500 })
  }
}
